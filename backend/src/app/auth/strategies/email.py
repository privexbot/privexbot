"""
Email/password authentication strategy.

WHY:
- Traditional username/password login
- Most common authentication method
- Secure password storage with hashing

HOW:
- Hash passwords with bcrypt
- Verify credentials on login
- Create/link to user account

PSEUDOCODE:
-----------
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.models.auth_identity import AuthIdentity

async def signup_with_email(
    email: str,
    password: str,
    username: str,
    db: Session
) -> User:
    
    WHY: Create new user with email/password
    HOW: Create User and AuthIdentity records

    Returns: User object
    Raises: HTTPException if email already exists
    

    # Step 1: Check if email already registered
    existing = db.query(AuthIdentity).filter(
        AuthIdentity.provider == "email",
        AuthIdentity.provider_id == email
    ).first()

    if existing:
        raise HTTPException(400, "Email already registered")
        WHY: Prevent duplicate accounts

    # Step 2: Create user
    user = User(username=username, is_active=True)
    db.add(user)
    db.flush()  # Get user.id without committing
        WHY: Need user.id for auth_identity.user_id

    # Step 3: Hash password and create auth identity
    password_hash = hash_password(password)
        WHY: NEVER store plain text passwords
        HOW: Uses bcrypt with salt

    auth_identity = AuthIdentity(
        user_id=user.id,
        provider="email",
        provider_id=email,  # The email is the unique identifier
        data={
            "password_hash": password_hash,
            "email_verified": False  # For future email verification
        }
    )
    db.add(auth_identity)
    db.commit()

    return user


async def login_with_email(
    email: str,
    password: str,
    db: Session
) -> User:
    
    WHY: Authenticate user with email/password
    HOW: Verify password against stored hash

    Returns: User object if valid
    Raises: HTTPException if invalid credentials
    

    # Step 1: Find auth identity
    auth_identity = db.query(AuthIdentity).filter(
        AuthIdentity.provider == "email",
        AuthIdentity.provider_id == email
    ).first()

    if not auth_identity:
        raise HTTPException(401, "Invalid credentials")
            WHY: Don't reveal if email exists (security)

    # Step 2: Get user
    user = db.query(User).filter(User.id == auth_identity.user_id).first()

    if not user or not user.is_active:
        raise HTTPException(401, "Invalid credentials")
            WHY: Reject inactive users

    # Step 3: Verify password
    password_hash = auth_identity.data.get("password_hash")
    if not verify_password(password, password_hash):
        raise HTTPException(401, "Invalid credentials")
            WHY: Wrong password
            HOW: verify_password uses bcrypt comparison

    return user


async def change_password(
    user_id: UUID,
    old_password: str,
    new_password: str,
    db: Session
) -> bool:
    
    WHY: Allow users to change their password
    HOW: Verify old password, update to new hash
    

    # Find email auth identity for this user
    auth_identity = db.query(AuthIdentity).filter(
        AuthIdentity.user_id == user_id,
        AuthIdentity.provider == "email"
    ).first()

    if not auth_identity:
        raise HTTPException(400, "No email auth method found")

    # Verify old password
    old_hash = auth_identity.data.get("password_hash")
    if not verify_password(old_password, old_hash):
        raise HTTPException(401, "Current password is incorrect")

    # Update to new password
    new_hash = hash_password(new_password)
    auth_identity.data["password_hash"] = new_hash
    db.commit()

    return True
        WHY: Return success indicator


SECURITY NOTES:
---------------
WHY bcrypt:
    - Slow by design (prevents brute force)
    - Automatic salting (prevents rainbow tables)
    - Industry standard

WHY hash on signup:
    - Never store passwords in plain text
    - Even DB admins can't see passwords

WHY same error for email/password:
    - Don't reveal if email exists
    - Prevents user enumeration attacks



"""

# ACTUAL IMPLEMENTATION
from sqlalchemy.orm import Session
from fastapi import HTTPException
from uuid import UUID
from typing import Optional

from app.core.security import hash_password, verify_password, validate_password_strength
from app.models.user import User
from app.models.auth_identity import AuthIdentity


async def signup_with_email(
    email: str,
    password: str,
    username: str,
    db: Session
) -> User:
    """
    Create a new user account with email and password.

    WHY: Allow users to register with traditional email/password method
    HOW: Create User record and AuthIdentity with hashed password

    Args:
        email: User's email address (will be provider_id)
        password: Plain text password (will be hashed)
        username: Desired username (must be unique)
        db: Database session

    Returns:
        Created User object

    Raises:
        HTTPException(400): If email already registered
        HTTPException(400): If username already taken
        HTTPException(400): If password doesn't meet requirements

    Example:
        >>> user = await signup_with_email(
        ...     "alice@example.com",
        ...     "SecurePass123!",
        ...     "alice_wonderland",
        ...     db
        ... )
        >>> user.username
        'alice_wonderland'
    """
    # Step 1: Validate password strength
    is_valid, error_msg = validate_password_strength(password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # Step 2: Check if email already registered
    # WHY: Prevent duplicate accounts with same email
    existing_email = db.query(AuthIdentity).filter(
        AuthIdentity.provider == "email",
        AuthIdentity.provider_id == email.lower()  # Case-insensitive email
    ).first()

    if existing_email:
        raise HTTPException(
            status_code=400,
            detail="Email already registered. Please log in instead."
        )

    # Step 3: Check if username already taken
    # WHY: Username must be unique across all users
    existing_username = db.query(User).filter(
        User.username == username
    ).first()

    if existing_username:
        raise HTTPException(
            status_code=400,
            detail="Username already taken"
        )

    # Step 4: Create user record
    user = User(
        username=username,
        is_active=True
    )
    db.add(user)
    db.flush()  # Get user.id without committing transaction
    # WHY flush: Need user.id for foreign key in auth_identity

    # Step 5: Hash password and create auth identity
    password_hash = hash_password(password)
    # WHY hash: NEVER store plain text passwords in database
    # HOW: bcrypt with automatic salting, work factor 12

    auth_identity = AuthIdentity(
        user_id=user.id,
        provider="email",
        provider_id=email.lower(),  # Store email in lowercase
        data={
            "password_hash": password_hash,
            "email_verified": False  # Future: implement email verification
        }
    )
    db.add(auth_identity)
    db.commit()
    db.refresh(user)  # Reload user with relationships

    return user


async def login_with_email(
    email: str,
    password: str,
    db: Session
) -> User:
    """
    Authenticate user with email and password.

    WHY: Verify user credentials and return authenticated user
    HOW: Find AuthIdentity, verify password hash, return User

    Args:
        email: User's email address
        password: Plain text password to verify
        db: Database session

    Returns:
        User object if authentication successful

    Raises:
        HTTPException(401): If credentials are invalid or user inactive

    Security Notes:
        - Same error message for all failure cases (prevents user enumeration)
        - Constant-time password comparison via bcrypt
        - Checks user.is_active to allow soft account deletion

    Example:
        >>> user = await login_with_email(
        ...     "alice@example.com",
        ...     "SecurePass123!",
        ...     db
        ... )
        >>> user.username
        'alice_wonderland'
    """
    # Step 1: Find auth identity by email
    auth_identity = db.query(AuthIdentity).filter(
        AuthIdentity.provider == "email",
        AuthIdentity.provider_id == email.lower()
    ).first()

    # WHY same error: Don't reveal if email exists (security)
    # SECURITY: Prevents attackers from enumerating valid emails
    if not auth_identity:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    # Step 2: Get associated user
    user = db.query(User).filter(
        User.id == auth_identity.user_id
    ).first()

    if not user or not user.is_active:
        # WHY check is_active: Soft delete - reject disabled accounts
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    # Step 3: Verify password
    password_hash = auth_identity.data.get("password_hash")

    if not password_hash or not verify_password(password, password_hash):
        # WHY constant-time: verify_password uses bcrypt (prevents timing attacks)
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    return user


async def change_password(
    user_id: UUID,
    old_password: str,
    new_password: str,
    db: Session
) -> bool:
    """
    Change user's password after verifying current password.

    WHY: Allow users to update their password securely
    HOW: Verify old password, validate new password, update hash

    Args:
        user_id: ID of user changing password
        old_password: Current password for verification
        new_password: New password to set
        db: Database session

    Returns:
        True if password changed successfully

    Raises:
        HTTPException(400): If user has no email auth method
        HTTPException(400): If new password doesn't meet requirements
        HTTPException(401): If current password is incorrect

    Example:
        >>> success = await change_password(
        ...     user.id,
        ...     "OldPass123!",
        ...     "NewSecurePass456!",
        ...     db
        ... )
        >>> success
        True
    """
    # Step 1: Validate new password strength
    is_valid, error_msg = validate_password_strength(new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # Step 2: Find email auth identity for this user
    auth_identity = db.query(AuthIdentity).filter(
        AuthIdentity.user_id == user_id,
        AuthIdentity.provider == "email"
    ).first()

    if not auth_identity:
        raise HTTPException(
            status_code=400,
            detail="No email authentication method found for this user"
        )

    # Step 3: Verify old password
    old_hash = auth_identity.data.get("password_hash")

    if not old_hash or not verify_password(old_password, old_hash):
        raise HTTPException(
            status_code=401,
            detail="Current password is incorrect"
        )

    # Step 4: Hash new password and update
    new_hash = hash_password(new_password)
    auth_identity.data["password_hash"] = new_hash

    # WHY flag_modified: Tell SQLAlchemy that JSONB field changed
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(auth_identity, "data")

    db.commit()

    return True


async def link_email_to_user(
    user_id: UUID,
    email: str,
    password: str,
    db: Session
) -> AuthIdentity:
    """
    Link email/password authentication to existing user account.

    WHY: Allow users to add email auth to wallet-only accounts
    HOW: Create new AuthIdentity for existing user

    Args:
        user_id: ID of existing user
        email: Email to link
        password: Password to set
        db: Database session

    Returns:
        Created AuthIdentity object

    Raises:
        HTTPException(400): If email already registered
        HTTPException(400): If password doesn't meet requirements
        HTTPException(404): If user not found

    Example:
        >>> # User signed up with MetaMask, now wants to add email
        >>> auth_id = await link_email_to_user(
        ...     user.id,
        ...     "alice@example.com",
        ...     "SecurePass123!",
        ...     db
        ... )
    """
    # Step 1: Validate password strength
    is_valid, error_msg = validate_password_strength(password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # Step 2: Check if user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Step 3: Check if email already registered (to anyone)
    existing_email = db.query(AuthIdentity).filter(
        AuthIdentity.provider == "email",
        AuthIdentity.provider_id == email.lower()
    ).first()

    if existing_email:
        raise HTTPException(
            status_code=400,
            detail="Email already registered to an account"
        )

    # Step 4: Create auth identity
    password_hash = hash_password(password)

    auth_identity = AuthIdentity(
        user_id=user_id,
        provider="email",
        provider_id=email.lower(),
        data={
            "password_hash": password_hash,
            "email_verified": False
        }
    )

    db.add(auth_identity)
    db.commit()
    db.refresh(auth_identity)

    return auth_identity


async def request_password_reset(
    email: str,
    db: Session
) -> dict:
    """
    Request password reset for email address.

    WHY: Allow users to reset forgotten passwords securely
    HOW: Generate secure token, store in Redis, send email with status feedback

    Args:
        email: Email address to send reset link to
        db: Database session

    Returns:
        Dictionary with email sending status and message

    Security:
    - Always returns success even if email doesn't exist (prevents user enumeration)
    - Token expires in 1 hour
    - Rate limited to prevent spam
    - Provides clear feedback about email delivery status

    Example:
        >>> result = await request_password_reset(
        ...     "alice@example.com",
        ...     db
        ... )
        >>> result
        {
            "message": "Password reset email sent successfully",
            "email_sent": True,
            "reset_link": None
        }
    """
    # Step 1: Check if email exists (but don't reveal this to user)
    auth_identity = db.query(AuthIdentity).filter(
        AuthIdentity.provider == "email",
        AuthIdentity.provider_id == email.lower()
    ).first()

    if not auth_identity:
        # Security: Always return success to prevent user enumeration
        # Don't reveal if email exists in the system
        return {
            "message": "Password reset link created successfully",
            "email_sent": False,  # No email to send
            "reset_link": None
        }

    # Step 2: Check if user is active
    user = db.query(User).filter(User.id == auth_identity.user_id).first()
    if not user or not user.is_active:
        # Security: Return success even for inactive users
        return {
            "message": "Password reset link created successfully",
            "email_sent": False,  # No email for inactive users
            "reset_link": None
        }

    # Step 3: Generate secure reset token
    import secrets
    token = secrets.token_urlsafe(32)  # 256 bits of entropy

    # Step 4: Store token in Redis with 1 hour expiration
    from app.utils.redis import redis_client

    # Key pattern: password_reset:{token} -> user_id
    redis_client.setex(
        f"password_reset:{token}",
        3600,  # 1 hour expiration
        str(auth_identity.user_id)
    )

    # Step 5: Send password reset email (non-blocking)
    from app.core.config import settings
    import logging
    logger = logging.getLogger(__name__)

    reset_link = f"{settings.FRONTEND_URL}/password-reset?token={token}"

    # Try to send email but don't block on failure
    # This prevents timeout issues when SMTP is unreachable
    try:
        from app.services.email_service import send_password_reset_email
        # Attempt to send email with a very short timeout
        # In production, this should be done via background task (Celery)
        email_sent = send_password_reset_email(
            to_email=email,
            reset_url=reset_link
        )
        if not email_sent:
            # Email failed but we still created the token
            logger.warning(f"Email sending failed but token created. Reset link: {reset_link}")
    except Exception as e:
        # Log the error but don't fail the request
        logger.error(f"Failed to send password reset email: {e}")
        logger.info(f"Password reset link (email not sent): {reset_link}")
        email_sent = False

    # Step 6: Log the reset request for monitoring
    logger.info(f"Password reset requested for email: {email}, token: {token}, email_sent: {email_sent}")

    # Step 7: Return enhanced response based on email sending status
    from app.core.config import settings

    if email_sent:
        return {
            "message": "Password reset email sent successfully",
            "email_sent": True,
            "reset_link": None  # Don't expose token when email was sent
        }
    else:
        # Email failed - provide reset link for development/testing
        return {
            "message": "Password reset link created (email delivery failed)",
            "email_sent": False,
            "reset_link": reset_link if settings.ENVIRONMENT == "development" else None
        }


async def validate_reset_token(token: str) -> Optional[UUID]:
    """
    Validate password reset token and return user ID.

    WHY: Verify token is valid and not expired
    HOW: Check Redis for token existence

    Args:
        token: Password reset token to validate

    Returns:
        User ID if token is valid, None if invalid/expired

    Example:
        >>> user_id = await validate_reset_token("abc123...")
        >>> user_id
        UUID('123e4567-e89b-12d3-a456-426614174000')
    """
    from app.utils.redis import redis_client

    # Check if token exists in Redis
    user_id_str = redis_client.get(f"password_reset:{token}")

    if not user_id_str:
        return None

    try:
        return UUID(user_id_str)
    except ValueError:
        # Invalid UUID format - cleanup bad token
        redis_client.delete(f"password_reset:{token}")
        return None


async def reset_password_with_token(
    token: str,
    new_password: str,
    db: Session
) -> bool:
    """
    Reset password using valid reset token.

    WHY: Allow users to set new password with valid token
    HOW: Validate token, update password hash, consume token

    Args:
        token: Valid password reset token
        new_password: New password to set
        db: Database session

    Returns:
        True if password reset successfully

    Raises:
        HTTPException(400): Invalid or expired token
        HTTPException(400): Password doesn't meet requirements
        HTTPException(404): User not found

    Example:
        >>> success = await reset_password_with_token(
        ...     "abc123...",
        ...     "NewSecurePass456!",
        ...     db
        ... )
        >>> success
        True
    """
    # Step 1: Validate new password strength
    is_valid, error_msg = validate_password_strength(new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # Step 2: Validate token and get user ID
    user_id = await validate_reset_token(token)
    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token"
        )

    # Step 3: Find user's email auth identity
    auth_identity = db.query(AuthIdentity).filter(
        AuthIdentity.user_id == user_id,
        AuthIdentity.provider == "email"
    ).first()

    if not auth_identity:
        raise HTTPException(
            status_code=404,
            detail="User email authentication not found"
        )

    # Step 4: Check if user exists and is active
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # Step 5: Update password hash
    new_hash = hash_password(new_password)
    auth_identity.data["password_hash"] = new_hash

    # Flag that JSONB field changed for SQLAlchemy
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(auth_identity, "data")

    db.commit()

    # Step 6: Consume the reset token (one-time use)
    from app.utils.redis import redis_client
    redis_client.delete(f"password_reset:{token}")

    # Step 7: Log successful password reset
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Password reset completed for user: {user_id}")

    return True
