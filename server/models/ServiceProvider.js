import mongoose from 'mongoose';

// Cache + favorites for service-provider results from SerpAPI Google Maps.
// Each document represents one provider; reused across users for caching.
const serviceProviderSchema = new mongoose.Schema({
  placeId: { type: String, index: true, unique: true, sparse: true },
  category: { type: String, index: true }, // plumber, electrician, mechanic, tutor...
  name: { type: String, required: true },
  rating: Number,
  reviewsCount: Number,
  price: String,        // "$$" / "$50/hr" / null
  priceValue: Number,   // numeric estimate when extractable
  address: String,
  phone: String,
  website: String,
  hours: mongoose.Schema.Types.Mixed,
  thumbnail: String,
  lat: Number,
  lng: Number,
  types: [String],
  description: String,
  source: { type: String, default: 'serpapi_google_maps' },
  rawSnippet: mongoose.Schema.Types.Mixed,
  cachedAt: { type: Date, default: Date.now, index: true },

  // --- Apify Google Maps enrichment ---
  enrichedAt: { type: Date, index: true },
  enrichedSource: String, // 'apify_google_maps'
  reviewsText: [{ name: String, text: String, stars: Number, publishedAt: String }],
  photos: [String],
  openingHours: mongoose.Schema.Types.Mixed,
  popularTimes: mongoose.Schema.Types.Mixed,
  email: String,
  socials: mongoose.Schema.Types.Mixed,
  aiReviewSummary: { pros: [String], cons: [String], summary: String, generatedAt: Date }
}, { timestamps: true });

serviceProviderSchema.index({ category: 1, lat: 1, lng: 1 });
serviceProviderSchema.index({ name: 'text', description: 'text', address: 'text' });

export default mongoose.model('ServiceProvider', serviceProviderSchema);
