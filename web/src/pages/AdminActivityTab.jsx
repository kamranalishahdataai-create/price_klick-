import React from 'react';

// Full user-activity stream across the platform (Lens scans, service searches,
// menu views, smart compares, deals, clicks…). Rendered inside AdminPanel.
const ACT_TYPES = {
  lens_scan:        { icon: '🔍', label: 'Lens Scan' },
  service_search:   { icon: '🔎', label: 'Service Search' },
  service_click:    { icon: '👆', label: 'Service Click' },
  service_favorite: { icon: '⭐', label: 'Favorite' },
  menu_view:        { icon: '📋', label: 'Menu View' },
  deal_search:      { icon: '💸', label: 'Deal Search' },
  smart_compare:    { icon: '⚖️', label: 'Smart Compare' },
  compare:          { icon: '⚖️', label: 'Compare' },
  product_click:    { icon: '🛒', label: 'Product Click' },
  coupon_apply:     { icon: '🏷️', label: 'Coupon Apply' },
  flyer_view:       { icon: '📰', label: 'Flyer View' },
};
const actMeta = (t) => ACT_TYPES[t] || { icon: '•', label: t };

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function TopList({ title, items, keyName }) {
  return (
    <div className="panel-card">
      <div className="panel-card-title">{title}</div>
      {(!items || items.length === 0) ? (
        <p style={{ color: '#888', fontSize: 13 }}>No data yet</p>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{it[keyName]}</span>
              <span className="badge badge-info">{it.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ActivityTab({ activity, loading, days, onDays, onRefresh }) {
  if (loading && !activity) return <div className="panel-loading">Loading activity…</div>;
  if (!activity) return null;

  const maxType = Math.max(1, ...(activity.byType || []).map(t => t.count));
  const maxDay = Math.max(1, ...(activity.daily || []).map(d => d.count));

  return (
    <>
      {/* Controls */}
      <div className="filter-row" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[7, 30, 90].map(d => (
            <button key={d} className={`panel-btn ${days === d ? 'panel-btn-primary' : 'panel-btn-ghost'} panel-btn-sm`} onClick={() => onDays(d)}>
              {d}d
            </button>
          ))}
        </div>
        <button className="panel-btn panel-btn-ghost panel-btn-sm" style={{ marginLeft: 'auto' }} onClick={onRefresh}>🔄 Refresh</button>
      </div>

      {/* Headline stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon">📡</div>
          <div className="stat-value">{Number(activity.total).toLocaleString()}</div>
          <div className="stat-label">Total Events ({activity.windowDays}d)</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">👤</div>
          <div className="stat-value">{Number(activity.uniqueUsers).toLocaleString()}</div>
          <div className="stat-label">Logged-in Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🌐</div>
          <div className="stat-value">{Number(activity.uniqueSessions).toLocaleString()}</div>
          <div className="stat-label">Anonymous Sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🗂️</div>
          <div className="stat-value">{(activity.byType || []).length}</div>
          <div className="stat-label">Event Types Captured</div>
        </div>
      </div>

      {/* Events by type */}
      <div className="panel-card">
        <div className="panel-card-title">📊 Events by Type</div>
        {(activity.byType || []).length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📭</div><div className="empty-text">No activity captured yet</div></div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {activity.byType.map(t => {
              const m = actMeta(t.type);
              return (
                <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 150, fontSize: 13, fontWeight: 600 }}>{m.icon} {m.label}</div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,.05)', borderRadius: 8, height: 22, overflow: 'hidden' }}>
                    <div style={{ width: `${(t.count / maxType) * 100}%`, height: '100%', background: 'linear-gradient(90deg,#6D4AFF,#22d3ee)', borderRadius: 8 }} />
                  </div>
                  <div style={{ width: 60, textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{t.count.toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Daily trend */}
      {(activity.daily || []).length > 1 && (
        <div className="panel-card">
          <div className="panel-card-title">📈 Daily Volume</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
            {activity.daily.map(d => (
              <div key={d.date} title={`${d.date}: ${d.count}`} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                <div style={{ height: `${(d.count / maxDay) * 100}%`, background: 'linear-gradient(180deg,#6D4AFF,#22d3ee)', borderRadius: '4px 4px 0 0', minHeight: 2 }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top lists */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
        <TopList title="🔥 Top Categories" items={activity.topCategories} keyName="category" />
        <TopList title="🔎 Top Searches" items={activity.topQueries} keyName="query" />
        <TopList title="🏷️ Top Brands" items={activity.topBrands} keyName="brand" />
      </div>

      {/* Recent feed */}
      <div className="panel-card">
        <div className="panel-card-title">🕐 Recent Activity ({(activity.recent || []).length})</div>
        {(activity.recent || []).length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📭</div><div className="empty-text">No recent events</div></div>
        ) : (
          <table className="panel-table">
            <thead><tr><th>Type</th><th>Detail</th><th>Who</th><th>Location</th><th>When</th></tr></thead>
            <tbody>
              {activity.recent.map(r => {
                const m = actMeta(r.type);
                return (
                  <tr key={r.id}>
                    <td><span className="badge badge-info">{m.icon} {m.label}</span></td>
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <strong>{r.query || r.productName || r.brand || '—'}</strong>
                      {r.category && r.category !== r.query && <span style={{ color: '#888', fontSize: 12 }}> · {r.category}</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>{r.anon ? <span className="badge badge-warning">anon</span> : r.user}</td>
                    <td style={{ fontSize: 12, color: '#888' }}>{r.city || '—'}</td>
                    <td style={{ fontSize: 12, color: '#888' }}>{timeAgo(r.at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
