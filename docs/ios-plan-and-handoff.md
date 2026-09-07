# Handoff: GigCal — continuing on Sonnet (from Fable, 2026-09-07)

The user is switching to Sonnet for the rest of the month to save credits.
This doc is the working handoff: project state, working agreements, and the
full plan for the next big task — the Apple/iOS app. Self-contained, but if
the session runs in the SongLive folder
(`C:\Users\ssber\Dropbox\Programs\Song Live`) it also inherits the project
memory notes, which are the richer history.

## Project state (all shipped and verified)

- **Live app:** https://rodsteelton.github.io/gigcal/ — PWA, GitHub Pages,
  deploys automatically on every push to `RodSteelton/gigcal` (master) plus a
  6-hour cron that refreshes venue data. Local dev: `npm run dev` (Vite :5174
  + API server :5175 together); production launcher `GigCal.cmd`.
- **Data sources:** Ticketmaster Discovery (per-user free key, browser-direct,
  28 countries in the town picker), venue-website reader
  (`server-extract.js`: ICS/RSS/JSON-LD/Squarespace/WP-Tribe/AftonTickets/
  SceneThink), Cloudflare Worker copy of the reader at
  `gigcal-reader.rodsteelton.workers.dev/extract` (deploy: `npx wrangler
  deploy` in `worker/`; wrangler is authed). Client chain: local API → Worker
  → seeded `public/venue-events.json`.
- **Android app:** shipped — TWA APK on release `android-v1`, package
  `io.github.rodsteelton.gigcal`, signing key at
  `C:\Users\ssber\tools\gigcal-signing\` (NEVER commit; see README "Android
  app" for rebuild).
- Features: month calendar + agenda (side-by-side on ≥860px screens), town
  archive/restore, category picker fed by SceneThink categories, search,
  fuzzy dedupe (`src/lib/dedupe.js`), install button, © SS Berr footer with
  Venmo link (venmo.com/u/Stuart-Berr).

## Working agreements (learned the hard way)

- **User is non-technical.** No jargon in the app UI or in explanations;
  they queue feature ideas and say when to build. Verify everything in the
  browser before telling them it works; after each deploy, verify the LIVE
  site (clear SW caches + localStorage in the preview browser first).
- **Windows PowerShell 5.1**: no `&&`; no double quotes inside `git commit`
  messages passed via here-strings (breaks arg parsing — twice now).
- The public repo must never receive: keystores, API keys, .docx handoffs
  (gitignored), or personal data. The user handles ALL account
  creation/passwords/payments themselves — never ask for credentials; use
  device-code / browser-approval flows (gh and wrangler are already authed).
- Commit at milestones with clear messages; push auto-deploys. After
  changing `server-extract.js`, also redeploy the Worker and consider
  refreshing `public/venue-events.json` (`$env:TZ='America/New_York'; node
  scripts/build-venue-cache.mjs`) + commit.
- If the Vite dev server 504s ("Outdated Optimize Dep") after an npm
  install: delete `node_modules/.vite`, restart the preview.

## Task 1: Help the user get an Apple Developer account

Status: their decades-old Apple ID is security-locked (unlock likely
impossible — dead recovery email). Advised path, walk them through it
patiently, they do every step themselves in their browser:

1. Create a fresh Apple ID at account.apple.com (their current Gmail).
2. Turn on two-factor authentication immediately (Sign-In and Security).
3. Wait 24–48h (brand-new IDs get enrollment auto-rejected as suspicious).
4. Enroll in the Apple Developer Program ($99/yr, developer.apple.com). The
   user has NO Apple devices (Pixel phone) — the reliable route is borrowing
   any family iPhone/iPad for an hour: install the free "Apple Developer"
   app, sign in with THEIR new Apple ID, enroll there (includes photographing
   their driver's license for identity verification), sign out after.
5. If stuck: Apple Developer Support does phone callbacks
   (developer.apple.com/contact) and actually resolves enrollment issues.

Interim for iPhone users (already works, tell the user if asked): Safari →
Share → Add to Home Screen on the live site. Free, no account.

## Task 2: Build the iOS app (after enrollment is approved)

Goal: TestFlight first (friends install via link, light review), App Store
listing after. Plan:

1. **Capacitor wrapper** (iOS equivalent of the Android TWA): new `ios/`
   setup wrapping the hosted URL. Bundle id `io.github.rodsteelton.gigcal`
   (mirrors Android). Reuse icons/branding (amber notes on #0B0C10).
2. **Guideline 4.2 armor** (Apple rejects bare web wrappers): add 1–2 native
   features via Capacitor plugins. Best candidate is already on the user's
   wishlist: **"Add show to my phone's calendar"** (Capacitor calendar
   plugin) — build it so it also works on the web/Android versions
   (web: generate an .ics download / Google Calendar link).
3. **Mac-less builds:** the repo is public → GitHub Actions macOS runners are
   free. Pipeline: build web → `npx cap sync ios` → xcodebuild archive →
   upload via App Store Connect API key (fastlane or `xcrun altool`
   /`notarytool` era: use `xcrun` upload or fastlane pilot). Signing: create
   an App Store Connect API key + distribution certificate/profile — manage
   via fastlane match or manual; store secrets in GitHub Actions repo
   secrets (NOT in code). The user will need to click through a few App
   Store Connect screens — guide them.
4. **App Store Connect setup:** app record (name GigCal — check
   availability; fallback "GigCal — Live Music"), privacy questionnaire
   (collects nothing; the TM key stays on-device), a privacy policy page
   (add `privacy.html` to the site — truthful one-pager), screenshots
   (6.7" and 5.5" iPhone sizes minimum — can be generated from the web app
   at those viewport sizes), description (reuse meta description).
5. **TestFlight:** upload build → internal testing immediately; external
   testers need a light beta review (~1 day). Share the public TestFlight
   link on the site next to the Android link.
6. **App Store review:** expect possibly one 4.2 rejection; respond by
   pointing at native calendar integration + install prompt + offline
   behavior, resubmit. Budget patience, not panic.

Escalate to Fable (per the user's setup) if: review rejections get weird,
architectural choices come up, or Apple's signing maze fights back hard.

## Small open items

- None queued besides Apple. Venue scouting for new towns (incl. Italian
  towns — user has an Italian connection) happens on request: probe sites
  with the reader, add working ones to SUGGESTED_VENUES.
