/**
 * Authentication Context
 *
 * WHY: Centralized authentication state management across the app
 * HOW: React Context with hooks for login, logout, and user state
 *
 * PROVIDES:
 * - Current user data
 * - Authentication status (loading, authenticated, unauthenticated)
 * - Login/logout functions
 * - Token management (localStorage)
 * - Automatic token refresh on mount
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi } from "@/api/auth";
import type {
  UserProfile,
  Token,
  EmailSignupRequest,
  EmailLoginRequest,
  WalletProvider,
  WalletVerifyRequest,
  CosmosWalletVerifyRequest,
} from "@/types/auth";

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Email authentication
  emailSignup: (data: EmailSignupRequest) => Promise<void>;
  emailLogin: (data: EmailLoginRequest) => Promise<void>;

  // Wallet authentication
  walletLogin: (
    provider: WalletProvider,
    data: WalletVerifyRequest | CosmosWalletVerifyRequest
  ) => Promise<void>;

  // Logout
  logout: () => void;

  // Utility
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!user;

  /**
   * Fetch current user profile
   */
  const fetchUserProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const profile = await authApi.getCurrentUser();
      setUser(profile);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch user profile:", err);
      setError(err.response?.data?.detail || "Failed to fetch user profile");
      // Clear token if profile fetch fails
      localStorage.removeItem("access_token");
      localStorage.removeItem("token_expires_at");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Store token and decode user info
   */
  const handleToken = useCallback(async (tokenData: Token) => {
    const { access_token, expires_in } = tokenData;

    // Store token
    localStorage.setItem("access_token", access_token);

    // Calculate expiration time
    const expiresAt = Date.now() + expires_in * 1000;
    localStorage.setItem("token_expires_at", expiresAt.toString());

    // Fetch full user profile - AWAIT to ensure it completes
    // (No need to decode token since we fetch full profile from API)
    await fetchUserProfile();
  }, [fetchUserProfile]); // Add fetchUserProfile to dependencies

  /**
   * Email signup
   */
  const emailSignup = useCallback(
    async (data: EmailSignupRequest) => {
      try {
        setIsLoading(true);
        setError(null);
        const tokenData = await authApi.emailSignup(data);
        await handleToken(tokenData); // AWAIT to ensure profile is fetched
      } catch (err: any) {
        console.error("Signup error:", err);

        // Provide user-friendly error messages
        if (err.code === 'ERR_NETWORK') {
          setError("Cannot connect to server. Please ensure the backend is running.");
        } else if (err.response?.data?.detail) {
          // Handle FastAPI validation errors
          const detail = err.response.data.detail;
          if (Array.isArray(detail)) {
            // Pydantic validation errors
            const messages = detail.map((e: any) => e.msg).join(", ");
            setError(messages);
          } else {
            setError(detail);
          }
        } else {
          setError("Signup failed. Please try again.");
        }
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [handleToken]
  );

  /**
   * Email login
   */
  const emailLogin = useCallback(
    async (data: EmailLoginRequest) => {
      try {
        setIsLoading(true);
        setError(null);
        const tokenData = await authApi.emailLogin(data);
        await handleToken(tokenData); // AWAIT to ensure profile is fetched before navigation
      } catch (err: any) {
        console.error("Login error:", err);

        // Provide user-friendly error messages
        if (err.code === 'ERR_NETWORK') {
          setError("Cannot connect to server. Please ensure the backend is running.");
        } else if (err.response?.data?.detail) {
          // Handle FastAPI validation errors
          const detail = err.response.data.detail;
          if (Array.isArray(detail)) {
            // Pydantic validation errors
            const messages = detail.map((e: any) => e.msg).join(", ");
            setError(messages);
          } else {
            setError(detail);
          }
        } else {
          setError("Login failed. Please try again.");
        }
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [handleToken]
  );

  /**
   * Wallet login (EVM, Solana, Cosmos)
   */
  const walletLogin = useCallback(
    async (
      provider: WalletProvider,
      data: WalletVerifyRequest | CosmosWalletVerifyRequest
    ) => {
      try {
        setIsLoading(true);
        setError(null);
        const tokenData = await authApi.verifyWalletSignature(provider, data);
        await handleToken(tokenData); // AWAIT to ensure profile is fetched
      } catch (err: any) {
        console.error("Wallet login error:", err);

        // Provide user-friendly error messages
        if (err.code === 'ERR_NETWORK') {
          setError("Cannot connect to server. Please ensure the backend is running.");
        } else if (err.response?.data?.detail) {
          const detail = err.response.data.detail;
          if (Array.isArray(detail)) {
            const messages = detail.map((e: any) => e.msg).join(", ");
            setError(messages);
          } else {
            setError(detail);
          }
        } else {
          setError("Wallet authentication failed. Please try again.");
        }
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [handleToken]
  );

  /**
   * Logout
   */
  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token_expires_at");
    setUser(null);
    setError(null);
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Check token on mount and restore session
   */
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const expiresAt = localStorage.getItem("token_expires_at");

    if (token && expiresAt) {
      const now = Date.now();
      const expiry = parseInt(expiresAt, 10);

      if (now < expiry) {
        // Token is still valid, fetch user profile
        fetchUserProfile();
      } else {
        // Token expired, clear it
        localStorage.removeItem("access_token");
        localStorage.removeItem("token_expires_at");
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [fetchUserProfile]);

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    error,
    emailSignup,
    emailLogin,
    walletLogin,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use authentication context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
