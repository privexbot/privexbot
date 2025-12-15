"""
Redis client for caching nonces in wallet authentication.

WHY:
- Wallet auth requires challenge-response pattern
- Nonces must be temporary and verified once
- Redis provides fast, in-memory storage with TTL (time-to-live)
- Prevents replay attacks

HOW:
- Store nonce with wallet address as key
- Set expiration (5 minutes default)
- Verify and delete after one use

PSEUDOCODE:
-----------
from redis import Redis
from app.core.config import settings

# Create Redis client
redis_client = Redis.from_url(
    settings.REDIS_URL,
    decode_responses=True  # WHY: Return strings instead of bytes
)

NONCE OPERATIONS:
-----------------

function store_nonce(address: str, nonce: str, provider: str):
    
    WHY: Save generated nonce for wallet signature verification
    HOW: Store with expiration to prevent old nonce reuse

    Args:
        address: Wallet address (0x123... or base58 string)
        nonce: Random string to sign
        provider: 'evm', 'solana', or 'cosmos'
    
    key = f"nonce:{provider}:{address}"
        WHY: Namespace by provider to separate EVM/Solana/Cosmos

    redis_client.setex(
        name=key,
        time=settings.NONCE_EXPIRE_SECONDS,  # Default: 300 (5 minutes)
        value=nonce
    )
        WHY setex: Set with expiration in one atomic operation
        WHY expiration: Old nonces become invalid automatically
        SECURITY: Prevents replay attacks with old signatures

function get_nonce(address: str, provider: str) -> str | None:
    
    WHY: Retrieve nonce for signature verification
    HOW: Get and immediately delete (single use)

    Returns: Nonce string or None if not found/expired
    
    key = f"nonce:{provider}:{address}"

    # Get and delete in one operation (atomic)
    nonce = redis_client.getdel(key)
        WHY getdel: Prevents nonce reuse (single-use token)
        SECURITY: Even if signature leaks, can't be reused

    return nonce

function delete_nonce(address: str, provider: str):
    
    WHY: Explicitly remove nonce (cleanup or on error)
    HOW: Delete the key from Redis
    
    key = f"nonce:{provider}:{address}"
    redis_client.delete(key)

AUTH FLOW USAGE:
----------------
1. Request Challenge:
    POST /auth/evm/challenge?address=0x123...
    ->  nonce = generate_random_string()
    ->  store_nonce(address, nonce, 'evm')
    ->  return {"message": f"Sign this: {nonce}"}

2. User signs message in wallet

3. Verify Signature:
    POST /auth/evm/verify
    {
        "address": "0x123...",
        "signature": "0xabc..."
    }
    ->  nonce = get_nonce(address, 'evm')  # Also deletes it
    ->  if not nonce: raise "Nonce expired or invalid"
    ->  verify_signature(address, nonce, signature)
    ->  if valid: create JWT token
    ->  if invalid: nonce already deleted, can't retry

SECURITY NOTES:
---------------
WHY expire nonces:
    - Prevents indefinite validity
    - Limits attack window
    - Auto-cleanup prevents Redis memory bloat

WHY single-use (getdel):
    - Prevents signature replay
    - Even if attacker captures valid signature, can't reuse
    - Must request new challenge each time

WHY namespace by provider:
    - Same wallet address on different chains are different identities
    - Prevents cross-chain nonce confusion



"""

# ACTUAL IMPLEMENTATION
from redis import Redis
from typing import Optional
from app.core.config import settings
import secrets


# Create Redis client
# WHY decode_responses=True: Returns strings instead of bytes for easier handling
redis_client = Redis.from_url(
    settings.REDIS_URL,
    decode_responses=True
)


def generate_nonce() -> str:
    """
    Generate a cryptographically secure random nonce.

    WHY: Each challenge must be unique and unpredictable
    HOW: Use secrets module (CSPRNG) for cryptographic randomness

    Returns:
        32-character hex string (16 bytes of entropy)

    Example:
        >>> nonce = generate_nonce()
        >>> nonce
        'a1b2c3d4e5f6...'  # 32 hex characters
        >>> len(nonce)
        32
    """
    # Generate 16 random bytes, convert to hex string (32 chars)
    return secrets.token_hex(16)


def store_nonce(address: str, nonce: str, provider: str) -> None:
    """
    Store a nonce in Redis with expiration.

    WHY: Save generated nonce for later signature verification
    HOW: Use setex for atomic set-with-expiration operation

    Args:
        address: Wallet address (e.g., '0x123...', 'cosmos1...', or base58)
        nonce: Random string that wallet will sign
        provider: Authentication provider ('evm', 'solana', or 'cosmos')

    Security Notes:
        - Nonces expire after NONCE_EXPIRE_SECONDS (default: 5 minutes)
        - Expiration prevents replay attacks with old signatures
        - Namespace by provider prevents cross-chain confusion

    Example:
        >>> nonce = generate_nonce()
        >>> store_nonce("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", nonce, "evm")
        >>> # Redis now has: nonce:evm:0x742d... -> nonce (expires in 5 min)
    """
    # Create namespaced key: nonce:{provider}:{address}
    # WHY namespace: Separates EVM/Solana/Cosmos identities
    key = f"nonce:{provider}:{address}"

    # Store with automatic expiration
    # WHY setex: Atomic operation ensures no race condition
    # WHY expiration: Auto-cleanup and limits attack window
    redis_client.setex(
        name=key,
        time=settings.NONCE_EXPIRE_SECONDS,
        value=nonce
    )


def get_nonce(address: str, provider: str) -> Optional[str]:
    """
    Retrieve and delete a nonce (single use).

    WHY: Verify signature and ensure nonce can't be reused
    HOW: Use getdel for atomic get-and-delete operation

    Args:
        address: Wallet address
        provider: Authentication provider ('evm', 'solana', or 'cosmos')

    Returns:
        The nonce string if found, None if expired or doesn't exist

    Security Notes:
        - Single-use: Nonce is deleted immediately after retrieval
        - Even if valid signature leaks, it cannot be replayed
        - Atomic operation prevents race conditions

    Example:
        >>> store_nonce("0x742d35Cc...", "abc123", "evm")
        >>> nonce = get_nonce("0x742d35Cc...", "evm")
        >>> nonce
        'abc123'
        >>> # Try again - nonce already deleted
        >>> get_nonce("0x742d35Cc...", "evm")
        None
    """
    key = f"nonce:{provider}:{address}"

    # Get and delete in one atomic operation
    # WHY getdel: Prevents nonce reuse (critical for security)
    # SECURITY: Even if attacker intercepts signature, can't replay it
    nonce = redis_client.getdel(key)

    return nonce


def delete_nonce(address: str, provider: str) -> None:
    """
    Explicitly delete a nonce from Redis.

    WHY: Cleanup nonce on error or when explicitly invalidating
    HOW: Delete the key from Redis

    Args:
        address: Wallet address
        provider: Authentication provider ('evm', 'solana', or 'cosmos')

    Use Cases:
        - User requests new challenge before old one expires
        - Error during authentication flow
        - Manual nonce invalidation

    Example:
        >>> store_nonce("0x742d35Cc...", "abc123", "evm")
        >>> delete_nonce("0x742d35Cc...", "evm")
        >>> # Nonce no longer exists
        >>> get_nonce("0x742d35Cc...", "evm")
        None
    """
    key = f"nonce:{provider}:{address}"
    redis_client.delete(key)


def check_redis_connection() -> bool:
    """
    Check if Redis connection is working.

    WHY: Health check for application startup
    HOW: Try a simple ping operation

    Returns:
        True if Redis is reachable, False otherwise

    Example:
        >>> check_redis_connection()
        True  # Redis is up and running
    """
    try:
        return redis_client.ping()
    except Exception:
        return False
