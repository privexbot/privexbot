"""
EVM wallet authentication strategy.

See implementation guide in /backend/docs/auth/ for full documentation.
"""

# ACTUAL IMPLEMENTATION
from sqlalchemy.orm import Session
from fastapi import HTTPException
from eth_account.messages import encode_defunct
from eth_account import Account
from web3 import Web3
from datetime import datetime
from typing import Dict

from app.utils.redis import store_nonce, get_nonce, generate_nonce
from app.models.user import User
from app.models.auth_identity import AuthIdentity


def validate_evm_address(address: str) -> str:
    """
    Validate and normalize an EVM address.

    WHY: Ensure address format is valid before processing
    HOW: Check format and convert to checksummed address

    Args:
        address: Ethereum address to validate

    Returns:
        Checksummed address

    Raises:
        HTTPException(400): If address format is invalid

    Example:
        >>> validate_evm_address("0x742d35cc6634c0532925a3b844bc9e7595f0beb")
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
    """
    # Step 1: Basic format validation
    if not address or not isinstance(address, str):
        raise HTTPException(
            status_code=400,
            detail="Address is required and must be a string"
        )

    if not address.startswith("0x"):
        raise HTTPException(
            status_code=400,
            detail="Invalid Ethereum address: must start with '0x'"
        )

    if len(address) != 42:
        raise HTTPException(
            status_code=400,
            detail="Invalid Ethereum address: must be 42 characters (0x + 40 hex chars)"
        )

    # Step 2: Normalize to checksummed address
    # WHY: Ethereum addresses are case-insensitive but have checksum encoding
    # HOW: Web3.to_checksum_address validates hex and applies EIP-55 checksum
    try:
        checksummed_address = Web3.to_checksum_address(address)
        return checksummed_address
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid Ethereum address: {str(e)}"
        )


async def request_challenge(address: str) -> Dict[str, str]:
    """
    Generate a challenge message for EVM wallet authentication.

    WHY: Implement challenge-response pattern for secure wallet auth
    HOW: Generate nonce, store in Redis, create EIP-4361 compliant message

    Args:
        address: Ethereum address requesting challenge

    Returns:
        Dictionary with "message" (to sign) and "nonce"

    Raises:
        HTTPException(400): If address format is invalid

    Security Notes:
        - Nonce expires in 5 minutes (NONCE_EXPIRE_SECONDS)
        - Single-use nonce prevents replay attacks
        - EIP-4361 format prevents phishing

    Example:
        >>> challenge = await request_challenge("0x742d35Cc...")
        >>> challenge.keys()
        dict_keys(['message', 'nonce'])
        >>> "privexbot.com" in challenge["message"]
        True
    """
    # Step 1: Validate and normalize address
    address = validate_evm_address(address)

    # Step 2: Generate cryptographically secure nonce
    nonce = generate_nonce()
    # WHY: Unique challenge prevents replay attacks
    # HOW: secrets.token_hex(16) generates 32 hex chars

    # Step 3: Store nonce in Redis with expiration
    store_nonce(address.lower(), nonce, "evm")
    # WHY store lowercase: Consistent lookup (addresses are case-insensitive)
    # WHY Redis: Fast lookup and automatic expiration (5 min)

    # Step 4: Create EIP-4361 (Sign-In with Ethereum) compliant message
    # WHY EIP-4361: Standard format users recognize, prevents phishing
    issued_at = datetime.utcnow().isoformat() + "Z"

    message = f"""privexbot.com wants you to sign in with your Ethereum account:
{address}

Please sign this message to authenticate with PrivexBot.

URI: https://privexbot.com
Version: 1
Chain ID: 1
Nonce: {nonce}
Issued At: {issued_at}
"""
    # WHY include domain: User sees what site they're signing into
    # WHY include nonce: Unique per request, prevents replay
    # WHY include timestamp: Additional uniqueness and audit trail

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
    Verify EVM wallet signature and authenticate/create user.

    WHY: Cryptographically prove wallet ownership without passwords
    HOW: Recover signer from signature, verify matches claimed address

    Args:
        address: Ethereum address that allegedly signed
        signed_message: The exact message that was signed
        signature: Hex signature from wallet (0x...)
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
        - Signature recovery proves private key ownership
        - No password needed - cryptographic proof

    Example:
        >>> user = await verify_signature(
        ...     "0x742d35Cc...",
        ...     "privexbot.com wants you to...",
        ...     "0xabc123...",
        ...     db
        ... )
        >>> user.username
        'user_0x742d35'
    """
    # Step 1: Validate and normalize address
    address = validate_evm_address(address)

    # Step 2: Retrieve nonce from Redis (single-use)
    # WHY getdel: Atomic get-and-delete prevents reuse
    nonce = get_nonce(address.lower(), "evm")

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

    # Step 4: Encode message for signature verification
    # WHY: Ethereum wallets prepend "\x19Ethereum Signed Message:\n{len}"
    # HOW: encode_defunct adds this prefix automatically
    message_hash = encode_defunct(text=signed_message)

    # Step 5: Recover signer address from signature
    try:
        recovered_address = Account.recover_message(
            message_hash,
            signature=signature
        )
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Signature verification failed: {str(e)}"
        )
    # WHY: ECDSA signature recovery proves who signed
    # HOW: Uses public key cryptography (no private key needed)

    # Step 6: Verify recovered address matches claimed address
    if recovered_address.lower() != address.lower():
        raise HTTPException(
            status_code=401,
            detail="Signature verification failed: address mismatch"
        )
    # WHY: Prevents someone from using another wallet's signature

    # Step 7: Find existing auth identity or create new user
    auth_identity = db.query(AuthIdentity).filter(
        AuthIdentity.provider == "evm",
        AuthIdentity.provider_id == address.lower()
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
            # WHY: Soft delete - allow disabling accounts

        return user

    else:
        # New user - create account
        # Generate default username if not provided
        if not username:
            username = f"user_{address[:8].lower()}"
            # WHY: Need some username, user can change later
            # Format: "user_0x742d35"

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
            provider="evm",
            provider_id=address.lower(),  # Store lowercase for consistency
            data={
                "address": address,  # Store checksummed for display
                "first_login": datetime.utcnow().isoformat()
            }
        )
        db.add(auth_identity)
        db.commit()
        db.refresh(user)

        return user


async def link_evm_to_user(
    user_id: str,
    address: str,
    signed_message: str,
    signature: str,
    db: Session
) -> AuthIdentity:
    """
    Link an EVM wallet to an existing user account.

    WHY: Allow users to add wallet auth to email-only accounts
    HOW: Verify signature, create new AuthIdentity for existing user

    Args:
        user_id: UUID of existing user
        address: Ethereum address to link
        signed_message: Signed challenge message
        signature: Signature from wallet
        db: Database session

    Returns:
        Created AuthIdentity object

    Raises:
        HTTPException(400): If wallet already linked to another account
        HTTPException(404): If user not found
        HTTPException(401): If signature verification fails

    Example:
        >>> # User signed up with email, now wants to add MetaMask
        >>> auth_id = await link_evm_to_user(
        ...     user.id,
        ...     "0x742d35Cc...",
        ...     "privexbot.com wants...",
        ...     "0xabc123...",
        ...     db
        ... )
    """
    # Step 1: Validate address and verify signature (reuse verification logic)
    address = validate_evm_address(address)

    # Step 2: Verify signature (without creating new user)
    nonce = get_nonce(address.lower(), "evm")
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

    message_hash = encode_defunct(text=signed_message)
    try:
        recovered_address = Account.recover_message(message_hash, signature=signature)
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Signature verification failed: {str(e)}"
        )

    if recovered_address.lower() != address.lower():
        raise HTTPException(
            status_code=401,
            detail="Signature verification failed: address mismatch"
        )

    # Step 3: Check if user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Step 4: Check if wallet already linked (to anyone)
    existing_wallet = db.query(AuthIdentity).filter(
        AuthIdentity.provider == "evm",
        AuthIdentity.provider_id == address.lower()
    ).first()

    if existing_wallet:
        if existing_wallet.user_id == user.id:
            raise HTTPException(
                status_code=400,
                detail="This EVM wallet is already linked to your account"
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="This EVM wallet is already linked to another account. Please use a different wallet or log in with the wallet."
            )

    # Step 5: Create auth identity linking wallet to user
    auth_identity = AuthIdentity(
        user_id=user_id,
        provider="evm",
        provider_id=address.lower(),
        data={
            "address": address,
            "linked_at": datetime.utcnow().isoformat()
        }
    )

    db.add(auth_identity)
    db.commit()
    db.refresh(auth_identity)

    return auth_identity
