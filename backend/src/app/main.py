"""
PrivexBot Backend - FastAPI Application
Main entry point for the API server
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.datastructures import MutableHeaders
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from app.core.config import settings
from app.db.init_db import init_db
from app.api.v1.routes import auth, org, workspace, context, invitation, kb_draft, kb_pipeline, kb, content_enhancement, enhanced_search, chatbot, chatflows, public, credentials, leads, analytics, dashboard, admin, beta, discord_guilds, slack_workspaces, files, notifications, integrations, billing, templates, referrals
from app.api.v1.routes.webhooks import telegram as telegram_webhook, discord as discord_webhook, zapier as zapier_webhook, whatsapp as whatsapp_webhook, slack as slack_webhook, calendly as calendly_webhook


class PublicAPICORSMiddleware:
    """
    Pure ASGI middleware for public/widget API routes.

    WHY: Widget embeds on customer websites need permissive CORS (any origin).
         Dashboard/auth API needs restricted CORS (specific origins).

    HOW: Intercepts requests to /api/v1/public/* and adds permissive CORS headers.
         Other routes pass through directly to CORSMiddleware (zero overhead).

    NOTE: This is a pure ASGI middleware (not BaseHTTPMiddleware) to avoid
         the known Starlette issue where BaseHTTPMiddleware can drop CORS
         headers from the inner CORSMiddleware during error responses.
    """

    PUBLIC_PATHS = ["/api/v1/public/", "/api/v1/chat/"]

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        is_public = any(path.startswith(p) for p in self.PUBLIC_PATHS)

        if not is_public:
            # Direct passthrough — CORSMiddleware handles CORS with zero interference
            await self.app(scope, receive, send)
            return

        # Handle OPTIONS preflight for public routes
        if scope.get("method", "") == "OPTIONS":
            await send({
                "type": "http.response.start",
                "status": 200,
                "headers": [
                    (b"access-control-allow-origin", b"*"),
                    (b"access-control-allow-methods", b"GET, POST, PUT, DELETE, OPTIONS"),
                    (b"access-control-allow-headers", b"*"),
                    (b"access-control-max-age", b"86400"),
                    (b"content-length", b"0"),
                ],
            })
            await send({"type": "http.response.body", "body": b""})
            return

        # For public non-OPTIONS requests, wrap send to inject permissive CORS headers
        async def send_with_public_cors(message):
            if message["type"] == "http.response.start":
                headers = MutableHeaders(raw=list(message.get("headers", [])))
                headers["Access-Control-Allow-Origin"] = "*"
                headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
                headers["Access-Control-Allow-Headers"] = "*"
                if "Access-Control-Allow-Credentials" in headers:
                    del headers["Access-Control-Allow-Credentials"]
                message = {**message, "headers": headers.raw}
            await send(message)

        await self.app(scope, receive, send_with_public_cors)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events

    WHY: Modern FastAPI pattern replacing deprecated on_event decorators
    HOW: Code before yield runs on startup, code after yield runs on shutdown
    """
    # Startup
    print(f"🚀 {settings.PROJECT_NAME} Backend starting...")
    print(f"📝 Environment: {settings.ENVIRONMENT}")
    print(f"🔐 CORS enabled for: {settings.cors_origins}")

    # Initialize database tables
    try:
        init_db()
    except Exception as e:
        print(f"⚠️  Database initialization warning: {e}")
        print("   (This is normal if database is not yet accessible)")

    # Initialize MinIO buckets
    try:
        from app.services.storage_service import storage_service
        print("📦 Initializing MinIO storage buckets...")
        storage_service.ensure_buckets()
        print("📦 MinIO storage ready")
    except Exception as e:
        print(f"⚠️  MinIO initialization warning: {e}")
        print("   (File storage features will be unavailable)")

    # Surface missing OAuth / shared-bot env vars at startup so operators
    # see the gaps once instead of debugging deploy errors per-channel later.
    # No hard-fail — local dev only needs the providers it's actively
    # working on; deploys for unconfigured channels will report
    # "needs platform setup" in the UI.
    _provider_env_checks = [
        ("Slack",            "SLACK_CLIENT_ID",            settings.SLACK_CLIENT_ID),
        ("Google",           "GOOGLE_CLIENT_ID",           settings.GOOGLE_CLIENT_ID),
        ("Notion",           "NOTION_CLIENT_ID",           settings.NOTION_CLIENT_ID),
        ("Calendly",         "CALENDLY_CLIENT_ID",         settings.CALENDLY_CLIENT_ID),
        ("Discord shared bot", "DISCORD_SHARED_APPLICATION_ID", settings.DISCORD_SHARED_APPLICATION_ID),
    ]
    missing = [(provider, var) for provider, var, value in _provider_env_checks if not value]
    if missing:
        print("⚠️  OAuth / shared-bot configuration:")
        for provider, var in missing:
            print(f"   - {var} empty → {provider} channel will report 'needs platform setup'.")
    else:
        print("✅ All OAuth / shared-bot env vars set.")

    # Discord shared-bot: register global slash commands on startup so /ask
    # and /chat are available across all guilds without per-guild calls.
    # Per-guild registration still runs at install time for instant
    # availability; this is the safety net for guilds installed before
    # per-guild registration was wired up. Idempotent (PUT replaces all).
    if settings.DISCORD_SHARED_BOT_TOKEN and settings.DISCORD_SHARED_APPLICATION_ID:
        try:
            from app.integrations.discord_integration import discord_integration

            commands = [
                {
                    "name": "ask",
                    "description": "Ask the assistant a question",
                    "options": [
                        {"name": "message", "type": 3, "description": "Your question", "required": True}
                    ],
                },
                {
                    "name": "chat",
                    "description": "Chat with the assistant",
                    "options": [
                        {"name": "message", "type": 3, "description": "Your message", "required": True}
                    ],
                },
            ]
            await discord_integration.register_global_commands(
                bot_token=settings.DISCORD_SHARED_BOT_TOKEN,
                application_id=settings.DISCORD_SHARED_APPLICATION_ID,
                commands=commands,
            )
            print("✅ Discord global slash commands registered (/ask, /chat).")
        except Exception as exc:
            print(f"⚠️  Discord global slash registration failed: {exc}")

    yield

    # Shutdown
    print(f"👋 {settings.PROJECT_NAME} Backend shutting down...")


# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Privacy-First AI Chatbot Builder API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# Proxy headers middleware - ensures request.scope['scheme'] reflects
# X-Forwarded-Proto from Traefik. Without this, FastAPI's 307 trailing-slash
# redirects use http:// instead of https://, causing mixed content errors.
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

# CORS Configuration - Two-tier strategy:
# 1. Public/Widget API (/api/v1/public/*, /api/v1/chat/*): Allow ALL origins
#    (widgets embed on any customer website, including file:// for local testing)
# 2. Dashboard/Auth API: Restricted to configured origins (settings.cors_origins)
#
# Middleware order matters: last added runs first on requests.
# Standard CORSMiddleware handles dashboard routes, PublicAPICORSMiddleware handles widget routes.

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add public API CORS middleware (runs BEFORE standard CORSMiddleware)
app.add_middleware(PublicAPICORSMiddleware)

# Include API routers
# WHY: Mount all routes under /api/v1 prefix
# HOW: Use include_router with prefix and tags
app.include_router(
    auth.router,
    prefix=settings.API_V1_PREFIX,
    tags=["authentication"]
)

app.include_router(
    org.router,
    prefix=f"{settings.API_V1_PREFIX}/orgs",
    tags=["organizations"]
)

app.include_router(
    workspace.router,
    prefix=f"{settings.API_V1_PREFIX}/orgs",
    tags=["workspaces"]
)

app.include_router(
    context.router,
    prefix=f"{settings.API_V1_PREFIX}/switch",
    tags=["context"]
)

app.include_router(
    invitation.router,
    prefix=settings.API_V1_PREFIX,
    tags=["invitations"]
)

app.include_router(
    kb_draft.router,
    prefix=settings.API_V1_PREFIX,
    tags=["kb_drafts"]
)

app.include_router(
    kb_pipeline.router,
    prefix=settings.API_V1_PREFIX,
    tags=["kb_pipelines"]
)

app.include_router(
    kb.router,
    prefix=settings.API_V1_PREFIX
)

app.include_router(
    content_enhancement.router,
    prefix=settings.API_V1_PREFIX,
    tags=["content_enhancement"]
)

app.include_router(
    enhanced_search.router,
    prefix=settings.API_V1_PREFIX
)

# Chatbot routes (draft creation, deployment, management)
app.include_router(
    chatbot.router,
    prefix=settings.API_V1_PREFIX,
    tags=["chatbots"]
)

# Chatflow routes (visual workflow builder)
app.include_router(
    chatflows.router,
    prefix=settings.API_V1_PREFIX,
    tags=["chatflows"]
)

# Public API routes (unified bot access for widgets and integrations)
app.include_router(
    public.router,
    prefix=settings.API_V1_PREFIX,
    tags=["public"]
)

# Credentials routes (encrypted API keys/tokens for chatflow nodes and integrations)
app.include_router(
    credentials.router,
    prefix=settings.API_V1_PREFIX,
    tags=["credentials"]
)

# Integration routes (Notion, Google Docs, etc.)
app.include_router(
    integrations.router,
    prefix=settings.API_V1_PREFIX,
    tags=["integrations"]
)

# Leads routes (lead capture, management, analytics)
app.include_router(
    leads.router,
    prefix=settings.API_V1_PREFIX,
    tags=["leads"]
)

# Analytics routes (performance metrics, cost tracking)
app.include_router(
    analytics.router,
    prefix=settings.API_V1_PREFIX,
    tags=["analytics"]
)

# Dashboard routes (aggregated statistics)
app.include_router(
    dashboard.router,
    prefix=settings.API_V1_PREFIX,
    tags=["dashboard"]
)

# Admin routes (staff-only backoffice)
app.include_router(
    admin.router,
    prefix=settings.API_V1_PREFIX,
    tags=["admin"]
)

# Beta access routes (invite codes, beta status)
app.include_router(
    beta.router,
    prefix=settings.API_V1_PREFIX,
    tags=["beta"]
)

# Billing routes (plan tiers, usage view, manual upgrade)
app.include_router(
    billing.router,
    prefix=settings.API_V1_PREFIX,
)

# Marketplace — global chatflow templates
app.include_router(
    templates.router,
    prefix=settings.API_V1_PREFIX,
)

# Referrals — per-user codes + invite tracking
app.include_router(
    referrals.router,
    prefix=settings.API_V1_PREFIX,
)

# Discord guild management routes (shared bot architecture)
app.include_router(
    discord_guilds.router,
    prefix=settings.API_V1_PREFIX,
    tags=["discord"]
)

# Slack workspace management routes (shared bot architecture)
app.include_router(
    slack_workspaces.router,
    prefix=settings.API_V1_PREFIX,
    tags=["slack"]
)

# File management routes (avatars, file uploads)
app.include_router(
    files.router,
    prefix=settings.API_V1_PREFIX,
    tags=["files"]
)

# In-app notifications
app.include_router(
    notifications.router,
    prefix=settings.API_V1_PREFIX,
    tags=["notifications"]
)

# Webhook routes (Telegram, Discord, etc.)
# These receive incoming messages from external platforms
app.include_router(
    telegram_webhook.router,
    prefix=settings.API_V1_PREFIX,
    tags=["webhooks"]
)

app.include_router(
    discord_webhook.router,
    prefix=settings.API_V1_PREFIX,
    tags=["webhooks"]
)

app.include_router(
    zapier_webhook.router,
    prefix=settings.API_V1_PREFIX,
    tags=["webhooks"]
)

app.include_router(
    whatsapp_webhook.router,
    prefix=settings.API_V1_PREFIX,
    tags=["webhooks"]
)

app.include_router(
    slack_webhook.router,
    prefix=settings.API_V1_PREFIX,
    tags=["webhooks"]
)

app.include_router(
    calendly_webhook.router,
    prefix=settings.API_V1_PREFIX,
    tags=["webhooks"]
)


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for Docker healthcheck and monitoring"""
    return {
        "status": "healthy",
        "service": "privexbot-backend",
        "version": "0.1.0"
    }


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "version": "0.1.0",
        "docs": "/api/docs",
        "health": "/health",
        "environment": settings.ENVIRONMENT
    }


# API v1 endpoints (for testing basic functionality)
@app.get("/api/v1/ping")
async def ping():
    """Simple ping endpoint to test API connectivity"""
    return {
        "message": "pong",
        "environment": settings.ENVIRONMENT
    }


@app.get("/api/v1/status")
async def status():
    """Get API status and environment info"""
    return {
        "status": "online",
        "environment": settings.ENVIRONMENT,
        "cors_origins": settings.cors_origins,
        "database": "PostgreSQL (configured)",
        "redis": "Redis (configured)",
        "api_prefix": settings.API_V1_PREFIX
    }


# Test endpoint with CORS
@app.post("/api/v1/test")
async def test_post(data: dict):
    """Test POST endpoint to verify CORS is working"""
    return {
        "message": "POST request received successfully",
        "data": data,
        "cors": "enabled"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
