import React, { useMemo } from 'react'

function headingFor(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

function timeLabel(e) {
  if (e.timeTBA || !e.time) return 'Time TBA'
  const [h, min] = e.time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh}:${String(min).padStart(2, '0')} ${ampm}`
}

export default function EventList({ events, showTown }) {
  const groups = useMemo(() => {
    const m = new Map()
    for (const e of events) {
      if (!m.has(e.date)) m.set(e.date, [])
      m.get(e.date).push(e)
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
  }, [events])

  if (!events.length) {
    return <div className="empty-list">No shows found for this view.</div>
  }

  return (
    <div className="event-list">
      {groups.map(([date, list]) => (
        <section key={date}>
          <h2 className="date-heading">{headingFor(date)}</h2>
          {list.map((e) => {
            const Card = e.url ? 'a' : 'article'
            const linkProps = e.url
              ? { href: e.url, target: '_blank', rel: 'noopener noreferrer' }
              : {}
            return (
              <Card key={e.id} className="event-card" {...linkProps}>
                <div className="event-time">{timeLabel(e)}</div>
                <div className="event-body">
                  <div className="event-name">{e.name}</div>
                  <div className="event-venue">
                    {e.venue}
                    {showTown && ` · ${e.city}${e.state ? ', ' + e.state : ''}`}
                  </div>
                  <div className="event-meta">
                    {e.genre && <span className="chip">{e.genre}</span>}
                    {e.price && <span className="chip price">{e.price}</span>}
                    {e.url && (
                      <span className="tickets">{e.fromSite ? 'Details ↗' : 'Tickets ↗'}</span>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </section>
      ))}
    </div>
  )
}
