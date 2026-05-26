import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import './SmartCompare.css'

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

function FitBadge({ score }) {
  const cls = score >= 90 ? 'top' : score >= 85 ? 'good' : 'ok'
  return <div className={`sc-fit ${cls}`}>{score}%<span>Fit Score</span></div>
}

function OptionCard({ o }) {
  const lg = brandLogo(o.brand)
  return (
    <div className="sc-option">
      <div className="sc-option-head">
        <FitBadge score={o.fitScore || 0} />
        <div className="sc-option-id">
          <div className="sc-option-logo" style={{ background: lg.bg }}>{lg.initial}</div>
          <div>
            <div className="sc-option-brand">{o.brand}</div>
            <div className="sc-option-model">{o.model}</div>
          </div>
        </div>
      </div>
      {o.image
        ? <img className="sc-option-img" src={o.image} alt={`${o.brand} ${o.model}`} loading="lazy" />
        : <div className="sc-option-img placeholder">{o.brand}</div>}
      {o.tag && <span className="sc-option-tag">⚡ {o.tag}</span>}
      <div className="sc-option-price">
        <strong>{o.price}</strong>
        <span>{o.priceLabel || ''}</span>
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
      {o.url && <a className="sc-view-details" href={o.url} target="_blank" rel="noopener noreferrer">View Details →</a>}
    </div>
  )
}

function PromoCard({ p }) {
  const lg = brandLogo(p.brand)
  return (
    <div className="sc-promo">
      <div className="sc-promo-logo" style={{ background: lg.bg }}>{lg.initial}</div>
      <div className="sc-promo-body">
        <div className="sc-promo-brand">{p.brand}</div>
        <div className="sc-promo-title">{p.title}</div>
        {p.expiry && <div className="sc-promo-meta">🕒 {p.expiry}</div>}
        {p.detail && !p.expiry && <div className="sc-promo-meta">{p.detail}</div>}
      </div>
    </div>
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

function ResultDashboard({ data, sample = false }) {
  if (!data) return null
  const updated = data.updatedAt ? new Date(data.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''
  return (
    <div className={`sc-dash ${sample ? 'sample' : ''}`}>
      <div className="sc-dash-top">
        <div className="sc-dash-brand">✦ AI-Powered Smart Compare</div>
      </div>
      <div className="sc-dash-summary">
        <div className="sc-dash-quote">💬 {data.summary}</div>
        <div className="sc-dash-meta">
          Analyzed {Number(data.analyzedCount || 0).toLocaleString()} options · {data.vendorsCount || 0} vendors
          {updated && ` · Updated ${updated}`}
        </div>
      </div>

      {data.promotions?.length > 0 && (
        <div className="sc-dash-section">
          <div className="sc-dash-h">🎟️ Current Promotions <span className="sc-dash-view">View all →</span></div>
          <div className="sc-dash-promos">
            {data.promotions.slice(0, 4).map((p, i) => <PromoCard key={i} p={p} />)}
          </div>
        </div>
      )}

      {data.financeVsLease && <FinanceVsLease fl={data.financeVsLease} />}

      {data.options?.length > 0 && (
        <div className="sc-dash-section sc-dash-options">
          {data.options.slice(0, 4).map((o, i) => <OptionCard key={i} o={o} />)}
        </div>
      )}
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
