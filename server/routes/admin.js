import express from 'express';
import User from '../models/User.js';
import { authenticate, adminOnly } from '../middleware/auth.js';
import {
  getTrendingBrands,
  getBrandSearchStats,
  getUserSearchHistory,
  getBrandsExceedingThreshold,
  resetBrandAlert
} from '../services/searchMonitor.js';
import {
  getAllRegisteredBrands,
  processAllBrandAlerts
} from '../services/brandAlerts.js';

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, adminOnly);

// ========================================================
// ADMIN DASHBOARD - Overview stats
// ========================================================

router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const recentUsers = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    const trendingBrands = getTrendingBrands(10);
    const brandAlerts = getBrandsExceedingThreshold();
    const registeredBrands = getAllRegisteredBrands();

    res.json({
      ok: true,
      stats: {
        totalUsers,
        verifiedUsers,
        adminUsers,
        recentUsers,
        trendingBrandsCount: trendingBrands.length,
        activeBrandAlerts: brandAlerts.length,
        registeredBrands: registeredBrands.length
      },
      trendingBrands: trendingBrands.slice(0, 5),
      recentAlerts: brandAlerts.slice(0, 5)
    });
  } catch (e) {
    console.error('Admin stats error:', e);
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// ========================================================
// USER MANAGEMENT
// ========================================================

// List all users (paginated)
router.get('/users', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const role = req.query.role || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    // Build filter
    const filter = {};
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }
    if (role && ['user', 'admin'].includes(role)) {
      filter.role = role;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -refreshTokens -verificationToken -resetPasswordToken')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter)
    ]);

    res.json({
      ok: true,
      users: users.map(u => ({
        id: u._id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        isVerified: u.isVerified,
        preferences: u.preferences,
        lastLogin: u.lastLogin,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (e) {
    console.error('Admin list users error:', e);
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// Get single user details
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -refreshTokens -verificationToken -resetPasswordToken')
      .lean();

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get user's search history
    const searchHistory = getUserSearchHistory(req.params.id, 50);

    res.json({
      ok: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isVerified: user.isVerified,
        preferences: user.preferences,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      searchHistory
    });
  } catch (e) {
    console.error('Admin get user error:', e);
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// Update user (role, verified status, etc.)
router.put('/users/:id', async (req, res) => {
  try {
    const { role, isVerified, firstName, lastName } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Prevent admin from demoting themselves
    if (req.params.id === req.userId.toString() && role && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    if (role && ['user', 'admin'].includes(role)) user.role = role;
    if (typeof isVerified === 'boolean') user.isVerified = isVerified;
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;

    await user.save();

    res.json({
      ok: true,
      user: user.toPublicJSON(),
      message: 'User updated successfully'
    });
  } catch (e) {
    console.error('Admin update user error:', e);
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    // Prevent admin from deleting themselves
    if (req.params.id === req.userId.toString()) {
      return res.status(400).json({ error: 'Cannot delete your own account from admin panel' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ ok: true, message: `User ${user.email} deleted successfully` });
  } catch (e) {
    console.error('Admin delete user error:', e);
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// Suspend/unsuspend user (set isVerified to false to restrict)
router.post('/users/:id/suspend', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (req.params.id === req.userId.toString()) {
      return res.status(400).json({ error: 'Cannot suspend your own account' });
    }

    const { suspended } = req.body;
    user.isVerified = !suspended;
    // Clear sessions on suspend
    if (suspended) {
      user.refreshTokens = [];
    }
    await user.save();

    res.json({
      ok: true,
      user: user.toPublicJSON(),
      message: suspended ? 'User suspended' : 'User unsuspended'
    });
  } catch (e) {
    console.error('Admin suspend user error:', e);
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// ========================================================
// ANALYTICS & SEARCH DATA
// ========================================================

router.get('/analytics/trending', (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const trending = getTrendingBrands(limit);
  res.json({ ok: true, trending });
});

router.get('/analytics/brand/:brand', (req, res) => {
  const stats = getBrandSearchStats(req.params.brand);
  res.json({ ok: true, stats });
});

router.get('/analytics/brand-alerts', (req, res) => {
  const alerts = getBrandsExceedingThreshold();
  const registered = getAllRegisteredBrands();
  res.json({ ok: true, alerts, registeredBrands: registered });
});

router.post('/analytics/brand-alerts/reset/:brand', (req, res) => {
  const result = resetBrandAlert(req.params.brand);
  res.json({ ok: true, reset: result });
});

router.post('/analytics/brand-alerts/process', async (req, res) => {
  try {
    const results = await processAllBrandAlerts();
    res.json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// ========================================================
// SYSTEM SETTINGS
// ========================================================

router.get('/settings', (req, res) => {
  res.json({
    ok: true,
    settings: {
      brandAlertThreshold: 10,
      trendingWindowHours: 24,
      maxSearchHistoryPerUser: 200,
      aiProvider: process.env.OPENAI_API_KEY ? 'openai' : (process.env.GOOGLE_VISION_API_KEY ? 'google_vision' : 'none'),
      serpApiConfigured: !!(process.env.SERP_API_KEY || process.env.SERPAPI_KEY),
      mongoConnected: true,
      serverUptime: process.uptime()
    }
  });
});

// Create first admin (bootstrap - only works if no admins exist)
router.post('/bootstrap-admin', async (req, res) => {
  // This bypasses the normal admin check for initial setup
  // It's accessible only once — when there's no admin user
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      return res.status(400).json({ error: 'Admin already exists' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.role = 'admin';
    await user.save();

    res.json({ ok: true, message: 'You are now an admin', user: user.toPublicJSON() });
  } catch (e) {
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

export default router;
