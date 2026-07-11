import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import './SmartCompare.css'
import { scrapeProductPrice } from '../api/services'

const API = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || ''

const EXAMPLES = [
  "I'm in the GTA looking for a vehicle under $60k. Open to any brand — gas, hybrid or EV. Should I finance or lease?",
  "Need a reliable plumber in downtown for a leaking water heater, budget $400. Same-day service.",
  "Looking for term life insurance, 35yo non-smoker, $500k coverage, 20-year term. Best rates?",
  "Best 65\" OLED TV under $1,800 for movie watching in a bright living room.",
]

const SAMPLE_RESULT = {
  ok: true,
  summary: "Vehicle in the GTA, budget $60K, gas/hybrid/EV — financing or leasing?",
  category: 'vehicle',
  analyzedCount: 1247,
  vendorsCount: 36,
  updatedAt: '2026-05-24T00:00:00Z',
  promotions: [
    { brand: 'Toyota', title: '0.99% APR financing for 60 months + $1,500 cash back', expiry: 'Expires Jun 30, 2026' },
    { brand: 'Tesla', title: '$5,000 off Model Y inventory + free Enhanced Autopilot', detail: 'Limited stock' },
    { brand: 'Honda', title: 'Lease Pull-Ahead: up to 3 payments waived', detail: 'Qualified lessees' },
    { brand: 'Hyundai', title: '$2,500 EV Bonus + $1,000 loyalty credit', detail: 'Ioniq 5 / Kona EV' },
  ],
  financeVsLease: {
    finance: {
      monthly: '$742', term: '60 months', totalCost: '$44,520', downPayment: '$6,000 (10%)',
      mileageCap: 'No limit', ownershipAtEnd: 'You own the vehicle',
      pros: ['Builds equity', 'No mileage restrictions', 'Freedom to sell or trade anytime'],
      cons: ['Higher monthly payments', 'Higher total cost'],
      bestFor: 'Long-term owners who drive a lot',
    },
    lease: {
      monthly: '$498', term: '36 months', totalCost: '$17,928 + residual', downPayment: '$2,999 (cap cost reduction)',
      mileageCap: '12,000 mi/year', ownershipAtEnd: 'Return the vehicle',
      pros: ['Lower monthly payments', 'Warranty coverage entire term', 'Drive the latest models'],
      cons: ['Mileage overage fees', 'No ownership at end'],
      bestFor: 'Lower payments & driving a new vehicle often',
    },
    breakEvenYears: 4.2,
  },
  options: [
    { fitScore: 92, brand: 'Toyota', model: 'RAV4 Hybrid XLE', tag: 'Hybrid', price: '$41,990', priceLabel: 'Starting MSRP',
      pros: ['Excellent fuel economy', 'Reliable & proven', 'High resale value'], cons: ['Not as quick as rivals', 'Interior is modest'] },
    { fitScore: 88, brand: 'Tesla', model: 'Model Y RWD', tag: 'Electric', price: '$54,990', priceLabel: 'Starting MSRP',
      pros: ['Supercharger network', 'Quick & fun to drive', 'Minimal maintenance'], cons: ['Firmer ride', 'Interior is spartan'] },
    { fitScore: 85, brand: 'Honda', model: 'CR-V Hybrid Sport', tag: 'Hybrid', price: '$44,990', priceLabel: 'Starting MSRP',
      pros: ['Spacious & practical', 'Great fuel economy', 'Strong safety ratings'], cons: ['Not the most engaging', 'Higher trims get pricey'] },
    { fitScore: 81, brand: 'Hyundai', model: 'Ioniq 5 SE', tag: 'Electric', price: '$49,999', priceLabel: 'Starting MSRP',
      pros: ['Ultra-fast charging', 'Roomy & futuristic', 'Excellent tech features'], cons: ['Some road noise', 'Range varies in winter'] },
  ],
}

function brandLogo(brand) {
  const initial = (brand || '?').trim().charAt(0).toUpperCase()
  const colors = { T: '#eb0a1e', E: '#000', H: '#cc0000', S: '#222', A: '#0033a0', B: '#0066b1', M: '#262626', D: '#000', F: '#003478' }
  return { initial, bg: colors[initial] || '#5b21b6' }
}

// Build a guaranteed-working URL for any item: prefer a real URL, otherwise a
// Google search so every card is clickable and "leads somewhere".
function searchUrl(...parts) {
  const q = parts.filter(Boolean).join(' ').trim()
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`
}

// Known brand → official offers/deals page. Lets us send users straight to the
// brand's real promotion page instead of a Google search when the AI engine
// (without live web access) didn't return an exact URL.
const BRAND_SITES = {
  toyota: 'https://www.toyota.com/deals/',
  honda: 'https://automobiles.honda.com/specials-offers',
  ford: 'https://www.ford.com/finance/offers/',
  tesla: 'https://www.tesla.com/',
  hyundai: 'https://www.hyundaiusa.com/us/en/local-offers',
  kia: 'https://www.kia.com/us/en/offers',
  nissan: 'https://www.nissanusa.com/shopping-tools/current-offers-deals.html',
  chevrolet: 'https://www.chevrolet.com/deals-incentives',
  chevy: 'https://www.chevrolet.com/deals-incentives',
  gmc: 'https://www.gmc.com/current-deals-offers',
  buick: 'https://www.buick.com/current-offers',
  bmw: 'https://www.bmwusa.com/deals-and-incentives.html',
  mercedes: 'https://www.mbusa.com/en/special-offers',
  'mercedes-benz': 'https://www.mbusa.com/en/special-offers',
  audi: 'https://www.audiusa.com/en/special-offers/',
  volkswagen: 'https://www.vw.com/en/deals.html',
  vw: 'https://www.vw.com/en/deals.html',
  mazda: 'https://www.mazdausa.com/shopping-tools/current-offers',
  subaru: 'https://www.subaru.com/deals.html',
  jeep: 'https://www.jeep.com/bmo.html',
  ram: 'https://www.ramtrucks.com/bmo.html',
  dodge: 'https://www.dodge.com/bmo.html',
  chrysler: 'https://www.chrysler.com/bmo.html',
  lexus: 'https://www.lexus.com/offers',
  acura: 'https://www.acura.com/current-offers',
  infiniti: 'https://www.infinitiusa.com/shopping-tools/special-offers.html',
  volvo: 'https://www.volvocars.com/us/shopping-tools/offers/',
  porsche: 'https://www.porsche.com/usa/',
  genesis: 'https://www.genesis.com/us/en/genesis-offers.html',
  mitsubishi: 'https://www.mitsubishicars.com/offers',
  // common retailers
  bestbuy: 'https://www.bestbuy.com/site/misc/deal-of-the-day/pcmcat248000050016.c',
  walmart: 'https://www.walmart.com/shop/deals',
  target: 'https://www.target.com/c/top-deals/-/N-4tah6',
  amazon: 'https://www.amazon.com/deals',
  costco: 'https://www.costco.com/online-offers.html',
  samsung: 'https://www.samsung.com/us/specialoffers/',
  lg: 'https://www.lg.com/us/promotions',
  sony: 'https://electronics.sony.com/deals',
  apple: 'https://www.apple.com/shop/refurbished',
}

function brandSlug(brand) {
  return (brand || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// Resolve the best non-Google destination for a brand: real offers page if known,
// else the brand's own homepage, else a search as the very last resort.
function brandDestination(brand, fallbackQuery) {
  const slug = brandSlug(brand)
  if (BRAND_SITES[slug]) return BRAND_SITES[slug]
  const compact = (brand || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (compact.length >= 2) return `https://www.${compact}.com`
  return searchUrl(fallbackQuery || brand)
}

// Search-engine result links are never a destination — the user should land on
// the car/product page itself, not on Google. Treat them as missing so we
// resolve the brand's real page instead.
function isSearchUrl(url) {
  return typeof url === 'string'
    && /(google|bing|duckduckgo|yahoo)\.[a-z.]+\/(search|shopping)|google\.[a-z.]+\/url/i.test(url)
}
function directUrlOf(u) {
  return (typeof u === 'string' && /^https?:\/\//i.test(u) && !isSearchUrl(u)) ? u : null
}

// Promotion → its real offer page (AI url) or the brand's offers/homepage.
function promoHref(p) {
  return directUrlOf(p.url) || brandDestination(p.brand, `${p.brand || ''} ${p.title || ''} offer`)
}

// Option → its real product page (AI url) or the brand's site.
function optionHref(o) {
  return directUrlOf(o.url) || brandDestination(o.brand, `${o.brand || ''} ${o.model || ''}`)
}

function FitBadge({ score }) {
  const cls = score >= 90 ? 'top' : score >= 85 ? 'good' : 'ok'
  return <div className={`sc-fit ${cls}`}>{score}%<span>Fit Score</span></div>
}

function OptionCard({ o }) {
  const lg = brandLogo(o.brand)
  const [livePrice, setLivePrice] = useState(null)
  const [checking, setChecking] = useState(false)

  async function checkLivePrice() {
    if (!o.url || checking) return
    setChecking(true)
    try {
      const r = await scrapeProductPrice(o.url)
      setLivePrice(r)
    } catch (_) {
      setLivePrice({ error: 'Could not fetch live price' })
    } finally {
      setChecking(false)
    }
  }

  const href = optionHref(o)
  return (
    <div className="sc-option">
      <div className="sc-option-head">
        <FitBadge score={o.fitScore || 0} />
        <a className="sc-option-id" href={href} target="_blank" rel="noopener noreferrer"
           style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="sc-option-logo" style={{ background: lg.bg }}>{lg.initial}</div>
          <div>
            <div className="sc-option-brand">{o.brand}</div>
            <div className="sc-option-model">{o.model}</div>
          </div>
        </a>
      </div>
      <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: 'block', cursor: 'pointer' }}
         title={`Open ${o.brand || ''} ${o.model || ''}`}>
        {o.image
          ? <img className="sc-option-img" src={o.image} alt={`${o.brand} ${o.model}`} loading="lazy" />
          : <div className="sc-option-img placeholder">{o.brand}</div>}
      </a>
      {o.tag && <span className="sc-option-tag">⚡ {o.tag}</span>}
      <div className="sc-option-price">
        {livePrice && !livePrice.error ? (
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            <strong style={{ color:'oklch(82% .18 155)' }}>
              {livePrice.currency || '$'}{livePrice.currentPrice ?? o.price}
            </strong>
            {livePrice.originalPrice && livePrice.originalPrice > livePrice.currentPrice && (
              <span style={{ textDecoration:'line-through', color:'var(--muted-foreground)', fontSize:12 }}>
                {livePrice.currency || '$'}{livePrice.originalPrice}
              </span>
            )}
            <span style={{ fontSize:11, color:'oklch(82% .18 155)', fontWeight:600 }}>
              🌐 Live price via Firecrawl
            </span>
          </div>
        ) : (
          <>
            <strong>{o.price}</strong>
            <span>{o.priceLabel || ''}</span>
          </>
        )}
      </div>
      <div className="sc-pc">
        <div className="sc-pc-col">
          <div className="sc-pc-h pros">Pros</div>
          {(o.pros || []).slice(0, 3).map((p, i) => <div key={i} className="sc-pc-li">✓ {p}</div>)}
        </div>
        <div className="sc-pc-col">
          <div className="sc-pc-h cons">Cons</div>
          {(o.cons || []).slice(0, 3).map((p, i) => <div key={i} className="sc-pc-li">✕ {p}</div>)}
        </div>
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
        {/* Always clickable — direct product page if we have one, else the brand's site */}
        <a className="sc-view-details" href={href} target="_blank" rel="noopener noreferrer">
          {directUrlOf(o.url) ? 'View Details →' : `View at ${o.brand || 'brand'} →`}
        </a>
        {o.url && !livePrice && (
          <button onClick={checkLivePrice} disabled={checking}
            style={{ fontSize:12, padding:'5px 11px', borderRadius:999, border:'1px solid rgba(255,255,255,.15)',
              background:'transparent', color:'var(--muted-foreground)', cursor:'pointer', fontFamily:'inherit' }}>
            {checking ? '⏳ Checking…' : '🔍 Live Price'}
          </button>
        )}
      </div>
    </div>
  )
}

function PromoCard({ p }) {
  const lg = brandLogo(p.brand)
  const href = promoHref(p)
  return (
    <a className="sc-promo" href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
      <div className="sc-promo-logo" style={{ background: lg.bg }}>{lg.initial}</div>
      <div className="sc-promo-body">
        <div className="sc-promo-brand">{p.brand}</div>
        <div className="sc-promo-title">{p.title}</div>
        {p.expiry && <div className="sc-promo-meta">🕒 {p.expiry}</div>}
        {p.detail && !p.expiry && <div className="sc-promo-meta">{p.detail}</div>}
        <div className="sc-promo-cta">View offer →</div>
      </div>
    </a>
  )
}

function FinanceVsLease({ fl }) {
  if (!fl) return null
  const rows = [
    { label: 'Monthly Payment', f: fl.finance?.monthly, l: fl.lease?.monthly, big: true },
    { label: 'Term', f: fl.finance?.term, l: fl.lease?.term },
    { label: 'Total Cost', f: fl.finance?.totalCost, l: fl.lease?.totalCost },
    { label: 'Down Payment', f: fl.finance?.downPayment, l: fl.lease?.downPayment },
    { label: 'Mileage Cap', f: fl.finance?.mileageCap, l: fl.lease?.mileageCap },
    { label: 'Ownership at End', f: fl.finance?.ownershipAtEnd, l: fl.lease?.ownershipAtEnd },
  ]
  return (
    <div className="sc-fl">
      <div className="sc-fl-head">
        <div className="sc-fl-title">📊 Finance vs Lease</div>
        {fl.breakEvenYears != null && <div className="sc-fl-break">Break-even at {fl.breakEvenYears} years</div>}
      </div>
      <div className="sc-fl-grid">
        <div className="sc-fl-col finance">
          <div className="sc-fl-colhead">Finance</div>
        </div>
        <div className="sc-fl-col label"><div className="sc-fl-colhead">&nbsp;</div></div>
        <div className="sc-fl-col lease">
          <div className="sc-fl-colhead">Lease</div>
        </div>
        {rows.map((r, i) => (
          <React.Fragment key={i}>
            <div className={`sc-fl-cell f ${r.big ? 'big' : ''}`}>{r.f || '—'}</div>
            <div className="sc-fl-cell label">{r.label}</div>
            <div className={`sc-fl-cell l ${r.big ? 'big' : ''}`}>{r.l || '—'}</div>
          </React.Fragment>
        ))}
        {/* Pros */}
        <div className="sc-fl-cell f list">
          {(fl.finance?.pros || []).map((p, i) => <div key={i}>✓ {p}</div>)}
        </div>
        <div className="sc-fl-cell label">Pros</div>
        <div className="sc-fl-cell l list">
          {(fl.lease?.pros || []).map((p, i) => <div key={i}>✓ {p}</div>)}
        </div>
        {/* Cons */}
        <div className="sc-fl-cell f list cons">
          {(fl.finance?.cons || []).map((p, i) => <div key={i}>✕ {p}</div>)}
        </div>
        <div className="sc-fl-cell label">Cons</div>
        <div className="sc-fl-cell l list cons">
          {(fl.lease?.cons || []).map((p, i) => <div key={i}>✕ {p}</div>)}
        </div>
        {/* Best for */}
        <div className="sc-fl-cell f best">Best for… {fl.finance?.bestFor}</div>
        <div className="sc-fl-cell label">&nbsp;</div>
        <div className="sc-fl-cell l best">Best for… {fl.lease?.bestFor}</div>
      </div>
    </div>
  )
}

const DASH_NAV = [
  { icon: '🏠', label: 'Dashboard', active: true },
  { icon: '🔍', label: 'Smart Compare' },
  { icon: '🏷️', label: 'Deals' },
  { icon: '🚗', label: 'Vehicles' },
  { icon: '📊', label: 'Finance Tools' },
  { icon: '🔔', label: 'Price Alerts' },
  { icon: '❤️', label: 'Saved' },
  { icon: '📈', label: 'Market Insights' },
  { icon: '❓', label: 'Help & FAQ' },
  { icon: '⚙️', label: 'Settings' },
]

function ResultDashboard({ data, sample = false }) {
  if (!data) return null
  const updated = data.updatedAt ? new Date(data.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''
  const isVehicle = /vehicle|car|suv|truck|auto/i.test(data.category || '')
  const noun = isVehicle ? 'vehicles' : 'options'
  const vendorNoun = isVehicle ? 'dealerships' : 'vendors'
  const promoLabel = isVehicle ? 'Current Dealership Promotions' : 'Current Promotions'
  return (
    <div className={`sc-dash ${sample ? 'sample' : ''}`}>
      {/* Left nav */}
      <aside className="sc-nav">
        <div className="sc-nav-brand"><span className="sc-nav-logo">✦</span> Price<span>Klick</span></div>
        <nav className="sc-nav-list">
          {DASH_NAV.map(n => (
            <div key={n.label} className={`sc-nav-item ${n.active ? 'active' : ''}`}>
              <span className="sc-nav-ic">{n.icon}</span>{n.label}
            </div>
          ))}
        </nav>
        <div className="sc-nav-cta">
          <div className="sc-nav-cta-ic">✦</div>
          <div className="sc-nav-cta-title">AI-Powered Smart Compare</div>
          <div className="sc-nav-cta-desc">Get personalized recommendations in seconds.</div>
        </div>
      </aside>

      {/* Main */}
      <div className="sc-dashmain">
        <div className="sc-topbar">
          <div className="sc-topbar-title"><span className="sc-topbar-spark">✦</span> AI-Powered Smart Compare</div>
          <div className="sc-topbar-right">
            <span className="sc-topbar-spark-btn">✦</span>
            <span className="sc-topbar-bell">🔔</span>
            <span className="sc-topbar-user"><span className="sc-topbar-avatar">JD</span> {sample ? 'John D.' : 'You'}</span>
          </div>
        </div>

        <div className="sc-dashbody">
          <div className="sc-dash-summary">
            <div className="sc-dash-quote">💬 {data.summary}</div>
            <div className="sc-dash-meta">
              Analyzed {Number(data.analyzedCount || 0).toLocaleString()} {noun} · {data.vendorsCount || 0} {vendorNoun}
              {updated && ` · Updated ${updated}`}
            </div>
            <span className="sc-dash-spark">✦</span>
          </div>

          {data.promotions?.length > 0 && (
            <div className="sc-dash-section">
              <div className="sc-dash-h">🏷️ {promoLabel} <span className="sc-dash-view">View all promotions →</span></div>
              <div className="sc-dash-promos">
                {data.promotions.slice(0, 4).map((p, i) => <PromoCard key={i} p={p} />)}
              </div>
            </div>
          )}

          {data.financeVsLease && <FinanceVsLease fl={data.financeVsLease} />}

          {data.options?.length > 0 && (
            <div className="sc-dash-section">
              <div className="sc-dash-h">✦ AI Recommendations <span className="sc-dash-view">ranked by fit</span></div>
              <div className="sc-dash-options">
                {data.options.slice(0, 4).map((o, i) => <OptionCard key={i} o={o} />)}
              </div>
            </div>
          )}

          {/* Live sources (Perplexity citations) — clickable, real, current */}
          {Array.isArray(data.citations) && data.citations.length > 0 && (
            <div className="sc-dash-section">
              <div className="sc-dash-h">🔗 Live Sources <span className="sc-dash-view">{data.engine === 'perplexity' ? 'web-verified' : ''}</span></div>
              <div className="sc-sources">
                {data.citations.slice(0, 8).map((c, i) => {
                  const url = typeof c === 'string' ? c : (c?.url || c?.link)
                  if (!url) return null
                  let host = url
                  try { host = new URL(url).hostname.replace(/^www\./, '') } catch {}
                  return (
                    <a key={i} className="sc-source" href={url} target="_blank" rel="noopener noreferrer">
                      <span className="sc-source-n">{i + 1}</span>{host} →
                    </a>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SmartCompare() {
  const [query, setQuery] = useState('')
  const [budget, setBudget] = useState('')
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  async function submit(e) {
    e?.preventDefault?.()
    if (!query.trim()) { setError('Please describe what you want to compare.'); return }
    setError(null); setLoading(true); setResult(null)
    try {
      const r = await fetch(`${API}/api/smart-compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, budget: budget || undefined, location: location || undefined, category: category || undefined }),
      })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.error || 'Comparison failed')
      setResult(j)
      // Scroll to result
      setTimeout(() => {
        document.getElementById('sc-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="sc-page">
      <div className="sc-bg" />

      <section className="container sc-hero">
        <Link to="/services" className="sc-back">← Back to search</Link>

        <div className="sc-pill"><span>✦</span> AI-Powered Smart Compare</div>
        <h1 className="sc-title">
          Tell us what you want.<br />
          <span className="sc-grad">We'll compare everything.</span>
        </h1>
        <p className="sc-sub">
          Vehicles, home services, insurance, electronics — any category. Get a side-by-side
          comparison with pros, cons, financing math, and current promotions in one shot.
        </p>

        <form className="sc-card" onSubmit={submit}>
          <label className="sc-label">WHAT ARE YOU LOOKING FOR?</label>
          <textarea
            className="sc-textarea"
            placeholder="e.g. I'm in the GTA, budget $60k, open to gas / hybrid / EV. Lease or finance? Any promos?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
          />

          <div className="sc-row">
            <div className="sc-field">
              <label className="sc-label">BUDGET (MAX $)</label>
              <input className="sc-input" type="number" placeholder="60000" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </div>
            <div className="sc-field">
              <label className="sc-label">LOCATION</label>
              <input className="sc-input" placeholder="Toronto, ON" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="sc-field">
              <label className="sc-label">CATEGORY (OPTIONAL)</label>
              <input className="sc-input" placeholder="vehicle, plumber, TV..." value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
          </div>

          <div className="sc-foot">
            <div className="sc-note">🗄️ We blend our vendor network with AI-curated options.</div>
            <button type="submit" className="sc-submit" disabled={loading}>
              {loading ? (<><span className="sc-spinner" /> Comparing…</>) : (<><span>📤</span> Compare for me</>)}
            </button>
          </div>

          {error && <div className="sc-error">⚠ {error}</div>}

          <hr className="sc-divider" />

          <div className="sc-examples">
            <div className="sc-label">TRY AN EXAMPLE</div>
            <div className="sc-examples-grid">
              {EXAMPLES.map((ex, i) => (
                <button key={i} type="button" className="sc-example" onClick={() => setQuery(ex)} title={ex}>
                  {ex.length > 80 ? ex.slice(0, 80) + '…' : ex}
                </button>
              ))}
            </div>
          </div>
        </form>
      </section>

      {result && (
        <section id="sc-result" className="container sc-result-wrap">
          <div className="sc-result-tag">YOUR COMPARISON</div>
          <h2 className="sc-result-title">Here's your side-by-side</h2>
          <ResultDashboard data={result} />
        </section>
      )}

      {!result && (
        <section className="container sc-sample-wrap">
          <div className="sc-sample-head">
            <div>
              <div className="sc-sample-tag">SAMPLE RESULT</div>
              <h2 className="sc-sample-title">Here's what a comparison looks like</h2>
            </div>
            <div className="sc-sample-eg">Example: vehicles under $60K in the GTA</div>
          </div>
          <ResultDashboard data={SAMPLE_RESULT} sample />
        </section>
      )}
    </div>
  )
}
