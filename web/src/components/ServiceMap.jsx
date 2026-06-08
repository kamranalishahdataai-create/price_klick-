import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

function buildPopupHTML(p) {
  const priceTag = p.price ? `<span style="color:#a78bfa;font-weight:600;margin-left:6px">${p.price}</span>` : ''
  const rating = p.rating != null
    ? `<div style="color:#f59e0b;font-size:13px;margin-top:5px">★ ${p.rating.toFixed(1)} <span style="color:#888">(${p.reviewsCount ?? 0})</span></div>`
    : ''
  const addr = p.address ? `<div style="color:#888;font-size:12px;margin-top:4px">${p.address}</div>` : ''
  const phone = p.phone
    ? `<a href="tel:${p.phone}" style="display:block;color:#60a5fa;font-size:12px;margin-top:6px;text-decoration:none">📞 ${p.phone}</a>`
    : ''
  const link = p.website
    ? `<a href="${p.website}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;margin-top:8px;padding:6px 12px;border-radius:999px;background:linear-gradient(135deg,#7c3aed,#0891b2);color:#fff;font-size:12px;font-weight:600;text-decoration:none">View on Yelp →</a>`
    : ''
  return `
    <div style="font-family:'Inter',sans-serif;padding:10px 12px;min-width:200px">
      <strong style="font-size:14px;color:#111">${p.name}</strong>${priceTag}
      ${rating}${addr}${phone}
      ${link}
    </div>
  `
}

export default function ServiceMap({ providers = [], userLat, userLng }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    if (!TOKEN || !containerRef.current) return

    mapboxgl.accessToken = TOKEN

    const geoProviders = providers.filter(p => p.lat && p.lng)
    const centerLng = userLng ?? geoProviders[0]?.lng ?? -98.5795
    const centerLat = userLat ?? geoProviders[0]?.lat ?? 39.8283

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [centerLng, centerLat],
      zoom: userLat ? 12 : 4
    })
    mapRef.current = map

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), 'top-right')

    // User location pin
    if (typeof userLat === 'number' && typeof userLng === 'number') {
      const el = document.createElement('div')
      el.style.cssText = [
        'width:18px', 'height:18px', 'border-radius:50%',
        'background:#7c3aed', 'border:3px solid #fff',
        'box-shadow:0 0 0 5px rgba(124,58,237,.35)'
      ].join(';')
      new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([userLng, userLat])
        .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML('<div style="padding:8px 10px;font-size:13px;font-weight:600">📍 You are here</div>'))
        .addTo(map)
    }

    // Provider pins
    geoProviders.forEach(p => {
      const initial = (p.name || '?').trim().charAt(0).toUpperCase()
      const el = document.createElement('div')
      el.className = 'sv-map-pin'
      el.textContent = initial
      el.title = p.name

      const popup = new mapboxgl.Popup({ offset: 24, maxWidth: '300px' })
        .setHTML(buildPopupHTML(p))

      new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([p.lng, p.lat])
        .setPopup(popup)
        .addTo(map)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [providers, userLat, userLng])

  if (!TOKEN) {
    return (
      <div className="sv-map-placeholder">
        <div style={{ fontSize: 38, marginBottom: 10 }}>🗺</div>
        <p>Map unavailable — VITE_MAPBOX_TOKEN not set.</p>
      </div>
    )
  }

  return (
    <div className="sv-map-wrap">
      <div ref={containerRef} className="sv-map-canvas" />
      {providers.filter(p => p.lat && p.lng).length === 0 && (
        <div className="sv-map-nocoords">
          No providers with GPS coordinates — try a different search.
        </div>
      )}
    </div>
  )
}
