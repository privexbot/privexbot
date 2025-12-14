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
    const url = `/auth/${provider}/link`;
    console.log(`[AuthAPI] Linking wallet to ${url} with data:`, {
      provider,
      address: data.address,
      signed_message_length: data.signed_message?.length || 0,
      signature_length: data.signature?.length || 0,
      has_public_key: 'public_key' in data ? 'YES' : 'NO'
    });

    try {
      await this.client.post(url, data);
      console.log(`[AuthAPI] Successfully linked ${provider} wallet`);
    } catch (error) {
      console.error(`[AuthAPI] Failed to link ${provider} wallet:`, error);
      throw error;
    }
  }

  /**
   * Send email verification code for linking email to existing account
   */
  async sendEmailLinkVerification(data: {
    email: string;
    password: string;
  }): Promise<{
    message: string;
    code_sent: boolean;
    expires_in: number;
  }> {
    const response = await this.client.post("/auth/email/send-link-verification", data);
    return response.data;
  }

  /**
   * Verify email code and link email to existing account
   */
  async verifyEmailAndLink(data: {
    email: string;
    code: string;
  }): Promise<void> {
    await this.client.post("/auth/email/verify-and-link", data);
  }

  /**
   * Link email/password to existing account (requires authentication)
   * @deprecated Use sendEmailLinkVerification + verifyEmailAndLink instead
   */
  async linkEmail(data: { email: string; password: string }): Promise<void> {
    await this.client.post("/auth/email/link", data);
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
  async validateResetToken(token: string): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      await this.client.post("/auth/password-reset/validate", { token });
      return { valid: true };
    } catch (error: any) {
      console.error('Token validation failed:', error);
      const errorMessage = error.response?.data?.detail || "Reset token is invalid or expired";
      return {
        valid: false,
        error: errorMessage
      };
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

  // ============================================================
  // PROFILE MANAGEMENT
  // ============================================================

  /**
   * Update current user's profile
   */
  async updateProfile(data: { username?: string }): Promise<UserProfile> {
    const response = await this.client.put("/auth/me", data);
    return response.data;
  }

  /**
   * Delete current user's account
   */
  async deleteAccount(): Promise<{ message: string; deleted_at: string }> {
    const response = await this.client.delete("/auth/me");
    return response.data;
  }

  // ============================================================
  // AUTH METHOD MANAGEMENT
  // ============================================================

  /**
   * Unlink authentication method from current user's account
   */
  async unlinkAuthMethod(provider: string, providerId: string): Promise<{
    message: string;
    removed_provider: string;
    removed_identifier: string;
  }> {
    const response = await this.client.delete(`/auth/auth-method/${provider}/${providerId}`);
    return response.data;
  }
}

export const authApi = new AuthApiClient();
