/**
 * Cost & Usage Stats Cards Component
 *
 * WHY: Display token usage and cost metrics
 * HOW: 3 stat cards with icons and values
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Coins, DollarSign, Zap } from "lucide-react";
import type { CostUsageMetrics } from "@/types/analytics";
import { formatNumber, formatCurrency } from "@/types/analytics";

interface CostUsageStatsCardsProps {
  metrics: CostUsageMetrics | null;
  isLoading: boolean;
}

export function CostUsageStatsCards({
  metrics,
  isLoading,
}: CostUsageStatsCardsProps) {
  const cards = [
    {
      title: "Total Tokens",
      value: metrics?.total_tokens ?? 0,
      formatted: formatNumber(metrics?.total_tokens ?? 0),
      subtitle: `${formatNumber(metrics?.total_prompt_tokens ?? 0)} prompt + ${formatNumber(metrics?.total_completion_tokens ?? 0)} completion`,
      icon: Coins,
      color: "text-cyan-600 dark:text-cyan-400",
      bgColor: "bg-cyan-50 dark:bg-cyan-900/20",
    },
    {
      title: "Estimated Cost",
      value: metrics?.estimated_cost_usd ?? 0,
      formatted: formatCurrency(metrics?.estimated_cost_usd ?? 0),
      subtitle: `${formatNumber(Math.round(metrics?.avg_tokens_per_message ?? 0))} avg tokens/msg`,
      icon: DollarSign,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
    },
    {
      title: "API Calls",
      value: metrics?.api_calls ?? 0,
      formatted: formatNumber(metrics?.api_calls ?? 0),
      subtitle: "AI model invocations",
      icon: Zap,
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-50 dark:bg-orange-900/20",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-full ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {card.formatted}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {card.subtitle}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
