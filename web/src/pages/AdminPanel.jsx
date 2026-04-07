import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  getAdminStats, getUsers, getUser, updateUser, deleteUser, suspendUser,
  getTrending, getBrandStats, getBrandAlerts, resetBrandAlert, processAlerts,
  getSettings, bootstrapAdmin
} from '../api/admin';
import './Panel.css';

// ========================================================
// USER DETAIL MODAL
// ========================================================
function UserModal({ userId, onClose, onUpdate }) {
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editRole, setEditRole] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    getUser(userId).then(data => {
      setUser(data.user);
      setHistory(data.searchHistory || []);
      setEditRole(data.user.role);
    }).catch(e => setMsg(e.message)).finally(() => setLoading(false));
  }, [userId]);

  async function handleRoleChange() {
    try {
      const res = await updateUser(userId, { role: editRole });
      setUser(res.user);
      setMsg('Role updated!');
      if (onUpdate) onUpdate();
    } catch (e) { setMsg(e.message); }
  }

  async function handleSuspend(suspended) {
    try {
      const res = await suspendUser(userId, suspended);
      setUser(res.user);
      setMsg(res.message);
      if (onUpdate) onUpdate();
    } catch (e) { setMsg(e.message); }
  }

  async function handleDelete() {
    if (!window.confirm('Permanently delete this user? This cannot be undone.')) return;
    try {
      await deleteUser(userId);
      setMsg('User deleted');
      if (onUpdate) onUpdate();
      setTimeout(onClose, 1000);
    } catch (e) { setMsg(e.message); }
  }

  if (!userId) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          <span>User Details</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="panel-loading">Loading user...</div>
        ) : !user ? (
          <div className="empty-state"><div className="empty-text">User not found</div></div>
        ) : (
          <>
            {/* User Info */}
            <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: 'linear-gradient(135deg, #6D4AFF, #9B5BFF)',
                  display: 'grid', placeItems: 'center', color: '#fff',
                  fontSize: 20, fontWeight: 700
                }}>
                  {(user.firstName?.[0] || user.email[0]).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>
                    {user.firstName || ''} {user.lastName || ''}
                  </div>
                  <div style={{ color: '#666', fontSize: 13 }}>{user.email}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ padding: 10, background: '#f7f5ff', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Role</div>
                  <span className={`badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}`}>{user.role}</span>
                </div>
                <div style={{ padding: 10, background: '#f7f5ff', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Status</div>
                  <span className={`badge ${user.isVerified ? 'badge-verified' : 'badge-unverified'}`}>
                    {user.isVerified ? 'Verified' : 'Unverified'}
                  </span>
                </div>
                <div style={{ padding: 10, background: '#f7f5ff', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Joined</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{new Date(user.createdAt).toLocaleDateString()}</div>
                </div>
                <div style={{ padding: 10, background: '#f7f5ff', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Last Login</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  className="filter-select"
                  style={{ flex: 1 }}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <button className="panel-btn panel-btn-primary panel-btn-sm" onClick={handleRoleChange}>
                  Update Role
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {user.isVerified ? (
                  <button className="panel-btn panel-btn-ghost panel-btn-sm" onClick={() => handleSuspend(true)}>
                    🚫 Suspend User
                  </button>
                ) : (
                  <button className="panel-btn panel-btn-primary panel-btn-sm" onClick={() => handleSuspend(false)}>
                    ✅ Unsuspend User
                  </button>
                )}
                <button className="panel-btn panel-btn-danger panel-btn-sm" onClick={handleDelete}>
                  🗑️ Delete User
                </button>
              </div>

              {msg && (
                <div style={{ fontSize: 13, color: msg.includes('deleted') || msg.includes('updated') || msg.includes('suspend') ? '#2e7d32' : '#c62828' }}>
                  {msg}
                </div>
              )}
            </div>

            {/* Search History */}
            {history.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Recent Searches ({history.length})</div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {history.slice(0, 20).map((h, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid #f0ecff', fontSize: 12 }}>
                      <span style={{ fontWeight: 600 }}>{h.brand || '—'}</span>
                      <span style={{ color: '#888', flex: 1 }}>{h.query}</span>
                      <span style={{ color: '#aaa' }}>{h.timestamp ? new Date(h.timestamp).toLocaleTimeString() : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ========================================================
// ADMIN PANEL MAIN COMPONENT
// ========================================================
export default function AdminPanel() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Users state
  const [users, setUsers] = useState([]);
  const [usersPagination, setUsersPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Analytics state
  const [trendingData, setTrendingData] = useState([]);
  const [brandSearch, setBrandSearch] = useState('');
  const [brandInfo, setBrandInfo] = useState(null);

  // Alerts state
  const [alerts, setAlerts] = useState([]);
  const [registeredBrands, setRegisteredBrands] = useState([]);

  // Settings state
  const [settings, setSettingsData] = useState(null);

  // Auth check
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || (user && user.role !== 'admin'))) {
      navigate(isAuthenticated ? '/user-dashboard' : '/login');
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  // Load initial data
  useEffect(() => {
    if (user?.role === 'admin') loadDashboard();
  }, [user]);

  async function loadDashboard() {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminStats();
      setStats(data.stats);
      setTrendingData(data.trendingBrands || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  // Load users when switching to users tab
  const loadUsers = useCallback(async (page = 1) => {
    try {
      const data = await getUsers({ page, search: userSearch, role: userRoleFilter });
      setUsers(data.users);
      setUsersPagination(data.pagination);
    } catch (e) { setError(e.message); }
  }, [userSearch, userRoleFilter]);

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
  }, [activeTab, loadUsers]);

  // Load analytics
  async function loadAnalytics() {
    try {
      const data = await getTrending(30);
      setTrendingData(data.trending);
    } catch (e) { setError(e.message); }
  }

  async function searchBrand() {
    if (!brandSearch.trim()) return;
    try {
      const data = await getBrandStats(brandSearch);
      setBrandInfo(data.stats);
    } catch (e) { setError(e.message); }
  }

  // Load alerts
  async function loadAlerts() {
    try {
      const data = await getBrandAlerts();
      setAlerts(data.alerts);
      setRegisteredBrands(data.registeredBrands);
    } catch (e) { setError(e.message); }
  }

  // Load settings
  async function loadSettings() {
    try {
      const data = await getSettings();
      setSettingsData(data.settings);
    } catch (e) { setError(e.message); }
  }

  useEffect(() => {
    if (activeTab === 'analytics') loadAnalytics();
    if (activeTab === 'alerts') loadAlerts();
    if (activeTab === 'settings') loadSettings();
  }, [activeTab]);

  if (authLoading) return <div className="panel-loading">Loading...</div>;
  if (!user || user.role !== 'admin') return null;

  return (
    <div className="panel-page">
      <div className="panel-container">
        {/* Header */}
        <div className="panel-header">
          <div>
            <h1 className="panel-title">🛡️ Admin Panel</h1>
            <p className="panel-subtitle">Manage users, monitor analytics, and control the system</p>
          </div>
          <button className="panel-btn panel-btn-ghost" onClick={() => navigate('/user-dashboard')}>
            ← Back to Dashboard
          </button>
        </div>

        {error && (
          <div style={{ background: '#fce4ec', color: '#c62828', padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontSize: 14 }}>
            {error}
            <button onClick={() => setError('')} style={{ marginLeft: 8, border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700 }}>✕</button>
          </div>
        )}

        {/* Tabs */}
        <div className="panel-tabs">
          {['dashboard', 'users', 'analytics', 'alerts', 'settings'].map(tab => (
            <button
              key={tab}
              className={`panel-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'dashboard' ? '📊 Dashboard' :
               tab === 'users' ? '👥 Users' :
               tab === 'analytics' ? '📈 Analytics' :
               tab === 'alerts' ? '🔔 Alerts' : '⚙️ Settings'}
            </button>
          ))}
        </div>

        {loading && activeTab === 'dashboard' ? (
          <div className="panel-loading">Loading admin data...</div>
        ) : (
          <>
            {/* ====== DASHBOARD TAB ====== */}
            {activeTab === 'dashboard' && stats && (
              <>
                <div className="stat-grid">
                  <div className="stat-card">
                    <div className="stat-icon">👥</div>
                    <div className="stat-value">{stats.totalUsers}</div>
                    <div className="stat-label">Total Users</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">✓</div>
                    <div className="stat-value">{stats.verifiedUsers}</div>
                    <div className="stat-label">Verified Users</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">🛡️</div>
                    <div className="stat-value">{stats.adminUsers}</div>
                    <div className="stat-label">Admins</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">🆕</div>
                    <div className="stat-value">{stats.recentUsers}</div>
                    <div className="stat-label">New This Week</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">🔥</div>
                    <div className="stat-value">{stats.trendingBrandsCount}</div>
                    <div className="stat-label">Trending Brands</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">🔔</div>
                    <div className="stat-value">{stats.activeBrandAlerts}</div>
                    <div className="stat-label">Active Alerts</div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="panel-card">
                  <div className="panel-card-title">⚡ Quick Actions</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="panel-btn panel-btn-primary" onClick={() => setActiveTab('users')}>
                      👥 Manage Users
                    </button>
                    <button className="panel-btn panel-btn-ghost" onClick={() => setActiveTab('analytics')}>
                      📈 View Analytics
                    </button>
                    <button className="panel-btn panel-btn-ghost" onClick={() => setActiveTab('alerts')}>
                      🔔 Brand Alerts ({stats.activeBrandAlerts})
                    </button>
                    <button className="panel-btn panel-btn-ghost" onClick={loadDashboard}>
                      🔄 Refresh
                    </button>
                  </div>
                </div>

                {/* Recent Trending */}
                {trendingData.length > 0 && (
                  <div className="panel-card">
                    <div className="panel-card-title">🔥 Top Trending Brands</div>
                    <table className="panel-table">
                      <thead>
                        <tr>
                          <th>Brand</th>
                          <th>Searches</th>
                          <th>Users</th>
                          <th>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trendingData.map((t, i) => (
                          <tr key={i}>
                            <td><strong>{t.brand}</strong></td>
                            <td>{t.totalSearches}</td>
                            <td>{t.uniqueUsers}</td>
                            <td><span className="badge badge-info">{Math.round(t.score)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ====== USERS TAB ====== */}
            {activeTab === 'users' && (
              <>
                <div className="filter-row">
                  <input
                    className="filter-input"
                    placeholder="Search users by name or email..."
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loadUsers()}
                  />
                  <select className="filter-select" value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)}>
                    <option value="">All Roles</option>
                    <option value="user">Users</option>
                    <option value="admin">Admins</option>
                  </select>
                  <button className="panel-btn panel-btn-primary" onClick={() => loadUsers()}>
                    🔍 Search
                  </button>
                </div>

                <div className="panel-card">
                  <div className="panel-card-title">
                    👥 Users ({usersPagination.total})
                  </div>

                  {users.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">👥</div>
                      <div className="empty-text">No users found</div>
                      <div className="empty-hint">Try adjusting your search filters</div>
                    </div>
                  ) : (
                    <>
                      <table className="panel-table">
                        <thead>
                          <tr>
                            <th>User</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map(u => (
                            <tr key={u.id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div style={{
                                    width: 32, height: 32, borderRadius: 10,
                                    background: u.role === 'admin' ? 'linear-gradient(135deg, #6D4AFF, #9B5BFF)' : '#e8e0ff',
                                    display: 'grid', placeItems: 'center',
                                    color: u.role === 'admin' ? '#fff' : '#6D4AFF',
                                    fontSize: 14, fontWeight: 700
                                  }}>
                                    {(u.firstName?.[0] || u.email[0]).toUpperCase()}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                                      {u.firstName || ''} {u.lastName || ''}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ fontSize: 13 }}>{u.email}</td>
                              <td>
                                <span className={`badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}`}>
                                  {u.role}
                                </span>
                              </td>
                              <td>
                                <span className={`badge ${u.isVerified ? 'badge-verified' : 'badge-unverified'}`}>
                                  {u.isVerified ? 'Verified' : 'Unverified'}
                                </span>
                              </td>
                              <td style={{ fontSize: 12, color: '#888' }}>
                                {new Date(u.createdAt).toLocaleDateString()}
                              </td>
                              <td>
                                <button
                                  className="panel-btn panel-btn-ghost panel-btn-sm"
                                  onClick={() => setSelectedUserId(u.id)}
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Pagination */}
                      <div className="pagination">
                        <button
                          disabled={usersPagination.page <= 1}
                          onClick={() => loadUsers(usersPagination.page - 1)}
                        >
                          ← Prev
                        </button>
                        <span className="page-info">
                          Page {usersPagination.page} of {usersPagination.pages}
                        </span>
                        <button
                          disabled={usersPagination.page >= usersPagination.pages}
                          onClick={() => loadUsers(usersPagination.page + 1)}
                        >
                          Next →
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* User Detail Modal */}
                {selectedUserId && (
                  <UserModal
                    userId={selectedUserId}
                    onClose={() => setSelectedUserId(null)}
                    onUpdate={() => loadUsers(usersPagination.page)}
                  />
                )}
              </>
            )}

            {/* ====== ANALYTICS TAB ====== */}
            {activeTab === 'analytics' && (
              <>
                {/* Brand Search */}
                <div className="panel-card">
                  <div className="panel-card-title">🔍 Brand Lookup</div>
                  <div className="filter-row" style={{ marginBottom: 0 }}>
                    <input
                      className="filter-input"
                      placeholder="Enter brand name..."
                      value={brandSearch}
                      onChange={e => setBrandSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && searchBrand()}
                    />
                    <button className="panel-btn panel-btn-primary" onClick={searchBrand}>Search</button>
                  </div>

                  {brandInfo && (
                    <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                      <div style={{ padding: 12, background: '#f7f5ff', borderRadius: 10 }}>
                        <div style={{ fontSize: 11, color: '#888' }}>Brand</div>
                        <div style={{ fontWeight: 700 }}>{brandInfo.brand}</div>
                      </div>
                      <div style={{ padding: 12, background: '#f7f5ff', borderRadius: 10 }}>
                        <div style={{ fontSize: 11, color: '#888' }}>Total Searches</div>
                        <div style={{ fontWeight: 700, fontSize: 20 }}>{brandInfo.totalSearches}</div>
                      </div>
                      <div style={{ padding: 12, background: '#f7f5ff', borderRadius: 10 }}>
                        <div style={{ fontSize: 11, color: '#888' }}>Unique Users</div>
                        <div style={{ fontWeight: 700, fontSize: 20 }}>{brandInfo.uniqueUsers}</div>
                      </div>
                      <div style={{ padding: 12, background: '#f7f5ff', borderRadius: 10 }}>
                        <div style={{ fontSize: 11, color: '#888' }}>Trending</div>
                        <span className={`badge ${brandInfo.trending ? 'badge-success' : 'badge-warning'}`}>
                          {brandInfo.trending ? '🔥 Yes' : 'No'}
                        </span>
                      </div>
                      <div style={{ padding: 12, background: '#f7f5ff', borderRadius: 10 }}>
                        <div style={{ fontSize: 11, color: '#888' }}>Alert Threshold</div>
                        <span className={`badge ${brandInfo.alertThresholdMet ? 'badge-danger' : 'badge-info'}`}>
                          {brandInfo.alertThresholdMet ? '⚠️ Met' : 'Not met'}
                        </span>
                      </div>
                      {brandInfo.queries && brandInfo.queries.length > 0 && (
                        <div style={{ gridColumn: '1 / -1', padding: 12, background: '#f7f5ff', borderRadius: 10 }}>
                          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>Recent Queries</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {brandInfo.queries.map((q, i) => (
                              <span key={i} className="badge badge-info">{q}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Trending Brands Table */}
                <div className="panel-card">
                  <div className="panel-card-title">🔥 All Trending Brands</div>
                  {trendingData.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">📊</div>
                      <div className="empty-text">No trending data yet</div>
                      <div className="empty-hint">Trending data appears when users search using the extension</div>
                    </div>
                  ) : (
                    <table className="panel-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Brand</th>
                          <th>Searches</th>
                          <th>Users</th>
                          <th>Score</th>
                          <th>Last Searched</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trendingData.map((t, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td><strong>{t.brand}</strong></td>
                            <td>{t.totalSearches}</td>
                            <td>{t.uniqueUsers}</td>
                            <td><span className="badge badge-info">{Math.round(t.score)}</span></td>
                            <td style={{ fontSize: 12, color: '#888' }}>
                              {new Date(t.lastSearched).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}

            {/* ====== ALERTS TAB ====== */}
            {activeTab === 'alerts' && (
              <>
                <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                  <button className="panel-btn panel-btn-primary" onClick={async () => {
                    try {
                      const res = await processAlerts();
                      setError('');
                      loadAlerts();
                      alert(`Processed ${res.results?.length || 0} alert(s)`);
                    } catch (e) { setError(e.message); }
                  }}>
                    🔔 Process All Brand Alerts
                  </button>
                  <button className="panel-btn panel-btn-ghost" onClick={loadAlerts}>
                    🔄 Refresh
                  </button>
                </div>

                {/* Active Alerts */}
                <div className="panel-card">
                  <div className="panel-card-title">⚠️ Brands Exceeding Alert Threshold</div>
                  {alerts.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">🔔</div>
                      <div className="empty-text">No alerts triggered</div>
                      <div className="empty-hint">Alerts trigger when many users search for the same brand</div>
                    </div>
                  ) : (
                    <table className="panel-table">
                      <thead>
                        <tr>
                          <th>Brand</th>
                          <th>Users</th>
                          <th>Searches</th>
                          <th>Alert Sent</th>
                          <th>Top Queries</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alerts.map((a, i) => (
                          <tr key={i}>
                            <td><strong>{a.brand}</strong></td>
                            <td>{a.uniqueUsers}</td>
                            <td>{a.totalSearches}</td>
                            <td>
                              <span className={`badge ${a.alertSent ? 'badge-success' : 'badge-warning'}`}>
                                {a.alertSent ? 'Sent' : 'Pending'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {a.topQueries?.slice(0, 3).map((q, j) => (
                                  <span key={j} className="badge badge-info" style={{ fontSize: 10 }}>{q}</span>
                                ))}
                              </div>
                            </td>
                            <td>
                              <button
                                className="panel-btn panel-btn-ghost panel-btn-sm"
                                onClick={async () => {
                                  await resetBrandAlert(a.brand);
                                  loadAlerts();
                                }}
                              >
                                Reset
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Registered Brands */}
                <div className="panel-card">
                  <div className="panel-card-title">🏢 Registered Brand Contacts</div>
                  {registeredBrands.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">📧</div>
                      <div className="empty-text">No brands registered yet</div>
                      <div className="empty-hint">Brands can register via the API to receive search alerts</div>
                    </div>
                  ) : (
                    <table className="panel-table">
                      <thead>
                        <tr>
                          <th>Brand</th>
                          <th>Email</th>
                          <th>Webhook</th>
                          <th>Registered</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registeredBrands.map((b, i) => (
                          <tr key={i}>
                            <td><strong>{b.brand}</strong></td>
                            <td>{b.email || '—'}</td>
                            <td style={{ fontSize: 12 }}>{b.webhookUrl ? '✓ Configured' : '—'}</td>
                            <td style={{ fontSize: 12, color: '#888' }}>
                              {b.registeredAt ? new Date(b.registeredAt).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}

            {/* ====== SETTINGS TAB ====== */}
            {activeTab === 'settings' && (
              <>
                <div className="panel-card">
                  <div className="panel-card-title">⚙️ System Configuration</div>
                  {!settings ? (
                    <div className="panel-loading">Loading settings...</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
                      <div style={{ padding: 16, background: '#f7f5ff', borderRadius: 12 }}>
                        <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>AI Provider</div>
                        <div style={{ fontWeight: 700 }}>
                          <span className={`badge ${settings.aiProvider !== 'none' ? 'badge-success' : 'badge-danger'}`}>
                            {settings.aiProvider === 'openai' ? '🤖 OpenAI' :
                             settings.aiProvider === 'google_vision' ? '👁️ Google Vision' : '❌ None'}
                          </span>
                        </div>
                      </div>
                      <div style={{ padding: 16, background: '#f7f5ff', borderRadius: 12 }}>
                        <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>SERP API</div>
                        <span className={`badge ${settings.serpApiConfigured ? 'badge-success' : 'badge-warning'}`}>
                          {settings.serpApiConfigured ? '✓ Configured' : '⚠️ Not configured'}
                        </span>
                      </div>
                      <div style={{ padding: 16, background: '#f7f5ff', borderRadius: 12 }}>
                        <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>MongoDB</div>
                        <span className={`badge ${settings.mongoConnected ? 'badge-success' : 'badge-danger'}`}>
                          {settings.mongoConnected ? '✓ Connected' : '✕ Disconnected'}
                        </span>
                      </div>
                      <div style={{ padding: 16, background: '#f7f5ff', borderRadius: 12 }}>
                        <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Brand Alert Threshold</div>
                        <div style={{ fontWeight: 700, fontSize: 20 }}>{settings.brandAlertThreshold} users</div>
                      </div>
                      <div style={{ padding: 16, background: '#f7f5ff', borderRadius: 12 }}>
                        <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Trending Window</div>
                        <div style={{ fontWeight: 700, fontSize: 20 }}>{settings.trendingWindowHours}h</div>
                      </div>
                      <div style={{ padding: 16, background: '#f7f5ff', borderRadius: 12 }}>
                        <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Server Uptime</div>
                        <div style={{ fontWeight: 700 }}>{Math.round(settings.serverUptime / 60)} min</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="panel-card">
                  <div className="panel-card-title">ℹ️ About</div>
                  <div style={{ color: '#666', fontSize: 14, lineHeight: 1.8 }}>
                    <p><strong>PriceKlick Admin Panel</strong></p>
                    <p>This panel allows administrators to:</p>
                    <ul style={{ paddingLeft: 20 }}>
                      <li>View and manage all registered users</li>
                      <li>Change user roles (user/admin)</li>
                      <li>Suspend or delete user accounts</li>
                      <li>Monitor search analytics and trending brands</li>
                      <li>Manage brand alert system and thresholds</li>
                      <li>View system configuration and health status</li>
                    </ul>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
