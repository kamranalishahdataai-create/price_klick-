// server/routes/insights.js
import express from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { generateInsights, buildActivityDigest } from '../services/prepayInsights.js';
import { runDealScraperOnce, getTopDeals } from '../services/dealScraper.js';
import { comparePriceAcrossStores } from '../services/crossStoreFlyer.js';

const router = express.Router();

// PrePay weekly insights for the logged-in user
router.get('/weekly', authenticate, async (req, res) => {
  try {
    const result = await generateInsights(req.userId);
    res.json(result);
  } catch (e) {
    console.error('insights/weekly', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Raw activity digest (no LLM) — debugging / fallback
router.get('/digest', authenticate, async (req, res) => {
  try {
    const digest = await buildActivityDigest(req.userId);
    res.json({ ok: true, digest });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Top deals (public)
router.get('/deals', optionalAuth, async (req, res) => {
  try {
    const { category, limit } = req.query;
    const deals = await getTopDeals({ category, limit: Math.min(Number(limit) || 20, 50) });
    res.json({ ok: true, deals });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Manual trigger (admin) — handy for first deploy
router.post('/deals/scrape', authenticate, async (req, res) => {
  if (!req.user?.isAdmin && req.user?.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'admin_only' });
  }
  try {
    const stats = await runDealScraperOnce({ minDiscount: Number(req.body?.minDiscount) || 15 });
    res.json({ ok: true, stats });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Cross-store grocery price comparison
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
