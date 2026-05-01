/**
 * Admin Organization Detail Page
 *
 * WHY: View detailed organization info for support
 * HOW: Display workspaces, members, plan + usage, and a staff-only path
 *      to change the subscription tier.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bot,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  Layers,
  Loader2,
  Mail,
  Shield,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { adminApi, type OrganizationDetail } from "@/api/admin";
import type {
  BillingLimits,
  BillingTier,
  PlanCard as PlanCardData,
  PlanStatus,
} from "@/api/billing";
import {
  RESOURCE_LABELS,
  RESOURCE_ORDER,
  formatLimit,
  priceLabel,
} from "@/lib/plans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const TIER_BADGE_CLASS: Record<BillingTier, string> = {
  free: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  starter:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  pro: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  enterprise:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export function AdminOrgDetail() {
  const { orgId } = useParams<{ orgId: string }>();
  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  const [plans, setPlans] = useState<PlanCardData[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      if (!orgId) return;
      try {
        setIsLoading(true);
        setError(null);
        // Org detail is required; plan + tiers are best-effort so a missing
        // billing endpoint doesn't blank the whole page.
        const orgPromise = adminApi.getOrganization(orgId);
        const planPromise = adminApi.getOrgPlan(orgId).catch(() => null);
        const plansPromise = adminApi.listPlans().catch(() => null);
        const [orgData, planData, plansData] = await Promise.all([
          orgPromise,
          planPromise,
          plansPromise,
        ]);
        setOrg(orgData);
        setPlanStatus(planData);
        setPlans(plansData);
      } catch (err) {
        console.error("Failed to fetch organization:", err);
        setError("Failed to load organization. It may not exist.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchAll();
  }, [orgId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-manrope">
            Loading organization...
          </p>
        </div>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="p-6">
          <Link
            to="/admin/organizations"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6 font-manrope"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Organizations
          </Link>
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm text-destructive font-manrope">
                {error || "Organization not found"}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const headerTier = (planStatus?.tier ?? org.subscription_tier ?? "free") as
    | BillingTier
    | string;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        {/* Back Link */}
        <Link
          to="/admin/organizations"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-manrope"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Organizations
        </Link>

        {/* Header */}
        <div className="flex items-start gap-4">
          <Building2 className="h-8 w-8 text-gray-600 dark:text-gray-400 flex-shrink-0" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-manrope">
              {org.name}
            </h1>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400 font-manrope">
              {org.billing_email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {org.billing_email}
                </span>
              )}
              {org.created_at && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Created {new Date(org.created_at).toLocaleDateString()}
                </span>
              )}
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium font-manrope capitalize",
                  TIER_BADGE_CLASS[headerTier as BillingTier] ??
                    TIER_BADGE_CLASS.free,
                )}
              >
                {planStatus?.label ?? headerTier}
              </span>
            </div>
          </div>
        </div>

        {/* Plan + usage + change-tier flow */}
        <PlanCard
          orgId={orgId!}
          plans={plans}
          planStatus={planStatus}
          onUpdated={(next) => {
            setPlanStatus(next);
            setOrg((o) => (o ? { ...o, subscription_tier: next.tier } : o));
          }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Workspaces */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2 font-manrope">
              <Layers className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              Workspaces ({org.workspaces.length})
            </h2>
            {org.workspaces.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
                No workspaces
              </p>
            ) : (
              <div className="space-y-3">
                {org.workspaces.map((ws) => (
                  <div
                    key={ws.id}
                    className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 font-manrope">
                        {ws.name}
                        {ws.is_default && (
                          <span className="ml-2 text-xs text-gray-500 font-manrope">
                            (default)
                          </span>
                        )}
                      </h3>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400 font-manrope">
                      <span className="flex items-center gap-1">
                        <Bot className="h-3 w-3" />
                        {ws.chatbot_count} chatbots
                      </span>
                      <span className="flex items-center gap-1">
                        <Workflow className="h-3 w-3" />
                        {ws.chatflow_count} chatflows
                      </span>
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {ws.kb_count} KBs
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Members */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2 font-manrope">
              <Users className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              Members ({org.members.length})
            </h2>
            {org.members.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
                No members
              </p>
            ) : (
              <div className="space-y-3">
                {org.members.map((member) => (
                  <Link
                    key={member.user_id}
                    to={`/admin/users/${member.user_id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300 font-manrope">
                          {member.username[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100 font-manrope">
                          {member.username}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 font-manrope">
                          <span
                            className={cn(
                              "flex items-center gap-1",
                              member.role === "owner" &&
                                "text-amber-600 dark:text-amber-400",
                            )}
                          >
                            <Shield className="h-3 w-3" />
                            {member.role}
                          </span>
                          {!member.is_active && (
                            <span className="text-red-500">(inactive)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  orgId,
  plans,
  planStatus,
  onUpdated,
}: {
  orgId: string;
  plans: PlanCardData[] | null;
  planStatus: PlanStatus | null;
  onUpdated: (next: PlanStatus) => void;
}) {
  const { toast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingTier, setPendingTier] = useState<BillingTier | null>(null);
  const [saving, setSaving] = useState(false);

  // Resources whose current usage would exceed the limit on the *pending* tier.
  // Surfaces the downgrade trade-off before the staffer commits.
  const overQuotaAfter = useMemo(() => {
    if (!planStatus || !pendingTier || !plans) return [];
    const pending = plans.find((p) => p.tier === pendingTier);
    if (!pending) return [];
    return RESOURCE_ORDER.filter((key) => {
      const limit = pending.limits[key];
      if (limit < 0) return false; // unlimited on the new tier
      return planStatus.usage[
        usageKeyFor(key)
      ] > limit;
    }).map((key) => ({
      key,
      label: RESOURCE_LABELS[key],
      currentUsage: planStatus.usage[usageKeyFor(key)],
      newLimit: pending.limits[key],
    }));
  }, [planStatus, pendingTier, plans]);

  const applyTier = async (tier: BillingTier) => {
    setSaving(true);
    try {
      const next = await adminApi.upgradeOrgPlan(orgId, tier);
      onUpdated(next);
      toast({
        title: "Plan updated",
        description: `Tier set to ${next.label}.`,
      });
      setPickerOpen(false);
      setPendingTier(null);
    } catch (err) {
      toast({
        title: "Couldn't update plan",
        description:
          err instanceof Error ? err.message : "Unknown error.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 font-manrope">
            <Sparkles className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            Plan &amp; usage
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope mt-1">
            Manually change this org&apos;s subscription tier. No payment is
            captured — Stripe self-serve checkout is not yet wired.
          </p>
        </div>
        <Button
          onClick={() => {
            setPendingTier(null);
            setPickerOpen(true);
          }}
          disabled={!plans}
          className="font-manrope bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
        >
          Change plan
        </Button>
      </div>

      {!planStatus ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 font-manrope">
          Plan + usage data is unavailable for this org. (Backend may be
          unreachable; the change-plan action still works.)
        </p>
      ) : (
        <PlanSummary status={planStatus} />
      )}

      <Dialog
        open={pickerOpen}
        onOpenChange={(open) => {
          setPickerOpen(open);
          if (!open) setPendingTier(null);
        }}
      >
        <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="font-manrope">Change plan tier</DialogTitle>
            <DialogDescription className="font-manrope">
              Select a tier. Changes take effect immediately and the org&apos;s
              limits update.
            </DialogDescription>
          </DialogHeader>

          {plans ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              {plans.map((plan) => (
                <TierOption
                  key={plan.tier}
                  plan={plan}
                  isCurrent={planStatus?.tier === plan.tier}
                  isSelected={pendingTier === plan.tier}
                  onSelect={() => setPendingTier(plan.tier)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 font-manrope mt-2">
              Loading tiers…
            </p>
          )}

          {pendingTier && pendingTier !== planStatus?.tier && overQuotaAfter.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-800 dark:text-amber-200 font-manrope">
                  <p className="font-semibold mb-1">
                    Current usage exceeds the new tier&apos;s limits:
                  </p>
                  <ul className="space-y-0.5 list-disc list-inside">
                    {overQuotaAfter.map((row) => (
                      <li key={row.key}>
                        {row.label}: {row.currentUsage} in use, new limit{" "}
                        {formatLimit(row.newLimit)}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2">
                    Existing resources are not deleted; new creates beyond the
                    new limit will be blocked.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setPickerOpen(false);
                setPendingTier(null);
              }}
              className="font-manrope"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pendingTier) void applyTier(pendingTier);
              }}
              disabled={
                saving ||
                !pendingTier ||
                pendingTier === planStatus?.tier
              }
              className="font-manrope bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Applying…
                </>
              ) : (
                "Apply tier"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlanSummary({ status }: { status: PlanStatus }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm font-manrope">
        <Badge
          className={cn(
            "capitalize",
            TIER_BADGE_CLASS[status.tier] ?? TIER_BADGE_CLASS.free,
          )}
        >
          {status.label}
        </Badge>
        <span className="text-gray-600 dark:text-gray-400">
          Status:{" "}
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {status.status}
          </span>
        </span>
        {status.trial_ends_at && (
          <span className="text-gray-600 dark:text-gray-400">
            Trial ends:{" "}
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {new Date(status.trial_ends_at).toLocaleDateString()}
            </span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {RESOURCE_ORDER.map((key) => {
          const entry = status.breakdown[key];
          return <UsageRow key={key} resource={key} entry={entry} />;
        })}
      </div>
    </div>
  );
}

function UsageRow({
  resource,
  entry,
}: {
  resource: keyof BillingLimits;
  entry: PlanStatus["breakdown"][keyof BillingLimits];
}) {
  const isUnlimited = entry.unlimited;
  const percent = isUnlimited ? 0 : entry.percent_used ?? 0;
  const bar = isUnlimited ? 100 : Math.min(100, percent);
  const danger = !isUnlimited && percent >= 90;
  const warn = !isUnlimited && percent >= 75 && percent < 90;
  const barColor = isUnlimited
    ? "bg-emerald-500"
    : danger
      ? "bg-red-500"
      : warn
        ? "bg-amber-500"
        : "bg-blue-500";

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 font-manrope">
          {RESOURCE_LABELS[resource]}
        </span>
        <span className="text-xs text-gray-600 dark:text-gray-400 font-manrope">
          {isUnlimited
            ? `${entry.usage.toLocaleString()} (unlimited)`
            : `${entry.usage.toLocaleString()} / ${formatLimit(entry.limit)}`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className={cn("h-full transition-all", barColor)}
          style={{ width: `${String(bar)}%` }}
        />
      </div>
      {danger && (
        <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 font-manrope">
          ≥90% used — consider upgrading.
        </p>
      )}
    </div>
  );
}

function TierOption({
  plan,
  isCurrent,
  isSelected,
  onSelect,
}: {
  plan: PlanCardData;
  isCurrent: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { primary, secondary } = priceLabel(plan, false);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "text-left rounded-xl border p-4 transition-colors font-manrope",
        "bg-white dark:bg-gray-800",
        isSelected
          ? "border-blue-500 ring-2 ring-blue-500/30"
          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600",
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {plan.label}
        </span>
        {isCurrent && (
          <Badge variant="outline" className="text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Current
          </Badge>
        )}
      </div>
      <div className="mb-3">
        <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {primary}
        </span>
        {secondary && (
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
            {secondary}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
        {plan.tagline}
      </p>
      <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
        {RESOURCE_ORDER.map((key) => (
          <li key={key} className="flex items-center justify-between gap-3">
            <span className="text-gray-500 dark:text-gray-400">
              {RESOURCE_LABELS[key]}
            </span>
            <span className="font-medium">{formatLimit(plan.limits[key])}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}

/**
 * The PlanStatus.usage object uses string keys that match BillingLimits keys
 * for resource counts (chatbots, chatflows, kb_documents, team_members) but
 * uses month-bucketed names for messages / api_calls. Map limit-key →
 * usage-key so the over-quota check picks the right field.
 */
function usageKeyFor(
  key: keyof BillingLimits,
): keyof PlanStatus["usage"] {
  switch (key) {
    case "messages_per_month":
      return "messages_this_month";
    case "api_calls_per_month":
      return "api_calls_this_month";
    default:
      return key;
  }
}
