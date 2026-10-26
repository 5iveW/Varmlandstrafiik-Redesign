"use client";

import { CaretRightIcon, PersonSimpleWalkIcon } from "@phosphor-icons/react";
import { Fragment } from "react";
import { minutesBetween } from "@/lib/time";
import type { TripLeg } from "@/lib/types";
import { LineBadge } from "./LineBadge";

function LegChip({ leg }: { leg: TripLeg }) {
  if (leg.kind === "ride") return <LineBadge line={leg.line} mode={leg.mode} size="sm" />;
  return (
    <span className="inline-flex h-7 items-center gap-0.5 rounded-lg bg-zinc-100 px-1.5 text-xs font-medium text-zinc-600 tabular-nums dark:bg-zinc-800 dark:text-zinc-300">
      <PersonSimpleWalkIcon weight="bold" className="size-3.5" aria-label="Gå" />
      {minutesBetween(leg.departure, leg.arrival)}
    </span>
  );
}

// A trip's legs as a compact row: walk 4 > bus 3 > train 70.
export function LegChips({ legs }: { legs: TripLeg[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {legs.map((leg, i) => (
        <Fragment key={i}>
          {i > 0 && <CaretRightIcon weight="bold" className="size-3 text-zinc-300 dark:text-zinc-600" aria-hidden />}
          <LegChip leg={leg} />
        </Fragment>
      ))}
    </div>
  );
}

// The trip's first bus or train is running off its timetable time.
export function firstRideMoved(legs: TripLeg[]) {
  const ride = legs.find((l) => l.kind === "ride");
  return ride !== undefined && ride.departure.slice(11, 16) !== ride.scheduledDeparture.slice(11, 16);
}
