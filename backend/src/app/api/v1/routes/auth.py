"""
Authentication API routes.

WHY:
- Provide REST API for all authentication methods
- Support email/password and wallet authentication
- Enable account linking (multiple auth methods per user)

HOW:
- Email: signup, login, change-password
- Wallets (EVM/Solana/Cosmos): challenge-response pattern
- JWT tokens for session management

ENDPOINTS:
-----------
Email Auth:
  POST /auth/email/signup - Register with email/password
  POST /auth/email/login - Login with email/password
  POST /auth/email/change-password - Change password (requires auth)

EVM Wallet Auth:
  POST /auth/evm/challenge - Get challenge message to sign
  POST /auth/evm/verify - Verify signature and login
  POST /auth/evm/link - Link wallet to existing account (requires auth)

Solana Wallet Auth:
  POST /auth/solana/challenge - Get challenge message to sign
  POST /auth/solana/verify - Verify signature and login
  POST /auth/solana/link - Link wallet to existing account (requires auth)

Cosmos Wallet Auth:
  POST /auth/cosmos/challenge - Get challenge message to sign
  POST /auth/cosmos/verify - Verify signature and login
  POST /auth/cosmos/link - Link wallet to existing account (requires auth)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict

from app.api.v1.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.workspace import Workspace
from app.core.security import create_access_token
from app.core.config import settings
from app.schemas.token import (
    EmailSignupRequest,
    EmailLoginRequest,
    ChangePasswordRequest,
    WalletChallengeRequest,
    WalletVerifyRequest,
    CosmosWalletVerifyRequest,
    LinkWalletRequest,
    CosmosLinkWalletRequest,
    LinkEmailRequest,
    Token,
    WalletChallengeResponse,
    PasswordResetRequestSchema,
    PasswordResetValidateSchema,
    PasswordResetConfirmSchema,
    PasswordResetResponseSchema,
    SimpleMessageResponseSchema,
    EnhancedLoginResponseSchema,
    EmailVerificationRequestSchema,
    EmailLinkVerificationRequestSchema,
    EmailVerificationResponseSchema,
    VerifyEmailCodeRequestSchema
)
from app.schemas.user import UserProfile, AuthMethodInfo, UserUpdate
from app.auth.strategies import email, evm, solana, cosmos
from app.services.tenant_service import create_organization, list_user_organizations


router = APIRouter(prefix="/auth", tags=["authentication"])


# ============================================================
# CURRENT USER
# ============================================================

@router.post("/logout", status_code=200)
async def logout(
    current_user: User = Depends(get_current_user),
):
    """
    Sign out the current user.

    Today this is effectively a no-op on the server — JWT tokens are
    stateless and expire naturally at the configured TTL. The endpoint
    exists so the frontend has a stable contract to call before clearing
    localStorage, and so we can layer a Redis revocation blacklist on
    later without changing any client code.

    Returns 200 even if the token is about to expire — the client should
    clear local credentials regardless.
    """
    import logging
    logging.getLogger(__name__).info(
        "User %s signed out", current_user.id
    )
    return {"status": "ok"}


@router.get("/me", response_model=UserProfile)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current authenticated user's profile.

    WHY: Allow frontend to fetch user details after login
    HOW: Extract user from JWT token, load auth methods from DB

    Flow:
    1. JWT token validated by get_current_user dependency
    2. Load user's authentication methods from database
    3. Return UserProfile with all linked auth methods

    Args:
        current_user: Authenticated user (from JWT token)
        db: Database session (injected)

    Returns:
        UserProfile with user data and linked auth methods

    Raises:
        HTTPException(401): Invalid or missing JWT token (from dependency)

    Example Response:
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
                }
            ]
        }
    """
    # Get user's auth identities
    from app.models.auth_identity import AuthIdentity

    auth_identities = db.query(AuthIdentity).filter(
        AuthIdentity.user_id == current_user.id
    ).all()

    # Convert to AuthMethodInfo schemas
    auth_methods = [
        AuthMethodInfo(
            provider=auth.provider,
            provider_id=auth.provider_id,
            linked_at=auth.created_at
        )
        for auth in auth_identities
    ]

    # Return UserProfile with access flags
    return UserProfile(
        id=current_user.id,
        username=current_user.username,
        avatar_url=current_user.avatar_url,
        is_active=current_user.is_active,
        is_staff=current_user.is_staff,
        has_beta_access=current_user.has_beta_access,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
        auth_methods=auth_methods
    )


# ============================================================
# EMAIL AUTHENTICATION
# ============================================================

@router.post("/email/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
async def email_signup(
    request: EmailSignupRequest,
    db: Session = Depends(get_db)
):
    """
    Register a new user with email and password.

    WHY: Allow users to create account with traditional credentials
    HOW: Validate input, create user, create default org + workspace, return JWT token

    Flow:
    1. Validate email format and password strength
    2. Check if email already registered
    3. Hash password with bcrypt
    4. Create User and AuthIdentity records
    5. Create default Personal organization (as owner)
    6. Create default workspace (as admin)
    7. Generate JWT token with org_id + ws_id
    8. Return token for immediate login

    Args:
        request: EmailSignupRequest with username, email, password
        db: Database session (injected)

    Returns:
        Token with access_token and expiration

    Raises:
        HTTPException(400): Email already registered or weak password
        HTTPException(400): Username already taken
    """
    # Step 1: Create user with email strategy
    user = await email.signup_with_email(
        email=request.email,
        password=request.password,
        username=request.username,
        db=db
    )

    # Step 2: Create default Personal organization + workspace
    # This function creates org, adds user as owner, creates default workspace, adds user as admin
    org = create_organization(
        db=db,
        name=f"{user.username}'s Organization",
        billing_email=request.email,
        creator_id=user.id,
        is_default=True  # Mark as personal organization
    )

    # Step 3: Get the default workspace that was just created
    default_workspace = db.query(Workspace).filter(
        Workspace.organization_id == org.id,
        Workspace.is_default == True
    ).first()

    # Step 4: Record referral if a code was supplied (best-effort).
    if request.referral_code:
        try:
            from app.api.v1.routes.referrals import record_referral_signup
            record_referral_signup(
                db=db,
                referral_code=request.referral_code,
                new_user_id=user.id,
                email=request.email,
            )
        except Exception:
            # Never break signup over a referral lookup failure.
            pass

    # Step 5: Generate JWT with org + workspace context
    access_token = create_access_token(data={
        "sub": str(user.id),
        "org_id": str(org.id),
        "ws_id": str(default_workspace.id) if default_workspace else None
    })

    return Token(
        access_token=access_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60  # Convert minutes to seconds
    )


@router.post("/email/login", response_model=Token)
async def email_login(
    request: EmailLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Login with email and password.

    WHY: Authenticate existing users with credentials
    HOW: Verify password hash, return JWT token with org/workspace context

    Flow:
    1. Find user by email
    2. Verify password matches hash
    3. Check account is active
    4. Get user's organizations and workspaces
    5. Generate JWT token with org_id + ws_id
    6. Return token for authenticated requests

    Args:
        request: EmailLoginRequest with email and password
        db: Database session (injected)

    Returns:
        Token with access_token and expiration

    Raises:
        HTTPException(401): Invalid credentials or inactive account
        HTTPException(500): User has no organizations

    Security:
    - Same error for all failures (prevents user enumeration)
    - Bcrypt constant-time comparison (prevents timing attacks)
    """
    # Step 1: Verify credentials
    user = await email.login_with_email(
        email=request.email,
        password=request.password,
        db=db
    )

    # Step 2: Get user's organizations (returns list of (org, role) tuples)
    user_orgs = list_user_organizations(db=db, user_id=user.id)

    if not user_orgs:
        # USER HAS NO ORGANIZATIONS - Auto-create default organization
        # This can happen when:
        # 1. User deleted all their organizations
        # 2. User was removed from all organizations
        # 3. Data migration/corruption edge case

        # Get user's email for billing_email (if available)
        from app.models.auth_identity import AuthIdentity
        email_identity = db.query(AuthIdentity).filter(
            AuthIdentity.user_id == user.id,
            AuthIdentity.provider == "email"
        ).first()

        billing_email = email_identity.provider_id if email_identity else f"{user.username}@local.privexbot.com"

        # Auto-create default organization
        org = create_organization(
            db=db,
            name=f"{user.username}'s Organization",
            billing_email=billing_email,
            creator_id=user.id,
            is_default=True  # Mark as personal organization for profile visibility
        )

        # Get the default workspace that was automatically created
        workspace = db.query(Workspace).filter(
            Workspace.organization_id == org.id,
            Workspace.is_default == True
        ).first()

        # Log this event for monitoring
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Auto-created organization for user {user.id} ({user.username}) during login")

    else:
        # Step 3: Use first organization (usually Personal org)
        org, role = user_orgs[0]

        # Step 4: Get first workspace in that org (prefer default)
        workspace = db.query(Workspace).filter(
            Workspace.organization_id == org.id
        ).order_by(
            Workspace.is_default.desc(),  # Default workspace first
            Workspace.created_at.asc()     # Otherwise oldest
        ).first()

    # Step 5: Generate JWT with context
    access_token = create_access_token(data={
        "sub": str(user.id),
        "org_id": str(org.id),
        "ws_id": str(workspace.id) if workspace else None
    })

    return Token(
        access_token=access_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60  # Convert minutes to seconds
    )


@router.post("/email/change-password", response_model=Dict[str, str])
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Change user's password (requires authentication).

    WHY: Allow users to update password securely
    HOW: Verify current password, validate new password, update hash

    Flow:
    1. Extract user from JWT token
    2. Verify current password
    3. Validate new password strength
    4. Update password hash
    5. Return success message

    Args:
        request: ChangePasswordRequest with old and new passwords
        current_user: Authenticated user (from JWT token)
        db: Database session (injected)

    Returns:
        Success message

    Raises:
        HTTPException(400): No email auth method found
        HTTPException(400): New password doesn't meet requirements
        HTTPException(401): Current password incorrect

    Security:
    - Requires valid JWT token (prevents unauthorized changes)
    - Verifies old password (prevents takeover)
    - Enforces password strength (prevents weak passwords)
    """
    # Call email strategy
    await email.change_password(
        user_id=current_user.id,
        old_password=request.old_password,
        new_password=request.new_password,
        db=db
    )

    return {"message": "Password changed successfully"}


# ============================================================
# PASSWORD RESET
# ============================================================

@router.post("/password-reset/request", response_model=PasswordResetResponseSchema)
async def request_password_reset(
    request: PasswordResetRequestSchema,
    db: Session = Depends(get_db)
):
    """
    Request password reset email.

    WHY: Allow users to reset forgotten passwords securely
    HOW: Generate secure token, store in Redis, send email

    Flow:
    1. Validate email address
    2. Generate secure reset token
    3. Store token in Redis (1 hour expiration)
    4. Send email with reset link (via email_service_enhanced with retry)
    5. Always return success (prevents user enumeration)

    Args:
        request: PasswordResetRequestSchema with email
        db: Database session (injected)

    Returns:
        Success message (always, even if email doesn't exist)

    Security:
    - Always returns success to prevent user enumeration
    - Token expires in 1 hour
    - Rate limited to prevent spam
    - Secure token generation with 256 bits entropy

    Example:
        POST /auth/password-reset/request
        Body: {"email": "alice@example.com"}
        Response: {"message": "Password reset email sent successfully"}
    """
    # Call email strategy and get enhanced response
    response_data = await email.request_password_reset(
        email=request.email,
        db=db
    )

    # Return enhanced response with email sending status
    return PasswordResetResponseSchema(**response_data)


@router.post("/password-reset/validate", response_model=SimpleMessageResponseSchema)
async def validate_reset_token(
    request: PasswordResetValidateSchema
):
    """
    Validate password reset token.

    WHY: Check if reset token is valid before allowing password change
    HOW: Verify token exists in Redis and hasn't expired

    Flow:
    1. Check if token exists in Redis
    2. Verify token format and expiration
    3. Return validation result

    Args:
        request: PasswordResetValidateSchema with token

    Returns:
        Success message if token is valid

    Raises:
        HTTPException(400): Invalid or expired token

    Example:
        POST /auth/password-reset/validate
        Body: {"token": "abc123def456..."}
        Response: {"message": "Reset token is valid"}
    """
    # Validate token
    user_id = await email.validate_reset_token(request.token)

    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token"
        )

    return SimpleMessageResponseSchema(
        message="Reset token is valid"
    )


@router.post("/password-reset/confirm", response_model=SimpleMessageResponseSchema)
async def confirm_password_reset(
    request: PasswordResetConfirmSchema,
    db: Session = Depends(get_db)
):
    """
    Reset password with valid token.

    WHY: Allow users to set new password using reset token
    HOW: Validate token, update password hash, consume token

    Flow:
    1. Validate reset token
    2. Validate new password strength
    3. Update user's password hash
    4. Consume token (one-time use)
    5. Return success

    Args:
        request: PasswordResetConfirmSchema with token and new password
        db: Database session (injected)

    Returns:
        Success message

    Raises:
        HTTPException(400): Invalid token or weak password
        HTTPException(404): User not found

    Security:
    - Token is consumed after use (one-time only)
    - Password strength validation
    - Secure password hashing with bcrypt

    Example:
        POST /auth/password-reset/confirm
        Body: {
            "token": "abc123def456...",
            "new_password": "NewSecurePass456!"
        }
        Response: {"message": "Password reset successfully"}
    """
    # Call email strategy
    await email.reset_password_with_token(
        token=request.token,
        new_password=request.new_password,
        db=db
    )

    return SimpleMessageResponseSchema(
        message="Password reset successfully"
    )


# ============================================================
# EMAIL VERIFICATION & SIGNUP
# ============================================================

@router.post("/email/login-enhanced", response_model=EnhancedLoginResponseSchema)
async def enhanced_email_login(
    request: EmailLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Enhanced email login that can differentiate new users for signup flow.

    WHY: Enable seamless new user onboarding with email verification
    HOW: Returns different responses for login success, invalid credentials, and new users

    Flow:
    1. Check if email exists in database
    2. If email not found, return email_not_found status for signup flow
    3. If email exists, verify password and return appropriate status

    Args:
        request: EmailLoginRequest with email and password
        db: Database session (injected)

    Returns:
        EnhancedLoginResponseSchema with status-specific data

    Security:
    - Only reveals email existence AFTER password attempt
    - Same timing for password verification regardless of email existence
    - Rate limiting should be applied at API gateway level

    Example Responses:
        Success: {"status": "success", "token": {...}}
        Wrong password: {"status": "invalid_credentials", "message": "Invalid credentials"}
        New user: {"status": "email_not_found", "email": "user@example.com"}
    """
    # Call enhanced login strategy
    result = await email.enhanced_login_with_email(
        email=request.email,
        password=request.password,
        db=db
    )

    # Handle successful login - create JWT token
    if result["status"] == "success":
        user = result["user"]
        access_token = create_access_token(
            data={"sub": str(user.id), "email": request.email}
        )

        return EnhancedLoginResponseSchema(
            status="success",
            message="Login successful",
            token=Token(
                access_token=access_token,
                expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
            )
        )

    # Handle other statuses (invalid_credentials, email_not_found)
    return EnhancedLoginResponseSchema(**result)


@router.post("/email/send-verification", response_model=EmailVerificationResponseSchema)
async def send_email_verification(
    request: EmailVerificationRequestSchema
):
    """
    Send email verification code for new user signup.

    WHY: Verify email ownership before creating account
    HOW: Generate 6-digit code, store in Redis, send email

    Flow:
    1. Validate password strength
    2. Check if email/username already exist
    3. Generate verification code
    4. Store signup data in Redis (5min expiry)
    5. Send code via email

    Args:
        request: EmailVerificationRequestSchema with email, password, username

    Returns:
        EmailVerificationResponseSchema with verification status

    Security:
    - Verification codes expire in 5 minutes
    - Single-use codes stored in Redis
    - Password strength validation
    - Rate limiting should be applied

    Example:
        POST /auth/email/send-verification
        Body: {"email": "user@example.com", "password": "SecurePass123!", "username": "newuser"}
        Response: {"message": "Verification code sent", "code_sent": true, "expires_in": 300}
    """
    # Step 1: Validate password strength
    from app.auth.strategies.email import validate_password_strength
    is_valid, error_msg = validate_password_strength(request.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # Step 2: Check if email already exists
    from app.models.auth_identity import AuthIdentity
    from app.api.v1.dependencies import get_db
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        existing_email = db.query(AuthIdentity).filter(
            AuthIdentity.provider == "email",
            AuthIdentity.provider_id == request.email.lower()
        ).first()

        if existing_email:
            raise HTTPException(
                status_code=409,
                detail="Email already registered. Please log in instead."
            )

        # Step 3: Check if username already exists
        from app.models.user import User
        existing_username = db.query(User).filter(
            User.username == request.username
        ).first()

        if existing_username:
            raise HTTPException(
                status_code=400,
                detail="Username already taken. Please choose a different username."
            )

    finally:
        db.close()

    # Step 4: Generate and send verification code
    result = await email.send_email_verification_code(
        email=request.email,
        username=request.username,
        password=request.password
    )

    return EmailVerificationResponseSchema(**result)


@router.post("/email/verify-and-signup", response_model=Token)
async def verify_email_and_signup(
    request: VerifyEmailCodeRequestSchema,
    db: Session = Depends(get_db)
):
    """
    Verify email code and complete user signup with automatic login.

    WHY: Complete account creation after email verification
    HOW: Verify code, create user account, return JWT token

    Flow:
    1. Retrieve verification data from Redis
    2. Verify the submitted code
    3. Create user account and auth identity
    4. Generate JWT token for automatic login

    Args:
        request: VerifyEmailCodeRequestSchema with email and verification code
        db: Database session (injected)

    Returns:
        Token for immediate authentication

    Security:
    - Single-use code consumption
    - Race condition protection
    - Automatic cleanup on success or failure

    Example:
        POST /auth/email/verify-and-signup
        Body: {"email": "user@example.com", "code": "123456"}
        Response: {"access_token": "eyJhbGciOiJIUzI1NiIs...", "expires_in": 1800}
    """
    # Verify code and create user
    user = await email.verify_email_code_and_signup(
        email=request.email,
        code=request.code,
        db=db
    )

    # Record referral if a code was supplied (best-effort).
    if request.referral_code:
        try:
            from app.api.v1.routes.referrals import record_referral_signup
            record_referral_signup(
                db=db,
                referral_code=request.referral_code,
                new_user_id=user.id,
                email=request.email,
            )
        except Exception:
            pass

    # Generate JWT token for automatic login
    access_token = create_access_token(
        data={"sub": str(user.id), "email": request.email}
    )

    return Token(
        access_token=access_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


# ============================================================
# EVM WALLET AUTHENTICATION
# ============================================================

@router.post("/evm/challenge", response_model=WalletChallengeResponse)
async def evm_challenge(request: WalletChallengeRequest):
    """
    Generate challenge message for EVM wallet signature.

    WHY: Implement secure challenge-response authentication
    HOW: Generate nonce, store in Redis, return EIP-4361 message

    Flow:
    1. Validate Ethereum address format
    2. Generate cryptographically secure nonce
    3. Store nonce in Redis (5 min expiration)
    4. Create EIP-4361 compliant message
    5. Return message for user to sign in wallet

    Args:
        request: WalletChallengeRequest with address

    Returns:
        WalletChallengeResponse with message to sign and nonce

    Raises:
        HTTPException(400): Invalid address format

    Security:
    - Nonce expires in 5 minutes
    - Single-use nonce (deleted after verification)
    - EIP-4361 format prevents phishing
    """
    challenge = await evm.request_challenge(address=request.address)
    return WalletChallengeResponse(**challenge)


@router.post("/evm/verify", response_model=Token)
async def evm_verify(
    request: WalletVerifyRequest,
    db: Session = Depends(get_db)
):
    """
    Verify EVM wallet signature and authenticate user.

    WHY: Cryptographically prove wallet ownership without passwords
    HOW: Recover signer from signature, verify matches address, create org if new user

    Flow:
    1. Retrieve nonce from Redis (single-use)
    2. Verify nonce in signed message
    3. Recover signer address from signature
    4. Verify recovered address matches claimed address
    5. Find or create user
    6. If new user, create default org + workspace
    7. Get user's organizations and workspaces
    8. Generate JWT token with org_id + ws_id

    Args:
        request: WalletVerifyRequest with address, message, signature
        db: Database session (injected)

    Returns:
        Token with access_token and expiration

    Raises:
        HTTPException(400): Nonce expired or invalid
        HTTPException(401): Signature verification failed

    Security:
    - Nonce is single-use (prevents replay attacks)
    - ECDSA signature recovery proves private key ownership
    - No password needed - cryptographic proof
    """
    # Step 1: Verify signature and get or create user
    user = await evm.verify_signature(
        address=request.address,
        signed_message=request.signed_message,
        signature=request.signature,
        db=db,
        username=request.username
    )

    # Step 2: Check if user has organization, create if not
    user_orgs = list_user_organizations(db=db, user_id=user.id)

    if not user_orgs:
        # New user - create default organization + workspace
        org = create_organization(
            db=db,
            name=f"{user.username}'s Organization",
            billing_email=f"{user.username}@wallet.user",  # Placeholder email
            creator_id=user.id,
            is_default=True  # Mark as personal organization for profile visibility
        )
        user_orgs = [(org, "owner")]

    # Step 3: Use first organization
    org, role = user_orgs[0]

    # Step 4: Get first workspace in that org (prefer default)
    workspace = db.query(Workspace).filter(
        Workspace.organization_id == org.id
    ).order_by(
        Workspace.is_default.desc(),  # Default workspace first
        Workspace.created_at.asc()     # Otherwise oldest
    ).first()

    # Step 5: Generate JWT with context
    access_token = create_access_token(data={
        "sub": str(user.id),
        "org_id": str(org.id),
        "ws_id": str(workspace.id) if workspace else None
    })

    return Token(
        access_token=access_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60  # Convert minutes to seconds
    )


@router.post("/evm/link", response_model=Dict[str, str])
async def evm_link(
    request: LinkWalletRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Link EVM wallet to existing user account (requires authentication).

    WHY: Allow users to add wallet auth to email-only accounts
    HOW: Verify signature, create new AuthIdentity for existing user

    Flow:
    1. Extract user from JWT token
    2. Verify wallet signature (same as /verify)
    3. Check wallet not already linked to another account
    4. Create AuthIdentity linking wallet to user
    5. Return success message

    Args:
        request: LinkWalletRequest with address, message, signature
        current_user: Authenticated user (from JWT token)
        db: Database session (injected)

    Returns:
        Success message

    Raises:
        HTTPException(400): Wallet already linked to another account
        HTTPException(401): Signature verification failed

    Use Case:
    - User signed up with email, now wants to add MetaMask
    - User has multiple wallets, wants to link all to same account
    """
    # Call EVM strategy
    await evm.link_evm_to_user(
        user_id=str(current_user.id),
        address=request.address,
        signed_message=request.signed_message,
        signature=request.signature,
        db=db
    )

    return {"message": "Wallet linked successfully"}


# ============================================================
# SOLANA WALLET AUTHENTICATION
# ============================================================

@router.post("/solana/challenge", response_model=WalletChallengeResponse)
async def solana_challenge(request: WalletChallengeRequest):
    """
    Generate challenge message for Solana wallet signature.

    WHY: Implement secure challenge-response authentication
    HOW: Generate nonce, store in Redis, return message to sign

    Flow:
    1. Validate Solana address format (base58, 32 bytes)
    2. Generate cryptographically secure nonce
    3. Store nonce in Redis (5 min expiration)
    4. Create message to sign
    5. Return message for user to sign in wallet

    Args:
        request: WalletChallengeRequest with address

    Returns:
        WalletChallengeResponse with message to sign and nonce

    Raises:
        HTTPException(400): Invalid address format

    Security:
    - Nonce expires in 5 minutes
    - Single-use nonce (deleted after verification)
    - Clear message format (no standard like EIP-4361 yet)
    """
    challenge = await solana.request_challenge(address=request.address)
    return WalletChallengeResponse(**challenge)


@router.post("/solana/verify", response_model=Token)
async def solana_verify(
    request: WalletVerifyRequest,
    db: Session = Depends(get_db)
):
    """
    Verify Solana wallet signature and authenticate user.

    WHY: Cryptographically prove wallet ownership using Ed25519
    HOW: Verify signature against public key from address, create org if new user

    Flow:
    1. Retrieve nonce from Redis (single-use)
    2. Verify nonce in signed message
    3. Decode signature and address from base58
    4. Verify Ed25519 signature
    5. Find or create user
    6. If new user, create default org + workspace
    7. Get user's organizations and workspaces
    8. Generate JWT token with org_id + ws_id

    Args:
        request: WalletVerifyRequest with address, message, signature
        db: Database session (injected)

    Returns:
        Token with access_token and expiration

    Raises:
        HTTPException(400): Nonce expired or invalid
        HTTPException(401): Signature verification failed

    Security:
    - Nonce is single-use (prevents replay attacks)
    - Ed25519 signature verification proves private key ownership
    - Solana address IS the public key
    """
    # Step 1: Verify signature and get or create user
    user = await solana.verify_signature(
        address=request.address,
        signed_message=request.signed_message,
        signature=request.signature,
        db=db,
        username=request.username
    )

    # Step 2: Check if user has organization, create if not
    user_orgs = list_user_organizations(db=db, user_id=user.id)

    if not user_orgs:
        # New user - create default organization + workspace
        org = create_organization(
            db=db,
            name=f"{user.username}'s Organization",
            billing_email=f"{user.username}@wallet.user",  # Placeholder email
            creator_id=user.id,
            is_default=True  # Mark as personal organization for profile visibility
        )
        user_orgs = [(org, "owner")]

    # Step 3: Use first organization
    org, role = user_orgs[0]

    # Step 4: Get first workspace in that org (prefer default)
    workspace = db.query(Workspace).filter(
        Workspace.organization_id == org.id
    ).order_by(
        Workspace.is_default.desc(),  # Default workspace first
        Workspace.created_at.asc()     # Otherwise oldest
    ).first()

    # Step 5: Generate JWT with context
    access_token = create_access_token(data={
        "sub": str(user.id),
        "org_id": str(org.id),
        "ws_id": str(workspace.id) if workspace else None
    })

    return Token(
        access_token=access_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60  # Convert minutes to seconds
    )


@router.post("/solana/link", response_model=Dict[str, str])
async def solana_link(
    request: LinkWalletRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Link Solana wallet to existing user account (requires authentication).

    WHY: Allow users to add Solana wallet auth to existing accounts
    HOW: Verify signature, create new AuthIdentity for existing user

    Flow:
    1. Extract user from JWT token
    2. Verify wallet signature (same as /verify)
    3. Check wallet not already linked to another account
    4. Create AuthIdentity linking wallet to user
    5. Return success message

    Args:
        request: LinkWalletRequest with address, message, signature
        current_user: Authenticated user (from JWT token)
        db: Database session (injected)

    Returns:
        Success message

    Raises:
        HTTPException(400): Wallet already linked to another account
        HTTPException(401): Signature verification failed

    Use Case:
    - User signed up with email, now wants to add Phantom wallet
    - User has multiple wallets, wants to link all to same account
    """
    # Call Solana strategy
    await solana.link_solana_to_user(
        user_id=str(current_user.id),
        address=request.address,
        signed_message=request.signed_message,
        signature=request.signature,
        db=db
    )

    return {"message": "Wallet linked successfully"}


# ============================================================
# COSMOS WALLET AUTHENTICATION
# ============================================================

@router.post("/cosmos/challenge", response_model=WalletChallengeResponse)
async def cosmos_challenge(request: WalletChallengeRequest):
    """
    Generate challenge message for Cosmos wallet signature.

    WHY: Implement secure challenge-response authentication
    HOW: Generate nonce, store in Redis, return message to sign

    Flow:
    1. Validate Cosmos address format (bech32 encoding)
    2. Generate cryptographically secure nonce
    3. Store nonce in Redis (5 min expiration)
    4. Create message to sign
    5. Return message for user to sign in wallet

    Args:
        request: WalletChallengeRequest with address

    Returns:
        WalletChallengeResponse with message to sign and nonce

    Raises:
        HTTPException(400): Invalid address format

    Security:
    - Nonce expires in 5 minutes
    - Single-use nonce (deleted after verification)
    - Supports cosmos and secret networks
    """
    challenge = await cosmos.request_challenge(address=request.address)
    return WalletChallengeResponse(**challenge)


@router.post("/cosmos/verify", response_model=Token)
async def cosmos_verify(
    request: CosmosWalletVerifyRequest,
    db: Session = Depends(get_db)
):
    """
    Verify Cosmos wallet signature and authenticate user.

    WHY: Cryptographically prove wallet ownership using secp256k1
    HOW: Verify pubkey matches address, then verify signature, create org if new user

    Flow:
    1. Retrieve nonce from Redis (single-use)
    2. Verify nonce in signed message
    3. Decode signature and public key from base64
    4. Derive address from public key (verify it matches)
    5. Verify secp256k1 signature
    6. Find or create user
    7. If new user, create default org + workspace
    8. Get user's organizations and workspaces
    9. Generate JWT token with org_id + ws_id

    Args:
        request: CosmosWalletVerifyRequest with address, message, signature, public_key
        db: Database session (injected)

    Returns:
        Token with access_token and expiration

    Raises:
        HTTPException(400): Nonce expired or invalid
        HTTPException(400): Public key doesn't match address
        HTTPException(401): Signature verification failed

    Security:
    - Nonce is single-use (prevents replay attacks)
    - Public key must derive to claimed address
    - secp256k1 signature verification proves ownership

    Note: Unlike EVM (which recovers pubkey from signature), Cosmos
    wallets provide the public key separately and we must verify it matches.
    """
    # Step 1: Verify signature and get or create user
    user = await cosmos.verify_signature(
        address=request.address,
        signed_message=request.signed_message,
        signature=request.signature,
        public_key=request.public_key,
        db=db,
        username=request.username
    )

    # Step 2: Check if user has organization, create if not
    user_orgs = list_user_organizations(db=db, user_id=user.id)

    if not user_orgs:
        # New user - create default organization + workspace
        org = create_organization(
            db=db,
            name=f"{user.username}'s Organization",
            billing_email=f"{user.username}@wallet.user",  # Placeholder email
            creator_id=user.id,
            is_default=True  # Mark as personal organization for profile visibility
        )
        user_orgs = [(org, "owner")]

    # Step 3: Use first organization
    org, role = user_orgs[0]

    # Step 4: Get first workspace in that org (prefer default)
    workspace = db.query(Workspace).filter(
        Workspace.organization_id == org.id
    ).order_by(
        Workspace.is_default.desc(),  # Default workspace first
        Workspace.created_at.asc()     # Otherwise oldest
    ).first()

    # Step 5: Generate JWT with context
    access_token = create_access_token(data={
        "sub": str(user.id),
        "org_id": str(org.id),
        "ws_id": str(workspace.id) if workspace else None
    })

    return Token(
        access_token=access_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60  # Convert minutes to seconds
    )


@router.post("/cosmos/link", response_model=Dict[str, str])
async def cosmos_link(
    request: CosmosLinkWalletRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Link Cosmos wallet to existing user account (requires authentication).

    WHY: Allow users to add Cosmos wallet auth to existing accounts
    HOW: Verify signature and pubkey, create new AuthIdentity for existing user

    Flow:
    1. Extract user from JWT token
    2. Verify wallet signature (same as /verify)
    3. Check wallet not already linked to another account
    4. Create AuthIdentity linking wallet to user
    5. Return success message

    Args:
        request: CosmosLinkWalletRequest with address, message, signature, public_key
        current_user: Authenticated user (from JWT token)
        db: Database session (injected)

    Returns:
        Success message

    Raises:
        HTTPException(400): Wallet already linked to another account
        HTTPException(400): Public key doesn't match address
        HTTPException(401): Signature verification failed

    Use Case:
    - User signed up with email, now wants to add Keplr wallet
    - User has wallets on multiple Cosmos chains, wants to link all
    """
    # Call Cosmos strategy
    await cosmos.link_cosmos_to_user(
        user_id=str(current_user.id),
        address=request.address,
        signed_message=request.signed_message,
        signature=request.signature,
        public_key=request.public_key,
        db=db
    )

    return {"message": "Wallet linked successfully"}


# ============================================================
# EMAIL LINKING
# ============================================================

@router.post("/email/link", response_model=Dict[str, str])
async def email_link(
    request: LinkEmailRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Link email/password authentication to existing user account (requires authentication).

    WHY: Allow wallet-only users to add email/password login option
    HOW: Create new AuthIdentity with email provider for existing user

    Flow:
    1. Validate current user is authenticated
    2. Check email is not already linked to any account
    3. Validate password strength
    4. Hash password and create AuthIdentity
    5. Return success message

    Args:
        request: LinkEmailRequest with email and password
        current_user: Currently authenticated user (injected from JWT)
        db: Database session (injected)

    Returns:
        Success message

    Raises:
        HTTPException(400): Email already linked to another account
        HTTPException(400): Email already linked to current account
        HTTPException(400): Weak password

    Example:
        POST /auth/email/link
        Headers: {"Authorization": "Bearer your_jwt_token"}
        Body: {
            "email": "alice@example.com",
            "password": "SecurePass123!"
        }

    Security:
    - Requires valid JWT token (existing account)
    - Password strength validation
    - Email uniqueness enforcement
    - Secure password hashing with bcrypt
    """
    # Call email strategy for linking
    await email.link_email_to_user(
        user_id=current_user.id,
        email=request.email,
        password=request.password,
        db=db
    )

    return {"message": "Email linked successfully"}


@router.post("/email/send-link-verification", response_model=EmailVerificationResponseSchema)
async def send_email_link_verification(
    request: EmailLinkVerificationRequestSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send email verification code for linking email to existing account.

    WHY: Verify email ownership before allowing email linking to account
    HOW: Generate verification code, store in Redis, send email

    Flow:
    1. Validate email isn't already linked to any account
    2. Validate password strength
    3. Generate verification code
    4. Store link data in Redis (5min expiry)
    5. Send verification email

    Args:
        request: EmailLinkVerificationRequestSchema with email, password
        current_user: Currently authenticated user (injected from JWT)
        db: Database session (injected)

    Returns:
        EmailVerificationResponseSchema with status

    Raises:
        HTTPException(400): Email already linked to account
        HTTPException(400): Weak password
        HTTPException(400): Email already linked to current user

    Security:
    - Requires valid JWT token (authenticated user)
    - Email uniqueness validation
    - Password strength validation
    - Verification codes expire in 5 minutes
    """
    # Check if email is already linked to any account
    from app.models.auth_identity import AuthIdentity

    existing_auth = db.query(AuthIdentity).filter(
        AuthIdentity.provider == "email",
        AuthIdentity.provider_id == request.email
    ).first()

    if existing_auth:
        if existing_auth.user_id == current_user.id:
            raise HTTPException(
                status_code=400,
                detail="This email is already linked to your account"
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="This email is already linked to another account"
            )

    # Generate and send verification code for linking
    result = await email.send_email_link_verification_code(
        email=request.email,
        password=request.password,
        user_id=current_user.id,
        db=db
    )

    return EmailVerificationResponseSchema(**result)


@router.post("/email/verify-and-link", response_model=Dict[str, str])
async def verify_email_and_link(
    request: VerifyEmailCodeRequestSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Verify email code and link email to existing user account.

    WHY: Complete email linking after email verification
    HOW: Verify code, create AuthIdentity for email/password

    Flow:
    1. Verify the email verification code
    2. Retrieve stored linking data from Redis
    3. Create AuthIdentity with hashed password
    4. Clean up Redis verification data
    5. Return success message

    Args:
        request: VerifyEmailCodeRequestSchema with email and verification code
        current_user: Currently authenticated user (injected from JWT)
        db: Database session (injected)

    Returns:
        Success message

    Raises:
        HTTPException(400): Invalid or expired verification code
        HTTPException(400): Email already linked

    Security:
    - Requires valid JWT token (authenticated user)
    - Verification code validation
    - Secure password hashing

    Example:
        POST /auth/email/verify-and-link
        Headers: {"Authorization": "Bearer your_jwt_token"}
        Body: {"email": "alice@example.com", "code": "123456"}
    """
    # Verify code and link email to user
    await email.verify_email_code_and_link(
        email=request.email,
        code=request.code,
        user_id=current_user.id,
        db=db
    )

    return {"message": "Email linked successfully"}


# ============================================================
# AUTHENTICATION METHOD UNLINKING
# ============================================================

@router.delete("/auth-method/{provider}/{provider_id}", response_model=Dict[str, str])
async def unlink_auth_method(
    provider: str,
    provider_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Unlink an authentication method from user account.

    WHY: Allow users to remove authentication methods they no longer want to use
    HOW: Delete AuthIdentity record after validating user has other auth methods

    Flow:
    1. Validate user has more than one auth method
    2. Find the specific auth identity to remove
    3. Delete the auth identity record
    4. Return success message

    Args:
        provider: Auth provider type (email, evm, solana, cosmos)
        provider_id: Provider-specific identifier (email or wallet address)
        current_user: Currently authenticated user (injected from JWT)
        db: Database session (injected)

    Returns:
        Success message

    Raises:
        HTTPException(400): Cannot remove last auth method
        HTTPException(404): Auth method not found
        HTTPException(403): Auth method belongs to different user

    Security:
    - Requires valid JWT token (authenticated user)
    - Prevents removal of last auth method
    - Validates ownership of auth method

    Example:
        DELETE /auth/auth-method/email/alice@example.com
        DELETE /auth/auth-method/evm/0x742d35Cc...
        Headers: {"Authorization": "Bearer your_jwt_token"}
    """
    from app.models.auth_identity import AuthIdentity

    # Step 1: Check user has multiple auth methods
    user_auth_count = db.query(AuthIdentity).filter(
        AuthIdentity.user_id == current_user.id
    ).count()

    if user_auth_count <= 1:
        raise HTTPException(
            status_code=400,
            detail="Cannot remove last authentication method. Please add another authentication method first."
        )

    # Step 2: Find the specific auth identity
    auth_identity = db.query(AuthIdentity).filter(
        AuthIdentity.user_id == current_user.id,
        AuthIdentity.provider == provider,
        AuthIdentity.provider_id == provider_id
    ).first()

    if not auth_identity:
        raise HTTPException(
            status_code=404,
            detail=f"Authentication method not found: {provider} {provider_id}"
        )

    # Step 3: Delete the auth identity
    db.delete(auth_identity)
    db.commit()

    # Step 4: Log the action
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"User {current_user.id} unlinked {provider} auth method: {provider_id}")

    return {"message": f"{provider.capitalize()} authentication method removed successfully"}




# ============================================================
# PROFILE MANAGEMENT
# ============================================================

@router.put("/me", response_model=UserProfile)
async def update_profile(
    profile_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update current user's profile information.

    WHY: Allow users to update their profile details
    HOW: Validate input, check uniqueness, update user record

    Flow:
    1. Validate input data (username uniqueness if provided)
    2. Update user record with provided fields
    3. Return updated UserProfile

    Args:
        profile_update: UserUpdate schema with optional fields to update
        current_user: Authenticated user (from JWT token)
        db: Database session

    Returns:
        UserProfile with updated user data and auth methods

    Raises:
        HTTPException(400): Username already taken
        HTTPException(400): Invalid input data
        HTTPException(401): Invalid or missing JWT token

    Security:
    - Only authenticated users can update their own profile
    - Username uniqueness enforced at database level
    - No sensitive data exposed in response

    Example Request:
        PUT /auth/me
        {
            "username": "new_username"
        }

    Example Response:
        {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "username": "new_username",
            "is_active": true,
            "created_at": "2024-01-15T10:30:00Z",
            "updated_at": "2024-01-15T14:45:00Z",
            "auth_methods": [...]
        }
    """
    from app.models.auth_identity import AuthIdentity
    from sqlalchemy.exc import IntegrityError

    # Check if username is being updated and if it's unique
    if profile_update.username:
        existing_user = db.query(User).filter(
            User.username == profile_update.username,
            User.id != current_user.id
        ).first()

        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Username already taken"
            )

    # Update user fields
    if profile_update.username:
        current_user.username = profile_update.username

    # Update timestamp
    from datetime import datetime
    current_user.updated_at = datetime.utcnow()

    try:
        db.commit()
        db.refresh(current_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Username already taken"
        )

    # Get user's auth identities for response
    auth_identities = db.query(AuthIdentity).filter(
        AuthIdentity.user_id == current_user.id
    ).all()

    # Convert to AuthMethodInfo schemas
    auth_methods = [
        AuthMethodInfo(
            provider=auth.provider,
            provider_id=auth.provider_id,
            linked_at=auth.created_at
        )
        for auth in auth_identities
    ]

    # Return updated UserProfile
    return UserProfile(
        id=current_user.id,
        username=current_user.username,
        avatar_url=current_user.avatar_url,
        is_active=current_user.is_active,
        is_staff=current_user.is_staff,
        has_beta_access=current_user.has_beta_access,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
        auth_methods=auth_methods
    )


@router.delete("/me", response_model=dict)
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete current user's account permanently.

    WHY: Allow users to delete their account and all associated data
    HOW: Hard delete user record, cascade deletes handle all related data

    Flow:
    1. Verify user is authenticated
    2. Delete user record from database (hard delete)
    3. Database cascade deletes will automatically handle:
       - AuthIdentity records (all login methods deleted)
       - OrganizationMember records (removed from all orgs)
       - WorkspaceMember records (removed from all workspaces)
       - Created resources may be reassigned or marked as orphaned
    4. Return success message

    Args:
        current_user: Authenticated user (from JWT token)
        db: Database session

    Returns:
        Success message confirming account deletion

    Raises:
        HTTPException(401): Invalid or missing JWT token
        HTTPException(500): Database error during deletion

    Security:
    - Only authenticated users can delete their own account
    - Hard delete allows user to sign up again with same credentials
    - JWT token becomes invalid immediately
    - Database cascade deletes handle all foreign key relationships

    WARNING: This action is irreversible. User will lose access to:
    - All organizations they created or belong to
    - All workspaces they created or have access to
    - All chatbots, chatflows, and knowledge bases they created
    - All authentication methods linked to their account
    - User can sign up again fresh as a new user

    Example Response:
        {
            "message": "Account deleted successfully",
            "deleted_at": "2024-01-15T14:45:00Z"
        }
    """
    from datetime import datetime

    try:
        # Record deletion time before deleting user
        deletion_time = datetime.utcnow()

        # Explicitly delete memberships first to avoid foreign key issues
        # Delete organization memberships
        from app.models.organization_member import OrganizationMember
        from app.models.workspace_member import WorkspaceMember

        db.query(OrganizationMember).filter(
            OrganizationMember.user_id == current_user.id
        ).delete(synchronize_session=False)

        # Delete workspace memberships
        db.query(WorkspaceMember).filter(
            WorkspaceMember.user_id == current_user.id
        ).delete(synchronize_session=False)

        # Now delete the user record - cascade will handle auth_identities and other relations
        db.delete(current_user)
        db.commit()

        return {
            "message": "Account deleted successfully",
            "deleted_at": deletion_time.isoformat() + "Z"
        }

    except Exception as e:
        db.rollback()
        print(f"Account deletion error: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete account: {str(e)}"
        )
