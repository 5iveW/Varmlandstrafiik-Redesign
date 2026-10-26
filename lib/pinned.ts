"use client";

import { createStore } from "./storage";
import type { Stop } from "./types";

export type SavedStop = Stop;

const EMPTY: SavedStop[] = [];

// Stops starred by the user, shown on the home screen.
const pinned = createStore<SavedStop[]>("pinned-stops", EMPTY);

export const usePinnedStops = pinned.useValue;

export function togglePinned(stop: SavedStop) {
  const stops = pinned.get();
  pinned.set(stops.some((s) => s.id === stop.id) ? stops.filter((s) => s.id !== stop.id) : [...stops, stop]);
}

// Stops the user recently opened or picked, offered as search suggestions.
const recent = createStore<SavedStop[]>("recent-stops", EMPTY);

export const useRecentStops = recent.useValue;

export function rememberStop(stop: SavedStop) {
  recent.set([stop, ...recent.get().filter((s) => s.id !== stop.id)].slice(0, 5));
}

// How a widget picks its direction:
// - "fixed": from -> to, flipped only by the swap button.
// - "morning": from -> to before 12:00, to -> from after.
// - "nearest": starts at whichever end the phone is closest to (needs location).
export type TripDirection = "fixed" | "morning" | "nearest";

export type SavedTrip = { from: SavedStop; to: SavedStop; direction?: TripDirection };

// Trips shown as widgets on the home screen. These are Wilmer's everyday trips
// and only apply until the list is first changed.
const STOPS = {
  hagatorget: { id: "740057576", name: "Hagatorget, Karlstad", lat: 59.38087, lon: 13.51167 },
  alvkullen: { id: "740022249", name: "Sundsta-Älvkullen, Karlstad", lat: 59.39164, lon: 13.51561 },
  storaTorget: { id: "740057604", name: "Karlstad Stora torget", lat: 59.38071, lon: 13.50304 },
  geijersgatan: { id: "740057551", name: "Geijersgatan, Karlstad", lat: 59.37595, lon: 13.51512 },
  drottninggatan: { id: "740021275", name: "Drottninggatan, Karlstad", lat: 59.37927, lon: 13.49808 },
  central: { id: "740000070", name: "Karlstad Centralstation", lat: 59.37789, lon: 13.49902 },
  amal: { id: "740000076", name: "Åmål station", lat: 59.04633, lon: 12.69875 },
};

const DEFAULT_TRIPS: SavedTrip[] = [
  { from: STOPS.hagatorget, to: STOPS.alvkullen, direction: "morning" },
  { from: STOPS.hagatorget, to: STOPS.storaTorget, direction: "nearest" },
  { from: STOPS.geijersgatan, to: STOPS.storaTorget, direction: "nearest" },
  { from: STOPS.drottninggatan, to: STOPS.hagatorget },
  { from: STOPS.central, to: STOPS.amal },
];

// "v2" because the defaults gained directions; older saved lists are ignored.
const savedTrips = createStore<SavedTrip[]>("saved-trips-v2", DEFAULT_TRIPS);

export const useSavedTrips = savedTrips.useValue;

const sameTrip = (a: SavedTrip, b: SavedTrip) =>
  (a.from.id === b.from.id && a.to.id === b.to.id) || (a.from.id === b.to.id && a.to.id === b.from.id);

export function isTripSaved(trip: SavedTrip, trips: SavedTrip[]) {
  return trips.some((t) => sameTrip(t, trip));
}

export function saveTrip(trip: SavedTrip) {
  if (!isTripSaved(trip, savedTrips.get())) savedTrips.set([...savedTrips.get(), trip]);
}

export function removeTrip(trip: SavedTrip) {
  savedTrips.set(savedTrips.get().filter((t) => !sameTrip(t, trip)));
}

// Flipping a fixed widget remembers the new direction.
export function flipTrip(trip: SavedTrip) {
  savedTrips.set(savedTrips.get().map((t) => (sameTrip(t, trip) ? { ...t, from: t.to, to: t.from } : t)));
}

function metersBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
}

// The direction a widget should show right now. `hour` is the phone's local
// hour; `position` is null until location access has been granted.
export function resolveDirection(
  trip: SavedTrip,
  hour: number,
  position: { lat: number; lon: number } | null,
): { from: SavedStop; to: SavedStop } {
  const reversed = { from: trip.to, to: trip.from };
  if (trip.direction === "morning") return hour < 12 ? trip : reversed;
  if (trip.direction === "nearest" && position) {
    const { from, to } = trip;
    if (from.lat !== undefined && from.lon !== undefined && to.lat !== undefined && to.lon !== undefined) {
      const toFrom = metersBetween(position, { lat: from.lat, lon: from.lon });
      const toTo = metersBetween(position, { lat: to.lat, lon: to.lon });
      return toTo < toFrom ? reversed : trip;
    }
  }
  return trip;
}

// The last trip searched in the planner, restored the next time it opens.
const lastTrip = createStore<SavedTrip | null>("last-trip", null);

export const getLastTrip = lastTrip.get;
export const saveLastTrip = lastTrip.set;
