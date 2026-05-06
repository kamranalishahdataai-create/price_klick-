// Service-provider search via SerpAPI Google Maps engine.
// Finds plumbers, electricians, mechanics, tutors, cleaners, etc. with
// ratings, reviews, phone, address, GPS — everything needed to surface
// real local providers without a separate Google Places API key.

import ServiceProvider from '../models/ServiceProvider.js';

const SERP_KEY = () => process.env.SERP_API_KEY || process.env.SERPAPI_KEY;

// Heuristic: estimate a numeric price from price strings/types/category so we
// can apply a "max budget" filter even though Google Maps rarely surfaces real $.
function estimatePrice(category, priceStr) {
  if (priceStr) {
    const num = (priceStr.match(/\$?\s*(\d{1,4})/) || [])[1];
    if (num) return Number(num);
    const dollars = (priceStr.match(/\$+/g) || [''])[0].length;
    if (dollars === 1) return 30;
    if (dollars === 2) return 75;
    if (dollars === 3) return 150;
    if (dollars === 4) return 300;
  }
  // Fallback estimates by category (CAD / hr) — used only when no real price
  const cat = (category || '').toLowerCase();
  if (cat.includes('plumb')) return 110;
  if (cat.includes('electric')) return 120;
  if (cat.includes('mechanic') || cat.includes('auto')) return 100;
  if (cat.includes('tutor')) return 50;
  if (cat.includes('clean')) return 40;
  if (cat.includes('lawn') || cat.includes('landscap')) return 60;
  if (cat.includes('hvac') || cat.includes('heating')) return 130;
  if (cat.includes('lawyer') || cat.includes('attorney')) return 250;
  if (cat.includes('account') || cat.includes('tax')) return 90;
  if (cat.includes('hair') || cat.includes('salon') || cat.includes('barber')) return 45;
  if (cat.includes('massage') || cat.includes('spa')) return 90;
  if (cat.includes('dog') || cat.includes('pet')) return 50;
  if (cat.includes('moving') || cat.includes('mover')) return 150;
  if (cat.includes('handyman') || cat.includes('carpenter')) return 70;
  return null;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some(v => typeof v !== 'number')) return null;
  const R = 6371, toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Search Google Maps via SerpAPI for service providers.
 * @param {Object} opts
 * @param {string} opts.query  e.g. "plumber", "math tutor", "honda mechanic"
 * @param {number} [opts.lat]
 * @param {number} [opts.lng]
 * @param {number} [opts.radiusKm=10]
 * @param {number} [opts.maxPrice]  filter out providers above this price
 * @param {number} [opts.minRating] e.g. 4.0
 * @param {number} [opts.limit=20]
 */
export async function searchServiceProviders(opts = {}) {
  const {
    query, lat, lng, radiusKm = 10, maxPrice, minRating, limit = 20
  } = opts;

  if (!query || !query.trim()) {
    return { ok: false, error: 'query_required', providers: [] };
  }
  if (!SERP_KEY()) {
    return { ok: false, error: 'serpapi_not_configured', providers: [] };
  }

  const params = new URLSearchParams({
    engine: 'google_maps',
    q: query.trim(),
    type: 'search',
    api_key: SERP_KEY()
  });
  if (typeof lat === 'number' && typeof lng === 'number') {
    // ll = "@lat,lng,zoom" — zoom 12 ≈ 5–10km radius, zoom 11 ≈ 10–20km
    const zoom = radiusKm <= 5 ? 13 : radiusKm <= 10 ? 12 : radiusKm <= 25 ? 11 : 10;
    params.set('ll', `@${lat},${lng},${zoom}z`);
  }

  let raw;
  try {
    const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, error: `serpapi_${res.status}`, message: txt.slice(0, 200), providers: [] };
    }
    raw = await res.json();
  } catch (e) {
    return { ok: false, error: 'serpapi_request_failed', message: e.message, providers: [] };
  }

  const local = raw.local_results || raw.place_results
    ? (raw.local_results || [raw.place_results]) : [];

  let providers = local.map(p => {
    const provLat = p.gps_coordinates?.latitude ?? p.coordinates?.latitude ?? null;
    const provLng = p.gps_coordinates?.longitude ?? p.coordinates?.longitude ?? null;
    const distanceKm = (typeof lat === 'number' && typeof provLat === 'number')
      ? haversineKm(lat, lng, provLat, provLng) : null;
    return {
      placeId: p.place_id || p.data_id || null,
      name: p.title || p.name,
      category: query.trim(),
      rating: p.rating || null,
      reviewsCount: p.reviews || p.user_ratings_total || null,
      price: p.price || null,
      priceValue: estimatePrice(query, p.price),
      address: p.address || null,
      phone: p.phone || null,
      website: p.website || null,
      hours: p.hours || p.opening_hours || null,
      thumbnail: p.thumbnail || null,
      lat: provLat,
      lng: provLng,
      distanceKm,
      types: p.types || p.type ? [p.type] : [],
      description: p.description || p.snippet || null,
      mapsUrl: p.gps_coordinates
        ? `https://www.google.com/maps/search/?api=1&query=${provLat},${provLng}`
        : (p.title ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.title)}` : null)
    };
  }).filter(p => p.name);

  // Filter by radius (when we have coordinates on both sides)
  if (typeof lat === 'number' && typeof radiusKm === 'number') {
    providers = providers.filter(p => p.distanceKm == null || p.distanceKm <= radiusKm);
  }
  if (typeof minRating === 'number') {
    providers = providers.filter(p => (p.rating || 0) >= minRating);
  }
  if (typeof maxPrice === 'number') {
    providers = providers.filter(p => p.priceValue == null || p.priceValue <= maxPrice);
  }

  providers = providers.slice(0, limit);

  // Best-effort cache to MongoDB (non-blocking)
  if (providers.length > 0) {
    setImmediate(() => {
      providers.forEach(p => {
        if (!p.placeId) return;
        ServiceProvider.findOneAndUpdate(
          { placeId: p.placeId },
          { $set: { ...p, source: 'serpapi_google_maps', cachedAt: new Date() } },
          { upsert: true, new: false }
        ).catch(() => {}); // ignore cache errors
      });
    });
  }

  return {
    ok: true,
    count: providers.length,
    providers,
    meta: {
      query: query.trim(),
      lat: lat ?? null,
      lng: lng ?? null,
      radiusKm,
      maxPrice: maxPrice ?? null,
      minRating: minRating ?? null
    }
  };
}
