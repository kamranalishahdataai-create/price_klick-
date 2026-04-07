import React, { useState, useRef, useCallback } from 'react'
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
  const [demoStep, setDemoStep] = useState(0) // 0=idle, 1=uploading, 2=analyzing, 3=result
  const countdownRef = useRef(null)
  const demoRef = useRef(null)
  const fileRef = useRef()

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
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`${API}/api/promo/find-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image })
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Analysis failed')
      setResult(data)
      // Auto-redirect to product page
      const url = data.redirectUrl || data.checkoutUrl
      if (autoRedirect && url) {
        setCountdown(5)
        let t = 5
        countdownRef.current = setInterval(() => {
          t -= 1
          setCountdown(t)
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
    clearInterval(countdownRef.current)
    setCountdown(null)
    setImage(null)
    setPreview(null)
    setResult(null)
    setError(null)
  }

  const cancelRedirect = () => {
    clearInterval(countdownRef.current)
    setCountdown(null)
  }

  const runDemo = () => {
    reset()
    setDemo(true)
    setDemoStep(1) // show "uploading"
    demoRef.current = setTimeout(() => {
      setDemoStep(2) // show "analyzing"
      demoRef.current = setTimeout(() => {
        setDemoStep(3) // show result
        setResult(DEMO_RESULT)
      }, 2200)
    }, 1200)
  }

  const exitDemo = () => {
    clearTimeout(demoRef.current)
    setDemo(false)
    setDemoStep(0)
    reset()
  }

  return (
    <section style={{ minHeight: '80vh', padding: '80px 20px 60px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 36 }}>🔍</span>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, margin: 0 }}>Promo Lens</h1>
          <span style={{ background: 'linear-gradient(135deg,#4285F4,#EA4335,#FBBC05,#34A853)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>AI</span>
        </div>
        <p style={{ color: '#6a6880', fontSize: 16, marginBottom: 16 }}>
          Upload any product image or promotional screenshot — our AI identifies the product and finds where to buy it online.
        </p>

        {!demo && !result && (
          <button onClick={runDemo} style={{ ...btnSecondary, marginBottom: 28, gap: 6, display: 'inline-flex', alignItems: 'center' }}>
            ▶️ View Demo
          </button>
        )}

        {/* Demo simulation */}
        {demo && !result && (
          <div style={{ marginBottom: 24 }}>
            {/* Demo banner */}
            <div style={{ background: 'linear-gradient(135deg,#FFA726,#FF7043)', color: '#fff', borderRadius: 12, padding: '10px 20px', marginBottom: 20, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>🎬 Demo Mode — Simulated walkthrough</span>
              <button onClick={exitDemo} style={{ background: 'rgba(255,255,255,0.25)', border: 'none', color: '#fff', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Exit Demo</button>
            </div>

            {/* Step 1: upload animation */}
            {demoStep >= 1 && (
              <div style={{
                border: '2.5px dashed #34A853', borderRadius: 20, padding: 16,
                background: '#fafafe', marginBottom: 20, animation: 'fadeIn 0.5s ease'
              }}>
                <div style={{ fontSize: 56, marginBottom: 4 }}>👟</div>
                <div style={{ fontSize: 14, color: '#34A853', fontWeight: 700 }}>✓ Image uploaded — Nike shoe detected</div>
              </div>
            )}

            {/* Step 2: analyzing */}
            {demoStep === 2 && (
              <div style={{ padding: 24, animation: 'fadeIn 0.5s ease' }}>
                <div style={{ width: '100%', height: 6, background: '#e8e6f0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: '80%', height: '100%', background: 'linear-gradient(90deg,#6D4AFF,#4285F4)', borderRadius: 3, animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
                <p style={{ color: '#6a6880', marginTop: 12, fontSize: 14 }}>🤖 AI is analyzing... identifying brand, model, finding best prices and coupons.</p>
              </div>
            )}
          </div>
        )}

        {/* Auto-redirect toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: '#555' }}>
            <span onClick={() => setAutoRedirect(!autoRedirect)} style={{
              width: 40, height: 22, borderRadius: 12, background: autoRedirect ? '#6D4AFF' : '#d1d0e0',
              position: 'relative', display: 'inline-block', transition: 'background 0.2s', cursor: 'pointer'
            }}>
              <span style={{
                position: 'absolute', top: 2, left: autoRedirect ? 20 : 2,
                width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px #0003'
              }} />
            </span>
            Auto-redirect to product page
          </label>
        </div>

        {!result && (
          <>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
              style={{
                border: `2.5px dashed ${dragOver ? '#6D4AFF' : preview ? '#34A853' : '#d1d0e0'}`,
                borderRadius: 20, padding: preview ? 16 : 48, cursor: 'pointer',
                background: dragOver ? '#f3f0ff' : '#fafafe', transition: 'all 0.2s',
                marginBottom: 20
              }}
            >
              {preview ? (
                <img src={preview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 340, borderRadius: 12 }} />
              ) : (
                <>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>📸</div>
                  <div style={{ fontSize: 15, color: '#6a6880' }}>
                    <strong style={{ color: '#6D4AFF' }}>Click to upload</strong> or drag & drop
                  </div>
                  <div style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>Product photo, promo flyer, store ad, or screenshot</div>
                </>
              )}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => handleFile(e.target.files[0])} />
            </div>

            {preview && (
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
                <button onClick={analyze} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }}>
                  {loading ? '🔄 Analyzing...' : '🔍 Find This Product'}
                </button>
                <button onClick={reset} style={btnSecondary}>✕ Clear</button>
              </div>
            )}

            {loading && (
              <div style={{ padding: 24 }}>
                <div style={{ width: '100%', height: 6, background: '#e8e6f0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: '60%', height: '100%', background: 'linear-gradient(90deg,#6D4AFF,#4285F4)', borderRadius: 3, animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
                <p style={{ color: '#6a6880', marginTop: 12, fontSize: 14 }}>AI is analyzing your image... identifying product, brand, and finding best prices.</p>
              </div>
            )}

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 16, color: '#dc2626', marginTop: 16 }}>
                {error}
              </div>
            )}
          </>
        )}

        {result && (
          <div style={{ textAlign: 'left', background: '#fff', border: '1px solid #e8e6f0', borderRadius: 20, padding: 28, marginTop: 8, animation: 'fadeIn 0.5s ease' }}>
            {demo && (
              <div style={{ background: 'linear-gradient(135deg,#FFA726,#FF7043)', color: '#fff', borderRadius: 12, padding: '10px 20px', marginBottom: 16, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>🎬 Demo Result — This is what Lens returns for a real product image</span>
                <button onClick={exitDemo} style={{ background: 'rgba(255,255,255,0.25)', border: 'none', color: '#fff', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Exit Demo</button>
              </div>
            )}
            {!demo && countdown !== null && countdown > 0 && (
              <div style={{ background: 'linear-gradient(135deg,#6D4AFF,#4285F4)', color: '#fff', borderRadius: 12, padding: '12px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>🚀 Redirecting to product page in {countdown}s...</span>
                <button onClick={cancelRedirect} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, padding: '4px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancel</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              {preview && <img src={preview} alt="" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 12 }} />}
              <div>
                {result.brand && <div style={{ fontSize: 13, color: '#6D4AFF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{result.brand}</div>}
                <h3 style={{ fontSize: '1.3rem', margin: '4px 0' }}>{result.products?.[0] || result.promotionTitle || 'Product Identified'}</h3>
                {result.productCategory && <span style={tag}>{result.productCategory}</span>}
                {result.discountAmount && <span style={{ ...tag, background: '#dcfce7', color: '#16a34a' }}>{result.discountAmount} OFF</span>}
              </div>
            </div>

            {result.promotionDescription && (
              <p style={{ color: '#555', fontSize: 14, marginBottom: 16 }}>{result.promotionDescription}</p>
            )}

            {result.coupons?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Coupon Codes:</div>
                {result.coupons.map((c, i) => (
                  <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#f3f0ff', borderRadius: 8, padding: '6px 14px', marginRight: 8, marginBottom: 6 }}>
                    <code style={{ fontWeight: 700, color: '#6D4AFF' }}>{c.code}</code>
                    {c.description && <span style={{ fontSize: 12, color: '#888' }}>{c.description}</span>}
                  </div>
                ))}
              </div>
            )}

            {result.productPrice && (
              <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                {result.productPrice.sale && <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a' }}>{result.productPrice.sale}</span>}
                {result.productPrice.original && <span style={{ fontSize: '1.1rem', color: '#999', textDecoration: 'line-through' }}>{result.productPrice.original}</span>}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
              {result.redirectUrl && (
                <a href={result.redirectUrl} target="_blank" rel="noopener noreferrer" style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  🛒 Go to Product Page
                </a>
              )}
              {result.checkoutUrl && result.checkoutUrl !== result.redirectUrl && (
                <a href={result.checkoutUrl} target="_blank" rel="noopener noreferrer" style={{ ...btnSecondary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  🛍️ Checkout Page
                </a>
              )}
              <button onClick={demo ? exitDemo : reset} style={btnSecondary}>{demo ? '🔍 Try It For Real' : '🔄 Try Another'}</button>
            </div>

            <div style={{ marginTop: 16, fontSize: 12, color: '#aaa' }}>
              Source: {result.urlSource} • Confidence: {result.confidence}
            </div>
          </div>
        )}

        <style>{`@keyframes pulse { 0%,100%{opacity:0.6} 50%{opacity:1} } @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }`}</style>
      </div>
    </section>
  )
}

const btnPrimary = { padding: '12px 28px', borderRadius: 12, border: 'none', background: '#6D4AFF', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }
const btnSecondary = { padding: '12px 28px', borderRadius: 12, border: '1.5px solid #e2e0f0', background: '#fff', color: '#333', fontSize: 15, fontWeight: 600, cursor: 'pointer' }
const tag = { display: 'inline-block', background: '#f3f0ff', color: '#6D4AFF', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, marginRight: 6 }
