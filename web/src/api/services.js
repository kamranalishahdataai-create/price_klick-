// Service-provider search & enrichment client.
// Talks to /api/services/* on the backend (SerpAPI Google Maps + Apify Google Places).

const API = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || ''

function authHeaders() {
  const t = (typeof localStorage !== 'undefined') ? localStorage.getItem('pk_token') : null
  return t ? { Authorization: `Bearer ${t}` } : {}
}

/**
 * Search real local service providers via SerpAPI Google Maps (backend).
 * @param {{ query: string, lat?: number, lng?: number, radiusKm?: number, maxPrice?: number, minRating?: number, limit?: number }} opts
 */
export async function searchServices(opts = {}) {
  const params = new URLSearchParams()
  if (opts.query) params.set('q', opts.query)
  if (typeof opts.lat === 'number') params.set('lat', String(opts.lat))
  if (typeof opts.lng === 'number') params.set('lng', String(opts.lng))
  if (opts.radiusKm) params.set('radiusKm', String(opts.radiusKm))
  if (opts.maxPrice) params.set('maxPrice', String(opts.maxPrice))
  if (opts.minRating) params.set('minRating', String(opts.minRating))
  if (opts.limit) params.set('limit', String(opts.limit))

  const res = await fetch(`${API}/api/services/search?${params.toString()}`, {
    headers: { ...authHeaders() }
  })
  if (!res.ok) throw new Error(`search failed ${res.status}`)
  return res.json()
}

/**
 * Enrich a provider with full Google Places data via Apify (photos, reviews, hours).
 * @param {{ placeId?: string, name?: string, address?: string, force?: boolean }} body
 */
export async function enrichProvider(body = {}) {
  const res = await fetch(`${API}/api/services/enrich`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`enrich failed ${res.status}`)
  return res.json()
}

export async function trackProviderClick(payload = {}) {
  try {
    await fetch(`${API}/api/services/track-click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload)
    })
  } catch (_) { /* tracking is best-effort */ }
}

/** Resolve user lat/lng — tries GPS first, falls back to IP geolocation. */
export async function resolveUserLocation() {
  // 1) GPS (only if user has granted permission already; we use a short timeout)
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false, timeout: 4000, maximumAge: 600000
        })
      })
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'gps' }
    } catch (_) { /* fall through to IP */ }
  }
  // 2) IP-based (free, no key)
  try {
    const r = await fetch('https://ipapi.co/json/')
    if (r.ok) {
      const j = await r.json()
      if (j && typeof j.latitude === 'number' && typeof j.longitude === 'number') {
        return { lat: j.latitude, lng: j.longitude, city: j.city, country: j.country, source: 'ip' }
      }
    }
  } catch (_) {}
  return { lat: null, lng: null, source: 'none' }
}
