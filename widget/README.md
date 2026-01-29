# PrivexBot Widget

Self-contained, embeddable chat widget for PrivexBot chatbots and chatflows. Vanilla JavaScript with zero runtime dependencies. ~63KB minified / ~15KB gzipped.

**Key capabilities:**
- Works with both chatbots (form-created) and chatflows (visual builder)
- Lead collection with configurable timing and GDPR consent
- Message feedback (thumbs up/down)
- Session persistence across page loads
- Async loader pattern — no render blocking
- Scoped CSS — no style conflicts with host page

## Quick Start

Add before the closing `</body>` tag:

```html
<script>
  (function(w,d,s,o,f,js,fjs){
    w['PrivexBot']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s);fjs=d.getElementsByTagName(s)[0];
    js.id='privexbot-widget';js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','pb','https://widget.privexbot.com/widget.js'));

  pb('init', {
    id: 'your-chatbot-id',
    apiKey: 'your-api-key',
    options: {
      position: 'bottom-right',
      color: '#3b82f6',
      greeting: 'Hi! How can I help you?'
    }
  });
</script>
```

Both `id` and `apiKey` are required. You get these from the PrivexBot dashboard when you deploy a chatbot or chatflow.

## Installation Methods

### CDN (Recommended)

Use the async loader snippet from [Quick Start](#quick-start). The widget loads from `https://widget.privexbot.com/widget.js` via Cloudflare Pages.

### Direct Script Tag

For simpler embedding without the async loader:

```html
<script src="https://widget.privexbot.com/widget.js" data-api-url="https://api.privexbot.com/api/v1"></script>
<script>
  pb('init', {
    id: 'your-chatbot-id',
    apiKey: 'your-api-key',
    options: {
      position: 'bottom-right',
      color: '#3b82f6',
      greeting: 'Hello! How can I help you?',
      botName: 'Support Assistant'
    }
  });
</script>
```

### NPM (For bundlers)

```bash
npm install @privexbot/widget
```

```javascript
import PrivexBotWidget from '@privexbot/widget';

const widget = new PrivexBotWidget();
widget.init({
  id: 'your-chatbot-id',
  apiKey: 'your-api-key',
  options: {
    position: 'bottom-right',
    color: '#3b82f6'
  }
});
```

### Self-Hosted

Build the widget locally and serve from your own infrastructure:

```bash
cd widget
npm install
npm run build
# Serve build/widget.v1.0.0.js from your CDN
```

When self-hosting, set the API base URL explicitly via the `baseURL` option or the `data-api-url` attribute on the script tag.

## Configuration

### All Options

```javascript
pb('init', {
  id: 'chatbot-id-123',        // Required — chatbot or chatflow ID
  apiKey: 'your-api-key',       // Required — API key from dashboard
  options: {
    // Position
    position: 'bottom-right',   // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

    // Appearance
    color: '#3b82f6',           // Primary color (hex) — used for header, bubble, send button
    botName: 'Assistant',       // Name shown in chat header
    greeting: 'Hello! How can I help you today?',  // First message shown
    showBranding: true,         // Show "Powered by PrivexBot" footer
    avatarUrl: null,            // Custom avatar image URL (uses default icon if null)

    // Size
    width: 400,                 // Chat window width in pixels
    height: 600,                // Chat window height in pixels

    // API
    baseURL: 'https://api.privexbot.com/api/v1'  // Custom API base URL
  }
});
```

### Base URL Resolution

The widget resolves the API base URL through a 4-step chain (first match wins):

1. `options.baseURL` or `config.baseURL` passed to `init()`
2. `data-api-url` attribute on the `<script>` tag that loads the widget
3. `window.PRIVEXBOT_API_URL` global variable
4. `http://localhost:8000/api/v1` if hostname is `localhost` or `127.0.0.1`
5. `https://api.privexbot.com/api/v1` (production default)

### Init Formats

The `pb('init', ...)` call accepts two formats:

```javascript
// Object format (recommended)
pb('init', {
  id: 'chatbot-123',
  apiKey: 'key-abc',
  options: { color: '#8b5cf6' }
});

// String + options format
pb('init', 'chatbot-123', {
  apiKey: 'key-abc',
  color: '#8b5cf6'
});
```

## API Methods

All commands are called through the global `pb()` function.

### `pb('init', config)`

Initialize the widget. Must be called before any other command. Can only be called once — subsequent calls are ignored with a warning.

### `pb('open')`

Open the chat window programmatically. Hides the chat bubble and shows the window with animation.

### `pb('close')`

Close the chat window. Hides the window and shows the chat bubble.

### `pb('toggle')`

Toggle the chat window open/closed.

### `pb('destroy')`

Remove the widget from the DOM entirely. Cleans up the container, bubble, window, and API client. After calling destroy, you must call `init` again to re-create the widget.

### `pb('reset')`

Reset the conversation. Generates a new session ID, clears the message history, and re-displays the greeting message.

### `pb('status')`

Returns an object with the current widget state:

```javascript
const status = pb('status');
// {
//   initialized: true,
//   isOpen: false,
//   sessionId: 'widget_1706000000000_abc123_x4f2g1'
// }
```

## Lead Collection

The widget supports lead capture forms with flexible timing and custom fields.

```javascript
pb('init', {
  id: 'chatbot-123',
  apiKey: 'key-abc',
  options: {
    leadConfig: {
      enabled: true,

      // Timing
      timing: 'after_messages', // 'before_chat' | 'after_messages'
      messageCount: 3,          // Show after N user messages (for 'after_messages')

      // Form customization
      title: 'Get in Touch',
      description: "We'd love to hear from you!",
      submitText: 'Continue',
      allowSkip: true,

      // GDPR consent (optional)
      consent: {
        required: true,
        label: 'I agree to the privacy policy'
      },

      // Custom fields
      fields: [
        {
          name: 'name',
          label: 'Name',
          type: 'text',
          required: true,
          placeholder: 'John Doe'
        },
        {
          name: 'email',
          label: 'Email',
          type: 'email',
          required: true,
          placeholder: 'john@example.com'
        },
        {
          name: 'phone',
          label: 'Phone Number',
          type: 'tel',
          required: false,
          placeholder: '+1 (555) 123-4567'
        },
        {
          name: 'company',
          label: 'Company',
          type: 'text',
          required: false,
          placeholder: 'Acme Inc.'
        }
      ]
    }
  }
});
```

### Timing Options

**Before Chat (`timing: 'before_chat'`)**
- Lead form is shown immediately when the widget opens
- Chat starts after form submission or skip
- Use for: high-intent lead capture, gated support

**After Messages (`timing: 'after_messages'`)**
- Chat starts immediately
- Lead form appears inline after N user messages (`messageCount`)
- Use for: warm lead capture, progressive engagement

### Field Types

Supported `type` values: `text`, `email`, `tel`, `select`

For `select` fields, provide an `options` array:

```javascript
{
  name: 'department',
  label: 'Department',
  type: 'select',
  required: true,
  options: ['Sales', 'Support', 'Billing']
}
```

### Validation

- `email` fields are validated for format
- `tel` fields must be 10+ digits
- `required: true` fields must be non-empty
- Consent checkbox must be checked if `consent.required` is true

## Events & Analytics

The widget automatically tracks these events via `POST /public/bots/{bot_id}/events`:

| Event | When | Data |
|---|---|---|
| `widget_loaded` | Widget initialized | `{ url }` |
| `widget_opened` | Chat window opened | `{ url, referrer }` |
| `widget_closed` | Chat window closed | `{ url, referrer }` |
| `message_sent` | User sent a message | `{ url, referrer }` |
| `lead_collected` | Lead form submitted | `{ url, referrer }` |
| `lead_skipped` | Lead form skipped | `{ url, referrer }` |
| `feedback_submitted` | User rated a message | `{ messageId, rating }` |

All events include `session_id` and `timestamp` automatically.

## Message Feedback

Bot messages support thumbs up/down feedback. When a bot response includes a `message_id`, feedback buttons appear below the message. Feedback state is persisted in `sessionStorage` so users see their previous ratings within the same browser session.

Feedback is submitted via `POST /public/bots/{bot_id}/feedback?message_id={message_id}` with a `rating` of `"positive"` or `"negative"` and an optional `comment`.

## API Endpoints

The widget calls these backend endpoints (all prefixed with the configured `baseURL`):

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/public/bots/{bot_id}/config` | Fetch server-side widget configuration (optional, enhances local config) |
| `POST` | `/public/bots/{bot_id}/chat` | Send a chat message and receive AI response |
| `POST` | `/public/bots/{bot_id}/events` | Track analytics events |
| `POST` | `/public/bots/{bot_id}/feedback?message_id={id}` | Submit message feedback (thumbs up/down) |
| `POST` | `/public/leads/capture?bot_id={bot_id}` | Submit lead capture form data |

### Authentication

All requests include an `Authorization: Bearer {apiKey}` header when an API key is configured. A `401` response results in an "Invalid API key" error shown to the user.

### Rate Limiting

A `429` response shows "Too many requests. Please wait a moment before trying again." to the user.

### Request Timeout

All requests have a 60-second timeout. Timed-out requests return a "Request timeout" error.

## Custom Styling

The widget uses scoped CSS classes prefixed with `privexbot-`. All styles can be overridden with `!important`:

### Container & Positioning

```css
.privexbot-widget { }               /* Outer container */
.privexbot-widget.bottom-right { }  /* Position variants */
.privexbot-widget.bottom-left { }
.privexbot-widget.top-right { }
.privexbot-widget.top-left { }
```

### Chat Bubble

```css
.privexbot-bubble { }               /* Floating button (default: purple gradient) */
.privexbot-bubble:hover { }         /* Hover: scale 1.1x */
.privexbot-bubble-icon { }          /* Chat icon SVG */
.privexbot-bubble-badge { }         /* Unread count badge (red circle) */
```

### Chat Window

```css
.privexbot-window { }               /* Main chat window */
.privexbot-header { }               /* Header bar (uses config.color) */
.privexbot-header-avatar { }        /* Avatar circle in header */
.privexbot-header-text h3 { }       /* Bot name */
.privexbot-header-text p { }        /* Status text ("Online") */
.privexbot-close-btn { }            /* Close button */
```

### Messages

```css
.privexbot-messages { }                          /* Scrollable message area */
.privexbot-message { }                           /* Message row */
.privexbot-message.bot { }                       /* Bot message */
.privexbot-message.user { }                      /* User message */
.privexbot-message-avatar { }                    /* Per-message avatar */
.privexbot-message-bubble { }                    /* Message text bubble */
.privexbot-message.bot .privexbot-message-bubble { }   /* Bot bubble style */
.privexbot-message.user .privexbot-message-bubble { }  /* User bubble style */
.privexbot-message-time { }                      /* Timestamp */
.privexbot-message-content { }                   /* Content wrapper */
```

### Feedback

```css
.privexbot-feedback { }             /* Feedback button container */
.privexbot-feedback-btn { }         /* Individual button */
.privexbot-feedback-btn.positive { }  /* Thumbs up */
.privexbot-feedback-btn.negative { }  /* Thumbs down */
.privexbot-feedback-btn.selected { }  /* After user clicks */
```

### Input Area

```css
.privexbot-input-area { }           /* Input section */
.privexbot-input-container { }      /* Input + button wrapper */
.privexbot-input { }                /* Text input */
.privexbot-input:focus { }          /* Focus state */
.privexbot-send-btn { }             /* Send button */
```

### Lead Form

```css
.privexbot-lead-form { }            /* Form container */
.privexbot-lead-form h3 { }         /* Form title */
.privexbot-lead-form p { }          /* Form description */
.privexbot-form-group { }           /* Field wrapper */
.privexbot-form-label { }           /* Field label */
.privexbot-form-input { }           /* Text/email/tel input */
.privexbot-form-error { }           /* Validation error text */
.privexbot-form-submit { }          /* Submit button */
.privexbot-form-skip { }            /* Skip button */
.privexbot-consent-group { }        /* Consent checkbox wrapper */
.privexbot-consent-label { }        /* Consent label */
.privexbot-consent-checkbox { }     /* Consent checkbox */
```

### Typing Indicator

```css
.privexbot-typing { }               /* Typing animation container */
.privexbot-typing-dot { }           /* Individual dot */
```

### Branding

```css
.privexbot-branding { }             /* "Powered by PrivexBot" footer */
.privexbot-branding a { }           /* Link */
```

### Example: Custom Bubble and Message Colors

```css
/* Darker bubble shadow */
.privexbot-bubble {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3) !important;
}

/* Custom bot message background */
.privexbot-message.bot .privexbot-message-bubble {
  background: #f0f0f0 !important;
}

/* Custom user message background */
.privexbot-message.user .privexbot-message-bubble {
  background: #2563eb !important;
  color: #ffffff !important;
}
```

### Font Customization

The widget supports font customization via server config (`font_family` field). Supported presets:

| Value | Font Stack |
|---|---|
| `Inter` | `"Inter", system-ui, sans-serif` |
| `System` | `system-ui, -apple-system, BlinkMacSystemFont, sans-serif` |
| `Monospace` | `ui-monospace, "SF Mono", "Cascadia Mono", monospace` |

Custom font family strings are also supported. This is configured server-side and merged into the widget config on init.

## Deployment

### Cloudflare Pages (Primary)

The widget is deployed to Cloudflare Pages, serving static files from the `build/` directory.

**Configuration** (`wrangler.jsonc`):

```jsonc
{
  "name": "privexbot-widget",
  "compatibility_date": "2026-01-29",
  "assets": {
    "directory": "./build"
  }
}
```

**Deploy:**

```bash
npm run build
npx wrangler pages deploy build/
```

The widget is served at `https://widget.privexbot.com`.

### SecretVM (Fallback)

The widget can also be served via the backend's SecretVM deployment as a static asset. See `deploy/` in the backend for configuration.

### Build Output

| Mode | Output File | Purpose |
|---|---|---|
| Development | `build/widget.js` | Unminified, for local development |
| Production | `build/widget.v1.0.0.js` | Versioned, minified bundle |

The versioned filename (`widget.v{version}.js`) is derived from `package.json` version. For CDN deployment, you should also copy the versioned file to `widget.js` so the unversioned URL always points to the latest version.

**Caching strategy:**
- `widget.js` (unversioned): Short cache TTL, always serves latest
- `widget.v1.0.0.js` (versioned): Long cache TTL (immutable), for pinning to specific versions

## Development

### Setup

```bash
cd widget
npm install
```

### Scripts

| Command | Description |
|---|---|
| `npm run build` | Production build (minified, versioned filename) |
| `npm run dev` | Development build with file watching |
| `npm run serve` | Start webpack-dev-server on `http://localhost:9000` with hot reload |

### Test Page

The dev server opens `test.html` automatically (`http://localhost:9000/test.html`). This page provides:

- Form inputs for chatbot ID, API key, API URL, greeting, bot name, color, and position
- Buttons to initialize, open, close, and destroy the widget
- Status display area
- Auto-generated embed code for copy-paste
- Values persist in `localStorage` between sessions

### Local Development with Backend

1. Start the backend: `docker compose -f backend/docker-compose.dev.yml up`
2. Start the widget dev server: `cd widget && npm run serve`
3. Open `http://localhost:9000/test.html`
4. Enter your chatbot ID and API key from the dashboard
5. The widget auto-detects `localhost` and uses `http://localhost:8000/api/v1`

## Architecture

### Source Structure

```
widget/src/
├── index.js              # Entry point, PrivexBotWidget class, global pb() API
├── api/
│   └── client.js         # WidgetAPIClient — fetch-based HTTP client
├── ui/
│   ├── ChatBubble.js     # Floating chat button with unread badge
│   ├── ChatWindow.js     # Main chat window (header, messages, input, lead form)
│   ├── MessageList.js    # Message rendering, feedback buttons, typing indicator
│   ├── InputBox.js       # Auto-resizing text input with Enter-to-send
│   └── LeadForm.js       # Lead capture form with validation and consent
└── styles/
    └── widget.css        # All widget styles (scoped with .privexbot- prefix)
```

### Build Pipeline

Webpack bundles everything into a single UMD file:
- **Babel** (`@babel/preset-env`) transpiles for browser compatibility
- **css-loader + style-loader** inlines CSS into the JS bundle (no separate CSS file)
- **UMD output** works as a global script, CommonJS, or AMD module

### Async Loader Pattern

The embed snippet works like this:

1. Creates a temporary `pb()` function that queues calls to `pb.q`
2. Injects a `<script>` tag that loads the widget asynchronously
3. When the widget loads, it replaces `pb()` with the real implementation
4. Replays all queued commands from `pb.q`

This means `pb('init', ...)` can be called before the script finishes loading — commands are queued and executed once ready.

### Session Management

- Session IDs are stored in `localStorage` under `privexbot_session_{chatbotId}`
- Format: `widget_{timestamp}_{random}_{browserHash}`
- Browser hash uses screen dimensions + timezone offset (DJB2 hash) to differentiate devices
- If `localStorage` is unavailable (private browsing), an ephemeral session is used
- Sessions persist across page loads until `pb('reset')` is called

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome for Android)

**Not supported:** IE11

**Requirements:** `fetch` API, `localStorage` (graceful degradation without it)

## Security

- **API key auth**: All API requests include `Authorization: Bearer {apiKey}` header
- **Session isolation**: Sessions are scoped per chatbot ID (`privexbot_session_{chatbotId}`)
- **HTML escaping**: Message content is escaped before rendering to prevent XSS
- **CORS**: Backend configures allowed origins via `BACKEND_CORS_ORIGINS`
- **No sensitive data**: Widget code contains no secrets — API key is provided by the embedding page
- **Scoped styles**: All CSS is prefixed with `privexbot-` to avoid conflicts
- **z-index**: Widget uses `z-index: 999999` to stay above host page content

## Troubleshooting

**Widget not showing**
- Check browser console for `PrivexBot:` prefixed errors
- Verify both `id` and `apiKey` are provided — both are required
- Ensure the script URL (`widget.privexbot.com/widget.js`) loads in the Network tab
- Check that `baseURL` resolves correctly (see [Base URL Resolution](#base-url-resolution))

**"API key is required" error**
- The `apiKey` parameter is mandatory. Get it from the PrivexBot dashboard after deploying your chatbot.

**"Invalid API key" error (401)**
- The API key doesn't match the chatbot ID. Verify both values in the dashboard.

**Messages not sending**
- Check network connectivity
- Verify the API base URL is correct and the backend is running
- Check for CORS errors in the console — the backend must allow your domain in `BACKEND_CORS_ORIGINS`
- Check for 429 (rate limit) responses in the Network tab

**Lead form validation errors**
- Email must be a valid format
- Phone must be 10+ digits
- Required fields must be non-empty
- Consent checkbox must be checked if consent is required

**Widget conflicts with page styles**
- All widget classes are prefixed with `privexbot-` and should not conflict
- If you see issues, check for global CSS resets that target `*` or `div` selectors

**Session not persisting**
- Check that `localStorage` is available (not blocked by browser privacy settings)
- In private/incognito browsing, sessions are ephemeral by design

## License

MIT
