import { Suspense } from "react";
import { StopBoard } from "./StopBoard";

export default function StopPage({ params, searchParams }: PageProps<"/stop/[id]">) {
  return (
    <Suspense fallback={<p className="py-6 text-zinc-500">Laddar...</p>}>
      <StopBoard params={params} searchParams={searchParams} />
    </Suspense>
  );
}
