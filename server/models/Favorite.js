import mongoose from 'mongoose';

const favoriteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceProvider', required: true },
  notes: String,
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

favoriteSchema.index({ userId: 1, providerId: 1 }, { unique: true });

export default mongoose.model('Favorite', favoriteSchema);
