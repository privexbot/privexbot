"""
Initial Staff Configuration

WHY: Centralized list of initial staff users for backoffice access
HOW: Check against this list during user registration/login to auto-grant staff

This module is used by:
1. scripts/set_initial_staff.py - Batch updates existing users on startup
2. auth_service.py - Auto-grants staff on new registration/first login
"""

from typing import Optional

# ============================================================
# INITIAL STAFF CONFIGURATION
# Add or remove staff members here
# ============================================================
INITIAL_STAFF_IDENTIFIERS = {
    # Format: (provider, identifier_lowercase) -> description
    ("email", "ceze5265@gmail.com"): "Primary admin (email)",
    ("evm", "0x4e9fd5a22e78750a6299ac19885136ee2efa7893"): "Primary admin (EVM wallet)",
}
# ============================================================


def should_be_staff(provider: str, identifier: str) -> bool:
    """
    Check if an auth identity should have staff access.

    Args:
        provider: Auth provider (email, evm, solana, cosmos)
        identifier: The identifier (email address or wallet address)

    Returns:
        bool: True if this identity is in the initial staff list
    """
    # Normalize: lowercase for case-insensitive matching (especially wallet addresses)
    key = (provider.lower(), identifier.lower())
    return key in INITIAL_STAFF_IDENTIFIERS


def get_staff_description(provider: str, identifier: str) -> Optional[str]:
    """
    Get description for a staff identity (for logging).

    Args:
        provider: Auth provider
        identifier: The identifier

    Returns:
        str or None: Description if found, None otherwise
    """
    key = (provider.lower(), identifier.lower())
    return INITIAL_STAFF_IDENTIFIERS.get(key)
