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
        sessionId = `web_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        localStorage.setItem(storageKey, sessionId);
      }

      return sessionId;
    } catch (e) {
      // localStorage not available (private browsing, etc.)
      return `web_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }
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
    const newSessionId = `web_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
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
