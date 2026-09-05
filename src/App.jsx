import React, { useEffect, useMemo, useState } from 'react'
import Calendar, { dateKey } from './components/Calendar.jsx'
import EventList from './components/EventList.jsx'
import Settings from './components/Settings.jsx'
import { loadSettings, saveSettings, cacheGet, cachePut, cacheClear } from './lib/storage.js'
import { fetchTownEvents, searchTownEvents, townKey } from './lib/ticketmaster.js'
import { fetchVenueEvents, venueTownKey, isNonMusic } from './lib/localVenues.js'
import { dedupeEvents } from './lib/dedupe.js'
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
  const [siteErrors, setSiteErrors] = useState([])
  const [settingsFocus, setSettingsFocus] = useState('')
  const [installEvt, setInstallEvt] = useState(null)
  const [query, setQuery] = useState('')
  const [lastQuery, setLastQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState(null)

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setInstallEvt(e)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  async function installApp() {
    if (!installEvt) return
    installEvt.prompt()
    await installEvt.userChoice.catch(() => {})
    setInstallEvt(null)
  }

  function openKeySettings() {
    setSettingsFocus('key')
    setScreen('settings')
  }

  const demo = !settings.apiKey

  function updateSettings(next) {
    setSettings(next)
    saveSettings(next)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError('')
      setSiteErrors([])
      if (!settings.towns.length && !settings.venues.length) {
        setEvents([])
        return
      }
      setLoading(true)
      const { startISO, endISO } = monthISORange(monthStart)
      const monthTag = `${monthStart.getFullYear()}-${monthStart.getMonth() + 1}`
      const monthPrefix = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`
      const all = []
      let err = ''
      const failedSites = []

      const category = settings.category || 'Music'

      if (settings.apiKey) {
        for (const town of settings.towns) {
          const key = `${townKey(town)}|${monthTag}|${category}`
          let evs = cacheGet(key)
          if (!evs) {
            try {
              evs = await fetchTownEvents({ apiKey: settings.apiKey, town, startISO, endISO, category })
              cachePut(key, evs)
            } catch (e) {
              err = e.message
              evs = []
            }
          }
          all.push(...evs)
        }
      }

      // Venue websites don't classify their events; they contribute to
      // Music (with the obvious non-music happenings filtered out) and
      // to Everything (unfiltered).
      if (category === 'Music' || category === 'Everything') {
        // aggregators last, so direct listings win the duplicate merge
        const orderedVenues = [...settings.venues].sort(
          (a, b) => (a.aggregator ? 1 : 0) - (b.aggregator ? 1 : 0)
        )
        for (const venue of orderedVenues) {
          const key = `site:${venue.url}`
          let evs = cacheGet(key)
          if (!evs) {
            try {
              evs = await fetchVenueEvents(venue)
              cachePut(key, evs)
            } catch {
              failedSites.push(venue.name)
              evs = []
            }
          }
          all.push(
            ...evs.filter(
              (e) =>
                e.date.startsWith(monthPrefix) &&
                (category !== 'Music' ||
                  (!isNonMusic(e.name) && (!e.genre || /music/i.test(e.genre))))
            )
          )
        }
      }

      if (!settings.apiKey && !settings.venues.length) {
        all.push(...sampleEvents(monthStart, settings.towns))
      }

      if (cancelled) return
      setEvents(sortByStart(dedupeEvents(all)))
      setLoading(false)
      setSiteErrors(failedSites)
      if (err === 'bad-key') setError("That key didn't work — double-check it in Settings.")
      else if (err === 'rate-limit') setError('Checked too often — try again in a minute.')
      else if (err) setError('Could not reach the listings service. Check your internet connection.')
    }
    load()
    return () => {
      cancelled = true
    }
  }, [settings, monthStart, refreshTick])

  async function runSearch(e) {
    if (e) e.preventDefault()
    const q = query.trim()
    if (q.length < 2) return
    setSearching(true)
    setLastQuery(q)
    setSearchResults([])
    const ql = q.toLowerCase()
    const results = []
    // Ticketmaster first: richer listings win the duplicate merge
    if (settings.apiKey) {
      for (const town of settings.towns) {
        try {
          results.push(...(await searchTownEvents({ apiKey: settings.apiKey, town, keyword: q })))
        } catch {}
      }
    }
    const orderedVenues = [...settings.venues].sort(
      (a, b) => (a.aggregator ? 1 : 0) - (b.aggregator ? 1 : 0)
    )
    for (const venue of orderedVenues) {
      const key = `site:${venue.url}`
      let evs = cacheGet(key)
      if (!evs) {
        try {
          evs = await fetchVenueEvents(venue)
          cachePut(key, evs)
        } catch {
          evs = []
        }
      }
      results.push(
        ...evs.filter((ev) => `${ev.name} ${ev.venue} ${ev.city}`.toLowerCase().includes(ql))
      )
    }
    const today = dateKey(new Date())
    setSearchResults(sortByStart(dedupeEvents(results.filter((ev) => ev.date >= today))))
    setSearching(false)
  }

  function closeSearch() {
    setQuery('')
    setLastQuery('')
    setSearchResults(null)
  }

  function refresh() {
    cacheClear()
    setRefreshTick((t) => t + 1)
    setScreen('calendar')
  }

  function changeMonth(dir) {
    setSelectedDate(null)
    setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() + dir, 1))
  }

  const townKeys = useMemo(() => {
    const keys = [...settings.towns.map(townKey), ...settings.venues.map(venueTownKey)]
    return [...new Set(keys)]
  }, [settings.towns, settings.venues])

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
        {townKeys.length > 1 && screen === 'calendar' && (
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
          onClick={() => {
            setSettingsFocus('')
            setScreen(screen === 'settings' ? 'calendar' : 'settings')
          }}
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
          focusKey={settingsFocus === 'key'}
        />
      ) : settings.towns.length === 0 && settings.venues.length === 0 ? (
        <div className="welcome">
          <h1>Live music, wherever you are.</h1>
          <p>
            Pick your towns and GigCal fills a month calendar with the shows
            coming to the halls, clubs, wineries, and breweries near you —
            big-name concerts and free local nights alike. Tap any show for
            details and tickets.
          </p>
          <button className="btn big" onClick={() => setScreen('settings')}>
            Choose my towns
          </button>
        </div>
      ) : (
        <main>
          <form className="search-row" onSubmit={runSearch}>
            <select
              className="town-filter cat"
              value={settings.category || 'Music'}
              onChange={(e) => updateSettings({ ...settings, category: e.target.value })}
              aria-label="Event type"
            >
              {['Music', 'Comedy', 'Arts & Theatre', 'Family', 'Film', 'Sports', 'Everything'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search band, venue, anything…"
              aria-label="Search events"
            />
            <button className="btn" type="submit">Go</button>
          </form>
          {searchResults !== null ? (
            <>
              <div className="search-head">
                <span>
                  {searching
                    ? 'Searching…'
                    : `${searchResults.length} upcoming ${searchResults.length === 1 ? 'match' : 'matches'} for “${lastQuery}”`}
                </span>
                <button className="btn ghost" onClick={closeSearch}>× Back to calendar</button>
              </div>
              <EventList events={searchResults} showTown={true} />
            </>
          ) : (
            <>
          {installEvt && (
            <div className="key-cta">
              <p>Put GigCal on your home screen — opens like an app, no browser bar.</p>
              <button className="btn" onClick={installApp}>Add to phone</button>
            </div>
          )}
          {demo && (
            <div className="key-cta">
              <p>
                {settings.venues.length > 0
                  ? 'Your local venues are live. For the big halls and arenas, add the free listings key — takes two minutes.'
                  : 'These are sample shows. Real listings need a free key — takes two minutes.'}
              </p>
              <button className="btn" onClick={openKeySettings}>Get my free key</button>
            </div>
          )}
          {error && <div className="banner error">{error}</div>}
          {siteErrors.length > 0 && (
            <div className="banner error">
              Couldn't read the calendar at: {siteErrors.join(', ')}. Their site may be down or changed.
            </div>
          )}
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
          <EventList events={listed} showTown={townKeys.length > 1 && townFilter === 'all'} />
            </>
          )}
        </main>
      )}
      <footer className="app-footer">
        <div>© 2026 SS Berr · All rights reserved</div>
        <div>
          GigCal is ad-free. If you like it,{' '}
          <a href="https://venmo.com/u/Stuart-Berr" target="_blank" rel="noopener noreferrer">
            send me $5 via Venmo
          </a>{' '}
          — or whatever. 🎶
        </div>
      </footer>
    </div>
  )
}
