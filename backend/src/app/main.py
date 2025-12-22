"""
PrivexBot Backend - FastAPI Application
Main entry point for the API server
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.init_db import init_db
from app.api.v1.routes import auth, org, workspace, context, invitation, kb_draft, kb_pipeline, kb, content_enhancement, enhanced_search, chatbot, public, credentials
from app.api.v1.routes.webhooks import telegram as telegram_webhook, discord as discord_webhook


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

# CORS Configuration
# Allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
