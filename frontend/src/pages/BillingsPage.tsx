/**
 * Billings Page — plan tier + live usage + manual upgrade.
 *
 * Backed by `backend/src/app/api/v1/routes/billing.py`. Self-serve checkout
 * (Stripe) is not yet wired; the upgrade button is staff-only and points
 * other users to support.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  billingApi,
  type BillingTier,
  type PlanBreakdownEntry,
} from "@/api/billing";
import { handleApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const RESOURCE_LABELS: Record<string, string> = {
  chatbots: "Chatbots",
  chatflows: "Chatflows",
  kb_documents: "KB documents",
  messages_per_month: "Messages this month",
  api_calls_per_month: "API calls this month",
  team_members: "Team members",
};

function fmt(n: number) {
  return n.toLocaleString();
}

function UsageRow({
  label,
  entry,
}: {
  label: string;
  entry: PlanBreakdownEntry;
}) {
  const limitText = entry.unlimited ? "Unlimited" : fmt(entry.limit);
  const pct = entry.percent_used ?? 0;
  const danger = pct >= 90;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700 dark:text-gray-300 font-manrope">
          {label}
        </span>
        <span
          className={cn(
            "font-mono text-xs",
            danger ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400",
          )}
        >
          {fmt(entry.usage)} / {limitText}
        </span>
      </div>
      {!entry.unlimited && (
        <Progress
          value={pct}
          className={cn(
            "h-1.5",
            danger && "[&>div]:bg-red-500",
          )}
        />
      )}
    </div>
  );
}

export function BillingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<BillingTier | null>(null);

  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ["billing-plan"],
    queryFn: () => billingApi.getPlan(),
  });

  const { data: tiers, isLoading: tiersLoading } = useQuery({
    queryKey: ["billing-plans"],
    queryFn: () => billingApi.listPlans(),
  });

  const upgradeMutation = useMutation({
    mutationFn: (tier: BillingTier) => billingApi.upgrade(tier),
    onSuccess: (next) => {
      queryClient.invalidateQueries({ queryKey: ["billing-plan"] });
      setUpgradeOpen(false);
      setSelectedTier(null);
      toast({
        title: "Plan updated",
        description: `Now on the ${next.label} plan.`,
      });
    },
    onError: (err: unknown) => {
      // 402 → friendly contact-support copy comes back from the backend.
      toast({
        title: "Could not change plan",
        description: handleApiError(err),
        variant: "destructive",
      });
    },
  });

  return (
    <DashboardLayout>
      <div className="py-6 sm:py-8 px-4 sm:px-6 lg:px-8 xl:px-12 space-y-6 sm:space-y-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="-ml-2 text-gray-600 dark:text-gray-400"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="flex items-start gap-4">
          <CreditCard className="h-6 w-6 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold font-manrope">Billing &amp; Usage</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Track your plan limits and usage. Self-serve Stripe checkout is on the
              roadmap — for now, contact{" "}
              <a
                href="mailto:privexbot@gmail.com"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                privexbot@gmail.com
              </a>{" "}
              to upgrade.
            </p>
          </div>
        </div>

        {planLoading || !plan ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  Current plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-3xl font-semibold font-manrope">{plan.label}</p>
                  <Badge
                    variant={plan.status === "active" ? "secondary" : "outline"}
                    className="mt-2"
                  >
                    {plan.status}
                  </Badge>
                </div>
                {plan.trial_ends_at && plan.status === "trial" && (
                  <p className="text-xs text-gray-500">
                    Trial ends {new Date(plan.trial_ends_at).toLocaleDateString()}
                  </p>
                )}
                <Button
                  className="w-full"
                  onClick={() => setUpgradeOpen(true)}
                  disabled={tiersLoading}
                >
                  Change plan
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Usage</CardTitle>
                <CardDescription>
                  Live counts across every workspace in this organization.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(plan.breakdown).map(([key, entry]) => (
                  <UsageRow
                    key={key}
                    label={RESOURCE_LABELS[key] ?? key}
                    entry={entry as PlanBreakdownEntry}
                  />
                ))}
                {/* Account-level cap (counted across every org the user
                    owns, not just this one). Visually separated so it
                    doesn't look like a per-org metric. */}
                {plan.account?.owned_orgs && (
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-1">
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-manrope">
                      Account-level
                    </p>
                    <UsageRow
                      label="Organizations you own"
                      entry={plan.account.owned_orgs}
                    />
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-manrope leading-snug">
                      Counted across every organization where you're
                      the owner. The limit follows your highest-tier
                      owned org.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choose a plan</DialogTitle>
            <DialogDescription>
              Pick a tier to switch to. Self-serve checkout is on the roadmap;
              today, only staff accounts can complete the change. Other users
              will receive a "contact support" message.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
            {(tiers ?? []).map((t) => {
              const isCurrent = plan?.tier === t.tier;
              const isSelected = selectedTier === t.tier;
              return (
                <button
                  key={t.tier}
                  type="button"
                  onClick={() => setSelectedTier(t.tier)}
                  className={cn(
                    "text-left p-4 border rounded-lg transition-colors",
                    isSelected
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300",
                    isCurrent && "ring-2 ring-emerald-500/30",
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold font-manrope">{t.label}</p>
                    {isCurrent && (
                      <Badge variant="secondary">Current</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{t.tagline}</p>
                  <p className="text-sm font-medium">
                    {t.price_monthly_usd === null
                      ? "Custom"
                      : t.price_monthly_usd === 0
                        ? "Free"
                        : `$${t.price_monthly_usd}/mo`}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    {Object.entries(t.limits).map(([k, v]) => (
                      <li key={k} className="flex items-center gap-1.5">
                        <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span>
                          {RESOURCE_LABELS[k] ?? k}: {v < 0 ? "unlimited" : fmt(v)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          {selectedTier && plan?.tier === selectedTier && (
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              You're already on this plan.
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedTier && upgradeMutation.mutate(selectedTier)}
              disabled={
                !selectedTier ||
                selectedTier === plan?.tier ||
                upgradeMutation.isPending
              }
            >
              {upgradeMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Switch plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
