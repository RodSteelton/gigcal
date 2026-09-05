// GigCal venue-calendar reader as a Cloudflare Worker — the hosted app's
// live /extract endpoint, so paste-any-venue-URL works away from home.
// Same reader code as the local server (../server-extract.js).
import { extractEvents } from '../server-extract.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

function isPrivateHost(host) {
  return (
    /^(localhost|127\.|10\.|192\.168\.|0\.|\[::1\]|169\.254\.)/i.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /\.local$/i.test(host)
  )
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
    const url = new URL(request.url)
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
        'Cache-Control': 'public, max-age=1800',
      },
    })
  },
}
