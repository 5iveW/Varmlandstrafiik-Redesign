import { readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { cacheLife } from "next/cache";
import type { TransportMode } from "./types";

// Live vehicle positions for Värmlandstrafik from Trafiklab's GTFS Regional
// dataset (operator "varm", CC0): https://www.trafiklab.se/api/gtfs-datasets/gtfs-regional/
// The realtime feed only names each vehicle's trip, so the static timetable is
// used to turn trip ids into line numbers.
const BASE = "https://opendata.samtrafiken.se";

export type Vehicle = {
  id: string;
  lat: number;
  lon: number;
  bearing: number | null;
  line: string;
  headsign: string | null;
  mode: TransportMode;
  // Seconds since 1970 when the vehicle last reported.
  timestamp: number;
};

// trip_id -> [line, headsign, GTFS route_type]
type LineIndex = Record<string, [string, string, number]>;

function toMode(routeType: number): TransportMode {
  if (routeType === 3 || (routeType >= 700 && routeType < 800)) return "BUS";
  if (routeType === 2 || (routeType >= 100 && routeType < 200)) return "TRAIN";
  if (routeType === 0 || (routeType >= 900 && routeType < 1000)) return "TRAM";
  if (routeType === 4 || (routeType >= 1000 && routeType < 1300)) return "BOAT";
  if (routeType >= 1500 && routeType < 1600) return "TAXI";
  return "OTHER";
}

// Minimal CSV reader for GTFS files: quoted fields, no embedded newlines.
function parseCsv(text: string) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const split = (line: string) => {
    const out: string[] = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quoted && c === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = !quoted;
      } else if (c === "," && !quoted) {
        out.push(field);
        field = "";
      } else {
        field += c;
      }
    }
    out.push(field);
    return out;
  };
  const [header, ...rows] = lines.map(split);
  return rows.map((row) => Object.fromEntries(header.map((h, i) => [h, row[i] ?? ""])));
}

// The static zip may only be downloaded 50 times a month on the free key, so
// it is also kept on disk for 20 hours, which survives dev server restarts.
async function staticZip(): Promise<Uint8Array> {
  const file = path.join(tmpdir(), "varmlandstrafik-gtfs-varm.zip");
  try {
    const info = await stat(file);
    if (Date.now() - info.mtimeMs < 20 * 3600_000) return new Uint8Array(await readFile(file));
  } catch {
    // Not downloaded yet.
  }
  const res = await fetch(`${BASE}/gtfs/varm/varm.zip?key=${process.env.GTFS_REGIONAL_STATIC_KEY}`);
  if (!res.ok) throw new Error(`GTFS static answered ${res.status}`);
  const zip = new Uint8Array(await res.arrayBuffer());
  await writeFile(file, zip).catch(() => {});
  return zip;
}

// Värmlandstrafik leaves trip_headsign empty, so a trip's destination is the
// name of its last stop in stop_times.txt (30 MB, read once a day). That file
// has no quoted fields, so it is split directly instead of through parseCsv.
function lastStops(stopTimes: string) {
  const lines = stopTimes.replace(/^﻿/, "").split(/\r?\n/);
  const header = lines[0].split(",");
  const tripCol = header.indexOf("trip_id");
  const stopCol = header.indexOf("stop_id");
  const seqCol = header.indexOf("stop_sequence");
  const last = new Map<string, { seq: number; stopId: string }>();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cells = lines[i].split(",");
    const seq = Number(cells[seqCol]);
    const current = last.get(cells[tripCol]);
    if (!current || seq > current.seq) last.set(cells[tripCol], { seq, stopId: cells[stopCol] });
  }
  return last;
}

async function lineIndex(): Promise<LineIndex> {
  "use cache";
  cacheLife("days");

  const wanted = new Set(["routes.txt", "trips.txt", "stops.txt", "stop_times.txt"]);
  const files = unzipSync(await staticZip(), { filter: (f) => wanted.has(f.name) });
  const routes = new Map(
    parseCsv(strFromU8(files["routes.txt"])).map((r) => [
      r.route_id,
      { line: r.route_short_name || r.route_long_name, type: Number(r.route_type) },
    ]),
  );
  const stopNames = new Map(parseCsv(strFromU8(files["stops.txt"])).map((s) => [s.stop_id, s.stop_name]));
  const ends = lastStops(strFromU8(files["stop_times.txt"]));

  const index: LineIndex = {};
  for (const t of parseCsv(strFromU8(files["trips.txt"]))) {
    const route = routes.get(t.route_id);
    if (!route) continue;
    const end = ends.get(t.trip_id);
    const headsign = t.trip_headsign || (end ? (stopNames.get(end.stopId) ?? "") : "");
    index[t.trip_id] = [route.line, headsign, route.type];
  }
  return index;
}

async function vehicleFeed() {
  "use cache";
  // The feed updates every few seconds; sharing it for 10 s keeps a map that is
  // open on several phones within the free key's 50 calls a minute.
  cacheLife({ stale: 30, revalidate: 10, expire: 30 });

  const res = await fetch(`${BASE}/gtfs-rt/varm/VehiclePositions.pb?key=${process.env.GTFS_REGIONAL_RT_KEY}`, {
    headers: { "Accept-Encoding": "gzip" },
  });
  if (!res.ok) throw new Error(`GTFS-RT VehiclePositions answered ${res.status}`);
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(await res.arrayBuffer()));
  return feed.entity.flatMap((e) => {
    const v = e.vehicle;
    if (!v?.position || !v.trip?.tripId) return [];
    return [
      {
        id: v.vehicle?.id ?? e.id,
        tripId: v.trip.tripId,
        lat: v.position.latitude,
        lon: v.position.longitude,
        bearing: v.position.bearing ?? null,
        timestamp: Number(v.timestamp ?? 0),
      },
    ];
  });
}

export async function getVehicles(): Promise<Vehicle[]> {
  const [feed, index] = await Promise.all([vehicleFeed(), lineIndex()]);
  // Vehicles that have not reported for 5 minutes are probably parked.
  const fresh = Date.now() / 1000 - 300;
  return feed.flatMap((v) => {
    const trip = index[v.tripId];
    if (!trip || v.timestamp < fresh) return [];
    const [line, headsign, type] = trip;
    return [
      {
        id: v.id,
        lat: v.lat,
        lon: v.lon,
        bearing: v.bearing,
        line,
        headsign: headsign || null,
        mode: toMode(type),
        timestamp: v.timestamp,
      },
    ];
  });
}
