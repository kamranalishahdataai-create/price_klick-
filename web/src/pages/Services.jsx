import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { searchServices, enrichProvider, trackProviderClick, resolveUserLocation, getSpendingPatterns, trackActivity, findServiceDeals, getProviderMenu } from '../api/services'
import ServiceMap from '../components/ServiceMap'
import './Services.css'

// ── Flat service chips (client design) with drill-down subcategories ─────────
const FLAT_SERVICES = [
  { label: 'Auto Repair',       subs: ['Oil Change', 'Tires', 'Brakes', 'Transmission', 'Battery', 'Wheel Alignment', 'Diagnostics'] },
  { label: 'Catering',          subs: ['Wedding Catering', 'Corporate Catering', 'Event Catering'] },
  { label: 'Cleaning',          subs: ['Deep Cleaning', 'Move-out Cleaning', 'Recurring Cleaning', 'Carpet Cleaning', 'Window Cleaning'] },
  { label: 'Electrical',        subs: ['Wiring', 'Panel Upgrade', 'Lighting', 'EV Charger'] },
  { label: 'HVAC',              subs: ['AC Repair', 'Furnace Repair', 'Duct Cleaning', 'Heat Pump'] },
  { label: 'IT Support',        subs: ['Computer Repair', 'Network Setup', 'Data Recovery'] },
  { label: 'Landscaping',       subs: ['Lawn Care', 'Tree Service', 'Snow Removal', 'Irrigation'] },
  { label: 'Moving',            subs: ['Local Movers', 'Long Distance', 'Packing', 'Storage'] },
  { label: 'Painting',          subs: ['Interior', 'Exterior', 'Cabinet Painting'] },
  { label: 'Personal Training', subs: [] },
  { label: 'Pest Control',      subs: ['Rodents', 'Insects', 'Termites', 'Bed Bugs'] },
  { label: 'Photography',       subs: ['Wedding', 'Portrait', 'Product', 'Events'] },
  { label: 'Plumbing',          subs: ['Leak Repair', 'Drain Cleaning', 'Water Heater', 'Toilet Repair'] },
  { label: 'Roofing',           subs: ['Roof Repair', 'Roof Replacement', 'Gutters'] },
  { label: 'Tutoring',          subs: ['Math', 'Science', 'English', 'Languages', 'Exam Prep'] },
]

// "Try a popular search" pills — set query + budget in one click
const POPULAR = [
  { icon: '🍕', label: 'Pizza',       q: 'Pizza',       budget: '15' },
  { icon: '🍔', label: 'Burgers',     q: 'Burgers',     budget: '10' },
  { icon: '🔧', label: 'Auto Repair', q: 'Auto Repair', budget: '80' },
]

// ── Pre Pay AI — localStorage pattern tracking ─────────────
const PREPAY_KEY = 'pk_search_history'

function trackSearch(category) {
  try {
    const h = JSON.parse(localStorage.getItem(PREPAY_KEY) || '[]')
    h.push({ category, ts: Date.now() })
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000
    localStorage.setItem(PREPAY_KEY, JSON.stringify(h.filter(x => x.ts > cutoff).slice(-100)))
  } catch (_) {}
}

function getPrePayRecs() {
  try {
    const h = JSON.parse(localStorage.getItem(PREPAY_KEY) || '[]')
    const counts = {}
    h.forEach(x => { counts[x.category] = (counts[x.category] || 0) + 1 })
    return Object.entries(counts)
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category, count]) => ({ category, count }))
  } catch (_) { return [] }
}

// ── Helpers ────────────────────────────────────────────────
function Stars({ r }) {
  return (
    <span className="sv-stars" aria-label={`${r} stars`}>
      <span className="sv-star">★</span>
      <span>{Number(r).toFixed(1)}</span>
    </span>
  )
}

function initialOf(p) { return (p.name || '?').trim().charAt(0).toUpperCase() }
function shortAddr(p) { return p.address || p.addr || p.city || '' }
function distLabel(p) {
  if (typeof p.distanceKm === 'number') return `${p.distanceKm.toFixed(1)} km`
  if (typeof p.dist === 'number') return `${p.dist.toFixed(1)} km`
  return ''
}
function fmtMoney(n) {
  if (n == null) return null
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`
}

// Emoji tile for menu-item rows (we never fake item photos)
function itemEmoji(text) {
  const s = (text || '').toLowerCase()
  if (/pizza/.test(s)) return '🍕'
  if (/burger/.test(s)) return '🍔'
  if (/coffee|cafe|café|tea/.test(s)) return '☕'
  if (/sushi|japanese/.test(s)) return '🍣'
  if (/taco|burrito|mexican/.test(s)) return '🌮'
  if (/restaurant|food|dining|catering|meal/.test(s)) return '🍽️'
  if (/auto|oil|tire|brake|mechanic|car/.test(s)) return '🔧'
  if (/hair|barber|salon|beauty|nail|spa/.test(s)) return '💇'
  if (/clean/.test(s)) return '🧽'
  if (/plumb|leak|drain/.test(s)) return '🚰'
  if (/electric|wiring|lighting/.test(s)) return '💡'
  if (/gym|fitness|train/.test(s)) return '🏋️'
  if (/tutor|math|science|english|class|lesson/.test(s)) return '📚'
  if (/photo/.test(s)) return '📷'
  if (/pet|vet|dog|groom/.test(s)) return '🐾'
  if (/hotel|room|resort/.test(s)) return '🏨'
  return '🏷️'
}

// ── Floating compare bar ───────────────────────────────────
function CompareBar({ compareSet, providers, onClear, onOpen }) {
  if (compareSet.size === 0) return null
  const selected = providers.filter(p => compareSet.has(p.placeId || p.name))
  return (
    <div className="sv-compare-bar">
      <div className="sv-compare-bar-items">
        {selected.map(p => (
          <span key={p.placeId || p.name} className="sv-compare-chip">
            {p.thumbnail
              ? <img src={p.thumbnail} alt="" className="sv-compare-chip-img" />
              : <span className="sv-compare-chip-init">{initialOf(p)}</span>}
            <span>{p.name.split(' ').slice(0, 2).join(' ')}</span>
          </span>
        ))}
        {compareSet.size < 3 && (
          <span className="sv-compare-chip ghost">+ Add {3 - compareSet.size} more</span>
        )}
      </div>
      <div className="sv-compare-bar-actions">
        {compareSet.size >= 2 && (
          <button className="sv-btn primary" onClick={onOpen}>Compare Now →</button>
        )}
        <button className="sv-btn ghost" onClick={onClear}>Clear</button>
      </div>
    </div>
  )
}

// ── Side-by-side compare modal ─────────────────────────────
function CompareModal({ compareSet, providers, onClose }) {
  const selected = providers.filter(p => compareSet.has(p.placeId || p.name))
  const rows = [
    { label: 'Rating',      fn: p => p.rating != null ? <><Stars r={p.rating} /> <span className="sv-reviews">({(p.reviewsCount || 0).toLocaleString()})</span></> : '—' },
    { label: 'Price Range', fn: p => p.price || '—' },
    { label: 'Est. Cost',   fn: p => p.priceValue ? `$${p.priceValue}` : '—' },
    { label: 'Distance',    fn: p => distLabel(p) || '—' },
    { label: 'Category',    fn: p => p.category || '—' },
    { label: 'Address',     fn: p => shortAddr(p) || '—' },
    { label: 'Phone',       fn: p => p.phone ? <a href={`tel:${p.phone}`} className="sv-btn ghost" style={{fontSize:12,padding:'4px 10px'}}>{p.phone}</a> : '—' },
    { label: 'Profile',     fn: p => p.website ? <a href={p.website} target="_blank" rel="noopener noreferrer" className="sv-btn primary" style={{fontSize:12,padding:'4px 14px'}}>View →</a> : '—' },
  ]
  return (
    <div className="sv-modal" onClick={onClose}>
      <div className="sv-modal-card sv-cmp-modal" onClick={e => e.stopPropagation()}>
        <button className="sv-modal-close" onClick={onClose}>✕</button>
        <div className="sv-modal-body">
          <h3 style={{ marginBottom: 20 }}>Side-by-Side Comparison</h3>
          <div className="sv-cmp-wrap">
            <table className="sv-cmp-table">
              <thead>
                <tr>
                  <th className="sv-cmp-attr-col">Attribute</th>
                  {selected.map(p => (
                    <th key={p.placeId || p.name}>
                      <div className="sv-cmp-th">
                        {p.thumbnail
                          ? <img src={p.thumbnail} alt="" className="sv-cmp-th-img" />
                          : <div className="sv-avatar" style={{width:40,height:40,fontSize:16}}>{initialOf(p)}</div>}
                        <span className="sv-cmp-th-name">{p.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.label}>
                    <td className="sv-cmp-label">{row.label}</td>
                    {selected.map(p => (
                      <td key={p.placeId || p.name} className="sv-cmp-cell">{row.fn(p)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Pre Pay AI widget (backend-powered) ───────────────────
function PrePayWidget({ currentQuery, onCategoryClick }) {
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [prompt, setPrompt]     = useState(null)
  const [dismissed, setDismissed] = useState(new Set())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getSpendingPatterns()
      .then(r => { if (!cancelled) setData(r) })
      .catch(() => { if (!cancelled) setData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const localRecs = getPrePayRecs()

  if (loading) return (
    <div className="sv-side-card sv-prepay">
      <div className="sv-tag-mini">🤖 AI INSIGHTS</div>
      <div className="sv-prepay-loading">Analyzing your patterns…</div>
    </div>
  )

  const hasBackendData = data?.hasData && (data.topCategories?.length > 0 || data.suggestions?.length > 0)
  const hasLocalData   = localRecs.length > 0
  if (!hasBackendData && !hasLocalData) return null

  const profile = data?.profile
  const suggestions = data?.suggestions || []
  const suggestedDeals = data?.suggestedDeals || []
  const topCategories = data?.topCategories || []

  const prebook = [
    ...(topCategories.slice(0, 2).map(tc => ({ category: tc.cat, count: tc.count, source: 'ai' }))),
    ...localRecs.filter(lr => !topCategories.some(tc => tc.cat === lr.category)).slice(0, 1)
  ].filter(r => !dismissed.has(r.category))

  return (
    <div className="sv-side-card sv-prepay">
      <div className="sv-tag-mini">🤖 AI INSIGHTS</div>

      {profile && (
        <div className="sv-prepay-profile">
          <span className="sv-prepay-profile-icon">{profile.icon}</span>
          <div>
            <div className="sv-prepay-profile-label">{profile.label}</div>
            <div className="sv-prepay-profile-desc">{profile.desc}</div>
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="sv-prepay-suggestions">
          {suggestions.slice(0, 2).map((s, i) => (
            <div key={i} className={`sv-prepay-insight sv-prepay-insight-${s.type}`}>
              <p className="sv-prepay-insight-text">{s.text}</p>
              {s.cta && s.type === 'prepay' && (
                <button className="sv-btn primary" style={{fontSize:12,padding:'5px 12px',marginTop:6}}
                  onClick={() => setPrompt(s.category)}>
                  {s.cta}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {topCategories.length > 0 && (
        <div className="sv-prepay-cats">
          <div className="sv-prepay-cats-label">Your top categories</div>
          <div className="sv-prepay-cats-list">
            {topCategories.slice(0, 4).map(tc => (
              <button key={tc.cat} className="sv-prepay-cat-chip"
                onClick={() => onCategoryClick && onCategoryClick(tc.cat)}>
                {tc.cat.replace(/_/g, ' ')}
                <span className="sv-prepay-cat-count">{tc.count}×</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {suggestedDeals.length > 0 && (
        <div className="sv-prepay-deals">
          <div className="sv-prepay-cats-label">Deals matching your habits</div>
          {suggestedDeals.slice(0, 3).map((d, i) => (
            <a key={i} href={d.url || '#'} target="_blank" rel="noopener noreferrer"
               className="sv-prepay-deal-row">
              <div className="sv-prepay-deal-info">
                <span className="sv-prepay-deal-title">{d.title?.slice(0, 42)}{d.title?.length > 42 ? '…' : ''}</span>
                <span className="sv-prepay-deal-store">{d.source || d.brand}</span>
              </div>
              {d.discountPercent && (
                <span className="sv-prepay-deal-badge">{d.discountPercent}% off</span>
              )}
            </a>
          ))}
        </div>
      )}

      {prebook.length > 0 && (
        <div className="sv-prepay-recs">
          <div className="sv-prepay-cats-label">Pre-book suggestions</div>
          {prebook.map(rec => (
            <div key={rec.category} className="sv-prepay-rec">
              <div className="sv-prepay-rec-info">
                <span className="sv-prepay-cat">{rec.category.replace(/_/g, ' ')}</span>
                <span className="sv-prepay-freq">{rec.count}× searched</span>
              </div>
              <div className="sv-prepay-rec-actions">
                <button className="sv-btn primary" style={{fontSize:12,padding:'5px 12px'}}
                  onClick={() => setPrompt(rec.category)}>Pre-book</button>
                <button className="sv-btn ghost" style={{fontSize:12,padding:'5px 8px'}}
                  onClick={() => setDismissed(d => new Set([...d, rec.category]))}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {prompt && (
        <div className="sv-modal" onClick={() => setPrompt(null)}>
          <div className="sv-modal-card" style={{maxWidth:440}} onClick={e => e.stopPropagation()}>
            <button className="sv-modal-close" onClick={() => setPrompt(null)}>✕</button>
            <div className="sv-modal-body">
              <div style={{fontSize:36,marginBottom:8}}>💳</div>
              <h3>Pre-Pay for {prompt.replace(/_/g, ' ')}</h3>
              <p style={{color:'var(--sv-muted)',marginBottom:16,fontSize:14,lineHeight:1.6}}>
                Our AI detected you search for <strong>{prompt.replace(/_/g, ' ')}</strong> frequently.
                Lock in today's rates with a subscription and save up to 20%.
              </p>
              <div className="sv-prepay-options">
                {[
                  { label: 'Monthly',   desc: '1 booking/month, flexible scheduling',  save: '10%' },
                  { label: 'Quarterly', desc: '3 bookings, priority scheduling',        save: '15%' },
                  { label: 'Annual',    desc: '12 bookings, best rate guaranteed',       save: '20%' },
                ].map(opt => (
                  <div key={opt.label} className="sv-prepay-opt">
                    <div className="sv-prepay-opt-head">
                      <span className="sv-prepay-opt-label">{opt.label}</span>
                      <span className="sv-prepay-opt-save">Save {opt.save}</span>
                    </div>
                    <p className="sv-prepay-opt-desc">{opt.desc}</p>
                  </div>
                ))}
              </div>
              <button className="sv-btn primary block" style={{marginTop:16}} onClick={() => setPrompt(null)}>
                Get Started
              </button>
              <p style={{fontSize:12,color:'var(--sv-muted)',marginTop:10,textAlign:'center'}}>
                Subscription management coming soon.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Photo provider card with embedded menu matches (client design) ───────────
function ProviderPhotoCard({
  p, budget, matches, matchesTotal, matchesLoading, deal, badge, website, priceRange,
  onOpenMenu, onEnrich, compareSet, onToggleCompare, scraping, icon,
}) {
  const key = p.placeId || p.name
  const inCompare = compareSet.has(key)
  const canAdd = inCompare || compareSet.size < 3
  const fromPrice = matches?.length
    ? Math.min(...matches.map(m => m.price).filter(n => n != null))
    : (typeof p.priceValue === 'number' ? p.priceValue : null)
  let host = null
  try { host = website ? new URL(website).hostname.replace(/^www\./, '') : null } catch {}
  const phoneHref = p.phone ? `tel:${String(p.phone).replace(/[^\d+]/g, '')}` : null
  const totalMatches = (matchesTotal || 0) + (deal ? 1 : 0)

  return (
    <article className={`sv-pcard ${inCompare ? 'selected' : ''}`}>
      <div className="sv-pcard-photo" onClick={() => onEnrich(p)} role="button" tabIndex={0}>
        {p.thumbnail
          ? <img src={p.thumbnail} alt={p.name} loading="lazy" />
          : <div className="sv-pcard-ph">{initialOf(p)}</div>}
        {p.promoted && <span className="sv-pcard-promoted">Promoted</span>}
        {fromPrice != null && <span className="sv-pcard-from">From {fmtMoney(fromPrice)}</span>}
      </div>

      <div className="sv-pcard-body">
        <h3 className="sv-pcard-name" onClick={() => onEnrich(p)}>{p.name}</h3>
        {p.category && <div className="sv-pcard-cat">{p.category}</div>}
        <div className="sv-pcard-meta">
          {p.rating != null && (
            <span className="sv-meta-bit"><Stars r={p.rating} />{p.reviewsCount != null && <span className="sv-reviews"> ({p.reviewsCount.toLocaleString()})</span>}</span>
          )}
          {distLabel(p) && <span className="sv-meta-bit">📍 {distLabel(p)}</span>}
          {priceRange && <span className="sv-meta-bit sv-price-range">$ {priceRange}</span>}
        </div>
        {shortAddr(p) && (
          <div className="sv-pcard-addr">
            {shortAddr(p)}
            {phoneHref && <a href={phoneHref} className="sv-pcard-phone" title={p.phone}>📞</a>}
          </div>
        )}

        {budget && (matchesLoading || totalMatches > 0) && (
          <div className="sv-pcard-matches">
            {matchesLoading ? (
              <div className="sv-matches-loading"><span className="sv-spinner" /> Checking menu &amp; deals…</div>
            ) : (
              <>
                <div className="sv-matches-head">
                  {totalMatches} MATCH{totalMatches !== 1 ? 'ES' : ''} UNDER ${budget}
                </div>
                {deal && (
                  <a
                    className="sv-match-row sv-match-deal"
                    href={deal.url || undefined}
                    target={deal.url ? '_blank' : undefined}
                    rel="noopener noreferrer"
                  >
                    <span className="sv-match-thumb">🎉</span>
                    <span className="sv-match-main">
                      <span className="sv-match-name">{deal.title || 'Current deal'}<span className="sv-match-badge deal">DEAL</span></span>
                      {deal.description && <span className="sv-match-desc">{deal.description}</span>}
                    </span>
                    <span className="sv-match-price">{deal.price}</span>
                  </a>
                )}
                {(matches || []).slice(0, 2).map((m, i) => (
                  <div key={i} className="sv-match-row">
                    <span className="sv-match-thumb">{icon}</span>
                    <span className="sv-match-main">
                      <span className="sv-match-name">
                        {m.name}
                        {i === 0 && badge && <span className="sv-match-badge">{badge}</span>}
                      </span>
                      {m.description && <span className="sv-match-desc">{m.description}</span>}
                    </span>
                    <span className="sv-match-price">{m.priceDisplay}</span>
                  </div>
                ))}
                {matchesTotal > 2 && (
                  <button className="sv-matches-more" onClick={() => onOpenMenu(p)}>
                    See all {matchesTotal} matches →
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="sv-pcard-foot">
        {host ? (
          <a className="sv-pcard-site" href={website} target="_blank" rel="noopener noreferrer"
             onClick={() => trackProviderClick({ placeId: p.placeId, name: p.name, category: p.category, type: 'service_click' })}>
            {host} ↗
          </a>
        ) : <span />}
        <div className="sv-pcard-actions">
          <button className="sv-lbtn" disabled={scraping === key} onClick={() => onOpenMenu(p)}>
            {scraping === key ? '…' : '📋 Menu'}
          </button>
          <button
            className={`sv-lbtn ${inCompare ? 'active' : ''}`}
            disabled={!canAdd && !inCompare}
            onClick={() => canAdd && onToggleCompare(p)}
          >
            {inCompare ? '✓ Comparing' : '⚖ Compare'}
          </button>
        </div>
      </div>
    </article>
  )
}

// ── Main page ──────────────────────────────────────────────
export default function Services() {
  const [cat, setCat]         = useState(null)
  const [sub, setSub]         = useState(null)
  const [view, setView]       = useState('list')
  const [q, setQ]             = useState('')
  const [budget, setBudget]   = useState('')
  const [minRating, setMinRating] = useState('')
  const [quick, setQuick]     = useState(null)
  const [radiusKm, setRadiusKm] = useState(25)

  const [geo, setGeo]           = useState({ lat: null, lng: null, city: '', source: 'none' })
  const [locating, setLocating] = useState(false)
  const [providers, setProviders] = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [enriching, setEnriching] = useState(null)
  const [enriched, setEnriched]   = useState(null)
  const [scraping, setScraping]   = useState(null)
  const [menuModal, setMenuModal] = useState(null)
  const [menus, setMenus] = useState({})

  const [deals, setDeals]         = useState([])
  const [dealsLoading, setDealsLoading] = useState(false)

  const [compareSet, setCompareSet] = useState(new Set())
  const [showCompare, setShowCompare] = useState(false)

  // AI tracking opt-out
  const [trackingEnabled, setTrackingEnabled] = useState(() => {
    try { return localStorage.getItem('pk_tracking_opt_out') !== '1' } catch { return true }
  })
  function toggleTracking() {
    const next = !trackingEnabled
    setTrackingEnabled(next)
    try { localStorage.setItem('pk_tracking_opt_out', next ? '0' : '1') } catch {}
  }

  const debounceRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    resolveUserLocation().then(g => { if (!cancelled) setGeo(g) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  function handleNearMe() {
    setLocating(true)
    resolveUserLocation()
      .then(g => setGeo(g))
      .catch(() => {})
      .finally(() => setLocating(false))
  }

  const effectiveQuery = useMemo(() => {
    const typed = q.trim()
    if (typed) return typed
    if (sub) return sub.toLowerCase()
    if (cat) return cat.toLowerCase()
    return 'local services'
  }, [q, cat, sub])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true); setError('')
      if (trackingEnabled) {
        trackSearch(effectiveQuery)
        trackActivity({ type: 'service_search', query: effectiveQuery, category: sub || cat || undefined })
      }
      try {
        const maxPrice = parseFloat(budget) || (quick === 'budget' ? 50 : undefined)
        const minR = parseFloat(minRating) || (quick === 'top' ? 4.5 : undefined)
        const data = await searchServices({
          query: effectiveQuery,
          lat: geo.lat ?? undefined,
          lng: geo.lng ?? undefined,
          radiusKm,
          maxPrice,
          minRating: minR,
          limit: 30
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
  }, [effectiveQuery, geo.lat, geo.lng, radiusKm, budget, minRating, quick, trackingEnabled])

  // Best providers first (rating desc); no user-facing sort control per client.
  const sortedProviders = useMemo(() => {
    return [...providers].sort((a, b) => (b.rating || 0) - (a.rating || 0))
  }, [providers])

  // ── Live budget deals (real published promos ≤ budget) ────
  const dealBudget = budget || ''
  useEffect(() => {
    setDeals([])
    if (!dealBudget || providers.length === 0) return
    let cancelled = false
    setDealsLoading(true)
    const top = providers.slice(0, 8).map(p => ({
      name: p.name, city: geo.city || undefined, address: p.address || undefined,
    }))
    findServiceDeals({
      providers: top,
      budget: dealBudget,
      category: sub || cat || effectiveQuery,
      location: geo.city || undefined,
    })
      .then(r => { if (!cancelled) setDeals(r?.deals || []) })
      .catch(() => { if (!cancelled) setDeals([]) })
      .finally(() => { if (!cancelled) setDealsLoading(false) })
    return () => { cancelled = true }
  }, [providers, dealBudget, geo.city])

  const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const dealFor = useMemo(() => {
    const byName = deals.map(d => ({ key: norm(d.name), deal: d })).filter(x => x.key)
    return (p) => {
      const pk = norm(p.name)
      if (!pk) return null
      const hit = byName.find(x => x.key === pk || x.key.includes(pk) || pk.includes(x.key))
      return hit ? hit.deal : null
    }
  }, [deals])

  // Yelp "website" is the listing URL, not the business site.
  const realSiteOf = (p) => (p?.website && !/yelp\.com/i.test(p.website)) ? p.website : undefined

  // ── Scraped menus for the top providers (server-cached 7 days) ──
  useEffect(() => {
    setMenus({})
    if (!dealBudget || providers.length === 0) return
    let cancelled = false
    providers.slice(0, 3).forEach(p => {
      const key = p.placeId || p.name
      setMenus(m => ({ ...m, [key]: { loading: true } }))
      getProviderMenu({
        provider: { placeId: p.placeId, name: p.name, website: realSiteOf(p), city: geo.city || undefined },
        category: sub || cat || effectiveQuery,
        budget: dealBudget,
      })
        .then(r => { if (!cancelled) setMenus(m => ({ ...m, [key]: { loading: false, data: r } })) })
        .catch(() => { if (!cancelled) setMenus(m => ({ ...m, [key]: { loading: false } })) })
    })
    return () => { cancelled = true }
  }, [providers, dealBudget, geo.city])

  // Card badges: BEST VALUE (globally cheapest match), TOP RATED, CLOSEST —
  // one badge per provider, only among providers that have matches.
  const badgeByProvider = useMemo(() => {
    const entries = sortedProviders.map(p => {
      const key = p.placeId || p.name
      const m = menus[key]?.data?.matches
      const cheapest = m?.length ? Math.min(...m.map(x => x.price).filter(n => n != null)) : null
      return { key, p, cheapest }
    }).filter(e => e.cheapest != null && isFinite(e.cheapest))
    if (!entries.length) return {}
    const out = {}
    const bv = entries.reduce((a, b) => (a.cheapest <= b.cheapest ? a : b))
    out[bv.key] = 'BEST VALUE'
    const tr = entries.filter(e => e.p.rating != null && !out[e.key]).sort((a, b) => b.p.rating - a.p.rating)[0]
    if (tr) out[tr.key] = 'TOP RATED'
    const cl = entries.filter(e => typeof e.p.distanceKm === 'number' && !out[e.key]).sort((a, b) => a.p.distanceKm - b.p.distanceKm)[0]
    if (cl) out[cl.key] = 'CLOSEST'
    return out
  }, [sortedProviders, menus])

  function toggleCompare(p) {
    const key = p.placeId || p.name
    setCompareSet(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else if (next.size < 3) next.add(key)
      return next
    })
  }

  async function handleEnrich(prov) {
    setEnriching(prov.placeId || prov.name)
    try {
      const r = await enrichProvider({ placeId: prov.placeId, name: prov.name, address: prov.address })
      setEnriched(r)
    } catch (e) {
      setEnriched({ ok: false, error: e.message })
    } finally {
      setEnriching(null)
    }
  }

  async function handleMenuOpen(prov) {
    const key = prov.placeId || prov.name
    setScraping(key)
    setMenuModal({ providerName: prov.name, loading: true, bucket: null })
    try {
      const r = await getProviderMenu({
        provider: { placeId: prov.placeId, name: prov.name, website: realSiteOf(prov), city: geo.city || undefined },
        category: sub || cat || effectiveQuery,
        budget: dealBudget || undefined,
      })
      setMenuModal({ providerName: prov.name, loading: false, data: r, bucket: null })
    } catch (e) {
      setMenuModal({ providerName: prov.name, loading: false, error: e.message, bucket: null })
    } finally {
      setScraping(null)
    }
  }

  function clearAll() {
    setCat(null); setSub(null); setQ(''); setBudget(''); setMinRating(''); setQuick(null); setRadiusKm(25)
  }

  const hasFilters = !!(budget || minRating || cat || sub || q)
  const selectedService = FLAT_SERVICES.find(s => s.label === cat)
  const icon = itemEmoji(sub || cat || q || (sortedProviders[0]?.category))

  return (
    <div className="sv-page">
      <div className="container sv-shell">

        {/* ── Utility row ── */}
        <div className="sv-util-row">
          <button
            className={`sv-tracking-toggle ${trackingEnabled ? '' : 'off'}`}
            onClick={toggleTracking}
            title={trackingEnabled ? 'AI search tracking is ON — click to opt out' : 'AI search tracking is OFF — click to enable'}
          >
            {trackingEnabled ? '🤖 AI Tracking: On' : '🚫 AI Tracking: Off'}
          </button>
          <div className="sv-util-links">
            <Link to="/vendor" className="sv-util-link">🏪 For Vendors</Link>
            <span className="sv-util-dot">·</span>
            <Link to="/promote" className="sv-util-link">📣 Promote My Listing</Link>
            <span className="sv-util-dot">·</span>
            <Link to="/network" className="sv-util-link">🚀 Join the PriceKlick Network</Link>
          </div>
        </div>

        {/* ── Hero ── */}
        <header className="sv-hero">
          <h1 className="sv-hero-title">PriceKlick</h1>
          <p className="sv-hero-sub">Scroll less, save more.</p>
          <Link to="/smart-compare" className="sv-sc-pill">
            <span className="sv-sc-strong">✨ Smart Compare Advisor</span>
            <span className="sv-sc-hint">— describe anything, get a full comparison</span>
          </Link>
        </header>

        {/* ── Search bar ── */}
        <div className="sv-search-wrap">
          <span className="sv-search-icon">🔍</span>
          <input
            type="text"
            value={q}
            onChange={e => { setQ(e.target.value); setCat(null); setSub(null) }}
            placeholder="Search plumber, electrician, tutor, cleaner..."
            className="sv-search-input"
          />
          {q && (
            <button className="sv-search-x" onClick={() => setQ('')} aria-label="Clear search">✕</button>
          )}
        </div>

        {/* ── Service chips ── */}
        <div className="sv-chips">
          <button
            className={`sv-chip ${!cat && !q ? 'active' : ''}`}
            onClick={() => { setCat(null); setSub(null); setQ('') }}
          >All</button>
          {FLAT_SERVICES.map(s => (
            <button
              key={s.label}
              className={`sv-chip ${cat === s.label ? 'active' : ''}`}
              onClick={() => { setCat(cat === s.label ? null : s.label); setSub(null); setQ('') }}
            >{s.label}</button>
          ))}
        </div>
        {selectedService?.subs?.length > 0 && (
          <div className="sv-subs">
            <span className="sv-subs-label">{selectedService.label}:</span>
            {selectedService.subs.map(s2 => (
              <button
                key={s2}
                className={`sv-subchip ${sub === s2 ? 'active' : ''}`}
                onClick={() => setSub(sub === s2 ? null : s2)}
              >{s2}</button>
            ))}
          </div>
        )}

        {/* ── Control bar ── */}
        <div className="sv-controlbar">
          <button className="sv-nearme" onClick={handleNearMe} disabled={locating}>
            {locating ? '…' : '◈ Near me'}
          </button>
          <span className="sv-ctl-sep" />
          <label className="sv-ctl">
            Within
            <select className="sv-ctl-select" value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))}>
              <option value="5">5 km</option>
              <option value="10">10 km</option>
              <option value="25">25 km</option>
              <option value="50">50 km</option>
              <option value="100">100 km</option>
            </select>
          </label>
          <span className="sv-ctl-sep" />
          <label className="sv-ctl">
            <span className="sv-ctl-dollar">$</span>
            <input
              type="number" min="0" placeholder="Max budget"
              className="sv-ctl-budget"
              value={budget} onChange={e => setBudget(e.target.value)}
            />
          </label>
          <div className="sv-viewtoggle">
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>☰ List</button>
            <button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>🗺 Map</button>
          </div>
          {hasFilters && <button className="sv-clear-all" onClick={clearAll}>✕ Clear</button>}
        </div>

        {/* ── Popular searches ── */}
        <div className="sv-popular">
          <div className="sv-popular-label"><span>TRY A POPULAR SEARCH</span></div>
          <div className="sv-popular-pills">
            {POPULAR.map(pp => (
              <button
                key={pp.label}
                className={`sv-popular-pill ${q === pp.q && budget === pp.budget ? 'active' : ''}`}
                onClick={() => { setQ(pp.q); setCat(null); setSub(null); setBudget(pp.budget) }}
              >
                <span>{pp.icon}</span> {pp.label}
              </button>
            ))}
          </div>
          {q && dealBudget && (
            <div className="sv-popular-preview">
              Previewing results for <strong>"{q.toLowerCase()} ${dealBudget}"</strong>
              {geo.city ? <> · {geo.city}</> : null} · Max ${dealBudget}
            </div>
          )}
        </div>

        {/* ── Results panel ── */}
        <section className="sv-panel">
          <div className="sv-panel-head">
            <span className="sv-panel-title">
              🏷 NEARBY PROVIDERS{dealBudget ? <> WITH MATCHES UNDER <span className="sv-panel-budget">${dealBudget}</span></> : null}
            </span>
            {!loading && (
              <span className="sv-panel-count">{sortedProviders.length} providers · {radiusKm} km</span>
            )}
          </div>

          {loading && <div className="sv-loading-bar"><div className="sv-loading-inner" /></div>}

          {error && (
            <div className="sv-empty">
              <div className="sv-empty-icon">⚠️</div>
              <h3>Search failed</h3><p>{error}</p>
            </div>
          )}

          {!error && !loading && sortedProviders.length === 0 ? (
            <div className="sv-empty">
              <div className="sv-empty-icon">🔍</div>
              <h3>No providers found</h3>
              <p>Try a different service, wider radius, or clear filters.</p>
              <button className="sv-btn ghost" onClick={clearAll}>Clear all filters</button>
            </div>
          ) : view === 'map' ? (
            <div className="sv-map-shell">
              <ServiceMap providers={sortedProviders} userLat={geo.lat} userLng={geo.lng} />
            </div>
          ) : (
            <div className="sv-grid">
              {sortedProviders.map(p => {
                const key = p.placeId || p.name
                const menu = menus[key]
                const items = menu?.data?.items
                const priceRange = items?.length
                  ? `$${Math.round(Math.min(...items.map(i => i.price)))}–$${Math.round(Math.max(...items.map(i => i.price)))}`
                  : (p.price || null)
                return (
                  <ProviderPhotoCard
                    key={key}
                    p={p}
                    budget={dealBudget}
                    matches={menu?.data?.matches}
                    matchesTotal={menu?.data?.matches?.length || 0}
                    matchesLoading={!!menu?.loading || (dealBudget && dealsLoading && !menu)}
                    deal={dealFor(p)}
                    badge={badgeByProvider[key]}
                    website={menu?.data?.website || realSiteOf(p) || p.website}
                    priceRange={priceRange}
                    onOpenMenu={handleMenuOpen}
                    onEnrich={handleEnrich}
                    compareSet={compareSet}
                    onToggleCompare={toggleCompare}
                    scraping={scraping}
                    icon={icon}
                  />
                )
              })}
            </div>
          )}
        </section>

        {/* ── Preferred vendors (title only until vendors register) ── */}
        <div className="sv-pref-strip">
          ⭐ <strong>PriceKlick Preferred Vendors</strong> — coming soon ·{' '}
          <Link to="/vendor">Apply to be a Preferred Vendor →</Link>
        </div>

        {/* ── Pre Pay AI insights ── */}
        <div className="sv-prepay-wrap">
          <PrePayWidget
            currentQuery={effectiveQuery}
            onCategoryClick={item => { setQ(item); setCat(null); setSub(null) }}
          />
        </div>
      </div>

      {/* ── Floating compare bar ── */}
      <CompareBar
        compareSet={compareSet}
        providers={sortedProviders}
        onClear={() => setCompareSet(new Set())}
        onOpen={() => setShowCompare(true)}
      />

      {showCompare && (
        <CompareModal
          compareSet={compareSet}
          providers={sortedProviders}
          onClose={() => setShowCompare(false)}
        />
      )}

      {/* ── Details modal ── */}
      {enriched && (
        <div className="sv-modal" onClick={() => setEnriched(null)}>
          <div className="sv-modal-card" onClick={e => e.stopPropagation()}>
            <button className="sv-modal-close" onClick={() => setEnriched(null)}>✕</button>
            {!enriched.ok ? (
              <div style={{padding:24}}>
                <h3>Couldn't load details</h3>
                <p style={{color:'var(--sv-muted)'}}>{enriched.error || 'Unknown error.'}</p>
              </div>
            ) : (
              <div className="sv-modal-body">
                <h3>{enriched.provider?.name}</h3>
                <p className="sv-pref-addr">{enriched.provider?.address}</p>
                <div className="sv-pref-meta" style={{margin:'10px 0'}}>
                  {enriched.provider?.rating != null && <Stars r={enriched.provider.rating} />}
                  {enriched.provider?.reviewsCount != null && (
                    <span className="sv-reviews">({enriched.provider.reviewsCount.toLocaleString()} reviews)</span>
                  )}
                  {enriched.provider?.phone && (
                    <a href={`tel:${enriched.provider.phone}`} className="sv-btn ghost">📞 {enriched.provider.phone}</a>
                  )}
                  {enriched.provider?.website && (
                    <a href={enriched.provider.website} target="_blank" rel="noopener noreferrer" className="sv-btn primary">🌐 Website</a>
                  )}
                </div>
                {enriched.provider?.photos?.length > 0 && (
                  <div className="sv-photos">
                    {enriched.provider.photos.slice(0, 8).map((src, i) => <img key={i} src={src} alt="" />)}
                  </div>
                )}
                {enriched.provider?.openingHours && (
                  <div style={{marginTop:12}}>
                    <strong>Opening Hours</strong>
                    <pre style={{whiteSpace:'pre-wrap',fontFamily:'inherit',fontSize:13,margin:'6px 0 0',color:'var(--sv-muted)'}}>
                      {enriched.provider.openingHours}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Scraped menu / price-list modal (bucketed) ── */}
      {menuModal && (
        <div className="sv-modal" onClick={() => setMenuModal(null)}>
          <div className="sv-modal-card" onClick={e => e.stopPropagation()}>
            <button className="sv-modal-close" onClick={() => setMenuModal(null)}>✕</button>
            <div className="sv-modal-body">
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <span style={{fontSize:22}}>📋</span>
                <h3 style={{margin:0}}>{menuModal.providerName}</h3>
                {menuModal.data?.website && (
                  <a href={menuModal.data.website} target="_blank" rel="noopener noreferrer"
                     className="sv-btn ghost" style={{marginLeft:'auto',fontSize:12}}>Visit site ↗</a>
                )}
              </div>

              {menuModal.loading ? (
                <div className="sv-matches-loading" style={{padding:'18px 0'}}>
                  <span className="sv-spinner" /> Reading the published menu / price list from the web…
                </div>
              ) : !menuModal.data?.ok || !menuModal.data.items?.length ? (
                <p style={{color:'var(--sv-muted)'}}>
                  {menuModal.error || 'No published prices found online for this business yet. Try their website or call for pricing.'}
                </p>
              ) : (
                <>
                  <div className="sv-menu-buckets">
                    <button
                      className={`sv-subchip ${!menuModal.bucket ? 'active' : ''}`}
                      onClick={() => setMenuModal(m => ({ ...m, bucket: null }))}
                    >
                      All ({menuModal.data.items.length})
                    </button>
                    {Object.entries(menuModal.data.bucketCounts || {})
                      .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
                      .map(([b, n]) => (
                        <button key={b}
                          className={`sv-subchip ${menuModal.bucket === b ? 'active' : ''}`}
                          onClick={() => setMenuModal(m => ({ ...m, bucket: m.bucket === b ? null : b }))}
                        >
                          ${b} ({n})
                        </button>
                      ))}
                  </div>

                  <div className="sv-menu-list">
                    {menuModal.data.items
                      .filter(it => !menuModal.bucket || it.bucket === menuModal.bucket)
                      .map((it, i) => {
                        const inBudget = dealBudget && it.price != null && it.price <= parseFloat(dealBudget)
                        return (
                          <div key={i} className={`sv-menu-row ${inBudget ? 'in-budget' : ''}`}>
                            <div className="sv-menu-row-main">
                              <span className="sv-menu-row-name">
                                {it.name}
                                {inBudget && <span className="sv-menu-row-flag">≤ ${dealBudget}</span>}
                              </span>
                              {it.section && <span className="sv-menu-row-section">{it.section}</span>}
                              {it.description && <div className="sv-menu-row-desc">{it.description}</div>}
                            </div>
                            <span className="sv-menu-row-price">{it.priceDisplay}</span>
                          </div>
                        )
                      })}
                  </div>
                  <div className="sv-menu-note">
                    🔎 Prices read live from the business&rsquo;s published menu · confirm before ordering
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
