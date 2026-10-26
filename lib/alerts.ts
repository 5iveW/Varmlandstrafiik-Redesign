import { Client } from "@upstash/qstash";
import webpush, { type PushSubscription } from "web-push";
import { getDepartures } from "./trafiklab";

// "Leave now" reminders. A reminder is checked against the live departure
// board shortly before it is due, so a late bus moves the reminder with it:
//   1. a first check about 10 minutes before you need to leave,
//   2. a re-check 2 minutes before,
//   3. the push itself when it is time to go.
// Reminders hold everything they need (including the phone's push
// subscription), so nothing is stored on the server.
//
// Scheduling uses Upstash QStash when QSTASH_TOKEN is set (needed on Vercel,
// where functions cannot keep timers). Without it, timers run in this server
// process, which is enough for `next dev` or `next start` on one machine.

export type Alert = {
  id: string;
  subscription: PushSubscription;
  stopId: string;
  stopName: string;
  line: string;
  // Timetable departure of the first bus or train, "YYYY-MM-DDTHH:mm:ss".
  scheduledDeparture: string;
  // Minutes the user needs to get to the stop.
  leadMinutes: number;
  destination: string;
  final?: boolean;
};

const MATCH_WINDOW_MS = 90_000;

// Departure times are Swedish local time; they are compared as if UTC, and so
// is "now", which is converted to Swedish local time first.
const swedish = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function localMs(time: string) {
  return Date.parse(`${time}Z`);
}

function nowLocalMs() {
  return localMs(swedish.format(new Date()).replace(" ", "T"));
}

// Converts a Swedish local time to a real instant, for the scheduler.
function toInstant(local: number) {
  return Date.now() + (local - nowLocalMs());
}

export function alertsConfigured() {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return "VAPID-nycklarna saknas.";
  if (process.env.VERCEL && !process.env.QSTASH_TOKEN) return "Påminnelser behöver QSTASH_TOKEN på Vercel.";
  return null;
}

// ---- Scheduling ----

const timers = ((globalThis as { __alertTimers?: Map<string, ReturnType<typeof setTimeout>> }).__alertTimers ??=
  new Map());

function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  throw new Error("APP_URL is not set");
}

async function scheduleAt(alert: Alert, localTime: number) {
  const at = toInstant(localTime);
  if (process.env.QSTASH_TOKEN) {
    const qstash = new Client({ token: process.env.QSTASH_TOKEN });
    await qstash.publishJSON({
      url: `${appUrl()}/api/alerts/check`,
      body: alert,
      notBefore: Math.max(Math.floor(at / 1000), Math.floor(Date.now() / 1000)),
      // Every message of one reminder shares a label, so cancelling stops the chain.
      label: alert.id,
      retries: 2,
    });
    return;
  }
  clearTimeout(timers.get(alert.id));
  timers.set(
    alert.id,
    setTimeout(() => {
      timers.delete(alert.id);
      checkAlert(alert).catch((e) => console.error("Reminder check failed", e));
    }, Math.max(0, at - Date.now())),
  );
}

export async function cancelAlert(id: string) {
  if (process.env.QSTASH_TOKEN) {
    const qstash = new Client({ token: process.env.QSTASH_TOKEN });
    await qstash.messages.cancel({ filter: { label: id } });
    return;
  }
  clearTimeout(timers.get(id));
  timers.delete(id);
}

export async function createAlert(alert: Alert) {
  const leaveAt = localMs(alert.scheduledDeparture) - alert.leadMinutes * 60000;
  await scheduleAt(alert, Math.max(nowLocalMs(), leaveAt - 10 * 60000));
}

// ---- The check itself ----

async function push(alert: Alert, title: string, body: string) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "https://github.com/5iveW/Varmlandstrafiik-Redesign",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  try {
    await webpush.sendNotification(alert.subscription, JSON.stringify({ title, body, tag: alert.id, url: "/" }), {
      TTL: 600,
      urgency: "high",
    });
  } catch (error) {
    // 404/410: the phone dropped the subscription; there is no one left to tell.
    const status = (error as { statusCode?: number }).statusCode;
    if (status !== 404 && status !== 410) throw error;
  }
}

function clock(ms: number) {
  return new Date(ms).toISOString().slice(11, 16);
}

export async function checkAlert(alert: Alert) {
  const scheduled = localMs(alert.scheduledDeparture);
  const board = await getDepartures(alert.stopId).catch(() => null);
  const match = board?.departures.find(
    (d) => d.line.toLowerCase() === alert.line.toLowerCase() && Math.abs(localMs(d.scheduled) - scheduled) <= MATCH_WINDOW_MS,
  );
  const expected = match ? localMs(match.expected) : scheduled;
  const now = nowLocalMs();
  if (expected < now) return; // Already gone; a late reminder would only confuse.

  const what = `Linje ${alert.line} mot ${alert.destination}`;
  if (match?.canceled) {
    await push(alert, `${what} är inställd`, `Avgången ${clock(scheduled)} från ${alert.stopName} går inte.`);
    return;
  }

  const leaveAt = expected - alert.leadMinutes * 60000;
  const late = Math.round((expected - scheduled) / 60000);
  if (alert.final || leaveAt - now < 45_000) {
    const minutes = Math.max(0, Math.round((expected - now) / 60000));
    const delay = late > 0 ? ` (${late} min sen)` : "";
    await push(alert, "Dags att gå", `${what} går från ${alert.stopName} om ${minutes} min, ${clock(expected)}${delay}.`);
    return;
  }
  // Re-check two minutes before, then send at the right moment.
  if (leaveAt - now > 3 * 60000) await scheduleAt(alert, leaveAt - 2 * 60000);
  else await scheduleAt({ ...alert, final: true }, leaveAt);
}
