import React, { useState } from 'react'
import './PrePay.css'

const RECS = [
  { id: 1, cat: 'ENTERTAINMENT', type: 'Subscribe & Save', name: 'Streaming bundle',     blurb: 'Switch from 3 separate streaming subs to a yearly bundle.', mCur: 45,  mNew: 28,  yCur: 540,  yNew: 336,  off: 38 },
  { id: 2, cat: 'FITNESS',       type: 'Subscribe & Save', name: 'Gym membership',       blurb: 'Annual prepay saves 25% vs monthly billing.',               mCur: 75,  mNew: 56,  yCur: 900,  yNew: 672,  off: 25 },
  { id: 3, cat: 'FOOD & DRINK',  type: 'Cheaper Alternative', name: 'Coffee shop alternative', blurb: 'A cheaper local roaster with same quality beans.',     mCur: 150, mNew: 85,  yCur: 1800, yNew: 1020, off: 43 },
  { id: 4, cat: 'SOFTWARE',      type: 'Bulk Pre-Purchase', name: 'Cloud storage',       blurb: 'Lifetime plan available — pays back in 14 months.',         mCur: 12,  mNew: 4,   yCur: 144,  yNew: 48,   off: 67 },
  { id: 5, cat: 'UTILITIES',     type: 'Cheaper Alternative', name: 'Internet provider', blurb: 'Competitor offers same speed for less in your area.',       mCur: 95,  mNew: 65,  yCur: 1140, yNew: 780,  off: 32 },
  { id: 6, cat: 'FOOD & DRINK',  type: 'Bulk Pre-Purchase', name: 'Meal kit subscription', blurb: 'Bulk-buy 3 months upfront for 20% off.',                  mCur: 240, mNew: 192, yCur: 2880, yNew: 2304, off: 20 },
]

const SNAPSHOT = [
  { label: 'Streaming bundle', val: '−$204/yr' },
  { label: 'Gym membership',   val: '−$228/yr' },
  { label: 'Coffee shop alternative', val: '−$780/yr' },
]

const fmt = (n) => n >= 1000 ? `$${(n/1000).toFixed(1)}k` : `$${n}`

function RecCard({ r, onActivate, activated }) {
  return (
    <div className={`pp-rec ${activated ? 'activated' : ''}`}>
      <div className="pp-rec-tags">
        <span className="pp-rec-cat">{r.cat}</span>
        <span className="pp-rec-type">{r.type}</span>
      </div>
      <h3 className="pp-rec-name">{r.name}</h3>
      <p className="pp-rec-blurb">{r.blurb}</p>

      <div className="pp-rec-grid">
        <div className="pp-rec-col">
          <div className="pp-rec-period">MONTHLY</div>
          <div className="pp-rec-row"><span>Current</span><span className="pp-rec-cur">${r.mCur}/mo</span></div>
          <div className="pp-rec-row"><span>PrePay</span><span className="pp-rec-new">${r.mNew}/mo</span></div>
          <div className="pp-rec-row pp-rec-save"><span>You save</span><span>${r.mCur - r.mNew}/mo</span></div>
        </div>
        <div className="pp-rec-col">
          <div className="pp-rec-period">YEARLY</div>
          <div className="pp-rec-row"><span>Current</span><span className="pp-rec-cur">{fmt(r.yCur)}/yr</span></div>
          <div className="pp-rec-row"><span>PrePay</span><span className="pp-rec-new">{fmt(r.yNew)}/yr</span></div>
          <div className="pp-rec-row pp-rec-save"><span>You save</span><span>${r.yCur - r.yNew}/yr</span></div>
        </div>
      </div>

      <div className="pp-rec-foot">
        <span className="pp-off">{r.off}% off</span>
        <button className="pp-rec-cta" onClick={() => onActivate(r.id)}>
          {activated ? '✓ Activated' : 'Activate Pre-Pay'}
        </button>
      </div>
    </div>
  )
}

export default function PrePay() {
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [activated, setActivated] = useState({})

  const totalMonthly = RECS.reduce((s, r) => s + (r.mCur - r.mNew), 0)
  const totalYearly = RECS.reduce((s, r) => s + (r.yCur - r.yNew), 0)

  const runScan = () => {
    setScanning(true)
    setTimeout(() => { setScanning(false); setScanned(true) }, 2200)
  }

  return (
    <div className="pp-page">
      <div className="pp-bg" />

      <section className="container pp-hero">
        <span className="pp-badge">⚡ AI-Powered Savings Analyzer</span>
        <h1 className="pp-title">
          <span>PrePay &amp;</span>
          <span className="pp-title-grad">Save</span>
        </h1>
        <p className="pp-sub">
          Our AI reads your monthly spending and recommends the smartest monthly or yearly
          subscriptions, bundles, and bulk pre-pays — tailored to your actual habits.
        </p>
        <span className="pp-live">● Live AI Analyzer</span>
      </section>

      <section className="container pp-scan">
        <div className="pp-scan-grid">
          <div className="pp-scan-left">
            <h2>Scan your monthly spending</h2>
            <p>Our model looks at recurring charges, category trends, and price history to recommend whether you'd save more on a monthly plan, a yearly prepay, or a switch entirely.</p>
            <div className="pp-scan-cta">
              <button className="pp-btn primary" onClick={runScan} disabled={scanning}>
                {scanning ? 'Scanning…' : '⚡ Run AI scan'}
              </button>
              <button className="pp-btn ghost">📄 Upload statement</button>
            </div>
            <div className="pp-scan-note">🔒 Read-only, encrypted, never sold. You stay in control.</div>
          </div>

          <div className="pp-snapshot">
            <div className="pp-snapshot-head">
              <span className="pp-tag-mini">AI ANALYSIS SNAPSHOT</span>
              <span className={`pp-status ${scanning ? 'scanning' : (scanned ? 'ready' : 'idle')}`}>
                {scanning ? '● Scanning' : (scanned ? '● Ready' : '○ Idle')}
              </span>
            </div>
            <div className="pp-snapshot-stats">
              <div>
                <div className="pp-stat-label">MONTHLY SPEND</div>
                <div className="pp-stat-val">$617</div>
              </div>
              <div>
                <div className="pp-stat-label">SUBS DETECTED</div>
                <div className="pp-stat-val">6</div>
              </div>
              <div>
                <div className="pp-stat-label">EST. SAVINGS</div>
                <div className="pp-stat-val pp-stat-green">$2,244<span>/yr</span></div>
              </div>
            </div>
            <div className="pp-snapshot-list">
              {SNAPSHOT.map(s => (
                <div key={s.label} className="pp-snap-row">
                  <span>{s.label}</span>
                  <span className="pp-snap-val">{s.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container pp-steps">
        {[
          { n: 1, t: 'Connect spending', d: 'Securely link your bank, card, or upload a statement — read-only.' },
          { n: 2, t: 'AI scans patterns', d: 'We detect recurring charges, duplicates, and category overspend.' },
          { n: 3, t: 'Forecast & compare', d: 'We model monthly vs yearly plans, bundles, and cheaper alternatives.' },
          { n: 4, t: 'Personalized PrePay', d: 'Get a ranked list of switches with exact monthly and yearly savings.' },
        ].map(s => (
          <div key={s.n} className="pp-step">
            <div className="pp-step-n">Step {s.n}</div>
            <h3>{s.t}</h3>
            <p>{s.d}</p>
          </div>
        ))}
      </section>

      <section className="container pp-totals">
        <div className="pp-total-card">
          <div className="pp-tag-mini">POTENTIAL MONTHLY SAVINGS</div>
          <div className="pp-total-val">${totalMonthly}<span>/mo</span></div>
          <div className="pp-total-note">Across {RECS.length} AI recommendations</div>
        </div>
        <div className="pp-total-card pp-total-yearly">
          <div className="pp-tag-mini">POTENTIAL YEARLY SAVINGS</div>
          <div className="pp-total-val">${totalYearly.toLocaleString()}<span>/yr</span></div>
          <div className="pp-total-note">Activate any below to start saving</div>
        </div>
      </section>

      <section className="container pp-recs">
        <div className="pp-recs-head">
          <div>
            <h2>AI Recommendations</h2>
            <p>Ranked by yearly savings</p>
          </div>
        </div>
        <div className="pp-recs-grid">
          {RECS.map(r => (
            <RecCard
              key={r.id}
              r={r}
              activated={!!activated[r.id]}
              onActivate={(id) => setActivated(a => ({ ...a, [id]: !a[id] }))}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
