// Service-provider search + enrichment via the Foursquare Places API.
// Drop-in replacement for yelpSearch.js — exposes the same searchServiceProviders()
// and enrichServiceProvider() shape, so routes/services.js and the frontend are
// unchanged. Foursquare gives ratings (0–10, converted to 0–5), a price tier
// (1–4, like Yelp's $–$$$$), categories, photos, hours, and real websites.

import ServiceProvider from '../models/ServiceProvider.js';

const FSQ_KEY = () => process.env.FOURSQUARE_API_KEY;
const FSQ_VERSION = () => process.env.FOURSQUARE_API_VERSION || '2025-06-17';
const FSQ_BASE = 'https://places-api.foursquare.com';

function fsqHeaders() {
  return {
    Authorization: `Bearer ${FSQ_KEY()}`,
    'X-Places-Api-Version': FSQ_VERSION(),
    accept: 'application/json',
  };
}

function haversineKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some(v => typeof v !== 'number')) return null;
  const R = 6371, toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Foursquare price tier 1–4 → a representative low-end dollar value, matching the
// budget-filter behaviour we had with Yelp ($ ≈ under $10, $$ ≈ $11–30, etc.).
function fsqPriceToValue(price) {
  if (price === 1) return 10;
  if (price === 2) return 25;
  if (price === 3) return 50;
  if (price === 4) return 100;
  return null;
}

// Foursquare (like Yelp) populates the price tier reliably only for consumer
// categories — food, nightlife, beauty, hospitality. Only apply the price cap
// there; for trades/professional it would exclude everyone.
function usesPriceTier(q) {
  const s = (q || '').toLowerCase();
  return /(restaurant|burger|pizza|sushi|italian|chinese|mexican|indian|thai|steak|seafood|vegan|bbq|breakfast|brunch|lunch|dinner|food|diner|coffee|cafe|café|tea|boba|bubble tea|juice|bakery|cake|pastry|donut|bar|pub|brewery|cocktail|wine|catering|salon|barber|nail|spa|massage|wax|tanning|lash|hair|makeup|hotel|motel|resort|hostel|b&b|bed (and|&) breakfast)/.test(s);
}

// budget → Foursquare max_price tier (1–4). null = no cap (large budget / trades).
function budgetToMaxPrice(budget) {
  if (!budget || isNaN(budget)) return null;
  if (budget <= 15) return 1;
  if (budget <= 40) return 2;
  if (budget <= 100) return 3;
  return null;
}

function photoUrl(p, size = '300x300') {
  if (!p?.prefix || !p?.suffix) return null;
  return `${p.prefix}${size}${p.suffix}`;
}

// Free ("Core") fields — no Foursquare credits required.
const FSQ_BASE_FIELDS = 'fsq_place_id,name,location,categories,distance,latitude,longitude,website,tel';
// Premium fields (ratings, price tier, photos, hours) — require paid credits.
const FSQ_PREMIUM_FIELDS = FSQ_BASE_FIELDS + ',rating,price,hours,photos,stats';
// Enable premium (rich) data once the Foursquare account has credits.
const fsqPremiumEnabled = () => process.env.FOURSQUARE_PREMIUM === '1';

/**
 * Search Foursquare for local service providers.
 */
export async function searchServiceProviders(opts = {}) {
  const { query, lat, lng, radiusKm = 10, maxPrice, minRating, limit = 20 } = opts;

  if (!query || !query.trim()) {
    return { ok: false, error: 'query_required', providers: [] };
  }
  if (!FSQ_KEY()) {
    return { ok: false, error: 'foursquare_not_configured', message: 'Set FOURSQUARE_API_KEY in server/.env', providers: [] };
  }

  const params = new URLSearchParams({
    query: query.trim(),
    limit: String(Math.min(Number(limit) || 20, 50)),
    fields: fsqPremiumEnabled() ? FSQ_PREMIUM_FIELDS : FSQ_BASE_FIELDS,
    sort: 'RELEVANCE',
  });

  if (typeof lat === 'number' && typeof lng === 'number') {
    params.set('ll', `${lat},${lng}`);
    // Foursquare radius is metres, max 100 000
    params.set('radius', String(Math.min(Math.round(radiusKm * 1000), 100000)));
  } else {
    params.set('near', 'United States');
  }

  // Apply Foursquare's native price cap only for consumer categories where the
  // tier is reliable — this is what makes "Burgers under $10" return real spots.
  const maxTier = budgetToMaxPrice(maxPrice);
  const applyTier = maxTier != null && usesPriceTier(query);
  if (applyTier) params.set('max_price', String(maxTier));

  let raw;
  try {
    let res = await fetch(`${FSQ_BASE}/places/search?${params}`, { headers: fsqHeaders() });
    // If premium fields hit the credit wall (429), retry with free Core fields so
    // results still come back (just without ratings/price until credits are added).
    if (!res.ok && res.status === 429 && fsqPremiumEnabled()) {
      const p2 = new URLSearchParams(params.toString());
      p2.set('fields', FSQ_BASE_FIELDS);
      res = await fetch(`${FSQ_BASE}/places/search?${p2}`, { headers: fsqHeaders() });
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, error: `foursquare_${res.status}`, message: txt.slice(0, 300), providers: [] };
    }
    raw = await res.json();
  } catch (e) {
    return { ok: false, error: 'foursquare_request_failed', message: e.message, providers: [] };
  }

  const results = raw.results || [];

  let providers = results.map(b => {
    const provLat = b.latitude ?? b.geocodes?.main?.latitude ?? null;
    const provLng = b.longitude ?? b.geocodes?.main?.longitude ?? null;
    let distanceKm = typeof b.distance === 'number' ? b.distance / 1000 : null;
    if (distanceKm == null && typeof lat === 'number' && typeof lng === 'number' && provLat != null) {
      distanceKm = haversineKm(lat, lng, provLat, provLng);
    }
    const addr = b.location?.formatted_address
      || [b.location?.address, b.location?.locality, b.location?.region].filter(Boolean).join(', ');

    // Foursquare rating is 0–10; convert to the 0–5 scale the UI expects.
    const rating5 = typeof b.rating === 'number' ? Math.round((b.rating / 2) * 10) / 10 : null;
    const priceStr = typeof b.price === 'number' ? '$'.repeat(b.price) : null;

    return {
      placeId: b.fsq_place_id,
      name: b.name,
      category: b.categories?.[0]?.name || query.trim(),
      rating: rating5,
      reviewsCount: b.stats?.total_ratings ?? null,
      price: priceStr,
      priceValue: fsqPriceToValue(b.price),
      priceIsEstimate: typeof b.price !== 'number',
      address: addr || null,
      phone: b.tel || null,
      website: b.website || null,
      hours: b.hours?.display || null,
      thumbnail: photoUrl(b.photos?.[0]) || null,
      lat: provLat,
      lng: provLng,
      distanceKm,
      types: (b.categories || []).map(c => c.name),
      description: (b.categories || []).map(c => c.name).join(', ') || null,
      mapsUrl: provLat && provLng
        ? `https://www.google.com/maps/search/?api=1&query=${provLat},${provLng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.name || query)}`,
    };
  });

  if (typeof minRating === 'number') {
    providers = providers.filter(p => (p.rating || 0) >= minRating);
  }
  if (typeof maxPrice === 'number') {
    // Hard-filter on a REAL price only; estimates (trades) never hard-exclude.
    providers = providers.filter(p => p.priceIsEstimate || p.priceValue == null || p.priceValue <= maxPrice);
  }

  providers = providers.slice(0, limit);

  // Cache to MongoDB (non-blocking)
  if (providers.length > 0) {
    setImmediate(() => {
      providers.forEach(p => {
        if (!p.placeId) return;
        ServiceProvider.findOneAndUpdate(
          { placeId: p.placeId },
          { $set: { ...p, source: 'foursquare', cachedAt: new Date() } },
          { upsert: true, new: false }
        ).catch(() => {});
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
      minRating: minRating ?? null,
      source: 'foursquare',
    },
  };
}

/**
 * Fetch full Foursquare place details: hours, photos, website, tips.
 * Used by the /enrich endpoint to populate the Details modal.
 */
export async function enrichServiceProvider({ placeId, name }) {
  if (!FSQ_KEY()) {
    return { ok: false, error: 'foursquare_not_configured' };
  }
  if (!placeId) {
    return { ok: false, error: 'placeId_required', message: 'Foursquare enrichment requires a place ID.' };
  }

  // Check 7-day cache
  try {
    const SEVEN_DAYS = 7 * 24 * 3600 * 1000;
    const cached = await ServiceProvider.findOne({ placeId });
    if (cached?.enrichedAt && (Date.now() - new Date(cached.enrichedAt).getTime()) < SEVEN_DAYS) {
      return { ok: true, cached: true, provider: cached.toObject() };
    }
  } catch (_) {}

  const baseFields = 'fsq_place_id,name,location,categories,tel,website,latitude,longitude';
  const premiumFields = baseFields + ',rating,price,hours,photos,stats,description';
  const fields = fsqPremiumEnabled() ? premiumFields : baseFields;

  let b;
  try {
    let res = await fetch(`${FSQ_BASE}/places/${encodeURIComponent(placeId)}?fields=${fields}`, {
      headers: fsqHeaders(),
    });
    if (!res.ok && res.status === 429 && fsqPremiumEnabled()) {
      res = await fetch(`${FSQ_BASE}/places/${encodeURIComponent(placeId)}?fields=${baseFields}`, {
        headers: fsqHeaders(),
      });
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, error: `foursquare_${res.status}`, message: txt.slice(0, 300) };
    }
    b = await res.json();
  } catch (e) {
    return { ok: false, error: 'foursquare_request_failed', message: e.message };
  }

  const addr = b.location?.formatted_address
    || [b.location?.address, b.location?.locality, b.location?.region, b.location?.postcode].filter(Boolean).join(', ');

  const provider = {
    placeId: b.fsq_place_id,
    name: b.name,
    rating: typeof b.rating === 'number' ? Math.round((b.rating / 2) * 10) / 10 : null,
    reviewsCount: b.stats?.total_ratings ?? null,
    price: typeof b.price === 'number' ? '$'.repeat(b.price) : null,
    address: addr || null,
    phone: b.tel || null,
    website: b.website || null,
    photos: (b.photos || []).map(p => photoUrl(p, 'original')).filter(Boolean),
    openingHours: b.hours?.display || null,
    lat: b.latitude ?? null,
    lng: b.longitude ?? null,
    category: b.categories?.[0]?.name || null,
    reviewsSummary: b.description || null,
  };

  // Persist enriched data
  try {
    await ServiceProvider.findOneAndUpdate(
      { placeId: b.fsq_place_id },
      { $set: { ...provider, source: 'foursquare', enrichedAt: new Date(), enrichedSource: 'foursquare_details' } },
      { upsert: true, new: false }
    );
  } catch (_) {}

  return { ok: true, cached: false, provider };
}

export function isConfigured() {
  return !!FSQ_KEY();
}
