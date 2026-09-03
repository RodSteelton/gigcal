import { SUGGESTED_VENUES } from './localVenues.js'

const SETTINGS_KEY = 'gigcal-settings'
const CACHE_KEY = 'gigcal-events-cache'
const CACHE_TTL = 6 * 60 * 60 * 1000 // re-fetch a town's month after 6 hours

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const s = JSON.parse(raw)
      return {
        apiKey: s.apiKey || '',
        towns: Array.isArray(s.towns) ? s.towns : [],
        venues: Array.isArray(s.venues) ? s.venues : [],
      }
    }
  } catch {}
  // First run: ship the curated area setup as the starting point.
  // Each device can prune or extend it; the listings key is always per-person.
  return {
    apiKey: '',
    towns: [{ city: 'Charlottesville', state: 'VA' }],
    venues: SUGGESTED_VENUES.map((v) => ({ ...v })),
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {}
}

export function cacheGet(key) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    const hit = all[key]
    if (hit && Date.now() - hit.at < CACHE_TTL) return hit.events
  } catch {}
  return null
}

export function cachePut(key, events) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    for (const k of Object.keys(all)) {
      if (Date.now() - all[k].at > CACHE_TTL) delete all[k]
    }
    all[key] = { at: Date.now(), events }
    localStorage.setItem(CACHE_KEY, JSON.stringify(all))
  } catch {}
}

export function cacheClear() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {}
}
