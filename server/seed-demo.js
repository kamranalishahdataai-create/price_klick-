/**
 * PriceKlick Demo Seed Script
 * ─────────────────────────────
 * Creates sample users, an admin account, and populates search data
 * so the User Dashboard & Admin Panel have real-looking data to show.
 *
 * Usage:  node server/seed-demo.js
 *
 * Default demo accounts (password for ALL = Demo1234):
 *   admin@priceklick.com  → Admin
 *   alice@example.com       → User
 *   bob@example.com         → User
 *   carol@example.com       → User
 *   dave@example.com        → User
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

// ── Mongo connection ──────────────────────────────────────────────
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/priceklick';

async function seed() {
  console.log('\n🌱  PriceKlick Demo Seeder');
  console.log('─'.repeat(50));

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅  Connected to MongoDB:', MONGO_URI);
  } catch (err) {
    console.error('❌  Cannot connect to MongoDB. Make sure it is running.');
    console.error('   ', err.message);
    process.exit(1);
  }

  // ── User schema (mirrors models/User.js) ──────────────────────
  const userSchema = new mongoose.Schema({
    email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:   { type: String, required: true, select: false },
    firstName:  { type: String, trim: true },
    lastName:   { type: String, trim: true },
    avatar:     { type: String, default: null },
    role:       { type: String, enum: ['user', 'admin'], default: 'user' },
    isVerified: { type: Boolean, default: false },
    preferences: {
      notifications: { type: Boolean, default: true },
      newsletter:    { type: Boolean, default: false },
      favoriteStores: [String]
    },
    lastLogin:     Date,
    refreshTokens: [{ token: String, createdAt: { type: Date, default: Date.now } }]
  }, { timestamps: true });

  // Drop existing User collection to avoid duplicate-key issues
  const User = mongoose.models.User || mongoose.model('User', userSchema);

  // ── Demo accounts ─────────────────────────────────────────────
  const PASSWORD = 'Demo1234';
  const hash = await bcrypt.hash(PASSWORD, 12);

  const demoUsers = [
    {
      email: 'admin@priceklick.com',
      password: hash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      isVerified: true,
      lastLogin: new Date(),
      preferences: { notifications: true, newsletter: true, favoriteStores: ['amazon', 'nike', 'walmart'] }
    },
    {
      email: 'alice@example.com',
      password: hash,
      firstName: 'Alice',
      lastName: 'Johnson',
      role: 'user',
      isVerified: true,
      lastLogin: new Date(Date.now() - 2 * 86400000),
      preferences: { notifications: true, newsletter: false, favoriteStores: ['amazon', 'target'] }
    },
    {
      email: 'bob@example.com',
      password: hash,
      firstName: 'Bob',
      lastName: 'Smith',
      role: 'user',
      isVerified: true,
      lastLogin: new Date(Date.now() - 5 * 86400000),
      preferences: { notifications: false, newsletter: false, favoriteStores: ['ebay'] }
    },
    {
      email: 'carol@example.com',
      password: hash,
      firstName: 'Carol',
      lastName: 'Williams',
      role: 'user',
      isVerified: false,
      lastLogin: null,
      preferences: { notifications: true, newsletter: true, favoriteStores: ['nike', 'adidas'] }
    },
    {
      email: 'dave@example.com',
      password: hash,
      firstName: 'Dave',
      lastName: 'Brown',
      role: 'user',
      isVerified: true,
      lastLogin: new Date(Date.now() - 1 * 86400000),
      preferences: { notifications: true, newsletter: false, favoriteStores: ['amazon', 'bestbuy'] }
    }
  ];

  console.log('\n👤  Creating demo users...');
  for (const u of demoUsers) {
    try {
      await User.findOneAndUpdate(
        { email: u.email },
        { $set: u },
        { upsert: true, new: true }
      );
      const badge = u.role === 'admin' ? '🛡️  ADMIN' : '   User';
      console.log(`   ${badge}  ${u.email}  (${u.firstName} ${u.lastName})`);
    } catch (err) {
      console.log(`   ⚠️  ${u.email}: ${err.message}`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────
  const total = await User.countDocuments();
  const admins = await User.countDocuments({ role: 'admin' });

  console.log('\n' + '─'.repeat(50));
  console.log(`📊  Database now has ${total} users (${admins} admin, ${total - admins} regular)`);
  console.log('\n🔑  Demo Login Credentials:');
  console.log('   ┌─────────────────────────────┬──────────┐');
  console.log('   │  Email                       │ Password │');
  console.log('   ├─────────────────────────────┼──────────┤');
  console.log('   │  admin@priceklick.com        │ Demo1234 │');
  console.log('   │  alice@example.com           │ Demo1234 │');
  console.log('   │  bob@example.com             │ Demo1234 │');
  console.log('   │  carol@example.com           │ Demo1234 │');
  console.log('   │  dave@example.com            │ Demo1234 │');
  console.log('   └─────────────────────────────┴──────────┘');
  console.log('\n🚀  Start the app with: START-ALL.bat');
  console.log('   Then open http://localhost:3000\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
