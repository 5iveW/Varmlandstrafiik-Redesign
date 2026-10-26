import { cacheLife } from "next/cache";
import type { NearbyStop, TransportMode, Trip, TripLeg, TripResults } from "./types";

// ResRobot v2.1: https://www.trafiklab.se/api/our-apis/resrobot-v21/
// Its trips carry timetable times only; lib/live-trips.ts adds the delays.
const BASE = "https://api.resrobot.se/v2.1";

type RawPoint = { name: string; extId?: string; date: string; time: string };
type RawProduct = { name?: string; num?: string; catOutL?: string };
type RawLeg = {
  type: "JNY" | "WALK" | "TRSF" | string;
  name?: string;
  direction?: string;
  cancelled?: boolean;
  Origin: RawPoint;
  Destination: RawPoint;
  Product?: RawProduct | RawProduct[];
};
type RawTrip = { LegList: { Leg: RawLeg | RawLeg[] } };

// A place is either a stop id ("740022197") or coordinates ("59.38,13.50").
// `page` is a scrF/scrB value from an earlier answer.
export type TripQuery = { from: string; to: string; date?: string; time?: string; page?: string };

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function time(p: RawPoint) {
  return `${p.date}T${p.time}`;
}

// Both times are Swedish local time, so compare them as if they were UTC.
export function minutesBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}Z`) - Date.parse(`${a}Z`)) / 60000);
}

function toMode(text: string): TransportMode {
  const t = text.toLowerCase();
  if (t.includes("tåg")) return "TRAIN";
  if (t.includes("buss")) return "BUS";
  if (t.includes("spårvagn")) return "TRAM";
  if (t.includes("tunnelbana")) return "METRO";
  if (t.includes("färja") || t.includes("båt")) return "BOAT";
  if (t.includes("taxi")) return "TAXI";
  return "OTHER";
}

// Trips from or to coordinates name that end "59.380600, 13.499600", and
// ResRobot adds the municipality: "Hagatorget, Karlstad (Karlstad kn)".
function placeName(name: string) {
  if (/^-?\d+\.\d+, -?\d+\.\d+$/.test(name)) return "Din position";
  return name.replace(/\s*\([^)]*kn\)$/, "");
}

function toLeg(leg: RawLeg): TripLeg | null {
  const from = placeName(leg.Origin.name);
  const to = placeName(leg.Destination.name);
  if (leg.type === "JNY") {
    const product = asArray(leg.Product)[0];
    return {
      kind: "ride",
      line: product?.num ?? leg.name ?? "",
      mode: toMode(`${product?.catOutL ?? ""} ${leg.name ?? ""}`),
      direction: leg.direction ? placeName(leg.direction) : null,
      from,
      fromId: leg.Origin.extId ?? "",
      to,
      departure: time(leg.Origin),
      arrival: time(leg.Destination),
      scheduledDeparture: time(leg.Origin),
      scheduledArrival: time(leg.Destination),
      isRealtime: false,
      canceled: leg.cancelled === true,
    };
  }
  if (leg.type === "WALK" || leg.type === "TRSF") {
    return { kind: "walk", from, to, departure: time(leg.Origin), arrival: time(leg.Destination) };
  }
  return null;
}

// Totals for a list of legs, worked out again after delays move the times.
export function buildTrip(id: string, legs: TripLeg[]): Trip {
  const rides = legs.filter((l) => l.kind === "ride");
  const missedChange = rides.some((ride, i) => i > 0 && rides[i - 1].arrival > ride.departure);
  const departure = legs[0].departure;
  const arrival = legs[legs.length - 1].arrival;
  return {
    id,
    departure,
    arrival,
    durationMinutes: minutesBetween(departure, arrival),
    changes: Math.max(0, rides.length - 1),
    missedChange,
    legs,
  };
}

function setPlace(url: URL, prefix: "origin" | "dest", place: string) {
  const [lat, lon] = place.split(",");
  if (lon === undefined) {
    url.searchParams.set(prefix === "origin" ? "originId" : "destId", place);
  } else {
    url.searchParams.set(`${prefix}CoordLat`, lat);
    url.searchParams.set(`${prefix}CoordLong`, lon);
  }
}

export async function searchTrips(query: TripQuery): Promise<TripResults> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 60 });

  const url = new URL(`${BASE}/trip`);
  url.searchParams.set("format", "json");
  url.searchParams.set("lang", "sv");
  url.searchParams.set("numF", "5");
  setPlace(url, "origin", query.from);
  setPlace(url, "dest", query.to);
  if (query.page) url.searchParams.set("context", query.page);
  else {
    if (query.date) url.searchParams.set("date", query.date);
    if (query.time) url.searchParams.set("time", query.time);
  }
  url.searchParams.set("accessId", process.env.RESROBOT_KEY ?? "");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`ResRobot trip answered ${res.status}`);
  const data: { Trip?: RawTrip[]; scrF?: string; scrB?: string } = await res.json();

  const trips = new Map<string, Trip>();
  for (const raw of data.Trip ?? []) {
    const legs = asArray(raw.LegList.Leg)
      .map(toLeg)
      .filter((l): l is TripLeg => l !== null);
    if (legs.length === 0) continue;
    const rides = legs.filter((l) => l.kind === "ride");
    // ResRobot can list the same train twice under different products.
    const id = `${legs[0].departure}|${legs[legs.length - 1].arrival}|${rides.map((r) => r.from).join(",")}`;
    if (!trips.has(id)) trips.set(id, buildTrip(id, legs));
  }
  return { trips: [...trips.values()], later: data.scrF ?? null, earlier: data.scrB ?? null };
}

type RawNearby = { StopLocation?: { extId: string; name: string; dist: number; lat: number; lon: number } };

export async function nearbyStops(lat: string, lon: string): Promise<NearbyStop[]> {
  "use cache";
  cacheLife("hours");

  const url = new URL(`${BASE}/location.nearbystops`);
  url.searchParams.set("format", "json");
  url.searchParams.set("originCoordLat", lat);
  url.searchParams.set("originCoordLong", lon);
  url.searchParams.set("r", "1500");
  url.searchParams.set("maxNo", "6");
  url.searchParams.set("accessId", process.env.RESROBOT_KEY ?? "");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`ResRobot nearbystops answered ${res.status}`);
  const data: { stopLocationOrCoordLocation?: RawNearby[] } = await res.json();
  return (data.stopLocationOrCoordLocation ?? []).flatMap(({ StopLocation: s }) =>
    // Names come as "Drottninggatan, Karlstad (Karlstad kn)"; drop the municipality.
    s
      ? [{ id: s.extId, name: s.name.replace(/\s*\([^)]*kn\)$/, ""), distance: s.dist, lat: s.lat, lon: s.lon }]
      : [],
  );
}
