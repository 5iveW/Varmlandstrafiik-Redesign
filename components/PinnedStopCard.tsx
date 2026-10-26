"use client";

import { CaretRightIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useDepartures } from "@/lib/hooks";
import type { SavedStop } from "@/lib/pinned";
import { DepartureList } from "./DepartureList";
import { DepartureSkeleton } from "./Skeletons";

export function PinnedStopCard({ stop }: { stop: SavedStop }) {
  const { data, error, loading } = useDepartures(stop.id);

  return (
    <section className="rounded-2xl bg-white px-4 pb-1 ring-1 ring-zinc-900/5 dark:bg-zinc-900 dark:ring-white/5">
      <Link
        href={`/stop/${stop.id}?name=${encodeURIComponent(stop.name)}`}
        className="-mx-4 flex items-center justify-between gap-2 rounded-t-2xl px-4 pt-3.5 pb-1 active:bg-zinc-50 dark:active:bg-zinc-800/50"
      >
        <h2 className="truncate text-[17px] font-semibold tracking-tight">{stop.name}</h2>
        <CaretRightIcon weight="bold" className="size-4 shrink-0 text-zinc-400" aria-label="Alla avgångar" />
      </Link>
      {loading && <DepartureSkeleton rows={3} />}
      {error && !data && <p className="py-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {data && <DepartureList departures={data.departures} limit={4} />}
    </section>
  );
}
