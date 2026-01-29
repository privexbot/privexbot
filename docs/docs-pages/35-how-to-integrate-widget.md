# How to Integrate the Chat Widget

The PrivexBot widget is a lightweight, embeddable chat interface that lets website visitors interact with your chatbots and chatflows. This guide covers installation, configuration, and customization.

---

## Table of Contents

1. [What is the PrivexBot Widget?](#what-is-the-privexbot-widget)
2. [Installation Methods](#installation-methods)
3. [Basic Configuration](#basic-configuration)
4. [Customization Options](#customization-options)
5. [Lead Capture Configuration](#lead-capture-configuration)
6. [Programmatic Control](#programmatic-control)
7. [Styling and CSS Overrides](#styling-and-css-overrides)
8. [Mobile Responsiveness](#mobile-responsiveness)
9. [Testing Your Widget](#testing-your-widget)
10. [Troubleshooting](#troubleshooting)

---

## What is the PrivexBot Widget?

The PrivexBot widget is a **vanilla JavaScript** chat interface that you can embed on any website. Key features:

| Feature | Description |
|---------|-------------|
| **Lightweight** | ~50KB total bundle size |
| **No Dependencies** | Pure JavaScript, no framework required |
| **Scoped CSS** | Styles won't conflict with your site |
| **Async Loading** | Non-blocking, won't slow your page |
| **Session Persistence** | Conversations survive page refreshes |
| **Mobile Optimized** | Responsive design for all devices |
| **Customizable** | Colors, position, text, and behavior |

### How It Works

```
┌─────────────────────────────────────────┐
│           Your Website                   │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │      Your Page Content          │   │
│   │                                 │   │
│   │                                 │   │
│   └─────────────────────────────────┘   │
│                                         │
│                              ┌────────┐ │
│                              │  Chat  │ │
│                              │ Widget │ │
│                              └────────┘ │
└─────────────────────────────────────────┘
         │
         ▼ API calls
┌─────────────────────────────────────────┐
│        PrivexBot Server                  │
│    (processes messages, RAG, AI)        │
└─────────────────────────────────────────┘
```

---

## Installation Methods

### Method 1: CDN Script Tag (Recommended)

Add this script to your website, just before the closing `</body>` tag:

```html
<script>
  (function(w, d, s, o, f, js, fjs) {
    w['PrivexBot'] = o;
    w[o] = w[o] || function() {
      (w[o].q = w[o].q || []).push(arguments);
    };
    js = d.createElement(s);
    fjs = d.getElementsByTagName(s)[0];
    js.id = o;
    js.src = f;
    js.async = 1;
    fjs.parentNode.insertBefore(js, fjs);
  }(window, document, 'script', 'privexbot', 'https://widget.privexbot.com/widget.js'));

  privexbot('init', {
    botId: 'YOUR_BOT_ID',
    apiKey: 'YOUR_API_KEY'  // Only required for private bots
  });
</script>
```

**Where to find your Bot ID:**
1. Go to your chatbot/chatflow in PrivexBot dashboard
2. Navigate to **Settings** → **Widget**
3. Copy the **Bot ID** shown

### Method 2: NPM Package

For React, Vue, or other JavaScript frameworks:

```bash
npm install @privexbot/widget
```

```javascript
import { initPrivexBot } from '@privexbot/widget';

initPrivexBot({
  botId: 'YOUR_BOT_ID',
  apiKey: 'YOUR_API_KEY'
});
```

### Method 3: Iframe Embed

For simple embedding without JavaScript:

```html
<iframe
  src="https://chat.privexbot.com/widget/YOUR_BOT_ID"
  width="400"
  height="600"
  frameborder="0"
></iframe>
```

**Note**: Iframe embedding has limited customization options.

---

## Basic Configuration

### Minimal Setup

The minimum required configuration:

```javascript
privexbot('init', {
  botId: 'abc123def456'  // Your bot's unique ID
});
```

### Common Configuration

A typical setup with common options:

```javascript
privexbot('init', {
  // Required
  botId: 'abc123def456',

  // Authentication (for private bots)
  apiKey: 'pk_live_xxxxxx',

  // Position
  position: 'bottom-right',  // or 'bottom-left'

  // Appearance
  primaryColor: '#3b82f6',
  botName: 'Support Assistant',
  greeting: 'Hi! How can I help you today?',

  // Behavior
  autoOpen: false,
  showOnMobile: true
});
```

### Configuration Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `botId` | string | *required* | Your chatbot's unique identifier |
| `apiKey` | string | null | API key for private bots |
| `position` | string | `'bottom-right'` | Widget position |
| `primaryColor` | string | `'#3b82f6'` | Main theme color |
| `botName` | string | `'Assistant'` | Name shown in header |
| `greeting` | string | null | Initial greeting message |
| `autoOpen` | boolean | `false` | Open widget on page load |
| `showOnMobile` | boolean | `true` | Display on mobile devices |

---

## Customization Options

### Appearance Settings

```javascript
privexbot('init', {
  botId: 'YOUR_BOT_ID',

  // Colors
  primaryColor: '#3b82f6',      // Header and send button
  backgroundColor: '#ffffff',    // Chat background
  userMessageColor: '#3b82f6',  // User message bubbles
  botMessageColor: '#f3f4f6',   // Bot message bubbles
  textColor: '#1f2937',         // Message text

  // Branding
  botName: 'Acme Support',
  botAvatar: 'https://yoursite.com/avatar.png',
  companyLogo: 'https://yoursite.com/logo.png',

  // Text
  greeting: 'Welcome! Ask me anything about our products.',
  placeholder: 'Type your message...',
  poweredByText: 'Powered by PrivexBot',
  showPoweredBy: true
});
```

### Size and Position

```javascript
privexbot('init', {
  botId: 'YOUR_BOT_ID',

  // Position
  position: 'bottom-right',  // 'bottom-right' | 'bottom-left'
  offsetX: 20,               // Horizontal offset in pixels
  offsetY: 20,               // Vertical offset in pixels

  // Size (desktop)
  width: 380,                // Widget width in pixels
  height: 600,               // Widget height in pixels

  // Size (mobile)
  mobileFullScreen: true,    // Full screen on mobile
  mobileBreakpoint: 768      // Screen width to trigger mobile mode
});
```

### Button Customization

```javascript
privexbot('init', {
  botId: 'YOUR_BOT_ID',

  // Launcher button
  buttonSize: 60,            // Button diameter in pixels
  buttonIcon: 'chat',        // 'chat' | 'message' | 'custom'
  customButtonIcon: 'https://yoursite.com/chat-icon.svg',
  buttonTooltip: 'Chat with us!',
  showButtonTooltip: true
});
```

---

## Lead Capture Configuration

Collect visitor information before or during chat conversations.

### Lead Capture Options

```javascript
privexbot('init', {
  botId: 'YOUR_BOT_ID',

  leadCapture: {
    // When to show the form
    timing: 'before_chat',  // 'before_chat' | 'after_messages' | 'never'
    afterMessages: 3,       // Show after N messages (if timing is 'after_messages')

    // Standard fields
    fields: {
      email: { required: true, label: 'Email Address' },
      name: { required: false, label: 'Your Name' },
      phone: { required: false, label: 'Phone Number' }
    },

    // Custom fields
    customFields: [
      {
        key: 'company',
        label: 'Company Name',
        type: 'text',
        required: false
      },
      {
        key: 'interest',
        label: 'What are you interested in?',
        type: 'select',
        options: ['Sales', 'Support', 'Partnership'],
        required: true
      }
    ],

    // GDPR compliance
    gdprConsent: {
      enabled: true,
      text: 'I agree to the privacy policy',
      linkUrl: 'https://yoursite.com/privacy',
      required: true
    },

    // Form text
    title: 'Before we start...',
    subtitle: 'Please share a few details so we can assist you better.',
    submitButton: 'Start Chat'
  }
});
```

### Timing Options Explained

| Timing | Behavior | Best For |
|--------|----------|----------|
| `before_chat` | Form appears before any messages | High-intent visitors, sales leads |
| `after_messages` | Form appears after N exchanges | Qualifying engaged users |
| `never` | No lead capture form | Anonymous support, public info |

### Custom Field Types

| Type | Description | Example |
|------|-------------|---------|
| `text` | Single-line text input | Name, company |
| `email` | Email with validation | Contact email |
| `phone` | Phone number input | Contact phone |
| `textarea` | Multi-line text | Detailed question |
| `select` | Dropdown selection | Department, interest |
| `checkbox` | Yes/no toggle | Newsletter signup |

---

## Programmatic Control

Control the widget using JavaScript methods.

### Available Methods

```javascript
// Open the chat widget
privexbot('open');

// Close the chat widget
privexbot('close');

// Toggle open/closed state
privexbot('toggle');

// Check if widget is open
const isOpen = privexbot('isOpen');

// Send a message programmatically
privexbot('sendMessage', 'Hello, I need help with billing');

// Reset the conversation (clear history)
privexbot('reset');

// Update configuration dynamically
privexbot('update', {
  primaryColor: '#ef4444',
  botName: 'New Assistant'
});

// Destroy the widget completely
privexbot('destroy');

// Set user data (for personalization)
privexbot('setUser', {
  email: 'user@example.com',
  name: 'John Doe',
  customData: {
    plan: 'premium',
    accountId: '12345'
  }
});
```

### Event Listeners

```javascript
// Listen for widget events
privexbot('on', 'open', function() {
  console.log('Widget opened');
  // Track in analytics
});

privexbot('on', 'close', function() {
  console.log('Widget closed');
});

privexbot('on', 'message', function(data) {
  console.log('Message sent:', data.message);
  console.log('From:', data.sender);  // 'user' or 'bot'
});

privexbot('on', 'lead', function(data) {
  console.log('Lead captured:', data);
  // Send to your CRM
});

privexbot('on', 'error', function(error) {
  console.error('Widget error:', error);
});
```

### Triggering Chat from Page Elements

```html
<!-- Open chat when clicking a button -->
<button onclick="privexbot('open')">
  Chat with us
</button>

<!-- Send a specific message -->
<button onclick="privexbot('sendMessage', 'I want to learn about pricing')">
  Ask about pricing
</button>

<!-- Open with pre-filled message -->
<a href="#" onclick="privexbot('open'); privexbot('sendMessage', 'Help me choose a plan')">
  Help me choose
</a>
```

---

## Styling and CSS Overrides

### CSS Custom Properties

The widget exposes CSS custom properties you can override:

```css
/* Add to your stylesheet */
:root {
  --privexbot-primary: #3b82f6;
  --privexbot-primary-hover: #2563eb;
  --privexbot-background: #ffffff;
  --privexbot-surface: #f9fafb;
  --privexbot-text: #1f2937;
  --privexbot-text-secondary: #6b7280;
  --privexbot-border: #e5e7eb;
  --privexbot-border-radius: 12px;
  --privexbot-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  --privexbot-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

### Targeting Widget Elements

The widget uses scoped selectors. To override styles:

```css
/* Target the launcher button */
#privexbot-widget .privexbot-launcher {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* Target the chat header */
#privexbot-widget .privexbot-header {
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
}

/* Target message bubbles */
#privexbot-widget .privexbot-message-bot {
  border-radius: 16px 16px 16px 4px;
}

#privexbot-widget .privexbot-message-user {
  border-radius: 16px 16px 4px 16px;
}

/* Target the input area */
#privexbot-widget .privexbot-input {
  border: 2px solid #e5e7eb;
}

#privexbot-widget .privexbot-input:focus {
  border-color: var(--privexbot-primary);
}
```

### Dark Mode Support

```javascript
// Initialize with dark mode detection
privexbot('init', {
  botId: 'YOUR_BOT_ID',
  theme: 'auto',  // 'light' | 'dark' | 'auto'

  // Or specify colors for each mode
  lightMode: {
    backgroundColor: '#ffffff',
    textColor: '#1f2937'
  },
  darkMode: {
    backgroundColor: '#1f2937',
    textColor: '#f9fafb'
  }
});
```

---

## Mobile Responsiveness

### Default Mobile Behavior

On screens narrower than 768px:
- Widget opens in full-screen mode
- Launcher button remains visible
- Touch-optimized interactions
- Larger tap targets

### Mobile-Specific Configuration

```javascript
privexbot('init', {
  botId: 'YOUR_BOT_ID',

  // Mobile settings
  showOnMobile: true,           // Show widget on mobile
  mobileFullScreen: true,       // Full screen when open
  mobileBreakpoint: 768,        // Breakpoint in pixels

  // Mobile-specific appearance
  mobile: {
    buttonSize: 56,             // Slightly smaller button
    offsetX: 16,
    offsetY: 16,
    hideWhenKeyboardOpen: true  // Hide launcher when typing
  }
});
```

### Responsive CSS

```css
/* Desktop styles */
@media (min-width: 769px) {
  #privexbot-widget .privexbot-container {
    width: 380px;
    height: 600px;
  }
}

/* Mobile styles */
@media (max-width: 768px) {
  #privexbot-widget .privexbot-container {
    width: 100vw;
    height: 100vh;
    border-radius: 0;
  }

  #privexbot-widget .privexbot-launcher {
    bottom: 16px;
    right: 16px;
  }
}
```

---

## Testing Your Widget

### Local Development Testing

1. **Test Server**: Run a local server (widget may not work with `file://` URLs)
   ```bash
   # Python
   python -m http.server 8000

   # Node.js
   npx serve
   ```

2. **Test Page**: Create a simple HTML file:
   ```html
   <!DOCTYPE html>
   <html>
   <head>
     <title>Widget Test</title>
   </head>
   <body>
     <h1>Widget Test Page</h1>

     <script>
       // Widget initialization code here
     </script>
   </body>
   </html>
   ```

### Testing Checklist

| Test | What to Check |
|------|---------------|
| **Load** | Widget appears, no console errors |
| **Open/Close** | Smooth animation, proper state |
| **Send Message** | Message appears, response received |
| **Lead Capture** | Form displays, validation works |
| **Mobile** | Full screen mode, touch interactions |
| **Refresh** | Conversation persists |
| **Multiple Tabs** | Session syncs correctly |

### Browser Developer Tools

1. **Console**: Check for JavaScript errors
2. **Network**: Verify API calls succeed (200 status)
3. **Application → Local Storage**: Check session data
4. **Elements**: Inspect widget DOM structure

### Testing Different Scenarios

```javascript
// Test with different users
privexbot('setUser', { email: 'test1@example.com', name: 'Test User 1' });
privexbot('reset');
privexbot('setUser', { email: 'test2@example.com', name: 'Test User 2' });

// Test error handling
privexbot('init', { botId: 'invalid-id' });

// Test events
privexbot('on', 'error', console.error);
privexbot('on', 'message', console.log);
```

---

## Troubleshooting

### Widget Not Appearing

| Symptom | Possible Cause | Solution |
|---------|----------------|----------|
| Nothing shows | Script not loaded | Check script tag, verify URL |
| Console error | Invalid botId | Verify bot ID from dashboard |
| 401 error | Missing API key | Add apiKey for private bots |
| Widget hidden | CSS conflict | Check `z-index`, inspect element |

**Debug Steps:**
```javascript
// Check if widget is loaded
console.log(typeof privexbot);  // Should be 'function'

// Check initialization
privexbot('debug');  // Logs internal state
```

### CORS Errors

```
Access to fetch at 'https://api.privexbot.com' from origin 'https://yoursite.com'
has been blocked by CORS policy
```

**Solutions:**
1. Ensure your domain is added to allowed origins in PrivexBot settings
2. Check that you're using HTTPS (not HTTP)
3. Verify API key is correct for your bot

### Session Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| History lost on refresh | LocalStorage disabled | Enable localStorage or use cookies |
| Wrong conversation | Multiple bots | Use unique botIds |
| Session not starting | Network error | Check API connectivity |

**Clear Session:**
```javascript
// Reset the conversation
privexbot('reset');

// Or manually clear storage
localStorage.removeItem('privexbot_session');
```

### Styling Conflicts

| Symptom | Cause | Solution |
|---------|-------|----------|
| Wrong fonts | Global CSS override | Use more specific selectors |
| Colors wrong | CSS variables conflict | Scope your overrides to `#privexbot-widget` |
| Layout broken | `* { box-sizing }` rule | Widget uses its own box-sizing |

**CSS Reset for Widget:**
```css
#privexbot-widget * {
  box-sizing: border-box;
  font-family: inherit;
}
```

### Performance Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| Slow page load | Sync script loading | Use async loading (default) |
| Laggy animations | Too many messages | Widget auto-virtualizes long lists |
| Memory leak | Not destroying widget | Call `privexbot('destroy')` on SPA navigation |

### Mobile-Specific Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| Keyboard covers input | iOS Safari quirk | Enable `hideWhenKeyboardOpen` |
| Can't scroll messages | Touch conflict | Ensure container has `overflow-y: auto` |
| Button too small | Wrong size setting | Increase `buttonSize` for mobile |

---

## Common Integration Patterns

### Single-Page Applications (React, Vue, Angular)

```javascript
// React example
import { useEffect } from 'react';

function ChatWidget() {
  useEffect(() => {
    // Initialize on mount
    privexbot('init', { botId: 'YOUR_BOT_ID' });

    // Cleanup on unmount
    return () => {
      privexbot('destroy');
    };
  }, []);

  return null;  // Widget renders itself
}
```

### WordPress

Add to your theme's `footer.php` before `</body>`:

```php
<script>
  (function(w, d, s, o, f, js, fjs) {
    // Widget initialization code
  }(window, document, 'script', 'privexbot', 'https://widget.privexbot.com/widget.js'));

  privexbot('init', {
    botId: '<?php echo get_option("privexbot_bot_id"); ?>'
  });
</script>
```

### Shopify

Add to `Settings → Files → Edit code → theme.liquid`:

```liquid
{% if template != 'cart' %}
  <script>
    // Widget initialization code
    privexbot('init', {
      botId: 'YOUR_BOT_ID',
      setUser: {
        email: '{{ customer.email }}',
        name: '{{ customer.name }}'
      }
    });
  </script>
{% endif %}
```

---

## Next Steps

Now that your widget is integrated:

1. **[Configure Lead Capture](38-how-to-manage-leads.md)**: Set up forms to collect visitor information
2. **[View Analytics](44-how-to-use-analytics.md)**: Track widget performance
3. **[Deploy to More Channels](39-how-to-deploy-telegram-bot.md)**: Expand beyond website
4. **[Customize Your Bot](36-how-to-manage-deployed-chatbots.md)**: Fine-tune responses

---

*Need help? Visit our [Troubleshooting Guide](50-troubleshooting-guide.md) or contact support.*
