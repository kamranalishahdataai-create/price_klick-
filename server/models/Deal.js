import mongoose from 'mongoose';

const DealSchema = new mongoose.Schema({
  category: { type: String, index: true },
  title: { type: String, required: true },
  brand: String,
  price: Number,
  oldPrice: Number,
  discountPercent: Number,
  currency: { type: String, default: 'CAD' },
  url: String,
  source: String,
  thumbnail: String,
  rating: Number,
  reviews: Number,
  expiresAt: Date,
  scrapedAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

DealSchema.index({ category: 1, scrapedAt: -1 });
DealSchema.index({ url: 1 }, { unique: true, sparse: true });

export default mongoose.models.Deal || mongoose.model('Deal', DealSchema);
