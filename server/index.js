import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuid } from 'uuid';
import cron from 'node-cron';
import { db, init as initDB } from './db.js';
import * as trends from './trends.js';
import { comparePrices } from './providers/compare.js';
import { getBestCoupon } from './providers/surpr.js';
import { fetchCouponsFromCouponFollow, getBestCouponFromCouponFollow } from './providers/couponfollow.js';
import { sendEmail } from './services/notify.js';
import { extractCouponsFromScreenshot, processImageUpload, detectPromoAndFindUrl } from './services/screenshotAI.js';
import {
  recordSearch, getRecommendations, getTrendingBrands,
  getUserSearchHistory, getBrandSearchStats,
  checkBrandAlertThreshold, getBrandsExceedingThreshold
} from './services/searchMonitor.js';
import {
  registerBrand, getBrandContact, getAllRegisteredBrands,
  sendBrandAlert, processAllBrandAlerts
} from './services/brandAlerts.js';
import connectDB from './config/database.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import { authenticate } from './middleware/auth.js';
import User from './models/User.js';

dotenv.config();
const app = express();
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://priceklick.com',
    'https://www.priceklick.com'
  ],
  credentials: true
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Initialize databases
await initDB(); // JSON file fallback

// Connect to MongoDB
const mongoConnection = await connectDB();
if (mongoConnection) {
  console.log('âœ… Using MongoDB for authentication');
} else {
  console.log('âš ï¸ MongoDB not connected - auth features disabled');
}

const PORT = process.env.PORT || 5050;

// --- Auth Routes (MongoDB) ---
if (mongoConnection) {
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);

  // Bootstrap: Promote first user to admin (only if no admins exist yet)
  app.post('/api/admin/bootstrap', authenticate, async (req, res) => {
    try {
      const adminExists = await User.findOne({ role: 'admin' });
      if (adminExists) {
        return res.status(400).json({ error: 'Admin already exists. Use admin panel to manage roles.' });
      }
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      user.role = 'admin';
      await user.save();
      res.json({ ok: true, message: 'You are now an admin!', user: user.toPublicJSON() });
    } catch (e) {
      res.status(500).json({ error: 'server_error', message: e.message });
    }
  });
}

// --- Health Check ---
app.get('/api/health', (_req, res) => res.json({ 
  ok: true, 
  mongodb: !!mongoConnection,
  timestamp: new Date().toISOString()
}));

// --- Privacy Consent ---
app.post('/api/privacy/consent', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  try {
    await db.read();
    let user = db.data.users.find(u => u.email === email);
    const userId = user?.id || uuid();
    if (!user) {
      user = { id: userId, email, created_at: Date.now() };
      db.data.users.push(user);
    }
    db.data.privacy_events.push({
      id: uuid(),
      user_id: userId,
      type: 'consent',
      payload: JSON.stringify({ marketing: true }),
      created_at: Date.now()
    });
    await db.write();
    res.json({ ok: true, userId });
  } catch (e) {
    console.error('CONSENT ERROR', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// --- Privacy Event ---
app.post('/api/privacy/event', async (req, res) => {
  const { userId, type, payload } = req.body;
  if (!userId || !type) return res.status(400).json({ error: 'userId & type required' });
  try {
    await db.read();
    db.data.privacy_events.push({
      id: uuid(),
      user_id: userId,
      type,
      payload: JSON.stringify(payload || {}),
      created_at: Date.now()
    });
    await db.write();
    res.json({ ok: true });
  } catch (e) {
    console.error('EVENT ERROR', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// --- Trends ---
app.get('/api/analytics/trends', async (req, res) => {
  const { keyword = 'coupon codes' } = req.query;
  try {
    res.json(await trends.trendSummary(keyword));
  } catch (e) {
    console.error('TRENDS ERROR', e);
    res.status(500).json({ error: 'analytics_failed' });
  }
});

// --- Service Search ---
app.get('/api/search', async (req, res) => {
  const { service, location, maxPrice } = req.query;
  if (!service) return res.status(400).json({ error: 'service required' });
  
  try {
    // Build search query combining service and location
    const query = location ? `${service} in ${location}` : service;
    
    // Use SERPAPI or mock data for service search
    const SERP_KEY = process.env.SERPAPI_KEY;
    
    if (!SERP_KEY) {
      // Return mock data when no API key is configured
      const mockResults = [
        {
          name: `${service} Pro Services`,
          location: location || 'Local Area',
          price: 75,
          rating: 4.5,
          phone: '(555) 123-4567',
          description: `Professional ${service} services in your area`
        },
        {
          name: `Quick ${service}`,
          location: location || 'Local Area',
          price: 50,
          rating: 4.2,
          phone: '(555) 234-5678',
          description: `Fast and reliable ${service} services`
        },
        {
          name: `Expert ${service} Solutions`,
          location: location || 'Local Area',
          price: 90,
          rating: 4.8,
          phone: '(555) 345-6789',
          description: `Top-rated ${service} experts`
        }
      ];
      
      // Filter by max price if provided
      let filtered = mockResults;
      if (maxPrice) {
        const max = parseFloat(maxPrice);
        filtered = mockResults.filter(r => r.price <= max);
      }
      
      return res.json({
        query,
        service,
        location: location || 'any',
        maxPrice: maxPrice || 'any',
        count: filtered.length,
        results: filtered
      });
    }
    
    // Real implementation with SERPAPI
    const fetch = (await import('node-fetch')).default;
    const params = new URLSearchParams({
      engine: 'google',
      q: query,
      gl: 'us',
      hl: 'en',
      api_key: SERP_KEY
    });
    
    const url = `https://serpapi.com/search.json?${params.toString()}`;
    const r = await fetch(url, { timeout: 15000 });
    if (!r.ok) throw new Error(`SerpAPI failed: ${r.status}`);
    const data = await r.json();
    
    // Parse results from Google search
    const results = [];
    const organicResults = data.organic_results || [];
    
    for (const result of organicResults.slice(0, 10)) {
      results.push({
        name: result.title || 'Service Provider',
        location: location || 'Local Area',
        price: 0, // Price extraction would need custom parsing
        rating: 0,
        phone: result.displayed_link || '',
        description: result.snippet || '',
        link: result.link
      });
    }
    
    res.json({
      query,
      service,
      location: location || 'any',
      maxPrice: maxPrice || 'any',
      count: results.length,
      results
    });
  } catch (e) {
    console.error('SEARCH ERROR', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// --- Price Comparison ---
app.get('/api/compare', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q (query) required' });
  try {
    const results = await comparePrices(q);
    if (!results || results.length === 0) return res.status(404).json({ error: 'no_results' });
    res.json({
      query: q,
      results,
      best: results[0] || null
    });
  } catch (e) {
    console.error('COMPARE ERROR', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// --- Auto Coupon Discovery (Agent Mode) ---
app.post('/api/coupons/discover', async (req, res) => {
  const { store, productName } = req.body;
  if (!store) return res.status(400).json({ error: 'store required' });
  
  try {
    const SERP_KEY = process.env.SERPAPI_KEY;
    
    if (!SERP_KEY) {
      // Return mock coupons when no API key
      return res.json({
        store,
        coupons: [
          { code: 'WELCOME10', discount: 10, type: 'PERCENT', description: '10% off your order' },
          { code: 'SAVE20', discount: 20, type: 'PERCENT', description: '20% off $100+' }
        ],
        found: true
      });
    }
    
    // Use SERPAPI to search for coupons
    const fetch = (await import('node-fetch')).default;
    const query = productName 
      ? `${store} coupon code ${productName}` 
      : `${store} coupon code promo discount`;
    
    const params = new URLSearchParams({
      engine: 'google',
      q: query,
      gl: 'us',
      hl: 'en',
      api_key: SERP_KEY
    });
    
    const url = `https://serpapi.com/search.json?${params.toString()}`;
    const r = await fetch(url, { timeout: 15000 });
    if (!r.ok) throw new Error(`SerpAPI failed: ${r.status}`);
    const data = await r.json();
    
    // Parse coupons from search results
    const coupons = [];
    const organicResults = data.organic_results || [];
    
    // Extract coupon codes from snippets and titles
    const couponRegex = /\b[A-Z0-9]{4,12}\b/g;
    const percentRegex = /(\d+)%\s*off/gi;
    const dollarRegex = /\$(\d+)\s*off/gi;
    
    for (const result of organicResults.slice(0, 5)) {
      const text = `${result.title || ''} ${result.snippet || ''}`;
      
      // Extract coupon codes
      const codes = text.match(couponRegex) || [];
      
      // Extract discount amounts
      let percentMatch = percentRegex.exec(text);
      let dollarMatch = dollarRegex.exec(text);
      
      for (const code of codes) {
        // Skip common words
        if (['HTTPS', 'HTTP', 'CODE', 'PROMO', 'DEAL'].includes(code)) continue;
        
        let discount = 10;
        let type = 'PERCENT';
        let description = 'Discount on your order';
        
        if (percentMatch) {
          discount = parseInt(percentMatch[1]);
          type = 'PERCENT';
          description = `${discount}% off`;
        } else if (dollarMatch) {
          discount = parseInt(dollarMatch[1]);
          type = 'FIXED';
          description = `$${discount} off`;
        }
        
        coupons.push({
          code,
          discount,
          type,
          description,
          source: result.title
        });
      }
    }
    
    // Fallback to mock if no coupons found
    if (coupons.length === 0) {
      coupons.push(
        { code: 'WELCOME10', discount: 10, type: 'PERCENT', description: '10% off your order', source: 'Generic' },
        { code: 'SAVE15', discount: 15, type: 'PERCENT', description: '15% off $50+', source: 'Generic' }
      );
    }
    
    res.json({
      store,
      productName: productName || null,
      coupons: coupons.slice(0, 5), // Top 5 coupons
      found: coupons.length > 0
    });
  } catch (e) {
    console.error('COUPON DISCOVERY ERROR', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// --- CouponFollow Integration ---
// Fetch coupons from CouponFollow.com for a specific store
app.get('/api/coupons/couponfollow', async (req, res) => {
  const { store } = req.query;
  if (!store) return res.status(400).json({ error: 'store query parameter required' });
  
  try {
    const coupons = await fetchCouponsFromCouponFollow(store);
    
    if (!coupons || coupons.length === 0) {
      return res.json({
        store,
        coupons: [],
        found: false,
        source: 'CouponFollow',
        message: 'No coupons found for this store'
      });
    }
    
    res.json({
      store,
      coupons,
      found: true,
      source: 'CouponFollow',
      count: coupons.length
    });
  } catch (e) {
    console.error('COUPONFOLLOW ERROR', e);
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// Get best coupon from CouponFollow for a store
app.get('/api/coupons/couponfollow/best', async (req, res) => {
  const { store } = req.query;
  if (!store) return res.status(400).json({ error: 'store query parameter required' });
  
  try {
    const coupon = await getBestCouponFromCouponFollow(store);
    
    if (!coupon) {
      return res.status(404).json({
        store,
        found: false,
        source: 'CouponFollow',
        message: 'No coupons found for this store'
      });
    }
    
    res.json({
      store,
      coupon,
      found: true,
      source: 'CouponFollow'
    });
  } catch (e) {
    console.error('COUPONFOLLOW BEST ERROR', e);
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// Combined coupon discovery - merges results from multiple sources
app.get('/api/coupons/all', async (req, res) => {
  const { store } = req.query;
  if (!store) return res.status(400).json({ error: 'store query parameter required' });
  
  try {
    // Fetch from CouponFollow
    const couponFollowCoupons = await fetchCouponsFromCouponFollow(store);
    
    // Get from generic provider (if configured)
    let genericCoupon = null;
    try {
      genericCoupon = await getBestCoupon(`https://${store}`);
    } catch (e) {
      // Ignore generic provider errors
    }
    
    // Combine and deduplicate
    const allCoupons = [...couponFollowCoupons];
    
    if (genericCoupon && genericCoupon.code) {
      const exists = allCoupons.find(c => c.code.toLowerCase() === genericCoupon.code.toLowerCase());
      if (!exists) {
        allCoupons.push({
          ...genericCoupon,
          source: genericCoupon.source || 'Generic'
        });
      }
    }
    
    // Sort by discount (highest first)
    allCoupons.sort((a, b) => {
      const aVal = a.type === 'PERCENT' ? a.discount : a.discount / 100;
      const bVal = b.type === 'PERCENT' ? b.discount : b.discount / 100;
      return bVal - aVal;
    });
    
    res.json({
      store,
      coupons: allCoupons.slice(0, 10),
      found: allCoupons.length > 0,
      sources: ['CouponFollow', 'Generic'],
      count: allCoupons.length
    });
  } catch (e) {
    console.error('COMBINED COUPONS ERROR', e);
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// --- AI Screenshot Coupon Extraction ---
// Extract coupon codes from uploaded screenshots using AI
app.post('/api/coupons/screenshot', async (req, res) => {
  const { image, preferredProvider } = req.body;
  
  if (!image) {
    return res.status(400).json({ 
      error: 'image required', 
      message: 'Please provide a base64-encoded image or data URL' 
    });
  }
  
  try {
    console.log('ðŸ“¸ Processing screenshot for coupon extraction...');
    
    // Process the uploaded image
    const { base64, format } = processImageUpload(image);
    
    // Validate image size (max 10MB)
    const sizeInBytes = (base64.length * 3) / 4;
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (sizeInBytes > maxSize) {
      return res.status(400).json({
        error: 'image_too_large',
        message: 'Image must be smaller than 10MB'
      });
    }
    
    // Extract coupons using AI
    const result = await extractCouponsFromScreenshot(base64, {
      preferredProvider: preferredProvider || 'openai'
    });
    
    if (!result.success) {
      return res.status(result.error?.includes('No AI API keys') ? 503 : 500).json({
        error: 'extraction_failed',
        message: result.error,
        provider: result.provider,
        coupons: []
      });
    }
    
    console.log(`âœ… Extracted ${result.coupons?.length || 0} coupons from screenshot`);
    
    res.json({
      success: true,
      coupons: result.coupons || [],
      count: result.coupons?.length || 0,
      provider: result.provider,
      storeDetected: result.storeDetected || null,
      hasText: result.hasText || false,
      warning: result.warning || null
    });
  } catch (e) {
    console.error('SCREENSHOT EXTRACTION ERROR', e);
    res.status(500).json({ 
      error: 'server_error', 
      message: e.message 
    });
  }
});

// --- Coupons ---
// Coupon apply endpoint now expects originalPrice and returns before/after prices
app.post('/api/coupons/apply', async (req, res) => {
  const { cartUrl, originalPrice } = req.body;
  if (!cartUrl || typeof originalPrice !== 'number') {
    return res.status(400).json({ error: 'cartUrl and originalPrice required' });
  }
  try {
    const coupon = await getBestCoupon(cartUrl);
    if (!coupon) return res.status(404).json({ error: 'no_coupon' });
    let discountedPrice = originalPrice;
    if (coupon.type === 'PERCENT') {
      discountedPrice = +(originalPrice * (1 - coupon.discount / 100)).toFixed(2);
    } else if (coupon.type === 'AMOUNT') {
      discountedPrice = +(originalPrice - coupon.discount).toFixed(2);
    }
    if (discountedPrice < 0) discountedPrice = 0;
    res.json({
      ...coupon,
      originalPrice,
      discountedPrice
    });
  } catch (e) {
    console.error('COUPON ERROR', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// --- Wishlist Add ---
app.post('/api/wishlist', async (req, res) => {
  const { userId, title, url, sku, target_price, currency = 'USD' } = req.body;
  if (!userId || !title) return res.status(400).json({ error: 'userId & title required' });
  try {
    await db.read();
    const id = uuid();
    db.data.wishlist.push({
      id,
      user_id: userId,
      title,
      url: url || '',
      sku: sku || '',
      target_price: target_price ?? null,
      last_price: null,
      currency,
      created_at: Date.now()
    });
    await db.write();
    res.json({ ok: true, id });
  } catch (e) {
    console.error('WL ADD ERROR', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// --- Wishlist List ---
app.get('/api/wishlist', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    await db.read();
    const rows = db.data.wishlist
      .filter(w => w.user_id === userId)
      .sort((a, b) => b.created_at - a.created_at);
    res.json(rows);
  } catch (e) {
    console.error('WL LIST ERROR', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// --- Wishlist Delete ---
app.delete('/api/wishlist/:id', async (req, res) => {
  try {
    await db.read();
    db.data.wishlist = db.data.wishlist.filter(w => w.id !== req.params.id);
    await db.write();
    res.json({ ok: true });
  } catch (e) {
    console.error('WL DEL ERROR', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// --- Compare Prices ---
app.get('/api/compare', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q required' });
  try {
    const items = await comparePrices(q);
    const best = items.slice().sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))[0] || null;
    res.json({ items, best });
  } catch (e) {
    console.error('COMPARE ERROR', e);
    res.status(500).json({ error: 'compare_failed' });
  }
});

// --- Agent ---
async function runAgentOnce() {
  await db.read();
  const items = db.data.wishlist.map(w => ({
    ...w,
    email: (db.data.users.find(u => u.id === w.user_id) || {}).email
  }));

  const results = [];
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const EMAIL_THROTTLE_MS = Number(process.env.EMAIL_THROTTLE_MS || 1500);

  for (const it of items) {
    const query = it.sku || it.title;
    const comps = await comparePrices(query);
    const best = comps.slice().sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))[0];
    if (!best) continue;

    const idx = db.data.wishlist.findIndex(w => w.id === it.id);
    if (idx >= 0) db.data.wishlist[idx].last_price = best.price;

    if (it.target_price && best.price <= it.target_price && it.email) {
      const html = `
        <div style="font-family:Inter, Arial, sans-serif; background:#f6f6fb; padding:24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eee">
            <tr>
              <td style="background:linear-gradient(135deg,#6D4AFF,#9B5BFF); padding:18px 20px; color:#fff;">
                <div style="font-weight:800; font-size:18px;">PriceKlick</div>
                <div style="opacity:.9; font-size:13px;">Price Drop Alert</div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 20px 8px 20px; color:#111827;">
                <h2 style="margin:0 0 8px 0; font-size:20px; font-weight:800;">Good news! ðŸŽ‰</h2>
                <p style="margin:0 0 14px 0; line-height:1.55;">
                  <b>${it.title}</b> is now 
                  <b>${best.price} ${it.currency || 'USD'}</b> at <b>${best.source}</b>.
                </p>
                <p style="margin:0 0 14px 0; line-height:1.55;">
                  Your target price: <b>${it.target_price} ${it.currency || 'USD'}</b>
                </p>
                <a href="${best.url}" 
                   style="display:inline-block;background:#7c4dff;color:#fff;text-decoration:none;
                          padding:12px 16px;border-radius:10px;font-weight:700;">
                  View deal
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 20px 18px 20px; color:#6b7280; font-size:12px;">
                Youâ€™re receiving this because you saved this item in your PriceKlick wishlist.
                <br/>To stop alerts for this item, remove it from your dashboard.
              </td>
            </tr>
          </table>
          <div style="text-align:center;color:#9aa3af;font-size:12px;margin-top:14px;">
            Â© ${new Date().getFullYear()} PriceKlick â€¢ All rights reserved
          </div>
        </div>
      `;

      try {
        await sendEmail(it.email, `Price drop: ${it.title}`, html);
        results.push({ id: it.id, notified: true, price: best.price });
      } catch (e) {
        console.warn("[agent] email failed but continuing:", e?.message || e);
        results.push({ id: it.id, notified: false, price: best.price, emailError: true });
      }
      await sleep(EMAIL_THROTTLE_MS);
    } else {
      results.push({ id: it.id, notified: false, price: best.price });
    }
  }

  await db.write();
  return { ok: true, results };
}

app.post('/api/agent/run', async (req, res) => {
  const { secret } = req.query;
  if (process.env.AGENT_SECRET && secret !== process.env.AGENT_SECRET) {
    return res.status(403).json({ error: 'forbidden' });
  }
  try {
    res.json(await runAgentOnce());
  } catch (e) {
    console.error('AGENT ERROR', e);
    res.status(500).json({ error: 'agent_failed' });
  }
});

const schedule = process.env.AGENT_CRON || "0 */6 * * *";
try {
  cron.schedule(schedule, async () => {
    console.log('[agent] scheduled run');
    try {
      await runAgentOnce();
    } catch (e) {
      console.error('[agent] run failed', e);
    }
  });
} catch (e) {
  console.warn('Invalid AGENT_CRON, skipping schedule:', e?.message);
}

// --- Brand Alert Cron (every hour) ---
try {
  cron.schedule('0 * * * *', async () => {
    console.log('[brand-alerts] Processing pending alerts...');
    try {
      const results = await processAllBrandAlerts();
      if (results.length > 0) {
        console.log(`[brand-alerts] Sent ${results.length} alerts`);
      }
    } catch (e) {
      console.error('[brand-alerts] run failed', e);
    }
  });
} catch (e) {
  console.warn('Brand alert cron failed:', e?.message);
}

// ========================================================
// SEARCH MONITOR & RECOMMENDATION SYSTEM
// ========================================================

// Record a user search event (called by extension)
app.post('/api/search/track', async (req, res) => {
  const { userId, query, brand, product, url, sessionId } = req.body;
  if (!query && !brand) return res.status(400).json({ error: 'query or brand required' });
  
  try {
    const result = recordSearch({ userId, query, brand, product, url, sessionId });
    
    // Check if brand alert threshold is now met
    const alertCheck = checkBrandAlertThreshold(result.brand);
    if (alertCheck.shouldAlert) {
      console.log(`ðŸ”¥ [brand-alert] Threshold met for "${result.brand}" (${alertCheck.uniqueUsers} users)`);
      // Fire async brand alert
      sendBrandAlert(result.brand).catch(e => 
        console.warn('[brand-alert] Send failed:', e.message)
      );
    }
    
    res.json({ 
      ok: true, 
      ...result,
      alertTriggered: alertCheck.shouldAlert
    });
  } catch (e) {
    console.error('SEARCH TRACK ERROR', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Get personalized recommendations for a user
app.get('/api/recommendations', async (req, res) => {
  const { userId, limit } = req.query;
  
  try {
    const recommendations = getRecommendations(userId, parseInt(limit) || 10);
    const trending = getTrendingBrands(5);
    
    res.json({
      ok: true,
      recommendations,
      trending,
      count: recommendations.length
    });
  } catch (e) {
    console.error('RECOMMENDATIONS ERROR', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Get trending brands across all users
app.get('/api/trending', async (req, res) => {
  const { limit } = req.query;
  
  try {
    const trending = getTrendingBrands(parseInt(limit) || 10);
    res.json({ ok: true, trending, count: trending.length });
  } catch (e) {
    console.error('TRENDING ERROR', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Get user search history
app.get('/api/search/history', async (req, res) => {
  const { userId, limit } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  
  try {
    const history = getUserSearchHistory(userId, parseInt(limit) || 50);
    res.json({ ok: true, history, count: history.length });
  } catch (e) {
    console.error('SEARCH HISTORY ERROR', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Get brand search analytics
app.get('/api/brand/stats', async (req, res) => {
  const { brand } = req.query;
  if (!brand) return res.status(400).json({ error: 'brand required' });
  
  try {
    const stats = getBrandSearchStats(brand);
    res.json({ ok: true, ...stats });
  } catch (e) {
    console.error('BRAND STATS ERROR', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// ========================================================
// BRAND ALERT REACHING SYSTEM
// ========================================================

// Register a brand for alerts
app.post('/api/brand/register', async (req, res) => {
  const { brand, email, webhookUrl, contactName } = req.body;
  if (!brand) return res.status(400).json({ error: 'brand required' });
  if (!email && !webhookUrl) return res.status(400).json({ error: 'email or webhookUrl required' });
  
  try {
    const result = registerBrand({ brand, email, webhookUrl, contactName });
    res.json(result);
  } catch (e) {
    console.error('BRAND REGISTER ERROR', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Get all brands exceeding alert threshold
app.get('/api/brand/alerts', async (req, res) => {
  try {
    const alerts = getBrandsExceedingThreshold();
    res.json({ ok: true, alerts, count: alerts.length });
  } catch (e) {
    console.error('BRAND ALERTS ERROR', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Manually trigger brand alert
app.post('/api/brand/alert/send', async (req, res) => {
  const { brand } = req.body;
  if (!brand) return res.status(400).json({ error: 'brand required' });
  
  try {
    const result = await sendBrandAlert(brand);
    res.json(result);
  } catch (e) {
    console.error('BRAND ALERT SEND ERROR', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Get all registered brands
app.get('/api/brand/registered', async (req, res) => {
  try {
    const brands = getAllRegisteredBrands();
    res.json({ ok: true, brands, count: brands.length });
  } catch (e) {
    console.error('BRAND REGISTERED ERROR', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// ========================================================
// SCREENSHOT PROMOTION CAPTURE - Vendor Checkout Redirect
// ========================================================

// Capture promotion screenshot and return checkout URL
app.post('/api/promo/capture', async (req, res) => {
  const { image, vendorUrl, brand, productName } = req.body;
  
  if (!image) return res.status(400).json({ error: 'image required' });
  
  try {
    // Process screen capture
    const { base64, format } = processImageUpload(image);
    
    // Extract any coupon codes from the screenshot
    const extraction = await extractCouponsFromScreenshot(base64, { 
      preferredProvider: 'openai' 
    });
    
    // Also run Google Lens-like promo detection
    const promoDetection = await detectPromoAndFindUrl(base64);
    
    // Build vendor checkout URL â€” prefer AI-detected promo URL
    let checkoutUrl = '';
    let promoRedirectUrl = promoDetection.success ? promoDetection.redirectUrl : null;
    
    if (promoRedirectUrl) {
      checkoutUrl = promoRedirectUrl;
    } else if (vendorUrl) {
      checkoutUrl = vendorUrl;
    } else if (brand) {
      checkoutUrl = `https://www.${brand.toLowerCase().replace(/\s+/g, '')}.com/checkout`;
    }
    
    // Track this search
    const detectedBrand = promoDetection.brand || brand || extraction.storeDetected;
    if (detectedBrand) {
      recordSearch({ 
        query: productName || detectedBrand, 
        brand: detectedBrand, 
        product: productName, 
        url: checkoutUrl 
      });
    }
    
    // Merge coupons from both extraction methods
    const allCoupons = [
      ...(extraction.coupons || []),
      ...(promoDetection.coupons || [])
    ];
    // Deduplicate by code
    const seen = new Set();
    const uniqueCoupons = allCoupons.filter(c => {
      if (!c.code) return false;
      const key = c.code.toUpperCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    res.json({
      ok: true,
      coupons: uniqueCoupons,
      checkoutUrl,
      brand: detectedBrand || null,
      promoSaved: true,
      timestamp: Date.now(),
      // Google Lens-like promo detection data
      promoDetection: promoDetection.success ? {
        redirectUrl: promoDetection.redirectUrl,
        urlSource: promoDetection.urlSource,
        promotionTitle: promoDetection.promotionTitle,
        promotionDescription: promoDetection.promotionDescription,
        domain: promoDetection.domain,
        websiteUrl: promoDetection.websiteUrl,
        discountAmount: promoDetection.discountAmount,
        promoType: promoDetection.promoType,
        visibleUrls: promoDetection.visibleUrls,
        confidence: promoDetection.confidence
      } : null
    });
  } catch (e) {
    console.error('PROMO CAPTURE ERROR', e);
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// ========================================================
// GOOGLE LENS-LIKE: Screenshot â†’ Detect promo â†’ Find official URL
// ========================================================

// Upload a screenshot of any promotion â†’ get redirected to official promo page
app.post('/api/promo/find-url', async (req, res) => {
  const { image } = req.body;
  
  if (!image) return res.status(400).json({ error: 'No image provided. Please upload a screenshot.' });
  
  try {
    const { base64 } = processImageUpload(image);
    
    console.log('ðŸ”Ž Processing Google Lens-like promo detection...');
    const result = await detectPromoAndFindUrl(base64);
    
    if (!result.success) {
      // Provide specific error message based on the failure reason
      const detail = result.error || '';
      let userMessage = 'Could not detect promotion from screenshot.';
      if (detail.includes('API error: 401') || detail.includes('Unauthorized')) {
        userMessage = 'AI service authentication failed. The API key may be expired or invalid.';
      } else if (detail.includes('API error: 429')) {
        userMessage = 'AI service rate limit reached. Please try again in a moment.';
      } else if (detail.includes('API error')) {
        userMessage = 'AI analysis service is temporarily unavailable. Please try again later.';
      } else if (detail.includes('API keys')) {
        userMessage = 'AI vision service is not configured. Contact the administrator.';
      }
      return res.status(422).json({
        ok: false,
        error: userMessage,
        detail: result.error
      });
    }
    
    // Track the search
    if (result.brand) {
      recordSearch({
        query: result.promotionTitle || result.brand,
        brand: result.brand,
        product: result.products?.[0] || null,
        url: result.redirectUrl
      });
    }
    
    // Build a redirect URL fallback if detection succeeded but no URL was found
    let redirectUrl = result.redirectUrl;
    let urlSource = result.urlSource;
    if (!redirectUrl && result.brand) {
      redirectUrl = result.domain
        ? (result.domain.startsWith('http') ? result.domain : `https://www.${result.domain}`)
        : `https://www.google.com/search?q=${encodeURIComponent(result.brand + ' ' + (result.promotionTitle || 'deals'))}`;
      urlSource = result.domain ? 'brand_homepage' : 'google_search';
    }
    
    res.json({
      ok: true,
      redirectUrl,
      checkoutUrl: result.checkoutUrl || null,
      checkoutSource: result.checkoutSource || null,
      productUrl: result.productUrl || null,
      productSource: result.productSource || null,
      productPrice: result.productPrice || null,
      productCategory: result.productCategory || null,
      productSearchQuery: result.productSearchQuery || null,
      urlSource,
      brand: result.brand,
      domain: result.domain,
      websiteUrl: result.websiteUrl,
      promotionTitle: result.promotionTitle,
      promotionDescription: result.promotionDescription,
      products: result.products,
      coupons: result.coupons,
      discountAmount: result.discountAmount,
      expiryDate: result.expiryDate,
      promoType: result.promoType,
      visibleUrls: result.visibleUrls,
      confidence: result.confidence,
      timestamp: Date.now()
    });
  } catch (e) {
    console.error('PROMO FIND-URL ERROR', e);
    res.status(500).json({ error: 'Server error analyzing screenshot. Please try again.', message: e.message });
  }
});

app.listen(PORT, () => console.log('Server listening on', PORT));
