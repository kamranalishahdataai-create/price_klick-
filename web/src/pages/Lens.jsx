import React, { useState, useRef, useCallback, useEffect } from 'react'
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
  const countdownRef = useRef(null)
  const demoRef = useRef(null)
  const fileRef = useRef()
  const [searchParams, setSearchParams] = useSearchParams()

  const hasDirectProductMatch = result?.hasDirectProductMatch !== false

  useEffect(() => {
    if (searchParams.get('demo') === '1') {
      searchParams.delete('demo')
      setSearchParams(searchParams, { replace: true })
      setTimeout(() => runDemo(), 300)
    }
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
      const directUrl = data.productUrl || data.redirectUrl || data.checkoutUrl
      const similarUrl = data.similarProducts?.find(p => p?.url)?.url
      const url = data.hasDirectProductMatch ? directUrl : (directUrl || similarUrl)
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
                    <span>🚀 Opening {hasDirectProductMatch ? 'product page' : 'best similar match'} in {countdown}s…</span>
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
                      {(result.productUrl || result.redirectUrl) && (
                        <a className="lens-btn primary" href={result.productUrl || result.redirectUrl} target="_blank" rel="noopener noreferrer">🛒 Buy Now</a>
                      )}
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
                      {result.similarProducts.slice(0, 6).map((item, i) => (
                        <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="lens-similar-card">
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
                      ))}
                    </div>
                  </div>
                )}
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
