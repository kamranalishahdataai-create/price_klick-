import mongoose from 'mongoose';

// One scraped menu / price list per business. Items carry a numeric price and a
// server-computed price bucket, so budget queries ("pizza under $15") are a
// simple filter — no re-scrape, no client-side price parsing.
const MenuItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: Number,                         // final price the customer pays
  priceDisplay: String,                  // as shown on the site, e.g. "$9.99"
  currency: { type: String, default: 'CAD' },
  section: String,                       // menu section, e.g. "Classic", "Specialty", "Haircuts"
  description: String,
  bucket: { type: String, index: true }, // "$0–5" | "$5–10" | "$10–15" | "$15–25" | "$25–50" | "$50+"
}, { _id: false });

const ServiceMenuSchema = new mongoose.Schema({
  placeId: { type: String, index: true },      // provider placeId when known
  nameKey: { type: String, index: true },      // normalized business name (fallback key)
  name: { type: String, required: true },
  website: String,
  category: String,
  location: String,
  items: [MenuItemSchema],
  bucketCounts: { type: Map, of: Number },     // e.g. { "$5–10": 4, "$10–15": 7 }
  itemCount: Number,
  source: String,                              // 'perplexity' | 'firecrawl'
  citations: [String],
  scrapedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

ServiceMenuSchema.index({ nameKey: 1, location: 1 });

export default mongoose.models.ServiceMenu || mongoose.model('ServiceMenu', ServiceMenuSchema);
