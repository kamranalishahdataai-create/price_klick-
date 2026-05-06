import mongoose from 'mongoose';

// Tracks every searchable user action (Lens scan, service search, click).
// Foundation for PrePay weekly insights — OpenAI summarizes habits from this stream.
const userActivitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  sessionId: { type: String, index: true }, // for anonymous users
  type: {
    type: String,
    enum: ['lens_scan', 'service_search', 'service_click', 'service_favorite',
           'product_click', 'coupon_apply', 'compare', 'flyer_view'],
    required: true,
    index: true
  },
  query: String,            // free-text query the user entered
  category: String,         // detected category (plumber, sneakers, etc.)
  brand: String,
  productName: String,
  price: Number,            // numeric price if known
  currency: { type: String, default: 'CAD' },
  location: {               // where the user was when this happened
    lat: Number,
    lng: Number,
    city: String
  },
  meta: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

userActivitySchema.index({ userId: 1, createdAt: -1 });
userActivitySchema.index({ userId: 1, type: 1, createdAt: -1 });

export default mongoose.model('UserActivity', userActivitySchema);
