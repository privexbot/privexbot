/**
 * Authentication Types
 *
 * WHY: Type-safe authentication data structures matching backend API
 * HOW: Define interfaces for requests, responses, and user data
 */

export interface User {
  id: string;
  username: string;
  avatar_url?: string;
  is_active: boolean;
  is_staff?: boolean;
  has_beta_access?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthMethod {
  provider: "email" | "evm" | "solana" | "cosmos";
  provider_id: string;
  linked_at: string;
}

export interface UserProfile extends User {
  email?: string;
  is_staff: boolean;
  has_beta_access: boolean;
  auth_methods: AuthMethod[];
}

export interface Token {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface TokenPayload {
  sub: string; // user ID
  email?: string;
  exp: number;
  iat: number;
}

// Request types
export interface EmailSignupRequest {
  username: string;
  email: string;
  password: string;
  /**
   * Optional referral code from `?ref=…` on the signup URL. Backend
   * matches it against `User.referral_code` and writes a Referral row.
   */
  referral_code?: string;
}

export interface EmailLoginRequest {
  email: string;
  password: string;
}

export interface WalletChallengeRequest {
  address: string;
}

export interface WalletChallengeResponse {
  message: string;
  nonce: string;
}

export interface WalletVerifyRequest {
  address: string;
  signed_message: string;
  signature: string;
  username?: string;
}

export interface CosmosWalletVerifyRequest extends WalletVerifyRequest {
  public_key: string;
}

export type WalletProvider = "evm" | "solana" | "cosmos";
