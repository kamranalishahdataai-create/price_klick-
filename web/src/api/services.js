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

/**
 * Scrape a service provider's own website via Firecrawl for real pricing & services.
 * @param {{ url: string, name?: string }} body
 */
export async function scrapeProviderWebsite(body = {}) {
  const res = await fetch(`${API}/api/services/scrape-website`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`scrape-website failed ${res.status}`)
  return res.json()
}

/**
 * Scrape a product page URL for its live price via Firecrawl.
 * @param {string} url
 */
export async function scrapeProductPrice(url) {
  const res = await fetch(`${API}/api/prices/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ url })
  })
  if (!res.ok) throw new Error(`prices/scrape failed ${res.status}`)
  return res.json()
}

/**
 * Get or create a persistent anonymous session ID for pattern tracking.
 */
export function getSessionId() {
  const KEY = 'pk_session_id'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now()
    localStorage.setItem(KEY, id)
  }
  return id
}

/**
 * Analyze this session's spending patterns + get matched deals (fast, no AI).
 */
export async function getSpendingPatterns() {
  const sessionId = getSessionId()
  const t = typeof localStorage !== 'undefined' ? localStorage.getItem('pk_token') : null
  const headers = { 'X-Session-ID': sessionId }
  if (t) headers.Authorization = `Bearer ${t}`
  const res = await fetch(`${API}/api/insights/patterns`, { headers })
  if (!res.ok) throw new Error(`patterns failed ${res.status}`)
  return res.json()
}

/**
 * Track a user activity event to the backend for pattern analysis.
 */
export async function trackActivity(payload = {}) {
  const sessionId = getSessionId()
  const t = typeof localStorage !== 'undefined' ? localStorage.getItem('pk_token') : null
  const headers = { 'Content-Type': 'application/json', 'X-Session-ID': sessionId }
  if (t) headers.Authorization = `Bearer ${t}`
  try {
    await fetch(`${API}/api/insights/activity`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })
  } catch (_) { /* best-effort */ }
}

/**
 * Get deals matching given categories.
 * @param {string[]} categories - e.g. ['electronics','fashion']
 */
export async function getSuggestedDeals(categories = [], limit = 8) {
  const params = new URLSearchParams({ cats: categories.join(','), limit: String(limit) })
  const res = await fetch(`${API}/api/insights/suggested-deals?${params}`, {
    headers: { ...authHeaders() }
  })
  if (!res.ok) throw new Error(`suggested-deals failed ${res.status}`)
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
