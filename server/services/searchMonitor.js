// Search Monitor & Recommendation System
// Tracks user search patterns and provides personalized recommendations

import { db } from '../db.js';

// In-memory search frequency tracker (persisted to db periodically)
const searchFrequency = new Map(); // key: brand/product -> { count, users: Set, lastSearched }
const userSearchHistory = new Map(); // key: userId -> [{ query, brand, timestamp }]
const BRAND_ALERT_THRESHOLD = 10; // Alert brand when this many unique users search for it
const TRENDING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Record a user search event
 */
export function recordSearch({ userId, query, brand, product, url, sessionId }) {
  const now = Date.now();
  const normalizedBrand = (brand || extractBrand(query, url)).toLowerCase().trim();
  const normalizedQuery = (query || '').toLowerCase().trim();

  // Update search frequency
  if (normalizedBrand) {
    if (!searchFrequency.has(normalizedBrand)) {
      searchFrequency.set(normalizedBrand, {
        brand: normalizedBrand,
        count: 0,
        users: new Set(),
        queries: [],
        lastSearched: now,
        firstSearched: now,
        alertSent: false
      });
    }
    const entry = searchFrequency.get(normalizedBrand);
    entry.count++;
    entry.lastSearched = now;
    if (userId) entry.users.add(userId);
    if (normalizedQuery && !entry.queries.includes(normalizedQuery)) {
      entry.queries.push(normalizedQuery);
      if (entry.queries.length > 50) entry.queries.shift();
    }
  }

  // Update user search history
  const uid = userId || sessionId || 'anonymous';
  if (!userSearchHistory.has(uid)) {
    userSearchHistory.set(uid, []);
  }
  const history = userSearchHistory.get(uid);
  history.push({
    query: normalizedQuery,
    brand: normalizedBrand,
    product: product || '',
    url: url || '',
    timestamp: now
  });
  // Keep last 200 searches per user
  if (history.length > 200) history.splice(0, history.length - 200);

  return {
    brand: normalizedBrand,
    totalSearches: searchFrequency.get(normalizedBrand)?.count || 1,
    uniqueUsers: searchFrequency.get(normalizedBrand)?.users.size || 1
  };
}

/**
 * Extract brand name from query/URL
 */
function extractBrand(query, url) {
  if (url) {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      const parts = hostname.split('.');
      return parts[0] || '';
    } catch (e) {}
  }
  // Try to extract brand from query
  const words = (query || '').split(/\s+/);
  return words[0] || '';
}

/**
 * Get personalized recommendations for a user
 */
export function getRecommendations(userId, limit = 10) {
  const uid = userId || 'anonymous';
  const history = userSearchHistory.get(uid) || [];
  const now = Date.now();

  // Analyze user's search patterns
  const brandCounts = {};
  const productCounts = {};
  const recentBrands = new Set();

  history.forEach(entry => {
    if (entry.brand) {
      brandCounts[entry.brand] = (brandCounts[entry.brand] || 0) + 1;
      if (now - entry.timestamp < TRENDING_WINDOW_MS) {
        recentBrands.add(entry.brand);
      }
    }
    if (entry.product) {
      productCounts[entry.product] = (productCounts[entry.product] || 0) + 1;
    }
  });

  // Sort brands by frequency
  const topBrands = Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([brand, count]) => brand);

  // Build recommendations
  const recommendations = [];

  // 1. Trending brands the user has searched for
  for (const brand of topBrands) {
    const freq = searchFrequency.get(brand);
    if (freq && freq.count > 3) {
      recommendations.push({
        type: 'trending_brand',
        brand,
        reason: `You've searched ${brandCounts[brand]} times. ${freq.users.size} users are looking at this brand.`,
        priority: brandCounts[brand] * 2 + freq.count,
        searches: brandCounts[brand],
        totalUsers: freq.users.size
      });
    }
  }

  // 2. Hot brands that others are searching (collaborative filtering)
  const trendingBrands = getTrendingBrands(5);
  for (const trending of trendingBrands) {
    if (!topBrands.includes(trending.brand)) {
      recommendations.push({
        type: 'hot_trending',
        brand: trending.brand,
        reason: `${trending.uniqueUsers} users searching for this brand right now!`,
        priority: trending.totalSearches,
        searches: trending.totalSearches,
        totalUsers: trending.uniqueUsers
      });
    }
  }

  // 3. Related brands (users who searched X also searched Y)
  const relatedBrands = getRelatedBrands(topBrands, uid);
  for (const related of relatedBrands) {
    recommendations.push({
      type: 'related',
      brand: related.brand,
      reason: `Users who search ${related.sourceBrand} also look at ${related.brand}`,
      priority: related.score,
      searches: related.score,
      totalUsers: related.users
    });
  }

  // Sort by priority and return top N
  return recommendations
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}

/**
 * Get trending brands across all users
 */
export function getTrendingBrands(limit = 10) {
  const now = Date.now();
  const trending = [];

  for (const [brand, data] of searchFrequency) {
    // Only include brands searched recently
    if (now - data.lastSearched < TRENDING_WINDOW_MS) {
      trending.push({
        brand: data.brand,
        totalSearches: data.count,
        uniqueUsers: data.users.size,
        lastSearched: data.lastSearched,
        queries: data.queries.slice(-5),
        score: data.count * Math.log2(data.users.size + 1)
      });
    }
  }

  return trending
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Get related brands based on co-search patterns
 */
function getRelatedBrands(userBrands, excludeUserId) {
  const related = new Map();

  for (const [uid, history] of userSearchHistory) {
    if (uid === excludeUserId) continue;

    const userBrandsSet = new Set(history.map(h => h.brand));
    const hasOverlap = userBrands.some(b => userBrandsSet.has(b));

    if (hasOverlap) {
      for (const entry of history) {
        if (entry.brand && !userBrands.includes(entry.brand)) {
          if (!related.has(entry.brand)) {
            related.set(entry.brand, { brand: entry.brand, score: 0, users: 0, sourceBrand: '' });
          }
          const r = related.get(entry.brand);
          r.score++;
          r.users++;
          // Find which of user's brands caused overlap
          const overlap = userBrands.find(b => userBrandsSet.has(b));
          if (overlap) r.sourceBrand = overlap;
        }
      }
    }
  }

  return Array.from(related.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/**
 * Get user search history
 */
export function getUserSearchHistory(userId, limit = 50) {
  const history = userSearchHistory.get(userId) || [];
  return history.slice(-limit).reverse();
}

/**
 * Get search stats for a specific brand
 */
export function getBrandSearchStats(brand) {
  const normalizedBrand = brand.toLowerCase().trim();
  const freq = searchFrequency.get(normalizedBrand);
  
  if (!freq) {
    return { brand: normalizedBrand, totalSearches: 0, uniqueUsers: 0, trending: false };
  }

  const now = Date.now();
  return {
    brand: freq.brand,
    totalSearches: freq.count,
    uniqueUsers: freq.users.size,
    lastSearched: freq.lastSearched,
    trending: now - freq.lastSearched < TRENDING_WINDOW_MS && freq.count > 5,
    queries: freq.queries.slice(-10),
    alertThresholdMet: freq.users.size >= BRAND_ALERT_THRESHOLD
  };
}

/**
 * Check if brand alert threshold is met
 */
export function checkBrandAlertThreshold(brand) {
  const normalizedBrand = brand.toLowerCase().trim();
  const freq = searchFrequency.get(normalizedBrand);
  
  if (!freq) return { shouldAlert: false };

  const shouldAlert = freq.users.size >= BRAND_ALERT_THRESHOLD && !freq.alertSent;
  
  if (shouldAlert) {
    freq.alertSent = true;
  }

  return {
    shouldAlert,
    brand: freq.brand,
    uniqueUsers: freq.users.size,
    totalSearches: freq.count,
    topQueries: freq.queries.slice(-5),
    threshold: BRAND_ALERT_THRESHOLD
  };
}

/**
 * Get all brands that have exceeded alert threshold
 */
export function getBrandsExceedingThreshold() {
  const alerts = [];
  
  for (const [brand, data] of searchFrequency) {
    if (data.users.size >= BRAND_ALERT_THRESHOLD) {
      alerts.push({
        brand: data.brand,
        uniqueUsers: data.users.size,
        totalSearches: data.count,
        lastSearched: data.lastSearched,
        topQueries: data.queries.slice(-5),
        alertSent: data.alertSent
      });
    }
  }

  return alerts.sort((a, b) => b.uniqueUsers - a.uniqueUsers);
}

/**
 * Reset alert sent flag for a brand (so it can alert again)
 */
export function resetBrandAlert(brand) {
  const normalizedBrand = brand.toLowerCase().trim();
  const freq = searchFrequency.get(normalizedBrand);
  if (freq) {
    freq.alertSent = false;
    return true;
  }
  return false;
}
