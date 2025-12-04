/**
 * Authentication API Client
 *
 * WHY: Centralized authentication API calls to backend
 * HOW: Axios-based client with type-safe requests/responses
 *
 * ENDPOINTS:
 * - Email: signup, login, change-password
 * - EVM Wallet: challenge, verify, link
 * - Solana Wallet: challenge, verify, link
 * - Cosmos Wallet: challenge, verify, link
 */

import axios, { AxiosInstance } from "axios";
import { config } from "@/config/env";
import type {
  Token,
  EmailSignupRequest,
  EmailLoginRequest,
  WalletChallengeRequest,
  WalletChallengeResponse,
  WalletVerifyRequest,
  CosmosWalletVerifyRequest,
  WalletProvider,
  UserProfile,
} from "@/types/auth";

// Use centralized config for consistent environment variable access
const API_BASE_URL = config.API_BASE_URL;

// Log API configuration for debugging
console.log("[AuthAPI] Configuration:", {
  API_BASE_URL,
  environment: config.ENVIRONMENT,
  isProduction: config.IS_PRODUCTION,
});

class AuthApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 30000, // 30 second timeout
    });

    // Add auth token to requests if available
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem("access_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor for better error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.code === 'ERR_NETWORK') {
          console.error('[AuthAPI] Network error - Backend not reachable:', {
            baseURL: API_BASE_URL,
            message: 'Ensure backend is running and accessible',
          });
        }
        return Promise.reject(error);
      }
    );
  }

  // ============================================================
  // EMAIL AUTHENTICATION
  // ============================================================

  /**
   * Register a new user with email and password
   */
  async emailSignup(data: EmailSignupRequest): Promise<Token> {
    const response = await this.client.post<Token>("/auth/email/signup", data);
    return response.data;
  }

  /**
   * Login with email and password
   */
  async emailLogin(data: EmailLoginRequest): Promise<Token> {
    const response = await this.client.post<Token>("/auth/email/login", data);
    return response.data;
  }

  /**
   * Enhanced login that can detect new users for signup flow
   */
  async enhancedEmailLogin(data: EmailLoginRequest): Promise<{
    status: "success" | "invalid_credentials" | "email_not_found";
    message?: string;
    token?: Token;
    email?: string;
  }> {
    const response = await this.client.post("/auth/email/login-enhanced", data);
    return response.data;
  }

  /**
   * Send email verification code for new user signup
   */
  async sendEmailVerification(data: {
    email: string;
    password: string;
    username: string;
  }): Promise<{
    message: string;
    code_sent: boolean;
    expires_in: number;
  }> {
    const response = await this.client.post("/auth/email/send-verification", data);
    return response.data;
  }

  /**
   * Verify email code and complete signup
   */
  async verifyEmailAndSignup(data: {
    email: string;
    code: string;
  }): Promise<Token> {
    const response = await this.client.post("/auth/email/verify-and-signup", data);
    return response.data;
  }

  /**
   * Change password (requires authentication)
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await this.client.post("/auth/email/change-password", {
      old_password: oldPassword,
      new_password: newPassword,
    });
  }

  // ============================================================
  // WALLET AUTHENTICATION
  // ============================================================

  /**
   * Request challenge message for wallet signature
   */
  async requestWalletChallenge(
    provider: WalletProvider,
    data: WalletChallengeRequest
  ): Promise<WalletChallengeResponse> {
    const response = await this.client.post<WalletChallengeResponse>(
      `/auth/${provider}/challenge`,
      data
    );
    return response.data;
  }

  /**
   * Verify wallet signature and authenticate
   */
  async verifyWalletSignature(
    provider: WalletProvider,
    data: WalletVerifyRequest | CosmosWalletVerifyRequest
  ): Promise<Token> {
    const response = await this.client.post<Token>(`/auth/${provider}/verify`, data);
    return response.data;
  }

  /**
   * Link wallet to existing account (requires authentication)
   */
  async linkWallet(
    provider: WalletProvider,
    data: WalletVerifyRequest | CosmosWalletVerifyRequest
  ): Promise<void> {
    await this.client.post(`/auth/${provider}/link`, data);
  }

  // ============================================================
  // USER PROFILE
  // ============================================================

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<UserProfile> {
    const response = await this.client.get<UserProfile>("/auth/me");
    return response.data;
  }

  // ============================================================
  // PASSWORD RESET
  // ============================================================

  /**
   * Request password reset email
   */
  async requestPasswordReset(email: string): Promise<{
    message: string;
    email_sent: boolean;
    reset_link?: string;
  }> {
    const response = await this.client.post("/auth/password-reset/request", { email });
    return response.data;
  }

  /**
   * Validate password reset token
   */
  async validateResetToken(token: string): Promise<boolean> {
    try {
      await this.client.post("/auth/password-reset/validate", { token });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    await this.client.post("/auth/password-reset/confirm", {
      token,
      new_password: newPassword,
    });
  }
}

export const authApi = new AuthApiClient();
