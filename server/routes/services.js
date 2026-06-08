import express from 'express';
import { searchServiceProviders, enrichYelpBusiness } from '../services/yelpSearch.js';
import { enrichServiceWebsite, isConfigured as firecrawlReady } from '../services/firecrawl.js';
import ServiceProvider from '../models/ServiceProvider.js';
import Favorite from '../models/Favorite.js';
import UserActivity from '../models/UserActivity.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

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
    console.error('services/scrape-website', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
