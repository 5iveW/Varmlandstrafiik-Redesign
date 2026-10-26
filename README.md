# Värmlandstrafik Redesign

A faster, cleaner web app for Värmlandstrafik departures and trip planning. It's a personal project, built on Trafiklab's open data. Tickets stay in the official app.

## What it does

- **Avgångar** (`/`): stop search (also works without å/ä/ö), "Mina resor" trip widgets showing the next three trips, your starred stops with their next departures, and "Nära dig", the closest stops by GPS.
- **Hållplats** (`/stop/[id]`): the departure board for the next hour, with delays, cancellations, platforms, a line filter, departures that have already left (on request), and "Res härifrån" to plan a trip from the stop. The star pins the stop to the home screen.
- **Reseplanerare** (`/trip`): A to B trips from a stop or "Min position", leaving now or at a chosen time, with live delays and a warning when a delay threatens a change. It searches as soon as both ends are set, loads earlier and later trips, can save the trip as a home-screen widget, and reopens with your last trip. Each trip's details offer a "leave now" reminder.
- **Karta** (`/map`): every Värmlandstrafik vehicle that is reporting its position (about 75 on a weekday evening), refreshed every 10 seconds. Tap a vehicle for its line and destination. Includes a line filter and your own position. The feed has no destinations, so each trip's last stop from the static timetable is used.

### Trip widgets and their direction

Each saved trip picks its direction one of three ways (`TripDirection` in `lib/pinned.ts`):
- `fixed`: as saved; the swap button flips it permanently.
- `morning`: from -> to before 12:00, the other way after (Hagatorget and Sundsta-Älvkullen).
- `nearest`: starts at the end the phone is closest to. Uses location only once access has been granted, so the home screen never asks by itself. Without access it stays as saved.

On automatic widgets the swap button flips the direction until the app is reopened. The widgets start with Wilmer's own trips (`DEFAULT_TRIPS`) until the list is changed.

### "Leave now" reminders

Open a trip, tap "Påminn mig när det är dags att gå" and say how long you need to reach the stop. A push notification arrives when it's time to leave. The reminder is checked against the live departure board 10 and 2 minutes before, so a late bus moves it. A cancelled departure sends a cancellation notice instead. See `lib/alerts.ts`.

On iPhone, web push only works when the app has been added to the home screen (Share, then Add to Home Screen, iOS 16.4 or later).

Saved trips, starred stops, recent stops, reminders and the last trip are kept in the browser's localStorage.

## Setup

1. Create a project at [developer.trafiklab.se](https://developer.trafiklab.se) and add keys for:
   - **Trafiklab Realtime APIs** (stop search, departures)
   - **ResRobot v2.1** (trip planning)
   - **GTFS Regional Realtime** and **GTFS Regional Static** (the live map)
2. Copy `.env.example` to `.env.local` and fill in the keys.
3. For reminders, generate push keys with `npx web-push generate-vapid-keys` and fill in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.
4. Run the app:

```bash
npm install
npm run dev
```

The keys stay on the server, except the public VAPID key. The browser only talks to this app's own `/api/*` routes.

### Deploying (Vercel)

Reminders need something that can wake the server at a given minute. Locally a timer in the server process does it. On Vercel, where functions stop between requests, reminders go through [Upstash QStash](https://upstash.com/docs/qstash) (free tier is plenty): set `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`. QStash calls back `/api/alerts/check`, which only accepts requests signed by QStash. `APP_URL` defaults to the Vercel production URL.

## How it fits together

| Piece | Where |
|---|---|
| Trafiklab stop search and departures | `lib/trafiklab.ts` |
| ResRobot trips and nearby stops | `lib/resrobot.ts` |
| Live delays added to ResRobot trips | `lib/live-trips.ts` |
| Live vehicle positions (GTFS-RT) and line lookup (GTFS static) | `lib/gtfs.ts` |
| "Leave now" reminders: scheduling, live re-check, web push | `lib/alerts.ts`, `lib/push.ts`, `public/sw.js` |
| API routes the browser calls | `app/api/stops`, `app/api/departures/[id]`, `app/api/trips`, `app/api/nearby`, `app/api/vehicles`, `app/api/alerts` |
| Saved trips, starred and recent stops, last trip (localStorage) | `lib/pinned.ts`, `lib/storage.ts` |
| Map | `components/LiveMap.tsx`, MapLibre with free [OpenFreeMap](https://openfreemap.org) tiles |
| Shared types | `lib/types.ts` |

Departures and trips are cached on the server for about 30 seconds. Trafiklab updates its data once a minute, so pages refresh every 60 seconds while they're visible. The free Trafiklab key allows 25 calls a minute; a 429 answer shows "För många anrop just nu". The vehicle feed is shared for 10 seconds (free limit 50 calls a minute, 30,000 a month). The static timetable may only be downloaded 50 times a month on the free key, so it is also kept on disk for 20 hours.

Data quirks handled in code:
- **Late buses:** Trafiklab's default departure window stops listing a bus about ten minutes after its timetable time, even if it is running 40 minutes late. Each board therefore also fetches the window starting 40 minutes back (`getDepartures` in `lib/trafiklab.ts`).
- **No delays in ResRobot:** ResRobot trips only have timetable times. Each bus or train is matched to its stop's live board on line number and timetable time (within 90 s) and moved by its delay. Arrivals are moved by the same delay, an estimate. This uses only the upcoming window (one call per stop), because the home screen's widgets otherwise exceed the 25 calls a minute, and the delays silently fall back to the timetable.
- Big stops like "Karlstad" list some trains twice (once per operator). Departures are merged on line, time and direction.
- Stop search tries å/ä/ö variants only when the plain search finds nothing in Värmland, to save API calls.
- Times sent to Trafiklab are built in Europe/Stockholm with `Intl` (`lib/clock.ts`), so they are right on a UTC server and across the summer-time switch.
- MapLibre v6 looks for its web worker next to its own file, which the bundler moves. `npm install` copies the worker to `public/` (`scripts/copy-maplibre-worker.mjs`).

Design: Geist, Phosphor icons, zinc neutrals with Värmlandstrafik's yellow (`#f9b000`, taken from regionvarmland.se's stylesheet) as the one accent, light and dark mode. Yellow surfaces carry near-black text; late times are orange. Colour, shape and layer rules are noted at the top of `app/globals.css`.

Attribution required by the CC-BY licence: "Data från Trafiklab.se" is shown on every page. The GTFS Regional data is CC0.

## Not verified yet

- Push delivery to a phone. The reminder scheduling and live re-check run locally, but a notification has not been received on a real device, and the QStash path has not run.
- Behaviour on an actual iPhone home screen, including the location prompt.

Ideas and decisions: [docs/BRAINSTORM.md](docs/BRAINSTORM.md).
