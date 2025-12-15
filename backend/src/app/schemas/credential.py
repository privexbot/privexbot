"""
Credential Schemas - Pydantic models for credential management.

WHY:
- Validate credential data
- Type-safe credential operations
- Secure credential handling

HOW:
- Pydantic BaseModel
- Field validation
- Type enums

PSEUDOCODE follows the existing codebase patterns.
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime
from enum import Enum


class CredentialType(str, Enum):
    """Credential type enum."""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    COHERE = "cohere"
    GOOGLE = "google"
    NOTION = "notion"
    TELEGRAM = "telegram"
    DISCORD = "discord"
    WHATSAPP = "whatsapp"
    ZAPIER = "zapier"
    HTTP = "http"
    DATABASE = "database"


class CredentialCreate(BaseModel):
    """
    Credential creation schema.

    WHY: Validate credential creation
    HOW: Required fields + credential data

    NOTE: Data will be encrypted before storage
    """

    workspace_id: UUID = Field(..., description="Workspace ID")

    name: str = Field(
        ...,
        description="Credential name",
        min_length=1,
        max_length=200
    )

    credential_type: CredentialType = Field(
        ...,
        description="Credential type"
    )

    data: Dict[str, Any] = Field(
        ...,
        description="Credential data (will be encrypted)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "OpenAI API Key",
                "credential_type": "openai",
                "data": {
                    "api_key": "sk-..."
                }
            }
        }


class CredentialUpdate(BaseModel):
    """
    Credential update schema.

    WHY: Update credential
    HOW: All fields optional
    """

    name: Optional[str] = Field(
        None,
        description="Credential name",
        min_length=1,
        max_length=200
    )

    is_active: Optional[bool] = Field(
        None,
        description="Enable/disable credential"
    )

    data: Optional[Dict[str, Any]] = Field(
        None,
        description="Updated credential data (will be re-encrypted)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Updated API Key Name",
                "is_active": false,
                "data": {
                    "api_key": "sk-new..."
                }
            }
        }


class CredentialResponse(BaseModel):
    """
    Credential response schema.

    WHY: Return credential metadata
    HOW: Exclude encrypted data by default

    NOTE: Encrypted data only returned with include_data=true
    """

    id: UUID = Field(..., description="Credential ID")
    workspace_id: UUID = Field(..., description="Workspace ID")

    name: str = Field(..., description="Credential name")
    credential_type: CredentialType = Field(..., description="Credential type")

    is_active: bool = Field(..., description="Is credential active")
    usage_count: int = Field(..., description="Usage count")

    last_used_at: Optional[datetime] = Field(None, description="Last used timestamp")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    # Only included if explicitly requested
    data: Optional[Dict[str, Any]] = Field(None, description="Decrypted credential data")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "workspace_id": "660e8400-e29b-41d4-a716-446655440000",
                "name": "OpenAI API Key",
                "credential_type": "openai",
                "is_active": true,
                "usage_count": 1234,
                "last_used_at": "2025-10-01T12:00:00Z",
                "created_at": "2025-09-01T10:00:00Z",
                "updated_at": "2025-10-01T12:00:00Z"
            }
        }


class CredentialListResponse(BaseModel):
    """
    Credential list response schema.

    WHY: Return paginated credentials
    HOW: Items + pagination info
    """

    items: List[CredentialResponse] = Field(..., description="List of credentials")
    total: int = Field(..., description="Total count")
    skip: int = Field(..., description="Offset")
    limit: int = Field(..., description="Limit")

    class Config:
        json_schema_extra = {
            "example": {
                "items": [
                    {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "workspace_id": "660e8400-e29b-41d4-a716-446655440000",
                        "name": "OpenAI API Key",
                        "credential_type": "openai",
                        "is_active": true,
                        "usage_count": 1234,
                        "created_at": "2025-09-01T10:00:00Z"
                    }
                ],
                "total": 5,
                "skip": 0,
                "limit": 50
            }
        }


class CredentialTestResponse(BaseModel):
    """
    Credential test response schema.

    WHY: Return test results
    HOW: Validation status + details
    """

    is_valid: bool = Field(..., description="Is credential valid")
    message: str = Field(..., description="Test result message")
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional test metadata"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "is_valid": true,
                "message": "OpenAI API key is valid",
                "metadata": {
                    "organization": "Acme Inc",
                    "models_available": ["gpt-4", "gpt-3.5-turbo"]
                }
            }
        }


class CredentialUsageResponse(BaseModel):
    """
    Credential usage response schema.

    WHY: Return usage statistics
    HOW: Aggregated usage data
    """

    credential_id: UUID = Field(..., description="Credential ID")
    total_uses: int = Field(..., description="Total usage count")
    last_used_at: Optional[datetime] = Field(None, description="Last used timestamp")

    usage_by_day: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Usage grouped by day"
    )

    usage_by_bot: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Usage grouped by bot"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "credential_id": "550e8400-e29b-41d4-a716-446655440000",
                "total_uses": 1234,
                "last_used_at": "2025-10-01T12:00:00Z",
                "usage_by_day": [
                    {"date": "2025-10-01", "count": 150},
                    {"date": "2025-10-02", "count": 200}
                ],
                "usage_by_bot": [
                    {
                        "bot_id": "660e8400-e29b-41d4-a716-446655440000",
                        "bot_name": "Support Bot",
                        "usage_count": 800
                    }
                ]
            }
        }


class HTTPCredentialData(BaseModel):
    """
    HTTP credential data schema.

    WHY: Structured HTTP credential data
    HOW: Headers, auth, etc.
    """

    auth_type: str = Field(..., description="Auth type (bearer, basic, api_key)")
    api_key: Optional[str] = Field(None, description="API key")
    bearer_token: Optional[str] = Field(None, description="Bearer token")
    username: Optional[str] = Field(None, description="Basic auth username")
    password: Optional[str] = Field(None, description="Basic auth password")
    custom_headers: Optional[Dict[str, str]] = Field(None, description="Custom headers")

    class Config:
        json_schema_extra = {
            "example": {
                "auth_type": "bearer",
                "bearer_token": "eyJ...",
                "custom_headers": {
                    "X-Custom-Header": "value"
                }
            }
        }


class DatabaseCredentialData(BaseModel):
    """
    Database credential data schema.

    WHY: Structured database connection data
    HOW: Connection string or individual fields
    """

    connection_type: str = Field(..., description="Database type (postgres, mysql, mongodb)")
    host: str = Field(..., description="Database host")
    port: int = Field(..., description="Database port")
    database: str = Field(..., description="Database name")
    username: str = Field(..., description="Database username")
    password: str = Field(..., description="Database password")
    ssl: Optional[bool] = Field(False, description="Use SSL")

    class Config:
        json_schema_extra = {
            "example": {
                "connection_type": "postgres",
                "host": "db.example.com",
                "port": 5432,
                "database": "mydb",
                "username": "dbuser",
                "password": "dbpass",
                "ssl": true
            }
        }


class OAuthCredentialData(BaseModel):
    """
    OAuth credential data schema.

    WHY: Structured OAuth token data
    HOW: Access token, refresh token, expiry
    """

    access_token: str = Field(..., description="OAuth access token")
    refresh_token: Optional[str] = Field(None, description="OAuth refresh token")
    token_type: str = Field("Bearer", description="Token type")
    expires_at: Optional[datetime] = Field(None, description="Token expiry")
    scope: Optional[str] = Field(None, description="OAuth scope")

    class Config:
        json_schema_extra = {
            "example": {
                "access_token": "ya29.a0AfH6SM...",
                "refresh_token": "1//0gZ...",
                "token_type": "Bearer",
                "expires_at": "2025-10-01T13:00:00Z",
                "scope": "https://www.googleapis.com/auth/drive.readonly"
            }
        }
