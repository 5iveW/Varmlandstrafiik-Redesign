"use client";

import {
  ArrowRightIcon,
  ArrowsLeftRightIcon,
  ClockIcon,
  NavigationArrowIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { useGrantedPosition, useNow, useTrips } from "@/lib/hooks";
import { flipTrip, removeTrip, resolveDirection, type SavedTrip, type TripDirection } from "@/lib/pinned";
import { clock, hasLeft, minutesUntil, shortName } from "@/lib/time";
import type { Trip } from "@/lib/types";
import { LegChips, firstRideMoved } from "./LegChips";
import { DepartureSkeleton } from "./Skeletons";

function Leave({ trip, now }: { trip: Trip; now: number }) {
  const minutes = minutesUntil(trip.departure, now);
  if (minutes < 1) return <span className="rounded-md bg-brand px-2 py-0.5 text-[15px] font-bold text-on-brand">Nu</span>;
  if (minutes >= 60) return <span className="text-lg font-semibold tabular-nums">{clock(trip.departure)}</span>;
  return (
    <span className="tabular-nums">
      <span className="text-xl font-semibold">{minutes}</span>
      <span className="ml-0.5 text-xs font-medium">min</span>
    </span>
  );
}

function plannerLink(trip: Pick<SavedTrip, "from" | "to">) {
  const p = new URLSearchParams({ from: trip.from.id, fromName: trip.from.name, to: trip.to.id, toName: trip.to.name });
  return `/trip?${p}`;
}

const AUTO_HINT: Record<TripDirection, string | null> = {
  fixed: null,
  morning: "Håll efter tid på dygnet",
  nearest: "Håll efter var du är",
};

// The next three trips between two saved stops, like a phone widget.
export function TripWidget({ trip: saved, editing }: { trip: SavedTrip; editing: boolean }) {
  const now = useNow();
  const position = useGrantedPosition();
  // Swapping an automatic widget only lasts until the app is reopened.
  const [swapped, setSwapped] = useState(false);
  const direction = saved.direction ?? "fixed";
  // now is 0 while prerendering, so the automatic direction is picked on the phone.
  const resolved = now ? resolveDirection(saved, new Date(now).getHours(), position) : saved;
  const trip = swapped ? { from: resolved.to, to: resolved.from } : resolved;
  const hint = direction === "nearest" && !position ? "Tillåt plats så väljs håll efter var du är" : AUTO_HINT[direction];

  const { data, error, loading } = useTrips(trip.from.id, trip.to.id);
  const next = data?.trips.filter((t) => !hasLeft(t.departure, now)).slice(0, 3) ?? [];

  return (
    <section className="rounded-2xl bg-white px-4 pb-1 ring-1 ring-zinc-900/5 dark:bg-zinc-900 dark:ring-white/5">
      <div className="flex items-center gap-1 pt-2">
        <Link href={plannerLink(trip)} className="flex min-w-0 flex-1 flex-col py-1.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <h2 className="truncate text-[17px] font-semibold tracking-tight">{shortName(trip.from.name)}</h2>
            <ArrowRightIcon weight="bold" className="size-4 shrink-0 text-zinc-400" aria-label="till" />
            <h2 className="truncate text-[17px] font-semibold tracking-tight">{shortName(trip.to.name)}</h2>
          </span>
          {hint && !swapped && (
            <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
              {direction === "morning" ? (
                <ClockIcon weight="bold" className="size-3" aria-hidden />
              ) : (
                <NavigationArrowIcon weight="fill" className="size-3" aria-hidden />
              )}
              {hint}
            </span>
          )}
        </Link>
        {editing ? (
          <button
            type="button"
            onClick={() => removeTrip(saved)}
            aria-label="Ta bort resan"
            className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-full text-red-600 active:bg-red-50 dark:text-red-400 dark:active:bg-red-950/50"
          >
            <XIcon weight="bold" className="size-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => (direction === "fixed" ? flipTrip(saved) : setSwapped(!swapped))}
            aria-label="Åk åt andra hållet"
            className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-transform active:scale-90 active:bg-zinc-100 dark:active:bg-zinc-800"
          >
            <ArrowsLeftRightIcon weight="bold" className="size-5" />
          </button>
        )}
      </div>

      {loading && <DepartureSkeleton rows={2} />}
      {error && !data && <p className="py-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {data && next.length === 0 && <p className="py-3 text-sm text-zinc-500">Inga resor den närmaste tiden.</p>}
      {next.length > 0 && (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
          {next.map((t, i) => (
            <li key={t.id} style={{ "--i": i } as React.CSSProperties} className="rise">
              <Link href={plannerLink(trip)} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2.5">
                <div className="flex min-w-0 flex-col gap-1">
                  <LegChips legs={t.legs} />
                  <p className="flex items-center gap-1.5 text-[13px] text-zinc-500 tabular-nums dark:text-zinc-400">
                    <span className={firstRideMoved(t.legs) ? "font-medium text-orange-700 dark:text-orange-400" : ""}>
                      {clock(t.departure)}
                    </span>
                    till {clock(t.arrival)}
                    {t.missedChange && (
                      <WarningIcon weight="fill" className="size-4 text-orange-600" aria-label="Bytet kan missas" />
                    )}
                  </p>
                </div>
                <Leave trip={t} now={now} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
