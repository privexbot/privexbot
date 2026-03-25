/**
 * Performance Stats Cards Component
 *
 * WHY: Display key performance metrics
 * HOW: 4 stat cards with icons and values
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare,
  Users,
  Clock,
  ThumbsUp,
} from "lucide-react";
import type { PerformanceMetrics } from "@/types/analytics";
import { formatNumber, formatResponseTime, formatPercentage } from "@/types/analytics";

interface PerformanceStatsCardsProps {
  metrics: PerformanceMetrics | null;
  isLoading: boolean;
}

export function PerformanceStatsCards({
  metrics,
  isLoading,
}: PerformanceStatsCardsProps) {
  const cards = [
    {
      title: "Conversations",
      value: metrics?.total_conversations ?? 0,
      formatted: formatNumber(metrics?.total_conversations ?? 0),
      subtitle: `${formatNumber(metrics?.total_messages ?? 0)} messages`,
      icon: MessageSquare,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      title: "Unique Visitors",
      value: metrics?.unique_visitors ?? 0,
      formatted: formatNumber(metrics?.unique_visitors ?? 0),
      subtitle: `${(metrics?.avg_messages_per_session ?? 0).toFixed(1)} avg msgs/session`,
      icon: Users,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
    },
    {
      title: "Avg Response Time",
      value: metrics?.avg_response_time_ms ?? 0,
      formatted: formatResponseTime(metrics?.avg_response_time_ms ?? 0),
      subtitle: `${formatPercentage(metrics?.error_rate ?? 0)} error rate`,
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-900/20",
    },
    {
      title: "Satisfaction Rate",
      value: metrics?.satisfaction_rate ?? 0,
      formatted: formatPercentage(metrics?.satisfaction_rate ?? 0),
      subtitle: `${metrics?.positive_feedback ?? 0} positive, ${metrics?.negative_feedback ?? 0} negative`,
      icon: ThumbsUp,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-900/20",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
