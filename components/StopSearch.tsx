"use client";

import { ClockCounterClockwiseIcon, MagnifyingGlassIcon, NavigationArrowIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";
import { fetchApi } from "@/lib/hooks";
import { rememberStop, useRecentStops } from "@/lib/pinned";
import type { Stop } from "@/lib/types";

export const POSITION: Stop = { id: "position", name: "Min position" };

type Props = {
  label: string;
  placeholder?: string;
  selected?: Stop | null;
  // Adds a "Min position" choice; onSelect then receives POSITION.
  offerPosition?: boolean;
  onSelect: (stop: Stop) => void;
};

type Results = { query: string; stops: Stop[]; error: string | null };

function Option({ icon, children, onPick }: { icon?: React.ReactNode; children: React.ReactNode; onPick: () => void }) {
  return (
    <li>
      <button
        type="button"
        // Keeps focus in the field so the list doesn't close before the tap lands.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onPick}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] active:bg-zinc-100 dark:active:bg-zinc-800 [@media(hover:hover)]:hover:bg-zinc-50 dark:[@media(hover:hover)]:hover:bg-zinc-800/60"
      >
        {icon}
        <span className="min-w-0 truncate">{children}</span>
      </button>
    </li>
  );
}

export function StopSearch({ label, placeholder = "Sök hållplats", selected, offerPosition, onSelect }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const recent = useRecentStops();
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Results>({ query: "", stops: [], error: null });

  const trimmed = query.trim();
  const showingSelection = trimmed === selected?.name;
  const shouldSearch = open && trimmed.length >= 2 && !showingSelection;
  const suggest = open && (trimmed === "" || showingSelection);
  const suggestions = recent.filter((s) => s.id !== selected?.id);

  useEffect(() => {
    if (!shouldSearch) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchApi<Stop[]>(`/api/stops?q=${encodeURIComponent(trimmed)}`, controller.signal)
        .then((stops) => setResults({ query: trimmed, stops, error: null }))
        .catch((e: Error) => {
          if (e.name !== "AbortError") setResults({ query: trimmed, stops: [], error: e.message });
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [shouldSearch, trimmed]);

  const ready = shouldSearch && results.query === trimmed;

  function pick(stop: Stop) {
    if (stop.id !== POSITION.id) rememberStop(stop);
    setQuery(stop.name);
    setOpen(false);
    inputRef.current?.blur();
    onSelect(stop);
  }

  const panel = "absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl bg-white shadow-lg shadow-zinc-900/10 ring-1 ring-zinc-900/5 dark:bg-zinc-900 dark:shadow-black/40 dark:ring-white/10";
  const showSuggestions = suggest && (offerPosition || suggestions.length > 0);

  return (
    <div className="relative">
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-zinc-900/10 transition-shadow focus-within:ring-2 focus-within:ring-brand dark:bg-zinc-900 dark:ring-white/10 ">
        <MagnifyingGlassIcon weight="bold" className="size-5 shrink-0 text-zinc-400" aria-hidden />
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={(e) => {
            setOpen(true);
            e.target.select();
          }}
          onBlur={() => setOpen(false)}
          className="h-12 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-zinc-500 dark:placeholder:text-zinc-400"
        />
        {query && (
          <button
            type="button"
            aria-label="Rensa"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-400 active:bg-zinc-100 dark:active:bg-zinc-800"
          >
            <XIcon weight="bold" className="size-4" />
          </button>
        )}
      </div>

      {showSuggestions && (
        <ul className={panel}>
          {offerPosition && (
            <Option
              icon={<NavigationArrowIcon weight="fill" className="size-5 shrink-0 text-brand-ink" aria-hidden />}
              onPick={() => pick(POSITION)}
            >
              Min position
            </Option>
          )}
          {suggestions.map((stop) => (
            <Option
              key={stop.id}
              icon={<ClockCounterClockwiseIcon className="size-5 shrink-0 text-zinc-400" aria-hidden />}
              onPick={() => pick(stop)}
            >
              {stop.name}
            </Option>
          ))}
        </ul>
      )}

      {shouldSearch && (
        <div className={panel}>
          {!ready && <p className="px-4 py-3 text-sm text-zinc-500">Söker...</p>}
          {ready && results.error && <p className="px-4 py-3 text-sm text-red-600">{results.error}</p>}
          {ready && !results.error && results.stops.length === 0 && (
            <p className="px-4 py-3 text-sm text-zinc-500">Hittade ingen hållplats som heter så.</p>
          )}
          {ready && results.stops.length > 0 && (
            <ul>
              {results.stops.map((stop) => (
                <Option key={stop.id} onPick={() => pick(stop)}>
                  {stop.name}
                </Option>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
