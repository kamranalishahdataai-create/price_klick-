// AI-powered screenshot coupon extraction service
import fetch from 'node-fetch';

/**
 * Extract coupon codes from a screenshot using AI
 * Supports multiple AI providers with fallback
 */

// Common coupon code patterns for regex-based extraction
const COUPON_PATTERNS = [
  /\b([A-Z0-9]{4,20})\b/gi,                    // Generic alphanumeric codes
  /(?:code|coupon|promo)[:\s]*([A-Z0-9]{4,20})/gi,  // Codes after keywords
  /\b(SAVE\d+|OFF\d+|\d+OFF|\d+SAVE)\b/gi,    // Common discount patterns
  /\b([A-Z]{2,8}\d{2,6})\b/g,                  // Letter+number combinations
  /\b(\d{2,6}[A-Z]{2,8})\b/g,                  // Number+letter combinations
];

// Keywords that often appear near coupon codes
const COUPON_KEYWORDS = [
  'coupon', 'promo', 'code', 'discount', 'save', 'off', 
  'deal', 'offer', 'voucher', 'percent', '%', 'free shipping'
];

/**
 * Extract coupons using OpenAI Vision API
 */
async function extractWithOpenAI(base64Image, apiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a coupon code extraction assistant. Analyze images and extract any visible coupon codes, promo codes, or discount codes. 
            
            For each code found, provide:
            1. The exact code (preserve case and formatting)
            2. Description of the discount if visible
            3. Any expiration date if shown
            4. Confidence level (high/medium/low)
            
            Return ONLY valid JSON in this format:
            {
              "coupons": [
                {
                  "code": "SAVE20",
                  "description": "20% off your order",
                  "expiry": "2024-12-31",
                  "confidence": "high"
                }
              ],
              "hasText": true,
              "storeDetected": "Amazon"
            }
            
            If no coupons are found, return: {"coupons": [], "hasText": false, "storeDetected": null}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all coupon codes, promo codes, and discount codes from this image. Include any visible discount percentages or amounts.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    
    const result = JSON.parse(jsonStr.trim());
    return {
      success: true,
      provider: 'openai',
      ...result
    };
  } catch (error) {
    console.error('OpenAI extraction failed:', error.message);
    return { success: false, error: error.message, provider: 'openai' };
  }
}

// ========================================================
// GOOGLE LENS-LIKE: Detect brand, URL, promo details from screenshot
// ========================================================

/**
 * Analyze screenshot to detect brand, website, promotion URL (Google Lens-like)
 * Returns brand info, detected URLs, promotion details for redirect
 */
async function extractPromoDetailsWithOpenAI(base64Image, apiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a visual product and promotion recognition assistant. You can identify products, brands, and promotional offers from ANY image — whether it's a promotional flyer, a store ad, a product photo, a screenshot of a product page, or even a physical product in someone's hand.

Your job is to identify WHAT the product is and WHERE to buy it.

Analyze the image and extract ALL of these details:
1. **Brand/Store name** — the company, retailer, or product brand
2. **Website/Domain** — any visible URL, domain, or if you recognize the brand, provide their main website
3. **Promotion title** — the headline or main offer text (null if no promotion visible)
4. **Promotion description** — full details of the offer (null if no promotion)
5. **Product names** — specific product names/models shown (VERY IMPORTANT — be as specific as possible, include model numbers, sizes, colors if visible)
6. **Product category** — e.g., "coffee maker", "running shoes", "laptop", "slow cooker"
7. **Product price** — any visible prices (sale price AND original price if shown)
8. **Coupon/Promo codes** — any visible discount codes
9. **Discount amount** — percentage or dollar amount off
10. **Expiry date** — when the promotion ends
11. **Promotion type** — sale, clearance, BOGO, flash deal, seasonal, product_photo (use "product_photo" if it's just a product image with no promotion)
12. **Official promotion URL** — your best guess for the DIRECT URL to this exact product/deal on the store's website
13. **Product search query** — a precise search query that would find this exact product on Google or the store's website (e.g., "Keurig K-Supreme Plus" or "Nike Air Max 90 white")
14. **Image type** — "promo" (flyer/ad/deal), "product_page" (screenshot of online store), "product_photo" (photo of physical product), or "other"

IMPORTANT: Even if there is NO promotion, discount, or coupon, you MUST still identify the product.
- If it's a photo of a product (e.g., a shoe, a phone, a kitchen appliance), identify the brand and product name
- If you recognize the brand, provide their main website domain
- Set hasPromotion to false but still fill in brand, domain, products, productCategory, and productSearchQuery
- For product photos, guess the most likely retailer (Amazon, Walmart, etc.) if no store branding is visible

For the officialPromoUrl, construct the most likely DIRECT PRODUCT PAGE URL (not search page):
- Amazon: amazon.com/dp/ASIN or amazon.com/product-name/dp/ASIN
- Walmart: walmart.com/ip/product-name/PRODUCT_ID
- Target: target.com/p/product-name/-/A-TARGET_ID
- Best Buy: bestbuy.com/site/product-name/SKU.p?skuId=SKU
- Canadian Tire: canadiantire.ca/en/pdp/product-name-CTID.html
- Home Depot: homedepot.com/p/product-name/PRODUCT_ID
- If you recognize the product model, try to construct the actual product page URL
- Only fall back to search URL if you can't determine the exact product page

For productSearchUrl, ALWAYS construct the search URL as a fallback:
- Use known patterns: amazon.com/s?k=PRODUCT, walmart.com/search?q=PRODUCT, canadiantire.ca/en/search-results.html?q=PRODUCT

For exactProductUrl, provide the DIRECT product page URL if you can identify it from the image (specific model number, SKU, or product ID visible). Set to null if uncertain.

Return ONLY valid JSON:
{
  "brand": "Canadian Tire",
  "domain": "canadiantire.ca",
  "websiteUrl": "https://www.canadiantire.ca",
  "officialPromoUrl": "https://www.canadiantire.ca/en/pdp/keurig-k-supreme-plus-coffee-maker-0430120p.html",
  "exactProductUrl": "https://www.canadiantire.ca/en/pdp/keurig-k-supreme-plus-coffee-maker-0430120p.html",
  "productSearchUrl": "https://www.canadiantire.ca/en/search-results.html?q=keurig+k-supreme+plus",
  "promotionTitle": "Save $70 on Keurig K-Supreme Plus",
  "promotionDescription": "Keurig K-Supreme Plus Coffee Maker on sale, save $70",
  "products": ["Keurig K-Supreme Plus Coffee Maker"],
  "productCategory": "coffee maker",
  "productPrice": {"sale": "$149.99", "original": "$219.99"},
  "productSearchQuery": "Keurig K-Supreme Plus Coffee Maker",
  "coupons": [{"code": "SAVE70", "description": "$70 off", "confidence": "high"}],
  "discountAmount": "$70",
  "expiryDate": null,
  "promoType": "product_sale",
  "imageType": "promo",
  "visibleUrls": ["canadiantire.ca"],
  "confidence": "high",
  "hasPromotion": true
}

For a product photo with NO promotion:
{
  "brand": "Nike",
  "domain": "nike.com",
  "websiteUrl": "https://www.nike.com",
  "officialPromoUrl": null,
  "exactProductUrl": null,
  "productSearchUrl": "https://www.amazon.com/s?k=nike+air+max+90+white",
  "promotionTitle": null,
  "promotionDescription": null,
  "products": ["Nike Air Max 90"],
  "productCategory": "running shoes",
  "productPrice": null,
  "productSearchQuery": "Nike Air Max 90 white",
  "coupons": [],
  "discountAmount": null,
  "expiryDate": null,
  "promoType": "product_photo",
  "imageType": "product_photo",
  "visibleUrls": [],
  "confidence": "high",
  "hasPromotion": false
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this image. It could be a promotional screenshot, a product page, OR just a photo of a product. Identify the brand and specific product(s) — I need the EXACT product name and model number to find it online. If it\'s a promo, extract all deal details. If it\'s just a product photo, identify what it is so I can search for it. Construct the DIRECT product page URL if possible. Also provide a search URL as fallback. Look for any product IDs, SKUs, or model numbers visible in the image.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI Promo Detection API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI promo detection');

    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];

    const result = JSON.parse(jsonStr.trim());
    return { success: true, provider: 'openai_promo_lens', ...result };
  } catch (error) {
    console.error('OpenAI promo detection failed:', error.message);
    return { success: false, error: error.message, provider: 'openai_promo_lens' };
  }
}

/**
 * Extract URLs and brand info from Google Vision text output
 */
function extractPromoDetailsFromText(text) {
  if (!text) return { brand: null, domain: null, visibleUrls: [], products: [] };

  // Find URLs in text
  const urlPattern = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+)(?:\/[^\s)\\]*)?/gi;
  const visibleUrls = [];
  let urlMatch;
  while ((urlMatch = urlPattern.exec(text)) !== null) {
    visibleUrls.push(urlMatch[0]);
  }

  // Extract domain from first URL
  const domain = visibleUrls.length > 0
    ? visibleUrls[0].replace(/^(?:https?:\/\/)?(?:www\.)?/, '').split('/')[0]
    : null;

  // Try to identify brand from text (look for prominent capitalized words)
  const brandPatterns = [
    /^([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,2})\s/m,     // Capitalized words at start of line
    /(?:from|at|by|shop)\s+([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,2})/i,
    /([A-Z]{2,}(?:\s[A-Z]{2,}){0,2})/                       // ALL CAPS words (often brand names)
  ];

  let brand = null;
  for (const pattern of brandPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length > 2 && !isCommonWord(match[1].toUpperCase())) {
      brand = match[1].trim();
      break;
    }
  }

  return { brand, domain, visibleUrls, products: [] };
}

/**
 * Validate a URL by making a HEAD request to check it's not 404/5xx
 * Also detects soft 404s (pages that return 200 but redirect to error pages)
 * Returns true if the URL is reachable and NOT a soft 404
 */
// URL patterns that indicate a soft 404 page (returns 200 but is actually an error)
const SOFT_404_PATTERNS = [
  '/error', '/404', '/not-found', '/page-not-found', '/missing',
  '/nopage', '/oops', '/sorry', '/unavailable'
];

function isSoft404(finalUrl) {
  const lower = (finalUrl || '').toLowerCase();
  return SOFT_404_PATTERNS.some(p => lower.includes(p));
}

// Always enforce HTTPS — many sites block plain HTTP with 403
function enforceHttps(url) {
  if (!url || url === 'null') return url;
  return url.replace(/^http:\/\//i, 'https://');
}

async function validateUrl(url) {
  try {
    const normalizedUrl = enforceHttps(url.startsWith('http') ? url : `https://${url}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(normalizedUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });
    clearTimeout(timeout);
    // Check HTTP status — 403 means bot protection, treat as invalid
    if (res.status < 200 || res.status >= 400) return false;
    // Check for soft 404 — redirected to an error page
    const finalUrl = res.url || normalizedUrl;
    if (isSoft404(finalUrl)) {
      console.log(`  ⚠️ Soft 404 detected: ${normalizedUrl} → ${finalUrl}`);
      return false;
    }
    return true;
  } catch {
    // On HEAD failure, try GET (some servers reject HEAD)
    try {
      const normalizedUrl = enforceHttps(url.startsWith('http') ? url : `https://${url}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(normalizedUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
      clearTimeout(timeout);
      if (res.status < 200 || res.status >= 400) return false;
      // Check for soft 404 in final URL
      const finalUrl = res.url || normalizedUrl;
      if (isSoft404(finalUrl)) {
        console.log(`  ⚠️ Soft 404 detected (GET): ${normalizedUrl} → ${finalUrl}`);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Search for official promotion URL using SERP API
 */
async function searchForPromoUrl(brand, promotionTitle, domain) {
  const serpKey = process.env.SERP_API_KEY || process.env.SERPAPI_KEY;
  if (!serpKey) {
    // Construct best-guess URL without SERP
    return constructBestGuessUrl(brand, domain, promotionTitle);
  }

  try {
    const query = encodeURIComponent(
      `${brand || ''} ${promotionTitle || 'promotion deal'} official site`.trim()
    );
    const serpUrl = `https://serpapi.com/search.json?q=${query}&api_key=${serpKey}&num=5`;
    const res = await fetch(serpUrl);
    if (!res.ok) throw new Error(`SERP API error: ${res.status}`);

    const data = await res.json();
    const results = data.organic_results || [];

    // Priority 1: Find result matching the detected domain
    if (domain) {
      const domainMatch = results.find(r => r.link && r.link.includes(domain));
      if (domainMatch) return { url: domainMatch.link, source: 'serp_domain_match', title: domainMatch.title };
    }

    // Priority 2: Find result with promo/deal/sale/offer keywords in URL or title
    const promoKeywords = ['deal', 'promo', 'offer', 'sale', 'coupon', 'discount', 'campaign'];
    const promoResult = results.find(r => {
      const combined = `${r.link} ${r.title}`.toLowerCase();
      return promoKeywords.some(kw => combined.includes(kw));
    });
    if (promoResult) return { url: promoResult.link, source: 'serp_promo_match', title: promoResult.title };

    // Priority 3: First organic result from brand's official site
    if (brand) {
      const brandDomain = brand.toLowerCase().replace(/\s+/g, '');
      const brandResult = results.find(r => r.link && r.link.includes(brandDomain));
      if (brandResult) return { url: brandResult.link, source: 'serp_brand_match', title: brandResult.title };
    }

    // Priority 4: First result
    if (results.length > 0) {
      return { url: results[0].link, source: 'serp_first_result', title: results[0].title };
    }

    return constructBestGuessUrl(brand, domain, promotionTitle);
  } catch (error) {
    console.error('SERP promo URL search failed:', error.message);
    return constructBestGuessUrl(brand, domain, promotionTitle);
  }
}

/**
 * Construct best-guess promotion URL from brand/domain info
 */
function constructBestGuessUrl(brand, domain, promotionTitle) {
  if (domain) {
    // Return the homepage — guessing subpaths often leads to 404s
    const base = domain.startsWith('http') ? domain : `https://www.${domain}`;
    return { url: base, source: 'brand_homepage', title: promotionTitle || 'Promotion' };
  }
  if (brand) {
    const cleanBrand = brand.toLowerCase().replace(/\s+/g, '');
    return { url: `https://www.${cleanBrand}.com`, source: 'brand_homepage', title: promotionTitle || 'Promotion' };
  }
  return { url: null, source: 'none', title: null };
}

// ========================================================
// CHECKOUT URL MAPPER — Known store checkout/cart paths
// ========================================================
const CHECKOUT_PATHS = {
  'amazon.com':       '/gp/cart/view.html',
  'amazon.ca':        '/gp/cart/view.html',
  'amazon.co.uk':     '/gp/cart/view.html',
  'walmart.com':      '/cart',
  'target.com':       '/cart',
  'bestbuy.com':      '/cart',
  'ebay.com':         '/sc/view',
  'etsy.com':         '/cart',
  'nike.com':         '/cart',
  'adidas.com':       '/cart',
  'apple.com':        '/shop/bag',
  'costco.com':       '/cart',
  'homedepot.com':    '/mycart/home',
  'lowes.com':        '/cart',
  'ikea.com':         '/shoppingcart/',
  'wayfair.com':      '/cart/',
  'macys.com':        '/bag',
  'nordstrom.com':    '/shopping-bag',
  'sephora.com':      '/basket',
  'ulta.com':         '/bag',
  'shein.com':        '/cart',
  'asos.com':         '/bag',
  'zara.com':         '/shop/cart',
  'hm.com':           '/cart',
  'gap.com':          '/shopping-bag',
  'oldnavy.com':      '/shopping-bag',
  'jcpenney.com':     '/cart',
  'kohls.com':        '/cart',
  'chewy.com':        '/cart',
  'petco.com':        '/cart',
  'petsmart.com':     '/cart',
  'gamestop.com':     '/cart/',
  'newegg.com':       '/shop/cart',
  'shopify.com':      '/cart',
  'aliexpress.com':   '/shopping_cart.htm',
  'wish.com':         '/cart',
  'overstock.com':    '/cart',
  'dell.com':         '/cart',
  'samsung.com':      '/cart',
  'bathandbodyworks.com': '/cart',
  'victoriassecret.com':  '/bag',
  'booking.com':      '/myreservations',
  'expedia.com':      '/trips',
  'doordash.com':     '/cart',
  'ubereats.com':     '/cart',
  'grubhub.com':      '/cart',
  'dominos.com':      '/pages/order/',
  'pizzahut.com':     '/order',
  'starbucks.com':    '/menu',
  'canadiantire.ca':  '/en/my-cart',
  'londondrugs.com':  '/cart',
  'realcanadiansuperstore.ca': '/cart',
  'sportchek.ca':     '/cart',
  'marks.com':        '/cart',
};

/**
 * Get the checkout/cart URL for a detected brand
 * @param {string} domain - The detected website domain
 * @param {string} brand - The detected brand name
 * @param {string} baseUrl - The base website URL
 * @returns {{ checkoutUrl: string|null, source: string }}
 */
function getCheckoutUrl(domain, brand, baseUrl) {
  // Normalize domain
  const cleanDomain = (domain || '').replace(/^www\./, '').toLowerCase();

  // Direct match in known paths
  if (CHECKOUT_PATHS[cleanDomain]) {
    const base = baseUrl || (cleanDomain.startsWith('http') ? cleanDomain : `https://www.${cleanDomain}`);
    return {
      checkoutUrl: `${base.replace(/\/$/, '')}${CHECKOUT_PATHS[cleanDomain]}`,
      source: 'known_store'
    };
  }

  // Partial match (e.g., "amazon" matches "amazon.com")
  for (const [storeDomain, path] of Object.entries(CHECKOUT_PATHS)) {
    if (cleanDomain.includes(storeDomain.split('.')[0]) || (brand && storeDomain.includes(brand.toLowerCase().replace(/\s+/g, '')))) {
      const base = `https://www.${storeDomain}`;
      return { checkoutUrl: `${base}${path}`, source: 'known_store' };
    }
  }

  // Generic fallback — most Shopify/WooCommerce/standard stores use /cart or /checkout
  if (domain) {
    const base = baseUrl || `https://www.${cleanDomain}`;
    return { checkoutUrl: `${base.replace(/\/$/, '')}/cart`, source: 'generic_cart' };
  }

  return { checkoutUrl: null, source: 'none' };
}

// ========================================================
// DIRECT-TO-PRODUCT URL BUILDER
// Finds the exact product page on the store's website
// ========================================================

// Known store search URL patterns
const STORE_SEARCH_PATTERNS = {
  'amazon.com':       (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`,
  'amazon.ca':        (q) => `https://www.amazon.ca/s?k=${encodeURIComponent(q)}`,
  'amazon.co.uk':     (q) => `https://www.amazon.co.uk/s?k=${encodeURIComponent(q)}`,
  'walmart.com':      (q) => `https://www.walmart.com/search?q=${encodeURIComponent(q)}`,
  'target.com':       (q) => `https://www.target.com/s?searchTerm=${encodeURIComponent(q)}`,
  'bestbuy.com':      (q) => `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(q)}`,
  'ebay.com':         (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}`,
  'etsy.com':         (q) => `https://www.etsy.com/search?q=${encodeURIComponent(q)}`,
  'nike.com':         (q) => `https://www.nike.com/w?q=${encodeURIComponent(q)}`,
  'adidas.com':       (q) => `https://www.adidas.com/us/search?q=${encodeURIComponent(q)}`,
  'costco.com':       (q) => `https://www.costco.com/CatalogSearch?keyword=${encodeURIComponent(q)}`,
  'homedepot.com':    (q) => `https://www.homedepot.com/s/${encodeURIComponent(q)}`,
  'lowes.com':        (q) => `https://www.lowes.com/search?searchTerm=${encodeURIComponent(q)}`,
  'macys.com':        (q) => `https://www.macys.com/shop/featured/${encodeURIComponent(q)}`,
  'nordstrom.com':    (q) => `https://www.nordstrom.com/sr?keyword=${encodeURIComponent(q)}`,
  'sephora.com':      (q) => `https://www.sephora.com/search?keyword=${encodeURIComponent(q)}`,
  'wayfair.com':      (q) => `https://www.wayfair.com/keyword.html?keyword=${encodeURIComponent(q)}`,
  'ikea.com':         (q) => `https://www.ikea.com/us/en/search/?q=${encodeURIComponent(q)}`,
  'newegg.com':       (q) => `https://www.newegg.com/p/pl?d=${encodeURIComponent(q)}`,
  'shein.com':        (q) => `https://www.shein.com/pdsearch/${encodeURIComponent(q)}/`,
  'canadiantire.ca':  (q) => `https://www.canadiantire.ca/en/search-results.html?q=${encodeURIComponent(q)}`,
  'staples.com':      (q) => `https://www.staples.com/search?query=${encodeURIComponent(q)}`,
  'dell.com':         (q) => `https://www.dell.com/en-us/search/${encodeURIComponent(q)}`,
  'samsung.com':      (q) => `https://www.samsung.com/us/search/searchMain?searchTerm=${encodeURIComponent(q)}`,
  'apple.com':        (q) => `https://www.apple.com/shop/buy-mac?fh=${encodeURIComponent(q)}`,
};

// URL patterns that indicate a direct product page (not search results)
const PRODUCT_PAGE_INDICATORS = [
  '/dp/', '/ip/', '/product/', '/pdp/', '/p/', '/item/',
  '/listing/', '/buy/', '/shop/product', '/products/',
  '.html', '.htm', '/sku/', '/model/',
  '/t/', '/gp/', '/itm/', '/offer/', '/deal/',
  '-pid-', '/pid/', '/sku-', '/style/',
  '/en/pdp/', '/fr/pdp/'
];

// URL patterns that indicate a search/listing page (less desirable)
const SEARCH_PAGE_INDICATORS = [
  '/search', '/s?', 'searchTerm=', '?q=', '?k=', '?keyword=',
  '/browse/', '/category/', '/catalog/', 'query='
];

// URL patterns that indicate non-buyable pages (support, docs, specs)
const NON_BUYABLE_INDICATORS = [
  'support.', '/support/', '/help/', '/faq/', '/docs/', '/documentation/',
  '/specs/', '/specifications/', '/manual/', '/troubleshoot/', '/drivers/',
  '/downloads/', '/community/', '/forum/', '/blog/', '/article/', '/wiki/',
  '/about/', '/careers/', 'aerospace.', '/press/', '/newsroom/'
];

// Major retailers to search when brand site doesn't have buyable pages
const RETAILER_DOMAINS = [
  'amazon.com', 'walmart.com', 'bestbuy.com', 'target.com', 'ebay.com',
  'amazon.ca', 'canadiantire.ca', 'costco.com', 'homedepot.com', 'newegg.com'
];

const DIRECT_PRODUCT_SOURCES = new Set([
  'serp_exact_product', 'serp_store_product', 'serp_loose_product',
  'serp_loose_store', 'serp_broad_exact', 'serp_broad_store',
  'serp_broad_product', 'google_shopping_exact', 'google_shopping',
  'retailer_product', 'retailer_page'
]);

/**
 * Check if a URL is a buyable product page (not support/docs/info)
 */
function isBuyablePage(url) {
  const lower = (url || '').toLowerCase();
  return !NON_BUYABLE_INDICATORS.some(p => lower.includes(p));
}

/**
 * Check if a URL looks like a direct product page (vs search results)
 */
function isDirectProductPage(url) {
  const lower = (url || '').toLowerCase();
  const hasProductIndicator = PRODUCT_PAGE_INDICATORS.some(p => lower.includes(p));
  const hasSearchIndicator = SEARCH_PAGE_INDICATORS.some(p => lower.includes(p));
  return hasProductIndicator && !hasSearchIndicator;
}

function getHostname(url) {
  try {
    return new URL(enforceHttps(url)).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isDirectProductMatch(productUrl, productSource) {
  if (!productUrl || !isBuyablePage(productUrl)) return false;
  return isDirectProductPage(productUrl) || DIRECT_PRODUCT_SOURCES.has(productSource);
}

function pushSimilarProduct(similarProducts, seenLinks, item) {
  if (!item?.link) return;
  const link = enforceHttps(item.link);
  if (!link || seenLinks.has(link) || !isBuyablePage(link)) return;

  similarProducts.push({
    title: item.title || 'Similar product',
    url: link,
    price: item.price || null,
    source: item.source || null,
    snippet: item.snippet || null
  });
  seenLinks.add(link);
}

async function findSimilarProducts(promoDetails, excludeUrl = null) {
  const serpKey = process.env.SERP_API_KEY || process.env.SERPAPI_KEY;
  const searchQuery = promoDetails.productSearchQuery || promoDetails.products?.[0] || null;
  const brand = promoDetails.brand || '';
  const similarProducts = [];
  const seenLinks = new Set();

  if (excludeUrl) {
    seenLinks.add(enforceHttps(excludeUrl));
  }

  if (!serpKey || !searchQuery) {
    return [];
  }

  try {
    const shoppingQuery = `${searchQuery}${brand ? ` ${brand}` : ''}`.trim();
    const shoppingUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(shoppingQuery)}&api_key=${serpKey}&tbm=shop&num=6`;
    const shoppingRes = await fetch(shoppingUrl);
    if (shoppingRes.ok) {
      const shoppingData = await shoppingRes.json();
      for (const item of (shoppingData.shopping_results || [])) {
        if (!item.link) continue;
        const merchant = item.source || getHostname(item.link) || 'Retailer';
        pushSimilarProduct(similarProducts, seenLinks, {
          title: item.title,
          link: item.link,
          price: item.price,
          source: merchant,
          snippet: item.snippet || 'Similar product found from shopping results'
        });
        if (similarProducts.length >= 4) return similarProducts;
      }
    }
  } catch (e) {
    console.log('  Similar products shopping search failed:', e.message);
  }

  try {
    const organicQuery = `${searchQuery}${brand ? ` ${brand}` : ''} buy`;
    const organicUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(organicQuery)}&api_key=${serpKey}&num=10`;
    const organicRes = await fetch(organicUrl);
    if (organicRes.ok) {
      const organicData = await organicRes.json();
      for (const item of (organicData.organic_results || [])) {
        if (!item.link) continue;
        const lowerLink = item.link.toLowerCase();
        const isRetailer = RETAILER_DOMAINS.some(domain => lowerLink.includes(domain));
        if (!isRetailer || !isDirectProductPage(item.link)) continue;
        pushSimilarProduct(similarProducts, seenLinks, {
          title: item.title,
          link: item.link,
          source: getHostname(item.link) || 'Retailer',
          snippet: item.snippet || 'Similar product found from search results'
        });
        if (similarProducts.length >= 4) return similarProducts;
      }
    }
  } catch (e) {
    console.log('  Similar products organic search failed:', e.message);
  }

  return similarProducts;
}

/**
 * Deep validate a product page URL — checks both HTTP status AND response body
 * Catches soft 404s where servers return 200 but the page says "not found"
 * Also catches client-side JS redirects to 404 pages
 */
async function deepValidateProductUrl(url) {
  try {
    const normalizedUrl = enforceHttps(url.startsWith('http') ? url : `https://${url}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(normalizedUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    clearTimeout(timeout);

    // Check HTTP status
    if (res.status >= 400) return false;

    // Check final URL for soft 404 redirect
    const finalUrl = res.url || normalizedUrl;
    if (isSoft404(finalUrl)) {
      console.log(`  ⚠️ Soft 404 (redirect): ${normalizedUrl} → ${finalUrl}`);
      return false;
    }

    // Read first 5KB of body to check for 404 indicators in the HTML
    const body = await res.text();
    const sample = body.substring(0, 5000).toLowerCase();
    const soft404Phrases = [
      'page you\'re looking for could not be found',
      'page not found', 'page cannot be found',
      'product not found', 'item not found',
      'this page doesn\'t exist', 'this page does not exist',
      'no longer available', 'has been removed',
      'we couldn\'t find', 'we could not find',
      '404 error', 'error 404', '/errors/404',
      'sorry, we can\'t find', 'oops! we can',
      'the item you are looking for'
    ];
    for (const phrase of soft404Phrases) {
      if (sample.includes(phrase)) {
        console.log(`  ⚠️ Soft 404 (body): "${phrase}" found at ${normalizedUrl}`);
        return false;
      }
    }

    // Check if the page title contains 404
    const titleMatch = sample.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) {
      const title = titleMatch[1].toLowerCase();
      if (title.includes('404') || title.includes('not found') || title.includes('error')) {
        console.log(`  ⚠️ Soft 404 (title): "${titleMatch[1]}" at ${normalizedUrl}`);
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Build the best possible product checkout URL
 * Priority: SERP exact product > AI exact (deep-validated) > AI search URL > store search > generic
 */
async function buildProductCheckoutUrl(promoDetails) {
  const { brand, domain, products, productSearchQuery, productSearchUrl, officialPromoUrl, exactProductUrl } = promoDetails;
  const searchQuery = productSearchQuery || (products && products.length > 0 ? products[0] : null);
  const cleanDomain = (domain || '').replace(/^www\./, '').toLowerCase();

  // 1. Deep SERP search FIRST — look for the REAL product page (most reliable)
  const serpKey = process.env.SERP_API_KEY || process.env.SERPAPI_KEY;
  if (serpKey && searchQuery && domain) {
    try {
      // 1a. Exact phrase match on store's domain
      const exactQuery = `site:${cleanDomain} "${searchQuery}"`;
      const serpUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(exactQuery)}&api_key=${serpKey}&num=10`;
      console.log(`  🔍 SERP exact search: "${exactQuery}"`);
      const serpRes = await fetch(serpUrl);
      if (serpRes.ok) {
        const serpData = await serpRes.json();
        const results = serpData.organic_results || [];

        // First pass: find a direct product page URL (must be buyable)
        for (const r of results) {
          if (!r.link) continue;
          if (isDirectProductPage(r.link) && isBuyablePage(r.link)) {
            console.log(`  🎯 SERP found exact product page: ${r.link}`);
            return { productUrl: r.link, source: 'serp_exact_product' };
          }
        }

        // Second pass: find any buyable result from the store (but NOT a search results page)
        for (const r of results) {
          if (!r.link) continue;
          if (r.link.includes(cleanDomain) && isBuyablePage(r.link) && !SEARCH_PAGE_INDICATORS.some(p => r.link.toLowerCase().includes(p))) {
            console.log(`  🛒 SERP found store page: ${r.link}`);
            return { productUrl: r.link, source: 'serp_store_product' };
          }
        }
      }
    } catch (e) {
      console.log('  SERP exact search failed:', e.message);
    }

    // 1b. Looser SERP search — without quotes (product name may not appear verbatim)
    try {
      const looseQuery = `site:${cleanDomain} ${searchQuery}`;
      const serpUrl2 = `https://serpapi.com/search.json?q=${encodeURIComponent(looseQuery)}&api_key=${serpKey}&num=10`;
      console.log(`  🔍 SERP loose search: "${looseQuery}"`);
      const serpRes2 = await fetch(serpUrl2);
      if (serpRes2.ok) {
        const serpData2 = await serpRes2.json();
        const results2 = serpData2.organic_results || [];

        for (const r of results2) {
          if (!r.link) continue;
          if (isDirectProductPage(r.link)) {
            console.log(`  🎯 SERP loose found product page: ${r.link}`);
            return { productUrl: r.link, source: 'serp_loose_product' };
          }
        }

        // Accept any non-search page from the store
        for (const r of results2) {
          if (!r.link) continue;
          if (r.link.includes(cleanDomain) && !SEARCH_PAGE_INDICATORS.some(p => r.link.toLowerCase().includes(p))) {
            console.log(`  🛒 SERP loose found store page: ${r.link}`);
            return { productUrl: r.link, source: 'serp_loose_store' };
          }
        }
      }
    } catch (e) {
      console.log('  SERP loose search failed:', e.message);
    }
  }

  // 2. Broad SERP search — product name + "buy" (without site: filter)
  if (serpKey && searchQuery) {
    try {
      const brandFilter = brand ? ` ${brand}` : '';
      const query = `${searchQuery}${brandFilter} buy ${cleanDomain || ''}`.trim();
      const serpUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${serpKey}&num=10`;
      console.log(`  🔍 Broad SERP product search: "${query}"`);
      const serpRes = await fetch(serpUrl);
      if (serpRes.ok) {
        const serpData = await serpRes.json();
        const results = serpData.organic_results || [];

        // Prefer product pages on the detected store's domain
        if (domain) {
          for (const r of results) {
            if (!r.link) continue;
            if (r.link.includes(cleanDomain) && isDirectProductPage(r.link)) {
              console.log(`  🎯 SERP broad found exact product on store: ${r.link}`);
              return { productUrl: r.link, source: 'serp_broad_exact' };
            }
          }
          // Accept any non-search result from the store
          const storeResult = results.find(r => r.link && r.link.includes(cleanDomain) && !SEARCH_PAGE_INDICATORS.some(p => r.link.toLowerCase().includes(p)));
          if (storeResult) {
            console.log(`  🛒 SERP broad found store result: ${storeResult.link}`);
            return { productUrl: storeResult.link, source: 'serp_broad_store' };
          }
        }

        // Accept any product page from any retailer
        for (const r of results) {
          if (!r.link) continue;
          if (isDirectProductPage(r.link)) {
            console.log(`  🛒 SERP broad found product page: ${r.link}`);
            return { productUrl: r.link, source: 'serp_broad_product' };
          }
        }
      }
    } catch (e) {
      console.log('  SERP broad search failed:', e.message);
    }

    // Also try Google Shopping results
    try {
      const shopQuery = `${searchQuery}${brand ? ' ' + brand : ''}`;
      const shopUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(shopQuery)}&api_key=${serpKey}&tbm=shop&num=5`;
      console.log(`  🛍️ Google Shopping search: "${shopQuery}"`);
      const shopRes = await fetch(shopUrl);
      if (shopRes.ok) {
        const shopData = await shopRes.json();
        const shopResults = shopData.shopping_results || [];
        // Find shopping result from the same store
        for (const r of shopResults) {
          if (!r.link) continue;
          if (domain && r.link.includes(cleanDomain)) {
            console.log(`  🎯 Google Shopping found product on store: ${r.link}`);
            return { productUrl: r.link, source: 'google_shopping_exact' };
          }
        }
        // Take first shopping result with a link
        if (shopResults.length > 0 && shopResults[0].link) {
          console.log(`  🛍️ Google Shopping result: ${shopResults[0].link}`);
          return { productUrl: shopResults[0].link, source: 'google_shopping' };
        }
      }
    } catch (e) {
      console.log('  Google Shopping search failed:', e.message);
    }

    // 2b. Retailer SERP search — find buyable product page on Amazon/Walmart/BestBuy etc.
    if (searchQuery) {
      try {
        const retailerQuery = `${searchQuery}${brand ? ' ' + brand : ''} buy`;
        const retailerUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(retailerQuery)}&api_key=${serpKey}&num=15`;
        console.log(`  🏪 Retailer SERP search: "${retailerQuery}"`);
        const retailerRes = await fetch(retailerUrl);
        if (retailerRes.ok) {
          const retailerData = await retailerRes.json();
          const retailerResults = retailerData.organic_results || [];
          // Find a direct product page on a major retailer
          for (const r of retailerResults) {
            if (!r.link) continue;
            const link = r.link.toLowerCase();
            const isRetailer = RETAILER_DOMAINS.some(d => link.includes(d));
            if (isRetailer && isDirectProductPage(r.link) && isBuyablePage(r.link)) {
              console.log(`  🎯 Retailer product page found: ${r.link}`);
              return { productUrl: r.link, source: 'retailer_product' };
            }
          }
          // Accept any retailer page that's not a search page
          for (const r of retailerResults) {
            if (!r.link) continue;
            const link = r.link.toLowerCase();
            const isRetailer = RETAILER_DOMAINS.some(d => link.includes(d));
            if (isRetailer && isBuyablePage(r.link) && !SEARCH_PAGE_INDICATORS.some(p => link.includes(p))) {
              console.log(`  🏪 Retailer page found: ${r.link}`);
              return { productUrl: r.link, source: 'retailer_page' };
            }
          }
        }
      } catch (e) {
        console.log('  Retailer SERP search failed:', e.message);
      }
    }
  }

  // 3. AI-fabricated exact product URLs are UNRELIABLE — skip
  if (exactProductUrl && exactProductUrl !== 'null') {
    console.log(`  ⚠️ Skipping AI-fabricated product URL (unreliable): ${exactProductUrl}`);
  }

  // 4. Same for AI officialPromoUrl — skip if it looks like a direct product page with a guessed ID
  if (officialPromoUrl && officialPromoUrl !== 'null' && isDirectProductPage(officialPromoUrl)) {
    console.log(`  ⚠️ Skipping AI promo URL (likely fabricated product ID): ${officialPromoUrl}`);
  }

  // 5. If AI provided a product search URL, use it as fallback
  if (productSearchUrl && productSearchUrl !== 'null') {
    const isValid = await validateUrl(productSearchUrl);
    if (isValid) {
      console.log(`  🛒 Using AI product search URL: ${productSearchUrl}`);
      return { productUrl: productSearchUrl, source: 'ai_product_search' };
    }
  }

  // 6. If AI provided an officialPromoUrl (even if it's a search page), use it
  if (officialPromoUrl && officialPromoUrl !== 'null') {
    const isValid = await validateUrl(officialPromoUrl);
    if (isValid) {
      console.log(`  🛒 Using AI promo URL: ${officialPromoUrl}`);
      return { productUrl: officialPromoUrl, source: 'ai_promo_url' };
    }
  }

  // 7. Use known store search pattern with the product query (search results page)
  if (searchQuery && cleanDomain) {
    if (STORE_SEARCH_PATTERNS[cleanDomain]) {
      const storeSearchUrl = STORE_SEARCH_PATTERNS[cleanDomain](searchQuery);
      console.log(`  🛒 Store search URL: ${storeSearchUrl}`);
      return { productUrl: storeSearchUrl, source: 'store_product_search' };
    }
    for (const [storeDomain, buildUrl] of Object.entries(STORE_SEARCH_PATTERNS)) {
      if (cleanDomain.includes(storeDomain.split('.')[0])) {
        const storeSearchUrl = buildUrl(searchQuery);
        console.log(`  🛒 Store search URL (partial match): ${storeSearchUrl}`);
        return { productUrl: storeSearchUrl, source: 'store_product_search' };
      }
    }
  }

  // 8. Build a generic search URL for the store
  if (searchQuery && domain) {
    const base = `https://www.${cleanDomain}`;
    const genericSearch = `${base}/search?q=${encodeURIComponent(searchQuery)}`;
    return { productUrl: genericSearch, source: 'generic_store_search' };
  }

  // 9. Fall back to Google Shopping search URL
  if (searchQuery) {
    const googleShopUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery + (brand ? ' ' + brand : ''))}&tbm=shop`;
    return { productUrl: googleShopUrl, source: 'google_shopping_fallback' };
  }

  return { productUrl: null, source: 'none' };
}

/**
 * Extract readable ASCII strings from raw image bytes (no API needed)
 * PNG images contain text in iTXt/tEXt/zTXt chunks, JPEG in EXIF/XMP
 * Also finds any embedded URLs, brand names, coupon codes in the byte stream
 */
function extractReadableASCII(base64Image) {
  try {
    const buffer = Buffer.from(base64Image, 'base64');
    const str = buffer.toString('latin1');
    // Extract runs of printable ASCII (4+ chars)
    const runs = str.match(/[\x20-\x7E]{4,}/g) || [];
    return runs.join(' ');
  } catch { return ''; }
}

/**
 * Local text extraction from image bytes — full promo detection without any AI API
 * Extracts brands, URLs, coupon codes, discount amounts from raw image data
 */
function extractTextFromImageBytes(base64Image) {
  const rawText = extractReadableASCII(base64Image);

  // Extract URLs from raw text
  const urlPattern = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+)(?:\/[^\s)\\<>"']*)?/gi;
  const visibleUrls = [];
  let urlMatch;
  while ((urlMatch = urlPattern.exec(rawText)) !== null) {
    const url = urlMatch[0];
    // Filter out common image-internal domains
    if (!url.includes('w3.org') && !url.includes('adobe.com') && !url.includes('ns.') &&
        !url.includes('schemas.') && !url.includes('purl.org') && !url.includes('xml')) {
      visibleUrls.push(url);
    }
  }

  // Extract domain from first real URL
  let domain = null;
  if (visibleUrls.length > 0) {
    try {
      const fullUrl = visibleUrls[0].startsWith('http') ? visibleUrls[0] : `https://${visibleUrls[0]}`;
      domain = new URL(fullUrl).hostname.replace(/^www\./, '');
    } catch { domain = visibleUrls[0].replace(/^(?:https?:\/\/)?(?:www\.)?/, '').split('/')[0]; }
  }

  // Known brand patterns — look for popular brands in the raw text
  const knownBrands = [
    'Amazon', 'Nike', 'Adidas', 'Walmart', 'Target', 'BestBuy', 'Best Buy',
    'Apple', 'Samsung', 'Google', 'Microsoft', 'eBay', 'Etsy', 'Shopify',
    'Uber', 'DoorDash', 'Grubhub', 'Starbucks', 'McDonalds', 'Dominos',
    'Netflix', 'Spotify', 'Disney', 'HBO', 'Hulu', 'YouTube',
    'Sephora', 'Ulta', 'Bath Body', 'Victoria Secret', 'Old Navy', 'Gap',
    'H&M', 'Zara', 'Shein', 'ASOS', 'Nordstrom', 'Macys', 'JCPenney',
    'Home Depot', 'Lowes', 'IKEA', 'Wayfair', 'Costco', 'Kroger',
    'Booking', 'Expedia', 'Airbnb', 'Hotels', 'Kayak', 'Priceline',
    'GoDaddy', 'Bluehost', 'Namecheap', 'HostGator', 'Squarespace', 'Wix',
    'Canva', 'Figma', 'Adobe', 'Notion', 'Slack', 'Zoom', 'Dropbox',
    'Pizza Hut', 'Burger King', 'Wendy', 'Taco Bell', 'Chick-fil-A',
    'Coursera', 'Udemy', 'LinkedIn', 'Skillshare',
    'FedEx', 'UPS', 'USPS', 'DHL', 'CVS', 'Walgreens', 'Rite Aid',
    'AutoZone', 'OReilly', 'Advance Auto', 'Pep Boys',
    'Chewy', 'Petco', 'PetSmart', 'REI', 'Dicks Sporting',
    'GameStop', 'Steam', 'Epic Games', 'PlayStation', 'Xbox',
    // Canadian stores
    'Canadian Tire', 'Canadiantire', 'Canada Store', 'Sobeys', 'Loblaw',
    'Shoppers Drug Mart', 'Real Canadian', 'No Frills', 'Loblaws',
    'London Drugs', 'Giant Tiger', 'Dollarama', 'Winners', 'HomeSense',
    'Rona', 'Marks', 'Sport Chek', 'Atmosphere', 'Panasonic'
  ];

  const rawTextLower = rawText.toLowerCase();
  let brand = null;
  for (const b of knownBrands) {
    if (rawTextLower.includes(b.toLowerCase())) {
      brand = b;
      break;
    }
  }

  // If no brand found, try domain-based detection
  if (!brand && domain) {
    brand = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
  }

  // Do NOT extract coupon codes from raw image bytes — they are ALWAYS garbage
  // (random byte sequences like AQA2QT, 3SETURS, MNTRRGB that look like codes but aren't)
  // Real coupon extraction only works via AI vision or Google Vision text detection
  const coupons = [];

  // Extract discount amounts
  const discountMatch = rawText.match(/(\d{1,3})\s*%\s*(?:off|discount|save)/i) ||
                        rawText.match(/(?:save|off|discount)\s*(\d{1,3})\s*%/i) ||
                        rawText.match(/\$\s*(\d+(?:\.\d{2})?)\s*(?:off|discount|save)/i);
  const discount = discountMatch ? discountMatch[0].trim() : null;

  // Extract promo title — look for short phrases near discount/promo keywords
  let promoTitle = null;
  const titleMatch = rawText.match(/(?:^|\n)([A-Z][A-Za-z0-9 ]{5,60})(?:\n|$)/m);
  if (titleMatch) promoTitle = titleMatch[1].trim();

  return {
    brand, domain, visibleUrls, coupons, discount, promoTitle,
    products: [],
    rawText: rawText.substring(0, 500)
  };
}

/**
 * Full Google Lens-like promo detection pipeline
 * 1. AI analyzes screenshot for brand/URL/promo details
 * 2. Google Vision fallback for text/URL extraction
 * 3. SERP API search to find official promotion URL
 * 4. Returns redirect URL + full promo metadata
 */
export async function detectPromoAndFindUrl(base64Image, options = {}) {
  const {
    openaiKey = process.env.OPENAI_API_KEY,
    googleKey = process.env.GOOGLE_VISION_API_KEY
  } = options;

  console.log('🔎 Google Lens-like promo detection starting...');

  let promoDetails = null;

  // Step 1: Try OpenAI Vision for full promo/product analysis
  let openaiError = null;
  if (openaiKey) {
    console.log('  → OpenAI promo/product analysis...');
    promoDetails = await extractPromoDetailsWithOpenAI(base64Image, openaiKey);
    if (promoDetails.success && (promoDetails.hasPromotion || (promoDetails.products && promoDetails.products.length > 0) || promoDetails.brand)) {
      const imageType = promoDetails.imageType || (promoDetails.hasPromotion ? 'promo' : 'product_photo');
      console.log(`  ✓ Detected [${imageType}] brand: ${promoDetails.brand}, domain: ${promoDetails.domain}, products: ${(promoDetails.products || []).join(', ')}`);
      // For product photos without a promo, mark hasPromotion true so the pipeline continues
      // (the pipeline uses hasPromotion as a "did we detect anything useful" flag)
      if (!promoDetails.hasPromotion && (promoDetails.products?.length > 0 || promoDetails.brand)) {
        promoDetails.hasPromotion = true;
        promoDetails.isProductPhoto = true;
      }
    } else if (!promoDetails.success) {
      openaiError = promoDetails.error || 'unknown';
    }
  }

  // Step 2: If OpenAI didn't find anything useful, try Google Vision for text extraction
  if ((!promoDetails || !promoDetails.success || (!promoDetails.hasPromotion && !promoDetails.brand && (!promoDetails.products || promoDetails.products.length === 0))) && googleKey) {
    console.log('  → Google Vision text extraction fallback...');
    const gvResult = await extractWithGoogleVision(base64Image, googleKey);
    if (gvResult.success && gvResult.rawText) {
      const textDetails = extractPromoDetailsFromText(gvResult.rawText);
      const textCoupons = gvResult.coupons || [];
      promoDetails = {
        success: true,
        provider: 'google_vision_promo',
        brand: textDetails.brand,
        domain: textDetails.domain,
        websiteUrl: textDetails.domain ? `https://www.${textDetails.domain}` : null,
        officialPromoUrl: null,
        promotionTitle: null,
        promotionDescription: gvResult.rawText.substring(0, 200),
        products: textDetails.products,
        coupons: textCoupons,
        visibleUrls: textDetails.visibleUrls,
        hasPromotion: textDetails.brand !== null || textDetails.visibleUrls.length > 0,
        confidence: 'medium'
      };
    }
  }

  // Step 2b: Local fallback — extract readable text from raw image bytes (no API needed)
  if (!promoDetails || !promoDetails.success || !promoDetails.hasPromotion) {
    console.log('  → Local text-extraction fallback (no API keys)...');
    const localResult = extractTextFromImageBytes(base64Image);
    // Only trust local extraction if it found a recognized brand OR a real URL
    // Raw byte extraction is unreliable — don't claim success on weak signals
    const hasRealSignal = localResult.brand !== null || localResult.visibleUrls.length > 0;
    if (hasRealSignal) {
      promoDetails = {
        success: true,
        provider: 'local_extraction',
        brand: localResult.brand,
        domain: localResult.domain,
        websiteUrl: localResult.domain ? `https://www.${localResult.domain}` : null,
        officialPromoUrl: localResult.visibleUrls.length > 0
          ? (localResult.visibleUrls[0].startsWith('http') ? localResult.visibleUrls[0] : `https://${localResult.visibleUrls[0]}`)
          : null,
        promotionTitle: localResult.promoTitle || (localResult.brand ? `${localResult.brand} Promotion` : null),
        promotionDescription: localResult.rawText ? localResult.rawText.substring(0, 200) : null,
        products: localResult.products || [],
        coupons: [],  // Never trust coupon codes from raw byte extraction
        discountAmount: localResult.discount || null,
        visibleUrls: localResult.visibleUrls,
        hasPromotion: true,
        confidence: 'low'
      };
      console.log(`  ✓ Local extraction: brand=${localResult.brand}, urls=${localResult.visibleUrls.length}, coupons=${localResult.coupons.length}`);
    }
  }

  // Step 2c: Last resort — use SERP API to search for deals on any detected brand/domain
  if ((!promoDetails || !promoDetails.success || !promoDetails.hasPromotion)) {
    const serpKey = process.env.SERP_API_KEY || process.env.SERPAPI_KEY;
    if (serpKey) {
      console.log('  → SERP-only detection fallback...');
      // Try to extract any readable text from the decoded bytes for a search query
      const rawText = extractReadableASCII(base64Image);
      const words = rawText.split(/\s+/).filter(w => w.length > 3 && /^[A-Za-z]+$/.test(w));
      const uniqueWords = [...new Set(words)].slice(0, 5);
      if (uniqueWords.length > 0) {
        const searchQuery = uniqueWords.join(' ') + ' coupon deal promo';
        try {
          const serpUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(searchQuery)}&api_key=${serpKey}&num=3`;
          const serpRes = await fetch(serpUrl);
          if (serpRes.ok) {
            const serpData = await serpRes.json();
            const firstResult = serpData.organic_results?.[0];
            if (firstResult) {
              const resultDomain = new URL(firstResult.link).hostname.replace('www.', '');
              promoDetails = {
                success: true,
                provider: 'serp_fallback',
                brand: uniqueWords[0].charAt(0).toUpperCase() + uniqueWords[0].slice(1),
                domain: resultDomain,
                websiteUrl: `https://${resultDomain}`,
                officialPromoUrl: firstResult.link,
                promotionTitle: firstResult.title || 'Promotion Found',
                promotionDescription: firstResult.snippet || null,
                products: [],
                coupons: [],
                visibleUrls: [firstResult.link],
                hasPromotion: true,
                confidence: 'low'
              };
              console.log(`  ✓ SERP fallback found: ${resultDomain}`);
            }
          }
        } catch (e) {
          console.log('  ✗ SERP fallback failed:', e.message);
        }
      }
    }
  }

  // Step 3: If still no result, return failure with specific reason
  if (!promoDetails || !promoDetails.success) {
    let errorMsg = 'Could not detect any product or promotion from the image.';
    if (openaiError && openaiError.includes('401')) {
      errorMsg = 'OpenAI API key is invalid or expired. Please update the API key.';
    } else if (openaiError && openaiError.includes('429')) {
      errorMsg = 'OpenAI rate limit reached. Please try again in a moment.';
    } else if (!openaiKey && !googleKey) {
      errorMsg = 'No AI API keys configured. Contact the administrator.';
    }
    return {
      success: false,
      error: errorMsg,
      redirectUrl: null,
      brand: null,
      promoDetails: null
    };
  }

  // Step 4: Validate and find working promo URL
  let redirectUrl = promoDetails.officialPromoUrl || null;
  let urlSource = 'ai_detected';

  // Validate the AI-guessed URL by checking if it actually exists (not 404)
  // Skip validation if it looks like a real domain URL — many sites have bot protection
  // that blocks server-side requests (403) but works fine in the browser
  if (redirectUrl && redirectUrl !== 'null') {
    console.log(`  → AI-detected URL: ${redirectUrl}`);
    redirectUrl = enforceHttps(redirectUrl);
  }

  if (!redirectUrl || redirectUrl === 'null') {
    console.log('  → Searching for official promo URL via SERP...');
    const searchResult = await searchForPromoUrl(
      promoDetails.brand,
      promoDetails.promotionTitle,
      promoDetails.domain
    );
    redirectUrl = enforceHttps(searchResult.url);
    urlSource = searchResult.source;
    console.log(`  ✓ Found URL: ${redirectUrl} (source: ${urlSource})`);

    // If SERP didn't find anything, fall back to brand homepage
    if (!redirectUrl && promoDetails.domain) {
      redirectUrl = `https://www.${promoDetails.domain.replace(/^www\./, '')}`;
      urlSource = 'brand_homepage';
    }
  }

  // Step 5: If we found a visible URL in the image, try that
  if (promoDetails.visibleUrls && promoDetails.visibleUrls.length > 0) {
    const firstVisible = promoDetails.visibleUrls[0];
    if (firstVisible.includes('.') && !redirectUrl) {
      const candidateUrl = firstVisible.startsWith('http') ? firstVisible : `https://${firstVisible}`;
      const isValid = await validateUrl(candidateUrl);
      if (isValid) {
        redirectUrl = candidateUrl;
        urlSource = 'visible_in_image';
      }
    }
  }

  // Step 6: Last resort — always construct a URL from brand/domain if we have it
  if (!redirectUrl && (promoDetails.brand || promoDetails.domain)) {
    if (promoDetails.domain) {
      redirectUrl = promoDetails.domain.startsWith('http')
        ? promoDetails.domain
        : `https://www.${promoDetails.domain}`;
    } else if (promoDetails.brand) {
      const cleanBrand = promoDetails.brand.toLowerCase().replace(/[^a-z0-9]/g, '');
      redirectUrl = `https://www.${cleanBrand}.com`;
    }
    urlSource = 'brand_homepage';
    console.log(`  → Constructed fallback URL: ${redirectUrl}`);
  }

  // Step 7: Build checkout URL for the detected store — deep-validate it (catches soft 404s)
  const websiteBase = promoDetails.websiteUrl || redirectUrl;
  let { checkoutUrl, source: checkoutSource } = getCheckoutUrl(
    promoDetails.domain, promoDetails.brand, websiteBase
  );
  if (checkoutUrl) {
    console.log(`  🛒 Checkout URL candidate: ${checkoutUrl} (${checkoutSource})`);
    // Deep-validate — reads HTML body to catch soft 404 pages
    const checkoutValid = await deepValidateProductUrl(checkoutUrl);
    if (!checkoutValid) {
      console.log(`  ⚠️ Checkout URL is soft 404, trying alternatives...`);
      const cleanDomain = (promoDetails.domain || '').replace(/^www\./, '').toLowerCase();
      const base = websiteBase || `https://www.${cleanDomain}`;
      const cartAlternatives = ['/cart', '/checkout', '/shopping-cart', '/basket', '/bag'];
      let foundCart = false;
      for (const alt of cartAlternatives) {
        const altUrl = `${base.replace(/\/$/, '')}${alt}`;
        const altValid = await deepValidateProductUrl(altUrl);
        if (altValid) {
          checkoutUrl = altUrl;
          checkoutSource = 'validated_alternative';
          console.log(`  ✅ Found working cart URL: ${altUrl}`);
          foundCart = true;
          break;
        }
      }
      if (!foundCart) {
        // No cart URL works — set to null so popup doesn't show a broken button
        console.log(`  ✗ No working cart URL found, disabling checkout button`);
        checkoutUrl = null;
        checkoutSource = 'none';
      }
    }
  }

  // Step 8: Build a direct-to-product URL using detected product info
  console.log('  → Building product-specific checkout URL...');
  const { productUrl, source: productSource } = await buildProductCheckoutUrl(promoDetails);
  if (productUrl) {
    console.log(`  🛒 Product URL: ${productUrl} (${productSource})`);
  }

  const hasDirectProductMatch = isDirectProductMatch(productUrl, productSource);
  let similarProducts = [];
  if (!hasDirectProductMatch) {
    console.log('  → No direct product match, finding similar products...');
    similarProducts = await findSimilarProducts(promoDetails, productUrl || redirectUrl || null);
    if (similarProducts.length > 0) {
      console.log(`  🧩 Found ${similarProducts.length} similar product options`);
    }
  }

  // Enforce HTTPS on all URLs before returning
  return {
    success: true,
    redirectUrl: enforceHttps(redirectUrl),
    checkoutUrl: enforceHttps(checkoutUrl),
    checkoutSource,
    productUrl: enforceHttps(productUrl) || null,
    productSource: productSource || 'none',
    hasDirectProductMatch,
    similarProducts,
    urlSource,
    brand: promoDetails.brand,
    domain: promoDetails.domain,
    websiteUrl: promoDetails.websiteUrl,
    promotionTitle: promoDetails.promotionTitle,
    promotionDescription: promoDetails.promotionDescription,
    products: promoDetails.products || [],
    coupons: promoDetails.coupons || [],
    discountAmount: promoDetails.discountAmount || null,
    expiryDate: promoDetails.expiryDate || null,
    promoType: promoDetails.promoType || null,
    imageType: promoDetails.imageType || (promoDetails.isProductPhoto ? 'product_photo' : 'promo'),
    isProductPhoto: promoDetails.isProductPhoto || false,
    productPrice: promoDetails.productPrice || null,
    productCategory: promoDetails.productCategory || null,
    productSearchQuery: promoDetails.productSearchQuery || null,
    visibleUrls: promoDetails.visibleUrls || [],
    confidence: promoDetails.confidence || 'medium',
    provider: promoDetails.provider
  };
}

/**
 * Extract coupons using Google Cloud Vision API
 */
async function extractWithGoogleVision(base64Image, apiKey) {
  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64Image },
            features: [
              { type: 'TEXT_DETECTION', maxResults: 50 },
              { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }
            ]
          }]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Google Vision API error: ${response.status}`);
    }

    const data = await response.json();
    const textAnnotations = data.responses?.[0]?.textAnnotations || [];
    const fullText = textAnnotations[0]?.description || '';

    // Extract coupons from detected text
    const coupons = extractCouponsFromText(fullText);
    
    return {
      success: true,
      provider: 'google_vision',
      coupons,
      hasText: fullText.length > 0,
      rawText: fullText.substring(0, 500)
    };
  } catch (error) {
    console.error('Google Vision extraction failed:', error.message);
    return { success: false, error: error.message, provider: 'google_vision' };
  }
}

/**
 * Extract coupons from text using pattern matching (fallback)
 */
function extractCouponsFromText(text) {
  if (!text) return [];
  
  const foundCodes = new Set();
  const coupons = [];
  
  // Normalize text
  const normalizedText = text.toUpperCase();
  
  // Check if text contains coupon-related keywords
  const hasCouponContext = COUPON_KEYWORDS.some(keyword => 
    normalizedText.includes(keyword.toUpperCase())
  );
  
  // Extract codes using patterns
  for (const pattern of COUPON_PATTERNS) {
    const matches = text.matchAll(new RegExp(pattern));
    for (const match of matches) {
      const code = match[1] || match[0];
      const upperCode = code.toUpperCase();
      
      // Filter out common false positives
      if (
        code.length >= 4 &&
        code.length <= 20 &&
        !foundCodes.has(upperCode) &&
        !isCommonWord(upperCode) &&
        !isDateOrNumber(code) &&
        !isImageMetadata(upperCode)
      ) {
        foundCodes.add(upperCode);
        
        // Try to find description near the code
        const description = findDescriptionNearCode(text, code);
        
        coupons.push({
          code: code.toUpperCase(),
          description: description || 'Discount code',
          confidence: hasCouponContext ? 'medium' : 'low',
          expiry: null
        });
      }
    }
  }
  
  return coupons;
}

/**
 * Check if string is a common word (false positive)
 */
function isCommonWord(str) {
  const commonWords = [
    'FREE', 'SAVE', 'SALE', 'SHOP', 'VIEW', 'MORE', 'CART', 'SIGN', 'LOGIN',
    'HOME', 'MENU', 'HELP', 'BACK', 'NEXT', 'DONE', 'OKAY', 'CLOSE', 'OPEN',
    'ITEM', 'ITEMS', 'TOTAL', 'ORDER', 'CHECK', 'YOUR', 'APPLY', 'ENTER',
    'EMAIL', 'NAME', 'PHONE', 'DATE', 'TIME', 'YEAR', 'MONTH', 'NULL', 'TRUE',
    // JPEG / EXIF / ICC color profile metadata strings (appear in raw image bytes)
    'JFIF', 'EXIF', 'MNTRRGB', 'ACSP', 'DESC', 'RXYZ', 'GXYZ', 'BXYZ', 'WTPT',
    'RTRC', 'GTRC', 'BTRC', 'CPRT', 'CHAD', 'CHRM', 'DMND', 'DMDD', 'TECH',
    'VCGT', 'VUED', 'VIEW', 'LUMI', 'MEAS', 'BKPT', 'KTRG', 'AABG', 'AAGG',
    'PARA', 'CURV', 'MLUC', 'TEXT', 'DATA', 'DICT', 'CLRT', 'NCOL', 'MMOD',
    'NDIN', 'PSID', 'VCID',
    'SRGB', 'ADOBERGB', 'ICCPROFILE', 'MLAB', 'XLYZ',
    // PNG chunks
    'IHDR', 'PLTE', 'IDAT', 'IEND', 'TRNS', 'GAMA', 'CHRM', 'SBIT', 'SRGB',
    'ICCP', 'PHYS', 'TEXT', 'ZTXT', 'ITXT', 'BKGD', 'HIST', 'SPLT', 'TIME',
    // TIFF / misc binary headers
    'TIFF', 'WEBP', 'RIFF', 'ANIM', 'ANMF', 'VP8X', 'VP8L', 'ALPH',
    // HTML/XML/CSS false positives from image metadata
    'HTTP', 'HTML', 'BODY', 'HEAD', 'META', 'LINK', 'HREF', 'STYLE', 'CLASS',
    'XMLNS', 'XHTML', 'UTF8', 'LANG', 'TYPE', 'WIDTH', 'SIZE', 'LEFT', 'AUTO',
    'NONE', 'COLOR', 'FONT', 'BOLD', 'FROM', 'WITH', 'THAT', 'THIS', 'HAVE',
    'BEEN', 'WILL', 'THAN', 'WERE', 'THEY', 'EACH', 'WHICH', 'THEIR', 'SAID',
    'ABOUT', 'WOULD', 'MAKE', 'LIKE', 'JUST', 'OVER', 'SUCH', 'TAKE', 'ALSO',
    'SOME', 'COULD', 'THEM', 'ONLY', 'COME', 'MADE', 'FIND', 'LONG', 'LOOK',
    'MANY', 'THEN', 'WHAT', 'CALL', 'FIRST', 'WELL',
    // Common 4-letter non-coupon strings
    'CLICK', 'PRINT', 'SHARE', 'COPY', 'PASTE', 'LOAD', 'PAGE', 'FILE',
    'EDIT', 'UNDO', 'REDO', 'ZOOM', 'SEND', 'SORT', 'SHOW', 'HIDE'
  ];
  return commonWords.includes(str);
}

/**
 * Check if string looks like a date or plain number
 */
function isDateOrNumber(str) {
  // Pure numbers
  if (/^\d+$/.test(str)) return true;
  // Date patterns
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(str)) return true;
  // Time patterns
  if (/^\d{1,2}:\d{2}/.test(str)) return true;
  return false;
}

/**
 * Check if string looks like image/binary metadata (JPEG, PNG, ICC, EXIF headers)
 * These get extracted from raw image bytes and are NOT real coupon codes
 */
function isImageMetadata(str) {
  // Only pure letters with no digits are suspicious — real coupon codes almost always mix letters+digits
  // or are well-known keyword-based codes (SAVE10, FREESHIP, etc.)
  if (/^[A-Z]{4,6}$/.test(str)) {
    // Allow known real coupon patterns
    const knownPatterns = ['SAVE', 'FREE', 'DEAL', 'SALE', 'SHIP', 'BOGO'];
    if (knownPatterns.some(p => str.includes(p))) return false;
    // Likely image metadata — 4-6 letter all-caps without numbers
    return true;
  }
  return false;
}

/**
 * Find description text near a coupon code
 */
function findDescriptionNearCode(text, code) {
  const index = text.toUpperCase().indexOf(code.toUpperCase());
  if (index === -1) return null;
  
  // Get surrounding text (100 chars before and after)
  const start = Math.max(0, index - 100);
  const end = Math.min(text.length, index + code.length + 100);
  const surrounding = text.substring(start, end);
  
  // Look for discount amounts
  const discountMatch = surrounding.match(/(\d+%?\s*off|\$\d+\s*off|free shipping)/i);
  if (discountMatch) {
    return discountMatch[0];
  }
  
  return null;
}

/**
 * Main extraction function - tries multiple providers
 */
export async function extractCouponsFromScreenshot(base64Image, options = {}) {
  const {
    openaiKey = process.env.OPENAI_API_KEY,
    googleKey = process.env.GOOGLE_VISION_API_KEY,
    preferredProvider = 'openai'
  } = options;

  console.log('🔍 Starting coupon extraction from screenshot...');
  
  // Check if any API key is configured
  if (!openaiKey && !googleKey) {
    return {
      success: false,
      error: 'No AI API keys configured. Please add OPENAI_API_KEY or GOOGLE_VISION_API_KEY to your .env file.',
      coupons: [],
      provider: 'none'
    };
  }

  let result = null;
  
  // Try OpenAI first if available and preferred
  if (openaiKey && preferredProvider === 'openai') {
    console.log('  → Trying OpenAI Vision...');
    result = await extractWithOpenAI(base64Image, openaiKey);
    if (result.success) {
      if (result.coupons?.length > 0) {
        console.log(`  ✓ OpenAI found ${result.coupons.length} coupon(s)`);
      } else {
        console.log('  ✓ OpenAI analyzed image but found no coupons');
      }
      return result;
    }
  }
  
  // Try Google Vision if available
  if (googleKey) {
    console.log('  → Trying Google Cloud Vision...');
    result = await extractWithGoogleVision(base64Image, googleKey);
    if (result.success) {
      if (result.coupons?.length > 0) {
        console.log(`  ✓ Google Vision found ${result.coupons.length} coupon(s)`);
      } else {
        console.log('  ✓ Google Vision analyzed image but found no coupons');
      }
      return result;
    }
  }
  
  // Fallback to OpenAI if Google didn't work and OpenAI wasn't tried yet
  if (openaiKey && preferredProvider !== 'openai') {
    console.log('  → Falling back to OpenAI Vision...');
    result = await extractWithOpenAI(base64Image, openaiKey);
    if (result.success) {
      return result;
    }
  }
  
  // If no AI is available, return pattern-matching result if we got text
  if (result?.rawText) {
    return {
      success: true,
      provider: 'pattern_matching',
      coupons: result.coupons || [],
      hasText: true,
      warning: 'Using basic pattern matching only.'
    };
  }
  
  // All AI providers failed
  return {
    success: false,
    error: result?.error || 'AI extraction failed. Please try again.',
    coupons: [],
    provider: result?.provider || 'none'
  };
}

/**
 * Validate and process uploaded image
 */
export function processImageUpload(imageData) {
  // Handle data URL format
  if (imageData.startsWith('data:image')) {
    const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid image data URL format');
    }
    return {
      format: matches[1],
      base64: matches[2]
    };
  }
  
  // Assume raw base64
  return {
    format: 'unknown',
    base64: imageData
  };
}

export default {
  extractCouponsFromScreenshot,
  processImageUpload,
  extractCouponsFromText,
  detectPromoAndFindUrl
};
