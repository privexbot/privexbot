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

PRICING POSITIONING:
- We're an open-source platform with self-host always free. Cloud SaaS
  pricing is a convenience premium, not value capture.
- TEE confidential inference is our headline differentiator. Free on
  every tier — gating it would defeat the evaluation funnel.
- All deployment channels (website, Telegram, Discord, Slack, WhatsApp,
  Zapier) and all KB sources (file upload, text, web scraping, Google
  Drive, Notion) are available to every tier. Distribution > monetization
  for a new platform.
- Real differentiation lives in 4 feature flags: public API access,
  custom domain, branding removal, SSO/SAML.
"""

from typing import Final


# ─────────────────────────────────────────────────────────────────────────
# Numeric quotas. `-1` = unlimited.
# ─────────────────────────────────────────────────────────────────────────
PLAN_LIMITS: Final[dict[str, dict[str, int]]] = {
    "free": {
        "chatbots": 1,
        "chatflows": 1,
        "knowledge_bases": 1,
        "kb_documents": 25,
        # Matched to `kb_documents` because each scraped page becomes one
        # Document row. Setting a separate higher number (e.g. 50) would
        # be unreachable: a Free user hits the 25-doc cap after 25 scraped
        # pages. Keep the two limits aligned so the constraint is honest.
        "web_pages_per_month": 25,
        "messages_per_month": 500,
        "api_calls_per_month": 500,
        "team_members": 1,
        "workspaces": 1,
        # Per-USER cap (not per-org). Counts orgs where the user is OWNER.
        # Closes the abuse path where a Free user could spawn unlimited
        # Free orgs to bypass per-org caps (each new org would carry its
        # own 1-bot quota). Indie devs / small agencies upgrade for more.
        "owned_orgs": 1,
    },
    "starter": {
        "chatbots": 5,
        "chatflows": 5,
        "knowledge_bases": 5,
        "kb_documents": 250,
        "web_pages_per_month": 500,
        "messages_per_month": 5_000,
        "api_calls_per_month": 25_000,
        "team_members": 5,
        "workspaces": 3,
        "owned_orgs": 2,
    },
    "pro": {
        "chatbots": 25,
        "chatflows": 25,
        "knowledge_bases": 25,
        "kb_documents": 2_500,
        "web_pages_per_month": 5_000,
        "messages_per_month": 50_000,
        "api_calls_per_month": 250_000,
        "team_members": 25,
        "workspaces": 10,
        "owned_orgs": 5,
    },
    "enterprise": {
        "chatbots": -1,
        "chatflows": -1,
        "knowledge_bases": -1,
        "kb_documents": -1,
        "web_pages_per_month": -1,
        "messages_per_month": -1,
        "api_calls_per_month": -1,
        "team_members": -1,
        "workspaces": -1,
        "owned_orgs": -1,
    },
}


# ─────────────────────────────────────────────────────────────────────────
# Feature gates. Only flags with a real enforcement point — every entry
# below has a check_feature() call somewhere in routes/services. Keep
# this list small.
# ─────────────────────────────────────────────────────────────────────────
PLAN_FEATURES: Final[dict[str, dict[str, object]]] = {
    "free": {
        "tee_confidential_inference": True,   # core differentiator — never gated
        "public_api_access": False,           # Starter+ only
        "custom_domain": False,
        "remove_branding": False,
        "sso_saml": False,
        # Categorical
        "audit_log_retention_days": 7,
        "priority_support": "community",
        "inactivity_suspend_days": 30,
    },
    "starter": {
        "tee_confidential_inference": True,
        "public_api_access": True,
        "custom_domain": False,
        "remove_branding": False,
        "sso_saml": False,
        "audit_log_retention_days": 30,
        "priority_support": "email",
        "inactivity_suspend_days": -1,
    },
    "pro": {
        "tee_confidential_inference": True,
        "public_api_access": True,
        "custom_domain": True,
        "remove_branding": True,
        "sso_saml": False,
        "audit_log_retention_days": 90,
        "priority_support": "email_chat",
        "inactivity_suspend_days": -1,
    },
    "enterprise": {
        "tee_confidential_inference": True,
        "public_api_access": True,
        "custom_domain": True,
        "remove_branding": True,
        "sso_saml": True,
        "audit_log_retention_days": -1,
        "priority_support": "dedicated_csm_sla",
        "inactivity_suspend_days": -1,
    },
}


# ─────────────────────────────────────────────────────────────────────────
# Display metadata. Annual discount is 20%, framed as "2 months free"
# in the UI for low-price tiers where the percentage feels small.
# ─────────────────────────────────────────────────────────────────────────
ANNUAL_DISCOUNT: Final[float] = 0.20


PLAN_METADATA: Final[dict[str, dict]] = {
    "free": {
        "label": "Free",
        "price_monthly_usd": 0,
        "price_annual_usd": 0,
        "tagline": "Build your first AI agent — TEE inference included.",
        "best_for": "Personal projects and evaluation",
        "cta_label": "Start free",
    },
    "starter": {
        "label": "Starter",
        "price_monthly_usd": 19,
        "price_annual_usd": int(19 * 12 * (1 - ANNUAL_DISCOUNT)),
        "tagline": "Solo founders shipping their first real bot.",
        "best_for": "Indie devs, side projects, small businesses",
        "cta_label": "Start free, upgrade later",
    },
    "pro": {
        "label": "Pro",
        "price_monthly_usd": 89,
        "price_annual_usd": int(89 * 12 * (1 - ANNUAL_DISCOUNT)),
        "tagline": "Scaling teams running multiple agents in production.",
        "best_for": "Small teams, growing SaaS, agency clients",
        "cta_label": "Start free, upgrade later",
        "highlight": True,
    },
    "enterprise": {
        "label": "Enterprise",
        "price_monthly_usd": None,
        "price_annual_usd": None,
        "tagline": "Custom limits, SSO, dedicated support, SLA.",
        "best_for": "Compliance-driven orgs, enterprise rollouts",
        "cta_label": "Contact us",
    },
}


# ─────────────────────────────────────────────────────────────────────────
# Quota enforcement strategy. Hard means refuse the operation; soft
# means log + warn but let through up to the soft-degrade threshold.
# ─────────────────────────────────────────────────────────────────────────
ENFORCEMENT_POLICY: Final[dict[str, str]] = {
    "chatbots": "hard",
    "chatflows": "hard",
    "knowledge_bases": "hard",
    "kb_documents": "hard",
    "web_pages_per_month": "hard",
    "messages_per_month": "soft_degrade",
    "api_calls_per_month": "soft_degrade",
    "team_members": "hard",
    "workspaces": "hard",
}

# When a soft-degrade resource crosses 120% of cap, the platform returns
# a fixed reply rather than running inference. 20% buffer covers monthly
# cycle edge cases (timing-vs-actual usage).
SOFT_DEGRADE_THRESHOLD: Final[float] = 1.20

# Notification thresholds — emails sent once per cycle when crossed.
NOTIFY_THRESHOLDS: Final[list[float]] = [0.80, 1.00, 1.20]


def get_limits(tier: str) -> dict[str, int]:
    """Return the limit dict for a tier, defaulting to free if unknown."""
    return PLAN_LIMITS.get(tier, PLAN_LIMITS["free"])


def get_features(tier: str) -> dict[str, object]:
    """Return the feature-gate dict for a tier, defaulting to free."""
    return PLAN_FEATURES.get(tier, PLAN_FEATURES["free"])


def get_metadata(tier: str) -> dict:
    """Return the display metadata for a tier, defaulting to free."""
    return PLAN_METADATA.get(tier, PLAN_METADATA["free"])


def has_feature(tier: str, feature: str) -> bool:
    """Boolean feature check. Returns False for unknown tier or feature.

    Categorical features (audit_log_retention_days, priority_support,
    inactivity_suspend_days) are not boolean — read them via
    `get_features(tier)[name]` directly.
    """
    value = get_features(tier).get(feature)
    return bool(value)


def is_unlimited(limit: int) -> bool:
    """Sentinel check; -1 means no cap."""
    return limit < 0
