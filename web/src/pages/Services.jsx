import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE } from '../api/client.js'

const POPULAR_CATEGORIES = [
  { label: '🔧 Plumber', q: 'plumber' },
  { label: '⚡ Electrician', q: 'electrician' },
  { label: '🚗 Mechanic', q: 'auto mechanic' },
  { label: '🧹 Cleaner', q: 'house cleaner' },
  { label: '🌱 Lawn Care', q: 'lawn care service' },
  { label: '❄️ HVAC', q: 'hvac repair' },
  { label: '📚 Tutor', q: 'private tutor' },
  { label: '🐶 Dog Walker', q: 'dog walker' },
  { label: '🚚 Movers', q: 'moving service' },
  { label: '💇 Hair Salon', q: 'hair salon' },
  { label: '💆 Massage', q: 'massage therapy' },
  { label: '🔨 Handyman', q: 'handyman' }
]

const card = {
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16,
  background: 'rgba(40,28,70,0.6)', backdropFilter: 'blur(14px) saturate(160%)',
  WebkitBackdropFilter: 'blur(14px) saturate(160%)',
  color: '#f7f5ff',
  display: 'flex', flexDirection: 'column', gap: 8, transition: 'all 0.2s'
}

export default function Services() {
  const [query, setQuery] = useState('plumber')
  const [coords, setCoords] = useState(null)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState(null)
  const [radiusKm, setRadiusKm] = useState(10)
  const [maxPrice, setMaxPrice] = useState('')
  const [minRating, setMinRating] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState([])
  const [meta, setMeta] = useState(null)
  const [compareIds, setCompareIds] = useState([])
  const [favorites, setFavorites] = useState({})
  const [enriched, setEnriched] = useState({}) // placeId -> provider doc
  const [enriching, setEnriching] = useState({}) // placeId -> bool
  const token = (typeof window !== 'undefined') ? localStorage.getItem('accessToken') : null

  const compareList = useMemo(
    () => results.filter(r => compareIds.includes(r.placeId || r.name)),
    [results, compareIds]
  )

  const requestLocation = () => {
    if (!navigator.geolocation) { setLocError('Geolocation not supported'); return }
    setLocating(true); setLocError(null)
    navigator.geolocation.getCurrentPosition(
      pos => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false) },
      err => { setLocError(err.message || 'Location denied'); setLocating(false) },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    )
  }

  useEffect(() => { requestLocation() }, [])

  useEffect(() => {
    if (!token) return
    fetch(`${API_BASE}/api/services/favorites`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        if (d?.ok) {
          const map = {}
          d.favorites.forEach(f => { if (f.provider?.placeId) map[f.provider.placeId] = f._id })
          setFavorites(map)
        }
      }).catch(() => {})
  }, [token])

  const search = async () => {
    if (!query.trim()) return
    setLoading(true); setError(null); setCompareIds([])
    try {
      const params = new URLSearchParams({ q: query.trim(), radiusKm: String(radiusKm) })
      if (coords) { params.set('lat', String(coords.lat)); params.set('lng', String(coords.lng)) }
      if (maxPrice) params.set('maxPrice', String(maxPrice))
      if (minRating > 0) params.set('minRating', String(minRating))
      const res = await fetch(`${API_BASE}/api/services/search?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Search failed')
      setResults(data.providers || [])
      setMeta(data.meta || null)
    } catch (e) {
      setError(e.message); setResults([])
    } finally { setLoading(false) }
  }

  const trackClick = async (p) => {
    fetch(`${API_BASE}/api/services/track-click`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ placeId: p.placeId, name: p.name, category: query })
    }).catch(() => {})
  }

  const toggleFav = async (p) => {
    if (!token) { alert('Please log in to save favorites.'); return }
    const key = p.placeId
    if (favorites[key]) {
      await fetch(`${API_BASE}/api/services/favorite/${favorites[key]}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      })
      setFavorites(f => { const n = { ...f }; delete n[key]; return n })
    } else {
      const res = await fetch(`${API_BASE}/api/services/favorite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: p })
      })
      const d = await res.json()
      if (d.ok) setFavorites(f => ({ ...f, [key]: d.favorite._id }))
    }
  }

  const toggleCompare = (p) => {
    const id = p.placeId || p.name
    setCompareIds(c => c.includes(id) ? c.filter(x => x !== id) : (c.length >= 4 ? c : [...c, id]))
  }

  const loadDetails = async (p) => {
    const key = p.placeId || p.name
    if (enriched[key] || enriching[key]) return
    setEnriching(s => ({ ...s, [key]: true }))
    try {
      const res = await fetch(`${API_BASE}/api/services/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ placeId: p.placeId, name: p.name, address: p.address })
      })
      const d = await res.json()
      if (d.ok && d.provider) setEnriched(s => ({ ...s, [key]: d.provider }))
      else setEnriched(s => ({ ...s, [key]: { error: d.error || 'failed' } }))
    } catch (e) {
      setEnriched(s => ({ ...s, [key]: { error: e.message } }))
    } finally {
      setEnriching(s => ({ ...s, [key]: false }))
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 36, fontWeight: 700, marginBottom: 6, background: 'linear-gradient(135deg, oklch(68% .22 295), oklch(78% .18 320), oklch(82% .16 200))', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent', letterSpacing: '-0.02em' }}>🔍 Find Local Services</h1>
      <p style={{ color: 'var(--muted-foreground)', marginBottom: 24 }}>Plumbers, electricians, tutors, mechanics, cleaners — compared by price, rating & distance.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {POPULAR_CATEGORIES.map(c => (
          <button key={c.q} onClick={() => { setQuery(c.q); setTimeout(search, 50) }}
            style={{
              padding: '8px 14px', borderRadius: 999,
              border: query === c.q ? '1px solid transparent' : '1px solid rgba(255,255,255,0.08)',
              background: query === c.q ? 'linear-gradient(135deg, oklch(68% .22 295), oklch(78% .18 320), oklch(82% .16 200))' : 'rgba(255,255,255,0.06)',
              color: query === c.q ? '#fff' : '#f7f5ff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              backdropFilter: 'blur(8px)'
            }}>{c.label}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10, marginBottom: 14, alignItems: 'end' }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)' }}>Service / Query</label>
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="e.g. plumber, math tutor, honda mechanic"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.1)', color: '#f7f5ff', fontSize: 14 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)' }}>Radius</label>
          <select value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.1)', color: '#f7f5ff', fontSize: 14 }}>
            <option value={5}>Within 5 km</option>
            <option value={10}>Within 10 km</option>
            <option value={25}>Within 25 km</option>
            <option value={50}>Within 50 km</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)' }}>Max Price ($)</label>
          <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="any"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.1)', color: '#f7f5ff', fontSize: 14 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)' }}>Min Rating</label>
          <select value={minRating} onChange={e => setMinRating(Number(e.target.value))}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.1)', color: '#f7f5ff', fontSize: 14 }}>
            <option value={0}>Any</option>
            <option value={3}>3.0+ ⭐</option>
            <option value={3.5}>3.5+ ⭐</option>
            <option value={4}>4.0+ ⭐</option>
            <option value={4.5}>4.5+ ⭐</option>
          </select>
        </div>
        <button onClick={search} disabled={loading}
          style={{
            padding: '11px 22px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, oklch(68% .22 295), oklch(78% .18 320), oklch(82% .16 200))',
            color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14,
            boxShadow: '0 20px 60px -20px oklch(68% .22 295 / .55)'
          }}>{loading ? 'Searching…' : 'Search'}</button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 18 }}>
        {coords
          ? <>📍 Using your location ({coords.lat.toFixed(3)}, {coords.lng.toFixed(3)}) <button onClick={requestLocation} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'oklch(82% .16 200)', cursor: 'pointer', fontWeight: 600 }}>refresh</button></>
          : locating ? '📍 Detecting location…'
          : <>📍 Location not set. <button onClick={requestLocation} style={{ background: 'none', border: 'none', color: 'oklch(82% .16 200)', cursor: 'pointer', fontWeight: 600 }}>Use my location</button> {locError && <span style={{ color: 'oklch(80% .2 25)' }}>({locError})</span>}</>}
      </div>

      {error && <div style={{ padding: 14, background: 'oklch(65% .22 25 / .15)', border: '1px solid oklch(65% .22 25 / .35)', borderRadius: 10, color: 'oklch(82% .2 25)', marginBottom: 16 }}>⚠️ {error}</div>}

      {compareList.length >= 2 && (
        <div style={{ marginBottom: 24, padding: 16, background: 'oklch(68% .22 295 / .12)', border: '1px solid oklch(68% .22 295 / .3)', borderRadius: 14, backdropFilter: 'blur(12px)' }}>
          <div style={{ fontWeight: 800, marginBottom: 10, color: '#f7f5ff' }}>Side-by-side comparison ({compareList.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${compareList.length}, 1fr)`, gap: 12 }}>
            {compareList.map(p => (
              <div key={p.placeId || p.name} style={{ ...card, fontSize: 13 }}>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div>⭐ {p.rating ? `${p.rating} (${p.reviewsCount || 0})` : '—'}</div>
                <div>💰 {p.price || (p.priceValue ? `~$${p.priceValue}/hr (est.)` : '—')}</div>
                <div>📍 {p.distanceKm != null ? `${p.distanceKm.toFixed(1)} km` : (p.address || '—')}</div>
                <div>📞 {p.phone || '—'}</div>
                <button onClick={() => toggleCompare(p)} style={{ marginTop: 6, background: 'rgba(255,255,255,0.06)', color: '#f7f5ff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 12 }}>
          {results.length} provider{results.length !== 1 ? 's' : ''} for <strong style={{ color: '#f7f5ff' }}>{meta?.query}</strong>
          {meta?.lat && <> within <strong style={{ color: '#f7f5ff' }}>{meta.radiusKm} km</strong></>}
        </div>
      )}

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {results.map(p => {
          const id = p.placeId || p.name
          const isFav = !!favorites[p.placeId]
          const inCompare = compareIds.includes(id)
          return (
            <div key={id} style={{ ...card, borderColor: inCompare ? 'oklch(68% .22 295 / .6)' : 'rgba(255,255,255,0.08)', boxShadow: inCompare ? '0 20px 60px -20px oklch(68% .22 295 / .55)' : '0 10px 30px -12px rgba(0,0,0,0.5)' }}>
              {p.thumbnail && <img src={p.thumbnail} alt={p.name} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 10 }} />}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#f7f5ff', fontFamily: "'Space Grotesk', sans-serif" }}>{p.name}</div>
                <button onClick={() => toggleFav(p)} title={isFav ? 'Unfavorite' : 'Save'} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22 }}>{isFav ? '❤️' : '🤍'}</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 13, color: '#f7f5ff' }}>
                {p.rating && <span>⭐ <strong>{p.rating}</strong> ({p.reviewsCount || 0})</span>}
                {(p.price || p.priceValue) && <span style={{ color: 'oklch(80% .18 155)', fontWeight: 700 }}>{p.price || `~$${p.priceValue}/hr`}</span>}
                {p.distanceKm != null && <span>📍 {p.distanceKm.toFixed(1)} km</span>}
              </div>
              {p.address && <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{p.address}</div>}
              {p.description && <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.4 }}>{p.description}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                {p.phone && <a href={`tel:${p.phone}`} onClick={() => trackClick(p)} style={{ flex: 1, padding: '8px 10px', background: 'linear-gradient(135deg, oklch(68% .22 295), oklch(78% .18 320), oklch(82% .16 200))', color: '#fff', textAlign: 'center', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>📞 Call</a>}
                {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer" onClick={() => trackClick(p)} style={{ flex: 1, padding: '8px 10px', background: 'rgba(255,255,255,0.06)', color: '#f7f5ff', textAlign: 'center', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13, border: '1px solid rgba(255,255,255,0.12)' }}>🌐 Website</a>}
                {p.mapsUrl && <a href={p.mapsUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackClick(p)} style={{ flex: 1, padding: '8px 10px', background: 'rgba(255,255,255,0.06)', color: '#f7f5ff', textAlign: 'center', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13, border: '1px solid rgba(255,255,255,0.12)' }}>📍 Map</a>}
              </div>
              <button onClick={() => toggleCompare(p)} style={{ marginTop: 4, background: inCompare ? 'linear-gradient(135deg, oklch(68% .22 295), oklch(78% .18 320))' : 'transparent', color: inCompare ? '#fff' : 'oklch(82% .16 200)', border: '1px solid oklch(68% .22 295 / .5)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                {inCompare ? '✓ Added to compare' : '+ Compare'}
              </button>
              {!enriched[id] && (
                <button onClick={() => loadDetails(p)} disabled={enriching[id]}
                  style={{ marginTop: 4, background: 'rgba(255,255,255,0.06)', color: '#f7f5ff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                  {enriching[id] ? '⏳ Loading reviews & photos…' : '🔎 Load full details (reviews · photos · hours)'}
                </button>
              )}
              {enriched[id] && enriched[id].error && (
                <div style={{ fontSize: 11, color: 'oklch(80% .2 25)', marginTop: 4 }}>Couldn't enrich: {enriched[id].error}</div>
              )}
              {enriched[id] && !enriched[id].error && <EnrichedDetails p={enriched[id]} />}
            </div>
          )
        })}
      </div>

      {!loading && !error && results.length === 0 && meta && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted-foreground)' }}>
          No providers found for "{meta.query}". Try widening the radius or removing filters.
        </div>
      )}
    </div>
  )
}

function EnrichedDetails({ p }) {
  const ai = p.aiReviewSummary
  const photos = (p.photos || []).slice(0, 6)
  const reviews = (p.reviewsText || []).slice(0, 4)
  const hoursEntries = p.openingHours && Array.isArray(p.openingHours) ? p.openingHours
    : (p.openingHours && typeof p.openingHours === 'object' ? Object.entries(p.openingHours).map(([day, hours]) => ({ day, hours })) : [])
  return (
    <div style={{ marginTop: 6, padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px dashed rgba(255,255,255,0.12)', display: 'grid', gap: 10 }}>
      {photos.length > 0 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {photos.map((u, i) => <img key={i} src={u} alt="" style={{ width: 100, height: 80, objectFit: 'cover', borderRadius: 8, flex: '0 0 auto' }} />)}
        </div>
      )}
      {ai && (ai.summary || (ai.pros || []).length || (ai.cons || []).length) && (
        <div style={{ background: 'oklch(68% .22 295 / .12)', padding: 10, borderRadius: 8, border: '1px solid oklch(68% .22 295 / .3)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'oklch(82% .18 295)', marginBottom: 4, letterSpacing: '0.05em' }}>🤖 AI REVIEW SUMMARY</div>
          {ai.summary && <div style={{ fontSize: 13, marginBottom: 6, color: '#f7f5ff' }}>{ai.summary}</div>}
          {(ai.pros || []).length > 0 && <div style={{ fontSize: 12, color: 'oklch(82% .18 155)' }}>👍 {ai.pros.join(' · ')}</div>}
          {(ai.cons || []).length > 0 && <div style={{ fontSize: 12, color: 'oklch(80% .2 25)' }}>👎 {ai.cons.join(' · ')}</div>}
        </div>
      )}
      {hoursEntries.length > 0 && (
        <div style={{ fontSize: 12, color: '#f7f5ff' }}>
          <strong>🕐 Hours:</strong>{' '}
          {hoursEntries.slice(0, 7).map((h, i) => (
            <span key={i} style={{ marginRight: 8, color: 'var(--muted-foreground)' }}>{h.day}: {Array.isArray(h.hours) ? h.hours.join(', ') : h.hours}</span>
          ))}
        </div>
      )}
      {p.email && <div style={{ fontSize: 12, color: '#f7f5ff' }}>📧 <a href={`mailto:${p.email}`} style={{ color: 'oklch(82% .16 200)' }}>{p.email}</a></div>}
      {p.socials && (p.socials.facebook || p.socials.instagram) && (
        <div style={{ fontSize: 12, display: 'flex', gap: 10 }}>
          {p.socials.facebook && <a href={p.socials.facebook} target="_blank" rel="noopener noreferrer" style={{ color: 'oklch(82% .16 200)' }}>Facebook</a>}
          {p.socials.instagram && <a href={p.socials.instagram} target="_blank" rel="noopener noreferrer" style={{ color: 'oklch(82% .16 200)' }}>Instagram</a>}
          {p.socials.linkedin && <a href={p.socials.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: 'oklch(82% .16 200)' }}>LinkedIn</a>}
        </div>
      )}
      {reviews.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', letterSpacing: '0.05em' }}>RECENT REVIEWS</div>
          {reviews.map((r, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.04)', padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', fontSize: 12 }}>
              <div style={{ fontWeight: 600, color: '#f7f5ff' }}>{r.name || 'Anonymous'} {r.stars ? `· ${'⭐'.repeat(Math.round(r.stars))}` : ''}</div>
              <div style={{ color: 'var(--muted-foreground)', lineHeight: 1.4 }}>{(r.text || '').slice(0, 280)}{(r.text || '').length > 280 ? '…' : ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
