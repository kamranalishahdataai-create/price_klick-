// server/providers/compare.js
// Live comparison via SerpAPI Google Shopping results.
// Falls back gracefully if no key or no results.

import fetch from 'node-fetch';

const SERP_KEY = process.env.SERPAPI_KEY;

/**
 * normalize price string to number (best-effort)
 */
function parsePrice(str) {
  if (!str) return null;
  // remove currency symbols & commas, keep dot
  const cleaned = String(str).replace(/[^\d.,]/g, '').replace(/,/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build a price item shape
 */
function item(source, title, url, price) {
  return { source, title, url, price };
}

/**
 * Compare prices across the web (Google Shopping via SerpAPI).
 * Optional: if the user typed a Daraz query, you can bias results.
 */
export async function comparePrices(query) {
  // If no API key, return empty — content script will show “No results”.
  if (!SERP_KEY) return [];

  // Bias to Daraz if the phrase includes “daraz” (optional)
  let q = query;
  if (!/daraz/i.test(q)) {
    // You can uncomment to bias by default:
    // q = `site:daraz.pk ${q}`;
  }

  const params = new URLSearchParams({
    engine: 'google_shopping',
    q,
    gl: 'us', // or 'pk' for Pakistan region
    hl: 'en',
    api_key: SERP_KEY
  });

  const url = `https://serpapi.com/search.json?${params.toString()}`;
  const r = await fetch(url, { timeout: 15000 });
  if (!r.ok) throw new Error(`SerpAPI failed: ${r.status}`);
  const data = await r.json();

  const results = [];
  const products = data.shopping_results || [];
  for (const p of products) {
    // SerpAPI fields vary, we do best-effort
    const title = p.title || p.product_title || '';
    const store = p.source || p.shop_name || p.store || 'store';
    const link = p.link || p.product_link || p.shopping_url || p.serpapi_link || '#';
    const priceStr = p.price || p.extracted_price || p.price_str || null;
    const price =
      typeof p.extracted_price === 'number' ? p.extracted_price : parsePrice(priceStr);

    results.push(item(store, title, link, price));
  }

  // sort ascending by price, unknowns at the end
  results.sort((a, b) => {
    const ap = a.price ?? Number.POSITIVE_INFINITY;
    const bp = b.price ?? Number.POSITIVE_INFINITY;
    return ap - bp;
  });

  return results;
}
