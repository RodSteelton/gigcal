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
  { city: 'Crozet', state: 'VA', name: 'Starr Hill Brewery', url: 'https://starrhill.com/crozet-events' },
  { city: 'Crozet', state: 'VA', name: 'King Family Vineyards', url: 'https://kingfamilyvineyards.com/event-calendar/' },
  { city: 'Crozet', state: 'VA', name: 'Grace Estate Winery', url: 'https://www.graceestatewinery.com/event-calendar' },
  { city: 'Waynesboro', state: 'VA', name: 'The Foundry', url: 'https://www.thefoundrysound.com/shows' },
]

export const TM_COVERED = {
  charlottesville: ['Ting Pavilion', 'The Jefferson Theater', 'The Southern Café & Music Hall', 'John Paul Jones Arena'],
}

// Towns whose suggestions should surface together (same area).
const AREAS = [['charlottesville', 'crozet', 'waynesboro']]

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

export async function fetchVenueEvents(venue) {
  const res = await fetch(`/api/extract?url=${encodeURIComponent(venue.url)}`)
  if (!res.ok) throw new Error('extract-http-' + res.status)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'extract-failed')
  const include = venue.include ? new RegExp(venue.include, 'i') : null
  return data.events
    .filter((e) => !NON_MUSIC.test(e.name) && (!include || include.test(e.name)))
    .map((e, i) => ({
    id: `site-${venue.name}-${e.date}-${i}`,
    name: e.name,
    date: e.date,
    time: e.time || '',
    timeTBA: !e.time,
    venue: venue.venueLabel || venue.name,
    city: venue.city,
    state: venue.state || '',
    townKey: venueTownKey(venue),
    genre: '',
    url: e.url || venue.url,
    price: e.price || '',
    fromSite: true,
  }))
}
