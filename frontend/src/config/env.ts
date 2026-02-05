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

// Type-safe accessor for Vite env variables
function getViteEnv(key: string): string | undefined {
  return import.meta.env[key] as string | undefined;
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
 * IMPORTANT: Uses getter functions for lazy evaluation to handle runtime config loading
 * This ensures window.ENV_CONFIG is checked each time, not just at module load time
 */
export const config = {
  /**
   * Backend API Base URL
   * Examples:
   * - Development: http://localhost:8000/api/v1
   * - Staging: https://staging-api.company.com/api/v1
   * - Production: https://api.company.com/api/v1
   */
  get API_BASE_URL() {
    return getConfigValue(
      'API_BASE_URL',
      getViteEnv('VITE_API_BASE_URL'),
      'http://localhost:8000/api/v1'
    );
  },

  /**
   * Widget CDN URL
   * Where the chat widget JavaScript is hosted
   */
  get WIDGET_CDN_URL() {
    return getConfigValue(
      'WIDGET_CDN_URL',
      getViteEnv('VITE_WIDGET_CDN_URL'),
      'http://localhost:9000'
    );
  },

  /**
   * Environment name
   * Used for debugging and feature flags
   */
  get ENVIRONMENT() {
    return getConfigValue(
      'ENVIRONMENT',
      getViteEnv('VITE_ENV'),
      'development'
    );
  },

  /**
   * Is production environment?
   */
  get IS_PRODUCTION() {
    return this.ENVIRONMENT === 'production';
  },

  /**
   * Is development environment?
   */
  get IS_DEVELOPMENT() {
    return this.ENVIRONMENT === 'development';
  },
} as const;

// Log configuration in development (helps debugging)
// Use setTimeout to ensure DOM and runtime config are loaded
setTimeout(() => {
  if (config.IS_DEVELOPMENT) {
    // eslint-disable-next-line no-console
    console.info('🔧 App Configuration:', {
      API_BASE_URL: config.API_BASE_URL,
      WIDGET_CDN_URL: config.WIDGET_CDN_URL,
      ENVIRONMENT: config.ENVIRONMENT,
      IS_PRODUCTION: config.IS_PRODUCTION,
      IS_DEVELOPMENT: config.IS_DEVELOPMENT,
    });
  }
}, 0);

export default config;