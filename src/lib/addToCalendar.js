import { Capacitor } from '@capacitor/core'

// Most venues don't publish a set length, so we block out a reasonable
// default rather than leaving the event with no end time.
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000

function pad(n) {
  return String(n).padStart(2, '0')
}

function eventTimes(e) {
  const [y, m, d] = e.date.split('-').map(Number)
  if (e.timeTBA || !e.time) {
    const start = new Date(y, m - 1, d)
    const end = new Date(y, m - 1, d + 1)
    return { start, end, allDay: true }
  }
  const [h, min] = e.time.split(':').map(Number)
  const start = new Date(y, m - 1, d, h, min)
  const end = new Date(start.getTime() + DEFAULT_DURATION_MS)
  return { start, end, allDay: false }
}

function locationFor(e) {
  return [e.venue, e.city, e.state].filter(Boolean).join(', ')
}

function toICSDateTime(date) {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  )
}

function toICSDate(date) {
  return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate())
}

function escapeICS(text) {
  return String(text)
    .replace(/[\\;,]/g, (c) => '\\' + c)
    .replace(/\n/g, '\\n')
}

export function buildICS(e) {
  const { start, end, allDay } = eventTimes(e)
  const location = locationFor(e)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GigCal//EN',
    'BEGIN:VEVENT',
    `UID:${e.id}@gigcal`,
    `DTSTAMP:${toICSDateTime(new Date())}`,
    allDay ? `DTSTART;VALUE=DATE:${toICSDate(start)}` : `DTSTART:${toICSDateTime(start)}`,
    allDay ? `DTEND;VALUE=DATE:${toICSDate(end)}` : `DTEND:${toICSDateTime(end)}`,
    `SUMMARY:${escapeICS(e.name)}`,
    location && `LOCATION:${escapeICS(location)}`,
    e.url && `URL:${escapeICS(e.url)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)
  return lines.join('\r\n')
}

function downloadICS(e) {
  const blob = new Blob([buildICS(e)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${e.name.replace(/[^\w-]+/g, '_')}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Native (iOS/Capacitor): open the system "add event" sheet directly.
// Web and Android (TWA/browser): fall back to an .ics download, which every
// calendar app on both platforms knows how to import.
export async function addToCalendar(e) {
  if (Capacitor.isNativePlatform()) {
    const { CapacitorCalendar } = await import('@ebarooni/capacitor-calendar')
    const { start, end, allDay } = eventTimes(e)
    await CapacitorCalendar.createEventWithPrompt({
      title: e.name,
      location: locationFor(e),
      url: e.url || undefined,
      isAllDay: allDay,
      startDate: start.getTime(),
      endDate: end.getTime(),
    })
    return
  }
  downloadICS(e)
}
