# GigCal — Live Music Near You

A phone-friendly web app (PWA) that fills a calendar with upcoming live music
in the towns you choose — clubs, music halls, theaters, bars with ticketed shows.

## Everyday use

Double-click `GigCal.cmd`. It builds the app on first run, then serves it at
http://localhost:5175 and prints the address to open on a phone on the same Wi-Fi
(also shown inside the app under Settings → "On your phone"). On the phone, use
the browser's **Add to Home Screen** to keep it as an app icon.

First-run setup inside the app:

1. Tap **Choose my towns** and add the cities you care about.
2. Until a listings key is added, the calendar shows made-up **sample shows**.
3. For real listings: Settings → "Event data key" — create a free account at
   https://developer.ticketmaster.com, copy the **Consumer Key**, paste it in.
   The key lives only in the browser's local storage and is sent only to
   Ticketmaster (their Discovery API allows browser requests directly).

## Development

- `npm run dev` — Vite dev server on http://localhost:5174 (LAN-exposed).
- `npm run build` — production build to `dist/`.
- `npm run serve` — `node server.js`, serves `dist/` on port 5175 (override with
  `GIGCAL_PORT`) plus `/api/info` (LAN IP for the phone URL).
- `npm run icons` — regenerates `public/icons/*.png` (dependency-free PNG writer
  in `scripts/make-icons.mjs`).

## Structure

- `src/App.jsx` — state: settings (towns + key), month, filters; fetch + cache flow.
- `src/lib/ticketmaster.js` — Discovery API client + event normalizer.
- `src/lib/sample.js` — deterministic sample events for keyless demo mode.
- `src/lib/storage.js` — localStorage settings + 6-hour event cache.
- `src/components/` — `Calendar` (month grid), `EventList` (agenda), `Settings`.
- `public/sw.js` — network-first service worker (offline fallback to cache).

Events data: Ticketmaster covers halls, theaters, and bigger clubs. Small-bar
coverage (per-venue scrapers or other APIs) is future work.
