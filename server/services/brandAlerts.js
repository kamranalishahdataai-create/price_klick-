// Brand Alert Reaching System
// Notifies brands when too many users search for their products/coupons
// Provides brand dashboards with search analytics

import { sendEmail } from './notify.js';
import {
  getBrandsExceedingThreshold,
  getBrandSearchStats,
  resetBrandAlert
} from './searchMonitor.js';

// Brand contact registry (in production, this would be in a database)
const brandContacts = new Map();

/**
 * Register a brand's contact info for alerts
 */
export function registerBrand({ brand, email, webhookUrl, contactName }) {
  const normalizedBrand = brand.toLowerCase().trim();
  brandContacts.set(normalizedBrand, {
    brand: normalizedBrand,
    email: email || null,
    webhookUrl: webhookUrl || null,
    contactName: contactName || brand,
    registeredAt: Date.now(),
    alertsReceived: 0
  });
  return { ok: true, brand: normalizedBrand };
}

/**
 * Get registered brand info
 */
export function getBrandContact(brand) {
  return brandContacts.get(brand.toLowerCase().trim()) || null;
}

/**
 * Get all registered brands
 */
export function getAllRegisteredBrands() {
  return Array.from(brandContacts.values());
}

/**
 * Send alert to a specific brand
 */
export async function sendBrandAlert(brand) {
  const normalizedBrand = brand.toLowerCase().trim();
  const contact = brandContacts.get(normalizedBrand);
  const stats = getBrandSearchStats(normalizedBrand);

  if (!stats || stats.totalSearches === 0) {
    return { sent: false, reason: 'no_search_data' };
  }

  const alertData = {
    brand: normalizedBrand,
    uniqueUsers: stats.uniqueUsers,
    totalSearches: stats.totalSearches,
    topQueries: stats.queries || [],
    trending: stats.trending,
    timestamp: new Date().toISOString()
  };

  const results = { emailSent: false, webhookSent: false };

  // Send email alert if contact registered
  if (contact?.email) {
    try {
      const html = buildBrandAlertEmail(alertData, contact.contactName);
      await sendEmail(
        contact.email,
        `🔥 High Demand Alert: ${stats.uniqueUsers} users searching for ${normalizedBrand}`,
        html
      );
      results.emailSent = true;
      contact.alertsReceived++;
    } catch (e) {
      console.warn(`[BrandAlert] Email to ${contact.email} failed:`, e.message);
    }
  }

  // Send webhook if registered
  if (contact?.webhookUrl) {
    try {
      const res = await fetch(contact.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertData)
      });
      results.webhookSent = res.ok;
    } catch (e) {
      console.warn(`[BrandAlert] Webhook to ${contact.webhookUrl} failed:`, e.message);
    }
  }

  return { sent: results.emailSent || results.webhookSent, ...results, alertData };
}

/**
 * Process all pending brand alerts
 */
export async function processAllBrandAlerts() {
  const exceeding = getBrandsExceedingThreshold();
  const results = [];

  for (const brandData of exceeding) {
    if (!brandData.alertSent) {
      const result = await sendBrandAlert(brandData.brand);
      results.push({ brand: brandData.brand, ...result });
    }
  }

  return results;
}

/**
 * Build HTML email for brand alert
 */
function buildBrandAlertEmail(alertData, contactName) {
  return `
    <div style="font-family:Inter, Arial, sans-serif; background:#f6f6fb; padding:24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" 
             style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eee">
        <tr>
          <td style="background:linear-gradient(135deg,#FF6B00,#FF9800); padding:20px; color:#fff;">
            <div style="font-weight:800; font-size:20px;">🔥 PriceKlick Brand Alert</div>
            <div style="opacity:.9; font-size:14px;">High Search Demand Detected</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px; color:#111827;">
            <h2 style="margin:0 0 12px 0; font-size:22px; font-weight:800;">
              Hi ${contactName}! 👋
            </h2>
            <p style="margin:0 0 16px 0; line-height:1.6; font-size:15px;">
              We detected <strong>high demand</strong> for your brand on PriceKlick:
            </p>
            
            <div style="background:#fff7ed; border:1px solid #ffedd5; border-radius:10px; padding:16px; margin-bottom:16px;">
              <table style="width:100%; border-collapse:collapse;">
                <tr>
                  <td style="padding:8px; font-size:14px; color:#666;">Brand</td>
                  <td style="padding:8px; font-size:16px; font-weight:700; color:#111;">${alertData.brand}</td>
                </tr>
                <tr>
                  <td style="padding:8px; font-size:14px; color:#666;">Unique Users Searching</td>
                  <td style="padding:8px; font-size:16px; font-weight:700; color:#FF6B00;">${alertData.uniqueUsers}</td>
                </tr>
                <tr>
                  <td style="padding:8px; font-size:14px; color:#666;">Total Searches</td>
                  <td style="padding:8px; font-size:16px; font-weight:700; color:#111;">${alertData.totalSearches}</td>
                </tr>
                <tr>
                  <td style="padding:8px; font-size:14px; color:#666;">Trending</td>
                  <td style="padding:8px; font-size:16px; font-weight:700; color:${alertData.trending ? '#4CAF50' : '#888'};">
                    ${alertData.trending ? '🔥 Yes' : 'No'}
                  </td>
                </tr>
              </table>
            </div>
            
            ${alertData.topQueries.length > 0 ? `
              <div style="margin-bottom:16px;">
                <h3 style="font-size:15px; font-weight:700; margin:0 0 8px 0;">Top Search Queries:</h3>
                <ul style="margin:0; padding-left:20px; color:#444; font-size:14px;">
                  ${alertData.topQueries.map(q => `<li style="margin-bottom:4px;">${q}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            
            <div style="background:#f0fdf4; border:1px solid #dcfce7; border-radius:10px; padding:16px; margin-bottom:16px;">
              <h3 style="font-size:15px; font-weight:700; margin:0 0 8px 0; color:#166534;">
                💡 Recommendation
              </h3>
              <p style="margin:0; font-size:14px; color:#333; line-height:1.5;">
                Consider offering an exclusive coupon code for PriceKlick users. 
                Brands that provide valid coupons see <strong>3x higher conversion</strong> from our platform.
              </p>
            </div>

            <a href="mailto:partner@priceklick.com?subject=Brand Partnership - ${alertData.brand}"
               style="display:inline-block;background:linear-gradient(135deg,#FF6B00,#FF9800);
                      color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;
                      font-weight:700; font-size:15px;">
              Partner With Us →
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px; color:#6b7280; font-size:12px; border-top:1px solid #f0f0f0;">
            This automated alert was sent by PriceKlick's Brand Intelligence System.
            <br/>© ${new Date().getFullYear()} PriceKlick • All rights reserved
          </td>
        </tr>
      </table>
    </div>
  `;
}

export default {
  registerBrand,
  getBrandContact,
  getAllRegisteredBrands,
  sendBrandAlert,
  processAllBrandAlerts
};
