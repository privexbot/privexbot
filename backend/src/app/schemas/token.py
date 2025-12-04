"""
Pydantic schemas for authentication tokens and auth requests.

WHY:
- Validate authentication requests (login, wallet signature)
- Structure token responses
- Type-safe auth payloads

PSEUDOCODE:
-----------
from pydantic import BaseModel, EmailStr

# JWT Token Response
class Token(BaseModel):
    
    WHY: Standard OAuth2 token response
    HOW: Returned from all login/signup endpoints
    
    access_token: str
        WHY: JWT token string
    token_type: str = "bearer"
        WHY: Standard OAuth2 token type
    expires_in: int
        WHY: Seconds until token expires
        EXAMPLE: 1800 (30 minutes)

# Email Login Request
class EmailLoginRequest(BaseModel):
    
    WHY: Validate email/password login
    
    email: EmailStr
        WHY: Validates email format automatically
    password: str (min_length=8)
        WHY: Ensure minimum password length

# Email Signup Request
class EmailSignupRequest(BaseModel):
    
    WHY: Validate email signup with password
    
    username: str (min_length=3, max_length=50)
    email: EmailStr
    password: str (min_length=8, max_length=100)
        WHY: Strong password requirements

# Wallet Challenge Request
class WalletChallengeRequest(BaseModel):
    
    WHY: Request nonce for wallet signing
    HOW: Used in GET /auth/{provider}/challenge
    
    address: str
        WHY: Wallet address (0x... for EVM, base58 for Solana, etc.)
        VALIDATION: Format depends on provider (EVM, Solana, Cosmos)

# Wallet Challenge Response
class WalletChallengeResponse(BaseModel):
    
    WHY: Return message to sign and nonce
    HOW: Client signs this message with wallet
    
    message: str
        WHY: Formatted message following EIP-4361 (for EVM) or equivalent
        EXAMPLE: "Please sign this message to authenticate. Nonce: abc123"
    nonce: str
        WHY: Random string stored in Redis for verification

# Wallet Verify Request
class WalletVerifyRequest(BaseModel):
    
    WHY: Verify wallet signature
    HOW: Used in POST /auth/{provider}/verify
    
    address: str
        WHY: Wallet address that signed the message
    signature: str
        WHY: Signature from wallet (hex string)
    signed_message: str
        WHY: The exact message that was signed

# Context Switch Request
class SwitchContextRequest(BaseModel):
    
    WHY: Allow user to switch active org/workspace
    HOW: Issues new JWT with different org_id/ws_id
    
    organization_id: UUID4
    workspace_id: UUID4 | None
        WHY: Optional - can switch to org without specific workspace

AUTH FLOW EXAMPLES:
-------------------
1. Email Login:
    POST /auth/email/login
    Body: EmailLoginRequest
    Response: Token

2. Wallet Auth:
    Step 1: GET /auth/evm/challenge?address=0x123
        Response: WalletChallengeResponse

    Step 2: User signs message in wallet

    Step 3: POST /auth/evm/verify
        Body: WalletVerifyRequest
        Response: Token

3. Switch Organization:
    POST /auth/session/switch-context
    Body: SwitchContextRequest
    Response: Token (new JWT with updated context)



"""

# ACTUAL IMPLEMENTATION
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Optional
from uuid import UUID


class Token(BaseModel):
    """
    Standard OAuth2 token response.

    WHY: Consistent token response format across all auth endpoints
    HOW: Returned from signup/login/verify endpoints

    Follows OAuth2 standard for bearer tokens.

    Example:
        {
            "access_token": "eyJhbGciOiJIUzI1NiIs...",
            "token_type": "bearer",
            "expires_in": 1800
        }
    """
    access_token: str = Field(
        ...,
        description="JWT access token",
        examples=["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."]
    )
    token_type: str = Field(
        default="bearer",
        description="Token type (OAuth2 standard)",
        examples=["bearer"]
    )
    expires_in: int = Field(
        ...,
        description="Token expiration time in seconds",
        examples=[1800],  # 30 minutes
        gt=0  # Must be positive
    )


class EmailSignupRequest(BaseModel):
    """
    Request schema for email/password signup.

    WHY: Validate user registration data
    HOW: Used in POST /auth/email/signup

    Validates:
    - Username format and length
    - Email format (via EmailStr)
    - Password strength (via validate_password_strength in route)

    Example:
        {
            "username": "alice_wonderland",
            "email": "alice@example.com",
            "password": "SecurePass123!"
        }
    """
    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
        description="Desired username (must be unique)",
        examples=["alice_wonderland"]
    )
    email: EmailStr = Field(
        ...,
        description="User's email address",
        examples=["alice@example.com"]
    )
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Password (validated for strength in endpoint)",
        examples=["SecurePass123!"]
    )


class EmailLoginRequest(BaseModel):
    """
    Request schema for email/password login.

    WHY: Validate login credentials
    HOW: Used in POST /auth/email/login

    Example:
        {
            "email": "alice@example.com",
            "password": "SecurePass123!"
        }
    """
    email: EmailStr = Field(
        ...,
        description="User's email address",
        examples=["alice@example.com"]
    )
    password: str = Field(
        ...,
        min_length=8,
        description="User's password",
        examples=["SecurePass123!"]
    )


class ChangePasswordRequest(BaseModel):
    """
    Request schema for changing password.

    WHY: Validate password change data
    HOW: Used in POST /auth/email/change-password

    Requires old password verification before setting new password.

    Example:
        {
            "old_password": "SecurePass123!",
            "new_password": "NewSecurePass456!"
        }
    """
    old_password: str = Field(
        ...,
        min_length=8,
        description="Current password for verification"
    )
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="New password (validated for strength in endpoint)"
    )

    @field_validator('new_password')
    @classmethod
    def passwords_must_differ(cls, v, info):
        """Ensure new password is different from old password."""
        if 'old_password' in info.data and v == info.data['old_password']:
            raise ValueError('New password must be different from old password')
        return v


class WalletChallengeRequest(BaseModel):
    """
    Request schema for wallet authentication challenge.

    WHY: Request nonce for wallet signature verification
    HOW: Used as query parameter in GET /auth/{provider}/challenge

    Address format varies by provider:
    - EVM: 0x... (42 chars hex)
    - Solana: base58 (~44 chars)
    - Cosmos: cosmos1... or secret1... (bech32)

    Example:
        {
            "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
        }
    """
    address: str = Field(
        ...,
        description="Wallet address (format depends on provider)",
        examples=[
            "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",  # EVM
            "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",  # Solana
            "cosmos1hsk6jryyqjfhp5dhc55tc9jtckygx0eph6dd02"  # Cosmos
        ],
        min_length=20,  # Minimum reasonable address length
        max_length=100  # Maximum reasonable address length
    )


class WalletChallengeResponse(BaseModel):
    """
    Response schema for wallet authentication challenge.

    WHY: Provide message for user to sign with their wallet
    HOW: Returned from GET /auth/{provider}/challenge

    User signs the message with their wallet, then submits
    signature for verification.

    Example:
        {
            "message": "privexbot.com wants you to sign in...\nNonce: abc123...",
            "nonce": "abc123def456..."
        }
    """
    message: str = Field(
        ...,
        description="Message to sign (includes nonce)",
        examples=["privexbot.com wants you to sign in with your Ethereum account:\n0x742d35Cc...\n\nNonce: abc123..."]
    )
    nonce: str = Field(
        ...,
        description="Random nonce for replay protection",
        examples=["abc123def456789"]
    )


class WalletVerifyRequest(BaseModel):
    """
    Request schema for wallet signature verification.

    WHY: Verify wallet ownership via cryptographic signature
    HOW: Used in POST /auth/{provider}/verify

    Contains the signed message and signature for verification.

    Example:
        {
            "address": "0x742d35Cc...",
            "signed_message": "privexbot.com wants you to...",
            "signature": "0xabc123...",
            "username": "alice_eth"  # optional
        }
    """
    address: str = Field(
        ...,
        description="Wallet address that signed the message"
    )
    signed_message: str = Field(
        ...,
        description="The exact message that was signed"
    )
    signature: str = Field(
        ...,
        description="Signature from wallet (encoding depends on provider)"
    )
    username: Optional[str] = Field(
        None,
        min_length=3,
        max_length=50,
        description="Custom username for new users (auto-generated if not provided)"
    )


class CosmosWalletVerifyRequest(WalletVerifyRequest):
    """
    Request schema for Cosmos wallet signature verification.

    WHY: Cosmos requires public key in addition to signature
    HOW: Extends WalletVerifyRequest with public_key field

    Unlike EVM (which can recover pubkey from signature), Cosmos
    wallets provide the public key separately.

    Example:
        {
            "address": "cosmos1...",
            "signed_message": "Sign this message...",
            "signature": "bW9ja19zaWduYXR1cmU=",  # base64
            "public_key": "Ay1hY2tfcHVibGljX2tleQ==",  # base64
            "username": "alice_cosmos"  # optional
        }
    """
    public_key: str = Field(
        ...,
        description="Base64-encoded public key from Cosmos wallet"
    )


class LinkWalletRequest(BaseModel):
    """
    Request schema for linking a wallet to existing account.

    WHY: Allow users to add wallet auth to email-only accounts
    HOW: Used in POST /auth/link/{provider}

    Requires authentication (existing JWT token) plus wallet
    signature verification.

    Example:
        {
            "address": "0x742d35Cc...",
            "signed_message": "privexbot.com wants you to...",
            "signature": "0xabc123..."
        }
    """
    address: str = Field(..., description="Wallet address to link")
    signed_message: str = Field(..., description="Signed challenge message")
    signature: str = Field(..., description="Wallet signature")


class CosmosLinkWalletRequest(LinkWalletRequest):
    """
    Request schema for linking a Cosmos wallet.

    WHY: Cosmos requires public key for verification
    HOW: Extends LinkWalletRequest with public_key field

    Example:
        {
            "address": "cosmos1...",
            "signed_message": "Sign this message...",
            "signature": "bW9ja19zaWduYXR1cmU=",
            "public_key": "Ay1hY2tfcHVibGljX2tleQ=="
        }
    """
    public_key: str = Field(
        ...,
        description="Base64-encoded public key"
    )


class LinkEmailRequest(BaseModel):
    """
    Request schema for linking email to existing account.

    WHY: Allow wallet-only users to add email/password auth
    HOW: Used in POST /auth/link/email

    Requires authentication (existing JWT token) plus new
    email and password.

    Example:
        {
            "email": "alice@example.com",
            "password": "SecurePass123!"
        }
    """
    email: EmailStr = Field(..., description="Email to link")
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Password to set"
    )


class TokenPayload(BaseModel):
    """
    Schema for decoded JWT token payload.

    WHY: Type-safe JWT payload parsing
    HOW: Used when decoding and validating JWT tokens

    Standard JWT claims:
    - sub: Subject (user ID)
    - exp: Expiration time
    - iat: Issued at time

    Example:
        {
            "sub": "123e4567-e89b-12d3-a456-426614174000",
            "email": "alice@example.com",
            "exp": 1640000000,
            "iat": 1639998200
        }
    """
    sub: UUID = Field(..., description="Subject (user ID)")
    email: Optional[str] = Field(None, description="User's email if available")
    exp: int = Field(..., description="Expiration timestamp")
    iat: int = Field(..., description="Issued at timestamp")


class PasswordResetRequestSchema(BaseModel):
    """
    Request schema for requesting password reset.

    WHY: Validate email for password reset request
    HOW: Used in POST /auth/password-reset/request

    Security:
    - Always returns success even if email doesn't exist (prevents enumeration)
    - Rate limited to prevent spam

    Example:
        {
            "email": "alice@example.com"
        }
    """
    email: EmailStr = Field(
        ...,
        description="Email address to send reset link to",
        examples=["alice@example.com"]
    )


class PasswordResetValidateSchema(BaseModel):
    """
    Request schema for validating reset token.

    WHY: Validate reset token before allowing password change
    HOW: Used in POST /auth/password-reset/validate

    Example:
        {
            "token": "abc123def456..."
        }
    """
    token: str = Field(
        ...,
        description="Password reset token",
        min_length=32,
        max_length=128,
        examples=["abc123def456789"]
    )


class PasswordResetConfirmSchema(BaseModel):
    """
    Request schema for confirming password reset.

    WHY: Reset password with valid token
    HOW: Used in POST /auth/password-reset/confirm

    Example:
        {
            "token": "abc123def456...",
            "new_password": "NewSecurePass456!"
        }
    """
    token: str = Field(
        ...,
        description="Password reset token",
        min_length=32,
        max_length=128
    )
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="New password (validated for strength in endpoint)",
        examples=["NewSecurePass456!"]
    )


class PasswordResetResponseSchema(BaseModel):
    """
    Response schema for password reset operations.

    WHY: Provide clear feedback about email delivery status
    HOW: Returned from reset endpoints

    Example:
        {
            "message": "Password reset email sent successfully",
            "email_sent": true,
            "reset_link": null
        }
    """
    message: str = Field(
        ...,
        description="Success or status message",
        examples=[
            "Password reset email sent successfully",
            "Password reset link created (email delivery failed)",
            "Password reset successfully"
        ]
    )
    email_sent: bool = Field(
        ...,
        description="Whether the email was successfully sent",
        examples=[True, False]
    )
    reset_link: Optional[str] = Field(
        None,
        description="Reset link for development/testing (only when email_sent is False)",
        examples=[
            None,
            "http://localhost:5174/password-reset?token=abc123..."
        ]
    )


class SimpleMessageResponseSchema(BaseModel):
    """
    Response schema for simple message responses.

    WHY: Provide simple success messages for validate/confirm operations
    HOW: Returned from validate and confirm endpoints

    Example:
        {
            "message": "Reset token is valid"
        }
    """
    message: str = Field(
        ...,
        description="Success message",
        examples=[
            "Reset token is valid",
            "Password reset successfully"
        ]
    )


class EnhancedLoginResponseSchema(BaseModel):
    """
    Response schema for enhanced login that can detect new users.

    WHY: Differentiate between invalid credentials and new users for signup flow
    HOW: Returns different status codes for different scenarios

    Examples:
        Success: {"status": "success", "token": {...}}
        Wrong password: {"status": "invalid_credentials", "message": "Invalid credentials"}
        New user: {"status": "email_not_found", "message": "Email not registered", "email": "user@example.com"}
    """
    status: str = Field(
        ...,
        description="Login status",
        examples=["success", "invalid_credentials", "email_not_found"]
    )
    message: Optional[str] = Field(
        None,
        description="Status message",
        examples=["Login successful", "Invalid credentials", "Email not registered"]
    )
    token: Optional[Token] = Field(
        None,
        description="JWT token data (only for successful login)"
    )
    email: Optional[str] = Field(
        None,
        description="Email address (only for new user flow)"
    )


class EmailVerificationRequestSchema(BaseModel):
    """
    Request schema for sending email verification code.

    WHY: Send verification code to email for signup
    HOW: Used when new user wants to signup

    Example:
        {
            "email": "newuser@example.com",
            "password": "SecurePass123!",
            "username": "newuser"
        }
    """
    email: EmailStr = Field(
        ...,
        description="Email address to send verification code to"
    )
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Password for the new account"
    )
    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
        description="Username for the new account"
    )


class EmailVerificationResponseSchema(BaseModel):
    """
    Response schema for email verification code request.

    WHY: Confirm verification code was sent
    HOW: Returned after sending verification email

    Example:
        {
            "message": "Verification code sent to email",
            "code_sent": true,
            "expires_in": 300
        }
    """
    message: str = Field(
        ...,
        description="Success message"
    )
    code_sent: bool = Field(
        ...,
        description="Whether verification code was sent successfully"
    )
    expires_in: int = Field(
        ...,
        description="Code expiration time in seconds",
        examples=[300]  # 5 minutes
    )


class VerifyEmailCodeRequestSchema(BaseModel):
    """
    Request schema for verifying email code and completing signup.

    WHY: Verify email ownership and complete account creation
    HOW: Used to verify the code sent to email

    Example:
        {
            "email": "newuser@example.com",
            "code": "123456"
        }
    """
    email: EmailStr = Field(
        ...,
        description="Email address that received the code"
    )
    code: str = Field(
        ...,
        min_length=6,
        max_length=6,
        pattern="^[0-9]{6}$",
        description="6-digit verification code",
        examples=["123456"]
    )