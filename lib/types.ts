// Shapes our API routes return to the browser.
// Times are Swedish local time without offset: "YYYY-MM-DDTHH:mm:ss".

export type TransportMode = "BUS" | "TRAIN" | "TRAM" | "METRO" | "BOAT" | "TAXI" | "OTHER";

export type Stop = {
  id: string;
  name: string;
  // Known for stops from search or "near me"; used to pick a widget's direction.
  lat?: number;
  lon?: number;
};

export type NearbyStop = Stop & { distance: number };

export type Departure = {
  id: string;
  line: string;
  direction: string;
  mode: TransportMode;
  scheduled: string;
  expected: string;
  canceled: boolean;
  isRealtime: boolean;
  platform: string | null;
};

export type DepartureBoard = {
  stopName: string | null;
  // Includes departures from the last 40 minutes; the app hides those that have left.
  departures: Departure[];
};

export type TripLeg =
  | {
      kind: "ride";
      line: string;
      mode: TransportMode;
      direction: string | null;
      from: string;
      fromId: string;
      to: string;
      departure: string;
      arrival: string;
      scheduledDeparture: string;
      scheduledArrival: string;
      // True once the departure has been matched to live data.
      isRealtime: boolean;
      canceled: boolean;
    }
  | {
      kind: "walk";
      from: string;
      to: string;
      departure: string;
      arrival: string;
    };

export type Trip = {
  id: string;
  departure: string;
  arrival: string;
  durationMinutes: number;
  changes: number;
  // A delay makes one of the changes too tight to catch.
  missedChange: boolean;
  legs: TripLeg[];
};

export type TripResults = {
  trips: Trip[];
  // Pass back as `page` to fetch the trips after or before these.
  later: string | null;
  earlier: string | null;
};

export type ApiError = { error: string };
