"""
Solana wallet authentication strategy.

See implementation guide in /backend/docs/auth/ for full documentation.
"""

# ACTUAL IMPLEMENTATION
from sqlalchemy.orm import Session
from fastapi import HTTPException
from nacl.signing import VerifyKey
from nacl.exceptions import BadSignatureError
from datetime import datetime
from typing import Dict
import base58

from app.utils.redis import store_nonce, get_nonce, generate_nonce
from app.models.user import User
from app.models.auth_identity import AuthIdentity


def validate_solana_address(address: str) -> str:
    """
    Validate a Solana address format.

    WHY: Ensure address is valid before processing
    HOW: Decode base58 and check it's 32 bytes (standard Solana pubkey size)

    Args:
        address: Solana address (base58 encoded)

    Returns:
        The validated address (unchanged)

    Raises:
        HTTPException(400): If address format is invalid

    Example:
        >>> validate_solana_address("5xF...")
        '5xF...'
    """
    if not address or not isinstance(address, str):
        raise HTTPException(
            status_code=400,
            detail="Address is required and must be a string"
        )

    try:
        # Decode base58 to bytes
        pubkey_bytes = base58.b58decode(address)

        # Solana public keys are exactly 32 bytes
        if len(pubkey_bytes) != 32:
            raise ValueError(f"Invalid length: {len(pubkey_bytes)} bytes (expected 32)")

        return address

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid Solana address: {str(e)}"
        )


async def request_challenge(address: str) -> Dict[str, str]:
    """
    Generate a challenge message for Solana wallet authentication.

    WHY: Implement challenge-response pattern for secure wallet auth
    HOW: Generate nonce, store in Redis, create message to sign

    Args:
        address: Solana address requesting challenge

    Returns:
        Dictionary with "message" (to sign) and "nonce"

    Raises:
        HTTPException(400): If address format is invalid

    Security Notes:
        - Nonce expires in 5 minutes (NONCE_EXPIRE_SECONDS)
        - Single-use nonce prevents replay attacks
        - Clear message format (no standard like EIP-4361 yet)

    Example:
        >>> challenge = await request_challenge("5xF...")
        >>> challenge.keys()
        dict_keys(['message', 'nonce'])
        >>> "PrivexBot" in challenge["message"]
        True
    """
    # Step 1: Validate address format
    address = validate_solana_address(address)

    # Step 2: Generate cryptographically secure nonce
    nonce = generate_nonce()
    # WHY: Unique challenge prevents replay attacks

    # Step 3: Store nonce in Redis with expiration
    store_nonce(address, nonce, "solana")
    # WHY Redis: Fast lookup and automatic expiration (5 min)

    # Step 4: Create message to sign
    # WHY simple format: Solana ecosystem doesn't have standard like EIP-4361 yet
    issued_at = datetime.utcnow().isoformat() + "Z"

    message = f"""Sign this message to authenticate with PrivexBot.

Wallet: {address}
Nonce: {nonce}
Timestamp: {issued_at}

This request will not trigger any blockchain transaction or cost any gas fees.
"""
    # WHY "no gas fees": Reassure users signing is free (common concern)
    # WHY include wallet: User sees what address they're authenticating
    # WHY include nonce: Unique per request, prevents replay

    return {
        "message": message,
        "nonce": nonce
    }


async def verify_signature(
    address: str,
    signed_message: str,
    signature: str,
    db: Session,
    username: str = None
) -> User:
    """
    Verify Solana wallet signature and authenticate/create user.

    WHY: Cryptographically prove wallet ownership using Ed25519
    HOW: Verify signature against public key from address

    Args:
        address: Solana address that allegedly signed
        signed_message: The exact message that was signed
        signature: Base58-encoded signature from wallet
        db: Database session
        username: Optional custom username for new users

    Returns:
        User object (existing or newly created)

    Raises:
        HTTPException(400): If nonce expired/invalid or message mismatch
        HTTPException(401): If signature verification fails
        HTTPException(401): If account is inactive

    Security Notes:
        - Nonce is single-use (deleted after retrieval)
        - Ed25519 signature verification proves private key ownership
        - No password needed - cryptographic proof

    Example:
        >>> user = await verify_signature(
        ...     "5xF...",
        ...     "Sign this message to authenticate...",
        ...     "2We...",
        ...     db
        ... )
        >>> user.username
        'user_5xf...'
    """
    # Step 1: Validate address format
    address = validate_solana_address(address)

    # Step 2: Retrieve nonce from Redis (single-use)
    # WHY getdel: Atomic get-and-delete prevents reuse
    nonce = get_nonce(address, "solana")

    if not nonce:
        raise HTTPException(
            status_code=400,
            detail="Nonce expired or invalid. Please request a new challenge."
        )
    # WHY: Nonce may have expired (5 min) or already been used

    # Step 3: Verify nonce is in the signed message
    if nonce not in signed_message:
        raise HTTPException(
            status_code=400,
            detail="Message does not contain the expected nonce"
        )
    # WHY: Ensure they signed OUR challenge, not some other message

    # Step 4: Decode signature and public key from base58
    try:
        signature_bytes = base58.b58decode(signature)
        # WHY base58: Standard encoding in Solana ecosystem

        pubkey_bytes = base58.b58decode(address)
        # WHY: Solana address IS the public key (base58-encoded)

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid signature or address encoding: {str(e)}"
        )

    # Step 5: Verify signature using Ed25519
    try:
        # Create verification key from public key bytes
        verify_key = VerifyKey(pubkey_bytes)

        # Convert message to bytes
        message_bytes = signed_message.encode('utf-8')

        # Verify signature
        # WHY: Ed25519 signature verification - cryptographically proves ownership
        # THROWS: BadSignatureError if signature doesn't match
        verify_key.verify(message_bytes, signature_bytes)

    except BadSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Signature verification failed: invalid signature"
        )
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Signature verification failed: {str(e)}"
        )

    # Step 6: Find existing auth identity or create new user
    auth_identity = db.query(AuthIdentity).filter(
        AuthIdentity.provider == "solana",
        AuthIdentity.provider_id == address
    ).first()

    if auth_identity:
        # Existing user - authenticate them
        user = db.query(User).filter(
            User.id == auth_identity.user_id
        ).first()

        if not user or not user.is_active:
            raise HTTPException(
                status_code=401,
                detail="Account is inactive"
            )

        return user

    else:
        # New user - create account
        # Generate default username if not provided
        if not username:
            username = f"user_{address[:8].lower()}"
            # WHY: Need some username, user can change later

        # Check if username already taken
        existing_user = db.query(User).filter(
            User.username == username
        ).first()

        if existing_user:
            # If default username taken, add random suffix
            import secrets
            username = f"{username}_{secrets.token_hex(4)}"

        # Create user
        user = User(
            username=username,
            is_active=True
        )
        db.add(user)
        db.flush()  # Get user.id without committing

        # Create auth identity linking wallet to user
        auth_identity = AuthIdentity(
            user_id=user.id,
            provider="solana",
            provider_id=address,
            data={
                "address": address,
                "first_login": datetime.utcnow().isoformat()
            }
        )
        db.add(auth_identity)
        db.commit()
        db.refresh(user)

        return user


async def link_solana_to_user(
    user_id: str,
    address: str,
    signed_message: str,
    signature: str,
    db: Session
) -> AuthIdentity:
    """
    Link a Solana wallet to an existing user account.

    WHY: Allow users to add Solana wallet auth to email-only accounts
    HOW: Verify signature, create new AuthIdentity for existing user

    Args:
        user_id: UUID of existing user
        address: Solana address to link
        signed_message: Signed challenge message
        signature: Base58-encoded signature from wallet
        db: Database session

    Returns:
        Created AuthIdentity object

    Raises:
        HTTPException(400): If wallet already linked to another account
        HTTPException(404): If user not found
        HTTPException(401): If signature verification fails

    Example:
        >>> # User signed up with email, now wants to add Phantom
        >>> auth_id = await link_solana_to_user(
        ...     user.id,
        ...     "5xF...",
        ...     "Sign this message...",
        ...     "2We...",
        ...     db
        ... )
    """
    # Step 1: Validate address and verify signature
    address = validate_solana_address(address)

    # Step 2: Verify signature (without creating new user)
    nonce = get_nonce(address, "solana")
    if not nonce:
        raise HTTPException(
            status_code=400,
            detail="Nonce expired or invalid. Please request a new challenge."
        )

    if nonce not in signed_message:
        raise HTTPException(
            status_code=400,
            detail="Message does not contain the expected nonce"
        )

    try:
        signature_bytes = base58.b58decode(signature)
        pubkey_bytes = base58.b58decode(address)
        verify_key = VerifyKey(pubkey_bytes)
        message_bytes = signed_message.encode('utf-8')
        verify_key.verify(message_bytes, signature_bytes)
    except BadSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Signature verification failed"
        )
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Signature verification failed: {str(e)}"
        )

    # Step 3: Check if user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Step 4: Check if wallet already linked (to anyone)
    existing_wallet = db.query(AuthIdentity).filter(
        AuthIdentity.provider == "solana",
        AuthIdentity.provider_id == address
    ).first()

    if existing_wallet:
        if existing_wallet.user_id == user.id:
            raise HTTPException(
                status_code=400,
                detail="This Solana wallet is already linked to your account"
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="This Solana wallet is already linked to another account. Please use a different wallet or log in with the wallet."
            )

    # Step 5: Create auth identity linking wallet to user
    auth_identity = AuthIdentity(
        user_id=user_id,
        provider="solana",
        provider_id=address,
        data={
            "address": address,
            "linked_at": datetime.utcnow().isoformat()
        }
    )

    db.add(auth_identity)
    db.commit()
    db.refresh(auth_identity)

    return auth_identity
