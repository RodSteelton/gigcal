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

- `src/App.jsx` — state: settings (towns + key + venues), month, filters; fetch,
  merge, dedupe (by id, then act+date so a venue's show that is also on
  Ticketmaster appears once) + cache flow.
- `src/lib/ticketmaster.js` — Discovery API client + event normalizer.
- `src/lib/localVenues.js` — tested venue suggestions for the Charlottesville /
  Crozet / Waynesboro area, area grouping, non-music exclusion filter, and the
  client for `/api/extract`.
- `src/lib/sample.js` — deterministic sample events (only when no key AND no venues).
- `src/lib/storage.js` — localStorage settings + 6-hour event cache.
- `src/components/` — `Calendar` (month grid), `EventList` (agenda), `Settings`.
- `public/sw.js` — network-first service worker (offline fallback to cache).
- `server-extract.js` — the venue-calendar reader behind `/api/extract?url=…`
  (3-hour in-memory cache, private-host blocklist). Given any events-page URL it
  tries, in order: ICS feed → RSS with `ev:startdate` items (carbonhouse venue
  sites) → JSON-LD schema.org events in the HTML → an RSS feed discovered in
  the HTML → Squarespace `?format=json` → WordPress "The Events Calendar" REST
  → WordPress `?ical=1` export. Runs server-side because browsers can't fetch
  other sites (CORS).

## Events data

- Ticketmaster Discovery API covers the big venues (in Charlottesville: Ting
  Pavilion, Jefferson Theater, The Southern, John Paul Jones Arena — verified
  their sites link to ticketmaster.com).
- Venue-site reading (verified working 2026-09-03): Eastwood Farm and Winery
  (JSON-LD), Starr Hill Crozet (Squarespace), King Family Vineyards (JSON-LD),
  Grace Estate Winery (Squarespace), The Foundry Waynesboro (JSON-LD), and
  Ting Pavilion's RSS feed for the free Fridays After Five series (free
  non-ticketed events don't appear in Ticketmaster; the suggestion carries an
  `include` filter so Ting's ticketed shows aren't listed twice).
- Not machine-readable (JS-rendered or bot-blocked; would need per-site custom
  scrapers): Paramount, Front Porch (tribe REST disabled), The Garage, UVA
  Music, Three Notch'd (Shopify), Chisholm, Chiles, Pro Re Nata / Fallen Tree /
  Barren Ridge (Wix), Batesville Market (403), Wayne Theatre (Etix, JS), Seven
  Arrows, Stable Craft, Plaza Antigua, Hazy Mountain, Common Wealth Crush.

## Planned: online hosting

Decision (2026-09-03): publish online once feature work settles; each user gets
their own free Ticketmaster key. Note: static hosting alone won't run
`/api/extract` — the venue reader needs a small server home (e.g. a free
Cloudflare Worker) when we deploy.
