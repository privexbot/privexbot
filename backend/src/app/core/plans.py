"""
Plan limits — billing tier definitions.

WHY:
- Single source of truth for what each subscription tier allows.
- Hand-edited Python (not a DB table) keeps limits in code review and lets us
  evolve them in lockstep with feature work. If we ever need admin-editable
  plans, this gets promoted to a DB-backed table.

USAGE:
- Tiers correspond to `Organization.subscription_tier` values.
- `-1` means unlimited.
- The `billing_service` reads this dict; routes/handlers don't import directly.
"""

from typing import Final


# Tier name -> limits dict. Resource keys are stable (UI / quota checks
# reference them by exact name).
PLAN_LIMITS: Final[dict[str, dict[str, int]]] = {
    "free": {
        "chatbots": 1,
        "chatflows": 2,
        "kb_documents": 25,
        "messages_per_month": 500,
        "api_calls_per_month": 1_000,
        "team_members": 1,
    },
    "starter": {
        "chatbots": 5,
        "chatflows": 10,
        "kb_documents": 200,
        "messages_per_month": 5_000,
        "api_calls_per_month": 25_000,
        "team_members": 5,
    },
    "pro": {
        "chatbots": 25,
        "chatflows": 50,
        "kb_documents": 2_000,
        "messages_per_month": 50_000,
        "api_calls_per_month": 250_000,
        "team_members": 25,
    },
    "enterprise": {
        "chatbots": -1,
        "chatflows": -1,
        "kb_documents": -1,
        "messages_per_month": -1,
        "api_calls_per_month": -1,
        "team_members": -1,
    },
}

# Display-only metadata (presented by the upgrade UI).
PLAN_METADATA: Final[dict[str, dict]] = {
    "free": {
        "label": "Free",
        "price_monthly_usd": 0,
        "tagline": "Try the platform — perfect for personal projects.",
    },
    "starter": {
        "label": "Starter",
        "price_monthly_usd": 29,
        "tagline": "For small teams shipping their first chatbot.",
    },
    "pro": {
        "label": "Pro",
        "price_monthly_usd": 99,
        "tagline": "Scaling teams with multiple bots and KBs.",
    },
    "enterprise": {
        "label": "Enterprise",
        "price_monthly_usd": None,  # custom
        "tagline": "Custom limits, SSO, and dedicated support.",
    },
}


def get_limits(tier: str) -> dict[str, int]:
    """Return the limit dict for a tier, defaulting to free if unknown."""
    return PLAN_LIMITS.get(tier, PLAN_LIMITS["free"])


def is_unlimited(limit: int) -> bool:
    """Sentinel check; -1 means no cap."""
    return limit < 0
