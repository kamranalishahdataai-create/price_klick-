// server/providers/couponfollow.js
// CouponFollow.com scraper. Returns sales ("deals"); CouponFollow hides the
// actual code values from its page, so it is not a source of coupon codes.

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Cache coupons in memory to reduce requests (cache for 30 minutes)
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Real coupon codes from CouponFollow for a store (code-free sales excluded, so
 * callers that try codes at checkout only ever get real ones).
 * @param {string} store - The store domain (e.g., 'amazon.ca', 'amazon.com')
 * @returns {Promise<Array>} - Array of coupon objects
 */
export async function fetchCouponsFromCouponFollow(store) {
  const offers = await fetchCouponFollowOffers(store);
  return offers.filter(o => o.hasCode);
}

/**
 * Codes plus code-free sales ("deals", code: null) for a store.
 * @returns {Promise<Array>}
 */
export async function fetchCouponFollowOffers(store) {
  // Normalize store name
  const storeDomain = normalizeStoreName(store);
  const cacheKey = `couponfollow:${storeDomain}`;
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[CouponFollow] Cache hit for ${storeDomain}`);
    return cached.coupons;
  }
  
  console.log(`[CouponFollow] Fetching coupons for ${storeDomain}`);
  
  try {
    const url = `https://couponfollow.com/site/${storeDomain}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
      },
      timeout: 15000,
    });
    
    if (!response.ok) {
      console.log(`[CouponFollow] HTTP ${response.status} for ${storeDomain}`);
      return [];
    }
    
    const html = await response.text();
    const coupons = parseCouponFollowHTML(html, storeDomain);
    
    // Cache the results
    cache.set(cacheKey, {
      coupons,
      timestamp: Date.now(),
    });
    
    console.log(`[CouponFollow] Found ${coupons.length} coupons for ${storeDomain}`);
    return coupons;
    
  } catch (error) {
    console.error(`[CouponFollow] Error fetching coupons for ${storeDomain}:`, error.message);
    return [];
  }
}

/**
 * Parse the CouponFollow HTML page to extract coupons
 * @param {string} html - The HTML content
 * @param {string} storeDomain - The store domain
 * @returns {Array} - Array of coupon objects
 */
function parseCouponFollowHTML(html, storeDomain) {
  const $ = cheerio.load(html);
  const coupons = [];
  
  // CouponFollow uses various structures for coupon cards
  // Look for coupon offer blocks
  $('[class*="offer"], [class*="coupon"], [data-offer], [data-coupon]').each((i, el) => {
    try {
      const $el = $(el);
      const text = $el.text();
      
      // Extract discount info
      const discountMatch = text.match(/(\d+)%\s*(?:off|OFF)/i) ||
                           text.match(/(\d+)\s*%/);
      const dollarMatch = text.match(/\$(\d+)\s*(?:off|OFF)/i);
      
      // Extract title/description
      const title = $el.find('h2, h3, h4, [class*="title"], [class*="desc"]').first().text().trim() ||
                   text.slice(0, 100).trim();
      
      // Check if it's a CODE type (not just a PROMO/DEAL)
      const isCode = /\bCODE\b/i.test(text) || $el.find('[class*="code"]').length > 0;
      
      if (discountMatch || dollarMatch || isCode) {
        let discount = 0;
        let type = 'PERCENT';
        
        if (discountMatch) {
          discount = parseInt(discountMatch[1], 10);
          type = 'PERCENT';
        } else if (dollarMatch) {
          discount = parseInt(dollarMatch[1], 10);
          type = 'FIXED';
        }
        
        // CouponFollow never shows code values in the page — they're revealed
        // only on its own site — so offers here are sales ("deals"), never codes.
        // Words pulled from titles (brand names like "SHEWIN", "BUY1") and
        // made-up codes ("AMAZON75" from "Up to 75% off") used to be returned
        // as codes and failed at checkout.
        const codeAvailable = $el.attr('data-has-code') === 'true' || $el.attr('data-offer-type') === 'coupon';
        
        if (discount > 0) {
          coupons.push({
            code: null,
            discount,
            type,
            description: title.replace(/s+/g, ' ').slice(0, 150),
            source: 'CouponFollow',
            store: storeDomain,
            url: `https://www.${storeDomain}`,
            isVerified: text.toLowerCase().includes('verified'),
            hasCode: false,
            isDeal: true,
            ...(codeAvailable ? { codeAvailable: true, revealUrl: `https://couponfollow.com/site/${storeDomain}` } : {}),
          });
        }
      }
    } catch (e) {
      // Skip malformed entries
    }
  });
  
  // (A whole-page text scan used to run here. It matched any word as a "code"
  // — the regex was case-insensitive — and padded results with SAVE<n>
  // placeholders, so it was removed.)

  // Remove duplicates and sort by discount (highest first)
  const uniqueCoupons = [];
  const seen = new Set();
  
  for (const coupon of coupons) {
    const key = `${coupon.code || coupon.description}-${coupon.discount}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueCoupons.push(coupon);
    }
  }
  
  return uniqueCoupons
    .sort((a, b) => b.discount - a.discount)
    .slice(0, 15); // Return top 15 coupons
}

/**
 * Normalize store name to domain format
 * @param {string} store - Store name or URL
 * @returns {string} - Normalized domain
 */
function normalizeStoreName(store) {
  // Remove protocol and www
  let domain = store.toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
  
  // Common store mappings
  const mappings = {
    'amazon': 'amazon.com',
    'ebay': 'ebay.com',
    'walmart': 'walmart.com',
    'target': 'target.com',
    'bestbuy': 'bestbuy.com',
    'homedepot': 'homedepot.com',
    'lowes': 'lowes.com',
    'macys': 'macys.com',
    'nordstrom': 'nordstrom.com',
    'kohls': 'kohls.com',
    'sephora': 'sephora.com',
    'ulta': 'ulta.com',
    'nike': 'nike.com',
    'adidas': 'adidas.com',
  };
  
  // Check if it's a simple name that needs mapping
  if (!domain.includes('.')) {
    domain = mappings[domain] || `${domain}.com`;
  }
  
  return domain;
}

/**
 * Get best coupon for a store
 * @param {string} store - Store name or domain
 * @returns {Promise<Object|null>} - Best coupon object or null
 */
export async function getBestCouponFromCouponFollow(store) {
  const coupons = await fetchCouponsFromCouponFollow(store);
  
  if (!coupons || coupons.length === 0) {
    return null;
  }
  
  // Return the coupon with highest discount
  return coupons[0];
}

/**
 * Clear the cache for a specific store or all stores
 * @param {string} [store] - Optional store name to clear, or clear all if not provided
 */
export function clearCache(store = null) {
  if (store) {
    const storeDomain = normalizeStoreName(store);
    cache.delete(`couponfollow:${storeDomain}`);
  } else {
    cache.clear();
  }
}

export default {
  fetchCouponsFromCouponFollow,
  getBestCouponFromCouponFollow,
  clearCache,
};
