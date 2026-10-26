"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

// False while hydrating, true afterwards. Lets a component read stored values
// once without a server/client markup mismatch.
export function useHydrated() {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

// A value kept in localStorage that React components can subscribe to.
// The server snapshot is always the fallback, so pages render the same markup
// on the server and switch to the stored value right after hydration.
export function createStore<T>(key: string, fallback: T) {
  const listeners = new Set<() => void>();
  let cache: { value: T } | null = null;

  function get(): T {
    if (cache) return cache.value;
    try {
      const raw = localStorage.getItem(key);
      cache = { value: raw === null ? fallback : (JSON.parse(raw) as T) };
    } catch {
      cache = { value: fallback };
    }
    return cache.value;
  }

  function set(value: T) {
    cache = { value };
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Private browsing can block storage; the value then lasts until reload.
    }
    listeners.forEach((l) => l());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      cache = null;
      listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  function useValue(): T {
    return useSyncExternalStore(subscribe, get, () => fallback);
  }

  return { get, set, useValue };
}
