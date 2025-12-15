/**
 * ChatWindow - Main chat interface component
 */

import MessageList from './MessageList.js';
import InputBox from './InputBox.js';
import LeadForm from './LeadForm.js';

class ChatWindow {
  constructor(config, apiClient) {
    this.config = config;
    this.apiClient = apiClient;
    this.element = null;
    this.messageList = null;
    this.inputBox = null;
    this.leadForm = null;
    this.leadCollected = false;
    this.showLeadFormFirst = config.leadConfig?.timing === 'before_chat';
  }

  render() {
    const container = document.createElement('div');
    container.className = 'privexbot-window';

    // Header
    const header = this.createHeader();
    container.appendChild(header);

    // Content area (either lead form or messages)
    const content = document.createElement('div');
    content.id = 'privexbot-content';
    content.style.flex = '1';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';

    if (this.config.leadConfig?.enabled && this.showLeadFormFirst) {
      // Show lead form first
      this.leadForm = new LeadForm(
        this.config.leadConfig,
        (data) => this.handleLeadSubmit(data),
        () => this.handleLeadSkip()
      );
      content.appendChild(this.leadForm.render());
    } else {
      // Show chat directly
      this.renderChatInterface(content);
    }

    container.appendChild(content);

    // Branding (if enabled)
    if (this.config.showBranding !== false) {
      const branding = this.createBranding();
      container.appendChild(branding);
    }

    this.element = container;
    return container;
  }

  renderChatInterface(contentContainer) {
    // Messages
    this.messageList = new MessageList();
    contentContainer.appendChild(this.messageList.render());

    // Show greeting message
    if (this.config.greeting) {
      this.messageList.addMessage({
        role: 'bot',
        content: this.config.greeting,
        timestamp: new Date().toISOString(),
      });
    }

    // Input
    this.inputBox = new InputBox((message) => this.handleSendMessage(message));
    contentContainer.appendChild(this.inputBox.render());

    // Focus input
    setTimeout(() => {
      if (this.inputBox) {
        this.inputBox.focus();
      }
    }, 300);
  }

  createHeader() {
    const header = document.createElement('div');
    header.className = 'privexbot-header';
    header.style.background = this.config.color || '#6366f1';

    header.innerHTML = `
      <div class="privexbot-header-info">
        <div class="privexbot-header-avatar">
          <svg viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
          </svg>
        </div>
        <div class="privexbot-header-text">
          <h3>${this.config.botName || 'Support Assistant'}</h3>
          <p>Online • Typically replies instantly</p>
        </div>
      </div>
      <button class="privexbot-close-btn" id="privexbot-close">
        <svg viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    `;

    return header;
  }

  createBranding() {
    const branding = document.createElement('div');
    branding.className = 'privexbot-branding';
    branding.innerHTML = `
      Powered by <a href="https://privexbot.com" target="_blank">PrivexBot</a>
    `;
    return branding;
  }

  async handleSendMessage(message) {
    // Add user message
    this.messageList.addMessage({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });

    // Show typing indicator
    this.messageList.showTypingIndicator();
    this.inputBox.disable();

    // Track event
    this.apiClient.trackEvent('message_sent', { message });

    // Send to API
    const result = await this.apiClient.sendMessage(message);

    // Hide typing indicator
    this.messageList.hideTypingIndicator();
    this.inputBox.enable();
    this.inputBox.focus();

    if (result.success) {
      // Add bot response
      this.messageList.addMessage({
        role: 'bot',
        content: result.data.response || result.data.message,
        timestamp: new Date().toISOString(),
      });

      // Check if should show lead form after N messages
      if (
        this.config.leadConfig?.enabled &&
        this.config.leadConfig?.timing === 'after_messages' &&
        !this.leadCollected
      ) {
        const messageCount = this.messageList.messages.filter((m) => m.role === 'user').length;
        const triggerAt = this.config.leadConfig?.messageCount || 3;

        if (messageCount >= triggerAt) {
          this.showLeadFormInline();
        }
      }
    } else {
      // Show error message
      this.messageList.addMessage({
        role: 'bot',
        content: result.error || 'Sorry, something went wrong. Please try again.',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async handleLeadSubmit(data) {
    // Submit to API
    const result = await this.apiClient.submitLead(data);

    if (result.success) {
      this.leadCollected = true;

      // Track event
      this.apiClient.trackEvent('lead_collected', data);

      // Switch to chat interface if showing lead form first
      if (this.showLeadFormFirst) {
        const contentContainer = this.element.querySelector('#privexbot-content');
        contentContainer.innerHTML = '';
        this.renderChatInterface(contentContainer);
      } else {
        // Just hide inline form
        if (this.leadForm && this.leadForm.element) {
          this.leadForm.element.remove();
        }

        // Show thank you message
        this.messageList.addMessage({
          role: 'bot',
          content: 'Thank you! Your information has been saved. How can I help you?',
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      throw new Error(result.error);
    }
  }

  handleLeadSkip() {
    // Track event
    this.apiClient.trackEvent('lead_skipped');

    if (this.showLeadFormFirst) {
      // Switch to chat interface
      const contentContainer = this.element.querySelector('#privexbot-content');
      contentContainer.innerHTML = '';
      this.renderChatInterface(contentContainer);
    } else {
      // Just hide inline form
      if (this.leadForm && this.leadForm.element) {
        this.leadForm.element.remove();
      }
    }
  }

  showLeadFormInline() {
    // Create lead form as a bot message
    this.messageList.addMessage({
      role: 'bot',
      content: "Before we continue, I'd love to get to know you better!",
      timestamp: new Date().toISOString(),
    });

    this.leadForm = new LeadForm(
      this.config.leadConfig,
      (data) => this.handleLeadSubmit(data),
      () => this.handleLeadSkip()
    );

    // Insert after messages, before input
    const messagesContainer = this.element.querySelector('.privexbot-messages');
    const inputContainer = this.element.querySelector('.privexbot-input-area');

    if (messagesContainer && inputContainer) {
      messagesContainer.parentNode.insertBefore(
        this.leadForm.render(),
        inputContainer
      );
    }
  }
}

export default ChatWindow;
