"use client";

import { useNow } from "@/lib/hooks";
import { clock, hasLeft, minutesUntil } from "@/lib/time";
import type { Departure } from "@/lib/types";
import { LineBadge } from "./LineBadge";

function Countdown({ departure, now }: { departure: Departure; now: number }) {
  if (departure.canceled) {
    return (
      <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-300">
        Inställd
      </span>
    );
  }
  if (hasLeft(departure.expected, now)) {
    return <span className="text-[13px] text-zinc-500 tabular-nums dark:text-zinc-400">Gick {clock(departure.expected)}</span>;
  }
  const minutes = minutesUntil(departure.expected, now);
  // Times without realtime data are only the timetable, so they are muted.
  const tone = departure.isRealtime ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-500";
  const label = departure.isRealtime ? undefined : "Enligt tidtabell";

  if (minutes < 1) {
    return <span className="rounded-md bg-brand px-2 py-0.5 text-[15px] font-bold text-on-brand">Nu</span>;
  }
  if (minutes >= 60) {
    return (
      <span title={label} className={`text-lg font-semibold tabular-nums ${tone}`}>
        {clock(departure.expected)}
      </span>
    );
  }
  return (
    <span title={label} className={`tabular-nums ${tone}`}>
      <span className="text-xl font-semibold">{minutes}</span>
      <span className="ml-0.5 text-xs font-medium">min</span>
    </span>
  );
}

function Row({ departure: d, index, now }: { departure: Departure; index: number; now: number }) {
  const moved = clock(d.scheduled) !== clock(d.expected);
  const gone = hasLeft(d.expected, now);
  return (
    <li
      style={{ "--i": index } as React.CSSProperties}
      className={`rise grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3 ${d.canceled || gone ? "opacity-55" : ""}`}
    >
      <LineBadge line={d.line} mode={d.mode} />
      <div className="min-w-0">
        <p className={`truncate text-[15px] font-medium leading-snug ${d.canceled ? "line-through" : ""}`}>
          {d.direction}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-zinc-500 tabular-nums dark:text-zinc-400">
          {moved && !d.canceled ? (
            <>
              <s className="text-zinc-400 dark:text-zinc-500">{clock(d.scheduled)}</s>
              <span className="font-medium text-orange-700 dark:text-orange-400">{clock(d.expected)}</span>
            </>
          ) : (
            <span>{clock(d.scheduled)}</span>
          )}
          {d.platform && <span>· Läge {d.platform}</span>}
        </p>
      </div>
      <Countdown departure={d} now={now} />
    </li>
  );
}

type Props = {
  departures: Departure[];
  limit?: number;
  // Also list departures that have already left, above the upcoming ones.
  showPast?: boolean;
  emptyText?: string;
};

export function DepartureList({
  departures,
  limit,
  showPast = false,
  emptyText = "Inga fler avgångar den närmaste timmen.",
}: Props) {
  const now = useNow();
  const past = showPast ? departures.filter((d) => hasLeft(d.expected, now)) : [];
  const upcoming = departures.filter((d) => !hasLeft(d.expected, now)).slice(0, limit);

  return (
    <>
      {past.length > 0 && (
        <ul className="divide-y divide-zinc-100 border-b border-dashed border-zinc-200 dark:divide-zinc-800/70 dark:border-zinc-700">
          {past.map((d, i) => (
            <Row key={d.id} departure={d} index={i} now={now} />
          ))}
        </ul>
      )}
      {upcoming.length === 0 ? (
        <p className="py-4 text-sm text-zinc-500">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
          {upcoming.map((d, i) => (
            <Row key={d.id} departure={d} index={i} now={now} />
          ))}
        </ul>
      )}
    </>
  );
}
