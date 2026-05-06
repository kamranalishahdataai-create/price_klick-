// server/services/dealScraper.js
// Periodic deal scraper using SerpAPI Google Shopping. Populates Deal model.
import fetch from 'node-fetch';
import Deal from '../models/Deal.js';

// Categories we proactively scan for deep discounts
const DEAL_CATEGORIES = [
  { category: 'electronics', query: 'electronics deals on sale' },
  { category: 'appliances', query: 'kitchen appliances deals on sale' },
  { category: 'fashion', query: 'clothing sale clearance' },
  { category: 'home', query: 'home decor sale' },
  { category: 'beauty', query: 'beauty cosmetics sale' },
  { category: 'toys', query: 'toys deals sale' },
  { category: 'fitness', query: 'fitness equipment sale' },
  { category: 'tools', query: 'power tools sale' }
];

function parsePrice(s) {
  if (!s) return null;
  const m = String(s).replace(/,/g, '').match(/[\d.]+/);
  return m ? Number(m[0]) : null;
}

async function fetchShoppingResults(query) {
  const SERPAPI = process.env.SERPAPI_KEY;
  if (!SERPAPI) throw new Error('SERPAPI_KEY missing');
  const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(query)}&gl=ca&hl=en&api_key=${SERPAPI}`;
  const r = await fetch(url, { timeout: 20000 });
  if (!r.ok) throw new Error(`serpapi ${r.status}`);
  const j = await r.json();
  return j.shopping_results || [];
}

function normaliseDeal(item, category) {
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
    brand: item.source || item.merchant?.name || null,
    price,
    oldPrice,
    discountPercent,
    currency: 'CAD',
    url: item.product_link || item.link,
    source: item.source || 'google_shopping',
    thumbnail: item.thumbnail,
    rating: item.rating ? Number(item.rating) : null,
    reviews: item.reviews ? Number(item.reviews) : null,
    scrapedAt: new Date()
  };
}

export async function runDealScraperOnce({ minDiscount = 15 } = {}) {
  const stats = { scanned: 0, kept: 0, errors: [] };
  for (const { category, query } of DEAL_CATEGORIES) {
    try {
      const items = await fetchShoppingResults(query);
      stats.scanned += items.length;
      const deals = items
        .map(it => normaliseDeal(it, category))
        .filter(d => d.url && d.price && (d.discountPercent ? d.discountPercent >= minDiscount : true));
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
    await new Promise(r => setTimeout(r, 1200)); // be nice to SerpAPI
  }
  return stats;
}

export async function getTopDeals({ category, limit = 20 } = {}) {
  const q = category ? { category } : {};
  return Deal.find(q).sort({ discountPercent: -1, scrapedAt: -1 }).limit(limit).lean();
}
