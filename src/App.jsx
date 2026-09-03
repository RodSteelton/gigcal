import React, { useEffect, useMemo, useState } from 'react'
import Calendar, { dateKey } from './components/Calendar.jsx'
import EventList from './components/EventList.jsx'
import Settings from './components/Settings.jsx'
import { loadSettings, saveSettings, cacheGet, cachePut, cacheClear } from './lib/storage.js'
import { fetchTownEvents, townKey } from './lib/ticketmaster.js'
import { sampleEvents } from './lib/sample.js'

function firstOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function sortByStart(list) {
  return [...list].sort((a, b) => ((a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1))
}

function monthISORange(monthStart) {
  const start = new Date(monthStart)
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
  const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z')
  return { startISO: iso(start), endISO: iso(new Date(end.getTime() - 1000)) }
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings)
  const [screen, setScreen] = useState('calendar')
  const [monthStart, setMonthStart] = useState(() => firstOfMonth(new Date()))
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [townFilter, setTownFilter] = useState('all')
  const [selectedDate, setSelectedDate] = useState(null)
  const [refreshTick, setRefreshTick] = useState(0)

  const demo = !settings.apiKey

  function updateSettings(next) {
    setSettings(next)
    saveSettings(next)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError('')
      if (!settings.towns.length) {
        setEvents([])
        return
      }
      if (!settings.apiKey) {
        setEvents(sortByStart(sampleEvents(monthStart, settings.towns)))
        return
      }
      setLoading(true)
      const { startISO, endISO } = monthISORange(monthStart)
      const monthTag = `${monthStart.getFullYear()}-${monthStart.getMonth() + 1}`
      const all = []
      let err = ''
      for (const town of settings.towns) {
        const key = `${townKey(town)}|${monthTag}`
        let evs = cacheGet(key)
        if (!evs) {
          try {
            evs = await fetchTownEvents({ apiKey: settings.apiKey, town, startISO, endISO })
            cachePut(key, evs)
          } catch (e) {
            err = e.message
            evs = []
          }
        }
        all.push(...evs)
      }
      if (cancelled) return
      const seen = new Set()
      const deduped = all.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
      setEvents(sortByStart(deduped))
      setLoading(false)
      if (err === 'bad-key') setError("That key didn't work — double-check it in Settings.")
      else if (err === 'rate-limit') setError('Checked too often — try again in a minute.')
      else if (err) setError('Could not reach the listings service. Check your internet connection.')
    }
    load()
    return () => {
      cancelled = true
    }
  }, [settings, monthStart, refreshTick])

  function refresh() {
    cacheClear()
    setRefreshTick((t) => t + 1)
    setScreen('calendar')
  }

  function changeMonth(dir) {
    setSelectedDate(null)
    setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() + dir, 1))
  }

  const townKeys = useMemo(() => settings.towns.map(townKey), [settings.towns])

  const visible = useMemo(() => {
    let list = events
    if (townFilter !== 'all') list = list.filter((e) => e.townKey === townFilter)
    return list
  }, [events, townFilter])

  const counts = useMemo(() => {
    const m = new Map()
    for (const e of visible) m.set(e.date, (m.get(e.date) || 0) + 1)
    return m
  }, [visible])

  const listed = useMemo(() => {
    if (selectedDate) return visible.filter((e) => e.date === selectedDate)
    const today = dateKey(new Date())
    const upcoming = visible.filter((e) => e.date >= today)
    return upcoming.length ? upcoming : visible
  }, [visible, selectedDate])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">♪</span> GigCal
        </div>
        {settings.towns.length > 1 && screen === 'calendar' && (
          <select
            className="town-filter"
            value={townFilter}
            onChange={(e) => setTownFilter(e.target.value)}
            aria-label="Town filter"
          >
            <option value="all">All towns</option>
            {townKeys.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        )}
        <button
          className="btn ghost gear"
          onClick={() => setScreen(screen === 'settings' ? 'calendar' : 'settings')}
          aria-label="Settings"
        >
          ⚙
        </button>
      </header>

      {screen === 'settings' ? (
        <Settings
          settings={settings}
          onChange={updateSettings}
          onBack={() => setScreen('calendar')}
          onRefresh={refresh}
        />
      ) : settings.towns.length === 0 ? (
        <div className="welcome">
          <h1>Live music, wherever you are.</h1>
          <p>
            Pick your towns and GigCal fills a calendar with the shows coming to
            the clubs, halls, and theaters near you.
          </p>
          <button className="btn big" onClick={() => setScreen('settings')}>
            Choose my towns
          </button>
        </div>
      ) : (
        <main>
          {demo && (
            <button className="banner demo" onClick={() => setScreen('settings')}>
              Showing <b>sample shows</b>. Add your free listings key in Settings to see real ones. ›
            </button>
          )}
          {error && <div className="banner error">{error}</div>}
          {loading && <div className="banner loading">Checking for shows…</div>}
          <Calendar
            monthStart={monthStart}
            counts={counts}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onMonthChange={changeMonth}
          />
          {selectedDate && (
            <button className="banner clear-day" onClick={() => setSelectedDate(null)}>
              Showing one day — tap to see the whole month
            </button>
          )}
          <EventList events={listed} showTown={settings.towns.length > 1 && townFilter === 'all'} />
        </main>
      )}
    </div>
  )
}
