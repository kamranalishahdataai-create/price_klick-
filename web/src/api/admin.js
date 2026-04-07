// Admin API client — all requests include auth headers
import authService from './auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050';

async function adminFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...authService.getAuthHeaders(),
    ...options.headers
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json();

  if (res.status === 401) {
    // Try refreshing token
    const refreshed = await authService.refreshAccessToken();
    if (refreshed) {
      const retryHeaders = { ...headers, ...authService.getAuthHeaders() };
      const retry = await fetch(`${API_URL}${path}`, { ...options, headers: retryHeaders });
      return retry.json();
    }
    throw new Error('Session expired. Please login again.');
  }

  if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
  return data;
}

// Dashboard stats
export async function getAdminStats() {
  return adminFetch('/api/admin/stats');
}

// Users
export async function getUsers({ page = 1, limit = 20, search = '', role = '', sortBy = 'createdAt', sortOrder = 'desc' } = {}) {
  const params = new URLSearchParams({ page, limit, search, role, sortBy, sortOrder });
  return adminFetch(`/api/admin/users?${params}`);
}

export async function getUser(id) {
  return adminFetch(`/api/admin/users/${id}`);
}

export async function updateUser(id, data) {
  return adminFetch(`/api/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function deleteUser(id) {
  return adminFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
}

export async function suspendUser(id, suspended) {
  return adminFetch(`/api/admin/users/${id}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ suspended })
  });
}

// Analytics
export async function getTrending(limit = 20) {
  return adminFetch(`/api/admin/analytics/trending?limit=${limit}`);
}

export async function getBrandStats(brand) {
  return adminFetch(`/api/admin/analytics/brand/${encodeURIComponent(brand)}`);
}

export async function getBrandAlerts() {
  return adminFetch('/api/admin/analytics/brand-alerts');
}

export async function resetBrandAlert(brand) {
  return adminFetch(`/api/admin/analytics/brand-alerts/reset/${encodeURIComponent(brand)}`, {
    method: 'POST'
  });
}

export async function processAlerts() {
  return adminFetch('/api/admin/analytics/brand-alerts/process', { method: 'POST' });
}

// Settings
export async function getSettings() {
  return adminFetch('/api/admin/settings');
}

// Bootstrap (promote to admin)
export async function bootstrapAdmin() {
  return adminFetch('/api/admin/bootstrap', { method: 'POST' });
}

// User-facing API calls (with auth)
export async function getUserSearchHistory() {
  return adminFetch('/api/search/history');
}

export async function getUserRecommendations() {
  return adminFetch('/api/recommendations');
}
