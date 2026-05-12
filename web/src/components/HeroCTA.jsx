import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './HeroCTA.css'

function CheckoutDemo(){
  const codes = [
    { code: 'SAVE15', status: 'Applied', done: true },
    { code: 'WELCOME10', status: 'Testing...', done: false },
    { code: 'FREESHIP', status: 'Testing...', done: false },
    { code: 'EXTRA20', status: 'Queued', done: false },
  ]
  const [progress, setProgress] = useState(16)
  useEffect(() => {
    const id = setInterval(() => setProgress(p => (p >= 96 ? 16 : p + 4)), 220)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="checkout-demo">
      <div className="cd-bar">
        <span className="cd-dot r" />
        <span className="cd-dot y" />
        <span className="cd-dot g" />
        <div className="cd-url">checkout.shop.com/cart</div>
      </div>
      <div className="cd-body">
        <div className="cd-row">
          <div className="cd-logo">✦</div>
          <div style={{flex:1}}>
            <div className="cd-title">PriceKlick</div>
            <div className="cd-sub">Scanning checkout…</div>
          </div>
          <span className="cd-pill-free">Free</span>
        </div>

        <div className="cd-progress-row">
          <span>Testing coupons</span>
          <span className="cd-count">{Math.round(progress/100*24)} / 24</span>
        </div>
        <div className="cd-progress">
          <div className="cd-progress-fill" style={{ width: progress + '%' }} />
        </div>

        <div className="cd-grid">
          <div className="cd-tile">
            <div className="cd-tile-label">Codes tested</div>
            <div className="cd-tile-value">{Math.round(progress/100*24)}</div>
          </div>
          <div className="cd-tile">
            <div className="cd-tile-label">You save</div>
            <div className="cd-tile-value cd-savings">$8.10</div>
          </div>
        </div>

        <div className="cd-codes">
          {codes.map((c,i) => (
            <div key={c.code} className={'cd-code ' + (c.done ? 'done' : '')} style={{ animationDelay: (i*0.15)+'s' }}>
              <span className="cd-check">✓</span>
              <span className="cd-code-name">{c.code}</span>
              <span className="cd-code-status">{c.status}</span>
            </div>
          ))}
        </div>

        <button className="cd-apply">Apply Best Code</button>
        <div className="cd-secure">🛡 Secure &amp; private — no tracking</div>
      </div>
    </div>
  )
}

export default function HeroCTA({ title = 'Save money', subtitle, accent = 'automatically' }){
  return (
    <div className="hero">
      <div className="container hero-grid">
        <div className="hero-left">
          <div className="hero-pill">✦ Smart Savings, Automated</div>
          <h1 className="hero-title">
            <span className="hero-title-1">{title}</span>
            <span className="hero-title-2">{accent}</span>
          </h1>
          <p className="hero-sub">
            {subtitle || 'PriceKlick is the smart browser companion that scans, tests, and stacks the best coupon codes at checkout — in under three seconds. Always free.'}
          </p>
          <div className="hero-cta">
            <Link to="/install" className="btn-hero-primary">Add to Chrome — Free <span>→</span></Link>
            <Link to="/lens?demo=1" className="btn-hero-ghost">View Demo</Link>
          </div>
          <div className="hero-free-pill">✓ 100% free</div>
        </div>
        <div className="hero-right">
          <CheckoutDemo />
        </div>
      </div>
    </div>
  )
}
