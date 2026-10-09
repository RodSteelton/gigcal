// Ticketmaster Discovery API client. By default requests go through the
// GigCal Worker, which holds the shared key and caches answers. A user who
// pastes their own key in Settings skips the Worker and talks to
// Ticketmaster directly (the API allows browser requests).
const BASE = 'https://app.ticketmaster.com/discovery/v2/events.json'
const PROXY = 'https://gigcal-reader.rodsteelton.workers.dev/tm'

export function townKey(t) {
  if (t.state) return `${t.city}, ${t.state}`
  if (t.country && t.country !== 'US') return `${t.city}, ${t.country}`
  return t.city
}

async function request(params, town, apiKey) {
  let url
  if (apiKey) {
    params.set('apikey', apiKey)
    url = `${BASE}?${params}`
  } else {
    url = `${PROXY}?${params}`
  }
  const res = await fetch(url)
  if (res.status === 401) throw new Error('bad-key')
  if (res.status === 429) throw new Error('rate-limit')
  if (!res.ok) throw new Error('http-' + res.status)
  const data = await res.json()
  const events = data?._embedded?.events || []
  return events.map((e) => normalize(e, town))
}

export async function fetchTownEvents({ apiKey, town, startISO, endISO, category = 'Music' }) {
  const params = new URLSearchParams({
    city: town.city,
    countryCode: town.country || 'US',
    sort: 'date,asc',
    size: '200',
    startDateTime: startISO,
    endDateTime: endISO,
  })
  if (category && category !== 'Everything') params.set('classificationName', category)
  if (town.state) params.set('stateCode', town.state)
  return request(params, town, apiKey)
}

// Free-text search (band, venue, "trivia", …) over the next six months.
// The window starts at the beginning of today (UTC) so repeat searches share
// the Worker's cache; the caller already drops anything before today.
export async function searchTownEvents({ apiKey, town, keyword }) {
  const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z')
  const dayStart = new Date()
  dayStart.setUTCHours(0, 0, 0, 0)
  const params = new URLSearchParams({
    keyword,
    city: town.city,
    countryCode: town.country || 'US',
    sort: 'date,asc',
    size: '100',
    startDateTime: iso(dayStart),
    endDateTime: iso(new Date(dayStart.getTime() + 180 * 86400000)),
  })
  if (town.state) params.set('stateCode', town.state)
  return request(params, town, apiKey)
}

function normalize(e, town) {
  const venue = e._embedded?.venues?.[0]
  const genre = e.classifications?.[0]?.genre?.name
  return {
    id: e.id,
    name: e.name || 'Untitled event',
    date: e.dates?.start?.localDate || '',
    time: e.dates?.start?.localTime || '',
    timeTBA: !!(e.dates?.start?.timeTBA || e.dates?.start?.noSpecificTime),
    venue: venue?.name || 'Venue to be announced',
    city: venue?.city?.name || town.city,
    state: venue?.state?.stateCode || town.state || '',
    townKey: townKey(town),
    genre: genre && genre !== 'Undefined' ? genre : '',
    url: e.url || '',
    price: priceLabel(e.priceRanges),
  }
}

function priceLabel(ranges) {
  const r = Array.isArray(ranges) ? ranges[0] : null
  if (!r || r.min == null) return ''
  if (r.max == null || r.min === r.max) return `$${Math.round(r.min)}`
  return `$${Math.round(r.min)}–$${Math.round(r.max)}`
}
