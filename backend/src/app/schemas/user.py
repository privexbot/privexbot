"""
Pydantic schemas for User API requests and responses.

WHY:
- Validate API input data
- Serialize database models to JSON responses
- Type safety and documentation
- Separate API contract from database models

HOW:
- Use Pydantic for automatic validation
- Define request schemas (what clients send)
- Define response schemas (what API returns)

PSEUDOCODE:
-----------
from pydantic import BaseModel, EmailStr, UUID4
from datetime import datetime

# Base schema with common fields
class UserBase(BaseModel):
    username: str
        WHY: Common field used in multiple schemas

# Schema for creating a user (API request)
class UserCreate(UserBase):
    
    WHY: Validate user creation data
    HOW: Used in signup endpoints
    
    username: str (min_length=3, max_length=50)
    # Note: password/email handled in AuthIdentity, not here

# Schema for user response (API response)
class UserResponse(UserBase):
    
    WHY: Return user data without sensitive info
    HOW: Convert User model to JSON
    
    id: UUID4
    username: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True  # WHY: Allow creating from ORM models
            HOW: user_response = UserResponse.from_orm(user_model)

# Schema for user in JWT or current user context
class UserInToken(BaseModel):
    
    WHY: Represent user data stored in JWT
    HOW: Created when generating tokens
    
    id: UUID4
    username: str
    email: str | None
        WHY: May not have email if logged in with wallet only

# Schema for current user with permissions
class CurrentUser(UserResponse):
    
    WHY: Include current context (org, workspace, permissions)
    HOW: Returned from /auth/me endpoint
    
    current_org_id: UUID4 | None
    current_workspace_id: UUID4 | None
    permissions: dict[str, bool]
        EXAMPLE: {"org:admin": true, "chatbot:create": true}
    organizations: list[OrganizationSummary]
        WHY: List orgs user belongs to for switching context

USAGE IN API:
-------------
@router.post("/signup", response_model=UserResponse)
def signup(user_data: UserCreate, db: Session = Depends(get_db)):
    # user_data is validated automatically
    # Return UserResponse which excludes sensitive fields
    ...



"""

# ACTUAL IMPLEMENTATION
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict


class UserBase(BaseModel):
    """
    Base schema with common user fields.

    WHY: Shared fields across multiple user schemas
    HOW: Other schemas inherit from this
    """
    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
        description="User's unique username",
        examples=["alice_wonderland"]
    )


class UserCreate(UserBase):
    """
    Schema for creating a new user.

    WHY: Validate user creation data from API requests
    HOW: Used in signup endpoints that create users

    Note: Password and email are handled separately in AuthIdentity
    creation, not in the User model itself.

    Example:
        {
            "username": "alice_wonderland"
        }
    """
    pass  # Only needs username from UserBase


class UserUpdate(BaseModel):
    """
    Schema for updating user information.

    WHY: Allow users to update their profile
    HOW: All fields optional - only update what's provided

    Example:
        {
            "username": "new_username"
        }
    """
    username: Optional[str] = Field(
        None,
        min_length=3,
        max_length=50,
        description="New username (must be unique)"
    )


class UserResponse(UserBase):
    """
    Schema for user data in API responses.

    WHY: Return user data without sensitive information
    HOW: Serialize User model to JSON, exclude sensitive fields

    Excludes: password hashes, auth tokens, internal metadata
    Includes: Public user information safe to share

    Example:
        {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "username": "alice_wonderland",
            "is_active": true,
            "created_at": "2024-01-15T10:30:00Z",
            "updated_at": "2024-01-15T10:30:00Z"
        }
    """
    id: UUID = Field(..., description="User's unique identifier")
    is_active: bool = Field(..., description="Whether user account is active")
    created_at: datetime = Field(..., description="Account creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    model_config = ConfigDict(
        from_attributes=True,
        # WHY: Allow creating from SQLAlchemy ORM models
        # HOW: user_response = UserResponse.model_validate(user_model)
    )


class UserInToken(BaseModel):
    """
    Schema for user data stored in JWT tokens.

    WHY: Represent minimal user context in JWT payload
    HOW: Encoded into JWT tokens for authentication

    Keep minimal to reduce token size while providing enough
    context for authorization decisions.

    Example (JWT payload):
        {
            "sub": "123e4567-e89b-12d3-a456-426614174000",
            "username": "alice_wonderland",
            "email": "alice@example.com",
            "exp": 1640000000
        }
    """
    id: UUID = Field(..., alias="sub", description="User ID (JWT 'sub' claim)")
    username: str = Field(..., description="Username for display")
    email: Optional[str] = Field(
        None,
        description="Email if user has email auth method"
    )
    # WHY email optional: User may only have wallet authentication

    model_config = ConfigDict(populate_by_name=True)
    # WHY: Allow both 'id' and 'sub' field names


class AuthMethodInfo(BaseModel):
    """
    Schema for authentication method information.

    WHY: Show user which auth methods they have linked
    HOW: Displayed in profile/settings

    Example:
        {
            "provider": "email",
            "provider_id": "alice@example.com",
            "linked_at": "2024-01-15T10:30:00Z"
        }
    """
    provider: str = Field(
        ...,
        description="Auth provider type",
        examples=["email", "evm", "solana", "cosmos"]
    )
    provider_id: str = Field(
        ...,
        description="Provider-specific identifier (email or wallet address)"
    )
    linked_at: datetime = Field(
        ...,
        description="When this auth method was linked"
    )


class UserProfile(UserResponse):
    """
    Schema for detailed user profile.

    WHY: Provide complete user information including auth methods
    HOW: Returned from /auth/me or /users/{id} endpoints

    Includes: Basic user info + linked authentication methods

    Example:
        {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "username": "alice_wonderland",
            "is_active": true,
            "created_at": "2024-01-15T10:30:00Z",
            "updated_at": "2024-01-15T10:30:00Z",
            "auth_methods": [
                {
                    "provider": "email",
                    "provider_id": "alice@example.com",
                    "linked_at": "2024-01-15T10:30:00Z"
                },
                {
                    "provider": "evm",
                    "provider_id": "0x742d35Cc...",
                    "linked_at": "2024-01-16T14:20:00Z"
                }
            ]
        }
    """
    auth_methods: List[AuthMethodInfo] = Field(
        default_factory=list,
        description="List of authentication methods linked to this account"
    )


class UserList(BaseModel):
    """
    Schema for paginated user list responses.

    WHY: Return multiple users with pagination metadata
    HOW: Used in /users list endpoint

    Example:
        {
            "users": [
                {"id": "...", "username": "alice", ...},
                {"id": "...", "username": "bob", ...}
            ],
            "total": 42,
            "page": 1,
            "page_size": 20
        }
    """
    users: List[UserResponse] = Field(
        ...,
        description="List of users for current page"
    )
    total: int = Field(..., description="Total number of users")
    page: int = Field(..., description="Current page number (1-indexed)")
    page_size: int = Field(..., description="Number of users per page")
