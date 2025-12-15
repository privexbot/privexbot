/**
 * API Client for PrivexBot Widget
 * Handles communication with backend
 */

import axios from 'axios';

class WidgetAPIClient {
  constructor(baseURL, chatbotId) {
    this.baseURL = baseURL;
    this.chatbotId = chatbotId;
    this.conversationId = null;
    this.sessionId = this.getOrCreateSessionId();

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'X-Widget-Session': this.sessionId,
      },
      timeout: 30000,
    });
  }

  getOrCreateSessionId() {
    const storageKey = `privexbot_session_${this.chatbotId}`;
    let sessionId = localStorage.getItem(storageKey);

    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem(storageKey, sessionId);
    }

    return sessionId;
  }

  async sendMessage(message) {
    try {
      const response = await this.client.post(`/chatbots/${this.chatbotId}/widget/message`, {
        message,
        conversation_id: this.conversationId,
        session_id: this.sessionId,
      });

      // Save conversation ID for continuity
      if (response.data.conversation_id) {
        this.conversationId = response.data.conversation_id;
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to send message',
      };
    }
  }

  async submitLead(leadData) {
    try {
      const response = await this.client.post(`/chatbots/${this.chatbotId}/widget/lead`, {
        ...leadData,
        session_id: this.sessionId,
        conversation_id: this.conversationId,
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to submit lead',
      };
    }
  }

  async getWidgetConfig() {
    try {
      const response = await this.client.get(`/chatbots/${this.chatbotId}/widget/config`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to load widget config',
      };
    }
  }

  async getConversationHistory() {
    if (!this.conversationId) {
      return { success: true, data: [] };
    }

    try {
      const response = await this.client.get(
        `/chatbots/${this.chatbotId}/widget/conversation/${this.conversationId}`
      );

      return {
        success: true,
        data: response.data.messages || [],
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to load history',
      };
    }
  }

  async trackEvent(eventType, eventData = {}) {
    try {
      await this.client.post(`/chatbots/${this.chatbotId}/widget/event`, {
        event_type: eventType,
        event_data: eventData,
        session_id: this.sessionId,
        conversation_id: this.conversationId,
      });
    } catch (error) {
      // Silently fail for analytics
      console.warn('Failed to track event:', error);
    }
  }
}

export default WidgetAPIClient;
