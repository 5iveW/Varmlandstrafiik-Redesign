function Bar({ className }: { className: string }) {
  return <span className={`block rounded-md bg-zinc-200 dark:bg-zinc-800 ${className}`} />;
}

export function DepartureSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul aria-label="Hämtar avgångar" className="divide-y divide-zinc-100 motion-safe:animate-pulse dark:divide-zinc-800/70">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3">
          <Bar className="h-8 w-10 rounded-lg" />
          <span className="flex flex-col gap-1.5">
            <Bar className="h-4 w-3/5" />
            <Bar className="h-3 w-1/4" />
          </span>
          <Bar className="h-6 w-12" />
        </li>
      ))}
    </ul>
  );
}

export function TripSkeleton() {
  return (
    <div aria-label="Söker resor" className="flex flex-col gap-3 motion-safe:animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-900/5 dark:bg-zinc-900 dark:ring-white/5">
          <span className="flex justify-between">
            <Bar className="h-6 w-32" />
            <Bar className="h-4 w-14" />
          </span>
          <span className="flex gap-1.5">
            <Bar className="h-7 w-10 rounded-lg" />
            <Bar className="h-7 w-10 rounded-lg" />
            <Bar className="h-7 w-12 rounded-lg" />
          </span>
        </div>
      ))}
    </div>
  );
}
