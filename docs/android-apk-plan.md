# Task: Build a sideloadable Android APK for GigCal

**Status: Done (2026-09-05).** See the "Android app" section of README.md for
the package id, keystore location, release URL, and rebuild command.

Self-contained plan — executable by any Claude session opened in this folder
(`C:\Users\ssber\Dropbox\Programs\GigCal`). No new user accounts needed.

## Context

GigCal is a PWA hosted at https://rodsteelton.github.io/gigcal/ (public repo
`RodSteelton/gigcal`, GitHub Pages deploy via Actions on push). The user wants
a shareable Android app **without** the Play Store: a signed APK friends can
sideload, plus a download link on the site. iOS is out of scope (no
sideloading). The wrapped web app keeps auto-updating, so the APK rarely needs
rebuilding.

Toolchain notes: portable Node at `C:\Users\ssber\tools\node` (on user PATH);
`gh` CLI authenticated as GitHub user RodSteelton (with workflow scope). The
user is non-technical — no jargon in anything user-facing.

## Steps

1. **Trusted Web Activity via Bubblewrap** (Google's official CLI):
   - `npx @bubblewrap/cli init --manifest https://rodsteelton.github.io/gigcal/manifest.webmanifest`
     in a new `android/` subfolder (add `android/` build outputs to .gitignore;
     keep the twa-manifest.json config committed).
   - Bubblewrap offers to download JDK + Android SDK itself — accept.
   - Package id suggestion: `io.github.rodsteelton.gigcal`. App name: GigCal.
   - It generates a signing key (keystore): store it at
     `C:\Users\ssber\tools\gigcal-signing\` (OUTSIDE Dropbox and OUTSIDE the
     public repo — never commit it), note passwords in a file beside it.
   - `bubblewrap build` → produces `app-release-signed.apk`.

2. **Digital Asset Links** (removes the browser address bar inside the app):
   - Create public repo `RodSteelton/rodsteelton.github.io` (user-site repo)
     with `.well-known/assetlinks.json` containing the SHA-256 fingerprint of
     the signing key (bubblewrap prints it; also
     `keytool -list -v -keystore ...`).
   - Must be served at
     `https://rodsteelton.github.io/.well-known/assetlinks.json` (user-site
     repo publishes at the domain root automatically).
   - Note: creating/pushing a new public repo = publishing; the user has
     already approved this plan in principle, but confirm before the push.

3. **Distribute the APK**:
   - Attach it to a GitHub release on `RodSteelton/gigcal`
     (`gh release create android-v1 app-release-signed.apk`).
   - Add a small link on the GigCal site (e.g. in Settings or the footer):
     "Get the Android app" → the release download URL. Mention in plain words
     that Android will ask once to allow installs from outside the store.

4. **Verify**: install the APK is not directly testable on the PC; verify the
   assetlinks.json URL serves correctly, APK exists and is signed
   (`keytool -printcert -jarfile`), and the site link works. The user tests on
   their Pixel Fold (this also finally gives them a reliable home-screen icon).

5. Update README + the project memory (if in the Song Live session; otherwise
   note in this file) with: keystore location, package id, release URL, and
   the rebuild command for future icon/name changes.

## Gotchas

- PowerShell 5.1: no `&&`, quote paths, prefer separate commands.
- Keystore loss = future APK updates can't replace the old install; back it up.
- Play Protect may warn on sideload — expected, tell the user it's normal.
- If Bubblewrap balks at the manifest (relative start_url "."), it may need
  `--directory` overrides; the manifest lives at
  https://rodsteelton.github.io/gigcal/manifest.webmanifest with scope
  /gigcal/.
