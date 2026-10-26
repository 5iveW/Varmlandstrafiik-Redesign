"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { ApiError, DepartureBoard, TripResults } from "./types";

export async function fetchApi<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error((body as ApiError | null)?.error ?? "Något gick fel.");
  return body as T;
}

// One shared clock that ticks every 15 s so countdowns stay current between
// refreshes. The server snapshot is 0 because the current time must not be
// read while Next prerenders a page; the real time arrives on hydration.
const clockListeners = new Set<() => void>();
let clockNow = 0;
let clockTimer: ReturnType<typeof setInterval> | undefined;

function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (!clockTimer) {
    clockTimer = setInterval(() => {
      clockNow = Date.now();
      clockListeners.forEach((l) => l());
    }, 15000);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0) {
      clearInterval(clockTimer);
      clockTimer = undefined;
      clockNow = 0;
    }
  };
}

export function useNow() {
  return useSyncExternalStore(
    subscribeClock,
    () => clockNow || (clockNow = Date.now()),
    () => 0,
  );
}

type BoardState = {
  stopId: string | null;
  data: DepartureBoard | null;
  error: string | null;
  updatedAt: number | null;
};

// Loads a stop's departures and refreshes them while the page is visible.
// Trafiklab only updates its data once a minute, so polling faster gains nothing
// and eats into the free key's 25 calls a minute.
export function useDepartures(stopId: string, refreshMs = 60000) {
  const [state, setState] = useState<BoardState>({ stopId: null, data: null, error: null, updatedAt: null });
  const [manual, setManual] = useState(0);

  useEffect(() => {
    let controller = new AbortController();
    const load = () => {
      controller.abort();
      controller = new AbortController();
      fetchApi<DepartureBoard>(`/api/departures/${stopId}`, controller.signal)
        .then((data) => setState({ stopId, data, error: null, updatedAt: Date.now() }))
        .catch((e: Error) => {
          if (e.name !== "AbortError") setState((s) => ({ ...s, stopId, error: e.message }));
        });
    };
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, refreshMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [stopId, refreshMs, manual]);

  const refresh = useCallback(() => setManual((n) => n + 1), []);
  const current = state.stopId === stopId;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    updatedAt: current ? state.updatedAt : null,
    loading: !current,
    refresh,
  };
}

type TripsState = { key: string | null; data: TripResults | null; error: string | null };

// The next trips between two stops, refreshed every minute while visible.
export function useTrips(fromId: string, toId: string, refreshMs = 60000) {
  const key = `${fromId}>${toId}`;
  const [state, setState] = useState<TripsState>({ key: null, data: null, error: null });

  useEffect(() => {
    let controller = new AbortController();
    const load = () => {
      controller.abort();
      controller = new AbortController();
      fetchApi<TripResults>(`/api/trips?from=${fromId}&to=${toId}`, controller.signal)
        .then((data) => setState({ key, data, error: null }))
        .catch((e: Error) => {
          if (e.name !== "AbortError") setState((s) => ({ ...s, key, error: e.message }));
        });
    };
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, refreshMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fromId, toId, key, refreshMs]);

  const current = state.key === key;
  return { data: current ? state.data : null, error: current ? state.error : null, loading: !current };
}

export type Position = { lat: number; lon: number };

// The phone's position, but only if location access was already granted, so
// the home screen never pops a permission prompt by itself. Refreshed when the
// app comes back to the foreground or access is granted later.
export function useGrantedPosition() {
  const [position, setPosition] = useState<Position | null>(null);

  useEffect(() => {
    let status: PermissionStatus | null = null;
    const read = () => {
      if (status?.state === "granted" && document.visibilityState === "visible") {
        getPosition()
          .then(setPosition)
          .catch(() => {});
      }
    };
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((p) => {
        status = p;
        p.onchange = read;
        read();
      })
      .catch(() => {});
    document.addEventListener("visibilitychange", read);
    return () => {
      if (status) status.onchange = null;
      document.removeEventListener("visibilitychange", read);
    };
  }, []);

  return position;
}

export function getPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Din webbläsare kan inte dela position."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? "Platsåtkomst är avstängd. Slå på den i telefonens inställningar."
              : "Kunde inte hitta din position just nu.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}
