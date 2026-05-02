/**
 * Analytics Page
 *
 * Comprehensive analytics dashboard matching LeadsPage design patterns.
 * Uses CSS-based charts instead of recharts for React 19 compatibility.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
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
} from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspaceStore } from '@/store/workspace-store';
import { useApp } from '@/contexts/AppContext';
import { analyticsApi } from '@/api/analytics';
import { TrendDisplay } from '@/components/analytics/TrendDisplay';
import { ChatbotPerformanceTable } from '@/components/analytics/ChatbotPerformanceTable';
import { FeedbackSummary } from '@/components/analytics/FeedbackSummary';
import type { AggregatedAnalytics, AnalyticsScope, AnalyticsTimeRange } from '@/types/analytics';
import { cn } from '@/lib/utils';

// ========================================
// UNIFIED STATS CARD COMPONENT
// ========================================

interface StatItem {
  icon: React.ElementType;
  title: string;
  value: string | number;
  subtitle: string;
  trend?: number;
  trendLabel?: string;
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
                  'flex-1 p-6',
                  i < 4 && 'border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-gray-700'
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
                    'flex-1 p-6',
                    index < items.length - 1 &&
                      'border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-gray-700'
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
                          {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                        </p>
                        {item.trend !== undefined && (
                          <span
                            className={cn(
                              'inline-flex items-center text-xs font-medium font-manrope',
                              item.trend >= 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
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
      title: 'Total Tokens',
      value: analytics?.cost_usage?.total_tokens?.toLocaleString() || '0',
      subtitle: 'Prompt + Completion',
    },
    {
      icon: Zap,
      title: 'Estimated Cost',
      value: (() => {
        const cost = analytics?.cost_usage?.estimated_cost_usd || 0;
        // Tiny costs round to $0.00 which reads as "free" — show "<$0.01"
        // so usage with non-zero tokens is honest.
        if (cost > 0 && cost < 0.01) return '<$0.01';
        return `$${cost.toFixed(2)}`;
      })(),
      subtitle: 'Based on usage',
    },
    {
      icon: Activity,
      title: 'API Calls',
      value: analytics?.cost_usage?.api_calls || 0,
      subtitle: 'Total requests',
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

export function AnalyticsPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const { currentOrganization } = useApp();

  // State for filters
  const [scope, setScope] = useState<AnalyticsScope>('workspace');
  const [days, setDays] = useState<AnalyticsTimeRange>(7);

  // Determine IDs based on scope
  const workspaceId = currentWorkspace?.id;
  const organizationId = currentOrganization?.id;

  // Query for analytics data
  const {
    data: analytics,
    isLoading,
    error,
    refetch,
  } = useQuery<AggregatedAnalytics>({
    queryKey: ['analytics', scope, workspaceId, organizationId, days],
    queryFn: () =>
      analyticsApi.getAggregatedAnalytics({
        scope,
        workspace_id: scope === 'workspace' ? workspaceId : undefined,
        organization_id: scope === 'organization' ? organizationId : undefined,
        days,
      }),
    enabled:
      (scope === 'workspace' && !!workspaceId) ||
      (scope === 'organization' && !!organizationId),
    staleTime: 60000,
    retry: 1,
  });

  // Prepare performance stats
  const performanceStats: StatItem[] = useMemo(() => {
    const perf = analytics?.performance;
    return [
      {
        icon: MessageSquare,
        title: 'Conversations',
        value: perf?.total_conversations || 0,
        subtitle: `${days} day period`,
      },
      {
        icon: Users,
        title: 'Messages',
        value: perf?.total_messages || 0,
        subtitle: 'Total exchanged',
      },
      {
        icon: Clock,
        title: 'Avg Response',
        value: `${((perf?.avg_response_time_ms || 0) / 1000).toFixed(1)}s`,
        subtitle: 'Response time',
      },
      {
        icon: ThumbsUp,
        title: 'Satisfaction',
        value: `${((perf?.satisfaction_rate || 0) * 100).toFixed(0)}%`,
        subtitle: 'Positive feedback',
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

  // No workspace selected
  if (!workspaceId && !organizationId) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="py-6 sm:py-8 px-4 sm:px-6 lg:px-8 xl:px-12">
            <EmptyState message="Please select a workspace to view analytics data." />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="py-6 sm:py-8 px-4 sm:px-6 lg:px-8 xl:px-12 space-y-6 sm:space-y-8">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 font-manrope">
                Analytics
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1 font-manrope">
                {scope === 'workspace'
                  ? `Performance metrics for ${currentWorkspace?.name || 'workspace'}`
                  : `Organization-wide metrics for ${currentOrganization?.name || 'organization'}`}
              </p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              {/* Scope Selector */}
              <Select value={scope} onValueChange={(v) => setScope(v as AnalyticsScope)}>
                <SelectTrigger className="w-full sm:w-40 h-10 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope">
                  <SelectValue placeholder="Scope" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <SelectItem value="workspace">Workspace</SelectItem>
                  <SelectItem value="organization">Organization</SelectItem>
                </SelectContent>
              </Select>

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
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
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
                      {error instanceof Error ? error.message : 'Please try again'}
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
      </div>
    </DashboardLayout>
  );
}
