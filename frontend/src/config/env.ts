/**
 * Environment Configuration
 *
 * This module provides runtime configuration that works in both development and production.
 *
 * HOW IT WORKS:
 *
 * 1. DEVELOPMENT (npm run dev):
 *    - Uses VITE_* environment variables from .env files
 *    - Variables are replaced at build time by Vite
 *    - Fast refresh works
 *
 * 2. PRODUCTION (Docker container):
 *    - Uses window.ENV_CONFIG set by /config.js
 *    - config.js is generated at container startup
 *    - Allows same Docker image to work in different environments
 *    - No rebuild needed when changing API URLs
 *
 * USAGE:
 *    import { config } from '@/config/env';
 *
 *    fetch(`${config.API_BASE_URL}/chatbots`);
 */

// Declare window.ENV_CONFIG type
declare global {
  interface Window {
    ENV_CONFIG?: {
      API_BASE_URL: string;
      WIDGET_CDN_URL: string;
      ENVIRONMENT: string;
    };
  }
}

/**
 * Get configuration value with fallback priority:
 * 1. Runtime config (window.ENV_CONFIG) - Production
 * 2. Build-time env vars (import.meta.env) - Development
 * 3. Default value
 *
 * Note: Must use direct env var access (not dynamic) for Vite's static replacement
 */
function getConfigValue(
  runtimeKey: keyof NonNullable<typeof window.ENV_CONFIG>,
  buildTimeValue: string | undefined,
  defaultValue: string
): string {
  // Check if we have runtime config (production)
  if (typeof window !== 'undefined' && window.ENV_CONFIG) {
    const value = window.ENV_CONFIG[runtimeKey];
    // If value hasn't been replaced (still has placeholder), use default
    if (value && !value.startsWith('__')) {
      return value;
    }
  }

  // Check build-time environment variables (Vite replaces these at build time)
  if (buildTimeValue) {
    return buildTimeValue;
  }

  // Fallback to default
  return defaultValue;
}

/**
 * Application Configuration
 *
 * These values are accessible throughout the application
 */
export const config = {
  /**
   * Backend API Base URL
   * Examples:
   * - Development: http://localhost:8000/api/v1
   * - Staging: https://staging-api.company.com/api/v1
   * - Production: https://api.company.com/api/v1
   */
  API_BASE_URL: getConfigValue(
    'API_BASE_URL',
    import.meta.env.VITE_API_BASE_URL,
    'http://localhost:8000/api/v1'
  ),

  /**
   * Widget CDN URL
   * Where the chat widget JavaScript is hosted
   */
  WIDGET_CDN_URL: getConfigValue(
    'WIDGET_CDN_URL',
    import.meta.env.VITE_WIDGET_CDN_URL,
    'http://localhost:8080'
  ),

  /**
   * Environment name
   * Used for debugging and feature flags
   */
  ENVIRONMENT: getConfigValue(
    'ENVIRONMENT',
    import.meta.env.VITE_ENV,
    'development'
  ),

  /**
   * Is production environment?
   */
  IS_PRODUCTION: getConfigValue('ENVIRONMENT', import.meta.env.VITE_ENV, 'development') === 'production',

  /**
   * Is development environment?
   */
  IS_DEVELOPMENT: getConfigValue('ENVIRONMENT', import.meta.env.VITE_ENV, 'development') === 'development',
} as const;

// Log configuration in development (helps debugging)
if (config.IS_DEVELOPMENT) {
  console.log('🔧 App Configuration:', config);
}

export default config;
