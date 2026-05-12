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
        # Free is now sized for "evaluate the product, decide" — not "run a
        # real bot indefinitely." Real infra cost (~$102/mo SecretVM compute
        # alone, before per-token Secret AI inference) makes generous free
        # economically untenable at scale. After 90-day grandfather email
        # sent to legacy free orgs, these limits clip them to the new ceiling.
        "chatbots": 1,
        "chatflows": 1,
        "knowledge_bases": 1,
        "kb_documents": 5,
        # Matched to `kb_documents` because each scraped page becomes one
        # Document row. Two-limit alignment keeps the constraint honest.
        "web_pages_per_month": 5,
        "messages_per_month": 50,
        "api_calls_per_month": 50,
        "team_members": 1,
        "workspaces": 1,
        # Per-USER cap (not per-org). Counts orgs where the user is OWNER.
        # Closes the abuse path where a Free user could spawn unlimited
        # Free orgs to bypass per-org caps (each new org would carry its
        # own 1-bot quota). Indie devs / small agencies upgrade for more.
        "owned_orgs": 1,
    },
    "starter": {
        # Messages cap right-sized to the per-token economics of
        # DeepSeek-R1 (the default Secret AI model). At ~$0.002 per output
        # token and a realistic mix averaging ~3,650 output tokens/msg,
        # each message costs ~$0.0073 in Secret AI inference. 1,500 msgs
        # × $0.0073 + $5 amortized compute = $16/mo cost vs $29 revenue
        # → 45% gross margin (within SaaS benchmark of 50-65%, acceptable
        # for early stage). 5,000 was unprofitable on heavy users.
        "chatbots": 5,
        "chatflows": 5,
        "knowledge_bases": 5,
        "kb_documents": 250,
        "web_pages_per_month": 500,
        "messages_per_month": 1_500,
        # api_calls counts ChatSession opens (not raw messages) — keep
        # generously above messages so a chatty session-per-user bot
        # doesn't run out of "calls" while still under the message cap.
        "api_calls_per_month": 5_000,
        "team_members": 5,
        "workspaces": 3,
        "owned_orgs": 2,
    },
    "pro": {
        # 5,000 msg/mo (was 50k). DeepSeek-R1 outputs 15k+ tokens on
        # reasoning-heavy queries (per Artificial Analysis benchmarks).
        # With a 30/50/20 mix of simple/medium/heavy: avg ~$0.0093/msg.
        # 5,000 × $0.0093 + $5 compute = $51.5/mo vs $99 → 48% margin.
        # 50k cap was unsustainable: a single power user generating max
        # messages with reasoning would cost $465+/mo in inference vs
        # $99 revenue. Right-sizing to economics, not aspiration.
        # Heavier-volume customers go to Enterprise (custom contracts).
        "chatbots": 25,
        "chatflows": 25,
        "knowledge_bases": 25,
        "kb_documents": 2_500,
        "web_pages_per_month": 5_000,
        "messages_per_month": 5_000,
        # Sessions cap. Same rationale as Starter — sessions are cheap
        # (one row per session) so generous above messages.
        "api_calls_per_month": 15_000,
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
        # $29/mo (was $19). Still cheaper than Chatbase Hobby ($40) and
        # Voiceflow Pro ($60); covers operator support time per active
        # customer. Existing $19 customers are grandfathered for 6 months
        # via a manual email — no code path change needed since we have no
        # Stripe wiring (every upgrade is a manual operator action).
        "price_monthly_usd": 29,
        "price_annual_usd": int(29 * 12 * (1 - ANNUAL_DISCOUNT)),
        "tagline": "Solo founders shipping their first real bot.",
        "best_for": "Indie devs, side projects, small businesses",
        "cta_label": "Start free, upgrade later",
    },
    "pro": {
        "label": "Pro",
        # $99/mo (was $89). Round number signals premium; still 34%
        # cheaper than Chatbase Standard ($150) while we offer TEE
        # confidential inference as a unique differentiator.
        "price_monthly_usd": 99,
        "price_annual_usd": int(99 * 12 * (1 - ANNUAL_DISCOUNT)),
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
