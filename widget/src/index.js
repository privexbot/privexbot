/**
 * PrivexBot Widget - Main Entry Point
 *
 * Usage:
 * <script src="https://cdn.privexbot.com/widget.js"></script>
 * <script>
 *   pb('init', {
 *     type: 'chatbot',
 *     id: 'chatbot-id-123',
 *     options: {
 *       position: 'bottom-right',
 *       color: '#6366f1',
 *       greeting: 'Hi! How can I help you?',
 *       showBranding: true,
 *       leadConfig: {
 *         enabled: true,
 *         timing: 'after_messages', // or 'before_chat'
 *         messageCount: 3,
 *         fields: [...],
 *         allowSkip: true
 *       }
 *     }
 *   });
 * </script>
 */

import './styles/widget.css';
import WidgetAPIClient from './api/client.js';
import ChatBubble from './ui/ChatBubble.js';
import ChatWindow from './ui/ChatWindow.js';

class PrivexBotWidget {
  constructor() {
    this.config = null;
    this.apiClient = null;
    this.container = null;
    this.bubble = null;
    this.window = null;
    this.isOpen = false;
  }

  async init(initConfig) {
    // Parse config
    const config = this.parseConfig(initConfig);

    // Validate required fields
    if (!config.id) {
      console.error('PrivexBot: Widget ID is required');
      return;
    }

    if (!config.baseURL) {
      console.error('PrivexBot: API base URL is required');
      return;
    }

    this.config = config;

    // Initialize API client
    this.apiClient = new WidgetAPIClient(config.baseURL, config.id);

    // Fetch widget config from server (optional - can override defaults)
    const serverConfig = await this.apiClient.getWidgetConfig();
    if (serverConfig.success) {
      this.config = { ...this.config, ...serverConfig.data };
    }

    // Create widget container
    this.createWidget();

    // Track widget load
    this.apiClient.trackEvent('widget_loaded');
  }

  parseConfig(initConfig) {
    // Support both old and new config formats
    let config = {};

    if (typeof initConfig === 'string') {
      // Old format: pb('init', 'chatbot-id', { options })
      // Arguments would be: ['init', 'chatbot-id', { options }]
      config.id = initConfig;
      config.type = 'chatbot';
    } else if (typeof initConfig === 'object') {
      // New format: pb('init', { type, id, options })
      config = { ...initConfig };
    }

    // Extract options
    const options = config.options || {};

    // Merge with defaults
    return {
      type: config.type || 'chatbot',
      id: config.id,
      baseURL: options.baseURL || this.getDefaultBaseURL(),
      position: options.position || 'bottom-right',
      color: options.color || '#6366f1',
      greeting: options.greeting,
      botName: options.botName || 'Support Assistant',
      showBranding: options.showBranding !== false,
      width: options.width || 400,
      height: options.height || 600,
      leadConfig: options.leadConfig || null,
    };
  }

  getDefaultBaseURL() {
    // Try to get from script tag data attribute
    const script = document.querySelector('script[src*="widget.js"]');
    if (script) {
      const baseURL = script.getAttribute('data-api-url');
      if (baseURL) return baseURL;
    }

    // Default
    return (
      window.PRIVEXBOT_API_URL ||
      process.env.VITE_API_BASE_URL ||
      'https://api.privexbot.com/api/v1'
    );
  }

  createWidget() {
    // Create container
    this.container = document.createElement('div');
    this.container.className = `privexbot-widget ${this.config.position}`;
    this.container.id = 'privexbot-widget-container';

    // Create bubble
    this.bubble = new ChatBubble(this.config, () => this.toggle());
    this.container.appendChild(this.bubble.render());

    // Append to body
    document.body.appendChild(this.container);

    // Preload window (hidden) for faster opening
    this.preloadWindow();
  }

  preloadWindow() {
    this.window = new ChatWindow(this.config, this.apiClient);
    const windowEl = this.window.render();
    windowEl.style.display = 'none';
    this.container.appendChild(windowEl);

    // Attach close button handler
    const closeBtn = windowEl.querySelector('#privexbot-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }
  }

  open() {
    if (this.isOpen) return;

    this.isOpen = true;

    // Hide bubble
    this.bubble.hide();

    // Show window
    if (this.window && this.window.element) {
      this.window.element.style.display = 'flex';
    }

    // Track event
    this.apiClient.trackEvent('widget_opened');
  }

  close() {
    if (!this.isOpen) return;

    this.isOpen = false;

    // Show bubble
    this.bubble.show();

    // Hide window
    if (this.window && this.window.element) {
      this.window.element.style.display = 'none';
    }

    // Track event
    this.apiClient.trackEvent('widget_closed');
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.container = null;
    this.bubble = null;
    this.window = null;
    this.apiClient = null;
    this.isOpen = false;
  }
}

// Global API
(function () {
  // Create singleton instance
  const widget = new PrivexBotWidget();

  // Create global pb() function
  window.pb =
    window.pb ||
    function () {
      const args = Array.prototype.slice.call(arguments);
      const command = args[0];

      if (command === 'init') {
        // Init with remaining arguments
        const initConfig = args[1];
        const options = args[2];

        // Handle both formats:
        // pb('init', 'chatbot-id', { options })
        // pb('init', { type, id, options })
        if (typeof initConfig === 'string') {
          widget.init({
            id: initConfig,
            options: options || {},
          });
        } else {
          widget.init(initConfig);
        }
      } else if (command === 'open') {
        widget.open();
      } else if (command === 'close') {
        widget.close();
      } else if (command === 'destroy') {
        widget.destroy();
      } else {
        console.warn(`PrivexBot: Unknown command "${command}"`);
      }
    };

  // Process queued commands
  if (window.pb.q && Array.isArray(window.pb.q)) {
    window.pb.q.forEach((args) => {
      window.pb.apply(null, args);
    });
  }
})();

export default PrivexBotWidget;
