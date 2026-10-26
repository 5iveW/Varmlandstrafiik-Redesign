"use client";

import { createStore } from "./storage";

// "install": iPhone Safari only allows web push for apps added to the home screen.
export type PushReadiness = "ready" | "install" | "unsupported" | "denied";

export function pushReadiness(): PushReadiness {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return /iPhone|iPad|iPod/.test(navigator.userAgent) ? "install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "ready";
}

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

// Asks for notification permission (must run from a tap) and returns this
// phone's push subscription.
export async function subscribeToPush(): Promise<PushSubscriptionJSON> {
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  if ((await Notification.requestPermission()) !== "granted") {
    throw new Error("Notiser är avstängda för appen. Slå på dem i telefonens inställningar.");
  }
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""),
    }));
  return subscription.toJSON();
}

// Reminders set on this phone, so the trip shows a bell and can cancel it.
export type Reminder = { id: string; tripId: string; leadMinutes: number; departure: string };

const EMPTY: Reminder[] = [];
const reminders = createStore<Reminder[]>("reminders", EMPTY);

export const useReminders = reminders.useValue;

export function addReminder(reminder: Reminder) {
  // Drop reminders whose bus left more than an hour ago.
  const cutoff = Date.now() - 3600_000;
  reminders.set([...reminders.get().filter((r) => new Date(r.departure).getTime() > cutoff), reminder]);
}

export function forgetReminder(id: string) {
  reminders.set(reminders.get().filter((r) => r.id !== id));
}
