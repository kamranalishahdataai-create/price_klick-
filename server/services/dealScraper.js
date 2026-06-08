// server/services/dealScraper.js
// Proactive deal scraper: Firecrawl (primary) + SerpAPI fallback.
// Runs on cron + can be triggered on-demand per category.

import fetch from 'node-fetch';
import Deal from '../models/Deal.js';
import { scrapeDealsPage, isConfigured as firecrawlReady } from './firecrawl.js';

// ── Deal sources grouped by category ─────────────────────
// Organised so we can target individual groups for on-demand scrapes.
export const DEAL_SOURCE_GROUPS = {
  electronics: [
    { url: 'https://www.bestbuy.ca/en-ca/brand/deals',                                        store: 'Best Buy CA'  },
    { url: 'https://www.bestbuy.com/site/electronics/top-deals/pcmcat1563299784494.c',        store: 'Best Buy US'  },
    { url: 'https://www.newegg.ca/todays-deals',                                              store: 'Newegg CA'    },
    { url: 'https://www.staples.ca/pages/sales-and-deals',                                    store: 'Staples CA'   },
  ],
  general: [
    { url: 'https://www.amazon.ca/gp/goldbox',                                                store: 'Amazon CA'    },
    { url: 'https://www.amazon.com/deals',                                                    store: 'Amazon US'    },
    { url: 'https://www.walmart.ca/en/deals',                                                 store: 'Walmart CA'   },
    { url: 'https://www.costco.ca/hot-buys.html',                                             store: 'Costco CA'    },
    { url: 'https://www.target.com/c/clearance/-/N-5xsz8',                                   store: 'Target'       },
  ],
  tools: [
    { url: 'https://www.canadiantire.ca/en/deals.html',                                       store: 'Canadian Tire'},
  ],
  home: [
    { url: 'https://www.homedepot.ca/en/home/specials/top-deals.html',                        store: 'Home Depot CA'},
    { url: 'https://www.lowes.ca/specials',                                                   store: 'Lowes CA'     },
    { url: 'https://www.wayfair.ca/daily-sales',                                              store: 'Wayfair CA'   },
  ],
  fashion: [
    { url: 'https://www2.hm.com/en_ca/sale/view-all.html',                                   store: 'H&M CA'       },
    { url: 'https://www.zara.com/ca/en/sale-l2853.html',                                     store: 'Zara CA'      },
    { url: 'https://www.asos.com/ca/sale/',                                                   store: 'ASOS CA'      },
    { url: 'https://www.forever21.com/on/demandware.store/Sites-forever21-Site/en_CA/Search-Show?q=sale', store: 'Forever 21' },
  ],
  beauty: [
    { url: 'https://www.sephora.com/sale',                                                    store: 'Sephora'      },
    { url: 'https://www1.shoppersdrugmart.ca/en/beauty/beauty-boutique/beauty-deals',         store: 'Shoppers'     },
    { url: 'https://www.thebodyshop.com/en-ca/sale',                                          store: 'Body Shop CA' },
  ],
  fitness: [
    { url: 'https://www.sportchek.ca/en/sale',                                                store: 'Sport Chek'   },
    { url: 'https://www.nike.com/ca/w/sale-3yaep',                                            store: 'Nike CA'      },
    { url: 'https://www.adidas.ca/en/sale',                                                   store: 'Adidas CA'    },
    { url: 'https://www.mec.ca/en/products/sale',                                             store: 'MEC'          },
  ],
  toys: [
    { url: 'https://www.toysrus.ca/en/specials',                                              store: 'Toys R Us CA' },
  ],
  appliances: [
    { url: 'https://www.thebrick.com/collections/appliances-on-sale',                        store: 'The Brick'    },
    { url: 'https://www.leons.ca/collections/weekly-specials',                                store: 'Leons'        },
  ],
  food: [
    { url: 'https://www.groupon.ca/local/toronto-on/restaurants',                             store: 'Groupon CA'   },
    { url: 'https://www.ubereats.com/ca/deals',                                               store: 'Uber Eats CA' },
  ],
};

// All sources flattened (for full scrape runs)
const ALL_SOURCES = Object.entries(DEAL_SOURCE_GROUPS).flatMap(
  ([category, sources]) => sources.map(s => ({ ...s, category }))
);

// ── Legacy SerpAPI categories (fallback) ──────────────────
const SERPAPI_CATEGORIES = [
  { category: 'electronics', query: 'electronics deals on sale' },
  { category: 'appliances',  query: 'kitchen appliances deals on sale' },
  { category: 'fashion',     query: 'clothing sale clearance' },
  { category: 'home',        query: 'home decor sale' },
  { category: 'beauty',      query: 'beauty cosmetics sale' },
  { category: 'toys',        query: 'toys deals sale' },
  { category: 'fitness',     query: 'fitness equipment sale' },
  { category: 'tools',       query: 'power tools sale' },
];

function parsePrice(s) {
  if (!s) return null;
  const m = String(s).replace(/,/g, '').match(/[\d.]+/);
  return m ? Number(m[0]) : null;
}

function normaliseDeal(item, category, source) {
  const price = parsePrice(item.price || item.extracted_price);
  const oldPrice = parsePrice(item.old_price || item.original_price);
  let discountPercent = null;
  if (oldPrice && price && oldPrice > price) {
    discountPercent = Math.round(((oldPrice - price) / oldPrice) * 100);
  } else if (typeof item.tag === 'string') {
    const m = item.tag.match(/(\d+)\s*%\s*off/i);
    if (m) discountPercent = Number(m[1]);
  }
  return {
    category,
    title: (item.title || '').slice(0, 280),
    brand: source || item.source || item.merchant?.name || null,
    price,
    oldPrice,
    discountPercent,
    currency: 'CAD',
    url: item.product_link || item.link,
    source: source || item.source || 'google_shopping',
    thumbnail: item.thumbnail,
    rating: item.rating ? Number(item.rating) : null,
    reviews: item.reviews ? Number(item.reviews) : null,
    scrapedAt: new Date()
  };
}

// ── Core scrape worker (Firecrawl) ────────────────────────
async function scrapeSource({ url, store, category }, minDiscount = 5) {
  const kept = [];
  const errors = [];
  try {
    const result = await scrapeDealsPage(url, store, category);
    const deals = result?.deals ?? [];
    for (const d of deals) {
      if (!d.title) continue;
      const price = d.currentPrice ?? null;
      const oldPrice = d.originalPrice ?? null;
      let discountPct = d.discountPercent ?? null;
      if (!discountPct && price && oldPrice && oldPrice > price) {
        discountPct = Math.round(((oldPrice - price) / oldPrice) * 100);
      }
      if (discountPct && discountPct < minDiscount) continue;
      const doc = {
        category,
        title: String(d.title).slice(0, 280),
        brand: store,
        price,
        oldPrice,
        discountPercent: discountPct,
        currency: 'CAD',
        url: d.productUrl || url,
        source: store,
        thumbnail: d.imageUrl || null,
        scrapedAt: new Date()
      };
      try {
        await Deal.updateOne({ url: doc.url, title: doc.title }, { $set: doc }, { upsert: true });
        kept.push(doc.title);
      } catch (e) {
        if (e?.code !== 11000) errors.push(e.message);
      }
    }
  } catch (e) {
    errors.push(`${store}: ${e.message}`);
  }
  return { kept: kept.length, errors };
}

// ── Scrape a specific category on-demand ──────────────────
export async function scrapeByCategory(category, { minDiscount = 5, force = false } = {}) {
  if (!firecrawlReady()) return { ok: false, error: 'firecrawl_not_configured' };

  // Skip if we scraped this category recently (within 2 hours) unless forced
  if (!force) {
    const latest = await Deal.findOne({ category }).sort({ scrapedAt: -1 }).lean();
    const ageMs = latest ? Date.now() - new Date(latest.scrapedAt).getTime() : Infinity;
    if (ageMs < 2 * 3600 * 1000) {
      return { ok: true, skipped: true, reason: 'recent_data', ageHours: (ageMs / 3600000).toFixed(1) };
    }
  }

  const sources = DEAL_SOURCE_GROUPS[category] || [];
  if (sources.length === 0) return { ok: false, error: 'unknown_category' };

  let totalKept = 0;
  const allErrors = [];
  for (const src of sources) {
    const r = await scrapeSource({ ...src, category }, minDiscount);
    totalKept += r.kept;
    allErrors.push(...r.errors);
    await new Promise(res => setTimeout(res, 1500));
  }
  return { ok: true, category, kept: totalKept, errors: allErrors, source: 'firecrawl' };
}

// ── Full scrape run (all sources) ─────────────────────────
async function runFirecrawlScrape({ minDiscount = 5, maxSources = ALL_SOURCES.length } = {}) {
  const stats = { scanned: 0, kept: 0, errors: [], source: 'firecrawl' };
  const sources = ALL_SOURCES.slice(0, maxSources);

  for (const src of sources) {
    const r = await scrapeSource(src, minDiscount);
    stats.kept += r.kept;
    stats.errors.push(...r.errors);
    await new Promise(res => setTimeout(res, 1800));
  }
  stats.scanned = sources.length;
  return stats;
}

// ── SerpAPI fallback ──────────────────────────────────────
async function runSerpApiScrape({ minDiscount = 15 } = {}) {
  const SERPAPI = process.env.SERPAPI_KEY;
  if (!SERPAPI) return { ok: false, error: 'SERPAPI_KEY missing' };

  const stats = { scanned: 0, kept: 0, errors: [], source: 'serpapi' };
  for (const { category, query } of SERPAPI_CATEGORIES) {
    try {
      const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(query)}&gl=ca&hl=en&api_key=${SERPAPI}`;
      const r = await fetch(url, { timeout: 20000 });
      if (!r.ok) throw new Error(`serpapi ${r.status}`);
      const j = await r.json();
      const items = (j.shopping_results || []);
      stats.scanned += items.length;
      const deals = items
        .map(it => normaliseDeal(it, category, null))
        .filter(d => d.url && d.price && (!d.discountPercent || d.discountPercent >= minDiscount));
      for (const d of deals) {
        try {
          await Deal.updateOne({ url: d.url }, { $set: d }, { upsert: true });
          stats.kept++;
        } catch (e) {
          if (e?.code !== 11000) stats.errors.push(e.message);
        }
      }
    } catch (e) {
      stats.errors.push(`${category}: ${e.message}`);
    }
    await new Promise(res => setTimeout(res, 1200));
  }
  return stats;
}

// ── Staggered scrape (rotate source groups by hour) ───────
// Hour 0 → electronics+general, hour 2 → home+tools, hour 4 → fashion+beauty, etc.
export async function runStaggeredScrape() {
  if (!firecrawlReady()) return runSerpApiScrape();

  const hour = new Date().getUTCHours();
  const slot = Math.floor(hour / 2) % 5;

  const groupSets = [
    ['electronics', 'general'],
    ['home', 'tools', 'appliances'],
    ['fashion', 'beauty'],
    ['fitness', 'toys'],
    ['food', 'general'],
  ];

  const targetCategories = groupSets[slot] || groupSets[0];
  const sources = ALL_SOURCES.filter(s => targetCategories.includes(s.category));

  const stats = { scanned: sources.length, kept: 0, errors: [], source: 'firecrawl', categories: targetCategories };
  for (const src of sources) {
    const r = await scrapeSource(src, 5);
    stats.kept += r.kept;
    stats.errors.push(...r.errors);
    await new Promise(res => setTimeout(res, 1500));
  }
  return stats;
}

// ── Main public entry point ───────────────────────────────
export async function runDealScraperOnce({ minDiscount = 5 } = {}) {
  if (firecrawlReady()) return runFirecrawlScrape({ minDiscount });
  return runSerpApiScrape({ minDiscount });
}

// ── Cleanup: remove deals older than 7 days ───────────────
export async function cleanOldDeals() {
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  try {
    const r = await Deal.deleteMany({ scrapedAt: { $lt: cutoff } });
    return { ok: true, deleted: r.deletedCount };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── Query helpers ─────────────────────────────────────────
export async function getTopDeals({ category, limit = 20 } = {}) {
  const q = category ? { category } : {};
  return Deal.find(q).sort({ discountPercent: -1, scrapedAt: -1 }).limit(limit).lean();
}

export async function getDealsByCategories(categories, { limit = 12, minDiscount = 5 } = {}) {
  return Deal.find({
    category: { $in: categories },
    discountPercent: { $gte: minDiscount },
    scrapedAt: { $gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) }
  })
    .sort({ discountPercent: -1, scrapedAt: -1 })
    .limit(limit)
    .lean();
}
