// Tiny production server: serves the built app from dist/ and exposes
// /api/info so the Settings screen can show the phone-friendly LAN URL.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { extractEvents } from './server-extract.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, 'dist')
const PORT = Number(process.env.GIGCAL_PORT || 5175)

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
}

function lanIP() {
  // Prefer real adapters (Wi-Fi/Ethernet) over virtual ones (vEthernet,
  // WSL, VirtualBox) so the phone URL is one the phone can actually reach.
  const virtual = /vethernet|wsl|virtual|loopback|vmware|hyper-v/i
  let fallback = ''
  for (const [name, ifs] of Object.entries(os.networkInterfaces())) {
    for (const i of ifs || []) {
      if (i.family !== 'IPv4' || i.internal) continue
      if (virtual.test(name)) {
        fallback = fallback || i.address
      } else {
        return i.address
      }
    }
  }
  return fallback || 'localhost'
}

function isPrivateHost(host) {
  return (
    /^(localhost|127\.|10\.|192\.168\.|0\.|\[::1\]|169\.254\.)/i.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /\.local$/i.test(host)
  )
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  if (url.pathname === '/api/extract') {
    const target = url.searchParams.get('url') || ''
    let parsed
    try {
      parsed = new URL(target)
    } catch {
      parsed = null
    }
    const bad = !parsed || !/^https?:$/.test(parsed.protocol) || isPrivateHost(parsed.hostname)
    const result = bad
      ? { ok: false, error: 'bad-url' }
      : await extractEvents(target, url.searchParams.get('tz') || '')
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify(result))
    return
  }
  if (url.pathname === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify({ ip: lanIP(), port: PORT }))
    return
  }
  let p = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)))
  if (!p.startsWith(DIST)) {
    res.writeHead(403)
    res.end()
    return
  }
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(DIST, 'index.html')
  const ext = path.extname(p).toLowerCase()
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
  fs.createReadStream(p).pipe(res)
})

server.listen(PORT, () => {
  console.log('GigCal is running.')
  console.log(`  On this computer:            http://localhost:${PORT}`)
  console.log(`  On your phone (same Wi-Fi):  http://${lanIP()}:${PORT}`)
})
