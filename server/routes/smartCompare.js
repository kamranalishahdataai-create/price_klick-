// server/routes/smartCompare.js
// AI-Powered Smart Compare Advisor
// POST /api/smart-compare  { query, budget, location, category }
// Returns structured comparison: promotions, finance-vs-lease (if applicable), fit-scored options.
import express from 'express';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Read env at request time (not module-load time) so values populated by dotenv
// after this module is imported are always picked up.
const getOpenAiKey = () => process.env.OPENAI_API_KEY;
const getModel = () => process.env.SMART_COMPARE_MODEL || 'gpt-4o-mini';

const SYSTEM_PROMPT = `You are PriceKlick Smart Compare Advisor, an expert AI shopping & finance assistant.
Given a buyer's natural-language request plus optional budget, location, and category, produce a high-quality
side-by-side comparison the user can act on immediately.

ALWAYS reply with VALID JSON matching exactly this schema (no markdown, no commentary):
{
  "ok": true,
  "summary": "<one-line restating the user's need, e.g. 'Vehicle in the GTA, budget $60K, gas/hybrid/EV — financing or leasing?'>",
  "category": "<auto-detected category: vehicle | home_service | insurance | electronics | appliance | other>",
  "analyzedCount": <integer estimate of how many items were considered, e.g. 1247>,
  "vendorsCount": <integer estimate of vendors/dealers/providers, e.g. 36>,
  "promotions": [ { "brand": "<Brand>", "title": "<promo headline>", "detail": "<short detail>", "expiry": "<optional, e.g. 'Expires Jun 30'>", "category": "<sub-category>" } ],
  "financeVsLease": null | {
    "finance": { "monthly": "<$/mo>", "term": "<e.g. 60 months>", "totalCost": "<$>", "downPayment": "<$ (%)>", "mileageCap": "<text>", "ownershipAtEnd": "<text>", "pros": ["..."], "cons": ["..."], "bestFor": "<text>" },
    "lease":   { "monthly": "<$/mo>", "term": "<e.g. 36 months>", "totalCost": "<$ + residual>", "downPayment": "<$ (cap cost reduction)>", "mileageCap": "<text>", "ownershipAtEnd": "<text>", "pros": ["..."], "cons": ["..."], "bestFor": "<text>" },
    "breakEvenYears": <number, e.g. 4.2>
  },
  "options": [
    {
      "fitScore": <0-100 integer>,
      "brand": "<Brand>",
      "model": "<Model/Trim>",
      "tag": "<short tag e.g. 'Hybrid', 'EV', 'Gas'>",
      "price": "<$ formatted>",
      "priceLabel": "<e.g. 'Starting MSRP', 'from'>",
      "pros": ["<short pro>", "<short pro>", "<short pro>"],
      "cons": ["<short con>", "<short con>"],
      "image": "<optional public image URL of product>",
      "url": "<optional buy/explore URL>"
    }
  ]
}

Rules:
- ALWAYS include at least 4 options when possible, ranked best-fit first.
- fitScore: weigh budget fit, location availability, user-stated preferences, reliability/value.
- promotions: include 3–4 brand promotions actually plausible for the user's region & category.
- financeVsLease: include ONLY when category is "vehicle". Otherwise null.
- Keep all strings concise; pros/cons ≤ 6 words each.
- If budget is provided, weight in-budget items strongly.
- Use the user's location for currency & regional context. If unclear default to USD.
- NEVER fabricate URLs you are not confident exist. Leave url blank if unsure.
- Return ONLY the JSON object.`;

function buildUserPrompt({ query, budget, location, category }) {
  const parts = [];
  parts.push(`Request: ${query || '(no specific query)'}`);
  if (budget) parts.push(`Max budget: $${budget}`);
  if (location) parts.push(`Location: ${location}`);
  if (category) parts.push(`Hint category: ${category}`);
  parts.push(`Today's date: ${new Date().toISOString().slice(0, 10)}`);
  return parts.join('\n');
}

router.post('/', optionalAuth, async (req, res) => {
  try {
    const OPENAI_KEY = getOpenAiKey();
    const MODEL = getModel();
    if (!OPENAI_KEY) {
      return res.status(503).json({ ok: false, error: 'OPENAI_API_KEY missing on server' });
    }
    const { query, budget, location, category } = req.body || {};
    if (!query || String(query).trim().length < 3) {
      return res.status(400).json({ ok: false, error: 'Please describe what you want (at least a few words).' });
    }

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt({ query, budget, location, category }) },
        ],
      }),
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      console.error('SMART_COMPARE openai_error', r.status, txt.slice(0, 300));
      return res.status(502).json({ ok: false, error: 'AI service unavailable. Please try again shortly.' });
    }
    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content;
    if (!content) return res.status(502).json({ ok: false, error: 'Empty AI response.' });

    let parsed;
    try { parsed = JSON.parse(content); }
    catch (e) {
      console.error('SMART_COMPARE parse_error', e.message);
      return res.status(502).json({ ok: false, error: 'AI returned malformed data. Please retry.' });
    }

    // Defensive normalisation
    parsed.ok = true;
    parsed.updatedAt = new Date().toISOString();
    parsed.options = Array.isArray(parsed.options) ? parsed.options : [];
    parsed.promotions = Array.isArray(parsed.promotions) ? parsed.promotions : [];

    // Best-effort log activity (non-blocking)
    if (req.user?._id) {
      try {
        const { default: UserActivity } = await import('../models/UserActivity.js');
        UserActivity.create({
          userId: req.user._id,
          type: 'compare',
          payload: { query, budget, location, category, optionsCount: parsed.options.length },
        }).catch(() => {});
      } catch {}
    }

    res.json(parsed);
  } catch (e) {
    console.error('SMART_COMPARE error', e);
    res.status(500).json({ ok: false, error: 'Internal error generating comparison.' });
  }
});

export default router;
