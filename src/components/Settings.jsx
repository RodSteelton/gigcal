import React, { useEffect, useState } from 'react'

const STATES = 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' ')

export default function Settings({ settings, onChange, onBack, onRefresh }) {
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
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
    const s = state.trim().toUpperCase()
    if (!c) return
    const exists = settings.towns.some(
      (t) => t.city.toLowerCase() === c.toLowerCase() && (t.state || '') === s
    )
    if (!exists) {
      onChange({ ...settings, towns: [...settings.towns, { city: c, state: s }] })
    }
    setCity('')
    setState('')
  }

  function removeTown(idx) {
    onChange({ ...settings, towns: settings.towns.filter((_, i) => i !== idx) })
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
        {settings.towns.length === 0 && <p className="hint dim">No towns yet — add one below.</p>}
        <ul className="town-list">
          {settings.towns.map((t, i) => (
            <li key={i}>
              <span>{t.city}{t.state ? `, ${t.state}` : ''}</span>
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
          <select value={state} onChange={(e) => setState(e.target.value)} aria-label="State">
            <option value="">State…</option>
            {STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button className="btn" type="submit">Add</button>
        </form>
      </section>

      <section className="panel">
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
    </div>
  )
}
