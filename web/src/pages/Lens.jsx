import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import './Lens.css'

const API = import.meta.env.VITE_API_URL || ''

const DEMO_RESULT = {
  ok: true,
  brand: 'Nike',
  products: ['Nike Air Max 270 React — Black/White'],
  promotionTitle: 'Nike Air Max 270 React',
  productCategory: 'Shoes',
  discountAmount: '25%',
  promotionDescription: 'Classic Nike Air Max 270 React with a sleek black and white colorway. Lightweight cushioning, breathable mesh upper, and a bold React foam midsole.',
  coupons: [{ code: 'SAVE25', description: '25% off sitewide' }, { code: 'FREESHIP', description: 'Free shipping' }],
  productPrice: { sale: '$112.49', original: '$149.99' },
  redirectUrl: 'https://www.nike.com/t/air-max-270-react',
  checkoutUrl: 'https://www.nike.com/cart',
  hasDirectProductMatch: true,
  similarProducts: [
    { title: 'Nike Air Max 270 React — Phantom', url: 'https://www.nike.com', price: '$119.99', source: 'Nike', thumbnail: '' },
    { title: 'Nike Air Max 90 — Triple Black', url: 'https://www.nike.com', price: '$129.99', source: 'Nike', thumbnail: '' },
    { title: 'Nike Pegasus 40 — Black/White', url: 'https://www.nike.com', price: '$140.00', source: 'Nike', thumbnail: '' },
  ],
  urlSource: 'SERP-verified',
  confidence: 'high'
}

// === Geo + price helpers ===
const COUNTRY_TLDS = {
  CA: ['.ca'],
  GB: ['.co.uk', '.uk'],
  UK: ['.co.uk', '.uk'],
  AU: ['.com.au', '.au'],
  IN: ['.co.in', '.in'],
  DE: ['.de'],
  FR: ['.fr'],
  IT: ['.it'],
  ES: ['.es'],
  JP: ['.co.jp', '.jp'],
  BR: ['.com.br', '.br'],
  MX: ['.com.mx', '.mx'],
  NZ: ['.co.nz', '.nz'],
  IE: ['.ie'],
  SG: ['.sg'],
  AE: ['.ae'],
  ZA: ['.co.za'],
}

function parsePrice(str) {
  if (str == null) return null
  if (typeof str === 'number') return str
  const m = String(str).replace(/,/g, '').match(/([\d]+(?:\.[\d]+)?)/)
  return m ? parseFloat(m[1]) : null
}

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase() } catch { return '' }
}

function matchesCountry(url, country) {
  if (!country) return false
  const host = hostOf(url)
  if (!host) return false
  const tlds = COUNTRY_TLDS[country.toUpperCase()]
  if (tlds) return tlds.some(t => host.endsWith(t))
  // US fallback: most .com hosts ship US
  if (country.toUpperCase() === 'US') return host.endsWith('.com') || host.endsWith('.us')
  return false
}

function buildOptions(data) {
  const opts = []
  const mainUrl = data.productUrl || data.redirectUrl || data.checkoutUrl
  const mainPrice = parsePrice(data.productPrice?.sale || data.productPrice?.original || data.mainProductImage?.price)
  if (mainUrl) {
    opts.push({
      url: mainUrl,
      price: mainPrice,
      source: data.mainProductImage?.merchant || data.brand || hostOf(mainUrl),
      title: data.products?.[0] || data.promotionTitle,
      thumbnail: data.mainProductImage?.thumbnail,
      isMain: true,
    })
  }
  (data.similarProducts || []).forEach(p => {
    if (!p?.url) return
    opts.push({
      url: p.url,
      price: parsePrice(p.price),
      source: p.source || hostOf(p.url),
      title: p.title,
      thumbnail: p.thumbnail,
    })
  })
  return opts
}

function pickCheapestNearby(options, country) {
  if (!options.length) return null
  const priced = options.filter(o => o.price != null && o.price > 0)
  const pool = priced.length ? priced : options
  if (country) {
    const local = pool.filter(o => matchesCountry(o.url, country))
    if (local.length) {
      const lp = local.filter(o => o.price != null)
      return (lp.length ? lp : local).sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))[0]
    }
  }
  return pool.slice().sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))[0]
}

export default function Lens() {
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [autoRedirect, setAutoRedirect] = useState(true)
  const [countdown, setCountdown] = useState(null)
  const [demo, setDemo] = useState(false)
  const [demoStep, setDemoStep] = useState(0)
  const [geo, setGeo] = useState({ country: null, label: null, source: null })
  const [resultTab, setResultTab] = useState('compare')
  const countdownRef = useRef(null)
  const demoRef = useRef(null)
  const fileRef = useRef()
  const [searchParams, setSearchParams] = useSearchParams()

  const hasDirectProductMatch = result?.hasDirectProductMatch !== false
  const cheapest = useMemo(() => {
    if (!result) return null
    return pickCheapestNearby(buildOptions(result), geo.country)
  }, [result, geo.country])

  useEffect(() => {
    if (searchParams.get('demo') === '1') {
      searchParams.delete('demo')
      setSearchParams(searchParams, { replace: true })
      setTimeout(() => runDemo(), 300)
    }
    // Resolve user country: IP-based first (no permission), upgrade via geolocation
    ;(async () => {
      try {
        const r = await fetch('https://ipapi.co/json/').then(x => x.json()).catch(() => null)
        if (r?.country_code) {
          setGeo({ country: r.country_code, label: [r.city, r.region, r.country_name].filter(Boolean).join(', '), source: 'ip' })
        }
      } catch {}
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          try {
            const { latitude, longitude } = pos.coords
            const rev = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`).then(x => x.json())
            if (rev?.countryCode) {
              setGeo({
                country: rev.countryCode,
                label: [rev.city || rev.locality, rev.principalSubdivision, rev.countryName].filter(Boolean).join(', '),
                source: 'gps',
              })
            }
          } catch {}
        }, () => {}, { timeout: 5000, maximumAge: 600000 })
      }
    })()
    return () => {
      clearInterval(countdownRef.current)
      clearTimeout(demoRef.current)
    }
  }, []) // eslint-disable-line

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    setError(null)
    setResult(null)
    setPreview(URL.createObjectURL(file))
    const reader = new FileReader()
    reader.onload = () => setImage(reader.result)
    reader.readAsDataURL(file)
  }, [])

  const analyze = async () => {
    if (!image) return
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch(`${API}/api/promo/find-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image })
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Analysis failed')
      setResult(data)
      setResultTab('compare')
      const best = pickCheapestNearby(buildOptions(data), geo.country)
      // Redirect priority: 1) promotion if one was detected, 2) the same/similar
      // product on any site, 3) cheapest nearby match, 4) checkout/home as last resort.
      const hasPromo = !!(data.discountAmount || (data.coupons && data.coupons.length) || data.promotionTitle)
      const promoUrl = hasPromo ? (data.redirectUrl || data.productUrl) : null
      const url = promoUrl || data.productUrl || best?.url || data.redirectUrl || data.checkoutUrl
      if (autoRedirect && url) {
        setCountdown(3)
        let t = 3
        countdownRef.current = setInterval(() => {
          t -= 1; setCountdown(t)
          if (t <= 0) {
            clearInterval(countdownRef.current)
            window.open(url, '_blank', 'noopener,noreferrer')
          }
        }, 1000)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    clearInterval(countdownRef.current); setCountdown(null)
    setImage(null); setPreview(null); setResult(null); setError(null)
  }
  const cancelRedirect = () => { clearInterval(countdownRef.current); setCountdown(null) }
  const runDemo = () => {
    reset(); setDemo(true); setDemoStep(1)
    demoRef.current = setTimeout(() => {
      setDemoStep(2)
      demoRef.current = setTimeout(() => {
        setDemoStep(3); setResult(DEMO_RESULT)
      }, 2000)
    }, 1000)
  }
  const exitDemo = () => { clearTimeout(demoRef.current); setDemo(false); setDemoStep(0); reset() }
  const webSearch = () => {
    const q = result?.products?.[0] || result?.promotionTitle || result?.brand || ''
    if (q) window.open(`https://www.google.com/search?q=${encodeURIComponent(q + ' buy online')}`, '_blank', 'noopener')
  }

  return (
    <div className="lens-page">
      <div className="lens-bg" />

      <section className="container lens-hero">
        <span className="lens-pill">✦ AI-Powered Visual Search</span>
        <h1 className="lens-title">
          <span>Snap it.</span>
          <span className="lens-grad">Find it. Buy it.</span>
        </h1>
        <p className="lens-sub">
          Upload any product photo, promo flyer, or screenshot — our AI identifies the exact
          brand, model, and best place to buy online.
        </p>
        <span className="lens-live">● AI vision online</span>
        {geo.country && (
          <span className="lens-geo">📍 Cheapest near {geo.label || geo.country}</span>
        )}
      </section>

      <section className="container lens-spread">
        <div className="lens-spread-grid">
          {/* LEFT — uploader + result */}
          <div
            className={`lens-card ${dragOver ? 'drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragOver(false)
              handleFile(e.dataTransfer.files?.[0])
            }}
          >
            <div className="lens-card-head">
              <span className="lens-tag-mini">✦ JUSTKLICK LENS</span>
              {!demo && !result && (
                <button className="lens-mini-btn" onClick={runDemo}>▶ Try demo</button>
              )}
              {demo && (
                <button className="lens-mini-btn" onClick={exitDemo}>✕ Exit demo</button>
              )}
            </div>

            {!result && (
              <>
                <h2 className="lens-card-title">Upload a product photo</h2>
                <p className="lens-card-sub">
                  Drop in any image — we'll identify the product and surface the cheapest online buy link.
                </p>

                <div
                  className="lens-drop"
                  onClick={() => fileRef.current?.click()}
                >
                  {preview ? (
                    <img src={preview} alt="preview" className="lens-preview" />
                  ) : (
                    <>
                      <div className="lens-drop-icon">📷</div>
                      <div className="lens-drop-title">Click to upload or drag &amp; drop</div>
                      <div className="lens-drop-hint">Product photo · flyer · screenshot — JPG · PNG · HEIC</div>
                    </>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
                </div>

                <div className="lens-actions">
                  <button className="lens-btn primary" onClick={analyze} disabled={!image || loading}>
                    {loading ? '🔄 Analyzing…' : '🔍 Find This Product'}
                  </button>
                  {preview && !loading && (
                    <button className="lens-btn ghost" onClick={reset}>✕ Clear</button>
                  )}
                  <label className="lens-toggle">
                    <input type="checkbox" checked={autoRedirect} onChange={() => setAutoRedirect(!autoRedirect)} />
                    <span>Auto-open checkout</span>
                  </label>
                </div>

                {demo && demoStep <= 2 && (
                  <div className="lens-demo-banner">
                    🎬 Demo running — {demoStep === 1 ? 'uploading sample image' : 'AI analyzing'}…
                  </div>
                )}

                {loading && (
                  <div className="lens-progress">
                    <div className="lens-progress-bar" />
                    <span>AI is scanning your image — identifying brand, model, and best buy link…</span>
                  </div>
                )}

                {error && <div className="lens-error">⚠ {error}</div>}
              </>
            )}

            {result && (
              <div className="lens-result">
                {/* Result tabs */}
                <div className="lens-tabs">
                  <button className={`lens-tab ${resultTab === 'compare' ? 'active' : ''}`} onClick={() => setResultTab('compare')}>
                    🛒 Compare &amp; Buy
                  </button>
                  <button className={`lens-tab ${resultTab === 'info' ? 'active' : ''}`} onClick={() => setResultTab('info')}>
                    📋 Product Info
                  </button>
                </div>

                {resultTab === 'info' && (
                  <div className="lens-product-info-tab">
                    <div className="lens-section-label">📋 PRODUCT HISTORY &amp; OFFICIAL LINKS</div>
                    <p className="lens-info-note">
                      Non-AI sourced product information. Links go directly to the manufacturer or official product page.
                    </p>
                    <div className="lens-info-links">
                      {result.brand && (
                        <a
                          className="lens-official-link"
                          href={`https://www.google.com/search?q=${encodeURIComponent((result.brand || '') + ' official website')}`}
                          target="_blank" rel="noopener noreferrer"
                        >
                          🏢 {result.brand} Official Website
                        </a>
                      )}
                      {(result.products?.[0] || result.promotionTitle) && (
                        <a
                          className="lens-official-link"
                          href={`https://www.google.com/search?q=${encodeURIComponent((result.products?.[0] || result.promotionTitle) + ' product page specifications')}`}
                          target="_blank" rel="noopener noreferrer"
                        >
                          📄 {result.products?.[0] || result.promotionTitle} — Specs &amp; Details
                        </a>
                      )}
                      {result.brand && (
                        <a
                          className="lens-official-link"
                          href={`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(result.brand + ' ' + (result.productCategory || ''))}`}
                          target="_blank" rel="noopener noreferrer"
                        >
                          📖 Wikipedia — {result.brand} History
                        </a>
                      )}
                      {result.productCategory && (
                        <a
                          className="lens-official-link"
                          href={`https://www.rtings.com/search#${encodeURIComponent(result.products?.[0] || result.brand || '')}`}
                          target="_blank" rel="noopener noreferrer"
                        >
                          🧪 Expert Reviews &amp; Tests
                        </a>
                      )}
                      {(result.redirectUrl || result.productUrl) && (
                        <a
                          className="lens-official-link primary"
                          href={result.productUrl || result.redirectUrl}
                          target="_blank" rel="noopener noreferrer"
                        >
                          🔗 Official Product Page
                        </a>
                      )}
                    </div>
                    <div className="lens-info-grid" style={{ marginTop: 16 }}>
                      {result.brand && <div className="lens-info-row"><span className="lens-info-k">Brand</span><span className="lens-info-v">{result.brand}</span></div>}
                      {(result.products?.[0] || result.promotionTitle) && <div className="lens-info-row"><span className="lens-info-k">Product</span><span className="lens-info-v">{result.products?.[0] || result.promotionTitle}</span></div>}
                      {result.productCategory && <div className="lens-info-row"><span className="lens-info-k">Category</span><span className="lens-info-v">{result.productCategory}</span></div>}
                      {geo.label && <div className="lens-info-row"><span className="lens-info-k">Your Location</span><span className="lens-info-v">📍 {geo.label}</span></div>}
                    </div>
                    <p className="lens-info-disclaimer">
                      ⚠️ Links above are search-based and not AI-generated. For the most accurate product history, visit the manufacturer's official website directly.
                    </p>
                  </div>
                )}

                {resultTab === 'compare' && <>
                <div className="lens-result-head">
                  <span className={`lens-match-pill ${hasDirectProductMatch ? 'good' : 'warn'}`}>
                    {result.isGroceryFlyer
                      ? `📰 ${result.brand || 'Grocery'} flyer detected`
                      : hasDirectProductMatch ? '✓ Exact product found' : '🔎 Similar products found'}
                  </span>
                  {result.confidence && <span className="lens-conf">{result.confidence} confidence</span>}
                </div>

                {!demo && countdown !== null && countdown > 0 && (
                  <div className="lens-redirect">
                    <span>
                      🚀 Opening {cheapest?.source ? <strong>cheapest at {cheapest.source}</strong> : (hasDirectProductMatch ? 'product page' : 'best similar match')}
                      {cheapest?.price != null && <> for <strong>${cheapest.price.toFixed(2)}</strong></>}
                      {geo.country && <> · 📍 near {geo.label || geo.country}</>}
                      {' '}in {countdown}s…
                    </span>
                    <button className="lens-mini-btn" onClick={cancelRedirect}>Cancel</button>
                  </div>
                )}

                <div className="lens-result-body">
                  <div className="lens-thumbs">
                    {preview && (
                      <div className="lens-thumb">
                        <img src={preview} alt="your upload" />
                        <span>Your upload</span>
                      </div>
                    )}
                    {result.mainProductImage?.thumbnail && (
                      <div className="lens-thumb match">
                        <img src={result.mainProductImage.thumbnail} alt="match" />
                        <span>{hasDirectProductMatch ? '✓ Matched' : 'Detected'}</span>
                      </div>
                    )}
                  </div>

                  <div className="lens-result-text">
                    {result.brand && <div className="lens-brand">{result.brand}</div>}
                    <h3 className="lens-pname">{result.products?.[0] || result.promotionTitle || 'Product identified'}</h3>
                    <div className="lens-result-meta">
                      {result.productCategory && <span className="lens-chip">{result.productCategory}</span>}
                      {result.discountAmount && <span className="lens-chip off">{result.discountAmount} OFF</span>}
                    </div>
                    {(result.productPrice?.sale || result.mainProductImage?.price) && (
                      <div className="lens-price">
                        <span className="lens-price-sale">{result.productPrice?.sale || result.mainProductImage?.price}</span>
                        {result.productPrice?.original && (
                          <span className="lens-price-orig">{result.productPrice.original}</span>
                        )}
                        {result.mainProductImage?.merchant && (
                          <span className="lens-merchant">at {result.mainProductImage.merchant}</span>
                        )}
                      </div>
                    )}
                    {result.promotionDescription && (
                      <p className="lens-desc">{result.promotionDescription}</p>
                    )}
                  </div>
                </div>

                {result.coupons?.length > 0 && (
                  <div className="lens-coupons">
                    <div className="lens-section-label">COUPON CODES</div>
                    <div className="lens-coupons-row">
                      {result.coupons.map((c, i) => (
                        <div key={i} className="lens-coupon">
                          <code>{c.code}</code>
                          {c.description && <span>{c.description}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* === Product Information panel === */}
                <div className="lens-info">
                  <div className="lens-section-label">📋 PRODUCT INFORMATION</div>
                  <div className="lens-info-grid">
                    {result.brand && (
                      <div className="lens-info-row"><span className="lens-info-k">Brand</span><span className="lens-info-v">{result.brand}</span></div>
                    )}
                    {(result.products?.[0] || result.promotionTitle) && (
                      <div className="lens-info-row"><span className="lens-info-k">Product</span><span className="lens-info-v">{result.products?.[0] || result.promotionTitle}</span></div>
                    )}
                    {result.productCategory && (
                      <div className="lens-info-row"><span className="lens-info-k">Category</span><span className="lens-info-v">{result.productCategory}</span></div>
                    )}
                    {(result.productPrice?.sale || result.productPrice?.original || result.mainProductImage?.price) && (
                      <div className="lens-info-row">
                        <span className="lens-info-k">Listed price</span>
                        <span className="lens-info-v">
                          {result.productPrice?.sale || result.mainProductImage?.price}
                          {result.productPrice?.original && result.productPrice?.sale && (
                            <span className="lens-info-strike"> {result.productPrice.original}</span>
                          )}
                        </span>
                      </div>
                    )}
                    {result.discountAmount && (
                      <div className="lens-info-row"><span className="lens-info-k">Discount</span><span className="lens-info-v lens-info-off">{result.discountAmount} OFF</span></div>
                    )}
                    {(result.mainProductImage?.merchant || result.domain) && (
                      <div className="lens-info-row"><span className="lens-info-k">Seller</span><span className="lens-info-v">{result.mainProductImage?.merchant || result.domain}</span></div>
                    )}
                    {result.confidence && (
                      <div className="lens-info-row"><span className="lens-info-k">AI confidence</span><span className="lens-info-v">{result.confidence}</span></div>
                    )}
                    {result.urlSource && (
                      <div className="lens-info-row"><span className="lens-info-k">Source</span><span className="lens-info-v">{result.urlSource}</span></div>
                    )}
                  </div>
                  {result.promotionDescription && (
                    <p className="lens-info-desc">{result.promotionDescription}</p>
                  )}

                  {cheapest && (
                    <div className="lens-cheapest">
                      <div className="lens-cheapest-tag">💰 CHEAPEST {geo.country ? `NEAR ${geo.label || geo.country}` : 'AVAILABLE'}</div>
                      <div className="lens-cheapest-body">
                        <div>
                          <div className="lens-cheapest-title">{cheapest.title || result.products?.[0] || result.brand}</div>
                          <div className="lens-cheapest-source">at <strong>{cheapest.source}</strong>{cheapest.price != null && <> · <strong>${cheapest.price.toFixed(2)}</strong></>}</div>
                        </div>
                        <a className="lens-btn primary" href={cheapest.url} target="_blank" rel="noopener noreferrer">Buy cheapest →</a>
                      </div>
                    </div>
                  )}
                </div>

                <div className="lens-result-actions">
                  {result.isGroceryFlyer ? (
                    <>
                      <a className="lens-btn primary" href={result.redirectUrl} target="_blank" rel="noopener noreferrer">📰 View This Week's Flyer</a>
                      {result.storeLocatorUrl && (
                        <a className="lens-btn ghost" href={result.storeLocatorUrl} target="_blank" rel="noopener noreferrer">📍 Find Nearest Store</a>
                      )}
                    </>
                  ) : (
                    <>
                      {(() => {
                        const hasPromo = !!(result.discountAmount || result.coupons?.length || result.promotionTitle)
                        // 1st: promotion. 2nd: same/similar product on any site.
                        const primaryUrl = hasPromo
                          ? (result.redirectUrl || result.productUrl)
                          : (result.productUrl || result.redirectUrl)
                        if (!primaryUrl) return null
                        return (
                          <a className="lens-btn primary" href={primaryUrl} target="_blank" rel="noopener noreferrer">
                            {hasPromo ? '🎟️ Get This Deal' : '🛒 Buy Now'}
                          </a>
                        )
                      })()}
                      <button className="lens-btn ghost" onClick={webSearch}>🌐 Search on the web</button>
                    </>
                  )}
                  <button className="lens-btn ghost" onClick={demo ? exitDemo : reset}>
                    {demo ? '🔍 Try It For Real' : '🔄 Try Another'}
                  </button>
                </div>

                {result.similarProducts?.length > 0 && (
                  <div className="lens-similar">
                    <div className="lens-section-label">{hasDirectProductMatch ? 'OTHER MATCHES' : 'SIMILAR PRODUCTS'}</div>
                    <div className="lens-similar-grid">
                      {result.similarProducts.slice(0, 6).map((item, i) => {
                        const isCheapest = cheapest && !cheapest.isMain && cheapest.url === item.url
                        return (
                        <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className={`lens-similar-card ${isCheapest ? 'cheapest' : ''}`}>
                          {isCheapest && <span className="lens-similar-flag">💰 Cheapest</span>}
                          {item.thumbnail ? (
                            <img src={item.thumbnail} alt={item.title} />
                          ) : (
                            <div className="lens-similar-ph">🛍️</div>
                          )}
                          <div className="lens-similar-title">{item.title}</div>
                          <div className="lens-similar-foot">
                            {item.price && <span className="lens-similar-price">{item.price}</span>}
                            <span className="lens-similar-source">{item.source || 'Shop'} →</span>
                          </div>
                        </a>
                      )})}
                    </div>
                  </div>
                )}
                </>}
              </div>
            )}
          </div>

          {/* RIGHT — how it works + tips */}
          <aside className="lens-side">
            <span className="lens-tag-green">✦ HOW IT WORKS</span>
            <h2 className="lens-side-title">From photo to checkout in seconds.</h2>
            <p className="lens-side-sub">
              No more guessing keywords. JustKlick reads the image and goes straight to a real product page.
            </p>

            <div className="lens-steps">
              <div className="lens-step">
                <div className="lens-step-n">01</div>
                <div>
                  <h4>Upload or screenshot</h4>
                  <p>Drop in a photo of a product, a flyer, an Instagram ad — anything visual.</p>
                </div>
              </div>
              <div className="lens-step">
                <div className="lens-step-n">02</div>
                <div>
                  <h4>AI identifies the product</h4>
                  <p>Vision model detects brand, model, colour, category, and pulls a SERP-verified buy link.</p>
                </div>
              </div>
              <div className="lens-step">
                <div className="lens-step-n">03</div>
                <div>
                  <h4>Buy now or compare</h4>
                  <p>Open the exact product page, run a web search for the best price, or grab a coupon code.</p>
                </div>
              </div>
            </div>

            <div className="lens-stats">
              <div><div className="lens-stat-num">2.4s</div><div className="lens-stat-cap">avg detection</div></div>
              <div><div className="lens-stat-num">96%</div><div className="lens-stat-cap">match accuracy</div></div>
              <div><div className="lens-stat-num">1000+</div><div className="lens-stat-cap">stores indexed</div></div>
            </div>

            <div className="lens-tips">
              <div className="lens-section-label">PERFECT FOR</div>
              <div className="lens-tip-tags">
                <span>👟 Sneakers</span>
                <span>🎧 Headphones</span>
                <span>📱 Phones</span>
                <span>🛒 Grocery flyers</span>
                <span>🧴 Cosmetics</span>
                <span>📺 Electronics</span>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}
