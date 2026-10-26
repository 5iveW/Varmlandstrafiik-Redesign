"use client";

import { HouseIcon, MapTrifoldIcon, PathIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const TABS = [
  { href: "/", label: "Avgångar", Icon: HouseIcon },
  { href: "/trip", label: "Reseplanerare", Icon: PathIcon },
  { href: "/map", label: "Karta", Icon: MapTrifoldIcon },
];

function isActive(href: string, pathname: string | null) {
  if (pathname === null) return false;
  return href === "/" ? pathname === "/" || pathname.startsWith("/stop") : pathname.startsWith(href);
}

function TabBarNav({ pathname }: { pathname: string | null }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-900/5 bg-zinc-100/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl dark:border-white/5 dark:bg-zinc-950/85">
      <ul className="mx-auto flex max-w-md">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(href, pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                  active ? "text-brand-ink" : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                <Icon weight={active ? "fill" : "regular"} className="size-6" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function LiveTabBar() {
  return <TabBarNav pathname={usePathname()} />;
}

// On dynamic routes the pathname is only known at request time, so the bar
// renders without a highlighted tab until it streams in.
export function TabBar() {
  return (
    <Suspense fallback={<TabBarNav pathname={null} />}>
      <LiveTabBar />
    </Suspense>
  );
}
