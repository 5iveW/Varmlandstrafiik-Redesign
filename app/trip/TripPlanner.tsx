"use client";

import { ArrowsDownUpIcon, BookmarkSimpleIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Attribution, PageTitle } from "@/components/PageTitle";
import { TripSkeleton } from "@/components/Skeletons";
import { POSITION, StopSearch } from "@/components/StopSearch";
import { fetchApi, getPosition } from "@/lib/hooks";
import { isTripSaved, removeTrip, saveLastTrip, saveTrip, useSavedTrips } from "@/lib/pinned";
import { localInputValue } from "@/lib/time";
import type { Stop, TripResults } from "@/lib/types";
import { TripCard } from "./TripCard";

// A place is a stop, or the user's position with "lat,lon" as id.
type Query = { from: Stop; to: Stop; when: string };
type Results = TripResults & { key: string; error: string | null };

const isPosition = (place: Stop) => place.id.includes(",");

function tripParams(query: Query, page?: string) {
  const params = new URLSearchParams({ from: query.from.id, to: query.to.id });
  if (page) params.set("page", page);
  else if (query.when) {
    params.set("date", query.when.slice(0, 10));
    params.set("time", query.when.slice(11, 16));
  }
  return params;
}

export function TripPlanner({ initial }: { initial: { from: Stop | null; to: Stop | null } }) {
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  // Empty means "leave now"; otherwise a datetime-local value.
  const [when, setWhen] = useState("");
  const [query, setQuery] = useState<Query | null>(
    initial.from && initial.to ? { from: initial.from, to: initial.to, when: "" } : null,
  );
  const [results, setResults] = useState<Results | null>(null);
  const [loadingMore, setLoadingMore] = useState<"earlier" | "later" | null>(null);
  const savedTrips = useSavedTrips();
  const [notice, setNotice] = useState<string | null>(null);

  const key = query ? `${query.from.id}>${query.to.id}@${query.when}` : null;

  useEffect(() => {
    if (!query || !key) return;
    const controller = new AbortController();
    // A short pause so editing the time doesn't fire a search per keystroke.
    const timer = setTimeout(() => {
      fetchApi<TripResults>(`/api/trips?${tripParams(query)}`, controller.signal)
        .then((r) => setResults({ ...r, key, error: null }))
        .catch((e: Error) => {
          if (e.name !== "AbortError") setResults({ trips: [], later: null, earlier: null, key, error: e.message });
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, key]);

  function search(nextFrom: Stop | null, nextTo: Stop | null, nextWhen: string) {
    if (!nextFrom || !nextTo) return;
    if (nextFrom.id === nextTo.id) {
      setNotice("Välj två olika platser.");
      return;
    }
    setNotice(null);
    setQuery({ from: nextFrom, to: nextTo, when: nextWhen });
    // Positions go stale, so only trips between stops are remembered.
    if (!isPosition(nextFrom) && !isPosition(nextTo)) saveLastTrip({ from: nextFrom, to: nextTo });
  }

  function choose(side: "from" | "to", stop: Stop) {
    const apply = (place: Stop) => {
      if (side === "from") {
        setFrom(place);
        search(place, to, when);
      } else {
        setTo(place);
        search(from, place, when);
      }
    };
    if (stop.id !== POSITION.id) return apply(stop);
    setNotice("Hämtar din position...");
    getPosition()
      .then((p) => apply({ id: `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`, name: POSITION.name }))
      .catch((e: Error) => setNotice(e.message));
  }

  function swap() {
    setFrom(to);
    setTo(from);
    search(to, from, when);
  }

  function changeWhen(value: string) {
    setWhen(value);
    search(from, to, value);
  }

  async function loadMore(direction: "earlier" | "later") {
    const page = results?.[direction];
    if (!query || !results || !page) return;
    setLoadingMore(direction);
    try {
      const more = await fetchApi<TripResults>(`/api/trips?${tripParams(query, page)}`);
      const seen = new Set(results.trips.map((t) => t.id));
      const trips = [...results.trips, ...more.trips.filter((t) => !seen.has(t.id))];
      trips.sort((a, b) => a.departure.localeCompare(b.departure));
      setResults(
        direction === "later"
          ? { ...results, trips, later: more.later }
          : { ...results, trips, earlier: more.earlier },
      );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setLoadingMore(null);
    }
  }

  const loading = query !== null && results?.key !== key;
  const savable = query && !isPosition(query.from) && !isPosition(query.to) ? { from: query.from, to: query.to } : null;
  const saved = savable !== null && isTripSaved(savable, savedTrips);
  const moreButton =
    "h-11 rounded-xl text-[15px] font-medium text-brand-ink ring-1 ring-zinc-900/10 transition-transform active:scale-[0.98] disabled:opacity-50 dark:ring-white/10";
  const segment = (active: boolean) =>
    `h-9 flex-1 rounded-lg text-sm font-medium transition-colors ${
      active ? "bg-white text-zinc-900 shadow-sm shadow-zinc-900/5 dark:bg-zinc-700 dark:text-white" : "text-zinc-600 dark:text-zinc-400"
    }`;

  return (
    <div className="flex flex-col gap-5">
      <PageTitle>Reseplanerare</PageTitle>

      <div className="flex items-stretch gap-2">
        {/* Route line: hollow dot for the start, filled for the destination. */}
        <div aria-hidden className="flex w-4 flex-col items-center py-[18px]">
          <span className="size-3 rounded-full border-[2.5px] border-brand" />
          <span className="my-1 w-0.5 flex-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <span className="size-3 rounded-full bg-brand" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <StopSearch
            key={`from-${from?.id ?? ""}`}
            label="Från"
            placeholder="Från"
            selected={from}
            offerPosition
            onSelect={(stop) => choose("from", stop)}
          />
          <StopSearch
            key={`to-${to?.id ?? ""}`}
            label="Till"
            placeholder="Till"
            selected={to}
            offerPosition
            onSelect={(stop) => choose("to", stop)}
          />
        </div>
        <button
          type="button"
          onClick={swap}
          aria-label="Byt plats på från och till"
          className="flex w-10 shrink-0 items-center justify-center self-center rounded-full py-2 text-zinc-500 transition-transform active:scale-90 active:bg-zinc-200/60 dark:active:bg-zinc-800"
        >
          <ArrowsDownUpIcon weight="bold" className="size-5" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex rounded-xl bg-zinc-200/70 p-1 dark:bg-zinc-800/80" role="group" aria-label="När">
          <button type="button" aria-pressed={!when} onClick={() => changeWhen("")} className={segment(!when)}>
            Åk nu
          </button>
          <button
            type="button"
            aria-pressed={!!when}
            onClick={() => when || changeWhen(localInputValue(new Date()))}
            className={segment(!!when)}
          >
            Välj avgångstid
          </button>
        </div>
        {when && (
          <input
            type="datetime-local"
            aria-label="Avgångstid"
            value={when}
            onChange={(e) => e.target.value && changeWhen(e.target.value)}
            className="h-12 w-full rounded-xl bg-white px-3 text-base ring-1 ring-zinc-900/10 outline-none focus:ring-2 focus:ring-brand dark:bg-zinc-900 dark:ring-white/10"
          />
        )}
      </div>

      {notice && <p className="px-1 text-sm text-zinc-600 dark:text-zinc-300">{notice}</p>}

      {!query && !notice && (
        <p className="px-1 text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Välj var du ska åka från och till. Senaste resan sparas till nästa gång.
        </p>
      )}

      {savable && (
        <button
          type="button"
          aria-pressed={saved}
          onClick={() => (saved ? removeTrip(savable) : saveTrip(savable))}
          className="flex h-10 items-center gap-2 self-start rounded-lg px-1 text-sm font-medium text-zinc-600 active:text-zinc-900 dark:text-zinc-300"
        >
          <BookmarkSimpleIcon weight={saved ? "fill" : "bold"} className="size-5 text-brand-ink" aria-hidden />
          {saved ? "Sparad på startsidan" : "Spara på startsidan"}
        </button>
      )}

      {loading && <TripSkeleton />}

      {!loading && results && (
        <div className="flex flex-col gap-3">
          {results.error && <p className="px-1 text-red-600 dark:text-red-400">{results.error}</p>}
          {!results.error && results.trips.length === 0 && (
            <p className="px-1 text-zinc-500">Hittade inga resor. Prova en annan tid.</p>
          )}
          {results.earlier && (
            <button type="button" onClick={() => loadMore("earlier")} disabled={loadingMore !== null} className={moreButton}>
              {loadingMore === "earlier" ? "Hämtar..." : "Visa tidigare resor"}
            </button>
          )}
          {results.trips.map((trip, i) => (
            <TripCard key={trip.id} trip={trip} index={i} />
          ))}
          {results.later && (
            <button type="button" onClick={() => loadMore("later")} disabled={loadingMore !== null} className={moreButton}>
              {loadingMore === "later" ? "Hämtar..." : "Visa senare resor"}
            </button>
          )}
        </div>
      )}

      <Attribution />
    </div>
  );
}
