// Menu / price-list scraping pipeline.
//
// Turns the Services page from a directory into a menu-level price search:
//   1. SCRAPE a business's published menu / service price list from the web
//      (Firecrawl structured-extract when funded; Perplexity live web otherwise)
//   2. CATEGORIZE items into price buckets on the backend and persist to Mongo
//   3. SERVE budget-filtered items ("pizza under $15 at Pizza Pizza") from cache
//
// Works for any category: restaurant menus, salon price lists, oil-change
// packages, gym rates, tutoring fees — the prompt is category-neutral.

import ServiceMenu from '../models/ServiceMenu.js';
import { enrichServiceWebsite, isConfigured as firecrawlReady } from './firecrawl.js';

const getPplxKey = () => process.env.PERPLEXITY_API_KEY;
const getPplxModel = () =>
  process.env.MENU_PPLX_MODEL || process.env.SMART_COMPARE_PPLX_MODEL || 'sonar-pro';

const FRESH_MS = 7 * 24 * 3600 * 1000;      // menus re-scrape after 7 days
const EMPTY_RETRY_MS = 24 * 3600 * 1000;    // "no menu found" retried after 1 day

// ── helpers ──────────────────────────────────────────────────────────────────

function extractJson(content) {
  if (!content) return null;
  let s = String(content).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(s); } catch {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch {} }
  return null;
}

function parsePrice(str) {
  if (str == null) return null;
  if (typeof str === 'number') return isFinite(str) ? str : null;
  const m = String(str).replace(/,/g, '').match(/\$?\s*([\d]+(?:\.[\d]{1,2})?)/);
  return m ? parseFloat(m[1]) : null;
}

// NB: bucket labels must not start with "$" — they're used as Mongo map keys,
// and MongoDB rejects dollar-prefixed field names. The UI prefixes "$" itself.
export function bucketFor(price) {
  if (price == null || !isFinite(price)) return null;
  if (price < 5) return '0–5';
  if (price < 10) return '5–10';
  if (price < 15) return '10–15';
  if (price < 25) return '15–25';
  if (price < 50) return '25–50';
  return '50+';
}

const nameKeyOf = (name) => (name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Narrow the budget "matches" to the SELECTED service type — a pizza search
// should surface pizzas, not the shop's fries; a coffee search should surface
// drinks, not sandwiches. Keyword sets per common service; unmapped categories
// fall back to the significant words of the category name itself.
const FOCUS_KEYWORDS = {
  // ── Food & drink ──
  pizza: ['pizza', 'margherita', 'pepperoni', 'calzone'],
  burgers: ['burger', 'smash', 'patty', 'cheeseburger'],
  sushi: ['sushi', 'roll', 'sashimi', 'nigiri', 'maki', 'japanese', 'bento'],
  'coffee & tea': ['coffee', 'tea', 'espresso', 'latte', 'cappuccino', 'americano', 'mocha', 'macchiato', 'cortado', 'brew', 'matcha', 'chai', 'flat white', 'affogato', 'cold brew', 'drip'],
  'coffee and tea': ['coffee', 'tea', 'espresso', 'latte', 'cappuccino', 'americano', 'mocha', 'macchiato', 'cortado', 'brew', 'matcha', 'chai', 'flat white', 'cold brew', 'drip'],
  coffee: ['coffee', 'espresso', 'latte', 'cappuccino', 'americano', 'mocha', 'macchiato', 'cortado', 'brew', 'drip', 'cold brew', 'flat white', 'affogato'],
  tea: ['tea', 'matcha', 'chai', 'oolong', 'herbal', 'green tea', 'black tea'],
  'cafés': ['coffee', 'tea', 'espresso', 'latte', 'cappuccino', 'pastry', 'croissant'],
  'cafes': ['coffee', 'tea', 'espresso', 'latte', 'cappuccino', 'pastry', 'croissant'],
  'espresso bars': ['espresso', 'coffee', 'latte', 'cappuccino', 'americano', 'macchiato', 'cortado'],
  'bubble tea': ['bubble tea', 'boba', 'milk tea', 'tea', 'smoothie'],
  'juice bars': ['juice', 'smoothie', 'shake', 'bowl'],
  bakeries: ['bread', 'cake', 'pastry', 'croissant', 'muffin', 'cookie', 'donut', 'bun', 'loaf', 'bagel', 'tart', 'pie', 'scone'],
  bars: ['beer', 'wine', 'cocktail', 'draft', 'pint', 'spirit', 'shot', 'ale', 'lager', 'margarita'],
  catering: ['platter', 'tray', 'package', 'buffet', 'catering', 'box'],
  italian: ['pasta', 'pizza', 'risotto', 'lasagna', 'spaghetti', 'italian', 'gnocchi'],
  chinese: ['noodle', 'rice', 'dumpling', 'chow', 'wonton', 'spring roll', 'chinese'],
  mexican: ['taco', 'burrito', 'quesadilla', 'nacho', 'enchilada', 'fajita', 'mexican'],
  indian: ['curry', 'naan', 'biryani', 'tikka', 'masala', 'samosa', 'tandoori', 'indian'],
  thai: ['pad thai', 'curry', 'noodle', 'thai', 'spring roll'],
  steakhouse: ['steak', 'ribeye', 'sirloin', 'filet'],
  seafood: ['fish', 'shrimp', 'lobster', 'crab', 'oyster', 'seafood', 'salmon'],
  bbq: ['bbq', 'ribs', 'brisket', 'pulled', 'smoked', 'wings'],
  breakfast: ['breakfast', 'egg', 'pancake', 'waffle', 'omelette', 'bacon', 'brunch', 'toast'],
  // ── Auto ──
  'auto repair': ['oil', 'tire', 'brake', 'transmission', 'battery', 'alignment', 'engine', 'diagnostic', 'repair', 'service', 'muffler', 'exhaust', 'tune'],
  'oil change': ['oil', 'lube'],
  tires: ['tire', 'tyre', 'wheel'],
  brakes: ['brake', 'pad', 'rotor'],
  'car wash': ['wash', 'detail', 'wax', 'clean'],
  // ── Home / trades ──
  plumbing: ['drain', 'leak', 'pipe', 'faucet', 'toilet', 'water heater', 'plumb', 'clog', 'sink'],
  electrical: ['wiring', 'outlet', 'panel', 'light', 'breaker', 'electric', 'install'],
  hvac: ['ac', 'furnace', 'heat', 'cooling', 'duct', 'thermostat', 'hvac', 'air condition'],
  'house cleaning': ['clean', 'deep clean', 'room', 'home', 'maid'],
  cleaning: ['clean', 'deep clean', 'room', 'home', 'maid'],
  landscaping: ['lawn', 'tree', 'mow', 'garden', 'snow', 'yard', 'hedge', 'landscap'],
  'pest control': ['pest', 'rodent', 'insect', 'termite', 'bed bug', 'spray', 'exterminat'],
  roofing: ['roof', 'shingle', 'gutter'],
  painting: ['paint', 'coat', 'wall', 'room', 'interior', 'exterior'],
  moving: ['move', 'moving', 'pack', 'truck', 'storage'],
  // ── Beauty ──
  'hair salons': ['haircut', 'cut', 'color', 'colour', 'style', 'blowout', 'highlight', 'trim', 'wash'],
  barbers: ['haircut', 'cut', 'beard', 'shave', 'trim', 'fade', 'lineup'],
  'nail salons': ['manicure', 'pedicure', 'nail', 'gel', 'acrylic', 'polish'],
  spas: ['facial', 'massage', 'spa', 'treatment', 'wax', 'body'],
  massage: ['massage', 'deep tissue', 'swedish', 'relaxation', 'sports'],
  // ── Fitness / education / pet ──
  gyms: ['membership', 'pass', 'class', 'session', 'training', 'day pass'],
  'personal training': ['session', 'training', 'package', 'class'],
  tutoring: ['session', 'hour', 'lesson', 'tutor', 'package', 'class'],
  'music lessons': ['lesson', 'session', 'class'],
  'pet grooming': ['groom', 'bath', 'nail', 'wash', 'trim', 'de-shed'],
  vets: ['exam', 'vaccine', 'checkup', 'consultation', 'visit'],
};

function focusKeywords(category) {
  const c = (category || '').toLowerCase().trim();
  if (!c) return null;
  if (FOCUS_KEYWORDS[c]) return FOCUS_KEYWORDS[c];
  // Partial match (e.g. selected "coffee" vs key "coffee & tea")
  for (const k of Object.keys(FOCUS_KEYWORDS)) {
    if (c.includes(k) || k.includes(c)) return FOCUS_KEYWORDS[k];
  }
  // Fallback: significant words from the category name itself.
  const stop = new Set(['and', 'the', 'for', 'with', 'service', 'services', 'shop', 'store', 'local']);
  const words = c.split(/[^a-z]+/).filter(w => w.length > 2 && !stop.has(w));
  return words.length ? words : null;
}

function itemMatchesFocus(item, keywords) {
  if (!keywords || !keywords.length) return true;
  const hay = `${item.name || ''} ${item.section || ''}`.toLowerCase();
  return keywords.some(k => hay.includes(k));
}

// Normalize raw extracted items → deduped, priced, bucketed, capped.
function normalizeItems(raw) {
  const seen = new Set();
  const items = [];
  for (const it of Array.isArray(raw) ? raw : []) {
    if (!it || !it.name) continue;
    const name = String(it.name).trim().slice(0, 80);
    const dedupe = nameKeyOf(name);
    if (!dedupe || seen.has(dedupe)) continue;
    const price = parsePrice(it.price);
    if (price == null || price <= 0 || price > 10000) continue; // priced items only
    seen.add(dedupe);
    items.push({
      name,
      price,
      priceDisplay: typeof it.price === 'string' && it.price.trim().startsWith('$')
        ? it.price.trim().slice(0, 20)
        : `$${price.toFixed(2)}`,
      currency: it.currency && /^[A-Z]{3}$/.test(String(it.currency)) ? it.currency : 'CAD',
      section: it.section ? String(it.section).trim().slice(0, 40) : null,
      description: it.description ? String(it.description).trim().slice(0, 140) : null,
      bucket: bucketFor(price),
    });
    if (items.length >= 30) break;
  }
  return items;
}

function bucketCountsOf(items) {
  const counts = {};
  for (const it of items) if (it.bucket) counts[it.bucket] = (counts[it.bucket] || 0) + 1;
  return counts;
}

// ── scraping engines ─────────────────────────────────────────────────────────

// Firecrawl structured extract (preferred when the account has credits).
async function scrapeWithFirecrawl(website, name) {
  if (!firecrawlReady() || !website) return null;
  try {
    const r = await enrichServiceWebsite(website, name);
    const services = r?.extract?.services;
    if (!Array.isArray(services) || services.length === 0) return null;
    const items = normalizeItems(services.map(s => ({
      name: s.name, price: s.price, description: s.description,
    })));
    return items.length ? { items, source: 'firecrawl', citations: [website] } : null;
  } catch (e) {
    // 402 out-of-credits and everything else: soft-fail to Perplexity
    return null;
  }
}

// Perplexity live-web extraction (works today, no scraping infra needed).
async function scrapeWithPerplexity({ name, website, city, category, location }) {
  const key = getPplxKey();
  if (!key) return null;

  const where = location || city || '';
  const prompt =
    `Extract the CURRENT published menu or service price list for "${name}"` +
    `${where ? ` in ${where}` : ''}${website ? ` (official site: ${website})` : ''}. ` +
    `This is a ${category || 'local'} business — items can be dishes, drinks, haircuts, ` +
    `repair packages, class rates, room rates, or any priced service. ` +
    `Use the business's own website/menu pages (or its official menu on an ordering platform). ` +
    `BE COMPREHENSIVE: return 15–24 priced items when the business publishes that many, covering ` +
    `EVERY section of the menu/price list (mains, combos/deals, sides, drinks — or the service ` +
    `equivalents), across the full price range from cheapest to premium. ` +
    `Rules: only REAL items with a published price; "price" is the final price the customer pays ` +
    `(never a discount amount); include the menu section for each item; skip items with no clear ` +
    `price. Do not invent items or prices.\n\n` +
    `Respond with ONLY this JSON:\n` +
    `{"items":[{"name":"<item>","price":"<e.g. $9.99>","section":"<e.g. Classic Pizzas>",` +
    `"description":"<one short line>"}],"website":"<the business's official website url>"}`;

  try {
    const r = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getPplxModel(),
        temperature: 0.1,
        messages: [
          { role: 'system', content: 'You are a precise menu-extraction researcher with live web access. Return only real published prices from the business itself. Never fabricate. Output ONLY the requested JSON.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      console.error('menu-scraper perplexity_error', r.status, txt.slice(0, 200));
      return null;
    }
    const j = await r.json();
    const parsed = extractJson(j?.choices?.[0]?.message?.content);
    const items = normalizeItems(parsed?.items);
    if (!items.length) return null;
    return {
      items,
      source: 'perplexity',
      citations: Array.isArray(j.citations) ? j.citations.slice(0, 8) : [],
      website: (typeof parsed?.website === 'string' && /^https?:\/\//i.test(parsed.website))
        ? parsed.website : null,
    };
  } catch (e) {
    console.error('menu-scraper exception', e.message);
    return null;
  }
}

// ── main entry ───────────────────────────────────────────────────────────────

export function isConfigured() {
  return !!getPplxKey() || firecrawlReady();
}

/**
 * Get (scrape-or-cache) the menu for one provider; optionally budget-filtered.
 * @returns {{ ok, cached, name, website, items, matches, bucketCounts, source, scrapedAt }}
 */
export async function getProviderMenu({ placeId, name, website, city, category, location, budget, force = false } = {}) {
  if (!name) return { ok: false, error: 'name_required', items: [], matches: [] };
  const nameKey = nameKeyOf(name);
  const loc = location || city || '';

  // 1. Serve from Mongo cache when fresh
  let doc = null;
  try {
    doc = placeId ? await ServiceMenu.findOne({ placeId }) : null;
    if (!doc) doc = await ServiceMenu.findOne({ nameKey, location: loc });
  } catch (_) {}

  const age = doc ? Date.now() - new Date(doc.scrapedAt).getTime() : Infinity;
  // Rich menus (5+ items) are fresh for 7 days; empty/thin results retry daily.
  const freshFor = doc && (doc.itemCount || 0) >= 5 ? FRESH_MS : EMPTY_RETRY_MS;
  const isFresh = doc && age < freshFor;

  if (!isFresh || force) {
    // 2. Scrape: Firecrawl (funded) → Perplexity (live web).
    // Extraction depth varies run-to-run, so retry once when the pull is thin.
    let scraped =
      (await scrapeWithFirecrawl(website, name)) ||
      (await scrapeWithPerplexity({ name, website, city, category, location: loc }));
    if ((scraped?.items?.length || 0) < 5) {
      const retry = await scrapeWithPerplexity({ name, website, city, category, location: loc });
      if ((retry?.items?.length || 0) > (scraped?.items?.length || 0)) scraped = retry;
    }

    let items = scraped?.items || [];
    // Extraction depth varies run-to-run: never overwrite a richer cached menu
    // with a thinner pull.
    const prevItems = (doc?.items || []).map(it => (it.toObject ? it.toObject() : it));
    if (prevItems.length >= 5 && prevItems.length > items.length) {
      items = prevItems;
    }
    const update = {
      placeId: placeId || undefined,
      nameKey,
      name,
      website: scraped?.website || website || doc?.website || null,
      category: category || doc?.category || null,
      location: loc || doc?.location || null,
      items,
      bucketCounts: bucketCountsOf(items),
      itemCount: items.length,
      source: scraped?.source || doc?.source || null,
      citations: scraped?.citations || [],
      scrapedAt: new Date(),
    };
    try {
      doc = await ServiceMenu.findOneAndUpdate(
        placeId ? { placeId } : { nameKey, location: loc },
        { $set: update },
        { upsert: true, new: true }
      );
    } catch (e) {
      console.error('menu-scraper save_failed', e.message);
      doc = update; // Mongo down: still serve the scrape result
    }
  }

  const items = (doc?.items || []).map(it => (it.toObject ? it.toObject() : it));
  const budgetNum = parsePrice(budget);
  let matches = budgetNum != null
    ? items.filter(it => it.price != null && it.price <= budgetNum + 0.01)
    : items.slice();

  // Narrow matches to the selected service type (pizza search → pizzas, not fries).
  // If the focus filter finds relevant items we keep only those; if it finds none
  // (keywords too strict for this business), we fall back to the budget matches so
  // the strip is never wrongly empty.
  const keywords = focusKeywords(category);
  if (keywords) {
    const focused = matches.filter(it => itemMatchesFocus(it, keywords));
    if (focused.length > 0) matches = focused;
  }

  return {
    ok: true,
    cached: isFresh && !force,
    name: doc?.name || name,
    website: doc?.website || website || null,
    items,
    matches: matches.sort((a, b) => a.price - b.price),
    bucketCounts: doc?.bucketCounts instanceof Map
      ? Object.fromEntries(doc.bucketCounts)
      : (doc?.bucketCounts || bucketCountsOf(items)),
    source: doc?.source || null,
    scrapedAt: doc?.scrapedAt || new Date(),
  };
}
