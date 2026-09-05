// Duplicate-show merging across sources. The same show often arrives
// from Ticketmaster, a venue's own site, and a town-wide calendar with
// slightly different names ("WNRN Presents: Charley Crockett — Age of
// the Ram Tour" vs "Charley Crockett"), so exact matching isn't enough.
// Feed richer sources first (Ticketmaster, then venue sites, then
// aggregators) — the first occurrence wins.
//
// Two events on the same date are the same show when:
//   1. their names match or one contains the other, AND their venues
//      don't clearly disagree; or
//   2. they're at the same venue within 30 minutes of each other,
//      whatever the names say.

function normText(s) {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\W+/g, ' ')
    .trim()
}

function normVenue(s) {
  return normText(s).replace(/^the /, '')
}

function mins(t) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function dedupeEvents(list) {
  const seenId = new Set()
  const byDate = new Map()
  const kept = []
  for (const e of list) {
    if (e.id != null) {
      if (seenId.has(e.id)) continue
      seenId.add(e.id)
    }
    const n = normText(e.name)
    const v = normVenue(e.venue || '')
    const tm = mins(e.time)
    const day = byDate.get(e.date) || []
    const dup = day.some((k) => {
      const venuesMatch = !v || !k.v || v === k.v || v.includes(k.v) || k.v.includes(v)
      const nameClose =
        k.n === n ||
        (n.length >= 6 && k.n.length >= 6 && (k.n.includes(n) || n.includes(k.n)))
      if (nameClose && venuesMatch) return true
      if (v && k.v && venuesMatch && tm != null && k.tm != null && Math.abs(tm - k.tm) <= 30) {
        return true
      }
      return false
    })
    if (dup) continue
    kept.push(e)
    day.push({ n, v, tm })
    byDate.set(e.date, day)
  }
  return kept
}
