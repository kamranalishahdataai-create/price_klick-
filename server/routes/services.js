import express from 'express';
import { searchServiceProviders } from '../services/serviceSearch.js';
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

export default router;
