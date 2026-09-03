import React from 'react'

export function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function Calendar({ monthStart, counts, selectedDate, onSelectDate, onMonthChange }) {
  const year = monthStart.getFullYear()
  const month = monthStart.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayKey = dateKey(new Date())
  const label = monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="calendar">
      <div className="cal-head">
        <button className="cal-nav" onClick={() => onMonthChange(-1)} aria-label="Previous month">‹</button>
        <div className="cal-label">{label}</div>
        <button className="cal-nav" onClick={() => onMonthChange(1)} aria-label="Next month">›</button>
      </div>
      <div className="cal-grid cal-dow">
        {DOW.map((d, i) => (
          <div key={i} className="cal-dow-cell">{d}</div>
        ))}
      </div>
      <div className="cal-grid">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="cal-cell empty" />
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const count = counts.get(key) || 0
          const classes = ['cal-cell']
          if (key === todayKey) classes.push('today')
          if (key === selectedDate) classes.push('selected')
          if (count > 0) classes.push('has-events')
          return (
            <button
              key={i}
              className={classes.join(' ')}
              onClick={() => onSelectDate(key === selectedDate ? null : key)}
            >
              <span className="cal-daynum">{d}</span>
              {count > 0 && <span className="cal-dot">{count > 9 ? '9+' : count}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
