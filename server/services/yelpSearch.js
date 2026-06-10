// Service-provider search + enrichment via Yelp Fusion API.
// Replaces the SerpAPI Google Maps integration.

import ServiceProvider from '../models/ServiceProvider.js';

const YELP_KEY = () => process.env.YELP_API_KEY;
const YELP_BASE = 'https://api.yelp.com/v3';

function haversineKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some(v => typeof v !== 'number')) return null;
  const R = 6371, toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function yelpPriceToValue(priceStr, category) {
  if (priceStr) {
    const dollars = (priceStr.match(/\$/g) || []).length;
    if (dollars === 1) return 20;
    if (dollars === 2) return 60;
    if (dollars === 3) return 130;
    if (dollars === 4) return 250;
  }
  const cat = (category || '').toLowerCase();
  // Home services
  if (cat.includes('plumb')) return 110;
  if (cat.includes('electric')) return 120;
  if (cat.includes('hvac') || cat.includes('heating') || cat.includes('cooling')) return 130;
  if (cat.includes('clean') || cat.includes('maid') || cat.includes('janitorial')) return 40;
  if (cat.includes('landscap') || cat.includes('lawn') || cat.includes('garden')) return 60;
  if (cat.includes('pest')) return 80;
  if (cat.includes('roof')) return 300;
  if (cat.includes('paint')) return 70;
  if (cat.includes('moving') || cat.includes('mover')) return 150;
  if (cat.includes('handyman') || cat.includes('repair')) return 80;
  if (cat.includes('floor')) return 200;
  if (cat.includes('drywall') || cat.includes('plaster')) return 90;
  if (cat.includes('remodel') || cat.includes('renovation') || cat.includes('contractor')) return 250;
  if (cat.includes('window') || cat.includes('door')) return 120;
  if (cat.includes('insulation')) return 100;
  if (cat.includes('carpent') || cat.includes('cabinet')) return 150;
  if (cat.includes('mason') || cat.includes('brick') || cat.includes('concrete')) return 180;
  // Auto
  if (cat.includes('mechanic') || cat.includes('auto repair') || cat.includes('car repair')) return 100;
  if (cat.includes('car wash') || cat.includes('detailing')) return 35;
  if (cat.includes('tow') || cat.includes('roadside')) return 80;
  if (cat.includes('oil change') || cat.includes('lube')) return 45;
  if (cat.includes('tire') || cat.includes('tyre')) return 70;
  if (cat.includes('body shop') || cat.includes('collision')) return 400;
  // Health & wellness
  if (cat.includes('doctor') || cat.includes('physician') || cat.includes('clinic')) return 150;
  if (cat.includes('dentist') || cat.includes('dental')) return 200;
  if (cat.includes('therapist') || cat.includes('counseling') || cat.includes('psycholog')) return 120;
  if (cat.includes('gym') || cat.includes('fitness') || cat.includes('crossfit')) return 50;
  if (cat.includes('massage') || cat.includes('spa')) return 90;
  if (cat.includes('optom') || cat.includes('eye doctor') || cat.includes('vision')) return 100;
  if (cat.includes('chiropract')) return 80;
  if (cat.includes('pharmacy') || cat.includes('drug store')) return 20;
  if (cat.includes('acupunct')) return 90;
  // Beauty & personal care
  if (cat.includes('hair') || cat.includes('salon') || cat.includes('barber')) return 45;
  if (cat.includes('nail') || cat.includes('manicure') || cat.includes('pedicure')) return 35;
  if (cat.includes('wax') || cat.includes('threading')) return 25;
  if (cat.includes('makeup') || cat.includes('cosmetic')) return 80;
  if (cat.includes('tan') || cat.includes('tanning')) return 30;
  if (cat.includes('eyelash') || cat.includes('lash')) return 100;
  // Education
  if (cat.includes('tutor') || cat.includes('test prep') || cat.includes('homework')) return 50;
  if (cat.includes('music lesson') || cat.includes('piano') || cat.includes('guitar')) return 60;
  if (cat.includes('language') || cat.includes('esl') || cat.includes('french') || cat.includes('spanish')) return 55;
  if (cat.includes('driving school') || cat.includes('driving lesson')) return 70;
  if (cat.includes('dance') || cat.includes('ballet') || cat.includes('yoga class')) return 50;
  if (cat.includes('personal train') || cat.includes('fitness coach')) return 65;
  if (cat.includes('coding') || cat.includes('programming')) return 80;
  // Professional services
  if (cat.includes('accountant') || cat.includes('cpa') || cat.includes('tax')) return 150;
  if (cat.includes('lawyer') || cat.includes('attorney') || cat.includes('legal')) return 250;
  if (cat.includes('it support') || cat.includes('tech support') || cat.includes('computer')) return 80;
  if (cat.includes('photo') || cat.includes('photographer')) return 200;
  if (cat.includes('marketing') || cat.includes('seo') || cat.includes('social media')) return 300;
  if (cat.includes('real estate') || cat.includes('realtor')) return 0;
  if (cat.includes('financial') || cat.includes('advisor') || cat.includes('invest')) return 200;
  if (cat.includes('bookkeep') || cat.includes('payroll')) return 100;
  // Pet services
  if (cat.includes('vet') || cat.includes('animal hospital')) return 120;
  if (cat.includes('pet groom') || cat.includes('grooming')) return 55;
  if (cat.includes('dog walk')) return 25;
  if (cat.includes('pet board') || cat.includes('dog boarding') || cat.includes('kennel')) return 40;
  if (cat.includes('pet train')) return 75;
  // Events
  if (cat.includes('event plan') || cat.includes('wedding plan')) return 1500;
  if (cat.includes('dj') || cat.includes('disc jockey')) return 400;
  if (cat.includes('venue') || cat.includes('banquet hall')) return 1000;
  if (cat.includes('florist') || cat.includes('flower')) return 100;
  if (cat.includes('catering')) return 35;
  // Food & dining
  if (cat.includes('restaurant') || cat.includes('diner')) return 20;
  if (cat.includes('coffee') || cat.includes('cafe') || cat.includes('tea')) return 8;
  if (cat.includes('bakery') || cat.includes('pastry')) return 12;
  if (cat.includes('bar') || cat.includes('pub') || cat.includes('nightlife')) return 15;
  if (cat.includes('food truck')) return 12;
  if (cat.includes('pizza')) return 15;
  if (cat.includes('sushi') || cat.includes('japanese')) return 25;
  if (cat.includes('burger') || cat.includes('fast food')) return 12;
  // Hospitality
  if (cat.includes('hotel') || cat.includes('motel') || cat.includes('inn')) return 100;
  if (cat.includes('bed') || cat.includes('b&b')) return 120;
  if (cat.includes('vacation rental') || cat.includes('airbnb')) return 90;
  if (cat.includes('resort') || cat.includes('lodge')) return 200;
  // Childcare
  if (cat.includes('childcare') || cat.includes('daycare') || cat.includes('nursery')) return 30;
  if (cat.includes('nanny') || cat.includes('babysit')) return 18;
  if (cat.includes('kids') || cat.includes('children')) return 25;
  return null;
}

function yelpHeaders() {
  return {
    Authorization: `Bearer ${YELP_KEY()}`,
    Accept: 'application/json'
  };
}

/**
 * Search Yelp for local service providers.
 */
export async function searchServiceProviders(opts = {}) {
  const { query, lat, lng, radiusKm = 10, maxPrice, minRating, limit = 20 } = opts;

  if (!query || !query.trim()) {
    return { ok: false, error: 'query_required', providers: [] };
  }
  if (!YELP_KEY()) {
    return { ok: false, error: 'yelp_not_configured', message: 'Set YELP_API_KEY in server/.env', providers: [] };
  }

  // Map dollar budget to Yelp price tier(s): 1=$, 2=$$, 3=$$$, 4=$$$$.
  // Yelp's $ tier for restaurants ≈ "under $11", $$ ≈ "$11–30", etc.
  function budgetToPriceTiers(budget) {
    if (!budget || isNaN(budget)) return null;
    if (budget <= 15)  return '1';
    if (budget <= 40)  return '1,2';
    if (budget <= 100) return '1,2,3';
    return null; // all tiers when budget is large
  }

  // Yelp populates price tiers reliably only for consumer-facing categories
  // (food, beauty, hospitality). For trades/professional services the price
  // field is usually empty — applying it there would exclude everyone.
  function usesYelpPriceTier(q) {
    const s = (q || '').toLowerCase();
    return /(restaurant|burger|pizza|sushi|italian|chinese|mexican|indian|thai|steak|seafood|vegan|bbq|breakfast|brunch|lunch|dinner|food|diner|coffee|cafe|café|tea|boba|bubble tea|juice|bakery|cake|pastry|donut|bar|pub|brewery|cocktail|wine|catering|salon|barber|nail|spa|massage|wax|tanning|lash|hair|makeup|hotel|motel|resort|hostel|b&b|bed (and|&) breakfast)/.test(s);
  }

  const params = new URLSearchParams({
    term: query.trim(),
    limit: String(Math.min(Number(limit) || 20, 50)),
    sort_by: 'best_match'
  });

  // Apply Yelp's native price-tier filter only for consumer categories where it's
  // reliable. This is what makes "Burgers under $10" return real $-tier spots.
  const priceTiers = budgetToPriceTiers(maxPrice);
  const applyTier = priceTiers && usesYelpPriceTier(query);
  if (applyTier) params.set('price', priceTiers);

  if (typeof lat === 'number' && typeof lng === 'number') {
    params.set('latitude', String(lat));
    params.set('longitude', String(lng));
    // Yelp radius is in metres, max 40 000 m
    params.set('radius', String(Math.min(Math.round(radiusKm * 1000), 40000)));
  } else {
    // Fallback when GPS/IP geolocation unavailable
    params.set('location', 'United States');
  }

  let raw;
  try {
    const res = await fetch(`${YELP_BASE}/businesses/search?${params}`, {
      headers: yelpHeaders()
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, error: `yelp_${res.status}`, message: txt.slice(0, 300), providers: [] };
    }
    raw = await res.json();
  } catch (e) {
    return { ok: false, error: 'yelp_request_failed', message: e.message, providers: [] };
  }

  const businesses = (raw.businesses || []).filter(b => !b.is_closed);

  let providers = businesses.map(b => {
    const provLat = b.coordinates?.latitude ?? null;
    const provLng = b.coordinates?.longitude ?? null;
    const distanceKm = typeof b.distance === 'number' ? b.distance / 1000 : null;
    const addr = [b.location?.address1, b.location?.city, b.location?.state]
      .filter(Boolean).join(', ');

    return {
      placeId: b.id,
      name: b.name,
      category: b.categories?.[0]?.title || query.trim(),
      rating: b.rating ?? null,
      reviewsCount: b.review_count ?? null,
      price: b.price || null,
      priceValue: yelpPriceToValue(b.price, query),
      // True when priceValue came from Yelp's real $ tier; false when it's our
      // category-based estimate (trades). Estimates must not hard-exclude on budget.
      priceIsEstimate: !b.price,
      address: addr || null,
      phone: b.display_phone || b.phone || null,
      website: b.url || null,
      hours: null,
      thumbnail: b.image_url || null,
      lat: provLat,
      lng: provLng,
      distanceKm,
      types: (b.categories || []).map(c => c.alias),
      description: (b.categories || []).map(c => c.title).join(', ') || null,
      mapsUrl: provLat && provLng
        ? `https://www.google.com/maps/search/?api=1&query=${provLat},${provLng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.name || query)}`
    };
  });

  if (typeof minRating === 'number') {
    providers = providers.filter(p => (p.rating || 0) >= minRating);
  }
  if (typeof maxPrice === 'number') {
    if (applyTier) {
      // Yelp already restricted by price tier — that's authoritative for the
      // budget. Don't re-filter on our rough dollar estimate (which would wrongly
      // drop valid $-tier spots, e.g. a $10 burger budget vs an estimate of $12).
    } else {
      // No tier filter (trades/professional): only exclude on a REAL Yelp price.
      // Category estimates are not actual quotes, so they never hard-exclude —
      // otherwise a $60 plumber budget (avg job ~$110) would wrongly show zero.
      providers = providers.filter(p =>
        p.priceIsEstimate || p.priceValue == null || p.priceValue <= maxPrice
      );
    }
  }

  providers = providers.slice(0, limit);

  // Cache to MongoDB (non-blocking)
  if (providers.length > 0) {
    setImmediate(() => {
      providers.forEach(p => {
        if (!p.placeId) return;
        ServiceProvider.findOneAndUpdate(
          { placeId: p.placeId },
          { $set: { ...p, source: 'yelp', cachedAt: new Date() } },
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
      source: 'yelp'
    }
  };
}

/**
 * Fetch full Yelp business details: hours, photos, website.
 * Used by the /enrich endpoint to populate the Details modal.
 */
export async function enrichYelpBusiness({ placeId, name }) {
  if (!YELP_KEY()) {
    return { ok: false, error: 'yelp_not_configured' };
  }
  if (!placeId) {
    return { ok: false, error: 'placeId_required', message: 'Yelp enrichment requires a business ID.' };
  }

  // Check 7-day cache
  try {
    const SEVEN_DAYS = 7 * 24 * 3600 * 1000;
    const cached = await ServiceProvider.findOne({ placeId });
    if (cached?.enrichedAt && (Date.now() - new Date(cached.enrichedAt).getTime()) < SEVEN_DAYS) {
      return { ok: true, cached: true, provider: cached.toObject() };
    }
  } catch (_) {}

  let b;
  try {
    const res = await fetch(`${YELP_BASE}/businesses/${encodeURIComponent(placeId)}`, {
      headers: yelpHeaders()
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, error: `yelp_${res.status}`, message: txt.slice(0, 300) };
    }
    b = await res.json();
  } catch (e) {
    return { ok: false, error: 'yelp_request_failed', message: e.message };
  }

  const addr = [b.location?.address1, b.location?.city, b.location?.state, b.location?.zip_code]
    .filter(Boolean).join(', ');

  // Format opening hours
  let openingHours = null;
  if (b.hours?.[0]?.open?.length) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const fmt = t => `${t.slice(0, 2)}:${t.slice(2)}`;
    openingHours = [...b.hours[0].open]
      .sort((a, c) => a.day - c.day)
      .map(h => `${days[h.day]}: ${fmt(h.start)} – ${fmt(h.end)}${h.is_overnight ? ' (overnight)' : ''}`)
      .join('\n');
  }

  const provider = {
    placeId: b.id,
    name: b.name,
    rating: b.rating,
    reviewsCount: b.review_count,
    price: b.price,
    address: addr || null,
    phone: b.display_phone || b.phone,
    website: b.url,
    photos: b.photos || [],
    openingHours,
    lat: b.coordinates?.latitude,
    lng: b.coordinates?.longitude,
    category: b.categories?.[0]?.title,
    reviewsSummary: b.is_claimed ? 'Claimed business on Yelp' : null
  };

  // Persist enriched data
  try {
    await ServiceProvider.findOneAndUpdate(
      { placeId: b.id },
      {
        $set: {
          ...provider,
          source: 'yelp',
          enrichedAt: new Date(),
          enrichedSource: 'yelp_details'
        }
      },
      { upsert: true, new: false }
    );
  } catch (_) {}

  return { ok: true, cached: false, provider };
}
