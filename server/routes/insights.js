// server/routes/insights.js
import express from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { generateInsights, buildActivityDigest } from '../services/prepayInsights.js';
import { runDealScraperOnce, getTopDeals, getDealsByCategories, scrapeByCategory } from '../services/dealScraper.js';
import { analyzeSpending, invalidateCache } from '../services/spendingAnalyzer.js';
import { comparePriceAcrossStores } from '../services/crossStoreFlyer.js';
import UserActivity from '../models/UserActivity.js';

const router = express.Router();

// ── Public: fast spending pattern analysis ─────────────────
// Works for both logged-in users (JWT) and anonymous sessions (X-Session-ID header)
router.get('/patterns', optionalAuth, async (req, res) => {
  try {
    const userId    = req.userId || null;
    const sessionId = req.headers['x-session-id'] || req.query.sessionId || null;

    if (!userId && !sessionId) {
      return res.json({ ok: true, hasData: false, topCategories: [], suggestions: [], suggestedDeals: [] });
    }

    const result = await analyzeSpending(userId, sessionId);
    res.json(result);
  } catch (e) {
    console.error('insights/patterns', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Public: track a user activity ─────────────────────────
router.post('/activity', optionalAuth, async (req, res) => {
  try {
    const userId    = req.userId || null;
    const sessionId = req.headers['x-session-id'] || req.body.sessionId || null;
    const { type = 'service_search', query, category, brand, productName, price, currency } = req.body || {};

    if (!type) return res.status(400).json({ ok: false, error: 'type_required' });

    await UserActivity.create({
      userId: userId || undefined,
      sessionId: sessionId || undefined,
      type,
      query:       query       || undefined,
      category:    category    || undefined,
      brand:       brand       || undefined,
      productName: productName || undefined,
      price:       price       || undefined,
      currency:    currency    || 'CAD',
    });

    // Invalidate cached analysis so next request re-computes
    if (userId || sessionId) invalidateCache(userId, sessionId);

    // Trigger background category scrape if needed
    if (category) {
      setImmediate(() => scrapeByCategory(category).catch(() => {}));
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Public: deals for given categories ────────────────────
router.get('/suggested-deals', optionalAuth, async (req, res) => {
  try {
    const cats = (req.query.cats || '').split(',').map(s => s.trim()).filter(Boolean);
    const limit = Math.min(Number(req.query.limit) || 8, 24);

    if (cats.length === 0) {
      const deals = await getTopDeals({ limit });
      return res.json({ ok: true, deals });
    }

    const deals = await getDealsByCategories(cats, { limit, minDiscount: 5 });
    res.json({ ok: true, deals, categories: cats });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Auth: weekly AI insights (OpenAI) ────────────────────
router.get('/weekly', authenticate, async (req, res) => {
  try {
    const result = await generateInsights(req.userId);
    res.json(result);
  } catch (e) {
    console.error('insights/weekly', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Auth: raw activity digest (debug) ─────────────────────
router.get('/digest', authenticate, async (req, res) => {
  try {
    const digest = await buildActivityDigest(req.userId);
    res.json({ ok: true, digest });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Public: top deals ─────────────────────────────────────
router.get('/deals', optionalAuth, async (req, res) => {
  try {
    const { category, limit } = req.query;
    const deals = await getTopDeals({ category, limit: Math.min(Number(limit) || 20, 50) });
    res.json({ ok: true, deals });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Auth/Admin: manual scrape trigger ─────────────────────
router.post('/deals/scrape', authenticate, async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'admin_only' });
  }
  try {
    const stats = await runDealScraperOnce({ minDiscount: Number(req.body?.minDiscount) || 5 });
    res.json({ ok: true, stats });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Public: cross-store grocery price compare ─────────────
router.get('/grocery-compare', optionalAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ ok: false, error: 'query_required' });
    const result = await comparePriceAcrossStores(q);
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
