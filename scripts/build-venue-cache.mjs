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

const out = { builtAt: new Date().toISOString() }
let failures = 0
for (const v of SUGGESTED_VENUES) {
  const r = await extractEvents(v.url)
  out[v.url] = r
  if (r.ok) {
    console.log(`OK   ${v.name}: ${r.events.length} events [${r.source}]`)
  } else {
    failures++
    console.log(`FAIL ${v.name}: ${r.error}`)
  }
}

fs.writeFileSync(outFile, JSON.stringify(out))
console.log(`Wrote ${outFile} (${failures} failure${failures === 1 ? '' : 's'})`)
