/**
 * ChatBubble - Floating chat button component
 */

class ChatBubble {
  constructor(config, onClick) {
    this.config = config;
    this.onClick = onClick;
    this.element = null;
    this.unreadCount = 0;
  }

  render() {
    const bubble = document.createElement('div');
    bubble.className = 'privexbot-bubble';
    bubble.style.background = this.config.color || '#6366f1';

    bubble.innerHTML = `
      <svg class="privexbot-bubble-icon" viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        <path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/>
      </svg>
      <div class="privexbot-bubble-badge" id="privexbot-badge" style="display: none;">0</div>
    `;

    bubble.addEventListener('click', () => {
      if (this.onClick) {
        this.onClick();
      }
      this.clearUnread();
    });

    this.element = bubble;
    return bubble;
  }

  setUnreadCount(count) {
    this.unreadCount = count;
    const badge = this.element?.querySelector('#privexbot-badge');

    if (badge) {
      if (count > 0) {
        badge.textContent = count > 9 ? '9+' : count.toString();
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  clearUnread() {
    this.setUnreadCount(0);
  }

  show() {
    if (this.element) {
      this.element.style.display = 'flex';
    }
  }

  hide() {
    if (this.element) {
      this.element.style.display = 'none';
    }
  }
}

export default ChatBubble;
