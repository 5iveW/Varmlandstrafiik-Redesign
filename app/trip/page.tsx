import { Suspense } from "react";
import { TripSkeleton } from "@/components/Skeletons";
import { TripPlannerLoader } from "./TripPlannerLoader";

export default function TripPage({ searchParams }: PageProps<"/trip">) {
  return (
    <Suspense fallback={<TripSkeleton />}>
      <TripPlannerLoader searchParams={searchParams} />
    </Suspense>
  );
}
