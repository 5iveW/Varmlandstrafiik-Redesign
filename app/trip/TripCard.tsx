"use client";

import { CaretDownIcon, PersonSimpleWalkIcon, WarningIcon } from "@phosphor-icons/react";
import { LegChips, firstRideMoved } from "@/components/LegChips";
import { LineBadge } from "@/components/LineBadge";
import { RemindButton } from "@/components/RemindButton";
import { useNow } from "@/lib/hooks";
import { clock, duration, minutesBetween, minutesUntil } from "@/lib/time";
import type { Trip, TripLeg } from "@/lib/types";

function LegDetail({ leg }: { leg: TripLeg }) {
  if (leg.kind === "walk") {
    const minutes = minutesBetween(leg.departure, leg.arrival);
    return (
      <li className="flex items-center gap-3 py-2 pl-1 text-sm text-zinc-500 dark:text-zinc-400">
        <PersonSimpleWalkIcon weight="bold" className="size-5 shrink-0" aria-hidden />
        <span>{leg.from === leg.to ? `Byte, ${minutes} min` : `Gå ${minutes} min till ${leg.to}`}</span>
      </li>
    );
  }
  const late = clock(leg.departure) !== clock(leg.scheduledDeparture);
  const lateArrival = clock(leg.arrival) !== clock(leg.scheduledArrival);
  return (
    <li className={`flex gap-3 py-2 ${leg.canceled ? "opacity-60" : ""}`}>
      <LineBadge line={leg.line} mode={leg.mode} size="sm" />
      <div className="min-w-0 flex-1 text-sm">
        {leg.direction && <p className="text-zinc-500 dark:text-zinc-400">Mot {leg.direction}</p>}
        {leg.canceled && <p className="font-semibold text-red-600 dark:text-red-400">Inställd</p>}
        <div className="mt-1 grid grid-cols-[3rem_1fr] gap-x-2 gap-y-1">
          <span className={`font-semibold tabular-nums ${late ? "text-orange-700 dark:text-orange-400" : ""}`}>
            {clock(leg.departure)}
          </span>
          <span className="truncate">
            {leg.from}
            {late && <s className="ml-1.5 text-zinc-400">{clock(leg.scheduledDeparture)}</s>}
          </span>
          <span className={`font-semibold tabular-nums ${lateArrival ? "text-orange-700 dark:text-orange-400" : ""}`}>
            {clock(leg.arrival)}
          </span>
          <span className="truncate">{leg.to}</span>
        </div>
        {!leg.isRealtime && <p className="mt-1 text-xs text-zinc-400">Ingen realtid än, visar tidtabellen</p>}
      </div>
    </li>
  );
}

function leaveText(minutes: number) {
  if (minutes < 0) return "Har gått";
  if (minutes < 1) return "Går nu";
  if (minutes < 60) return `Om ${minutes} min`;
  return null;
}

export function TripCard({ trip, index }: { trip: Trip; index: number }) {
  const now = useNow();
  const canceled = trip.legs.some((l) => l.kind === "ride" && l.canceled);
  const leave = leaveText(minutesUntil(trip.departure, now));
  const gone = minutesUntil(trip.departure, now) < 0;
  const changes = trip.changes === 0 ? "Direkt" : `${trip.changes} byte${trip.changes > 1 ? "n" : ""}`;

  return (
    <details
      style={{ "--i": index } as React.CSSProperties}
      className={`rise group rounded-2xl bg-white ring-1 ring-zinc-900/5 dark:bg-zinc-900 dark:ring-white/5 ${gone ? "opacity-60" : ""}`}
    >
      <summary className="flex cursor-pointer list-none flex-col gap-2.5 rounded-2xl p-4 active:bg-zinc-50 dark:active:bg-zinc-800/40">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xl font-semibold tracking-tight tabular-nums">
            <span className={firstRideMoved(trip.legs) ? "text-orange-700 dark:text-orange-400" : ""}>
              {clock(trip.departure)}
            </span>
            <span className="mx-1.5 font-normal text-zinc-400">till</span>
            {clock(trip.arrival)}
          </p>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{duration(trip.durationMinutes)}</p>
        </div>
        <LegChips legs={trip.legs} />
        <div className="flex items-center justify-between text-[13px]">
          {canceled ? (
            <span className="font-semibold text-red-600 dark:text-red-400">En del av resan är inställd</span>
          ) : trip.missedChange ? (
            <span className="flex items-center gap-1 font-semibold text-orange-700 dark:text-orange-400">
              <WarningIcon weight="fill" className="size-4" aria-hidden />
              Förseningen kan göra att du missar bytet
            </span>
          ) : (
            <span className="text-zinc-500 dark:text-zinc-400">
              {leave && <span className={gone ? "font-medium" : "font-semibold text-brand-ink"}>{leave}</span>}
              {leave && " · "}
              {changes}
            </span>
          )}
          <CaretDownIcon
            weight="bold"
            className="size-4 text-zinc-400 transition-transform group-open:rotate-180"
            aria-label="Visa detaljer"
          />
        </div>
      </summary>
      <ul className="mx-4 border-t border-zinc-100 py-2 dark:border-zinc-800/70">
        {trip.legs.map((leg, i) => (
          <LegDetail key={i} leg={leg} />
        ))}
      </ul>
      {!gone && (
        <div className="mx-4 border-t border-zinc-100 py-3 dark:border-zinc-800/70">
          <RemindButton trip={trip} />
        </div>
      )}
    </details>
  );
}
