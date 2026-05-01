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
  kb_documents: "Knowledge base documents",
  messages_per_month: "Messages / month",
  api_calls_per_month: "API calls / month",
  team_members: "Team members",
};

export const RESOURCE_ORDER: (keyof BillingLimits)[] = [
  "chatbots",
  "chatflows",
  "kb_documents",
  "messages_per_month",
  "api_calls_per_month",
  "team_members",
];

export function formatLimit(value: number): string {
  if (value < 0) return "Unlimited";
  if (value >= 1000) return value.toLocaleString();
  return String(value);
}

export function planFeatureBullets(limits: BillingLimits): string[] {
  return RESOURCE_ORDER.map(
    (key) => `${formatLimit(limits[key])} ${RESOURCE_LABELS[key]}`,
  );
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
      return { label: "Contact us", to: "/help" };
    default:
      return { label: "Start free, upgrade later", to: "/signup" };
  }
}
