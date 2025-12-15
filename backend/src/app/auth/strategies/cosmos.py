"""
Cosmos wallet authentication strategy.

See implementation guide in /backend/docs/auth/ for full documentation.
"""

# ACTUAL IMPLEMENTATION
from sqlalchemy.orm import Session
from fastapi import HTTPException
from ecdsa import VerifyingKey, SECP256k1, BadSignatureError
from datetime import datetime
from typing import Dict
import hashlib
import base64
import json
from bech32 import bech32_decode, bech32_encode, convertbits

from app.utils.redis import store_nonce, get_nonce, generate_nonce
from app.models.user import User
from app.models.auth_identity import AuthIdentity


def validate_cosmos_address(address: str) -> str:
    """
    Validate a Cosmos bech32 address format.

    WHY: Ensure address is valid before processing
    HOW: Decode bech32 and check prefix

    Args:
        address: Cosmos address (bech32 format)

    Returns:
        The validated address (unchanged)

    Raises:
        HTTPException(400): If address format is invalid

    Example:
        >>> validate_cosmos_address("cosmos1...")
        'cosmos1...'
        >>> validate_cosmos_address("secret1...")
        'secret1...'
    """
    if not address or not isinstance(address, str):
        raise HTTPException(
            status_code=400,
            detail="Address is required and must be a string"
        )

    # Check if address starts with supported prefix
    # WHY: Support cosmos and secret networks (can extend)
    supported_prefixes = ["cosmos1", "secret1"]
    if not any(address.startswith(prefix) for prefix in supported_prefixes):
        raise HTTPException(
            status_code=400,
            detail=f"Address must start with one of: {', '.join(supported_prefixes)}"
        )

    # Validate bech32 encoding
    try:
        hrp, data = bech32_decode(address)
        # WHY: bech32_decode validates checksum and format

        if not hrp or not data:
            raise ValueError("Invalid bech32 encoding")

        return address

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid Cosmos address: {str(e)}"
        )


async def request_challenge(address: str) -> Dict[str, str]:
    """
    Generate a challenge message for Cosmos wallet authentication.

    WHY: Implement challenge-response pattern for secure wallet auth
    HOW: Generate nonce, store in Redis, create message to sign

    Args:
        address: Cosmos address requesting challenge

    Returns:
        Dictionary with "message" (to sign) and "nonce"

    Raises:
        HTTPException(400): If address format is invalid

    Security Notes:
        - Nonce expires in 5 minutes (NONCE_EXPIRE_SECONDS)
        - Single-use nonce prevents replay attacks

    Example:
        >>> challenge = await request_challenge("cosmos1...")
        >>> challenge.keys()
        dict_keys(['message', 'nonce'])
    """
    # Step 1: Validate address format
    address = validate_cosmos_address(address)

    # Step 2: Generate cryptographically secure nonce
    nonce = generate_nonce()
    # WHY: Unique challenge prevents replay attacks

    # Step 3: Store nonce in Redis with expiration
    store_nonce(address, nonce, "cosmos")
    # WHY Redis: Fast lookup and automatic expiration (5 min)

    # Step 4: Create message to sign
    issued_at = datetime.utcnow().isoformat() + "Z"

    message = f"""Sign this message to authenticate with PrivexBot.

Address: {address}
Nonce: {nonce}
Timestamp: {issued_at}

This will not trigger any transaction or cost any fees.
"""
    # WHY clear message: Make authentication intent obvious
    # WHY "no fees": Reassure users this is just auth, not a transaction

    return {
        "message": message,
        "nonce": nonce
    }


def derive_cosmos_address(pubkey_bytes: bytes, prefix: str) -> str:
    """
    Derive Cosmos address from public key.

    WHY: Verify that provided public key matches claimed address
    HOW: Follow Cosmos SDK address derivation (SHA256 -> RIPEMD160 -> bech32)

    Args:
        pubkey_bytes: Raw public key bytes (33 bytes compressed secp256k1)
        prefix: Bech32 prefix (e.g., "cosmos", "secret")

    Returns:
        Bech32-encoded address

    Raises:
        Exception: If derivation fails

    Address Derivation Steps:
        1. SHA256 hash of public key
        2. RIPEMD160 hash of SHA256 result
        3. Convert bits for bech32 (8-bit to 5-bit)
        4. Encode as bech32 with prefix

    Example:
        >>> pubkey = bytes.fromhex("02...")  # 33 bytes compressed pubkey
        >>> derive_cosmos_address(pubkey, "cosmos")
        'cosmos1...'
    """
    # Step 1: SHA256 hash of public key
    sha256_hash = hashlib.sha256(pubkey_bytes).digest()

    # Step 2: RIPEMD160 hash of SHA256 result
    # WHY: Standard Bitcoin/Cosmos address derivation
    ripemd160_hash = hashlib.new('ripemd160', sha256_hash).digest()

    # Step 3: Convert from 8-bit bytes to 5-bit groups for bech32
    # WHY: Bech32 encoding requires 5-bit groups
    converted_bits = convertbits(ripemd160_hash, 8, 5)

    if not converted_bits:
        raise ValueError("Failed to convert bits for bech32 encoding")

    # Step 4: Encode as bech32 with prefix
    address = bech32_encode(prefix, converted_bits)

    if not address:
        raise ValueError("Failed to encode address as bech32")

    return address


def create_adr36_sign_doc(signer: str, data: str) -> bytes:
    """
    Create ADR-36 compliant sign doc for Keplr wallet signatures.

    WHY: Keplr's signArbitrary wraps messages in ADR-36 format
    HOW: Construct sign doc with specific structure, canonically encode, hash

    Args:
        signer: Bech32 address of the signer
        data: The original message (will be base64-encoded)

    Returns:
        SHA256 hash of the canonical JSON encoding

    ADR-36 Format:
        The sign doc has all metadata fields set to empty/zero:
        - chain_id: ""
        - account_number: "0"
        - sequence: "0"
        - fee: {gas: "0", amount: []}
        - memo: ""
        - msgs: Contains the MsgSignData with signer and base64-encoded data

    Example:
        >>> sign_doc_hash = create_adr36_sign_doc("cosmos1...", "Hello World")
        >>> len(sign_doc_hash)
        32  # SHA256 hash is 32 bytes
    """
    # Step 1: Base64-encode the message data
    # WHY: ADR-36 spec requires data to be base64-encoded
    data_base64 = base64.b64encode(data.encode('utf-8')).decode('ascii')

    # Step 2: Construct ADR-36 sign doc structure
    sign_doc = {
        "chain_id": "",
        "account_number": "0",
        "sequence": "0",
        "fee": {
            "gas": "0",
            "amount": []
        },
        "msgs": [
            {
                "type": "sign/MsgSignData",
                "value": {
                    "signer": signer,
                    "data": data_base64
                }
            }
        ],
        "memo": ""
    }

    # Step 3: Canonically encode as JSON
    # WHY: Canonical encoding ensures consistent hashing (sorted keys, no whitespace)
    canonical_json = json.dumps(
        sign_doc,
        separators=(',', ':'),  # No whitespace
        sort_keys=True,  # Sorted keys for consistency
        ensure_ascii=True
    )

    # Step 4: SHA256 hash the canonical JSON
    # WHY: Cosmos signatures sign the hash of the sign doc
    sign_doc_hash = hashlib.sha256(canonical_json.encode('utf-8')).digest()

    return sign_doc_hash


async def verify_signature(
    address: str,
    signed_message: str,
    signature: str,
    public_key: str,
    db: Session,
    username: str = None
) -> User:
    """
    Verify Cosmos wallet signature and authenticate/create user.

    WHY: Cryptographically prove wallet ownership using secp256k1
    HOW: Verify pubkey matches address, then verify signature

    Args:
        address: Cosmos address that allegedly signed
        signed_message: The exact message that was signed
        signature: Base64-encoded signature from wallet
        public_key: Base64-encoded public key (Cosmos wallets provide this)
        db: Database session
        username: Optional custom username for new users

    Returns:
        User object (existing or newly created)

    Raises:
        HTTPException(400): If nonce expired/invalid, message mismatch, or pubkey mismatch
        HTTPException(401): If signature verification fails
        HTTPException(401): If account is inactive

    Security Notes:
        - Nonce is single-use (deleted after retrieval)
        - Public key must derive to claimed address
        - secp256k1 signature verification proves ownership

    Important: Unlike EVM (which recovers pubkey from signature), Cosmos
    wallets provide the public key separately and we must verify it matches.

    Example:
        >>> user = await verify_signature(
        ...     "cosmos1...",
        ...     "Sign this message...",
        ...     "bW9ja19zaWduYXR1cmU=",  # base64 signature
        ...     "Ay1hY2tfcHVibGljX2tleQ==",  # base64 pubkey
        ...     db
        ... )
    """
    # Step 1: Validate address format
    address = validate_cosmos_address(address)

    # Step 2: Retrieve nonce from Redis (single-use)
    nonce = get_nonce(address, "cosmos")

    if not nonce:
        raise HTTPException(
            status_code=400,
            detail="Nonce expired or invalid. Please request a new challenge."
        )

    # Step 3: Verify nonce is in the signed message
    if nonce not in signed_message:
        raise HTTPException(
            status_code=400,
            detail="Message does not contain the expected nonce"
        )

    # Step 4: Decode signature and public key from base64
    try:
        signature_bytes = base64.b64decode(signature)
        pubkey_bytes = base64.b64decode(public_key)
        # WHY base64: Standard encoding in Cosmos ecosystem

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid signature or public key encoding: {str(e)}"
        )

    # Step 5: Verify public key derives to claimed address
    # WHY: Prevents attacker from using different public key
    try:
        # Extract prefix from address (e.g., "cosmos" from "cosmos1...")
        prefix = address.split('1')[0]

        # Derive address from provided public key
        derived_address = derive_cosmos_address(pubkey_bytes, prefix)

        if derived_address != address:
            raise HTTPException(
                status_code=400,
                detail="Public key does not match address"
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Address derivation failed: {str(e)}"
        )

    # Step 6: Verify signature using secp256k1 with ADR-36 format
    try:
        # Create verifying key from public key bytes
        # WHY: secp256k1 is the curve used by Cosmos (same as Bitcoin/Ethereum)
        verifying_key = VerifyingKey.from_string(
            pubkey_bytes,
            curve=SECP256k1
        )

        # Create ADR-36 sign doc hash
        # WHY: Keplr's signArbitrary wraps the message in ADR-36 format before signing
        sign_doc_hash = create_adr36_sign_doc(address, signed_message)

        # Debug logging
        print(f"[DEBUG] Address: {address}")
        print(f"[DEBUG] Message length: {len(signed_message)}")
        print(f"[DEBUG] Signature length: {len(signature_bytes)}")
        print(f"[DEBUG] Pubkey length: {len(pubkey_bytes)}")
        print(f"[DEBUG] Sign doc hash: {sign_doc_hash.hex()[:32]}...")

        # Verify signature against the ADR-36 sign doc hash
        # THROWS: BadSignatureError if signature doesn't match
        # NOTE: sign_doc_hash is already SHA256 hashed, so we don't pass hashfunc
        verifying_key.verify_digest(
            signature_bytes,
            sign_doc_hash
        )

        print(f"[DEBUG] Signature verification SUCCESS")

    except BadSignatureError as e:
        print(f"[DEBUG] BadSignatureError: {str(e)}")
        raise HTTPException(
            status_code=401,
            detail="Signature verification failed: invalid signature"
        )
    except Exception as e:
        print(f"[DEBUG] Exception during verification: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=401,
            detail=f"Signature verification failed: {str(e)}"
        )

    # Step 7: Find existing auth identity or create new user
    auth_identity = db.query(AuthIdentity).filter(
        AuthIdentity.provider == "cosmos",
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
            # WHY longer prefix: Cosmos addresses are longer, more readable
            username = f"user_{address[:12].lower()}"

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
            provider="cosmos",
            provider_id=address,
            data={
                "address": address,
                "public_key": public_key,  # Store for future reference
                "first_login": datetime.utcnow().isoformat()
            }
        )
        db.add(auth_identity)
        db.commit()
        db.refresh(user)

        return user


async def link_cosmos_to_user(
    user_id: str,
    address: str,
    signed_message: str,
    signature: str,
    public_key: str,
    db: Session
) -> AuthIdentity:
    """
    Link a Cosmos wallet to an existing user account.

    WHY: Allow users to add Cosmos wallet auth to email-only accounts
    HOW: Verify signature and pubkey, create new AuthIdentity for existing user

    Args:
        user_id: UUID of existing user
        address: Cosmos address to link
        signed_message: Signed challenge message
        signature: Base64-encoded signature from wallet
        public_key: Base64-encoded public key from wallet
        db: Database session

    Returns:
        Created AuthIdentity object

    Raises:
        HTTPException(400): If wallet already linked to another account
        HTTPException(404): If user not found
        HTTPException(401): If signature verification fails

    Example:
        >>> # User signed up with email, now wants to add Keplr
        >>> auth_id = await link_cosmos_to_user(
        ...     user.id,
        ...     "cosmos1...",
        ...     "Sign this message...",
        ...     "bW9ja19zaWduYXR1cmU=",
        ...     "Ay1hY2tfcHVibGljX2tleQ==",
        ...     db
        ... )
    """
    # Step 1: Validate address and verify signature
    address = validate_cosmos_address(address)

    # Step 2: Verify signature (without creating new user)
    nonce = get_nonce(address, "cosmos")
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
        signature_bytes = base64.b64decode(signature)
        pubkey_bytes = base64.b64decode(public_key)

        # Verify pubkey matches address
        prefix = address.split('1')[0]
        derived_address = derive_cosmos_address(pubkey_bytes, prefix)
        if derived_address != address:
            raise HTTPException(
                status_code=400,
                detail="Public key does not match address"
            )

        # Verify signature with ADR-36 format
        verifying_key = VerifyingKey.from_string(pubkey_bytes, curve=SECP256k1)
        sign_doc_hash = create_adr36_sign_doc(address, signed_message)
        # NOTE: sign_doc_hash is already SHA256 hashed, use verify_digest
        verifying_key.verify_digest(signature_bytes, sign_doc_hash)

    except BadSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Signature verification failed"
        )
    except HTTPException:
        raise
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
        AuthIdentity.provider == "cosmos",
        AuthIdentity.provider_id == address
    ).first()

    if existing_wallet:
        if existing_wallet.user_id == user.id:
            raise HTTPException(
                status_code=400,
                detail="This Cosmos wallet is already linked to your account"
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="This Cosmos wallet is already linked to another account. Please use a different wallet or log in with the wallet."
            )

    # Step 5: Create auth identity linking wallet to user
    auth_identity = AuthIdentity(
        user_id=user_id,
        provider="cosmos",
        provider_id=address,
        data={
            "address": address,
            "public_key": public_key,
            "linked_at": datetime.utcnow().isoformat()
        }
    )

    db.add(auth_identity)
    db.commit()
    db.refresh(auth_identity)

    return auth_identity
