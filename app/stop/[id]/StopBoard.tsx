"use client";

import { ArrowClockwiseIcon, CaretLeftIcon, CaretUpIcon, PathIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { DepartureList } from "@/components/DepartureList";
import { Attribution } from "@/components/PageTitle";
import { PinButton } from "@/components/PinButton";
import { DepartureSkeleton } from "@/components/Skeletons";
import { useDepartures, useNow } from "@/lib/hooks";
import { rememberStop } from "@/lib/pinned";
import { hasLeft } from "@/lib/time";
import type { Departure } from "@/lib/types";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Line numbers in natural order: 1, 2, 10, 401, S.
function linesOf(departures: Departure[]) {
  const lines = [...new Set(departures.map((d) => d.line))];
  return lines.sort((a, b) => a.localeCompare(b, "sv", { numeric: true }));
}

export function StopBoard({ params, searchParams }: Props) {
  const { id } = use(params);
  const nameParam = use(searchParams).name;
  const { data, error, loading, updatedAt, refresh } = useDepartures(id);
  const [line, setLine] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const now = useNow();
  const name = (typeof nameParam === "string" && nameParam) || data?.stopName || "Hållplats";

  useEffect(() => {
    if (name !== "Hållplats") rememberStop({ id, name });
  }, [id, name]);

  const lines = data ? linesOf(data.departures) : [];
  const shown = data?.departures.filter((d) => line === null || d.line === line) ?? [];
  const pastCount = shown.filter((d) => hasLeft(d.expected, now)).length;
  const updated = updatedAt
    ? new Date(updatedAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })
    : null;

  const chip = (active: boolean) =>
    `h-8 shrink-0 rounded-lg px-3 text-[13px] font-semibold tabular-nums transition-colors ${
      active
        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
        : "bg-white text-zinc-700 ring-1 ring-zinc-900/10 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 pt-1">
        <Link
          href="/"
          aria-label="Tillbaka"
          className="-ml-3 flex size-11 shrink-0 items-center justify-center rounded-full active:bg-zinc-200/60 dark:active:bg-zinc-800"
        >
          <CaretLeftIcon weight="bold" className="size-6" />
        </Link>
        <h1 className="min-w-0 flex-1 text-2xl leading-tight font-semibold tracking-tight">{name}</h1>
        <PinButton stop={{ id, name }} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={refresh}
          className="flex h-9 items-center gap-1.5 rounded-lg px-1 text-[13px] text-zinc-500 active:text-zinc-900 dark:text-zinc-400"
        >
          <ArrowClockwiseIcon weight="bold" className="size-4" aria-hidden />
          {updated ? `Uppdaterad ${updated}` : "Hämtar..."}
        </button>
        <Link
          href={`/trip?from=${id}&fromName=${encodeURIComponent(name)}`}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-[13px] font-semibold text-on-brand transition-transform active:scale-[0.97]"
        >
          <PathIcon weight="bold" className="size-4" aria-hidden />
          Res härifrån
        </Link>
      </div>

      {lines.length > 2 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="Visa linje">
          <button type="button" aria-pressed={line === null} onClick={() => setLine(null)} className={chip(line === null)}>
            Alla
          </button>
          {lines.map((l) => (
            <button key={l} type="button" aria-pressed={line === l} onClick={() => setLine(line === l ? null : l)} className={chip(line === l)}>
              {l}
            </button>
          ))}
        </div>
      )}

      <section className="rounded-2xl bg-white px-4 py-1 ring-1 ring-zinc-900/5 dark:bg-zinc-900 dark:ring-white/5">
        {loading && <DepartureSkeleton rows={6} />}
        {error && !data && <p className="py-4 text-red-600 dark:text-red-400">{error}</p>}
        {pastCount > 0 && (
          <button
            type="button"
            aria-expanded={showPast}
            onClick={() => setShowPast(!showPast)}
            className="-mx-4 flex w-[calc(100%+2rem)] items-center justify-center gap-1.5 border-b border-zinc-100 py-2.5 text-[13px] font-medium text-zinc-500 active:bg-zinc-50 dark:border-zinc-800/70 dark:text-zinc-400 dark:active:bg-zinc-800/50"
          >
            <CaretUpIcon weight="bold" className={`size-3.5 transition-transform ${showPast ? "rotate-180" : ""}`} aria-hidden />
            {showPast ? "Dölj tidigare avgångar" : `Visa tidigare avgångar (${pastCount})`}
          </button>
        )}
        {data && (
          <DepartureList
            key={line ?? "all"}
            departures={shown}
            showPast={showPast}
            emptyText={line ? `Linje ${line} går inte härifrån den närmaste timmen.` : undefined}
          />
        )}
      </section>

      <Attribution />
    </div>
  );
}
