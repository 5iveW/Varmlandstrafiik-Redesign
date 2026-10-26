export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="pt-2 text-[30px] font-semibold leading-tight tracking-tight">{children}</h1>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="px-1 text-[13px] font-semibold text-zinc-500 dark:text-zinc-400">{children}</h2>;
}

export function Attribution() {
  return <p className="pt-2 text-center text-xs text-zinc-400 dark:text-zinc-500">Data från Trafiklab.se</p>;
}
