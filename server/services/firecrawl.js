// Firecrawl integration — three use cases:
//   1. scrapeProductPrice(url)         → current price from any retailer page
//   2. enrichServiceWebsite(url, name) → services/pricing/hours from a business site
//   3. scrapeDealsPage(url, store, cat) → deal listings from a retailer deals page

const FIRECRAWL_KEY = () => process.env.FIRECRAWL_API_KEY;
const BASE = 'https://api.firecrawl.dev/v1';

async function post(path, body) {
  const key = FIRECRAWL_KEY();
  if (!key) throw new Error('FIRECRAWL_API_KEY not set in server/.env');

  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Firecrawl ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

// ─── 1. Product price from any retailer page ─────────────────────────────────

export async function scrapeProductPrice(url) {
  const data = await post('/scrape', {
    url,
    formats: ['extract'],
    onlyMainContent: true,
    extract: {
      prompt: 'Extract the product name, current sale price, original/list price, discount percentage if shown, currency, whether it is in stock, and the seller/store name.',
      schema: {
        type: 'object',
        properties: {
          productName:     { type: 'string' },
          currentPrice:    { type: 'number' },
          originalPrice:   { type: 'number' },
          discountPercent: { type: 'number' },
          currency:        { type: 'string' },
          inStock:         { type: 'boolean' },
          seller:          { type: 'string' }
        }
      }
    }
  });
  return data?.data?.extract ?? null;
}

// ─── 2. Business website enrichment (services, pricing, hours) ───────────────

export async function enrichServiceWebsite(url, businessName = '') {
  const data = await post('/scrape', {
    url,
    formats: ['extract', 'markdown'],
    onlyMainContent: true,
    extract: {
      prompt: `Extract detailed information from this business website${businessName ? ` for "${businessName}"` : ''}. Focus on: services offered with prices, any special offers or promotions, contact details, and business hours.`,
      schema: {
        type: 'object',
        properties: {
          services: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name:        { type: 'string' },
                price:       { type: 'string' },
                description: { type: 'string' }
              }
            }
          },
          specialOffers: { type: 'array', items: { type: 'string' } },
          about:         { type: 'string' },
          businessHours: { type: 'string' },
          contact: {
            type: 'object',
            properties: {
              phone:   { type: 'string' },
              email:   { type: 'string' },
              address: { type: 'string' }
            }
          }
        }
      }
    }
  });

  return {
    extract: data?.data?.extract ?? null,
    markdown: data?.data?.markdown ?? null,
    url
  };
}

// ─── 3. Retailer deals page crawler ──────────────────────────────────────────

export async function scrapeDealsPage(url, storeName = '', category = '') {
  const data = await post('/scrape', {
    url,
    formats: ['extract'],
    onlyMainContent: true,
    extract: {
      prompt: `Extract all sale deals and discounted products from this ${storeName ? storeName + ' ' : ''}${category ? category + ' ' : ''}deals page. For each item get the product title, current sale price, original price, and discount percentage.`,
      schema: {
        type: 'object',
        properties: {
          storeName: { type: 'string' },
          deals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title:           { type: 'string' },
                currentPrice:    { type: 'number' },
                originalPrice:   { type: 'number' },
                discountPercent: { type: 'number' },
                productUrl:      { type: 'string' },
                imageUrl:        { type: 'string' },
                category:        { type: 'string' }
              }
            }
          }
        }
      }
    }
  });
  return data?.data?.extract ?? null;
}

// ─── Healthcheck ──────────────────────────────────────────────────────────────

export function isConfigured() {
  return !!FIRECRAWL_KEY();
}
