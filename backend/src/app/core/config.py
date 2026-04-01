"""
Configuration settings loaded from environment variables.

PSEUDOCODE:
-----------
class Settings:
    # Database
    - DATABASE_URL: str (PostgreSQL connection string)

    # Redis
    - REDIS_URL: str (Redis connection for nonce caching)

    # JWT/Security
    - SECRET_KEY: str (for JWT token signing, must be strong random string)
    - ALGORITHM: str (default: "HS256")
    - ACCESS_TOKEN_EXPIRE_MINUTES: int (default: 30)

    # CORS
    - BACKEND_CORS_ORIGINS: list[str] (allowed origins for CORS)

    # App Settings
    - PROJECT_NAME: str (default: "PrivexBot")
    - API_V1_PREFIX: str (default: "/api/v1")

    # Wallet Auth Settings
    - NONCE_EXPIRE_SECONDS: int (default: 300, 5 minutes)

    # Load from .env file using pydantic-settings BaseSettings
    # Use environment variables with validation

# Create single settings instance to be imported
settings = Settings()
"""

# ACTUAL IMPLEMENTATION
import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App Settings
    PROJECT_NAME: str = "PrivexBot"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = Field(
        default="postgresql+psycopg2://privexbot:privexbot_dev@localhost:5432/privexbot_dev",
        description="PostgreSQL connection string (explicitly uses psycopg2 driver)"
    )

    # Redis
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection for caching and sessions"
    )

    # Qdrant Vector Database
    QDRANT_URL: str = Field(
        default="http://qdrant:6333",
        description="Qdrant vector database URL"
    )

    # Tika Document Parsing
    TIKA_URL: str = Field(
        default="http://tika:9998",
        description="Apache Tika server URL for document parsing"
    )

    # JWT/Security
    SECRET_KEY: str = Field(
        default="dev-secret-key-change-in-production",
        description="Secret key for JWT token signing"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Credential Encryption
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    ENCRYPTION_KEY: str = Field(
        default="",
        description="Fernet encryption key for credential storage (required for credential features)"
    )

    # CORS
    BACKEND_CORS_ORIGINS: str = Field(
        default="http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173",
        description="Comma-separated list of allowed origins"
    )

    # Wallet Auth Settings
    NONCE_EXPIRE_SECONDS: int = 300  # 5 minutes

    # Celery
    CELERY_BROKER_URL: str = Field(
        default="redis://localhost:6379/1",
        description="Celery broker URL"
    )
    CELERY_RESULT_BACKEND: str = Field(
        default="redis://localhost:6379/2",
        description="Celery result backend URL"
    )

    # Email Settings (SMTP)
    SMTP_HOST: str = Field(
        default="smtp.gmail.com",
        description="SMTP server host"
    )
    SMTP_PORT: int = Field(
        default=587,
        description="SMTP server port"
    )
    SMTP_USER: str = Field(
        default="",
        description="SMTP username (email address)"
    )
    SMTP_PASSWORD: str = Field(
        default="",
        description="SMTP password or app password"
    )
    SMTP_FROM_EMAIL: str = Field(
        default="noreply@privexbot.com",
        description="Default FROM email address"
    )
    SMTP_FROM_NAME: str = Field(
        default="PrivexBot",
        description="Default FROM name"
    )

    # Frontend URL (for invitation links)
    FRONTEND_URL: str = Field(
        default="http://localhost:5173",
        description="Frontend application URL for generating invitation links"
    )

    # LLM Inference Settings
    # Secret AI (PRIMARY provider for PrivexBot - privacy-preserving via TEE)
    SECRET_AI_API_KEY: str = Field(
        default="",
        description="Secret AI API key for LLM inference"
    )
    SECRET_AI_BASE_URL: str = Field(
        default="https://secretai-api-url.scrtlabs.com:443/v1",
        description="Secret AI API base URL (SecretVM endpoint)"
    )
    USE_SECRET_AI_SDK: bool = Field(
        default=True,
        description="Use native secret-ai-sdk instead of OpenAI-compatible API (requires secret-ai-sdk package)"
    )

    # Inference Fallback Settings
    # Enable fallback to other providers when Secret AI is unavailable (e.g., network blocks)
    INFERENCE_FALLBACK_ENABLED: bool = Field(
        default=True,
        description="Enable fallback to other providers when primary fails"
    )

    # SecretVM Detection (for environment-aware behavior)
    SECRETVM: str = Field(
        default="false",
        description="Set to 'true' when running on SecretVM"
    )

    # Ollama (local inference for development)
    OLLAMA_BASE_URL: str = Field(
        default="http://localhost:11434/v1",
        description="Ollama API base URL (local LLM inference)"
    )

    # OpenAI (alternative provider)
    OPENAI_API_KEY: str = Field(
        default="",
        description="OpenAI API key"
    )

    # DeepSeek (alternative provider)
    DEEPSEEK_API_KEY: str = Field(
        default="",
        description="DeepSeek API key"
    )

    # Gemini (Google AI)
    GEMINI_API_KEY: str = Field(
        default="",
        description="Google Gemini API key"
    )

    # Default inference model
    DEFAULT_INFERENCE_MODEL: str = Field(
        default="llama3.1",
        description="Default model to use for inference"
    )

    # Deployment URLs
    API_BASE_URL: str = Field(
        default="http://localhost:8000/api/v1",
        description="Base URL for API webhooks (e.g., Telegram, Discord)"
    )
    WIDGET_CDN_URL: str = Field(
        default="http://localhost:9000",
        description="CDN URL for widget JavaScript"
    )

    # MinIO Object Storage
    MINIO_ENDPOINT: str = Field(
        default="minio:9000",
        description="MinIO server endpoint (internal Docker network)"
    )
    MINIO_ROOT_USER: str = Field(
        default="privexbot",
        description="MinIO root user (access key)"
    )
    MINIO_ROOT_PASSWORD: str = Field(
        default="privexbot_dev_storage",
        description="MinIO root password (secret key)"
    )
    MINIO_PUBLIC_URL: str = Field(
        default="http://localhost:9000",
        description="Public URL for presigned URLs (external access via Traefik in production)"
    )
    MINIO_SECURE: bool = Field(
        default=False,
        description="Use TLS for internal MinIO connection (TLS handled by Traefik externally)"
    )

    # Notion OAuth Integration
    NOTION_CLIENT_ID: str = Field(
        default="",
        description="Notion OAuth client ID (from Notion integration settings)"
    )
    NOTION_CLIENT_SECRET: str = Field(
        default="",
        description="Notion OAuth client secret (from Notion integration settings)"
    )
    # Google OAuth Integration
    GOOGLE_CLIENT_ID: str = Field(
        default="",
        description="Google OAuth client ID (from Google Cloud Console)"
    )
    GOOGLE_CLIENT_SECRET: str = Field(
        default="",
        description="Google OAuth client secret (from Google Cloud Console)"
    )

    # Discord Shared Bot (Platform-wide)
    # ONE bot token serves ALL customers via guild_id → chatbot_id routing
    DISCORD_SHARED_BOT_TOKEN: str = Field(
        default="",
        description="Discord bot token for shared bot architecture (platform-wide, not per-customer)"
    )
    DISCORD_SHARED_APPLICATION_ID: str = Field(
        default="",
        description="Discord application/client ID for shared bot"
    )
    DISCORD_SHARED_PUBLIC_KEY: str = Field(
        default="",
        description="Discord public key for Ed25519 signature verification"
    )

    # Slack Shared App (Platform-wide)
    # ONE Slack app installed to ALL customer workspaces via team_id → chatbot_id routing
    SLACK_CLIENT_ID: str = Field(
        default="",
        description="Slack app client ID (from Slack API dashboard)"
    )
    SLACK_CLIENT_SECRET: str = Field(
        default="",
        description="Slack app client secret (from Slack API dashboard)"
    )
    SLACK_SIGNING_SECRET: str = Field(
        default="",
        description="Slack signing secret for HMAC-SHA256 request verification"
    )

    # Calendly OAuth Integration
    CALENDLY_CLIENT_ID: str = Field(
        default="",
        description="Calendly OAuth client ID (from Calendly developer dashboard)"
    )
    CALENDLY_CLIENT_SECRET: str = Field(
        default="",
        description="Calendly OAuth client secret (from Calendly developer dashboard)"
    )

    model_config = SettingsConfigDict(
        env_file=".env.dev" if os.getenv("ENVIRONMENT") != "production" else None,
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow"
    )

    @property
    def cors_origins(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",")]

    @property
    def notion_redirect_uri(self) -> str:
        """Auto-derive from API_BASE_URL — always /credentials/oauth/callback."""
        return f"{self.API_BASE_URL}/credentials/oauth/callback"

    @property
    def google_redirect_uri(self) -> str:
        """Auto-derive from API_BASE_URL — same callback as Notion, state distinguishes provider."""
        return f"{self.API_BASE_URL}/credentials/oauth/callback"


# Create single settings instance to be imported
settings = Settings()
