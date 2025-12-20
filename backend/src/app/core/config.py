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
        default="postgresql://privexbot:privexbot_dev@localhost:5432/privexbot_dev",
        description="PostgreSQL connection string"
    )

    # Redis
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection for caching and sessions"
    )

    # JWT/Security
    SECRET_KEY: str = Field(
        default="dev-secret-key-change-in-production",
        description="Secret key for JWT token signing"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

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
    # Secret AI (primary provider for production)
    SECRET_AI_API_KEY: str = Field(
        default="",
        description="Secret AI API key for LLM inference"
    )
    SECRET_AI_BASE_URL: str = Field(
        default="https://api.secret.ai/v1",
        description="Secret AI API base URL"
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
        default="http://localhost:8000/widget",
        description="CDN URL for widget JavaScript"
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


# Create single settings instance to be imported
settings = Settings()
