// Local venue calendars, read through the GigCal server's /api/extract
// (browsers can't fetch other sites directly). Suggestions were tested
// against the real sites; TM_COVERED venues already appear via the
// Ticketmaster key, so they are listed only as an FYI, not scraped.

export const SUGGESTED_VENUES = [
  // Ting's ticketed shows come via Ticketmaster; its RSS feed adds the
  // free Fridays After Five series, filtered by `include` so the
  // ticketed shows don't appear twice.
  {
    city: 'Charlottesville',
    state: 'VA',
    name: 'Ting Pavilion — Fridays After Five (free)',
    url: 'https://www.tingpavilion.com/events/rss',
    include: 'fridays after five',
    venueLabel: 'Ting Pavilion',
  },
  { city: 'Charlottesville', state: 'VA', name: 'Eastwood Farm and Winery', url: 'https://eastwoodfarmandwinery.com/full-calendar/' },
  // Front Porch's own site renders its list with JavaScript, but they
  // sell through AftonTickets, whose venue pages are readable.
  {
    city: 'Charlottesville',
    state: 'VA',
    name: 'The Front Porch (incl. Rivanna Roots)',
    url: 'https://aftontickets.com/thefrontporch',
    venueLabel: 'The Front Porch',
  },
  { city: 'Batesville', state: 'VA', name: 'Batesville Market', url: 'https://aftontickets.com/batesville' },
  { city: 'Crozet', state: 'VA', name: 'Starr Hill Brewery', url: 'https://starrhill.com/crozet-events' },
  { city: 'Crozet', state: 'VA', name: 'King Family Vineyards', url: 'https://kingfamilyvineyards.com/event-calendar/' },
  { city: 'Crozet', state: 'VA', name: 'Grace Estate Winery', url: 'https://www.graceestatewinery.com/event-calendar' },
  { city: 'Waynesboro', state: 'VA', name: 'The Foundry', url: 'https://www.thefoundrysound.com/shows' },
]

export const TM_COVERED = {
  charlottesville: ['Ting Pavilion', 'The Jefferson Theater', 'The Southern Café & Music Hall', 'John Paul Jones Arena'],
}

// Towns whose suggestions should surface together (same area).
const AREAS = [['charlottesville', 'crozet', 'waynesboro', 'batesville']]

export function suggestionsForTowns(towns) {
  const wanted = new Set()
  for (const t of towns) {
    const c = t.city.trim().toLowerCase()
    wanted.add(c)
    for (const area of AREAS) {
      if (area.includes(c)) area.forEach((a) => wanted.add(a))
    }
  }
  return SUGGESTED_VENUES.filter((v) => wanted.has(v.city.toLowerCase()))
}

export function tmCoveredForTowns(towns) {
  const out = []
  for (const t of towns) {
    const names = TM_COVERED[t.city.trim().toLowerCase()]
    if (names) out.push(...names)
  }
  return out
}

export function venueTownKey(v) {
  return v.state ? `${v.city}, ${v.state}` : v.city
}

// Venue calendars mix in plainly-non-music happenings (trivia, yoga,
// run clubs). Exclude only the obvious ones; unknown titles stay, since
// a show billed just by artist name must not be hidden.
const NON_MUSIC =
  /\b(trivia|yoga|pilates|barre|game night|run club|trail run|book club|bingo|paint (?:night|class|and sip)|watch party|farmers market|wine club pickup|cornhole|comedy)\b/i

// Applied at display time (only when the Music category is active), so
// the same cached venue data can serve the "Everything" category too.
export function isNonMusic(name) {
  return NON_MUSIC.test(name)
}

export function areaCities(city) {
  const c = city.trim().toLowerCase()
  for (const area of AREAS) {
    if (area.includes(c)) return [...area]
  }
  return [c]
}

// Online (static hosting) there is no live /api/extract; a scheduled
// build refreshes venue-events.json every few hours instead.
let staticCachePromise = null
function staticCache() {
  if (!staticCachePromise) {
    // no-cache: revalidate so a fresh scheduled build isn't masked by the
    // host's short-lived HTTP cache
    staticCachePromise = fetch('venue-events.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
  }
  return staticCachePromise
}

export async function fetchVenueEvents(venue) {
  let data = null
  try {
    const res = await fetch(`/api/extract?url=${encodeURIComponent(venue.url)}`)
    if (res.ok) data = await res.json()
  } catch {}
  if (!data) {
    const all = await staticCache()
    data = all[venue.url] || null
  }
  if (!data) throw new Error('extract-unavailable')
  if (!data.ok) throw new Error(data.error || 'extract-failed')
  const include = venue.include ? new RegExp(venue.include, 'i') : null
  return data.events
    .filter((e) => !include || include.test(e.name))
    .map((e, i) => ({
    id: `site-${venue.name}-${e.date}-${i}`,
    name: e.name,
    date: e.date,
    time: e.time || '',
    timeTBA: !e.time,
    venue: e.venue || venue.venueLabel || venue.name,
    city: venue.city,
    state: venue.state || '',
    townKey: venueTownKey(venue),
    genre: '',
    url: e.url || venue.url,
    price: e.price || '',
    fromSite: true,
  }))
}
