"""
PrivexBot Backend - FastAPI Application
Main entry point for the API server
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from app.core.config import settings
from app.db.init_db import init_db
from app.api.v1.routes import auth, org, workspace, context, invitation, kb_draft, kb_pipeline, kb, content_enhancement, enhanced_search, chatbot, chatflows, public, credentials, leads, analytics, dashboard, admin, beta, discord_guilds
from app.api.v1.routes.webhooks import telegram as telegram_webhook, discord as discord_webhook


class PublicAPICORSMiddleware(BaseHTTPMiddleware):
    """
    Custom CORS middleware for public/widget API routes.

    WHY: Widget embeds on customer websites need permissive CORS (any origin).
         Dashboard/auth API needs restricted CORS (specific origins).

    HOW: Intercepts requests to /api/v1/public/* and adds permissive CORS headers.
         Other routes fall through to the standard CORSMiddleware.
    """

    PUBLIC_PATHS = ["/api/v1/public/", "/api/v1/chat/"]  # Widget API paths

    async def dispatch(self, request: Request, call_next):
        # Check if this is a public/widget API route
        is_public_route = any(
            request.url.path.startswith(path) for path in self.PUBLIC_PATHS
        )

        if not is_public_route:
            # Let standard CORSMiddleware handle non-public routes
            return await call_next(request)

        # Handle OPTIONS preflight for public routes
        if request.method == "OPTIONS":
            return Response(
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Max-Age": "86400",  # Cache preflight for 24 hours
                },
            )

        # Process the actual request
        response = await call_next(request)

        # Override CORS headers for public routes (widget API needs permissive CORS)
        # Note: credentials=false is required when origin=* per CORS spec
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        # Remove credentials header if set by CORSMiddleware (incompatible with origin=*)
        if "Access-Control-Allow-Credentials" in response.headers:
            del response.headers["Access-Control-Allow-Credentials"]

        return response


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

# Discord guild management routes (shared bot architecture)
app.include_router(
    discord_guilds.router,
    prefix=settings.API_V1_PREFIX,
    tags=["discord"]
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
