/**
 * Plan helpers — single shared layer between the marketing pricing page and
 * the in-app billing page. The numbers themselves come from the backend
 * (`/billing/public-plans` for marketing, `/billing/plans` for in-app), so the
 * frontend never duplicates `core/plans.py`.
 */

import type { BillingLimits, BillingTier, PlanCard } from "@/api/billing";

export const RESOURCE_LABELS: Record<keyof BillingLimits, string> = {
  chatbots: "Chatbots",
  chatflows: "Chatflows",
  knowledge_bases: "Knowledge bases",
  kb_documents: "Knowledge base documents",
  web_pages_per_month: "Web pages scraped / month",
  messages_per_month: "Messages / month",
  api_calls_per_month: "API calls / month",
  team_members: "Team members",
  workspaces: "Workspaces",
};

export const RESOURCE_ORDER: (keyof BillingLimits)[] = [
  "chatbots",
  "chatflows",
  "knowledge_bases",
  "kb_documents",
  "web_pages_per_month",
  "messages_per_month",
  "api_calls_per_month",
  "team_members",
  "workspaces",
];

export function formatLimit(value: number): string {
  if (value < 0) return "Unlimited";
  if (value === 0) return "—";
  if (value >= 1000) return value.toLocaleString();
  return String(value);
}

export function planFeatureBullets(limits: BillingLimits): string[] {
  return RESOURCE_ORDER.map(
    (key) => `${formatLimit(limits[key])} ${RESOURCE_LABELS[key]}`,
  );
}

/**
 * Feature comparison labels. Kept short — only the gates that have a
 * real enforcement point in code (api access, custom domain, branding
 * removal, SSO). Channels and KB sources are intentionally omitted
 * because they're available to every tier.
 *
 * `tee_confidential_inference` is included as a positive callout — it's
 * always-on but it's our headline differentiator and worth showing on
 * every column as a green check.
 */
export const FEATURE_LABELS: Record<string, string> = {
  tee_confidential_inference: "TEE confidential inference",
  public_api_access: "Public REST API access",
  custom_domain: "Custom domain",
  remove_branding: "Remove PrivexBot branding",
  sso_saml: "SSO / SAML",
};

export const FEATURE_ORDER: string[] = [
  "tee_confidential_inference",
  "public_api_access",
  "custom_domain",
  "remove_branding",
  "sso_saml",
];

export function formatSupportTier(value: string): string {
  switch (value) {
    case "community":
      return "Community";
    case "email":
      return "Email";
    case "email_chat":
      return "Email + chat";
    case "dedicated_csm_sla":
      return "Dedicated CSM + SLA";
    default:
      return value;
  }
}

export function formatRetentionDays(value: number): string {
  if (value < 0) return "Unlimited";
  return `${value} days`;
}

export function priceLabel(plan: PlanCard, annual: boolean): {
  primary: string;
  secondary: string | null;
} {
  if (plan.price_monthly_usd === null) {
    return { primary: "Custom", secondary: null };
  }
  const monthly = plan.price_monthly_usd;
  if (monthly === 0) {
    return { primary: "$0", secondary: "Free forever" };
  }
  if (annual) {
    const annualTotal = Math.round(monthly * 12 * 0.8);
    const annualMonthly = Math.round(annualTotal / 12);
    return {
      primary: `$${String(annualMonthly)}`,
      secondary: `Billed $${String(annualTotal)}/year (save 20%)`,
    };
  }
  return { primary: `$${String(monthly)}`, secondary: "per month" };
}

export function planCtaCopy(tier: BillingTier): {
  label: string;
  to: string;
} {
  switch (tier) {
    case "free":
      return { label: "Start free", to: "/signup" };
    case "enterprise":
      return { label: "Contact us", to: "/help#contact" };
    default:
      return { label: "Start free, upgrade later", to: "/signup" };
  }
}
