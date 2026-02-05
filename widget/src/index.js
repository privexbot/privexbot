/**
 * PrivexBot Widget - Main Entry Point
 *
 * EMBED CODE FORMATS:
 *
 * 1. Standard format (with IIFE loader for async loading):
 * <script>
 *   (function(w,d,s,o,f,js,fjs){
 *     w['PrivexBot']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
 *     js=d.createElement(s);fjs=d.getElementsByTagName(s)[0];
 *     js.id='privexbot-widget';js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
 *   }(window,document,'script','pb','https://widget.privexbot.com/widget.js'));
 *   pb('init', {
 *     id: 'chatbot-uuid-here',
 *     apiKey: 'your-api-key-here',
 *     options: {
 *       baseURL: 'https://api.privexbot.com/api/v1',
 *       position: 'bottom-right',
 *       color: '#3b82f6',
 *       greeting: 'Hi! How can I help you?',
 *       botName: 'Support Assistant',
 *       showBranding: true
 *     }
 *   });
 * </script>
 *
 * 2. Simple format (auto-init from window.privexbotConfig):
 * <script>
 *   window.privexbotConfig = {
 *     botId: 'chatbot-uuid-here',
 *     apiKey: 'your-api-key-here',
 *     baseURL: 'https://api.privexbot.com/api/v1'
 *   };
 * </script>
 * <script src="https://widget.privexbot.com/widget.js" async></script>
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
    this.isInitialized = false;
  }

  async init(initConfig) {
    if (this.isInitialized) {
      console.warn('PrivexBot: Widget already initialized');
      return;
    }

    // Parse config
    const config = this.parseConfig(initConfig);

    // Validate required fields
    if (!config.id) {
      console.error('PrivexBot: Chatbot ID is required');
      return;
    }

    if (!config.apiKey) {
      console.error('PrivexBot: API key is required');
      return;
    }

    if (!config.baseURL) {
      console.error('PrivexBot: API base URL is required');
      return;
    }

    this.config = config;

    // Initialize API client with API key
    this.apiClient = new WidgetAPIClient(config.baseURL, config.id, config.apiKey);

    // Try to fetch widget config from server (optional - enhances with server settings)
    try {
      const serverConfig = await this.apiClient.getWidgetConfig();
      if (serverConfig.success && serverConfig.data) {
        // Merge server config with local (local takes precedence)
        this.config = {
          ...serverConfig.data,
          ...this.config,
        };
      }
    } catch (e) {
      // Continue with local config only
      console.debug('PrivexBot: Using local config only');
    }

    // Create widget container
    this.createWidget();

    this.isInitialized = true;

    // Track widget load
    this.apiClient.trackEvent('widget_loaded', {
      url: window.location.href,
    });

    console.log('PrivexBot: Widget initialized successfully');
  }

  parseConfig(initConfig) {
    let config = {};

    if (typeof initConfig === 'string') {
      // Simple format: pb('init', 'chatbot-id')
      config.id = initConfig;
    } else if (typeof initConfig === 'object') {
      config = { ...initConfig };
    }

    // Extract options
    const options = config.options || {};

    // Merge with defaults
    return {
      id: config.id,
      apiKey: config.apiKey || options.apiKey,
      baseURL: options.baseURL || config.baseURL || this.getDefaultBaseURL(),
      position: options.position || 'bottom-right',
      color: options.color || '#3b82f6',
      greeting: options.greeting || 'Hello! How can I help you today?',
      botName: options.botName || 'Assistant',
      showBranding: options.showBranding !== false,
      width: options.width || 400,
      height: options.height || 600,
      leadConfig: options.leadConfig || null,
      avatarUrl: options.avatarUrl || null,
    };
  }

  getDefaultBaseURL() {
    // 1. Try script tag data attribute
    const script = document.querySelector('script[src*="widget.js"]');
    if (script) {
      const baseURL = script.getAttribute('data-api-url');
      if (baseURL) return baseURL;
    }

    // 2. Try global variable
    if (window.PRIVEXBOT_API_URL) {
      return window.PRIVEXBOT_API_URL;
    }

    // 3. Default to localhost for development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:8000/api/v1';
    }

    // 4. Production default
    return 'https://api.privexbot.com/api/v1';
  }

  createWidget() {
    // Create container
    this.container = document.createElement('div');
    this.container.className = `privexbot-widget ${this.config.position}`;
    this.container.id = 'privexbot-widget-container';

    // Apply font family from config
    if (this.config.font_family) {
      const fontMap = {
        'Inter': '"Inter", system-ui, sans-serif',
        'System': 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        'Monospace': 'ui-monospace, "SF Mono", "Cascadia Mono", monospace',
      };
      this.container.style.fontFamily = fontMap[this.config.font_family] || this.config.font_family;
    }

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

    // Show window with animation
    if (this.window && this.window.element) {
      this.window.element.style.display = 'flex';
      this.window.element.classList.add('privexbot-window-open');
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
      this.window.element.classList.remove('privexbot-window-open');
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
    this.isInitialized = false;
  }

  // Get widget status
  getStatus() {
    return {
      initialized: this.isInitialized,
      isOpen: this.isOpen,
      sessionId: this.apiClient?.getSessionId(),
    };
  }

  // Reset conversation
  resetConversation() {
    if (this.apiClient) {
      this.apiClient.resetSession();
    }
    if (this.window && this.window.messageList) {
      this.window.messageList.clear();
      // Re-show greeting
      if (this.config.greeting) {
        this.window.messageList.addMessage({
          role: 'bot',
          content: this.config.greeting,
          timestamp: new Date().toISOString(),
        });
      }
    }
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

      switch (command) {
        case 'init':
          const initConfig = args[1];
          const options = args[2];

          // Handle both formats:
          // pb('init', 'chatbot-id', { apiKey: '...', options })
          // pb('init', { id, apiKey, options })
          if (typeof initConfig === 'string') {
            widget.init({
              id: initConfig,
              apiKey: options?.apiKey,
              options: options || {},
            });
          } else {
            widget.init(initConfig);
          }
          break;

        case 'open':
          widget.open();
          break;

        case 'close':
          widget.close();
          break;

        case 'toggle':
          widget.toggle();
          break;

        case 'destroy':
          widget.destroy();
          break;

        case 'reset':
          widget.resetConversation();
          break;

        case 'status':
          return widget.getStatus();

        default:
          console.warn(`PrivexBot: Unknown command "${command}"`);
      }
    };

  // Process queued commands (from async loader)
  if (window.pb.q && Array.isArray(window.pb.q)) {
    window.pb.q.forEach((args) => {
      window.pb.apply(null, args);
    });
    delete window.pb.q;
  }

  // Auto-init from window.privexbotConfig (for simpler embed code)
  if (window.privexbotConfig && !widget.isInitialized) {
    const cfg = window.privexbotConfig;
    widget.init({
      id: cfg.botId || cfg.id,
      apiKey: cfg.apiKey,
      options: {
        baseURL: cfg.baseURL,
        ...cfg.options,
      },
    });
  }
})();

export default PrivexBotWidget;
