// Live local-deals finder.
// Uses Perplexity's live web access to surface REAL, current value meals /
// specials / promotions priced at or below the user's budget for specific local
// businesses in the search results. Powers the "this place also has a deal under
// $X" feature on the Services page. Results are cached in-memory (10 min) so a
// budget search doesn't re-hit the API on every re-render.

const getPplxKey = () => process.env.PERPLEXITY_API_KEY;
const getPplxModel = () =>
  process.env.LOCAL_DEALS_PPLX_MODEL || process.env.SMART_COMPARE_PPLX_MODEL || 'sonar';

const CACHE = new Map(); // key -> { at, data }
const TTL_MS = 10 * 60 * 1000;

// Tolerant JSON extraction — strips ```json fences / stray prose around the object.
function extractJson(content) {
  if (!content) return null;
  let s = String(content).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(s); } catch {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch {} }
  return null;
}

// Parse a price string like "$6.99" / "6.99" / "2 for $5" → a comparable number.
function parsePrice(str) {
  if (str == null) return null;
  const m = String(str).replace(/,/g, '').match(/\$?\s*([\d]+(?:\.[\d]{1,2})?)/);
  return m ? parseFloat(m[1]) : null;
}

export function isConfigured() {
  return !!getPplxKey();
}

/**
 * Find real current deals at/below `budget` for the given businesses.
 * @param {{ providers: Array<{name:string, city?:string, address?:string}>, budget:number|string, category?:string, location?:string, limit?:number }} opts
 * @returns {{ ok:boolean, deals: Array<{name,title,price,priceValue,url,description}>, citations?:string[] }}
 */
export async function findLocalDeals({ providers = [], budget, category, location, limit = 8 } = {}) {
  const key = getPplxKey();
  if (!key) return { ok: false, error: 'perplexity_not_configured', deals: [] };

  const budgetNum = parsePrice(budget);
  const named = providers.filter(p => p && p.name).slice(0, limit);
  if (!budgetNum || named.length === 0) return { ok: true, deals: [] };

  const cacheKey = JSON.stringify({
    names: named.map(p => p.name.toLowerCase()),
    budget: budgetNum, category: category || '', location: location || '',
  });
  const hit = CACHE.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const list = named
    .map((p, i) => `${i + 1}. ${p.name}${(p.city || p.address) ? ` — ${p.city || p.address}` : ''}`)
    .join('\n');

  const prompt =
    `You are a local-deals researcher with live web access. Find CURRENT, REAL deals, specials, ` +
    `promotions, value offers, or discounted packages where the customer's FINAL PRICE is at or ` +
    `below $${budgetNum}, offered by these ${category || 'local'} businesses` +
    `${location ? ` in ${location}` : ''}. This can be any service or product the business sells ` +
    `(a value meal, a haircut special, an oil-change package, an intro class, a first-visit rate, etc.). ` +
    `IMPORTANT: "price" must be what the customer actually PAYS, not a discount amount — ` +
    `"$15 off" is NOT a $15 price; skip offers where you can't determine the final price ≤ $${budgetNum}. ` +
    `Only include a business where you find a genuine current offer; skip the rest. ` +
    `Match each deal to the EXACT business name from the list. Do not invent deals.\n\n` +
    `Businesses:\n${list}\n\n` +
    `Respond with ONLY this JSON: {"deals":[{"name":"<exact business name from the list>",` +
    `"title":"<short deal name, e.g. Everyday Value Burrito>","price":"<final price the customer pays, e.g. $6.99>",` +
    `"url":"<source url>","description":"<one short line>"}]}`;

  try {
    const r = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getPplxModel(),
        temperature: 0.1,
        messages: [
          { role: 'system', content: 'You are a precise local-deals researcher. Return only real, current, verifiable deals with a source URL. Never fabricate. Output ONLY the requested JSON.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      console.error('local-deals perplexity_error', r.status, txt.slice(0, 200));
      return { ok: false, error: `perplexity_${r.status}`, deals: [] };
    }

    const j = await r.json();
    const parsed = extractJson(j?.choices?.[0]?.message?.content);
    let deals = (parsed && Array.isArray(parsed.deals)) ? parsed.deals : [];

    deals = deals
      .filter(d => d && d.name && (d.title || d.price))
      .map(d => {
        const priceValue = parsePrice(d.price);
        return {
          name: String(d.name).trim(),
          title: d.title ? String(d.title).trim().slice(0, 80) : '',
          price: d.price ? String(d.price).trim() : '',
          priceValue,
          url: (typeof d.url === 'string' && /^https?:\/\//i.test(d.url)) ? d.url : null,
          description: d.description ? String(d.description).trim().slice(0, 140) : '',
        };
      })
      // Keep only deals that are actually at/under budget (when a price is parseable)
      .filter(d => d.priceValue == null || d.priceValue <= budgetNum + 0.01);

    const data = { ok: true, deals, citations: Array.isArray(j.citations) ? j.citations : [] };
    CACHE.set(cacheKey, { at: Date.now(), data });
    return data;
  } catch (e) {
    console.error('local-deals exception', e.message);
    return { ok: false, error: e.message, deals: [] };
  }
}
