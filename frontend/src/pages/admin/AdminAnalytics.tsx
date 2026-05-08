/**
 * Admin Analytics Page - Platform-wide analytics for staff backoffice
 *
 * WHY: Provide cross-tenant analytics visibility to staff users
 * HOW: Uses admin API to fetch platform-wide metrics, reuses shared analytics components
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BarChart3,
  MessageSquare,
  Users,
  Clock,
  ThumbsUp,
  Coins,
  Zap,
  Activity,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/api/admin";
import type { BusinessAnalytics } from "@/api/admin";
import { TrendDisplay } from "@/components/analytics/TrendDisplay";
import { ChatbotPerformanceTable } from "@/components/analytics/ChatbotPerformanceTable";
import { FeedbackSummary } from "@/components/analytics/FeedbackSummary";
import type { AggregatedAnalytics, AnalyticsTimeRange } from "@/types/analytics";
import { cn } from "@/lib/utils";

// ========================================
// UNIFIED STATS CARD COMPONENT
// ========================================

interface StatItem {
  icon: React.ElementType;
  title: string;
  value: string | number;
  subtitle: string;
  trend?: number;
}

function UnifiedStatsCard({ items, isLoading }: { items: StatItem[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={cn(
                  "flex-1 p-6",
                  i < 4 && "border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-gray-700"
                )}
              >
                <div className="flex items-center gap-4">
                  <Skeleton className="h-5 w-5 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row">
            {items.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={index}
                  className={cn(
                    "flex-1 p-6",
                    index < items.length - 1 &&
                      "border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-gray-700"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope truncate">
                        {item.title}
                      </p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-manrope">
                          {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
                        </p>
                        {item.trend !== undefined && (
                          <span
                            className={cn(
                              "inline-flex items-center text-xs font-medium font-manrope",
                              item.trend >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            )}
                          >
                            {item.trend >= 0 ? (
                              <TrendingUp className="h-3 w-3 mr-0.5" />
                            ) : (
                              <TrendingDown className="h-3 w-3 mr-0.5" />
                            )}
                            {Math.abs(item.trend).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ========================================
// COST STATS SECTION
// ========================================

function CostStatsSection({
  analytics,
  isLoading,
}: {
  analytics: AggregatedAnalytics | undefined;
  isLoading: boolean;
}) {
  const items: StatItem[] = [
    {
      icon: Coins,
      title: "Total Tokens",
      value: analytics?.cost_usage?.total_tokens?.toLocaleString() || "0",
      subtitle: "Prompt + Completion",
    },
    {
      icon: Zap,
      title: "Estimated Cost",
      value: `$${(analytics?.cost_usage?.estimated_cost_usd || 0).toFixed(2)}`,
      subtitle: "Based on usage",
    },
    {
      icon: Activity,
      title: "API Calls",
      value: analytics?.cost_usage?.api_calls || 0,
      subtitle: "Total requests",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="grid grid-cols-1 sm:grid-cols-3 gap-4"
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <Card key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
            <CardContent className="p-6">
              <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400 mb-3" />
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                {item.title}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-manrope mt-1">
                {item.value}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope mt-1">
                {item.subtitle}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </motion.div>
  );
}

// ========================================
// EMPTY STATE
// ========================================

function EmptyState({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16"
    >
      <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
        <BarChart3 className="h-8 w-8 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope mb-2">
        No Analytics Data
      </h3>
      <p className="text-gray-600 dark:text-gray-400 font-manrope max-w-md mx-auto">
        {message}
      </p>
    </motion.div>
  );
}

// ========================================
// MAIN COMPONENT
// ========================================

// ========================================
// BUSINESS METRICS SECTION
// ========================================
//
// Sibling to the existing performance/cost dashboard. Surfaces revenue
// and unit-economics: MRR, ARR, active orgs by tier, weekly conversion
// cohorts, soft-degrade hits, top-N orgs by usage, and a churn
// placeholder. Read-only; data from `/admin/analytics/business`.

function BusinessSection() {
  const { data, isLoading, error, refetch } = useQuery<BusinessAnalytics>({
    queryKey: ["admin-analytics-business"],
    queryFn: () => adminApi.getBusinessAnalytics(),
    staleTime: 60_000,
    retry: 1,
  });

  if (error) {
    return (
      <Card className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200 font-manrope">
              Failed to load business analytics
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 font-manrope">
              {error instanceof Error ? error.message : "Please try again"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const tierColor: Record<string, string> = {
    starter: "bg-blue-500 dark:bg-blue-400",
    pro: "bg-purple-500 dark:bg-purple-400",
    enterprise: "bg-amber-500 dark:bg-amber-400",
    free: "bg-gray-400 dark:bg-gray-500",
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope">
        Business
      </h2>

      {/* MRR / ARR top-line */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-manrope">
              MRR
            </p>
            <p className="text-3xl font-semibold text-gray-900 dark:text-gray-50 font-manrope mt-1">
              ${data.mrr.mrr_usd.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope mt-1">
              {data.mrr.total_active_paid_orgs} active paid org
              {data.mrr.total_active_paid_orgs === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-manrope">
              ARR (projected)
            </p>
            <p className="text-3xl font-semibold text-gray-900 dark:text-gray-50 font-manrope mt-1">
              ${data.mrr.arr_usd.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope mt-1">
              MRR × 12
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-manrope">
              Soft-degrade ≥120%
            </p>
            <p className="text-3xl font-semibold text-gray-900 dark:text-gray-50 font-manrope mt-1">
              {data.soft_degrade.orgs_at_or_over_120_percent}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope mt-1">
              Orgs about to lose service
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active orgs by tier */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50 font-manrope">
              Active orgs by tier
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
              Last {data.active_by_tier.days} days
            </span>
          </div>
          <div className="space-y-2">
            {Object.entries(data.active_by_tier.by_tier).map(([tier, count]) => (
              <div key={tier} className="flex items-center gap-3">
                <span className="w-20 text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300 font-manrope">
                  {tier}
                </span>
                <div className="flex-1 h-2 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div
                    className={cn("h-full", tierColor[tier] ?? tierColor.free)}
                    style={{
                      width: `${Math.min(
                        100,
                        (count / Math.max(1, data.active_by_tier.total_active_orgs)) * 100,
                      )}%`,
                    }}
                  />
                </div>
                <span className="w-16 text-right text-sm font-medium text-gray-900 dark:text-gray-50 font-manrope">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Conversion-rate cohorts */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50 font-manrope mb-3">
            Free → paid conversion (weekly cohorts, last {data.conversion.weeks} weeks)
          </h3>
          {data.conversion.series.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
              No signups in the last {data.conversion.weeks} weeks.
            </p>
          ) : (
            <div className="space-y-1.5">
              {data.conversion.series.map((row) => (
                <div key={row.week} className="flex items-center gap-3 text-xs font-manrope">
                  <span className="w-20 text-gray-500 dark:text-gray-400">{row.week}</span>
                  <span className="w-24 text-gray-700 dark:text-gray-300">
                    {row.signups} signup{row.signups === 1 ? "" : "s"}
                  </span>
                  <span className="w-24 text-gray-700 dark:text-gray-300">
                    {row.converted} converted
                  </span>
                  <span
                    className={cn(
                      "font-semibold",
                      row.rate >= 0.1
                        ? "text-green-600 dark:text-green-400"
                        : "text-gray-700 dark:text-gray-300",
                    )}
                  >
                    {(row.rate * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top N orgs by usage */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50 font-manrope mb-3">
            Top {data.top_orgs.n} orgs by usage (under-priced power users live here)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-manrope">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 pr-3">Org</th>
                  <th className="pb-2 pr-3">Tier</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 text-right">Messages this month</th>
                </tr>
              </thead>
              <tbody>
                {data.top_orgs.top.map((row) => (
                  <tr
                    key={row.org_id}
                    className="border-b border-gray-100 dark:border-gray-700/50 last:border-b-0"
                  >
                    <td className="py-2 pr-3 text-gray-900 dark:text-gray-50">{row.name}</td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300 capitalize">
                      {row.tier}
                    </td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300 capitalize">
                      {row.status}
                    </td>
                    <td className="py-2 text-right text-gray-900 dark:text-gray-50 tabular-nums">
                      {row.messages_this_month.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Churn placeholder */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50 font-manrope mb-1">
            Churn (last {data.churn.days} days)
          </h3>
          {data.churn.available ? (
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-50 font-manrope">
              {data.churn.downgrades} downgrade{data.churn.downgrades === 1 ? "" : "s"}
            </p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
              {data.churn.message ?? "Not yet available"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


export function AdminAnalytics() {
  const [days, setDays] = useState<AnalyticsTimeRange>(7);

  const {
    data: analytics,
    isLoading,
    error,
    refetch,
  } = useQuery<AggregatedAnalytics>({
    queryKey: ["admin-analytics", days],
    queryFn: () => adminApi.getPlatformAnalytics(days),
    staleTime: 60000,
    retry: 1,
  });

  // Prepare performance stats
  const performanceStats: StatItem[] = useMemo(() => {
    const perf = analytics?.performance;
    return [
      {
        icon: MessageSquare,
        title: "Conversations",
        value: perf?.total_conversations || 0,
        subtitle: `${days} day period`,
      },
      {
        icon: Users,
        title: "Messages",
        value: perf?.total_messages || 0,
        subtitle: "Total exchanged",
      },
      {
        icon: Clock,
        title: "Avg Response",
        value: `${((perf?.avg_response_time_ms || 0) / 1000).toFixed(1)}s`,
        subtitle: "Response time",
      },
      {
        icon: ThumbsUp,
        title: "Satisfaction",
        value: `${((perf?.satisfaction_rate || 0) * 100).toFixed(0)}%`,
        subtitle: "Positive feedback",
      },
    ];
  }, [analytics, days]);

  // Format functions for trends
  const formatTokens = (v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return v.toLocaleString();
  };

  const formatCost = (v: number) => `$${v.toFixed(2)}`;

  const hasData = analytics && analytics.performance.total_conversations > 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 font-manrope">
            Platform Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 font-manrope">
            Cross-tenant performance metrics across all workspaces
          </p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          {/* Time Range Selector */}
          <Select value={days.toString()} onValueChange={(v) => setDays(Number(v) as AnalyticsTimeRange)}>
            <SelectTrigger className="w-full sm:w-32 h-10 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh Button */}
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
            className="font-manrope rounded-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            <span className="hidden sm:inline ml-2">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-200 font-manrope">
                  Failed to load analytics
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 font-manrope">
                  {error instanceof Error ? error.message : "Please try again"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="text-red-700 dark:text-red-300 border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Empty State */}
      {!isLoading && !error && !hasData && (
        <EmptyState message="No chatbot activity recorded yet. Analytics will appear once users start interacting with deployed chatbots." />
      )}

      {/* Business metrics — MRR, conversion, churn, etc. Independent
          query so it loads even when the bot-performance dashboard is
          empty (useful pre-launch when there's no traffic yet). */}
      <BusinessSection />

      {/* Performance Stats Cards */}
      <UnifiedStatsCard items={performanceStats} isLoading={isLoading} />

      {/* Cost & Usage Stats */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope mb-4">
          Cost & Usage
        </h2>
        <CostStatsSection analytics={analytics} isLoading={isLoading} />
      </div>

      {/* Trend Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TrendDisplay
          data={analytics?.daily_trends || []}
          title="Conversations & Messages"
          primaryKey="conversations"
          secondaryKey="messages"
          primaryLabel="Conversations"
          secondaryLabel="Messages"
          primaryColor="bg-blue-500 dark:bg-blue-400"
          secondaryColor="bg-purple-500 dark:bg-purple-400"
          isLoading={isLoading}
        />
        <TrendDisplay
          data={analytics?.daily_trends || []}
          title="Token Usage & Cost"
          primaryKey="tokens"
          secondaryKey="cost_usd"
          primaryLabel="Tokens"
          secondaryLabel="Cost"
          primaryColor="bg-green-500 dark:bg-green-400"
          secondaryColor="bg-amber-500 dark:bg-amber-400"
          formatValue={formatTokens}
          formatSecondaryValue={formatCost}
          isLoading={isLoading}
        />
      </div>

      {/* Bottom Row: Table and Feedback */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChatbotPerformanceTable
            data={analytics?.chatbot_breakdown || []}
            isLoading={isLoading}
          />
        </div>
        <div>
          <FeedbackSummary
            metrics={analytics?.performance || null}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
