// server/services/apifyEnrichment.js
// Enriches a Google Maps service provider with full Place data via Apify's
// `compass/crawler-google-places` actor. Caches results for 7 days in
// ServiceProvider. Optionally summarises reviews via OpenAI.
import fetch from 'node-fetch';
import ServiceProvider from '../models/ServiceProvider.js';

const ACTOR_ID = 'compass~crawler-google-places';
const SEVEN_DAYS = 7 * 24 * 3600 * 1000;

function authToken() {
  return process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN;
}

async function runApifyActor(input) {
  const token = authToken();
  if (!token) throw new Error('APIFY_TOKEN missing');
  const url = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    timeout: 90000
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`apify ${r.status}: ${t.slice(0, 200)}`);
  }
  return r.json();
}

function normaliseReview(rv) {
  if (!rv) return null;
  return {
    name: rv.name || rv.reviewerName,
    text: rv.text || rv.snippet || '',
    stars: rv.stars || rv.rating,
    publishedAt: rv.publishedAtDate || rv.publishedAt || rv.publishAt
  };
}

function normalisePlace(p) {
  return {
    placeId: p.placeId || p.cid,
    name: p.title || p.name,
    rating: p.totalScore || p.rating,
    reviewsCount: p.reviewsCount || p.reviewCount,
    address: p.address || p.formattedAddress,
    phone: p.phone || p.phoneUnformatted,
    website: p.website,
    email: (p.emails && p.emails[0]) || null,
    socials: {
      facebook: p.facebooks?.[0] || null,
      instagram: p.instagrams?.[0] || null,
      twitter: p.twitters?.[0] || null,
      linkedin: p.linkedIns?.[0] || null
    },
    photos: (p.imageUrls || p.images || []).slice(0, 12),
    openingHours: p.openingHours || p.openingHoursTable || null,
    popularTimes: p.popularTimes || null,
    lat: p.location?.lat,
    lng: p.location?.lng,
    types: p.categories || p.types || [],
    reviewsText: (p.reviews || []).slice(0, 12).map(normaliseReview).filter(Boolean),
    raw: { temporarilyClosed: p.temporarilyClosed, permanentlyClosed: p.permanentlyClosed }
  };
}

async function summariseReviews(reviews) {
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY || !reviews?.length) return null;
  const sample = reviews.slice(0, 10).map(r => `(${r.stars || '?'}★) ${r.text || ''}`).join('\n').slice(0, 4000);
  if (!sample.trim()) return null;
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'Summarise customer reviews of a service provider. Output JSON only: {"summary":"...","pros":["..."],"cons":["..."]}. Max 3 pros, 3 cons. Be specific and concise.' },
          { role: 'user', content: sample }
        ]
      }),
      timeout: 30000
    });
    if (!r.ok) return null;
    const j = await r.json();
    const txt = j.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(txt);
    return { ...parsed, generatedAt: new Date() };
  } catch {
    return null;
  }
}

/**
 * Enrich a single provider by placeId. Returns the (possibly cached) enriched doc.
 */
export async function enrichProvider({ placeId, name, address, force = false }) {
  if (!placeId && !name) throw new Error('placeId_or_name_required');

  // Cache hit
  if (placeId && !force) {
    const cached = await ServiceProvider.findOne({ placeId });
    if (cached?.enrichedAt && (Date.now() - new Date(cached.enrichedAt).getTime()) < SEVEN_DAYS) {
      return { ok: true, cached: true, provider: cached.toObject() };
    }
  }

  // Build Apify input — supports placeIds or fallback to search
  const input = {
    maxCrawledPlacesPerSearch: 1,
    language: 'en',
    maxReviews: 12,
    maxImages: 8,
    scrapeReviewsPersonalData: false,
    includeWebResults: false
  };
  if (placeId) {
    input.placeIds = [placeId.startsWith('ChIJ') || placeId.startsWith('Ei') ? placeId : `ChIJ${placeId}`];
  } else {
    input.searchStringsArray = [`${name} ${address || ''}`.trim()];
  }

  const items = await runApifyActor(input);
  const place = Array.isArray(items) ? items[0] : null;
  if (!place) return { ok: false, error: 'no_place_returned' };
  const norm = normalisePlace(place);
  const aiReviewSummary = await summariseReviews(norm.reviewsText);

  const update = {
    ...(norm.name && { name: norm.name }),
    ...(norm.rating != null && { rating: norm.rating }),
    ...(norm.reviewsCount != null && { reviewsCount: norm.reviewsCount }),
    ...(norm.address && { address: norm.address }),
    ...(norm.phone && { phone: norm.phone }),
    ...(norm.website && { website: norm.website }),
    ...(norm.lat != null && { lat: norm.lat }),
    ...(norm.lng != null && { lng: norm.lng }),
    ...(norm.types?.length && { types: norm.types }),
    reviewsText: norm.reviewsText,
    photos: norm.photos,
    openingHours: norm.openingHours,
    popularTimes: norm.popularTimes,
    email: norm.email,
    socials: norm.socials,
    aiReviewSummary: aiReviewSummary || undefined,
    enrichedAt: new Date(),
    enrichedSource: 'apify_google_maps'
  };

  const targetPlaceId = norm.placeId || placeId;
  let doc;
  if (targetPlaceId) {
    doc = await ServiceProvider.findOneAndUpdate(
      { placeId: targetPlaceId },
      { $set: { placeId: targetPlaceId, ...update } },
      { upsert: true, new: true }
    );
  } else {
    doc = await ServiceProvider.create({ name: norm.name, ...update });
  }
  return { ok: true, cached: false, provider: doc.toObject() };
}
