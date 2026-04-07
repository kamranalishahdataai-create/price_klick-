import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import authService from "../api/auth";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.getStoredUser());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (authService.isAuthenticated()) {
          const currentUser = await authService.getCurrentUser();
          setUser(currentUser);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Register
  const register = useCallback(async ({ email, password, firstName, lastName }) => {
    setError(null);
    try {
      const data = await authService.register({ email, password, firstName, lastName });
      setUser(data.user);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Login
  const login = useCallback(async ({ email, password }) => {
    setError(null);
    try {
      const data = await authService.login({ email, password });
      setUser(data.user);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  }, []);

  // Logout all devices
  const logoutAll = useCallback(async () => {
    try {
      await authService.logoutAll();
    } finally {
      setUser(null);
    }
  }, []);

  // Update profile
  const updateProfile = useCallback(async (profileData) => {
    setError(null);
    try {
      const data = await authService.updateProfile(profileData);
      setUser(data.user);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Change password
  const changePassword = useCallback(async ({ currentPassword, newPassword }) => {
    setError(null);
    try {
      return await authService.changePassword({ currentPassword, newPassword });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Forgot password
  const forgotPassword = useCallback(async (email) => {
    setError(null);
    try {
      return await authService.forgotPassword(email);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Reset password
  const resetPassword = useCallback(async ({ token, password }) => {
    setError(null);
    try {
      return await authService.resetPassword({ token, password });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Verify email
  const verifyEmail = useCallback(async (token) => {
    setError(null);
    try {
      const result = await authService.verifyEmail(token);
      // Refresh user data after verification
      if (user) {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      }
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [user]);

  // Delete account
  const deleteAccount = useCallback(async (password) => {
    setError(null);
    try {
      const result = await authService.deleteAccount(password);
      setUser(null);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    register,
    login,
    logout,
    logoutAll,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    verifyEmail,
    deleteAccount,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
