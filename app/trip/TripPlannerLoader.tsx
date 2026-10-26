"use client";

import { use } from "react";
import { getLastTrip } from "@/lib/pinned";
import { useHydrated } from "@/lib/storage";
import { TripPlanner } from "./TripPlanner";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function place(id: string | string[] | undefined, name: string | string[] | undefined) {
  return typeof id === "string" && typeof name === "string" ? { id, name } : null;
}

// Picks where the planner starts: links from a stop ("Res härifrån") or a
// widget pass ?from= and ?to=, otherwise the last trip is restored. The planner
// remounts once after hydration so the stored trip is read on the client only.
export function TripPlannerLoader({ searchParams }: Props) {
  const params = use(searchParams);
  const hydrated = useHydrated();

  const linkedFrom = place(params.from, params.fromName);
  const linkedTo = place(params.to, params.toName);
  const last = hydrated && !linkedFrom ? getLastTrip() : null;
  const initial = { from: linkedFrom ?? last?.from ?? null, to: linkedFrom ? linkedTo : (last?.to ?? null) };

  return <TripPlanner key={`${hydrated}-${initial.from?.id}-${initial.to?.id}`} initial={initial} />;
}
