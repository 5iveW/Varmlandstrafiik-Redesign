"use client";

import { BellRingingIcon, BellSimpleIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { addReminder, forgetReminder, pushReadiness, subscribeToPush, useReminders } from "@/lib/push";
import { minutesBetween } from "@/lib/time";
import type { Trip, TripLeg } from "@/lib/types";

const LEADS = [2, 5, 10, 15];

const READINESS_TEXT = {
  install: "På iPhone fungerar påminnelser när appen ligger på hemskärmen: tryck Dela och sedan Lägg till på hemskärmen.",
  unsupported: "Den här webbläsaren kan inte visa påminnelser.",
  denied: "Notiser är avstängda för appen. Slå på dem i telefonens inställningar.",
};

// "Remind me when it's time to go" for a trip's first bus or train. The
// reminder follows the live delay, so a late bus moves it too.
export function RemindButton({ trip }: { trip: Trip }) {
  const reminder = useReminders().find((r) => r.tripId === trip.id);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const firstRide = trip.legs.findIndex((l) => l.kind === "ride");
  const ride = trip.legs.find((l): l is Extract<TripLeg, { kind: "ride" }> => l.kind === "ride");
  if (!ride) return null;
  // A walk ResRobot planned before the bus is added to the user's own time.
  const walk = trip.legs
    .slice(0, firstRide)
    .reduce((sum, l) => sum + minutesBetween(l.departure, l.arrival), 0);

  const create = async (lead: number) => {
    setBusy(true);
    setMessage(null);
    try {
      const subscription = await subscribeToPush();
      const { id } = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription,
          stopId: ride.fromId,
          stopName: ride.from,
          line: ride.line,
          scheduledDeparture: ride.scheduledDeparture,
          leadMinutes: lead + walk,
          destination: ride.direction ?? ride.to,
        }),
      }).then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? "Kunde inte skapa påminnelsen.");
        return body as { id: string };
      });
      addReminder({ id, tripId: trip.id, leadMinutes: lead + walk, departure: ride.scheduledDeparture });
      setChoosing(false);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!reminder) return;
    setBusy(true);
    await fetch(`/api/alerts?id=${reminder.id}`, { method: "DELETE" }).catch(() => {});
    forgetReminder(reminder.id);
    setBusy(false);
  };

  if (reminder) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl bg-brand/15 px-3 py-2 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <BellRingingIcon weight="fill" className="size-5 text-brand-ink" aria-hidden />
          Påminnelse {reminder.leadMinutes} min innan {ride.line} går
        </span>
        <button type="button" onClick={cancel} disabled={busy} className="font-semibold text-brand-ink disabled:opacity-50">
          Ta bort
        </button>
      </div>
    );
  }

  if (!choosing) {
    return (
      <button
        type="button"
        onClick={() => {
          const readiness = pushReadiness();
          if (readiness === "ready") setChoosing(true);
          else setMessage(READINESS_TEXT[readiness]);
        }}
        className="flex flex-col items-start gap-1 rounded-xl py-1 text-left text-sm font-medium text-brand-ink"
      >
        <span className="flex items-center gap-2">
          <BellSimpleIcon weight="bold" className="size-5" aria-hidden />
          Påminn mig när det är dags att gå
        </span>
        {message && <span className="font-normal text-zinc-500 dark:text-zinc-400">{message}</span>}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="font-medium">
        Hur lång tid behöver du till {ride.from}?
        {walk > 0 && <span className="font-normal text-zinc-500"> Gångtiden {walk} min räknas in.</span>}
      </p>
      <div className="flex gap-2">
        {LEADS.map((lead) => (
          <button
            key={lead}
            type="button"
            disabled={busy}
            onClick={() => create(lead)}
            className="h-10 flex-1 rounded-lg bg-white font-semibold tabular-nums ring-1 ring-zinc-900/10 active:scale-[0.97] disabled:opacity-50 dark:bg-zinc-800 dark:ring-white/10"
          >
            {lead} min
          </button>
        ))}
      </div>
      {message && <p className="text-red-600 dark:text-red-400">{message}</p>}
    </div>
  );
}
