"use client";

import { StarIcon } from "@phosphor-icons/react";
import { togglePinned, usePinnedStops, type SavedStop } from "@/lib/pinned";

export function PinButton({ stop }: { stop: SavedStop }) {
  const pinned = usePinnedStops().some((s) => s.id === stop.id);

  return (
    <button
      type="button"
      onClick={() => togglePinned(stop)}
      aria-pressed={pinned}
      aria-label={pinned ? "Ta bort från mina hållplatser" : "Spara i mina hållplatser"}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-brand-ink transition-transform hover:bg-zinc-200/60 active:scale-90 dark:hover:bg-zinc-800"
    >
      <StarIcon key={String(pinned)} weight={pinned ? "fill" : "bold"} className={`size-6 ${pinned ? "pop" : ""}`} />
    </button>
  );
}
