// Feasibility test for "scout a town": find venues with websites in
// OpenStreetMap, then try GigCal's existing reader on a random sample.
// Usage: node scripts/osm-feasibility.mjs [nashville|asheville]
import { extractEvents } from '../server-extract.js'

const CITIES = {
  nashville: { bbox: '36.10,-86.86,36.24,-86.68', tz: 'America/Chicago' },
  asheville: { bbox: '35.55,-82.62,35.65,-82.50', tz: 'America/New_York' },
}
const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]
const SAMPLE = 24

const city = process.argv[2] || 'nashville'
const { bbox, tz } = CITIES[city]
const query = `[out:json][timeout:40];
(
  nwr["amenity"~"^(bar|pub|nightclub|theatre|music_venue|arts_centre)$"]["website"](${bbox});
  nwr["craft"="brewery"]["website"](${bbox});
  nwr["amenity"~"^(bar|pub|nightclub|theatre|music_venue|arts_centre)$"]["contact:website"](${bbox});
);
out tags 400;`

async function overpass() {
  const errors = []
  for (let round = 0; round < 3; round++) {
    for (const s of SERVERS) {
      try {
        const res = await fetch(s, {
          method: 'POST',
          body: new URLSearchParams({ data: query }),
          headers: { 'User-Agent': 'GigCal-feasibility-test' },
          signal: AbortSignal.timeout(60000),
        })
        const text = await res.text()
        if (text.trimStart().startsWith('{')) return JSON.parse(text)
        errors.push(`${new URL(s).host}: not JSON (HTTP ${res.status})`)
      } catch (e) {
        errors.push(`${new URL(s).host}: ${e.message}`)
      }
    }
    await new Promise((r) => setTimeout(r, 20000))
  }
  console.log('OpenStreetMap servers all failed:\n  ' + errors.join('\n  '))
  process.exit(2)
}

const j = await overpass()
const seen = new Set()
const venues = []
for (const e of j.elements) {
  const w = e.tags.website || e.tags['contact:website']
  if (!w || !e.tags.name) continue
  let u
  try {
    u = new URL(/^https?:/.test(w) ? w : 'https://' + w)
  } catch {
    continue
  }
  if (seen.has(u.hostname)) continue
  seen.add(u.hostname)
  venues.push({ name: e.tags.name, url: u.href })
}
console.log(`${city}: ${venues.length} venues with websites (from ${j.elements.length} OSM places)`)

const sample = venues.sort(() => Math.random() - 0.5).slice(0, SAMPLE)
const results = []
let i = 0
async function worker() {
  while (i < sample.length) {
    const v = sample[i++]
    const r = await Promise.race([
      extractEvents(v.url, tz),
      new Promise((res) => setTimeout(() => res({ ok: false, error: 'timeout' }), 25000)),
    ])
    results.push({ ...v, ok: r.ok, source: r.source, n: r.events?.length, err: r.error })
  }
}
await Promise.all(Array.from({ length: 6 }, worker))

const good = results.filter((r) => r.ok)
console.log(`readable calendar: ${good.length} of ${results.length} sampled sites`)
for (const r of good) console.log(`  OK  ${r.name} | ${r.source} | ${r.n} events`)
const tally = {}
for (const r of results.filter((r) => !r.ok)) tally[r.err] = (tally[r.err] || 0) + 1
console.log('failures by reason:', JSON.stringify(tally))
