"use client";

import { BoatIcon, SubwayIcon, TaxiIcon, TrainIcon, TramIcon, type Icon } from "@phosphor-icons/react";
import type { TransportMode } from "@/lib/types";

// Buses carry the accent colour since they are most of Värmlandstrafik;
// everything else is neutral with a mode icon so the badges stay calm.
const STYLE: Record<TransportMode, string> = {
  BUS: "bg-brand text-on-brand",
  TRAIN: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
  TRAM: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
  METRO: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
  BOAT: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
  TAXI: "bg-zinc-500 text-white",
  OTHER: "bg-zinc-500 text-white",
};

const ICON: Partial<Record<TransportMode, Icon>> = {
  TRAIN: TrainIcon,
  TRAM: TramIcon,
  METRO: SubwayIcon,
  BOAT: BoatIcon,
  TAXI: TaxiIcon,
};

export function LineBadge({ line, mode, size = "md" }: { line: string; mode: TransportMode; size?: "sm" | "md" }) {
  const ModeIcon = ICON[mode];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-lg font-semibold tabular-nums ${STYLE[mode]} ${
        size === "sm" ? "h-7 min-w-8 px-1.5 text-xs" : "h-8 min-w-10 px-2 text-[13px]"
      }`}
    >
      {ModeIcon && <ModeIcon weight="bold" className="size-3.5" aria-hidden />}
      {line || "?"}
    </span>
  );
}
