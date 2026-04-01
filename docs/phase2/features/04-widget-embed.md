# Widget Embed — Status & Implementation Design
> Feature: Embed PrivexBot chatbot on any website via `<script>` tag
> MOU Reference: Appendix A ("Websites (embed code or custom domain)"), Milestone 4
> Status: ✅ LARGELY COMPLETE — Widget JS built, needs serving endpoint + embed code generator

---

## 1. Current Status

**The widget is complete.** There is a full production-ready widget at `/Users/mac/Downloads/privexbot/widget/`.

### What Exists

| Component | Location | Status |
|---|---|---|
| Widget JavaScript bundle | `widget/build/widget.js` (64.7 KB) | ✅ Built and ready |
| Versioned bundle | `widget/build/widget.v1.0.0.js` | ✅ Built |
| Widget source code | `widget/src/index.js` | ✅ Complete |
| API client | `widget/src/api/client.js` | ✅ Complete |
| Chat UI components | `widget/src/ui/` (5 components) | ✅ Complete |
| Lead capture form | `widget/src/ui/LeadForm.js` | ✅ Complete |
| Build system | `widget/webpack.config.js` | ✅ Webpack configured |
| Nginx serve config | `widget/nginx.conf` | ✅ Configured |
| Docker deployment | `widget/Dockerfile`, `widget/docker-compose.yml` | ✅ Ready |
| Cloudflare Workers config | `widget/wrangler.jsonc` | ✅ Configured |
| Backend public API | `src/app/api/v1/routes/public.py` | ✅ CORS enabled for `*` origins |
| Widget CORS middleware | `src/app/main.py:16–78` | ✅ `PublicAPICORSMiddleware` for `/api/v1/public/*` |

### What the Widget Calls (Backend API Endpoints)

All these endpoints are implemented in `src/app/api/v1/routes/public.py`:

| Widget Call | Backend Endpoint | Status |
|---|---|---|
| Send message | `POST /api/v1/public/bots/{bot_id}/chat` | ✅ Implemented |
| Get bot config | `GET /api/v1/public/bots/{bot_id}/config` | ⚠️ Verify endpoint exists |
| Track events | `POST /api/v1/public/bots/{bot_id}/events` | ⚠️ Verify endpoint exists |
| Submit feedback | `POST /api/v1/public/bots/{bot_id}/feedback` | ✅ Implemented |
| Capture lead | `POST /api/v1/public/leads/capture` | ✅ Implemented |

---

## 2. Embed Code Formats

The widget supports two embed formats. These are the codes that should be displayed in the PrivexBot dashboard "Deploy → Website" tab.

### Format 1: IIFE Async Loader (Recommended)
```html
<script>
  (function(w,d,s,o,f,js,fjs){
    w['PrivexBot']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s);fjs=d.getElementsByTagName(s)[0];
    js.id='privexbot-widget';js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','pb','https://widget.privexbot.com/widget.js'));
  pb('init', {
    id: 'YOUR_BOT_ID',
    apiKey: 'YOUR_API_KEY',
    options: {
      baseURL: 'https://api.privexbot.com/api/v1',
      botName: 'Support',
      color: '#3b82f6',
      greeting: 'Hello! How can I help you today?'
    }
  });
</script>
```

### Format 2: Simple Global Config
```html
<script>
  window.privexbotConfig = {
    botId: 'YOUR_BOT_ID',
    apiKey: 'YOUR_API_KEY',
    baseURL: 'https://api.privexbot.com/api/v1'
  };
</script>
<script src="https://widget.privexbot.com/widget.js" async></script>
```

---

## 3. What Still Needs to Be Done

### Gap A: Backend Config Endpoint ⚠️

The widget calls `GET /api/v1/public/bots/{bot_id}/config` at startup to fetch bot appearance settings. This endpoint needs to return widget configuration for the frontend.

**Verify `public.py` has this endpoint.** Based on the `WidgetConfigResponse` model at line ~103 in `public.py`, it likely exists but needs verification. If missing:

```python
@router.get("/public/bots/{bot_id}/config")
async def get_bot_config(bot_id: UUID, db: Session = Depends(get_db)):
    """
    Return widget configuration for a deployed bot.

    WHY: Widget loads config at startup (bot name, avatar, colors, greeting)
    HOW: Read from chatbot/chatflow record

    RETURNS: WidgetConfigResponse
    """
    # Try chatbot first
    from app.models.chatbot import Chatbot
    from app.models.chatflow import Chatflow

    bot = db.query(Chatbot).filter(Chatbot.id == bot_id, Chatbot.is_active == True).first()
    if not bot:
        bot = db.query(Chatflow).filter(Chatflow.id == bot_id, Chatflow.is_active == True).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    config = bot.config or {}
    return {
        "bot_id": str(bot_id),
        "bot_name": config.get("name", "Assistant"),
        "avatar_url": config.get("avatar_url"),
        "color": config.get("color", "#3b82f6"),
        "greeting": config.get("greeting", "Hello! How can I help?"),
        "show_branding": config.get("show_branding", True),
        "lead_config": config.get("lead_capture_config", {})
    }
```

### Gap B: Widget Serving Infrastructure

The `widget.js` bundle at `widget/build/widget.js` must be served at a public URL. Two options:

**Option 1: Nginx serving (already configured)**
- `widget/nginx.conf` is already set up
- `widget/docker-compose.yml` defines the service
- Serve `widget/build/` directory at `https://widget.privexbot.com`
- This is deployment infrastructure, not code

**Option 2: Cloudflare Workers (already configured)**
- `widget/wrangler.jsonc` is already configured for Cloudflare Workers
- Deploy with `wrangler deploy`
- Provides CDN edge distribution globally

**Recommendation:** Use Nginx via the existing docker-compose.yml for simplicity in SecretVM deployment.

### Gap C: Embed Code Generator in Dashboard

The PrivexBot frontend needs a "Deploy → Website" tab that shows the embed code for copy-pasting. This is a **frontend task** (not backend).

The embed code should dynamically include the bot's actual ID and API key:

```typescript
// In frontend (ChatbotBuilder/deployment panel)
const embedCode = `<script>
  (function(w,d,s,o,f,js,fjs){
    w['PrivexBot']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s);fjs=d.getElementsByTagName(s)[0];
    js.id='privexbot-widget';js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','pb','https://widget.privexbot.com/widget.js'));
  pb('init', {
    id: '${botId}',
    apiKey: '${apiKey}',
    options: { baseURL: '${API_BASE_URL}' }
  });
</script>`;
```

### Gap D: Events Endpoint ⚠️

The widget calls `POST /api/v1/public/bots/{bot_id}/events` to track widget opens, closes, and message counts. Verify this endpoint exists in `public.py` (the `EventTrackingRequest` model at line ~94 suggests it may exist but needs confirmation).

---

## 4. Widget Configuration Reference

Full configuration options accepted by the widget (from `widget/src/index.js`):

| Config Key | Type | Default | Description |
|---|---|---|---|
| `id` | string | required | Bot UUID from PrivexBot dashboard |
| `apiKey` | string | required | API key from bot deployment settings |
| `baseURL` | string | auto-detected | Backend API base URL |
| `position` | string | `"bottom-right"` | `"bottom-right"`, `"bottom-left"`, `"top-right"`, `"top-left"` |
| `color` | string | `"#3b82f6"` | Primary color hex |
| `greeting` | string | `"Hello! How can I help?"` | Initial greeting message |
| `botName` | string | `"Assistant"` | Display name in chat header |
| `showBranding` | bool | `true` | Show "Powered by PrivexBot" footer |
| `width` | number | `400` | Window width in pixels |
| `height` | number | `600` | Window height in pixels |
| `leadConfig` | object | `{}` | Lead capture form configuration |
| `avatarUrl` | string | `null` | Bot avatar image URL |
| `font_family` | string | `"Inter"` | Font family: `"Inter"`, `"System"`, `"Monospace"` |

---

## 5. Session Management

The widget creates and stores a session ID in `localStorage` under key `privexbot_session_{botId}`. The session ID format is:

```
widget_{timestamp}_{random}_{browserHash}
```

Where `browserHash` is based on screen dimensions + timezone (non-identifying, purely for deduplication). This session ID is sent in every API call, maintaining conversation context across page reloads.

Session IDs starting with `widget_` are automatically recognized by `src/app/api/v1/routes/public.py` as widget sessions.

---

## 6. Custom Domain

The `custom_domain` field exists in:
- `src/app/api/v1/routes/public.py` (line ~153 in `HostedPageConfigResponse`)
- `src/app/services/draft_service.py`

**What's needed for full custom domain support:**
1. DNS CNAME configuration (user points `chat.theirdomain.com` → `widget.privexbot.com`)
2. A route in the widget server that reads the incoming domain and injects the correct `bot_id`
3. SSL certificate via Let's Encrypt or Cloudflare

This is **deployment/infrastructure work**, not application code.

---

## 7. Summary: Action Items

| Item | Type | Priority | Notes |
|---|---|---|---|
| Verify `GET /public/bots/{bot_id}/config` endpoint | Backend | 🔴 HIGH | Widget calls this at startup |
| Verify `POST /public/bots/{bot_id}/events` endpoint | Backend | 🟡 MEDIUM | Analytics tracking |
| Deploy `widget/build/widget.js` via Nginx/CDN | Infrastructure | 🔴 HIGH | Needed for embed to work |
| Add embed code generator to frontend dashboard | Frontend | 🔴 HIGH | Users need the code to copy |
| Custom domain routing | Infrastructure | 🟡 MEDIUM | Nice-to-have for premium users |
| Rebuild widget bundle if source changed | Build | 🟡 MEDIUM | Run `npm run build` in widget/ |

---

## 8. Testing the Widget Locally

The widget has a `test.html` file at `widget/test.html` for local testing. To test:

```bash
# From widget/ directory
npm install
npm run dev   # Starts webpack dev server on port 9000
# Open http://localhost:9000 in browser
# Widget will connect to backend API defined in test.html
```

For production testing, set `window.PRIVEXBOT_API_URL` before loading the script, or configure `data-api-url` attribute on the script tag.
