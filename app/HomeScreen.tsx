"use client";

import { StarIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NearbyStops } from "@/components/NearbyStops";
import { Attribution, PageTitle, SectionTitle } from "@/components/PageTitle";
import { PinnedStopCard } from "@/components/PinnedStopCard";
import { StopSearch } from "@/components/StopSearch";
import { TripWidget } from "@/components/TripWidget";
import { usePinnedStops, useSavedTrips } from "@/lib/pinned";

export function HomeScreen() {
  const router = useRouter();
  const pinned = usePinnedStops();
  const trips = useSavedTrips();
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <PageTitle>Avgångar</PageTitle>
        <StopSearch
          label="Sök hållplats"
          onSelect={(stop) => router.push(`/stop/${stop.id}?name=${encodeURIComponent(stop.name)}`)}
        />
      </div>

      {trips.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <SectionTitle>Mina resor</SectionTitle>
            <button
              type="button"
              onClick={() => setEditing(!editing)}
              className="h-8 rounded-lg px-1 text-[13px] font-semibold text-brand-ink"
            >
              {editing ? "Klar" : "Ändra"}
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {trips.map((trip) => (
              <TripWidget key={`${trip.from.id}-${trip.to.id}`} trip={trip} editing={editing} />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <SectionTitle>Mina hållplatser</SectionTitle>
        {pinned.length === 0 ? (
          <div className="flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-900/5 dark:bg-zinc-900 dark:ring-white/5">
            <StarIcon weight="fill" className="mt-0.5 size-5 shrink-0 text-brand-ink" aria-hidden />
            <p className="text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300">
              Öppna en hållplats och tryck på stjärnan, så visas nästa avgångar här direkt.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pinned.map((stop) => (
              <PinnedStopCard key={stop.id} stop={stop} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>Nära dig</SectionTitle>
        <NearbyStops />
      </section>

      <Attribution />
    </div>
  );
}
