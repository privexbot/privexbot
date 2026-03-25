"""
Invite Code Service - Manage beta tester invite codes in Redis.

WHY:
- Control access to KB creation during beta phase
- Staff can generate codes for early testers
- Codes are temporary (7-day TTL) and single-use

HOW:
- Store invite codes in Redis with metadata
- Validate and redeem codes atomically
- Track who created and redeemed each code

FLOW:
1. Staff generates invite code via admin panel
2. Staff shares code with beta tester (email, chat, etc.)
3. Beta tester enters code in KB creation gate
4. Backend validates code and grants beta access
5. User's has_beta_access flag is set to True
"""

import secrets
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID

from app.utils.redis import redis_client


class InviteCodeService:
    """
    Manage beta tester invite codes in Redis.

    Codes are stored with format: invite_code:{CODE}
    Each code has metadata including creator, timestamps, and redemption status.
    """

    REDIS_PREFIX = "invite_code:"
    DEFAULT_TTL_DAYS = 7
    CODE_LENGTH = 4  # Characters after PRIV- prefix

    def __init__(self):
        """Initialize the invite code service."""
        pass

    def _generate_code(self) -> str:
        """
        Generate a unique invite code.

        Format: PRIV-XXXX (e.g., PRIV-A1B2)
        Uses uppercase alphanumeric characters for easy sharing.

        Returns:
            Formatted invite code string
        """
        # Generate random alphanumeric characters (uppercase)
        chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # Exclude confusing chars: 0, O, I, 1
        code_suffix = "".join(secrets.choice(chars) for _ in range(self.CODE_LENGTH))
        return f"PRIV-{code_suffix}"

    def _get_key(self, code: str) -> str:
        """Get Redis key for an invite code."""
        return f"{self.REDIS_PREFIX}{code.upper()}"

    def generate_code(self, created_by: UUID, ttl_days: int = None) -> Dict[str, Any]:
        """
        Generate a new invite code.

        Args:
            created_by: UUID of the staff member generating the code
            ttl_days: Optional TTL in days (default: 7)

        Returns:
            Dict with code details: code, created_at, expires_at, created_by
        """
        if ttl_days is None:
            ttl_days = self.DEFAULT_TTL_DAYS

        # Generate unique code (retry if collision)
        max_attempts = 10
        for _ in range(max_attempts):
            code = self._generate_code()
            key = self._get_key(code)

            # Check if code already exists
            if not redis_client.exists(key):
                break
        else:
            raise RuntimeError("Failed to generate unique invite code after max attempts")

        now = datetime.utcnow()
        expires_at = now + timedelta(days=ttl_days)
        ttl_seconds = ttl_days * 24 * 60 * 60

        # Store code metadata
        code_data = {
            "code": code,
            "created_by": str(created_by),
            "created_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
            "redeemed_by": None,
            "redeemed_at": None,
        }

        # Store in Redis with TTL
        redis_client.setex(
            name=key,
            time=ttl_seconds,
            value=json.dumps(code_data)
        )

        return code_data

    def validate_code(self, code: str) -> Optional[Dict[str, Any]]:
        """
        Validate an invite code without consuming it.

        Args:
            code: The invite code to validate

        Returns:
            Code data dict if valid and not redeemed, None otherwise
        """
        key = self._get_key(code)
        data = redis_client.get(key)

        if not data:
            return None

        code_data = json.loads(data)

        # Check if already redeemed
        if code_data.get("redeemed_by"):
            return None

        return code_data

    def redeem_code(self, code: str, user_id: UUID) -> bool:
        """
        Redeem an invite code for a user.

        This marks the code as redeemed (single-use).
        The caller is responsible for updating user.has_beta_access.

        Args:
            code: The invite code to redeem
            user_id: UUID of the user redeeming the code

        Returns:
            True if redeemed successfully, False if invalid/already redeemed
        """
        key = self._get_key(code)
        data = redis_client.get(key)

        if not data:
            return False

        code_data = json.loads(data)

        # Check if already redeemed
        if code_data.get("redeemed_by"):
            return False

        # Mark as redeemed
        code_data["redeemed_by"] = str(user_id)
        code_data["redeemed_at"] = datetime.utcnow().isoformat()

        # Get remaining TTL to preserve expiration
        ttl = redis_client.ttl(key)
        if ttl > 0:
            redis_client.setex(key, ttl, json.dumps(code_data))
        else:
            # If TTL is -1 (no expiry) or -2 (expired), set with default TTL
            redis_client.setex(key, 24 * 60 * 60, json.dumps(code_data))  # Keep for 1 day after redemption

        return True

    def list_codes(self) -> List[Dict[str, Any]]:
        """
        List all active invite codes.

        Returns:
            List of code data dicts, sorted by created_at descending
        """
        codes = []

        # Find all invite code keys
        pattern = f"{self.REDIS_PREFIX}*"
        keys = redis_client.keys(pattern)

        for key in keys:
            data = redis_client.get(key)
            if data:
                code_data = json.loads(data)
                # Add TTL info
                ttl = redis_client.ttl(key)
                code_data["ttl_seconds"] = ttl if ttl > 0 else 0
                codes.append(code_data)

        # Sort by created_at descending (newest first)
        codes.sort(key=lambda x: x.get("created_at", ""), reverse=True)

        return codes

    def revoke_code(self, code: str) -> bool:
        """
        Revoke (delete) an invite code.

        Args:
            code: The invite code to revoke

        Returns:
            True if code was found and deleted, False if not found
        """
        key = self._get_key(code)
        deleted = redis_client.delete(key)
        return deleted > 0

    def get_code_info(self, code: str) -> Optional[Dict[str, Any]]:
        """
        Get full info about an invite code.

        Args:
            code: The invite code to look up

        Returns:
            Code data dict if found, None otherwise
        """
        key = self._get_key(code)
        data = redis_client.get(key)

        if not data:
            return None

        code_data = json.loads(data)
        ttl = redis_client.ttl(key)
        code_data["ttl_seconds"] = ttl if ttl > 0 else 0

        return code_data


# Singleton instance
invite_code_service = InviteCodeService()
