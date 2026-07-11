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
// Perplexity (optional). When PERPLEXITY_API_KEY is set we use it as the primary
// engine — it has live web access, so it returns REAL current promotions and
// REAL working URLs + citations. Falls back to OpenAI when unset or on error.
const getPerplexityKey = () => process.env.PERPLEXITY_API_KEY;
const getPplxModel = () => process.env.SMART_COMPARE_PPLX_MODEL || 'sonar-pro';
// Claude (Anthropic) — best reasoning engine. Selected as primary via
// SMART_COMPARE_PROVIDER=claude. No live web, so URLs come from the client-side
// brand resolver; pair with Perplexity if exact live promo URLs are needed.
const getClaudeKey = () => process.env.ANTHROPIC_API_KEY;
const getClaudeModel = () => process.env.SMART_COMPARE_CLAUDE_MODEL || 'claude-opus-4-8';
// Which engine to try first: 'claude' | 'perplexity' | 'openai' (default: perplexity).
const getProvider = () => (process.env.SMART_COMPARE_PROVIDER || 'perplexity').toLowerCase();

// Tolerant JSON extraction — strips ```json fences / stray prose around the object.
function extractJson(content) {
  if (!content) return null;
  let s = String(content).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(s); } catch {}
  const start = s.indexOf('{'); const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(s.slice(start, end + 1)); } catch {}
  }
  return null;
}

async function callPerplexity({ query, budget, location, category }) {
  const KEY = getPerplexityKey();
  if (!KEY) return null;
  try {
    const r = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getPplxModel(),
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + '\n\nYou have LIVE web access. Populate every "url" field with a REAL, working product/offer page you actually found, and make "promotions" reflect REAL current offers. Output ONLY the JSON object.' },
          { role: 'user', content: buildUserPrompt({ query, budget, location, category }) },
        ],
      }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      console.error('SMART_COMPARE perplexity_error', r.status, txt.slice(0, 200));
      return null;
    }
    const j = await r.json();
    const parsed = extractJson(j?.choices?.[0]?.message?.content);
    if (!parsed) return null;
    if (Array.isArray(j.citations) && j.citations.length) parsed.citations = j.citations;
    parsed.engine = 'perplexity';
    return parsed;
  } catch (e) {
    console.error('SMART_COMPARE perplexity_exception', e.message);
    return null;
  }
}

// Hybrid enrichment: take a comparison produced by Claude/OpenAI (great reasoning
// but no live web) and use Perplexity's live web access to fill in REAL, current
// URLs for each promotion + option, plus attach source citations. Best-effort —
// returns the original object unchanged on any failure.
// A search-engine results link is not a destination — users must land on the
// product/offer page itself, never on Google.
const isSearchEngineUrl = (u) =>
  typeof u === 'string' && /(google|bing|duckduckgo|yahoo)\.[a-z.]+\/(search|shopping)|google\.[a-z.]+\/url/i.test(u);

async function enrichUrlsWithPerplexity(parsed, { location } = {}) {
  const KEY = getPerplexityKey();
  if (!KEY || !parsed) return parsed;

  const promos = Array.isArray(parsed.promotions) ? parsed.promotions : [];
  const options = Array.isArray(parsed.options) ? parsed.options : [];

  // Flat list of items needing a real URL (cap to keep the prompt tight).
  // An option "needs" a URL when it has none OR when the engine produced a
  // search-engine link instead of the actual product page. (Images come from
  // the reliable Wikipedia lookup, not from guessed URLs.)
  const items = [];
  promos.slice(0, 5).forEach((p, idx) =>
    items.push({ kind: 'promo', idx, label: `${p.brand || ''} — ${p.title || ''} (promotion/offer page)` }));
  options.slice(0, 5).forEach((o, idx) => {
    if (!o.url || isSearchEngineUrl(o.url)) {
      items.push({ kind: 'option', idx, label: `${o.brand || ''} ${o.model || ''} (the official manufacturer product page for this exact model)` });
    }
  });
  if (items.length === 0) return parsed;

  const list = items.map((it, i) => `${i + 1}. ${it.label}`).join('\n');
  const prompt =
    `Find the EXACT current official URL for each item below. For promotions link to the brand's specific offers/deals page; for products link to the official manufacturer product page for that exact model. ` +
    `Use ONLY real, working URLs you can verify right now${location ? ` for the ${location} region` : ''}. ` +
    `NEVER return a search-engine results URL (google.com/search, bing.com, etc.) — only the destination page itself.\n\nItems:\n${list}\n\nRespond with ONLY this JSON: {"items":[{"n":<item number>,"url":"<exact url>"}]}`;

  try {
    const r = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getPplxModel(),
        temperature: 0.1,
        messages: [
          { role: 'system', content: 'You are a precise web research assistant with live web access. Return only real, current, working URLs. Output ONLY the requested JSON.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      console.error('SMART_COMPARE enrich_error', r.status, txt.slice(0, 200));
      return parsed;
    }
    const j = await r.json();
    const data = extractJson(j?.choices?.[0]?.message?.content);
    const found = (data && Array.isArray(data.items)) ? data.items : [];
    let applied = 0;
    found.forEach(u => {
      const n = Number(u.n);
      const url = typeof u.url === 'string' ? u.url.trim() : '';
      if (!n || !/^https?:\/\//i.test(url) || isSearchEngineUrl(url)) return;
      const it = items[n - 1];
      if (!it) return;
      if (it.kind === 'promo' && promos[it.idx]) { promos[it.idx].url = url; applied++; }
      if (it.kind === 'option' && options[it.idx]) { options[it.idx].url = url; applied++; }
    });
    if (Array.isArray(j.citations) && j.citations.length) parsed.citations = j.citations;
    if (applied > 0) parsed.urlsEnrichedBy = 'perplexity';
  } catch (e) {
    console.error('SMART_COMPARE enrich_exception', e.message);
  }
  return parsed;
}

// Real product photos via the Wikipedia page-image API. Deterministic and
// reliable (unlike asking an LLM to guess exact image filenames): we search for
// the model's article and take its lead image thumbnail. Best-effort per option.
const TRIM_WORDS = /\b(XLE|XSE|LE|SE|SEL|RWD|AWD|FWD|4WD|EX|EX-L|LX|DX|GT|GTS|Turbo|Preferred|Ultimate|Touring|Sport|Hybrid|PHEV|EV|Limited|Premium|Platinum|Base|Advanced|Pack|Package|Edition|Trim|Line|Plus|Pro|Max|Long\s*Range|Standard|Performance)\b/gi;

async function fetchWikiImage(brand, model) {
  const brandWord = (brand || '').trim().split(/\s+/)[0];
  const cleaned = `${brand || ''} ${model || ''}`.replace(TRIM_WORDS, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  // Force the brand into the article title so we land on the model's page, not a
  // tangential result (e.g. a race driver photographed in a Honda).
  const modelPart = brandWord ? cleaned.replace(new RegExp('^' + brandWord, 'i'), '').trim() : cleaned;
  const term = brandWord ? `intitle:${brandWord} ${modelPart}`.trim() : cleaned;
  const api = `https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=640&redirects=1`;
  // Retry once on failure — parallel lookups can transiently trip Wikipedia's rate limit.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const ctrl = AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined;
      const r = await fetch(api, { headers: { 'User-Agent': 'PriceKlick/1.0 (smart-compare)' }, signal: ctrl });
      if (r.ok) {
        const j = await r.json();
        const pages = j?.query?.pages;
        if (pages) {
          for (const k of Object.keys(pages)) {
            const pg = pages[k];
            const src = pg?.thumbnail?.source;
            const title = String(pg?.title || '');
            // Safety net: the matched article's title must contain the brand.
            if (brandWord && !new RegExp(brandWord, 'i').test(title)) continue;
            if (typeof src === 'string' && /^https:\/\/upload\.wikimedia\.org/i.test(src)) return src;
          }
          return null; // valid response, genuinely no image — no point retrying
        }
      }
    } catch { /* fall through to retry */ }
    if (attempt === 0) await new Promise(res => setTimeout(res, 500));
  }
  return null;
}

async function enrichImagesWithWikipedia(parsed) {
  const options = Array.isArray(parsed.options) ? parsed.options : [];
  const targets = options.map((o, idx) => ({ o, idx })).filter(x => !x.o.image).slice(0, 6);
  if (!targets.length) return parsed;
  await Promise.all(targets.map(async ({ o }) => {
    const img = await fetchWikiImage(o.brand, o.model);
    if (img) o.image = img;
  }));
  if (targets.some(t => t.o.image)) parsed.imagesEnrichedBy = 'wikipedia';
  return parsed;
}

async function callOpenAI({ query, budget, location, category }) {
  const OPENAI_KEY = getOpenAiKey();
  if (!OPENAI_KEY) return null;
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getModel(),
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
      return null;
    }
    const j = await r.json();
    const parsed = extractJson(j?.choices?.[0]?.message?.content);
    if (parsed) parsed.engine = 'openai';
    return parsed;
  } catch (e) {
    console.error('SMART_COMPARE openai_exception', e.message);
    return null;
  }
}

async function callClaude({ query, budget, location, category }) {
  const KEY = getClaudeKey();
  if (!KEY) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: getClaudeModel(),
        max_tokens: 4096,
        // NB: Claude Opus 4.8 deprecates `temperature` — omit it.
        system: SYSTEM_PROMPT + '\n\nReturn ONLY the JSON object — no markdown fences, no prose before or after.',
        messages: [{ role: 'user', content: buildUserPrompt({ query, budget, location, category }) }],
      }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      console.error('SMART_COMPARE claude_error', r.status, txt.slice(0, 300));
      return null;
    }
    const j = await r.json();
    const text = Array.isArray(j.content) ? j.content.map(c => c.text || '').join('') : '';
    const parsed = extractJson(text);
    if (parsed) parsed.engine = 'claude';
    return parsed;
  } catch (e) {
    console.error('SMART_COMPARE claude_exception', e.message);
    return null;
  }
}

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
    if (!getClaudeKey() && !getPerplexityKey() && !getOpenAiKey()) {
      return res.status(503).json({ ok: false, error: 'No AI key configured (set ANTHROPIC_API_KEY, PERPLEXITY_API_KEY or OPENAI_API_KEY).' });
    }
    const { query, budget, location, category } = req.body || {};
    if (!query || String(query).trim().length < 3) {
      return res.status(400).json({ ok: false, error: 'Please describe what you want (at least a few words).' });
    }

    const args = { query, budget, location, category };
    // Engine order depends on SMART_COMPARE_PROVIDER. Each falls back to the next.
    //  - claude:     Claude Opus (best reasoning) → Perplexity → OpenAI
    //  - perplexity: live web + real URLs → Claude → OpenAI
    //  - openai:     OpenAI → Claude → Perplexity
    const provider = getProvider();
    const order =
      provider === 'claude'     ? [callClaude, callPerplexity, callOpenAI] :
      provider === 'openai'     ? [callOpenAI, callClaude, callPerplexity] :
                                  [callPerplexity, callClaude, callOpenAI];

    let parsed = null;
    for (const engine of order) {
      parsed = await engine(args);
      if (parsed) break;
    }

    if (!parsed) {
      return res.status(502).json({ ok: false, error: 'AI service unavailable. Please try again shortly.' });
    }

    // Defensive normalisation
    parsed.ok = true;
    parsed.updatedAt = new Date().toISOString();
    parsed.options = Array.isArray(parsed.options) ? parsed.options : [];
    parsed.promotions = Array.isArray(parsed.promotions) ? parsed.promotions : [];

    // Fill real product photos from Wikipedia (reliable, existing image URLs).
    // Runs for every engine — best-effort, never blocks the response on failure.
    await enrichImagesWithWikipedia(parsed);

    // Hybrid step: when the comparison came from Claude/OpenAI (no live web),
    // use Perplexity to fill in REAL current promo/product URLs + citations.
    // Perplexity results already carry live URLs, so skip enrichment for them.
    if (parsed.engine !== 'perplexity' && getPerplexityKey()) {
      await enrichUrlsWithPerplexity(parsed, { location });
    }

    // Best-effort activity capture (logged-in OR anonymous session) — non-blocking.
    try {
      const { default: UserActivity } = await import('../models/UserActivity.js');
      UserActivity.create({
        userId: req.user?._id || undefined,
        sessionId: req.headers['x-session-id'] || undefined,
        type: 'smart_compare',
        query: query || undefined,
        category: (parsed.category || category) || undefined,
        location: location ? { city: String(location).slice(0, 80) } : undefined,
        meta: { budget: budget || null, optionsCount: parsed.options.length, engine: parsed.engine || null },
      }).catch(() => {});
    } catch {}

    res.json(parsed);
  } catch (e) {
    console.error('SMART_COMPARE error', e);
    res.status(500).json({ ok: false, error: 'Internal error generating comparison.' });
  }
});

export default router;
