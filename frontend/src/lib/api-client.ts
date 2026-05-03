/**
 * API Client - Axios instance with interceptors
 *
 * WHY:
 * - Centralized HTTP client
 * - Automatic token injection
 * - Request/response transformation
 * - Error handling
 *
 * HOW:
 * - Axios interceptors
 * - Token refresh logic
 * - TypeScript types
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { config } from '@/config/env';

// Use centralized config for consistent environment variable access
const API_BASE_URL = config.API_BASE_URL;

// Create axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 - Token expired
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Attempt token refresh
        const refreshToken = localStorage.getItem('refresh_token');

        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });

          const { access_token } = response.data;
          localStorage.setItem('access_token', access_token);

          // Retry original request
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
          }
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - logout
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Handle 402 - Quota exceeded / feature locked.
    // Backend wraps both quota exhaustion and feature gates in HTTP 402
    // with a structured detail. The dashboard listens to
    // `quota-exceeded` events and shows the upgrade modal.
    if (error.response?.status === 402) {
      const errorDetail = (error.response?.data as { detail?: unknown })?.detail;
      if (errorDetail && typeof errorDetail === "object") {
        const payload = errorDetail as {
          error?: string;
          resource?: string;
          feature?: string;
          tier?: string;
          limit?: number;
          usage?: number;
          upgrade_url?: string;
        };
        if (payload.error === "quota_exceeded" || payload.error === "feature_locked") {
          window.dispatchEvent(
            new CustomEvent("quota-exceeded", {
              detail: payload,
            }),
          );
        }
      }
    }

    // Handle 400 - NO_ORGANIZATION error (user deleted all orgs)
    if (error.response?.status === 400) {
      const errorDetail = (error.response?.data as any)?.detail;

      // Check if it's a structured error response from backend
      if (errorDetail && typeof errorDetail === 'object') {
        const errorCode = (errorDetail as any).error_code;

        if (errorCode === 'NO_ORGANIZATION' || errorCode === 'ORGANIZATION_DELETED') {
          // Emit custom event for NO_ORGANIZATION error
          // Components can listen to this and show "Create Organization" modal
          window.dispatchEvent(new CustomEvent('no-organization-error', {
            detail: {
              error_code: errorCode,
              message: (errorDetail as any).message,
              action_required: (errorDetail as any).action_required,
              suggestions: (errorDetail as any).suggestions,
            }
          }));

          // Add error code to error object for component-level handling
          (error as any).errorCode = errorCode;
        }
      }
    }

    return Promise.reject(error);
  }
);

// Human-friendly labels for the 402 quota/feature payloads. Kept here
// (duplicated with `lib/plans.ts`) so api-client stays standalone — any
// caller of handleApiError gets readable text instead of raw JSON.
const QUOTA_RESOURCE_LABEL: Record<string, string> = {
  chatbots: "chatbots",
  chatflows: "chatflows",
  knowledge_bases: "knowledge bases",
  kb_documents: "knowledge base documents",
  web_pages_per_month: "web pages scraped this month",
  messages_per_month: "messages this month",
  api_calls_per_month: "API calls this month",
  team_members: "team members",
  workspaces: "workspaces",
  owned_orgs: "organizations you own",
};

const FEATURE_LABEL: Record<string, string> = {
  public_api_access: "Public REST API access",
  custom_domain: "Custom domain",
  remove_branding: "Branding removal",
  sso_saml: "SSO / SAML",
};

// API error handler - Enhanced to handle structured errors
export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;

    // Handle structured error responses (from backend)
    if (detail && typeof detail === 'object') {
      const structuredError = detail as any;

      // 402 quota / feature payloads — render human copy instead of
      // the raw JSON so forms don't surface "{error:'quota_exceeded',
      // resource:'owned_orgs',...}" to end users. Mirrors the
      // UpgradeModal copy.
      if (structuredError.error === 'quota_exceeded') {
        const tier = structuredError.tier ?? 'free';
        const resourceKey = String(structuredError.resource ?? '');
        const resourceLabel = QUOTA_RESOURCE_LABEL[resourceKey] ?? resourceKey;
        const limit = typeof structuredError.limit === 'number'
          ? structuredError.limit.toLocaleString()
          : 'your';
        return `You've reached the ${tier} plan's cap of ${limit} ${resourceLabel}. Upgrade for more headroom.`;
      }
      if (structuredError.error === 'feature_locked') {
        const tier = structuredError.tier ?? 'free';
        const featureKey = String(structuredError.feature ?? '');
        const featureLabel = FEATURE_LABEL[featureKey] ?? featureKey;
        return `${featureLabel} isn't included in the ${tier} plan. Upgrade to unlock it.`;
      }

      // Return the message from structured error
      if (structuredError.message) {
        return structuredError.message;
      }

      // Handle array of validation errors
      if (Array.isArray(structuredError)) {
        return structuredError.map((e: any) => e.msg || e.message || String(e)).join(', ');
      }

      // Handle object errors
      if (structuredError.msg || structuredError.error) {
        return structuredError.msg || structuredError.error;
      }

      // Fallback: stringify the object
      return JSON.stringify(structuredError);
    }

    // Handle simple string errors
    if (typeof detail === 'string') {
      return detail;
    }

    // Fallback to error message
    if (error.message) {
      return error.message;
    }
  }

  return 'An unexpected error occurred';
};

// Check if error is NO_ORGANIZATION error
export const isNoOrganizationError = (error: unknown): boolean => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (detail && typeof detail === 'object') {
      const errorCode = (detail as any).error_code;
      return errorCode === 'NO_ORGANIZATION' || errorCode === 'ORGANIZATION_DELETED';
    }
  }
  return false;
};

export default apiClient;
