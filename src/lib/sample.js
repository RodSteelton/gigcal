// Sample events shown until a real event-data key is saved, so the app
// is explorable out of the box. Deterministic per month so the calendar
// doesn't reshuffle on every render.
import { townKey } from './ticketmaster.js'

const ACTS = [
  'The Tin Roof Ramblers', 'Delta Mae Revival', 'Copper Canyon', 'Late Night Static',
  'The Velvet Owls', 'Junebug & The Fireflies', 'Big River Brass', 'Sallie Ford Trio',
  'Neon Prairie', 'The Wandering Sons', 'Magnolia Sky', 'Two Dollar Pistol',
]
const VENUES = [
  'The Bluebird Room', 'Riverside Music Hall', "Hank's Tavern", 'The Foundry',
  'Cedar Street Social', 'The Grand Marquee', 'Whistle Stop Saloon', 'Old Town Ballroom',
]
const GENRES = ['Rock', 'Country', 'Blues', 'Folk', 'Jazz', 'Bluegrass']
const TIMES = ['19:00:00', '19:30:00', '20:00:00', '20:30:00', '21:00:00']

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function sampleEvents(monthStart, towns) {
  const list = towns.length ? towns : [{ city: 'Sampleville', state: 'TN' }]
  const year = monthStart.getFullYear()
  const month = monthStart.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const out = []
  list.forEach((town, ti) => {
    const rand = rng(year * 1000 + month * 37 + ti * 7 + 5)
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month, d).getDay()
      const chance = dow === 5 || dow === 6 ? 0.85 : dow === 4 || dow === 0 ? 0.45 : 0.15
      const n = rand() < chance ? 1 + Math.floor(rand() * 2) : 0
      for (let i = 0; i < n; i++) {
        out.push({
          id: `sample-${ti}-${d}-${i}`,
          name: ACTS[Math.floor(rand() * ACTS.length)],
          date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
          time: TIMES[Math.floor(rand() * TIMES.length)],
          timeTBA: false,
          venue: VENUES[Math.floor(rand() * VENUES.length)],
          city: town.city,
          state: town.state || '',
          townKey: townKey(town),
          genre: GENRES[Math.floor(rand() * GENRES.length)],
          url: '',
          price: rand() < 0.6 ? `$${10 + Math.floor(rand() * 25)}` : '',
          sample: true,
        })
      }
    }
  })
  return out
}
