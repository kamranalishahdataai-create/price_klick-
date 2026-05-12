import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { get, post, API_BASE } from '../api/client';
import './Panel.css';

export default function UserDashboard() {
  const { user, isAuthenticated, loading: authLoading, logout, updateProfile, changePassword } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [searchHistory, setSearchHistory] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [trending, setTrending] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);

  // Profile edit
  const [editProfile, setEditProfile] = useState(false);
  const [profileData, setProfileData] = useState({ firstName: '', lastName: '' });
  const [profileMsg, setProfileMsg] = useState('');

  // Password change
  const [pwData, setPwData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMsg, setPwMsg] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!user) return;
    setProfileData({ firstName: user.firstName || '', lastName: user.lastName || '' });
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    try {
      const [histRes, recRes, trendRes] = await Promise.allSettled([
        get('/api/search/history'),
        get('/api/recommendations'),
        get('/api/trending')
      ]);
      if (histRes.status === 'fulfilled') setSearchHistory(histRes.value.history || []);
      if (recRes.status === 'fulfilled') setRecommendations(recRes.value.recommendations || []);
      if (trendRes.status === 'fulfilled') setTrending(trendRes.value.trending || []);
    } catch (e) {
      console.error('Load data error:', e);
    }
    setLoading(false);
  }

  async function handleProfileSave(e) {
    e.preventDefault();
    setProfileMsg('');
    try {
      await updateProfile(profileData);
      setProfileMsg('Profile updated!');
      setEditProfile(false);
    } catch (err) {
      setProfileMsg(err.message);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPwMsg('');
    if (pwData.newPassword !== pwData.confirmPassword) {
      setPwMsg('Passwords do not match');
      return;
    }
    if (pwData.newPassword.length < 6) {
      setPwMsg('Password must be at least 6 characters');
      return;
    }
    try {
      await changePassword({ currentPassword: pwData.currentPassword, newPassword: pwData.newPassword });
      setPwMsg('Password changed successfully!');
      setPwData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwMsg(err.message);
    }
  }

  if (authLoading) return <div className="panel-loading">Loading...</div>;
  if (!user) return null;

  return (
    <div className="panel-page">
      <div className="panel-container">
        {/* Header */}
        <div className="panel-header">
          <div>
            <h1 className="panel-title">
              Welcome back, {user.firstName || user.email.split('@')[0]}!
            </h1>
            <p className="panel-subtitle">
              {user.email} Â· Member since {new Date(user.createdAt).toLocaleDateString()}
              {user.role === 'admin' && (
                <Link to="/admin" style={{ marginLeft: 12, color: 'oklch(78% .18 295)', fontWeight: 700, textDecoration: 'none' }}>
                  ðŸ›¡ï¸ Admin Panel â†’
                </Link>
              )}
            </p>
          </div>
          <button className="panel-btn panel-btn-ghost" onClick={logout}>
            ðŸšª Logout
          </button>
        </div>

        {/* Tabs */}
        <div className="panel-tabs">
          {['overview', 'prepay', 'history', 'profile', 'settings'].map(tab => (
            <button
              key={tab}
              className={`panel-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'overview' ? 'ðŸ“Š Overview' :
               tab === 'prepay' ? 'ðŸ’¸ PrePay' :
               tab === 'history' ? 'ðŸ• History' :
               tab === 'profile' ? 'ðŸ‘¤ Profile' : 'âš™ï¸ Settings'}
            </button>
          ))}
        </div>

        {loading && activeTab !== 'profile' && activeTab !== 'settings' ? (
          <div className="panel-loading">Loading your data...</div>
        ) : (
          <>
            {/* ====== OVERVIEW TAB ====== */}
            {activeTab === 'overview' && (
              <>
                <div className="stat-grid">
                  <div className="stat-card">
                    <div className="stat-icon">ðŸ”</div>
                    <div className="stat-value">{searchHistory.length}</div>
                    <div className="stat-label">Searches Tracked</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">ðŸ’¡</div>
                    <div className="stat-value">{recommendations.length}</div>
                    <div className="stat-label">Recommendations</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">ðŸ”¥</div>
                    <div className="stat-value">{trending.length}</div>
                    <div className="stat-label">Trending Brands</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">â­</div>
                    <div className="stat-value">{user.preferences?.favoriteStores?.length || 0}</div>
                    <div className="stat-label">Favorite Stores</div>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="panel-card">
                  <div className="panel-card-title">ðŸ’¡ Recommended for You</div>
                  {recommendations.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">ðŸ¤–</div>
                      <div className="empty-text">No recommendations yet</div>
                      <div className="empty-hint">Browse more stores to get personalized suggestions</div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {recommendations.slice(0, 5).map((r, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f0ecff' }}>
                          <span style={{ fontSize: 24 }}>
                            {r.type === 'hot_trending' ? 'ðŸ”¥' : r.type === 'trending_brand' ? 'â­' : 'ðŸ’¡'}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{r.brand}</div>
                            <div style={{ color: '#6a6880', fontSize: 12 }}>{r.reason}</div>
                          </div>
                          <span className="badge badge-info">{r.totalUsers} users</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Trending */}
                <div className="panel-card">
                  <div className="panel-card-title">ðŸ”¥ Trending Now</div>
                  {trending.length === 0 ? (
                    <p style={{ color: '#6a6880', fontSize: 14 }}>No trending brands right now</p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {trending.map((t, i) => (
                        <span key={i} className="badge badge-warning" style={{ fontSize: 13, padding: '6px 14px' }}>
                          ðŸ”¥ {t.brand} ({t.uniqueUsers} users)
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ====== HISTORY TAB ====== */}
            {activeTab === 'history' && (
              <div className="panel-card">
                <div className="panel-card-title">ðŸ• Your Search History</div>
                {searchHistory.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">ðŸ“­</div>
                    <div className="empty-text">No search history yet</div>
                    <div className="empty-hint">Use the extension to browse stores and your activity will appear here</div>
                  </div>
                ) : (
                  <table className="panel-table">
                    <thead>
                      <tr>
                        <th>Brand</th>
                        <th>Query</th>
                        <th>Product</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchHistory.slice(0, 50).map((h, i) => (
                        <tr key={i}>
                          <td><strong>{h.brand || 'â€”'}</strong></td>
                          <td>{h.query || 'â€”'}</td>
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {h.product || 'â€”'}
                          </td>
                          <td style={{ fontSize: 12, color: '#888' }}>
                            {h.timestamp ? new Date(h.timestamp).toLocaleString() : 'â€”'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ====== PREPAY TAB ====== */}
            {activeTab === 'prepay' && <PrePayPanel />}

            {/* ====== PROFILE TAB ====== */}
            {activeTab === 'profile' && (
              <div className="panel-card">
                <div className="panel-card-title">ðŸ‘¤ Your Profile</div>

                <div style={{ display: 'grid', gap: 16, maxWidth: 500 }}>
                  <div>
                    <label style={{ fontWeight: 600, fontSize: 13, color: '#555', display: 'block', marginBottom: 4 }}>Email</label>
                    <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, color: 'var(--foreground)' }}>
                      {user.email}
                      {user.isVerified ? (
                        <span className="badge badge-verified" style={{ marginLeft: 8 }}>âœ“ Verified</span>
                      ) : (
                        <span className="badge badge-unverified" style={{ marginLeft: 8 }}>Unverified</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontWeight: 600, fontSize: 13, color: '#555', display: 'block', marginBottom: 4 }}>Role</label>
                    <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
                      <span className={`badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}`}>
                        {user.role}
                      </span>
                    </div>
                  </div>

                  {editProfile ? (
                    <form onSubmit={handleProfileSave} style={{ display: 'grid', gap: 12 }}>
                      <div>
                        <label style={{ fontWeight: 600, fontSize: 13, color: '#555', display: 'block', marginBottom: 4 }}>First Name</label>
                        <input
                          className="filter-input"
                          value={profileData.firstName}
                          onChange={e => setProfileData({ ...profileData, firstName: e.target.value })}
                          placeholder="First name"
                        />
                      </div>
                      <div>
                        <label style={{ fontWeight: 600, fontSize: 13, color: '#555', display: 'block', marginBottom: 4 }}>Last Name</label>
                        <input
                          className="filter-input"
                          value={profileData.lastName}
                          onChange={e => setProfileData({ ...profileData, lastName: e.target.value })}
                          placeholder="Last name"
                        />
                      </div>
                      {profileMsg && <div style={{ color: profileMsg.includes('updated') ? '#2e7d32' : '#c62828', fontSize: 13 }}>{profileMsg}</div>}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="submit" className="panel-btn panel-btn-primary">Save Changes</button>
                        <button type="button" className="panel-btn panel-btn-ghost" onClick={() => setEditProfile(false)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <div>
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: '#555' }}>Name: </span>
                        {user.firstName || user.lastName
                          ? `${user.firstName || ''} ${user.lastName || ''}`
                          : '(not set)'}
                      </div>
                      <button className="panel-btn panel-btn-ghost" onClick={() => setEditProfile(true)}>âœï¸ Edit Profile</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ====== SETTINGS TAB ====== */}
            {activeTab === 'settings' && (
              <>
                <div className="panel-card">
                  <div className="panel-card-title">ðŸ”’ Change Password</div>
                  <form onSubmit={handlePasswordChange} style={{ display: 'grid', gap: 12, maxWidth: 400 }}>
                    <input
                      className="filter-input"
                      type="password"
                      placeholder="Current password"
                      value={pwData.currentPassword}
                      onChange={e => setPwData({ ...pwData, currentPassword: e.target.value })}
                      required
                    />
                    <input
                      className="filter-input"
                      type="password"
                      placeholder="New password (min 6 chars)"
                      value={pwData.newPassword}
                      onChange={e => setPwData({ ...pwData, newPassword: e.target.value })}
                      required
                    />
                    <input
                      className="filter-input"
                      type="password"
                      placeholder="Confirm new password"
                      value={pwData.confirmPassword}
                      onChange={e => setPwData({ ...pwData, confirmPassword: e.target.value })}
                      required
                    />
                    {pwMsg && (
                      <div style={{ color: pwMsg.includes('successfully') ? '#2e7d32' : '#c62828', fontSize: 13 }}>{pwMsg}</div>
                    )}
                    <button type="submit" className="panel-btn panel-btn-primary" style={{ width: 'fit-content' }}>
                      Update Password
                    </button>
                  </form>
                </div>

                <div className="panel-card">
                  <div className="panel-card-title">ðŸ”” Notification Preferences</div>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={user.preferences?.notifications ?? true}
                        onChange={async (e) => {
                          await updateProfile({ preferences: { ...user.preferences, notifications: e.target.checked } });
                        }}
                        style={{ width: 18, height: 18 }}
                      />
                      <span style={{ fontWeight: 600, fontSize: 14 }}>Price drop notifications</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={user.preferences?.newsletter ?? false}
                        onChange={async (e) => {
                          await updateProfile({ preferences: { ...user.preferences, newsletter: e.target.checked } });
                        }}
                        style={{ width: 18, height: 18 }}
                      />
                      <span style={{ fontWeight: 600, fontSize: 14 }}>Weekly deals newsletter</span>
                    </label>
                  </div>
                </div>

                <div className="panel-card" style={{ borderColor: '#fce4ec' }}>
                  <div className="panel-card-title" style={{ color: '#c62828' }}>âš ï¸ Danger Zone</div>
                  <p style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>
                    Once you delete your account, there is no going back. Please be certain.
                  </p>
                  <button
                    className="panel-btn panel-btn-danger"
                    onClick={async () => {
                      if (window.confirm('Are you sure you want to delete your account? This cannot be undone.')) {
                        const pw = window.prompt('Enter your password to confirm:');
                        if (pw) {
                          try {
                            const { deleteAccount } = await import('../context/AuthContext').then(m => ({ deleteAccount: null }));
                            // Use auth service directly
                            const authService = (await import('../api/auth')).default;
                            await authService.deleteAccount(pw);
                            navigate('/');
                          } catch (err) {
                            alert(err.message);
                          }
                        }
                      }
                    }}
                  >
                    ðŸ—‘ï¸ Delete My Account
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// PrePay v1 panel â€” fetches /api/insights/weekly
function PrePayPanel() {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const r = await fetch(`${API_BASE}/api/insights/weekly`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const data = await r.json();
        if (alive) setState({ loading: false, data, error: null });
      } catch (e) {
        if (alive) setState({ loading: false, data: null, error: e.message });
      }
    })();
    return () => { alive = false; };
  }, []);

  if (state.loading) return <div className="panel-loading">ðŸ¤– PrePay is analysing your activity...</div>;
  if (state.error) return <div className="panel-card"><div className="panel-card-title">PrePay</div><div style={{ color: '#dc2626' }}>Error: {state.error}</div></div>;

  const d = state.data || {};
  if (!d.ok && d.minRequired) {
    return (
      <div className="panel-card">
        <div className="panel-card-title">ðŸ’¸ PrePay â€” Spending Coach</div>
        <p style={{ color: 'var(--muted-foreground)' }}>
          PrePay needs at least <strong>{d.minRequired}</strong> tracked activities to generate insights.
          You currently have <strong>{d.count || 0}</strong>. Use Lens, search services, or click coupons â€”
          PrePay will start surfacing patterns and savings here.
        </p>
      </div>
    );
  }
  if (!d.ok) {
    return <div className="panel-card"><div className="panel-card-title">PrePay</div><div style={{ color: '#dc2626' }}>{d.error || 'Insights unavailable.'}</div></div>;
  }

  const ins = d.insights || {};
  const dig = d.digest || {};

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="panel-card">
        <div className="panel-card-title">ðŸ’¸ PrePay â€” Your Weekly Insights</div>
        <p style={{ fontSize: 16, lineHeight: 1.5, marginBottom: 12 }}>{ins.summary || 'â€”'}</p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--muted-foreground)' }}>
          <span>ðŸ“Š {dig.count} activities (last {dig.windowDays}d)</span>
          {typeof dig.totalSpend === 'number' && dig.totalSpend > 0 && <span>ðŸ’° ~${dig.totalSpend.toFixed(2)} CAD tracked</span>}
          {typeof ins.predictedNextWeekSpend === 'number' && <span>ðŸ“ˆ Predicted next week: ${ins.predictedNextWeekSpend} CAD</span>}
        </div>
      </div>

      {Array.isArray(ins.patterns) && ins.patterns.length > 0 && (
        <div className="panel-card">
          <div className="panel-card-title">ðŸ” Patterns</div>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {ins.patterns.map((p, i) => <li key={i} style={{ marginBottom: 6 }}>{p}</li>)}
          </ul>
        </div>
      )}

      {Array.isArray(ins.suggestions) && ins.suggestions.length > 0 && (
        <div className="panel-card">
          <div className="panel-card-title">ðŸ’¡ Suggestions</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {ins.suggestions.map((s, i) => (
              <div key={i} style={{ padding: 12, background: '#f8fafc', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontWeight: 700 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>{s.rationale}</div>
                {typeof s.potentialSavings === 'number' && (
                  <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 700, marginTop: 4 }}>
                    Potential savings: ${s.potentialSavings} CAD
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(ins.cheaperAlternatives) && ins.cheaperAlternatives.length > 0 && (
        <div className="panel-card">
          <div className="panel-card-title">ðŸ”€ Cheaper Alternatives</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {ins.cheaperAlternatives.map((a, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 10, borderRadius: 8, background: 'oklch(74% .18 155 / .15)' }}>
                <span><strong>{a.from}</strong> â†’ <strong>{a.to}</strong></span>
                <span style={{ color: '#16a34a', fontWeight: 700 }}>{a.estSavings}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {dig.topCategoriesText || (dig.byCategory && Object.keys(dig.byCategory).length > 0) ? (
        <div className="panel-card">
          <div className="panel-card-title">ðŸ—‚ï¸ Top categories</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(dig.byCategory || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, n]) => (
              <span key={c} style={{ padding: '4px 10px', borderRadius: 999, background: '#eef2ff', fontSize: 12, fontWeight: 600 }}>
                {c} Â· {n}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
