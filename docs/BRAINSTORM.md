# Värmlandstrafik remake: brainstorm

Status (2026-10-26): the MVP in section 4 is built and tested against the live APIs. Nearby stops, saved trips with automatic direction, accent-free search, the live map and "leave now" reminders are also in; the map awaits GTFS Regional keys, and reminders have not yet reached a real phone. Not done yet: filtered disruption alerts. See the README.

## 1. Is the data available? Yes.

All of it comes through **Trafiklab** (Samtrafiken's open-data portal). It's free and needs an API key.

| Source | What it gives | Notes |
|---|---|---|
| **GTFS Regional, operator `varm`** | Static timetables (stops, lines, trips, shapes) plus GTFS-RT: TripUpdates (delays), VehiclePositions (live bus/train positions) and ServiceAlerts (disruptions) | Static data updates daily. Realtime comes as protobuf. Occupancy data isn't included for `varm`. |
| **Trafiklab Realtime APIs** (Timetables + Stop Lookup) | Live departure and arrival boards for a stop, plus stop search | Launched May 2025 and still labelled beta. Replaces the old ResRobot timetables. |
| **ResRobot v2.1 Route Planner** | A to B journey planning across all of Sweden | Covers trips that leave Värmland too (Karlstad to Örebro, Oslo trains and so on). |
| **Oxyfi push API** | Live positions of Värmlandstrafik trains | Optional. GTFS-RT probably covers it already. |

**Rate limits (GTFS Regional):**
- Static data, Bronze tier: 50 calls/month. A daily download uses about 30, so that's fine.
- Realtime data, Bronze tier: 30,000 calls/month. Polling one feed every 30 s works out to about 86,000/month, which is too much. For personal use, fetch on demand and cache. If friends start using it, apply for Silver (2M/month).

**Licence:** CC-BY. Show "Data från Trafiklab.se" somewhere in the app.

### The big limitation: tickets
I found **no public ticketing API**. The official app is built on Infospread's MobiTime platform, and ticket sales are closed.

Decided (Wilmer, 2026-10-26): buying tickets in our app isn't needed. Showing his own rotating QR ticket would be ideal, but:
- A web app can't read another app's data on the phone. Both iOS and Android sandbox each app.
- The rotating QR exists to stop copies. Recreating it outside the official app likely breaks their terms, and an inspector could reject it.

Decided (Wilmer, 2026-10-26): no ticket button. Wilmer uses an iPhone and opens the official app himself.
- Reason: the official app has no universal links (no apple-app-site-association on varmlandstrafik.se or regionvarmland.se, checked 2026-10-26). From a web page, iOS can then only use a custom URL scheme, and Safari asks "Open in ...?" every time.
- For reference: the Android package is `se.infospread.android.mobitime.r.vtab`.

## 2. What would make it better than the old app

Core idea: **open it and see the answer without searching.**

1. **Home screen = my stops, live.** Pinned stops with live countdowns ("Bus 3, 4 min, +2 late"). The nearest stop is picked up automatically from GPS.
2. **Saved trips.** "Home → School" in one tap, showing the next 3 options with realtime delays.
3. **"When should I leave?"** Uses walking time to the stop plus the bus's live delay. Can send a push notification ("Leave in 2 min").
4. **Live map.** Buses moving on the map (VehiclePositions) along their route shapes.
5. **Only the disruptions I care about.** ServiceAlerts filtered to my saved lines and stops.
6. **Forgiving search.** "karlstad c", "karlstad cc" and "Karlstad Centralstation" all match. Searching without å/ä/ö works too.
7. **Modern basics.** Dark mode, large tap targets, fast load, works one-handed.
8. ~~Ticket button~~ Dropped, see the tickets section above.

Later ideas: home-screen widget, iOS Live Activity ("bus arrives in 3 min" on the lock screen), "my friend's bus is here" sharing.

## 3. How to build it (3 options)

Decided (Wilmer, 2026-10-26): web app only (option A). Personal project, so naming and branding aren't a concern.

### A. PWA web app (recommended to start)
Next.js on Vercel, installable on the phone's home screen. There's no App Store; friends just get a link.
- You already know this stack from Candly.
- A small server route holds the API key and caches realtime responses for about 15 s, so the key never ships to phones and all users share one cache (which helps with rate limits).
- iOS supports web push for home-screen PWAs (iOS 16.4+), so leave-now notifications are possible.
- Weak spots: no real widgets and no Live Activities.

### B. Native app with Expo (React Native)
Feels like a real app, with widgets and Live Activities possible later.
- Sharing with friends on iPhone needs TestFlight, which means a $99/year Apple developer account. Android is easy (APK).
- More setup. Better as a v2 once the PWA proves the idea.

### C. Tiny hack version
An iOS Shortcut or widget that just shows "next departures from my stop". It takes an afternoon, but it's only fun for you.

## 4. Suggested MVP (PWA)

Skip GTFS parsing at first and use only the ready-made APIs:
1. Stop search (Stop Lookup API)
2. Departure board for a stop with live delays (Timetables API)
3. Pin stops to the home screen (localStorage, no accounts)
4. A to B trip search (ResRobot)

v2: parse GTFS static and GTFS-RT for the live map, disruption filtering and leave-now notifications.

## 5. Open questions
- What annoys you most in the current app? That's feature #1.
- Name?

## Sources
- https://www.trafiklab.se/api/gtfs-datasets/gtfs-regional/
- https://trafiklab.se/api/our-apis/trafiklab-realtime-apis
- https://www.trafiklab.se/news/2025/2025-05-01-trafiklab-realtime-api/
- https://www.trafiklab.se/api/trafiklab-apis/gtfs-sweden/realtime
- https://apps.apple.com/us/app/id498181254
