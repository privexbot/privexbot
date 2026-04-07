# PrivexBot Widget

## Overview
Embeddable chat widget. Zero dependencies. Pure vanilla JS. UMD bundle (~15KB gzipped). Works with both chatbots and chatflows identically.

## Architecture
The widget is bot-type agnostic. It sends messages to `POST /public/bots/{id}/chat` and receives responses. The backend handles chatbot vs chatflow routing.

## API Endpoints Called
- `POST /public/bots/{id}/chat` -- Send message, get response
- `GET /public/bots/{id}/config` -- Fetch server-side widget config
- `POST /public/bots/{id}/events` -- Track analytics events
- `POST /public/bots/{id}/feedback?message_id={id}` -- Submit message feedback
- `POST /public/leads/capture?bot_id={id}` -- Submit lead form data

## Message Format
```javascript
// Request
{ message: "text", session_id: "widget_...", metadata: { user_agent, referrer, url, timestamp } }

// Response
{ response: "bot reply", message_id: "msg_...", session_id: "..." }
```

## Initialization
```html
<script>
  (function(w,d,s,o,f){w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
  f=d.createElement(s);f.async=1;f.src='https://widget.privexbot.com/widget.js';
  d.head.appendChild(f)})(window,document,'script','pb');
  pb('init', { id: 'chatbot-uuid', apiKey: 'key', options: { color: '#3b82f6' } });
</script>
```

## File Structure
```
src/
  index.js          # Entry point, PrivexBotWidget class, global pb() API
  api/client.js     # WidgetAPIClient (fetch-based, zero deps)
  ui/
    ChatBubble.js   # Floating button
    ChatWindow.js   # Main chat interface
    MessageList.js  # Messages + feedback system
    InputBox.js     # User input
    LeadForm.js     # Lead capture form
  styles/widget.css # All styles (scoped with .privexbot- prefix)
```

## Building
```bash
npm run build   # Production minified build -> build/widget.js
npm run dev     # Development with watch
npm run serve   # Dev server on port 9000
```

## Key Design Decisions
- No streaming (full response wait with typing indicator)
- Session persisted in localStorage (key: `privexbot_session_{chatbotId}`)
- Feedback in sessionStorage (tab-scoped)
- XSS protection via textContent escaping
- All CSS scoped with `.privexbot-` prefix, z-index 999999
- Mobile: fullscreen on devices under 480px
