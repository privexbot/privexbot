/**
 * MessageList - Display chat messages
 */

class MessageList {
  constructor() {
    this.element = null;
    this.messages = [];
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

    messageEl.innerHTML = `
      <div class="privexbot-message-avatar">
        ${avatarIcon}
      </div>
      <div>
        <div class="privexbot-message-bubble">
          ${this.escapeHtml(message.content)}
        </div>
        <div class="privexbot-message-time">${time}</div>
      </div>
    `;

    if (this.element) {
      this.element.appendChild(messageEl);
    }
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
      <div class="privexbot-message-bubble">
        <div class="privexbot-typing">
          <div class="privexbot-typing-dot"></div>
          <div class="privexbot-typing-dot"></div>
          <div class="privexbot-typing-dot"></div>
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
