/**
 * InputBox - User message input component
 */

class InputBox {
  constructor(onSend) {
    this.onSend = onSend;
    this.element = null;
    this.input = null;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'privexbot-input-area';

    container.innerHTML = `
      <div class="privexbot-input-container">
        <textarea
          class="privexbot-input"
          placeholder="Type your message..."
          rows="1"
        ></textarea>
        <button class="privexbot-send-btn" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    `;

    this.element = container;
    this.input = container.querySelector('.privexbot-input');
    const sendBtn = container.querySelector('.privexbot-send-btn');

    // Auto-resize textarea
    this.input.addEventListener('input', () => {
      this.input.style.height = 'auto';
      this.input.style.height = Math.min(this.input.scrollHeight, 100) + 'px';
    });

    // Send on Enter (but not Shift+Enter)
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Send button click
    sendBtn.addEventListener('click', () => this.handleSend());

    return container;
  }

  handleSend() {
    const message = this.input.value.trim();
    if (message && this.onSend) {
      this.onSend(message);
      this.input.value = '';
      this.input.style.height = 'auto';
      this.input.focus();
    }
  }

  focus() {
    if (this.input) {
      this.input.focus();
    }
  }

  disable() {
    if (this.input) {
      this.input.disabled = true;
    }
  }

  enable() {
    if (this.input) {
      this.input.disabled = false;
    }
  }
}

export default InputBox;
