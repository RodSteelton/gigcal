// Generates the PWA icons (dark background, amber beamed eighth-notes)
// as PNGs with no dependencies — minimal PNG encoder over zlib.
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

let table
function crc32(buf) {
  if (!table) {
    table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
  }
  let c = -1
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

function encodePNG(size, px) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const BG = [0x0b, 0x0c, 0x10]
const AMBER = [0xff, 0xb6, 0x48]

function inEllipse(u, v, cx, cy, rx, ry) {
  const dx = (u - cx) / rx
  const dy = (v - cy) / ry
  return dx * dx + dy * dy <= 1
}

function inRect(u, v, x1, y1, x2, y2) {
  return u >= x1 && u <= x2 && v >= y1 && v <= y2
}

function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size
      const v = (y + 0.5) / size
      const note =
        inEllipse(u, v, 0.355, 0.665, 0.088, 0.064) ||
        inEllipse(u, v, 0.645, 0.665, 0.088, 0.064) ||
        inRect(u, v, 0.408, 0.30, 0.443, 0.665) ||
        inRect(u, v, 0.698, 0.30, 0.733, 0.665) ||
        inRect(u, v, 0.408, 0.28, 0.733, 0.365)
      const c = note ? AMBER : BG
      const i = (y * size + x) * 4
      px[i] = c[0]
      px[i + 1] = c[1]
      px[i + 2] = c[2]
      px[i + 3] = 255
    }
  }
  return encodePNG(size, px)
}

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'icon-512.png'), drawIcon(512))
fs.writeFileSync(path.join(outDir, 'icon-192.png'), drawIcon(192))
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), drawIcon(180))
console.log('Icons written to', outDir)
