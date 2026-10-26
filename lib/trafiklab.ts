import { cacheLife } from "next/cache";
import { stockholmMinutesFromNow } from "./clock";
import type { Departure, DepartureBoard, Stop, TransportMode } from "./types";

// Trafiklab Realtime APIs: https://www.trafiklab.se/api/our-apis/trafiklab-realtime-apis/
const BASE = "https://realtime-api.trafiklab.se/v1";

type RawStopGroup = {
  id: string;
  name: string;
  average_daily_stop_times: number;
  stops: { lat: number; lon: number }[];
};

type RawDeparture = {
  scheduled: string;
  realtime: string;
  canceled: boolean | string;
  is_realtime: boolean;
  route: { designation: string | null; name: string | null; direction: string; transport_mode: string };
  trip: { trip_id: string };
  realtime_platform: { designation: string } | null;
  scheduled_platform: { designation: string } | null;
};

const MODES: TransportMode[] = ["BUS", "TRAIN", "TRAM", "METRO", "BOAT", "TAXI"];

function toMode(mode: string): TransportMode {
  return MODES.includes(mode as TransportMode) ? (mode as TransportMode) : "OTHER";
}

// Rough box around Värmland, used to list local stops before the rest of Sweden.
function inVarmland(group: RawStopGroup) {
  return group.stops.some((s) => s.lat > 58.8 && s.lat < 61.1 && s.lon > 11.6 && s.lon < 14.6);
}

// "skare" should find "Skåre". The API matches letters exactly, so a query
// typed without å/ä/ö is also tried with one letter swapped at a time.
function accentVariants(query: string) {
  const variants: string[] = [];
  for (let i = 0; i < query.length; i++) {
    const swaps = query[i] === "a" ? ["å", "ä"] : query[i] === "o" ? ["ö"] : [];
    for (const s of swaps) variants.push(query.slice(0, i) + s + query.slice(i + 1));
  }
  return variants.slice(0, 6);
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}?key=${process.env.TRAFIKLAB_REALTIME_KEY}`);
  if (!res.ok) throw new Error(`Trafiklab ${path.split("/")[1]} answered ${res.status}`);
  return res.json();
}

async function findStopGroups(query: string): Promise<RawStopGroup[]> {
  "use cache";
  cacheLife("hours");

  const data = await getJson<{ stop_groups?: RawStopGroup[] }>(`/stops/name/${encodeURIComponent(query)}`);
  return data.stop_groups ?? [];
}

export async function searchStops(query: string): Promise<Stop[]> {
  let groups = await findStopGroups(query);
  // The free key allows 25 calls a minute, so variants are only tried when the
  // plain search found nothing at all in Värmland.
  if (!/[åäö]/.test(query) && !groups.some(inVarmland)) {
    const more = await Promise.all(accentVariants(query).map(findStopGroups));
    groups = [...groups, ...more.flat()];
  }

  const unique = [...new Map(groups.map((g) => [g.id, g])).values()];
  unique.sort(
    (a, b) =>
      Number(inVarmland(b)) - Number(inVarmland(a)) || b.average_daily_stop_times - a.average_daily_stop_times,
  );
  return unique.slice(0, 8).map((g) => ({ id: g.id, name: g.name, lat: g.stops[0]?.lat, lon: g.stops[0]?.lon }));
}

type RawBoard = { stops?: { name: string }[]; departures?: RawDeparture[] };

// One 60-minute window of departures. Without `from` Trafiklab starts about
// ten minutes back in the timetable.
async function fetchWindow(areaId: string, from: string | null): Promise<RawBoard> {
  "use cache";
  // Trafiklab caches departures for 60 s itself, so refreshing faster gains nothing.
  cacheLife({ stale: 30, revalidate: 30, expire: 60 });

  return getJson<RawBoard>(from ? `/departures/${areaId}/${from}` : `/departures/${areaId}`);
}

// Departures from 40 minutes ago to an hour ahead. The default window drops a
// bus once its timetable time is ten minutes old, even if it is running 30
// minutes late and still on its way, so an earlier window is merged in. The
// board therefore also holds departures that have left; the app hides those
// unless asked.
export async function getDepartures(areaId: string): Promise<DepartureBoard> {
  const [current, earlier] = await Promise.all([
    fetchWindow(areaId, null),
    fetchWindow(areaId, stockholmMinutesFromNow(-40)),
  ]);
  return toBoard(current, earlier);
}

// Only the default window: one call instead of two. Enough for adding delays
// to planned trips, which never start from a bus whose timetable time has passed.
export async function getUpcomingDepartures(areaId: string): Promise<DepartureBoard> {
  return toBoard(await fetchWindow(areaId, null));
}

function toBoard(current: RawBoard, earlier?: RawBoard): DepartureBoard {
  // A train run by two operators (Värmlandstrafik and Vy Tåg) is listed once per
  // operator, and the two windows overlap, so merge on line, time and direction
  // and keep the realtime copy.
  const unique = new Map<string, RawDeparture>();
  for (const d of [...(current.departures ?? []), ...(earlier?.departures ?? [])]) {
    const key = `${d.route.designation}|${d.scheduled}|${d.route.direction}`;
    const existing = unique.get(key);
    if (!existing || (!existing.is_realtime && d.is_realtime)) unique.set(key, d);
  }
  const departures: Departure[] = [...unique.values()].map((d) => ({
    id: `${d.trip.trip_id}-${d.scheduled}`,
    line: d.route.designation ?? d.route.name ?? "",
    direction: d.route.direction,
    mode: toMode(d.route.transport_mode),
    scheduled: d.scheduled,
    expected: d.realtime,
    canceled: d.canceled === true || d.canceled === "true",
    isRealtime: d.is_realtime,
    platform: (d.realtime_platform ?? d.scheduled_platform)?.designation ?? null,
  }));
  departures.sort((a, b) => a.expected.localeCompare(b.expected));
  return { stopName: current.stops?.[0]?.name ?? null, departures };
}
