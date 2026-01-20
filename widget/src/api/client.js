/**
 * API Client for PrivexBot Widget
 * Uses native fetch API for minimal bundle size
 *
 * Endpoints used:
 * - POST /api/v1/public/bots/{bot_id}/chat - Send message
 * - POST /api/v1/public/bots/{bot_id}/events - Track events
 * - POST /api/v1/public/leads/capture - Submit lead
 * - GET /api/v1/public/bots/{bot_id}/config - Get widget config
 */

class WidgetAPIClient {
  constructor(baseURL, chatbotId, apiKey = null) {
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
    this.chatbotId = chatbotId;
    this.apiKey = apiKey;
    this.sessionId = this.getOrCreateSessionId();
    this.timeout = 60000; // 60 second timeout for AI responses
  }

  getOrCreateSessionId() {
    const storageKey = `privexbot_session_${this.chatbotId}`;

    try {
      let sessionId = localStorage.getItem(storageKey);

      if (!sessionId) {
        // Generate session ID with browser-specific component for uniqueness
        // Format: widget_{timestamp}_{random}_{browserHash}
        const timestamp = Date.now();
        const random = Math.random().toString(36).slice(2, 11);
        const browserHash = this._getBrowserHash();
        sessionId = `widget_${timestamp}_${random}_${browserHash}`;
        localStorage.setItem(storageKey, sessionId);
      }

      return sessionId;
    } catch (e) {
      // localStorage not available (private browsing, etc.)
      // Use ephemeral session with browser hash for uniqueness
      const timestamp = Date.now();
      const random = Math.random().toString(36).slice(2, 11);
      const browserHash = this._getBrowserHash();
      return `widget_${timestamp}_${random}_${browserHash}`;
    }
  }

  /**
   * Generate a simple browser fingerprint hash for session uniqueness.
   * This helps differentiate sessions from different browsers/devices
   * even if they somehow generate the same timestamp+random combination.
   *
   * WHY: Prevents session collision across different browsers
   * HOW: Hash screen dimensions + timezone offset (stable, non-identifying)
   */
  _getBrowserHash() {
    try {
      // Use stable browser properties that don't identify the user
      // but help differentiate browsers/devices
      const screenInfo = `${screen.width}x${screen.height}`;
      const timezoneOffset = new Date().getTimezoneOffset();
      const hint = `${screenInfo}_${timezoneOffset}`;
      return this._simpleHash(hint);
    } catch (e) {
      // Fallback if screen API not available
      return Math.random().toString(36).slice(2, 8);
    }
  }

  /**
   * Simple string hash function (DJB2 algorithm variant)
   */
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).slice(0, 6);
  }

  /**
   * Make a fetch request with timeout and error handling
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add API key if provided
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.detail || `HTTP ${response.status}`);
        error.status = response.status;
        error.data = errorData;
        throw error;
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        error.message = 'Request timeout';
        error.status = 408;
      }

      throw error;
    }
  }

  /**
   * Send a chat message to the chatbot
   * Uses the unified public chat endpoint
   */
  async sendMessage(message) {
    try {
      const data = await this.request(`/public/bots/${this.chatbotId}/chat`, {
        method: 'POST',
        body: JSON.stringify({
          message: message,
          session_id: this.sessionId,
          metadata: {
            user_agent: navigator.userAgent,
            referrer: document.referrer,
            url: window.location.href,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      // Update session ID if returned (for continuity)
      if (data.session_id) {
        this.sessionId = data.session_id;
        try {
          localStorage.setItem(`privexbot_session_${this.chatbotId}`, this.sessionId);
        } catch (e) {
          // Ignore localStorage errors
        }
      }

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      // Handle specific error codes
      if (error.status === 429) {
        return {
          success: false,
          error: 'Too many requests. Please wait a moment before trying again.',
          code: 'RATE_LIMIT',
        };
      }

      if (error.status === 401) {
        return {
          success: false,
          error: 'Invalid API key. Please check your configuration.',
          code: 'AUTH_ERROR',
        };
      }

      return {
        success: false,
        error: error.data?.detail || error.message || 'Failed to send message',
        code: error.status || 'UNKNOWN',
      };
    }
  }

  /**
   * Submit lead capture form
   */
  async submitLead(leadData) {
    try {
      const data = await this.request(
        `/public/leads/capture?bot_id=${this.chatbotId}`,
        {
          method: 'POST',
          body: JSON.stringify({
            ...leadData,
            session_id: this.sessionId,
            // Browser metadata for lead enrichment
            user_agent: navigator.userAgent,
            referrer: document.referrer,
            language: navigator.language,
            // Note: IP is captured server-side from request headers
          }),
        }
      );

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.data?.detail || 'Failed to submit lead',
      };
    }
  }

  /**
   * Get widget configuration from server
   * This is optional - widget can work with defaults if this fails
   */
  async getWidgetConfig() {
    try {
      const data = await this.request(`/public/bots/${this.chatbotId}/config`, {
        method: 'GET',
      });

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      // Config endpoint is optional - return empty on failure
      console.debug('Widget config not available, using defaults');
      return {
        success: false,
        data: {},
      };
    }
  }

  /**
   * Track widget events for analytics
   */
  async trackEvent(eventType, eventData = {}) {
    try {
      await this.request(`/public/bots/${this.chatbotId}/events`, {
        method: 'POST',
        body: JSON.stringify({
          event_type: eventType,
          event_data: {
            ...eventData,
            url: window.location.href,
            referrer: document.referrer,
          },
          session_id: this.sessionId,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      // Silently fail for analytics - don't break user experience
      console.debug('Event tracking failed:', eventType, error.message);
    }
  }

  /**
   * Submit feedback on a message
   */
  async submitFeedback(messageId, rating, comment = null) {
    try {
      const data = await this.request(
        `/public/bots/${this.chatbotId}/feedback?message_id=${messageId}`,
        {
          method: 'POST',
          body: JSON.stringify({
            rating: rating, // "positive" or "negative"
            comment: comment,
          }),
        }
      );

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.data?.detail || 'Failed to submit feedback',
      };
    }
  }

  /**
   * Reset session (start new conversation)
   */
  resetSession() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 11);
    const browserHash = this._getBrowserHash();
    const newSessionId = `widget_${timestamp}_${random}_${browserHash}`;
    this.sessionId = newSessionId;

    try {
      localStorage.setItem(`privexbot_session_${this.chatbotId}`, newSessionId);
    } catch (e) {
      // Ignore localStorage errors
    }

    return newSessionId;
  }

  /**
   * Get current session ID
   */
  getSessionId() {
    return this.sessionId;
  }
}

export default WidgetAPIClient;
