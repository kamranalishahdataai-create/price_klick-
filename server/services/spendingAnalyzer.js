// server/services/spendingAnalyzer.js
// Fast (no-AI) spending pattern engine.
// Reads UserActivity from MongoDB → computes category frequencies →
// determines spending profile → matches live deals from DB.

import UserActivity from '../models/UserActivity.js';
import { getDealsByCategories } from './dealScraper.js';

// ── Search-term → internal category mapping ───────────────
const TERM_TO_CAT = [
  // Home services
  [/plumb/i,              'home'],
  [/electric(ian)?/i,     'home'],
  [/hvac|heating|cooling/i,'home'],
  [/clean(er|ing)?|maid/i,'home'],
  [/landscap|lawn|garden/i,'home'],
  [/pest|exterminator/i,  'home'],
  [/roof(ing)?/i,         'home'],
  [/paint(er|ing)?/i,     'home'],
  [/mov(er|ing)/i,        'home'],
  [/handyman|repair/i,    'home'],
  [/floor(ing)?/i,        'home'],
  [/remodel|renovate|contractor/i,'home'],
  // Auto
  [/mechanic|auto.?repair|car.?repair/i,'auto'],
  [/car.?wash|detailing/i,'auto'],
  [/tow(ing)?/i,          'auto'],
  [/oil.?change/i,        'auto'],
  [/tir(e|es)/i,          'auto'],
  [/body.?shop|collision/i,'auto'],
  // Food & dining
  [/restaurant|diner|eatery/i,'food'],
  [/cafe|coffee|tea|latte/i,'food'],
  [/bakery|pastry/i,      'food'],
  [/bar|pub|nightlife/i,  'food'],
  [/food.?truck/i,        'food'],
  [/pizza/i,              'food'],
  [/sushi/i,              'food'],
  [/burger/i,             'food'],
  [/catering/i,           'food'],
  // Health & wellness
  [/doctor|physician|clinic/i,'health'],
  [/dentist|dental/i,     'health'],
  [/therapist|counseling|psychol/i,'health'],
  [/gym|fitness|crossfit|workout/i,'fitness'],
  [/massage/i,            'health'],
  [/optom|eye.?doctor/i,  'health'],
  [/chiropract/i,         'health'],
  [/pharmacy/i,           'health'],
  [/acupunct/i,           'health'],
  // Beauty & personal care
  [/hair.?salon|hairdress/i,'beauty'],
  [/barber/i,             'beauty'],
  [/nail.?salon|manicure|pedicure/i,'beauty'],
  [/spa\b/i,              'beauty'],
  [/makeup|cosmetic/i,    'beauty'],
  [/wax(ing)?/i,          'beauty'],
  [/eyelash|lash.?ext/i,  'beauty'],
  // Education
  [/tutor(ing)?/i,        'education'],
  [/music.?lesson|piano|guitar|violin/i,'education'],
  [/language.?class|esl|french|spanish/i,'education'],
  [/driving.?school/i,    'education'],
  [/dance.?class|ballet/i,'education'],
  [/personal.?train/i,    'fitness'],
  [/coding|programming.?class/i,'education'],
  // Professional
  [/accountant|cpa|tax.?prep/i,'professional'],
  [/lawyer|attorney|legal/i,'professional'],
  [/it.?support|tech.?support|computer.?repair/i,'electronics'],
  [/photo(grapher)?/i,    'professional'],
  [/marketing|seo/i,      'professional'],
  [/real.?estate|realtor/i,'professional'],
  // Pet services
  [/vet(erinarian)?|animal.?hosp/i,'pet'],
  [/pet.?groom/i,         'pet'],
  [/dog.?walk/i,          'pet'],
  [/pet.?board|kennel/i,  'pet'],
  // Events
  [/event.?plan|wedding.?plan/i,'events'],
  [/\bdj\b|disc.?jockey/i,'events'],
  [/venue|banquet/i,      'events'],
  [/florist|flower/i,     'events'],
  // Hospitality
  [/hotel|motel|inn/i,    'hospitality'],
  [/vacation.?rental|airbnb/i,'hospitality'],
  [/resort|lodge/i,       'hospitality'],
  // Electronics / tech products
  [/laptop|computer|mac|pc\b/i,'electronics'],
  [/phone|iphone|android|samsung/i,'electronics'],
  [/\btv\b|television|monitor/i,'electronics'],
  [/headphone|speaker|earbuds/i,'electronics'],
  [/tablet|ipad/i,        'electronics'],
  // Fashion
  [/cloth(ing|es)?|fashion|apparel/i,'fashion'],
  [/shoe(s)?|sneaker|boot/i,'fashion'],
  [/dress|jeans|shirt|pants/i,'fashion'],
  // Fitness / sports products
  [/treadmill|elliptical|dumbbell|weight/i,'fitness'],
  [/yoga.?mat|workout.?equipment/i,'fitness'],
  // Home products
  [/furniture|sofa|couch|bed\b|mattress/i,'home'],
  [/appliance|refrigerator|washer|dryer/i,'appliances'],
  [/kitchen|cookware|blender/i,'appliances'],
  // Toys
  [/toy|game\b|gaming|lego|playset/i,'toys'],
  // Beauty products
  [/makeup|lipstick|foundation|mascara/i,'beauty'],
  [/skincare|moisturizer|serum/i,'beauty'],
];

// Internal category → Deal collection category
const INTERNAL_TO_DEAL = {
  home:         ['home', 'tools'],
  auto:         ['general'],
  food:         ['food', 'general'],
  health:       ['general'],
  fitness:      ['fitness'],
  beauty:       ['beauty'],
  education:    ['general'],
  professional: ['general'],
  pet:          ['general'],
  events:       ['general'],
  hospitality:  ['general'],
  electronics:  ['electronics', 'general'],
  fashion:      ['fashion'],
  appliances:   ['appliances'],
  toys:         ['toys'],
};

// Spending profiles derived from behavior patterns
const PROFILES = {
  budget_conscious:  { icon: '💰', label: 'Budget Conscious',   desc: 'You consistently look for affordable options and compare prices before committing.' },
  deal_seeker:       { icon: '🔥', label: 'Deal Seeker',        desc: 'You actively hunt for discounts, sales, and limited-time offers.' },
  quality_focused:   { icon: '⭐', label: 'Quality Focused',    desc: 'You prioritize top-rated, premium providers over the cheapest option.' },
  variety_explorer:  { icon: '🧭', label: 'Variety Explorer',   desc: 'You explore many different service categories and like to try new things.' },
  convenience_lover: { icon: '⚡', label: 'Convenience Lover',  desc: 'You look for nearby, fast, on-demand services to save time.' },
  brand_loyal:       { icon: '🏆', label: 'Brand Loyal',        desc: 'You return to the same providers and brands you trust.' },
  home_investor:     { icon: '🏠', label: 'Home Investor',      desc: 'You frequently spend on home maintenance, repairs, and improvements.' },
  wellness_focused:  { icon: '💊', label: 'Wellness Focused',   desc: 'Health, beauty, and personal care are your top priorities.' },
  foodie:            { icon: '🍽️', label: 'Foodie',             desc: 'You love dining out, catering, and food-related experiences.' },
  tech_enthusiast:   { icon: '💻', label: 'Tech Enthusiast',    desc: 'You frequently search for electronics and tech products.' },
};

function classifyTerm(term) {
  const t = (term || '').toLowerCase();
  for (const [regex, cat] of TERM_TO_CAT) {
    if (regex.test(t)) return cat;
  }
  return null;
}

function deriveProfile(categoryCounts, avgPrice, brandRepeat) {
  const cats = Object.keys(categoryCounts);
  const topCat = cats.sort((a, b) => categoryCounts[b] - categoryCounts[a])[0];

  if (brandRepeat >= 3) return 'brand_loyal';
  if (topCat === 'home' && categoryCounts.home >= 3) return 'home_investor';
  if ((categoryCounts.health || 0) + (categoryCounts.fitness || 0) + (categoryCounts.beauty || 0) >= 4) return 'wellness_focused';
  if ((categoryCounts.food || 0) >= 3) return 'foodie';
  if ((categoryCounts.electronics || 0) >= 3) return 'tech_enthusiast';
  if (cats.length >= 5) return 'variety_explorer';
  if (avgPrice !== null && avgPrice < 40) return 'budget_conscious';
  if (avgPrice !== null && avgPrice > 150) return 'quality_focused';
  return 'deal_seeker';
}

// Simple in-memory cache (5 min TTL per user/session)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function cacheKey(userId, sessionId) {
  return userId ? `u:${userId}` : `s:${sessionId}`;
}

export async function analyzeSpending(userId, sessionId) {
  const key = cacheKey(userId, sessionId);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.result;

  const WINDOW = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  // Build query for MongoDB
  const orClauses = [];
  if (userId)    orClauses.push({ userId });
  if (sessionId) orClauses.push({ sessionId });
  if (orClauses.length === 0) return { ok: false, error: 'no_identity' };

  let activities;
  try {
    activities = await UserActivity.find({
      $or: orClauses,
      createdAt: { $gte: WINDOW }
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
  } catch (e) {
    return { ok: false, error: e.message };
  }

  if (activities.length === 0) {
    return { ok: true, hasData: false, suggestions: [], topCategories: [] };
  }

  // ── Aggregate ─────────────────────────────────────────────
  const categoryCounts = {};
  const brandCounts = {};
  const pricePoints = [];
  const queryFreq = {};

  for (const act of activities) {
    // Classify by query or category field
    const sources = [act.query, act.category, act.productName, act.brand]
      .filter(Boolean);
    for (const s of sources) {
      const cat = classifyTerm(s);
      if (cat) { categoryCounts[cat] = (categoryCounts[cat] || 0) + 1; break; }
    }
    if (act.brand) brandCounts[act.brand] = (brandCounts[act.brand] || 0) + 1;
    if (typeof act.price === 'number' && act.price > 0) pricePoints.push(act.price);
    if (act.query) queryFreq[act.query.toLowerCase()] = (queryFreq[act.query.toLowerCase()] || 0) + 1;
  }

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([cat, count]) => ({ cat, count }));

  const topBrands = Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([brand, count]) => ({ brand, count }));

  const topQueries = Object.entries(queryFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([query, count]) => ({ query, count }));

  const avgPrice = pricePoints.length
    ? pricePoints.reduce((a, b) => a + b, 0) / pricePoints.length
    : null;

  const maxBrandRepeat = Math.max(0, ...Object.values(brandCounts));
  const profileKey = deriveProfile(categoryCounts, avgPrice, maxBrandRepeat);
  const profile = PROFILES[profileKey];

  // ── Match deals from DB ───────────────────────────────────
  const dealCategories = [...new Set(
    topCategories.slice(0, 3).flatMap(({ cat }) => INTERNAL_TO_DEAL[cat] || ['general'])
  )];

  let suggestedDeals = [];
  try {
    suggestedDeals = await getDealsByCategories(dealCategories, { limit: 8, minDiscount: 5 });
  } catch (_) {}

  // ── Build natural-language suggestions ────────────────────
  const suggestions = buildSuggestions(topCategories, topBrands, profileKey, avgPrice);

  const result = {
    ok: true,
    hasData: true,
    profile,
    profileKey,
    topCategories,
    topBrands,
    topQueries,
    avgPrice: avgPrice ? Math.round(avgPrice) : null,
    activityCount: activities.length,
    suggestedDeals,
    suggestions,
    dealCategories,
    generatedAt: new Date()
  };

  cache.set(key, { ts: Date.now(), result });
  return result;
}

function buildSuggestions(topCategories, topBrands, profileKey, avgPrice) {
  const suggestions = [];

  if (topCategories.length === 0) return suggestions;

  const top = topCategories[0];

  const CATEGORY_TIPS = {
    home:         { tip: 'Bundle multiple home services with one provider to save 10–20% on combined jobs.', action: 'Find home service deals' },
    auto:         { tip: 'Compare quotes from 3 mechanics — prices for the same job can vary by 40%.', action: 'Browse auto deals' },
    food:         { tip: 'Loyalty programs at your favorite restaurants can save 15–25% over time.', action: 'See food offers' },
    health:       { tip: 'Many clinics offer package rates for multiple visits — ask before you book.', action: 'Health service deals' },
    fitness:      { tip: 'Annual gym memberships are typically 30–40% cheaper than monthly.', action: 'Fitness deals' },
    beauty:       { tip: 'Booking off-peak hours (weekday mornings) can get you 10–15% off at many salons.', action: 'Beauty offers' },
    education:    { tip: 'Group tutoring sessions cost 30–50% less than one-on-one and are just as effective.', action: 'Education deals' },
    electronics:  { tip: 'Wait for end-of-quarter sales — Best Buy and Amazon discount electronics up to 40%.', action: 'Electronics deals' },
    fashion:      { tip: 'End-of-season clearance sales offer 50–70% off — buy next season in advance.', action: 'Fashion sale' },
    beauty:       { tip: 'Sephora Beauty Insider points can cover 20–30% of your annual beauty spend.', action: 'Beauty offers' },
    appliances:   { tip: 'Major appliances drop 15–30% during holiday weekends (Black Friday, Boxing Day).', action: 'Appliance deals' },
    pet:          { tip: 'Pet insurance can offset 70–80% of vet bills for chronic conditions.', action: 'Pet service deals' },
    hospitality:  { tip: 'Booking hotels mid-week vs. weekend saves an average of 20%.', action: 'Hospitality offers' },
  };

  const tip = CATEGORY_TIPS[top.cat];
  if (tip) {
    suggestions.push({ type: 'tip', category: top.cat, text: tip.tip, cta: tip.action });
  }

  // Budget advice
  if (profileKey === 'budget_conscious') {
    suggestions.push({ type: 'insight', text: `You average $${avgPrice ? Math.round(avgPrice) : '—'} per service. Using our Pre Pay plan could lock in rates before prices rise.`, cta: 'Explore Pre Pay' });
  } else if (profileKey === 'variety_explorer') {
    suggestions.push({ type: 'insight', text: `You explore ${topCategories.length} different categories. Compare providers side-by-side to find the best value across all of them.`, cta: 'Compare providers' });
  } else if (profileKey === 'home_investor') {
    suggestions.push({ type: 'insight', text: `Home services are your #1 spend. Pre-scheduling regular maintenance saves an average of 15% vs. emergency calls.`, cta: 'Pre-book maintenance' });
  }

  // Pre Pay prompt for repeated category
  if (top.count >= 3) {
    suggestions.push({
      type: 'prepay',
      category: top.cat,
      text: `You've searched for ${top.cat.replace('_', ' ')} ${top.count}× this month. Lock in today's rate with a Pre Pay subscription.`,
      cta: 'Pre-book now',
      savings: '10–20%'
    });
  }

  return suggestions;
}

// Invalidate cache for a user (call after new activity tracked)
export function invalidateCache(userId, sessionId) {
  const key = cacheKey(userId, sessionId);
  cache.delete(key);
}
