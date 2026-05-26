import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { searchServices, enrichProvider, trackProviderClick, resolveUserLocation } from '../api/services'
import './Services.css'

const API = import.meta.env.VITE_API_URL || ''

const CATEGORIES = [
  'Auto Repair','Catering','Cleaning','Electrical','HVAC','IT Support',
  'Landscaping','Moving','Painting','Personal Training','Pest Control',
  'Photography','Plumbing','Roofing','Tutoring'
]

const TRENDING = ['Plumber','Tutor','Electrician','House cleaner','Dog walker','Massage','Mechanic']

function Stars({ r }) {
  return (
    <span className="sv-stars" aria-label={`Rating ${r}`}>
      <span className="sv-star">★</span>
      <span>{Number(r).toFixed(1)}</span>
    </span>
  )
}

function initialOf(p) { return (p.name || '?').trim().charAt(0).toUpperCase() }
function shortAddr(p) { return p.address || p.addr || p.city || '' }
function priceLabel(p) {
  if (p.priceValue) return `from $${p.priceValue}`
  if (p.price && typeof p.price === 'string') return p.price
  if (p.price) return `$${p.price}`
  return ''
}
function distLabel(p) {
  if (typeof p.distanceKm === 'number') return `${p.distanceKm.toFixed(1)} km`
  if (typeof p.dist === 'number') return `${p.dist.toFixed(1)} km`
  return ''
}

function PreferredCard({ p }) {
  return (
    <div className="sv-pref-card">
      <div className="sv-pref-badge">PREFERRED</div>
      <div className="sv-pref-head">
        {p.thumbnail
          ? <img className="sv-avatar img" src={p.thumbnail} alt="" />
          : <div className="sv-avatar">{initialOf(p)}</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sv-pref-name" title={p.name}>{p.name}</div>
          <div className="sv-pref-addr">{shortAddr(p)}</div>
        </div>
      </div>
      <div className="sv-pref-meta">
        {priceLabel(p) && <span className="sv-price">{priceLabel(p)}</span>}
        {p.rating != null && <Stars r={p.rating} />}
        {p.reviewsCount != null && <span className="sv-reviews">({p.reviewsCount})</span>}
        <span className="sv-verified">✓ VERIFIED</span>
      </div>
      {(p.description || p.blurb) && <p className="sv-pref-blurb">{p.description || p.blurb}</p>}
    </div>
  )
}

function ProviderRow({ p, onEnrich, enriching }) {
  const phoneHref = p.phone ? `tel:${String(p.phone).replace(/[^\d+]/g,'')}` : null
  const mapsHref = p.mapsUrl ||
    (p.lat && p.lng ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` :
     p.name ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + ' ' + (p.address||''))}` : null)
  const isEnriching = enriching === (p.placeId || p.name)
  return (
    <div className="sv-row">
      <div className="sv-row-left">
        {p.thumbnail
          ? <img className="sv-avatar lg img" src={p.thumbnail} alt="" />
          : <div className="sv-avatar lg">{initialOf(p)}</div>}
        <div className="sv-row-body">
          <div className="sv-row-name">{p.name} {p.category && <span className="sv-row-cat">{p.category}</span>}</div>
          {(p.description || p.blurb) && <div className="sv-row-blurb">{p.description || p.blurb}</div>}
          <div className="sv-row-meta">
            {p.rating != null && <Stars r={p.rating} />}
            {p.reviewsCount != null && <span className="sv-reviews">({p.reviewsCount})</span>}
            {distLabel(p) && <span className="sv-dist">{distLabel(p)}</span>}
            {priceLabel(p) && <span className="sv-from">{priceLabel(p)}</span>}
          </div>
          <div className="sv-row-city">{shortAddr(p)}</div>
        </div>
      </div>
      <div className="sv-row-actions">
        {p.website
          ? <a href={p.website} target="_blank" rel="noopener noreferrer"
               onClick={() => trackProviderClick({ providerId: p.placeId, placeId: p.placeId, name: p.name, category: p.category, type: 'service_click' })}
               className="sv-btn primary">View &amp; Buy</a>
          : mapsHref && <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="sv-btn primary">View on Maps</a>}
        {phoneHref && <a href={phoneHref} className="sv-btn ghost">📞 Call</a>}
        {onEnrich && (
          <button className="sv-btn ghost" disabled={isEnriching} onClick={() => onEnrich(p)}>
            {isEnriching ? '… Loading' : '✨ Details'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Services() {
  const [cat, setCat] = useState('All')
  const [view, setView] = useState('list')
  const [q, setQ] = useState('')
  const [budget, setBudget] = useState('')
  const [sort, setSort] = useState('rating')
  const [quick, setQuick] = useState(null) // 'budget' | 'top' | 'close'
  const [radiusKm, setRadiusKm] = useState(25)

  // Live backend state
  const [geo, setGeo] = useState({ lat: null, lng: null, city: '', source: 'none' })
  const [providers, setProviders] = useState([])     // real, fetched from SerpAPI Google Maps
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [enriching, setEnriching] = useState(null)   // placeId being enriched
  const [enriched, setEnriched] = useState(null)     // last enrichment result
  const debounceRef = useRef(null)

  // Resolve user location once on mount (GPS → fallback to IP)
  useEffect(() => {
    let cancelled = false
    resolveUserLocation().then(g => { if (!cancelled) setGeo(g) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // The effective query: typed search OR the selected category OR a sensible default
  const effectiveQuery = useMemo(() => {
    const typed = q.trim()
    if (typed) return typed
    if (cat && cat !== 'All') return cat.toLowerCase()
    return 'local services'
  }, [q, cat])

  // Fire backend search (debounced) whenever inputs change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true); setError('')
      try {
        const maxPrice = parseFloat(budget) || (quick === 'budget' ? 50 : undefined)
        const minRating = quick === 'top' ? 4.5 : undefined
        const data = await searchServices({
          query: effectiveQuery,
          lat: geo.lat ?? undefined,
          lng: geo.lng ?? undefined,
          radiusKm,
          maxPrice,
          minRating,
          limit: 25
        })
        if (!data.ok) {
          setError(data.message || data.error || 'Search failed')
          setProviders([])
        } else {
          setProviders(data.providers || [])
        }
      } catch (e) {
        setError(e.message || 'Network error')
        setProviders([])
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => debounceRef.current && clearTimeout(debounceRef.current)
  }, [effectiveQuery, geo.lat, geo.lng, radiusKm, budget, quick])

  // Local sort + quick-distance toggle (data is already filtered server-side)
  const sortedByRating = useMemo(() => {
    const arr = [...providers]
    const dist = p => (typeof p.distanceKm === 'number' ? p.distanceKm : Infinity)
    const priceN = p => (typeof p.priceValue === 'number' ? p.priceValue : Infinity)
    if (sort === 'price-asc') arr.sort((a, b) => priceN(a) - priceN(b))
    else if (sort === 'price-desc') arr.sort((a, b) => priceN(b) - priceN(a))
    else if (sort === 'distance' || quick === 'close') arr.sort((a, b) => dist(a) - dist(b))
    else arr.sort((a, b) => (b.rating || 0) - (a.rating || 0))
    return arr
  }, [providers, sort, quick])

  // Group one preferred (highest-rated) provider per category for the Preferred section
  const preferredByCat = useMemo(() => {
    const map = {}
    const sorted = [...providers].sort((a, b) => (b.rating || 0) - (a.rating || 0))
    for (const p of sorted) {
      const key = p.category || cat
      if (key && !map[key]) map[key] = p
    }
    return map
  }, [providers, cat])

  // Enrich a provider via Apify (Google Places full data: photos, reviews, hours, socials)
  async function handleEnrich(prov) {
    if (!prov) return
    setEnriching(prov.placeId || prov.name)
    try {
      const r = await enrichProvider({
        placeId: prov.placeId,
        name: prov.name,
        address: prov.address
      })
      setEnriched(r)
    } catch (e) {
      setEnriched({ ok: false, error: e.message })
    } finally {
      setEnriching(null)
    }
  }
  return (
    <div className="sv-page">
      <div className="sv-bg" />

      <section className="container sv-hero-v2">
        <div className="sv-util-row">
          <Link to="/vendor" className="sv-util-link">🏪 For Vendors</Link>
          <span className="sv-util-dot">·</span>
          <Link to="/promote" className="sv-util-link">📣 Promote My Listing</Link>
          <span className="sv-util-dot">·</span>
          <Link to="/vendor" className="sv-util-link">🚀 Join the PriceKlick Network</Link>
        </div>

        <div className="sv-hero-center">
          <h1 className="sv-brand-title">PriceKlick</h1>
          <p className="sv-brand-sub">Scroll less, save more.</p>
          <Link to="/smart-compare" className="sv-compare-btn">
            <span className="sv-compare-icon">✨</span>
            <span className="sv-compare-label">Smart Compare Advisor</span>
            <span className="sv-compare-sep">—</span>
            <span className="sv-compare-hint">describe anything, get a full comparison</span>
          </Link>
        </div>

        <div className="sv-hero-grid">
          <div className="sv-hero-left">
            <div className="sv-search-wrap">
              <span className="sv-search-icon" aria-hidden>🔍</span>
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search plumber, electrician, tutor, cleaner..."
                className="sv-search-input"
              />
            </div>

            <div className="sv-chips">
              <button className={`sv-chip ${cat==='All' ? 'active' : ''}`} onClick={()=>setCat('All')}>All</button>
              {CATEGORIES.map(c => (
                <button key={c} className={`sv-chip ${cat===c ? 'active' : ''}`} onClick={()=>setCat(c)}>{c}</button>
              ))}
            </div>

            <div className="sv-filter-bar">
              <div className="sv-filter-cell"><span>⦾</span> Near me</div>
              <div className="sv-filter-cell">
                <span>Within</span>
                <select className="sv-filter-select" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))}>
                  <option value="5">5 km</option>
                  <option value="10">10 km</option>
                  <option value="25">25 km</option>
                  <option value="50">50 km</option>
                </select>
              </div>
              <div className="sv-filter-cell">
                <span>$</span>
                <input
                  type="number"
                  className="sv-filter-input"
                  placeholder="Max budget"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  min="0"
                />
              </div>
              <div className="sv-filter-cell">
                <span>≅</span>
                <select className="sv-filter-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="rating">Top Rated</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="distance">Closest First</option>
                </select>
              </div>
              <div className="sv-filter-view">
                <button className={`sv-control ${view==='list' ? 'active' : ''}`} onClick={()=>setView('list')}>☰ List</button>
                <button className={`sv-control ${view==='map' ? 'active' : ''}`} onClick={()=>setView('map')}>🗺 Map</button>
              </div>
            </div>
          </div>

          <aside className="sv-hero-trend">
            <div className="sv-trend-head">🔥 <span>Trending near you</span></div>
            <div className="sv-trending">
              {TRENDING.map(t => (
                <button key={t} className="sv-trend" onClick={() => setQ(t)}>{t}</button>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="container sv-section">
        <div className="sv-section-head">
          <span className="sv-tag">✦ TRUSTED PARTNERS</span>
          <h2>PriceKlick Preferred Vendors</h2>
          <p>Top-rated, verified providers in <strong>{geo.city || 'your area'}</strong> {geo.source !== 'none' ? `(· ${geo.source.toUpperCase()})` : ''}.</p>
        </div>

        {cat === 'All' ? (
          <div className="sv-pref-grid">
            {CATEGORIES.map(c => (
              <button key={c} className="sv-pref-col sv-pref-cta" onClick={() => setCat(c)}>
                <div className="sv-pref-cat">{c}</div>
                <div className="sv-pref-hint">Tap to find top-rated {c.toLowerCase()} near you</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="sv-pref-grid">
            {sortedByRating.slice(0, 6).map(p => (
              <div key={p.placeId || p.name} className="sv-pref-col">
                <div className="sv-pref-cat">{cat}</div>
                <PreferredCard p={p} />
              </div>
            ))}
            {sortedByRating.length === 0 && !loading && (
              <div className="sv-pref-col" style={{ gridColumn: '1 / -1' }}>
                <div className="sv-empty">
                  <div className="sv-empty-icon">🔍</div>
                  <h3>No {cat.toLowerCase()} providers found nearby</h3>
                  <p>Try a different category or widen the radius.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="container sv-section sv-providers">
        <div className="sv-providers-grid">
          <div>
            <div className="sv-providers-head">
              <h2>All Providers</h2>
              <span className="sv-count">
                {loading ? 'Searching…' :
                  `${sortedByRating.length} ${sortedByRating.length === 1 ? 'provider' : 'providers'} found within ${radiusKm} km`}
              </span>
            </div>
            {error && (
              <div className="sv-empty" style={{ borderColor: 'oklch(70% .18 25 / .4)' }}>
                <div className="sv-empty-icon">⚠️</div>
                <h3>Search failed</h3>
                <p>{error}</p>
              </div>
            )}
            {!error && sortedByRating.length === 0 && !loading ? (
              <div className="sv-empty">
                <div className="sv-empty-icon">🔍</div>
                <h3>No providers found</h3>
                <p>Try adjusting your filters.</p>
                <button className="sv-btn ghost" onClick={() => { setCat('All'); setQ(''); setBudget(''); setQuick(null); setRadiusKm(25); }}>
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="sv-rows">
                {sortedByRating.map(p => (
                  <ProviderRow key={p.placeId || p.name} p={p} onEnrich={handleEnrich} enriching={enriching} />
                ))}
              </div>
            )}
          </div>
          <aside className="sv-side">
            <aside className="sv-hero-trend sv-side-trend">
              <div className="sv-trend-head">🔥 <span>Trending near you</span></div>
              <div className="sv-trending">
                {TRENDING.map(t => (
                  <button key={t} className="sv-trend" onClick={() => setQ(t)}>{t}</button>
                ))}
              </div>
            </aside>

            <div className="sv-side-card sv-quick">
              <div className="sv-tag-mini">QUICK FILTERS</div>
              <button className={`sv-quick-card ${quick==='budget' ? 'active' : ''}`} onClick={() => setQuick(quick==='budget' ? null : 'budget')}>
                <span className="sv-quick-ic" style={{background:'oklch(74% .18 155 / .15)', color:'oklch(70% .18 155)'}}>$</span>
                <span className="sv-quick-body"><strong>Under $50</strong></span>
                <span className="sv-quick-meta">Budget</span>
              </button>
              <button className={`sv-quick-card ${quick==='top' ? 'active' : ''}`} onClick={() => setQuick(quick==='top' ? null : 'top')}>
                <span className="sv-quick-ic" style={{background:'oklch(85% .15 90 / .2)', color:'oklch(70% .15 80)'}}>★</span>
                <span className="sv-quick-body"><strong>Top rated</strong></span>
                <span className="sv-quick-meta">4.5+</span>
              </button>
              <button className={`sv-quick-card ${quick==='close' ? 'active' : ''}`} onClick={() => setQuick(quick==='close' ? null : 'close')}>
                <span className="sv-quick-ic" style={{background:'oklch(82% .16 200 / .2)', color:'oklch(70% .16 200)'}}>◷</span>
                <span className="sv-quick-body"><strong>Closest first</strong></span>
                <span className="sv-quick-meta">Distance</span>
              </button>
            </div>

            {sortedByRating[0] && (
              <div className="sv-side-card sv-deal">
                <div className="sv-tag-mini">📈 TOP RATED NEARBY</div>
                <div className="sv-deal-row">
                  {sortedByRating[0].rating != null && <Stars r={sortedByRating[0].rating} />}
                </div>
                <div className="sv-deal-name">
                  {sortedByRating[0].thumbnail
                    ? <img className="sv-avatar img" src={sortedByRating[0].thumbnail} alt="" />
                    : <div className="sv-avatar">{initialOf(sortedByRating[0])}</div>}
                  <div style={{ minWidth: 0 }}>
                    <div className="sv-pref-name" title={sortedByRating[0].name}>{sortedByRating[0].name}</div>
                    <div className="sv-pref-addr">{shortAddr(sortedByRating[0])}</div>
                  </div>
                </div>
                <div className="sv-deal-foot">
                  {priceLabel(sortedByRating[0]) && <span className="sv-from">{priceLabel(sortedByRating[0])}</span>}
                  <span className="sv-verified">✓ Verified</span>
                </div>
              </div>
            )}

            <div className="sv-side-card sv-vendors-cta">
              <div className="sv-tag-mini">📣 FOR VENDORS</div>
              <h3>Grow your business with us</h3>
              <p>Reach thousands of local customers actively searching for your services.</p>
              <Link to="/vendor" className="sv-btn primary block">Get started — Free</Link>
            </div>
          </aside>
        </div>
      </section>

      {enriched && (
        <div className="sv-modal" role="dialog" aria-modal="true" onClick={() => setEnriched(null)}>
          <div className="sv-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="sv-modal-close" onClick={() => setEnriched(null)} aria-label="Close">✕</button>
            {!enriched.ok ? (
              <div style={{ padding: 24 }}>
                <h3>Couldn't load extra details</h3>
                <p style={{ color: 'var(--muted-foreground)' }}>{enriched.error || enriched.message || 'Unknown error.'}</p>
                <p style={{ fontSize: 13, opacity: .75 }}>Tip: set <code>APIFY_TOKEN</code> in <code>server/.env</code> to enable Google Places enrichment (photos, hours, reviews).</p>
              </div>
            ) : (
              <div className="sv-modal-body">
                <h3>{enriched.provider?.name || enriched.name}</h3>
                <p className="sv-pref-addr">{enriched.provider?.address}</p>
                <div className="sv-pref-meta" style={{ margin: '10px 0' }}>
                  {enriched.provider?.rating != null && <Stars r={enriched.provider.rating} />}
                  {enriched.provider?.reviewsCount != null && <span className="sv-reviews">({enriched.provider.reviewsCount} reviews)</span>}
                  {enriched.provider?.phone && <a href={`tel:${enriched.provider.phone}`} className="sv-btn ghost">📞 {enriched.provider.phone}</a>}
                  {enriched.provider?.website && <a href={enriched.provider.website} target="_blank" rel="noopener noreferrer" className="sv-btn primary">Visit site</a>}
                </div>
                {enriched.provider?.photos?.length > 0 && (
                  <div className="sv-photos">
                    {enriched.provider.photos.slice(0, 8).map((src, i) => (
                      <img key={i} src={src} alt="" />
                    ))}
                  </div>
                )}
                {enriched.provider?.openingHours && (
                  <div style={{ marginTop: 12 }}>
                    <strong>Opening hours</strong>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, margin: '6px 0 0' }}>
                      {typeof enriched.provider.openingHours === 'string'
                        ? enriched.provider.openingHours
                        : JSON.stringify(enriched.provider.openingHours, null, 2)}
                    </pre>
                  </div>
                )}
                {enriched.provider?.reviewsSummary && (
                  <div style={{ marginTop: 12 }}>
                    <strong>What customers say</strong>
                    <p style={{ marginTop: 6 }}>{enriched.provider.reviewsSummary}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
