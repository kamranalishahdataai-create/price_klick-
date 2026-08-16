import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles, Search, ArrowRight, Ticket, ScanLine, Store,
  Upload, Camera, Tag, Loader2, Lock,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { GUEST_LIMIT, guestLeft, guestSpend } from '../utils/guestLimit'
import './KlickLanding.css'
import './Demo.css'

const API = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || ''

/* ---------------- Coupon generator (free, unlimited) ---------------- */
function CouponGeneratorDemo() {
  const { isAuthenticated } = useAuth()
  const [store, setStore] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [coupons, setCoupons] = useState(null)
  const [left, setLeft] = useState(() => guestLeft('coupons'))

  const examples = ['pizzapizza.ca', 'quick auto repair', 'bestbuy.ca']
  const blocked = !isAuthenticated && left <= 0

  async function generate(value) {
    const q = (value ?? store).trim()
    if (!q || loading) return
    if (blocked) return
    setStore(q); setLoading(true); setError(null); setCoupons(null)
    try {
      const r = await fetch(`${API}/api/coupons/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store: q }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Could not fetch codes')
      setCoupons(Array.isArray(data.coupons) ? data.coupons : [])
      if (!isAuthenticated) setLeft(guestSpend('coupons'))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="kl-glass-strong dm-card">
      <div className="dm-card-head">
        <div className="kl-icon-tile dm-tile"><Ticket className="kl-ic" /></div>
        <div className="dm-lens-headtext">
          <h2 className="dm-card-title">Coupon generator</h2>
          <p className="kl-muted dm-card-sub">Every working code, found and tested in seconds.</p>
        </div>
        {!isAuthenticated && <span className="dm-uploads-left">{left} of {GUEST_LIMIT} free left</span>}
      </div>

      {blocked ? (
        <GuestLimitNotice label="coupon lookups" />
      ) : (
        <>
          <form className="dm-input-row" onSubmit={(e) => { e.preventDefault(); generate() }}>
            <div className="dm-input-wrap">
              <Store className="kl-ic-sm dm-input-ic" />
              <input
                className="dm-input"
                placeholder="Store or checkout URL — e.g. pizzapizza.ca"
                value={store}
                onChange={(e) => setStore(e.target.value)}
              />
            </div>
            <button type="submit" className="kl-btn kl-btn-brand dm-gen-btn" disabled={loading}>
              {loading ? <Loader2 className="kl-ic dm-spin" /> : <Sparkles className="kl-ic" />} Generate codes
            </button>
          </form>

          <div className="dm-chips">
            {examples.map((ex) => (
              <button key={ex} type="button" className="dm-chip" onClick={() => generate(ex)}>{ex}</button>
            ))}
          </div>

          <div className="dm-result">
            {error && <p className="dm-error">⚠ {error}</p>}
            {!error && !coupons && !loading && (
              <p className="kl-muted dm-empty">Pick a store above and watch PriceKlick pull every live code.</p>
            )}
            {loading && <p className="kl-muted dm-empty">Pulling live codes for <strong>{store}</strong>…</p>}
            {coupons && coupons.length === 0 && (
              <p className="kl-muted dm-empty">No public codes found right now — install the extension and we'll catch them at checkout.</p>
            )}
            {coupons && coupons.length > 0 && (
              <div className="dm-codes">
                {coupons.map((c, i) => (
                  <div key={i} className="dm-code-row">
                    <span className="dm-code"><Tag className="kl-ic-sm kl-success" /> {c.code}</span>
                    <span className="dm-code-desc">{c.description || (c.discount ? `${c.discount}${c.type === 'PERCENT' ? '%' : ''} off` : 'Deal')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* Shown when a guest has used all 3 free tries of a tool. */
function GuestLimitNotice({ label }) {
  return (
    <div className="dm-limit">
      <div className="dm-limit-ic"><Lock className="kl-ic-lg" /></div>
      <p className="dm-limit-title">You've used your {GUEST_LIMIT} free {label}</p>
      <p className="kl-muted dm-xs">Create a free account to keep going — unlimited for members.</p>
      <div className="dm-limit-actions">
        <Link to="/register" className="kl-btn kl-btn-brand">Sign up free</Link>
        <Link to="/install" className="kl-btn kl-btn-glass"><Upload className="kl-ic-sm" /> Install</Link>
      </div>
    </div>
  )
}

/* ---------------- JustKlick lens (funnels to the full /lens experience) ---------------- */
function LensUploadDemo() {
  return (
    <div className="kl-glass-strong dm-card">
      <div className="dm-card-head">
        <div className="kl-icon-tile dm-tile"><ScanLine className="kl-ic" /></div>
        <div className="dm-lens-headtext">
          <h2 className="dm-card-title">JustKlick lens</h2>
          <p className="kl-muted dm-card-sub">Snap any product — we identify it and find it cheaper.</p>
        </div>
      </div>

      <Link to="/lens" className="dm-drop dm-drop-link">
        <div className="dm-drop-inner">
          <Camera className="dm-drop-ic" />
          <p className="kl-muted">Run the live sample scan to see JustKlick in action.</p>
        </div>
      </Link>

      <div className="dm-lens-actions">
        <Link to="/lens" className="kl-btn kl-btn-brand dm-lens-full-btn">
          <Sparkles className="kl-ic" /> Run sample scan
        </Link>
      </div>
    </div>
  )
}

/* ---------------- Page ---------------- */
export default function Demo() {
  return (
    <div className="kl-landing">
      <div className="dm-page">
        <div className="dm-hero">
          <div className="kl-badge"><Sparkles className="kl-ic-sm kl-accent" /> Live demo · no account needed</div>
          <h1 className="kl-h1 dm-h1">Watch it <span className="kl-grad">work</span></h1>
          <p className="kl-lead">
            Two tools, one klick each. Generate real coupon codes for any store, then try the
            JustKlick lens — guests get 3 free photo lookups and 3 free service searches.
          </p>
        </div>

        {/* Intro video */}
        <div className="kl-glass-strong dm-video">
          <video className="dm-video-el" controls preload="metadata" playsInline>
            <source src="/priceklick-intro.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>

        {/* Tool cards */}
        <div className="dm-tools">
          <CouponGeneratorDemo />
          <LensUploadDemo />
        </div>

        {/* Service search banner */}
        <div className="kl-glass-strong dm-banner">
          <div className="dm-banner-left">
            <div className="kl-icon-tile dm-tile"><Search className="kl-ic" /></div>
            <div>
              <h2 className="dm-banner-title">Try 3 free service searches</h2>
              <p className="kl-muted dm-card-sub">Compare local providers, menus and prices in your area. Three searches on the house.</p>
            </div>
          </div>
          <Link to="/services" className="kl-btn kl-btn-brand dm-banner-cta">
            Search services <ArrowRight className="kl-ic" />
          </Link>
        </div>
      </div>
    </div>
  )
}
