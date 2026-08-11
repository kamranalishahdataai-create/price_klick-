import React, { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles, Search, ArrowRight, Ticket, ScanLine, Store,
  Upload, Camera, Tag, Loader2,
} from 'lucide-react'
import './KlickLanding.css'
import './Demo.css'

const API = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || ''
const LENS_LIMIT = 3
const LENS_KEY = 'pk_demo_lens_left'

/* ---------------- Coupon generator (free, unlimited) ---------------- */
function CouponGeneratorDemo() {
  const [store, setStore] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [coupons, setCoupons] = useState(null)

  const examples = ['pizzapizza.ca', 'quick auto repair', 'bestbuy.ca']

  async function generate(value) {
    const q = (value ?? store).trim()
    if (!q) return
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
        <div>
          <h2 className="dm-card-title">Coupon generator</h2>
          <p className="kl-muted dm-card-sub">Every working code, found and tested in seconds. Free, unlimited.</p>
        </div>
      </div>

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
    </div>
  )
}

/* ---------------- JustKlick lens (3 free guest lookups) ---------------- */
function LensUploadDemo() {
  const [left, setLeft] = useState(() => {
    const v = Number(localStorage.getItem(LENS_KEY))
    return Number.isFinite(v) && v > 0 && v <= LENS_LIMIT ? v : LENS_LIMIT
  })
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const fileRef = useRef(null)

  const decrement = () => {
    setLeft((n) => {
      const next = Math.max(0, n - 1)
      localStorage.setItem(LENS_KEY, String(next))
      return next
    })
  }

  async function analyze(image) {
    setLoading(true); setError(null); setResult(null)
    try {
      const r = await fetch(`${API}/api/promo/find-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      })
      const data = await r.json()
      if (!r.ok || !data.ok) throw new Error(data.error || 'Scan failed')
      setResult(data)
      decrement()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function onFile(file) {
    if (!file || !file.type.startsWith('image/') || left <= 0) return
    setPreview(URL.createObjectURL(file))
    const reader = new FileReader()
    reader.onload = () => analyze(reader.result)
    reader.readAsDataURL(file)
  }

  const bestUrl = result && (result.redirectUrl || result.productUrl || null)

  return (
    <div className="kl-glass-strong dm-card">
      <div className="dm-card-head">
        <div className="kl-icon-tile dm-tile"><ScanLine className="kl-ic" /></div>
        <div className="dm-lens-headtext">
          <h2 className="dm-card-title">JustKlick lens</h2>
          <p className="kl-muted dm-card-sub">Snap or upload any product — we find it cheaper.</p>
        </div>
        <span className="dm-uploads-left">{left} of {LENS_LIMIT} uploads left</span>
      </div>

      <div
        className={`dm-drop ${left <= 0 ? 'dm-drop-disabled' : ''}`}
        onClick={() => left > 0 && fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]) }}
      >
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        {loading ? (
          <div className="dm-drop-inner"><Loader2 className="dm-drop-ic dm-spin" /><p className="kl-muted">Scanning for a cheaper price…</p></div>
        ) : result ? (
          <div className="dm-lens-result">
            {preview && <img src={preview} alt="scanned" className="dm-lens-thumb" />}
            <div className="dm-lens-info">
              <p className="dm-lens-brand">{result.brand || result.productCategory || 'Product identified'}</p>
              <p className="kl-muted dm-xs">{result.products?.[0] || result.promotionTitle || 'Match found'}</p>
              {bestUrl && (
                <a href={bestUrl} target="_blank" rel="noopener noreferrer" className="kl-btn kl-btn-brand dm-lens-cta">
                  See it cheaper <ArrowRight className="kl-ic-sm" />
                </a>
              )}
            </div>
          </div>
        ) : left <= 0 ? (
          <div className="dm-drop-inner">
            <Camera className="dm-drop-ic" />
            <p className="kl-muted">You've used your 3 free lookups.</p>
            <Link to="/install" className="kl-btn kl-btn-brand dm-lens-cta"><Upload className="kl-ic-sm" /> Install free to keep going</Link>
          </div>
        ) : (
          <div className="dm-drop-inner">
            {preview ? <img src={preview} alt="preview" className="dm-lens-thumb" /> : <Camera className="dm-drop-ic" />}
            <p className="kl-muted">Upload a product photo, or run the sample scan</p>
          </div>
        )}
      </div>

      {error && <p className="dm-error">⚠ {error}</p>}

      <div className="dm-lens-actions">
        <button type="button" className="kl-btn kl-btn-brand" disabled={left <= 0 || loading} onClick={() => fileRef.current?.click()}>
          <Upload className="kl-ic" /> Upload photo
        </button>
        <Link to="/lens" className="kl-btn kl-btn-glass">
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
