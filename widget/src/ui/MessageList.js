/**
 * MessageList - Display chat messages with feedback buttons
 */

class MessageList {
  constructor(onFeedback = null) {
    this.element = null;
    this.messages = [];
    this.onFeedback = onFeedback; // Callback: (messageId, rating) => Promise
    this.feedbackState = {}; // Track which messages have been rated: { messageId: 'positive' | 'negative' }
    this.loadFeedbackState();
  }

  /**
   * Load feedback state from sessionStorage
   */
  loadFeedbackState() {
    try {
      const stored = sessionStorage.getItem('privexbot_feedback');
      if (stored) {
        this.feedbackState = JSON.parse(stored);
      }
    } catch (e) {
      // Ignore storage errors
    }
  }

  /**
   * Save feedback state to sessionStorage
   */
  saveFeedbackState() {
    try {
      sessionStorage.setItem('privexbot_feedback', JSON.stringify(this.feedbackState));
    } catch (e) {
      // Ignore storage errors
    }
  }

  render() {
    const container = document.createElement('div');
    container.className = 'privexbot-messages';
    this.element = container;
    return container;
  }

  addMessage(message) {
    this.messages.push(message);
    this.renderMessage(message);
    this.scrollToBottom();
  }

  renderMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = `privexbot-message ${message.role}`;
    if (message.id) {
      messageEl.dataset.messageId = message.id;
    }

    const time = new Date(message.timestamp || Date.now()).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const avatarIcon =
      message.role === 'bot'
        ? `<svg viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
          </svg>`
        : `<svg viewBox="0 0 24 24" fill="white">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>`;

    // Build message content
    let contentHtml = `
      <div class="privexbot-message-avatar">
        ${avatarIcon}
      </div>
      <div class="privexbot-message-content">
        <div class="privexbot-message-bubble">
          ${this.escapeHtml(message.content)}
        </div>
        <div class="privexbot-message-time">${time}</div>
    `;

    // Add feedback buttons for bot messages with an ID
    if (message.role === 'bot' && message.id && this.onFeedback) {
      const existingRating = this.feedbackState[message.id];
      contentHtml += this.renderFeedbackButtons(message.id, existingRating);
    }

    contentHtml += `</div>`;

    messageEl.innerHTML = contentHtml;

    // Attach feedback button event listeners
    if (message.role === 'bot' && message.id && this.onFeedback) {
      this.attachFeedbackListeners(messageEl, message.id);
    }

    if (this.element) {
      this.element.appendChild(messageEl);
    }
  }

  /**
   * Render feedback buttons HTML
   */
  renderFeedbackButtons(messageId, existingRating = null) {
    const positiveSelected = existingRating === 'positive' ? 'selected' : '';
    const negativeSelected = existingRating === 'negative' ? 'selected' : '';
    const disabled = existingRating ? 'disabled' : '';

    return `
      <div class="privexbot-feedback" data-message-id="${messageId}">
        <button
          class="privexbot-feedback-btn positive ${positiveSelected}"
          data-rating="positive"
          ${disabled}
          title="Helpful"
        >
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
          </svg>
        </button>
        <button
          class="privexbot-feedback-btn negative ${negativeSelected}"
          data-rating="negative"
          ${disabled}
          title="Not helpful"
        >
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/>
          </svg>
        </button>
      </div>
    `;
  }

  /**
   * Attach click listeners to feedback buttons
   */
  attachFeedbackListeners(messageEl, messageId) {
    const feedbackContainer = messageEl.querySelector('.privexbot-feedback');
    if (!feedbackContainer) return;

    const buttons = feedbackContainer.querySelectorAll('.privexbot-feedback-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Don't process if already rated
        if (this.feedbackState[messageId]) return;

        const rating = btn.dataset.rating;
        await this.handleFeedback(messageId, rating, feedbackContainer);
      });
    });
  }

  /**
   * Handle feedback submission
   */
  async handleFeedback(messageId, rating, container) {
    // Optimistically update UI
    this.feedbackState[messageId] = rating;
    this.saveFeedbackState();
    this.updateFeedbackUI(container, rating);

    // Submit to API
    if (this.onFeedback) {
      try {
        const result = await this.onFeedback(messageId, rating);
        if (!result.success) {
          // Revert on failure
          delete this.feedbackState[messageId];
          this.saveFeedbackState();
          this.updateFeedbackUI(container, null);
          console.error('Feedback submission failed:', result.error);
        }
      } catch (error) {
        // Revert on error
        delete this.feedbackState[messageId];
        this.saveFeedbackState();
        this.updateFeedbackUI(container, null);
        console.error('Feedback submission error:', error);
      }
    }
  }

  /**
   * Update feedback button UI state
   */
  updateFeedbackUI(container, rating) {
    const buttons = container.querySelectorAll('.privexbot-feedback-btn');
    buttons.forEach(btn => {
      const btnRating = btn.dataset.rating;

      if (rating) {
        // Feedback given - disable buttons and highlight selected
        btn.disabled = true;
        if (btnRating === rating) {
          btn.classList.add('selected');
        } else {
          btn.classList.remove('selected');
        }
      } else {
        // No feedback - enable buttons
        btn.disabled = false;
        btn.classList.remove('selected');
      }
    });
  }

  showTypingIndicator() {
    if (this.typingIndicator) return;

    const indicator = document.createElement('div');
    indicator.className = 'privexbot-message bot';
    indicator.id = 'typing-indicator';

    indicator.innerHTML = `
      <div class="privexbot-message-avatar">
        <svg viewBox="0 0 24 24" fill="white">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
        </svg>
      </div>
      <div class="privexbot-message-content">
        <div class="privexbot-message-bubble">
          <div class="privexbot-typing">
            <div class="privexbot-typing-dot"></div>
            <div class="privexbot-typing-dot"></div>
            <div class="privexbot-typing-dot"></div>
          </div>
        </div>
      </div>
    `;

    if (this.element) {
      this.element.appendChild(indicator);
      this.typingIndicator = indicator;
      this.scrollToBottom();
    }
  }

  hideTypingIndicator() {
    if (this.typingIndicator && this.typingIndicator.parentNode) {
      this.typingIndicator.parentNode.removeChild(this.typingIndicator);
      this.typingIndicator = null;
    }
  }

  scrollToBottom() {
    if (this.element) {
      setTimeout(() => {
        this.element.scrollTop = this.element.scrollHeight;
      }, 100);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
  }

  clear() {
    this.messages = [];
    if (this.element) {
      this.element.innerHTML = '';
    }
  }
}

export default MessageList;
