// server/providers/surpr.js
// Generic live coupon adapter. Without a configured provider it uses the best
// real code from CouponFollow. It never returns a made-up fallback code — a
// code that fails at checkout is worse than showing no code.

import fetch from 'node-fetch';
import { getBestCouponFromCouponFollow } from './couponfollow.js';

const BASE = process.env.COUPON_API_BASE;
const KEY  = process.env.COUPON_API_KEY;

export async function getBestCoupon(cartUrl) {
  if (!BASE || !KEY) {
    try {
      return await getBestCouponFromCouponFollow(new URL(cartUrl).hostname.replace(/^www\./, ''));
    } catch {
      return null;
    }
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
    console.log("Coupon API call failed:", e.message);
    return null;
  }
}
