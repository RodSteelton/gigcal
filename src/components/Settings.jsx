import React, { useEffect, useRef, useState } from 'react'
import { suggestionsForTowns, tmCoveredForTowns, areaCities } from '../lib/localVenues.js'
import { townKey } from '../lib/ticketmaster.js'

const STATES = 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' ')

const COUNTRIES = [
  ['US', 'United States'], ['CA', 'Canada'], ['GB', 'United Kingdom'], ['IE', 'Ireland'],
  ['AU', 'Australia'], ['NZ', 'New Zealand'], ['MX', 'Mexico'], ['DE', 'Germany'],
  ['AT', 'Austria'], ['CH', 'Switzerland'], ['NL', 'Netherlands'], ['BE', 'Belgium'],
  ['FR', 'France'], ['IT', 'Italy'], ['ES', 'Spain'], ['PT', 'Portugal'],
  ['DK', 'Denmark'], ['SE', 'Sweden'], ['NO', 'Norway'], ['FI', 'Finland'],
  ['PL', 'Poland'], ['CZ', 'Czechia'], ['TR', 'Türkiye'], ['ZA', 'South Africa'],
  ['AE', 'United Arab Emirates'], ['SG', 'Singapore'], ['TW', 'Taiwan'], ['JP', 'Japan'],
]

export default function Settings({ settings, onChange, onBack, onRefresh, focusKey }) {
  const keyPanelRef = useRef(null)

  useEffect(() => {
    if (focusKey && keyPanelRef.current) {
      keyPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [focusKey])

  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [country, setCountry] = useState('US')
  const [keyDraft, setKeyDraft] = useState(settings.apiKey)
  const [savedFlash, setSavedFlash] = useState(false)
  const [phoneUrl, setPhoneUrl] = useState('')

  useEffect(() => {
    fetch('/api/info')
      .then((r) => (r.ok ? r.json() : null))
      .then((info) => {
        if (info?.ip && info.ip !== 'localhost') setPhoneUrl(`http://${info.ip}:${info.port}`)
      })
      .catch(() => {})
  }, [])

  function addTown(e) {
    e.preventDefault()
    const c = city.trim()
    const s = country === 'US' ? state.trim().toUpperCase() : ''
    if (!c) return
    const town = { city: c, state: s, country }
    const exists = settings.towns.some(
      (t) => t.city.toLowerCase() === c.toLowerCase() && (t.state || '') === s && (t.country || 'US') === country
    )
    if (!exists) {
      // Re-adding a town restores the venues that were set aside when it
      // was removed, so a town's setup is never lost.
      const archiveKey = townKey(town).toLowerCase()
      const restored = settings.townArchive?.[archiveKey] || []
      const have = new Set(settings.venues.map((v) => v.url))
      const venues = [...settings.venues, ...restored.filter((v) => !have.has(v.url))]
      const townArchive = { ...settings.townArchive }
      delete townArchive[archiveKey]
      onChange({ ...settings, towns: [...settings.towns, town], venues, townArchive })
    }
    setCity('')
    setState('')
  }

  function removeTown(idx) {
    const town = settings.towns[idx]
    const remaining = settings.towns.filter((_, i) => i !== idx)
    const removedCities = new Set(areaCities(town.city))
    const keptCities = new Set(remaining.flatMap((t) => areaCities(t.city)))
    const archived = settings.venues.filter((v) => {
      const vc = v.city.trim().toLowerCase()
      return removedCities.has(vc) && !keptCities.has(vc)
    })
    const venues = settings.venues.filter((v) => !archived.includes(v))
    const townArchive = { ...settings.townArchive }
    if (archived.length) {
      townArchive[townKey(town).toLowerCase()] = archived
    }
    onChange({ ...settings, towns: remaining, venues, townArchive })
  }

  const [vName, setVName] = useState('')
  const [vUrl, setVUrl] = useState('')
  const [vCity, setVCity] = useState('')
  const [vState, setVState] = useState('')

  const suggestions = suggestionsForTowns(settings.towns).filter(
    (s) => !settings.venues.some((v) => v.url === s.url)
  )
  const tmCovered = tmCoveredForTowns(settings.towns)

  function addVenue(v) {
    if (settings.venues.some((x) => x.url === v.url)) return
    onChange({ ...settings, venues: [...settings.venues, v] })
  }

  function addManualVenue(e) {
    e.preventDefault()
    const name = vName.trim()
    let url = vUrl.trim()
    if (!name || !url) return
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    addVenue({ name, url, city: vCity.trim() || (settings.towns[0]?.city ?? ''), state: vState.trim().toUpperCase() || (settings.towns[0]?.state ?? '') })
    setVName('')
    setVUrl('')
    setVCity('')
    setVState('')
  }

  function removeVenue(idx) {
    onChange({ ...settings, venues: settings.venues.filter((_, i) => i !== idx) })
  }

  function saveKey(e) {
    e.preventDefault()
    onChange({ ...settings, apiKey: keyDraft.trim() })
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  return (
    <div className="settings">
      <div className="settings-bar">
        <button className="btn ghost" onClick={onBack}>‹ Back to calendar</button>
      </div>

      <section className="panel">
        <h2>My towns</h2>
        <p className="hint">Shows are searched in every town on this list.</p>
        <p className="hint dim">
          Removing a town sets its venues aside, not gone — add the town back
          anytime and its full setup returns.
        </p>
        {settings.towns.length === 0 && <p className="hint dim">No towns yet — add one below.</p>}
        <ul className="town-list">
          {settings.towns.map((t, i) => (
            <li key={i}>
              <span>{townKey(t)}</span>
              <button className="remove" onClick={() => removeTown(i)} aria-label={`Remove ${t.city}`}>×</button>
            </li>
          ))}
        </ul>
        <form className="town-add" onSubmit={addTown}>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City (e.g. Nashville)"
            aria-label="City"
          />
          {country === 'US' && (
            <select value={state} onChange={(e) => setState(e.target.value)} aria-label="State">
              <option value="">State…</option>
              {STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country">
            {COUNTRIES.map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
          <button className="btn" type="submit">Add</button>
        </form>
        <p className="hint dim">
          Any city works — the big-hall listings cover the United States and
          most countries where Ticketmaster sells tickets.
        </p>
      </section>

      <section className="panel">
        <h2>Local venues</h2>
        <p className="hint">
          Besides the big-hall listings, GigCal can read the events calendar on a
          venue's own website — wineries, breweries, small halls.
        </p>
        {settings.venues.length > 0 && (
          <ul className="town-list">
            {settings.venues.map((v, i) => (
              <li key={v.url}>
                <span>
                  {v.name} <span className="venue-town">({v.city}{v.state ? `, ${v.state}` : ''})</span>
                </span>
                <button className="remove" onClick={() => removeVenue(i)} aria-label={`Remove ${v.name}`}>×</button>
              </li>
            ))}
          </ul>
        )}
        {suggestions.length > 0 && (
          <>
            <p className="hint dim">Suggestions for your area — tap to add:</p>
            <ul className="town-list">
              {suggestions.map((s) => (
                <li key={s.url}>
                  <span>
                    {s.name} <span className="venue-town">({s.city}, {s.state})</span>
                  </span>
                  <button className="btn small" onClick={() => addVenue(s)}>+ Add</button>
                </li>
              ))}
            </ul>
          </>
        )}
        {tmCovered.length > 0 && (
          <p className="hint dim">
            Already included with your listings key (no need to add):{' '}
            {tmCovered.join(', ')}.
          </p>
        )}
        <p className="hint dim">
          Add any other venue — anywhere — by pasting the web address of its
          events page. Many sites work; if one can't be read, the calendar
          will say so.
        </p>
        <form className="venue-add" onSubmit={addManualVenue}>
          <input value={vName} onChange={(e) => setVName(e.target.value)} placeholder="Venue name" aria-label="Venue name" />
          <input value={vUrl} onChange={(e) => setVUrl(e.target.value)} placeholder="Events page address (https://…)" aria-label="Events page address" />
          <div className="venue-add-row">
            <input value={vCity} onChange={(e) => setVCity(e.target.value)} placeholder="Town" aria-label="Venue town" />
            <select value={vState} onChange={(e) => setVState(e.target.value)} aria-label="Venue state">
              <option value="">State…</option>
              {STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button className="btn" type="submit">Add</button>
          </div>
        </form>
      </section>

      <section className={`panel${focusKey ? ' highlight' : ''}`} ref={keyPanelRef}>
        <h2>Event data key</h2>
        <p className="hint">
          Real concert listings come from Ticketmaster. It's free — takes about two minutes:
        </p>
        <ol className="hint steps">
          <li>
            <a href="https://developer-account.ticketmaster.com/user/register" target="_blank" rel="noopener noreferrer">
              Create your free Ticketmaster account here
            </a>{' '}
            (for "Company" you can just put <b>GigCal</b>).
          </li>
          <li>Once you're signed in, your account page lists an app with a <b>Consumer Key</b> — a long string of letters and numbers.</li>
          <li>Copy that key and paste it below.</li>
        </ol>
        <p className="hint dim">
          One key is all you need — it works the same on iPhone, Android, and this
          computer. Ignore any pages about "SDKs" or choosing iOS/Android; those are
          for ticketing companies, not for GigCal.
        </p>
        <form className="key-form" onSubmit={saveKey}>
          <input
            className="mono"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="Paste your key here"
            aria-label="Event data key"
          />
          <button className="btn" type="submit">{savedFlash ? 'Saved ✓' : 'Save key'}</button>
        </form>
        <p className="hint dim">
          The key is stored only on this device and sent only to Ticketmaster.
          Until you add one, the calendar shows made-up sample shows.
        </p>
      </section>

      <section className="panel">
        <h2>Fresh listings</h2>
        <p className="hint">Listings refresh on their own every few hours. Use this if you want to re-check right now.</p>
        <button className="btn" onClick={onRefresh}>Re-check for new shows</button>
      </section>

      {phoneUrl && (
        <section className="panel">
          <h2>On your phone</h2>
          <p className="hint">
            On the same Wi-Fi, open this address in your phone's browser, then use
            "Add to Home Screen" to keep it like an app:
          </p>
          <div className="phone-url mono">{phoneUrl}</div>
        </section>
      )}

      <section className="panel">
        <h2>Get the Android app</h2>
        <p className="hint">
          For an Android phone or tablet, there's a downloadable app version with
          its own icon on your home screen — no browser needed.
        </p>
        <p className="hint dim">
          It's not on the Play Store, so Android will ask once to allow installs
          from outside the store. That's expected — just allow it and continue.
        </p>
        <a
          className="btn"
          href="https://github.com/RodSteelton/gigcal/releases/download/android-v1/app-release-signed.apk"
        >
          Download for Android
        </a>
      </section>
    </div>
  )
}
