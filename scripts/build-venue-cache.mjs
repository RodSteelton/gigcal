// Pre-fetches every suggested venue's calendar into public/venue-events.json.
// The scheduled GitHub Action runs this before each deploy so the hosted app
// has fresh venue events without a live server. Run with TZ=America/New_York
// so extracted clock times stay in the venues' local time.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractEvents } from '../server-extract.js'
import { SUGGESTED_VENUES } from '../src/lib/localVenues.js'

const outFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'venue-events.json')

// The committed venue-events.json doubles as a seed: some sites (AftonTickets)
// block cloud-server fetches, so when a live fetch fails we keep the
// last-known-good data instead of shipping an error.
let seed = {}
try {
  seed = JSON.parse(fs.readFileSync(outFile, 'utf8'))
} catch {}

const out = { builtAt: new Date().toISOString() }
let failures = 0
for (const v of SUGGESTED_VENUES) {
  const r = await extractEvents(v.url)
  if (r.ok) {
    out[v.url] = r
    console.log(`OK   ${v.name}: ${r.events.length} events [${r.source}]`)
  } else if (seed[v.url]?.ok) {
    out[v.url] = seed[v.url]
    console.log(`SEED ${v.name}: live fetch failed (${r.error}), kept ${seed[v.url].events.length} seeded events`)
  } else {
    out[v.url] = r
    failures++
    console.log(`FAIL ${v.name}: ${r.error}`)
  }
}

fs.writeFileSync(outFile, JSON.stringify(out))
console.log(`Wrote ${outFile} (${failures} failure${failures === 1 ? '' : 's'})`)
