// Venue-calendar reader: given a venue's events-page URL, try the common
// machine-readable formats in order and return normalized events.
// Order: ICS feed → RSS with event dates → JSON-LD schema.org markup →
// RSS feed discovered in the HTML → Squarespace ?format=json →
// WordPress "The Events Calendar" REST → WordPress ?ical=1 export.
// Runs server-side because browsers can't fetch other sites (CORS).

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

const cache = new Map()
const TTL = 3 * 60 * 60 * 1000

export async function extractEvents(target) {
  const hit = cache.get(target)
  if (hit && Date.now() - hit.at < TTL) return hit.result
  let result
  try {
    result = await extract(target)
  } catch (e) {
    result = { ok: false, error: String((e && e.message) || e) }
  }
  cache.set(target, result)
  return result
}

async function fetchText(url) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 20000)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/json,text/calendar,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: ctl.signal,
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    return { text: await res.text(), type: res.headers.get('content-type') || '' }
  } finally {
    clearTimeout(t)
  }
}

async function extract(target) {
  const { text, type } = await fetchText(target)

  if (type.includes('text/calendar') || text.startsWith('BEGIN:VCALENDAR')) {
    return done('ics', parseICS(text))
  }

  if (/xml|rss/.test(type) || /^\s*<\?xml|^\s*<rss/.test(text)) {
    const evs = fromRss(text)
    if (evs.length) return done('rss', evs)
  }

  if (type.includes('json') || text[0] === '{' || text[0] === '[') {
    const evs = fromSquarespace(text, target)
    if (evs.length) return done('squarespace', evs)
  }

  // HTML page: try embedded JSON-LD first
  const ld = fromJsonLd(text)
  if (ld.length) return done('jsonld', ld)

  // RSS feed advertised or linked in the HTML (e.g. carbonhouse venue
  // sites expose /events/rss with per-item event dates)
  const rssUrl = findRssLink(text, target)
  if (rssUrl) {
    const rss = await fetchText(rssUrl).catch(() => null)
    if (rss) {
      const evs = fromRss(rss.text)
      if (evs.length) return done('rss', evs)
    }
  }

  // Squarespace page? ask for its JSON form
  const sqspUrl = target + (target.includes('?') ? '&' : '?') + 'format=json'
  const sqsp = await fetchText(sqspUrl).catch(() => null)
  if (sqsp && (sqsp.type.includes('json') || sqsp.text[0] === '{')) {
    const evs = fromSquarespace(sqsp.text, target)
    if (evs.length) return done('squarespace', evs)
  }

  // WordPress "The Events Calendar" REST at the site root
  const origin = new URL(target).origin
  const tribe = await fetchText(
    `${origin}/wp-json/tribe/events/v1/events?per_page=50`
  ).catch(() => null)
  if (tribe) {
    const evs = fromTribe(tribe.text)
    if (evs.length) return done('tribe', evs)
  }

  // WordPress ICS export of the given page
  const ical = await fetchText(
    target + (target.includes('?') ? '&' : '?') + 'ical=1'
  ).catch(() => null)
  if (ical && ical.text.startsWith('BEGIN:VCALENDAR')) {
    return done('ics', parseICS(ical.text))
  }

  return { ok: false, error: 'no-readable-calendar' }
}

function done(source, events) {
  const cleaned = events
    .filter((e) => e.name && /^\d{4}-\d{2}-\d{2}$/.test(e.date))
    .map((e) => ({
      ...e,
      name: e.name.replace(/&#?\w+;/g, (s) => decodeEntity(s)).replace(/<[^>]*>/g, '').trim().slice(0, 120),
    }))
  if (!cleaned.length) return { ok: false, error: 'no-events-found' }
  return { ok: true, source, events: cleaned }
}

// ---------- ICS ----------
function parseICS(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n')
  const events = []
  let cur = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {}
    else if (line === 'END:VEVENT') {
      if (cur) events.push(cur)
      cur = null
    } else if (cur) {
      const ci = line.indexOf(':')
      if (ci < 0) continue
      const keyPart = line.slice(0, ci)
      const value = line.slice(ci + 1)
      const key = keyPart.split(';')[0].toUpperCase()
      if (key === 'DTSTART') {
        const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/)
        if (m) {
          cur.date = `${m[1]}-${m[2]}-${m[3]}`
          cur.time = m[4] ? `${m[4]}:${m[5]}:${m[6]}` : ''
        }
      } else if (key === 'SUMMARY') {
        cur.name = value.replace(/\\([,;])/g, '$1').replace(/\\n/g, ' ')
      } else if (key === 'URL') cur.url = value
    }
  }
  return events.map((e) => ({ name: e.name || '', date: e.date || '', time: e.time || '', url: e.url || '', price: '' }))
}

// ---------- RSS with event dates ----------
// Accepts only items carrying an event-start field (ev:startdate or
// xCal dtstart); a plain blog feed yields nothing and the chain moves on.
function fromRss(xml) {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || []
  const out = []
  for (const item of items) {
    const get = (tag) => {
      const m = item.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i'))
      return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : ''
    }
    const start = get('ev:startdate') || get('xCal:dtstart')
    if (!start) continue
    const d = new Date(start)
    if (Number.isNaN(d.getTime())) continue
    out.push({
      name: get('title'),
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`,
      url: get('link'),
      price: '',
    })
  }
  return out
}

function findRssLink(html, target) {
  const origin = new URL(target).origin
  const alt = html.match(
    /<link[^>]*type=["']application\/rss\+xml["'][^>]*href=["']([^"']+)["']/i
  )
  const href = alt ? alt[1] : (html.match(/href=["']([^"']*events\/rss[^"']*)["']/i) || [])[1]
  if (!href) return null
  try {
    return new URL(href, origin).href
  } catch {
    return null
  }
}

// ---------- JSON-LD ----------
function fromJsonLd(html) {
  const out = []
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html))) {
    let data
    try {
      data = JSON.parse(m[1].trim())
    } catch {
      continue
    }
    walkLd(data, out)
  }
  return out
}

function walkLd(node, out) {
  if (Array.isArray(node)) {
    node.forEach((n) => walkLd(n, out))
    return
  }
  if (!node || typeof node !== 'object') return
  if (node['@graph']) walkLd(node['@graph'], out)
  const type = [].concat(node['@type'] || []).join(',')
  if (/Event/.test(type) && node.startDate && node.name) {
    const start = String(node.startDate)
    const offers = [].concat(node.offers || [])[0] || {}
    let time = start.slice(11, 19)
    if (/^\d{2}:\d{2}$/.test(time)) time += ':00'
    if (!/^\d{2}:\d{2}:\d{2}$/.test(time)) time = ''
    out.push({
      name: String(node.name),
      date: start.slice(0, 10),
      time,
      url: typeof node.url === 'string' ? node.url : '',
      price: priceFromOffer(offers.price),
    })
  }
  if (node.subEvent) walkLd(node.subEvent, out)
}

// ---------- Squarespace ----------
function fromSquarespace(text, target) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return []
  }
  const origin = new URL(target).origin
  const out = []
  scanForSqspItems(data, out, origin, 0)
  return out
}

function scanForSqspItems(node, out, origin, depth) {
  if (depth > 6 || !node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    node.forEach((n) => scanForSqspItems(n, out, origin, depth + 1))
    return
  }
  if (node.title && typeof node.startDate === 'number' && node.startDate > 1e12) {
    const d = new Date(node.startDate)
    out.push({
      name: String(node.title),
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`,
      url: node.fullUrl ? origin + node.fullUrl : '',
      price: '',
    })
    return
  }
  for (const v of Object.values(node)) scanForSqspItems(v, out, origin, depth + 1)
}

// ---------- WordPress "The Events Calendar" REST ----------
function fromTribe(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return []
  }
  const events = Array.isArray(data?.events) ? data.events : []
  return events.map((e) => {
    const [date, time] = String(e.start_date || '').split(' ')
    return {
      name: String(e.title || '').replace(/&#\d+;|&[a-z]+;/g, (s) => decodeEntity(s)),
      date: date || '',
      time: time || '',
      url: e.url || '',
      price: e.cost || '',
    }
  })
}

function priceFromOffer(price) {
  if (price == null || price === '') return ''
  const n = Number(price)
  if (Number.isNaN(n)) return String(price)
  return n === 0 ? 'Free' : `$${Math.round(n)}`
}

function decodeEntity(s) {
  const named = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#039;': "'", '&#8217;': '’', '&#8216;': '‘', '&#8211;': '–', '&#8212;': '—', '&nbsp;': ' ' }
  if (named[s]) return named[s]
  const m = s.match(/&#(\d+);/)
  return m ? String.fromCodePoint(Number(m[1])) : s
}
