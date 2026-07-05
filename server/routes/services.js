import express from 'express';
import { searchServiceProviders as fsqSearch, enrichServiceProvider as fsqEnrich } from '../services/foursquareSearch.js';
import { searchServiceProviders as yelpSearch, enrichYelpBusiness as yelpEnrich } from '../services/yelpSearch.js';
import { enrichServiceWebsite, isConfigured as firecrawlReady } from '../services/firecrawl.js';
import { getProviderMenu, isConfigured as menuReady } from '../services/menuScraper.js';
import { findLocalDeals, isConfigured as dealsReady } from '../services/localDeals.js';
import ServiceProvider from '../models/ServiceProvider.js';
import Favorite from '../models/Favorite.js';
import UserActivity from '../models/UserActivity.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Provider selection: SERVICE_SEARCH_PROVIDER = 'foursquare' | 'yelp' (default yelp).
// Whichever is primary, the other is an automatic fallback — so if the primary is
// out of credits / errors / returns nothing, results still come from the backup.
const primaryProvider = () => (process.env.SERVICE_SEARCH_PROVIDER || 'yelp').toLowerCase();

async function searchServiceProviders(opts) {
  const useFsqFirst = primaryProvider() === 'foursquare';
  const first = useFsqFirst ? fsqSearch : yelpSearch;
  const second = useFsqFirst ? yelpSearch : fsqSearch;
  const r1 = await first(opts);
  if (r1.ok && (r1.count || 0) > 0) return r1;
  const r2 = await second(opts);
  if (r2.ok) return r2;         // backup succeeded (even if 0 results)
  return r1.ok ? r1 : r2;       // both failed — surface whichever error
}

async function enrichYelpBusiness(args) {
  const useFsqFirst = primaryProvider() === 'foursquare';
  const first = useFsqFirst ? fsqEnrich : yelpEnrich;
  const second = useFsqFirst ? yelpEnrich : fsqEnrich;
  const r1 = await first(args);
  if (r1.ok) return r1;
  const r2 = await second(args);
  return r2.ok ? r2 : r1;
}

// Search providers — public (with optional auth so we can track logged-in users)
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const {
      q, query, lat, lng, radiusKm, maxPrice, minRating, limit
    } = req.query;
    const result = await searchServiceProviders({
      query: q || query,
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      radiusKm: radiusKm ? Number(radiusKm) : 10,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      minRating: minRating ? Number(minRating) : undefined,
      limit: limit ? Number(limit) : 20
    });

    // Track activity (non-blocking)
    if (result.ok) {
      setImmediate(() => {
        UserActivity.create({
          userId: req.userId || null,
          sessionId: req.headers['x-session-id'] || null,
          type: 'service_search',
          query: result.meta.query,
          category: result.meta.query,
          location: lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined,
          meta: { resultCount: result.count, radiusKm: result.meta.radiusKm }
        }).catch(() => {});
      });
    }

    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: 'server_error', message: e.message });
  }
});

// Live budget deals — for the businesses in the results, find REAL current deals
// at/below the user's budget (Perplexity web search). Powers the "this place also
// has a deal under $X" ribbons.
router.post('/deals', optionalAuth, async (req, res) => {
  try {
    if (!dealsReady()) return res.json({ ok: true, deals: [], disabled: true });
    const { providers = [], budget, category, location } = req.body || {};
    const result = await findLocalDeals({ providers, budget, category, location });
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, deals: [] });
  }
});

// Click tracking
router.post('/track-click', optionalAuth, async (req, res) => {
  try {
    const { providerId, placeId, name, category, type = 'service_click' } = req.body || {};
    await UserActivity.create({
      userId: req.userId || null,
      sessionId: req.headers['x-session-id'] || null,
      type,
      query: category || null,
      productName: name || null,
      meta: { providerId, placeId }
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'server_error', message: e.message });
  }
});

// Favorites — must be logged in
router.post('/favorite', authenticate, async (req, res) => {
  try {
    const { provider, notes } = req.body || {};
    if (!provider) return res.status(400).json({ ok: false, error: 'provider_required' });

    let prov = null;
    if (provider.placeId) {
      prov = await ServiceProvider.findOneAndUpdate(
        { placeId: provider.placeId },
        { $set: { ...provider, source: provider.source || 'serpapi_google_maps' } },
        { upsert: true, new: true }
      );
    } else {
      prov = await ServiceProvider.create(provider);
    }

    const fav = await Favorite.findOneAndUpdate(
      { userId: req.userId, providerId: prov._id },
      { $set: { notes } },
      { upsert: true, new: true }
    );

    setImmediate(() => {
      UserActivity.create({
        userId: req.userId,
        type: 'service_favorite',
        productName: prov.name,
        category: prov.category,
        meta: { providerId: prov._id, placeId: prov.placeId }
      }).catch(() => {});
    });

    res.json({ ok: true, favorite: fav, provider: prov });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'server_error', message: e.message });
  }
});

router.delete('/favorite/:providerId', authenticate, async (req, res) => {
  try {
    await Favorite.deleteOne({ userId: req.userId, providerId: req.params.providerId });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'server_error', message: e.message });
  }
});

router.get('/favorites', authenticate, async (req, res) => {
  try {
    const favs = await Favorite.find({ userId: req.userId })
      .populate('providerId')
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      ok: true,
      favorites: favs.map(f => ({
        _id: f._id,
        notes: f.notes,
        createdAt: f.createdAt,
        provider: f.providerId
      })).filter(f => f.provider)
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'server_error', message: e.message });
  }
});

// Enrich a provider via Yelp Business Details API (hours, photos, website — cached 7 days)
router.post('/enrich', optionalAuth, async (req, res) => {
  try {
    const { placeId, name } = req.body || {};
    if (!placeId && !name) {
      return res.status(400).json({ ok: false, error: 'placeId_or_name_required' });
    }
    const result = await enrichYelpBusiness({ placeId, name });
    res.json(result);
  } catch (e) {
    console.error('services/enrich', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Scrape-or-cache a provider's published menu / price list, bucketed by price.
// Body: { provider: {placeId?, name, website?, city?}, category?, budget?, force? }
// Returns items (full menu) + matches (≤ budget), served from Mongo when fresh.
router.post('/menu', optionalAuth, async (req, res) => {
  try {
    const { provider = {}, category, budget, force } = req.body || {};
    if (!provider.name) return res.status(400).json({ ok: false, error: 'provider_name_required' });
    if (!menuReady()) {
      return res.status(503).json({ ok: false, error: 'menu_not_configured', message: 'No scraping engine configured.' });
    }
    const result = await getProviderMenu({
      placeId: provider.placeId,
      name: provider.name,
      website: provider.website,
      city: provider.city,
      location: provider.location,
      category,
      budget,
      force: !!force && req.user?.role === 'admin', // force re-scrape is admin-only
    });
    res.json(result);
  } catch (e) {
    console.error('services/menu', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Scrape a service provider's own website for real pricing & services (Firecrawl)
router.post('/scrape-website', optionalAuth, async (req, res) => {
  try {
    const { url, name } = req.body || {};
    if (!url) return res.status(400).json({ ok: false, error: 'url_required' });
    if (!firecrawlReady()) {
      return res.status(503).json({ ok: false, error: 'firecrawl_not_configured', message: 'Set FIRECRAWL_API_KEY in server/.env' });
    }
    const result = await enrichServiceWebsite(url, name || '');
    res.json({ ok: true, ...result });
  } catch (e) {
    if (e.code === 'firecrawl_out_of_credits') {
      return res.status(503).json({
        ok: false,
        error: 'menu_unavailable',
        message: 'Live menu & pricing is temporarily unavailable. Visit the business website for full details.'
      });
    }
    console.error('services/scrape-website', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
