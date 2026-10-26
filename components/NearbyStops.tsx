"use client";

import { ArrowClockwiseIcon, MapPinIcon, NavigationArrowIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchApi, getPosition } from "@/lib/hooks";
import { distance } from "@/lib/time";
import type { NearbyStop } from "@/lib/types";

type State =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "done"; stops: NearbyStop[] }
  | { status: "error"; message: string };

export function NearbyStops() {
  const [state, setState] = useState<State>({ status: "idle" });

  function locate() {
    setState({ status: "locating" });
    getPosition()
      .then((p) => fetchApi<NearbyStop[]>(`/api/nearby?lat=${p.lat}&lon=${p.lon}`))
      .then((stops) => setState({ status: "done", stops }))
      .catch((e: Error) => setState({ status: "error", message: e.message }));
  }

  // Once the user has allowed location, look up nearby stops straight away.
  useEffect(() => {
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((p) => {
        if (p.state === "granted") locate();
      })
      .catch(() => {});
  }, []);

  if (state.status === "idle" || state.status === "error") {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={locate}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-medium text-brand-ink ring-1 ring-zinc-900/5 transition-transform active:scale-[0.98] dark:bg-zinc-900 dark:ring-white/5"
        >
          <NavigationArrowIcon weight="fill" className="size-5" aria-hidden />
          Visa hållplatser nära mig
        </button>
        {state.status === "error" && <p className="px-1 text-sm text-red-600 dark:text-red-400">{state.message}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white ring-1 ring-zinc-900/5 dark:bg-zinc-900 dark:ring-white/5">
      {state.status === "locating" ? (
        <p className="flex items-center gap-2 px-4 py-4 text-sm text-zinc-500">
          <NavigationArrowIcon weight="fill" className="size-4 text-brand-ink motion-safe:animate-pulse" aria-hidden />
          Letar efter hållplatser nära dig...
        </p>
      ) : state.stops.length === 0 ? (
        <p className="px-4 py-4 text-sm text-zinc-500">Inga hållplatser inom 1,5 km.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
          {state.stops.map((stop, i) => (
            <li key={stop.id} className="rise" style={{ "--i": i } as React.CSSProperties}>
              <Link
                href={`/stop/${stop.id}?name=${encodeURIComponent(stop.name)}`}
                className="flex items-center gap-3 px-4 py-3 active:bg-zinc-50 dark:active:bg-zinc-800/50"
              >
                <MapPinIcon className="size-5 shrink-0 text-zinc-400" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{stop.name}</span>
                <span className="shrink-0 text-[13px] text-zinc-500 tabular-nums">{distance(stop.distance)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {state.status === "done" && (
        <button
          type="button"
          onClick={locate}
          className="flex w-full items-center justify-center gap-1.5 border-t border-zinc-100 py-2.5 text-[13px] font-medium text-zinc-500 active:bg-zinc-50 dark:border-zinc-800/70 dark:active:bg-zinc-800/50"
        >
          <ArrowClockwiseIcon weight="bold" className="size-3.5" aria-hidden />
          Uppdatera position
        </button>
      )}
    </div>
  );
}
