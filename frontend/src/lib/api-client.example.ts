/**
 * API Client Example
 *
 * This shows how to use the environment configuration in your API client
 */

import axios from 'axios';
import { config } from '@/config/env';

/**
 * Create axios instance with runtime configuration
 *
 * IMPORTANT: This uses config.API_BASE_URL which adapts to the environment
 */
export const apiClient = axios.create({
  baseURL: config.API_BASE_URL, // ← Uses runtime config!
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor - Add auth token
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response interceptor - Handle errors
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Example usage in your code:
// const response = await apiClient.get('/chatbots');
// The URL will be: ${config.API_BASE_URL}/chatbots
// Which adapts based on environment!
