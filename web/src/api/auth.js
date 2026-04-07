// Authentication API client
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050';

class AuthService {
  constructor() {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  // Get auth headers
  getAuthHeaders() {
    return this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {};
  }

  // Save tokens
  saveTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  // Clear tokens
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  // Save user to localStorage
  saveUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  // Get user from localStorage
  getStoredUser() {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  }

  // Register new user
  async register({ email, password, firstName, lastName }) {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, firstName, lastName })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Registration failed');
    }

    this.saveTokens(data.accessToken, data.refreshToken);
    this.saveUser(data.user);

    return data;
  }

  // Login user
  async login({ email, password }) {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Login failed');
    }

    this.saveTokens(data.accessToken, data.refreshToken);
    this.saveUser(data.user);

    return data;
  }

  // Logout user
  async logout() {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearTokens();
    }
  }

  // Logout from all devices
  async logoutAll() {
    try {
      await fetch(`${API_URL}/api/auth/logout-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        }
      });
    } catch (error) {
      console.error('Logout all error:', error);
    } finally {
      this.clearTokens();
    }
  }

  // Get current user
  async getCurrentUser() {
    if (!this.accessToken) return null;

    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Try to refresh token
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          return this.getCurrentUser();
        }
        this.clearTokens();
        return null;
      }
      throw new Error('Failed to get user');
    }

    const data = await response.json();
    this.saveUser(data.user);
    return data.user;
  }

  // Refresh access token
  async refreshAccessToken() {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${API_URL}/api/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });

      if (!response.ok) {
        this.clearTokens();
        return false;
      }

      const data = await response.json();
      this.saveTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      this.clearTokens();
      return false;
    }
  }

  // Update profile
  async updateProfile({ firstName, lastName, preferences }) {
    const response = await fetch(`${API_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({ firstName, lastName, preferences })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Update failed');
    }

    this.saveUser(data.user);
    return data;
  }

  // Change password
  async changePassword({ currentPassword, newPassword }) {
    const response = await fetch(`${API_URL}/api/auth/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Password change failed');
    }

    this.saveTokens(data.accessToken, data.refreshToken);
    return data;
  }

  // Forgot password
  async forgotPassword(email) {
    const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  }

  // Reset password
  async resetPassword({ token, password }) {
    const response = await fetch(`${API_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Reset failed');
    }

    return data;
  }

  // Verify email
  async verifyEmail(token) {
    const response = await fetch(`${API_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Verification failed');
    }

    return data;
  }

  // Delete account
  async deleteAccount(password) {
    const response = await fetch(`${API_URL}/api/auth/account`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({ password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Deletion failed');
    }

    this.clearTokens();
    return data;
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.accessToken;
  }
}

// Export singleton instance
const authService = new AuthService();
export default authService;
