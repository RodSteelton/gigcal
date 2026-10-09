// GigCal Cloudflare Worker:
//  /extract — venue-calendar reader (same code as ../server-extract.js), so
//             paste-any-venue-URL works on the hosted app.
//  /tm      — Ticketmaster Discovery proxy. The shared API key lives only in
//             the TM_API_KEY secret (never in the repo or the app), and each
//             city/month/category answer is cached so many users cost few calls.
import { extractEvents } from '../server-extract.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const TM_BASE = 'https://app.ticketmaster.com/discovery/v2/events.json'
const TM_PARAMS = [
  'city', 'classificationName', 'countryCode', 'endDateTime', 'keyword',
  'size', 'sort', 'startDateTime', 'stateCode',
]
const TM_CACHE_SECONDS = 2 * 60 * 60
const APP_ORIGINS = new Set(['https://rodsteelton.github.io'])
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/

function isPrivateHost(host) {
  return (
    /^(localhost|127\.|10\.|192\.168\.|0\.|\[::1\]|169\.254\.)/i.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /\.local$/i.test(host)
  )
}

function tmJson(body, status, origin, extra = {}) {
  return new Response(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin',
      'Content-Type': 'application/json',
      'Cache-Control': status === 200 ? 'public, max-age=300' : 'no-store',
      ...extra,
    },
  })
}

async function ticketmaster(request, env, ctx) {
  const origin = request.headers.get('Origin') || ''
  if (!APP_ORIGINS.has(origin) && !LOCAL_ORIGIN.test(origin)) {
    return new Response('forbidden', { status: 403 })
  }
  if (!env.TM_API_KEY) return tmJson('{"error":"not-configured"}', 503, origin)

  const incoming = new URL(request.url).searchParams
  const p = new URLSearchParams()
  for (const k of TM_PARAMS) {
    const v = (incoming.get(k) || '').trim()
    if (v) p.set(k, k === 'keyword' ? v.toLowerCase() : v)
  }
  if (!p.get('city')) return tmJson('{"error":"city-required"}', 400, origin)
  p.set('size', String(Math.min(Number(p.get('size')) || 200, 200)))

  const cacheKey = new Request('https://gigcal-cache.invalid/tm?' + p.toString())
  const cache = caches.default
  let hit = await cache.match(cacheKey)
  if (hit) return tmJson(await hit.text(), 200, origin, { 'X-GigCal-Cache': 'HIT' })

  p.set('apikey', env.TM_API_KEY.trim())
  const upstream = await fetch(`${TM_BASE}?${p}`)
  const body = await upstream.text()
  if (upstream.ok) {
    ctx.waitUntil(
      cache.put(
        cacheKey,
        new Response(body, { headers: { 'Cache-Control': `s-maxage=${TM_CACHE_SECONDS}` } })
      )
    )
  }
  return tmJson(body, upstream.status, origin, { 'X-GigCal-Cache': 'MISS' })
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
    const url = new URL(request.url)
    if (url.pathname === '/tm') return ticketmaster(request, env, ctx)
    if (url.pathname !== '/extract') {
      return new Response('GigCal venue-calendar reader. Use /extract?url=<events page>', {
        headers: CORS,
      })
    }
    const target = url.searchParams.get('url') || ''
    const tz = url.searchParams.get('tz') || 'America/New_York'
    let parsed = null
    try {
      parsed = new URL(target)
    } catch {}
    const bad = !parsed || !/^https?:$/.test(parsed.protocol) || isPrivateHost(parsed.hostname)
    const result = bad ? { ok: false, error: 'bad-url' } : await extractEvents(target, tz)
    return new Response(JSON.stringify(result), {
      headers: {
        ...CORS,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    })
  },
}
