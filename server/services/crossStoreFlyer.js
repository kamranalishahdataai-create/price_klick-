// server/services/crossStoreFlyer.js
// Cross-store grocery price comparison. Given a product name, queries
// SerpAPI Google Shopping scoped to Canadian grocery domains and returns
// prices grouped by store.
import fetch from 'node-fetch';

const GROCERY_DOMAINS = {
  'No Frills': 'nofrills.ca',
  'Loblaws': 'loblaws.ca',
  'Walmart': 'walmart.ca',
  'Real Canadian Superstore': 'realcanadiansuperstore.ca',
  'Metro': 'metro.ca',
  'FreshCo': 'freshco.com',
  'Sobeys': 'sobeys.com',
  'Food Basics': 'foodbasics.ca',
  'Save-On-Foods': 'saveonfoods.com',
  "Longo's": 'longos.com',
  'Farm Boy': 'farmboy.ca'
};

function parsePrice(s) {
  if (!s) return null;
  const m = String(s).replace(/,/g, '').match(/[\d.]+/);
  return m ? Number(m[0]) : null;
}

/** Compare a single product across grocery stores. */
export async function comparePriceAcrossStores(productName, { limit = 8 } = {}) {
  const SERPAPI = process.env.SERPAPI_KEY;
  if (!SERPAPI) throw new Error('SERPAPI_KEY missing');
  if (!productName) throw new Error('productName required');

  const q = `${productName} grocery price`;
  const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(q)}&gl=ca&hl=en&api_key=${SERPAPI}`;
  const r = await fetch(url, { timeout: 20000 });
  if (!r.ok) throw new Error(`serpapi ${r.status}`);
  const j = await r.json();
  const items = j.shopping_results || [];

  const matches = [];
  for (const it of items) {
    const link = (it.product_link || it.link || '').toLowerCase();
    const source = it.source || '';
    let storeName = null;
    for (const [name, domain] of Object.entries(GROCERY_DOMAINS)) {
      if (link.includes(domain) || source.toLowerCase().includes(name.toLowerCase())) {
        storeName = name;
        break;
      }
    }
    if (!storeName) continue;
    const price = parsePrice(it.price || it.extracted_price);
    if (!price) continue;
    matches.push({
      store: storeName,
      title: it.title,
      price,
      currency: 'CAD',
      url: it.product_link || it.link,
      thumbnail: it.thumbnail
    });
  }

  // Keep best (lowest) price per store
  const byStore = {};
  for (const m of matches) {
    if (!byStore[m.store] || byStore[m.store].price > m.price) byStore[m.store] = m;
  }
  const ranked = Object.values(byStore).sort((a, b) => a.price - b.price).slice(0, limit);

  if (ranked.length === 0) return { ok: false, query: productName, matches: [] };
  const cheapest = ranked[0];
  const most = ranked[ranked.length - 1];
  return {
    ok: true,
    query: productName,
    matches: ranked,
    cheapest,
    savingsVsHighest: most && cheapest ? Math.round((most.price - cheapest.price) * 100) / 100 : 0
  };
}
