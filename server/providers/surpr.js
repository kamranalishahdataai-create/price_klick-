// server/providers/surpr.js
// Generic live coupon adapter. If no provider configured, returns the WELCOME10 mock.

import fetch from 'node-fetch';

const BASE = process.env.COUPON_API_BASE;
const KEY  = process.env.COUPON_API_KEY;

export async function getBestCoupon(cartUrl) {
  if (!BASE || !KEY) {
    // Safe demo code when no provider is configured
    console.log("No coupon API configured, returning mock coupon");
    return { code: 'WELCOME10', discount: 10, type: 'PERCENT', source: 'mock' };
  }

  try {
    const host = new URL(cartUrl).hostname.replace(/^www\./, '');

    // Adapt the endpoint/params to your provider's docs:
    const u = new URL(`${BASE}/coupons/search`);
    u.searchParams.set('store', host);

    const r = await fetch(u.toString(), {
      headers: { Authorization: `Bearer ${KEY}` },
      timeout: 15000
    });

    if (!r.ok) throw new Error(`Coupon API failed: ${r.status}`);
    const data = await r.json();

    // Expecting array of { code, discount, type } — adapt if different
    const list = Array.isArray(data.coupons) ? data.coupons : data;
    if (!Array.isArray(list) || list.length === 0) return null;

    const best = list.sort((a, b) => {
      const av = a.type === 'PERCENT' ? a.discount : a.discount / 100;
      const bv = b.type === 'PERCENT' ? b.discount : b.discount / 100;
      return bv - av;
    })[0];

    return best || null;
  } catch (e) {
    // If provider call fails, fall back to mock coupon
    console.log("Coupon API call failed, falling back to mock:", e.message);
    return getMockCoupon();
  }
}

// Fallback mock coupon if API fails
function getMockCoupon() {
  return { code: 'WELCOME10', discount: 10, type: 'PERCENT', source: 'mock' };
}
