import { buildTrip, searchTrips, type TripQuery } from "./resrobot";
import { getUpcomingDepartures } from "./trafiklab";
import type { DepartureBoard, TripLeg, TripResults } from "./types";

// ResRobot plans with timetable times only. Each bus or train in a trip is
// looked up on its stop's live departure board (Trafiklab), matched on line
// number and a timetable time within 90 seconds, and its delay applied.
// Arrivals are moved by the same delay, an estimate since Trafiklab's
// departure board has no arrival time for the stop where you get off.

const MATCH_WINDOW_MS = 90_000;

function ms(time: string) {
  return Date.parse(`${time}Z`);
}

function shift(time: string, deltaMs: number) {
  return new Date(ms(time) + deltaMs).toISOString().slice(0, 19);
}

function applyDelay(leg: Extract<TripLeg, { kind: "ride" }>, board: DepartureBoard | null) {
  const match = board?.departures.find(
    (d) =>
      d.line.toLowerCase() === leg.line.toLowerCase() &&
      Math.abs(ms(d.scheduled) - ms(leg.scheduledDeparture)) <= MATCH_WINDOW_MS,
  );
  if (!match) return leg;
  const delay = ms(match.expected) - ms(match.scheduled);
  return {
    ...leg,
    departure: shift(leg.scheduledDeparture, delay),
    arrival: shift(leg.scheduledArrival, Math.max(0, delay)),
    isRealtime: match.isRealtime,
    canceled: leg.canceled || match.canceled,
  };
}

export async function searchLiveTrips(query: TripQuery): Promise<TripResults> {
  const results = await searchTrips(query);

  // One board per stop, shared by every trip that boards there.
  const stopIds = new Set<string>();
  for (const trip of results.trips) {
    for (const leg of trip.legs) if (leg.kind === "ride" && leg.fromId) stopIds.add(leg.fromId);
  }
  const boards = new Map<string, DepartureBoard | null>();
  await Promise.all(
    [...stopIds].map(async (id) => {
      // A missing board only means no delays for that stop.
      boards.set(id, await getUpcomingDepartures(id).catch(() => null));
    }),
  );

  const trips = results.trips.map((trip) => {
    const legs = trip.legs.map((leg) => (leg.kind === "ride" ? applyDelay(leg, boards.get(leg.fromId) ?? null) : leg));

    // A walk to the first bus starts later when that bus is late, and the walk
    // after the last one starts when it arrives.
    const rides = legs.filter((l) => l.kind === "ride");
    const first = rides[0];
    const last = rides[rides.length - 1];
    const lead = first ? ms(first.departure) - ms(first.scheduledDeparture) : 0;
    const tail = last ? ms(last.arrival) - ms(last.scheduledArrival) : 0;
    const firstRide = legs.findIndex((l) => l.kind === "ride");
    const lastRide = legs.findLastIndex((l) => l.kind === "ride");
    const adjusted = legs.map((leg, i) => {
      if (leg.kind !== "walk") return leg;
      const delta = i < firstRide ? lead : i > lastRide ? tail : 0;
      return delta ? { ...leg, departure: shift(leg.departure, delta), arrival: shift(leg.arrival, delta) } : leg;
    });
    return buildTrip(trip.id, adjusted);
  });

  // Delays can reorder trips, so sort on the live departure.
  trips.sort((a, b) => a.departure.localeCompare(b.departure));
  return { ...results, trips };
}
