/**
 * Analytics Type Definitions
 *
 * WHY: Type-safe analytics data for performance and cost metrics
 * HOW: TypeScript interfaces matching backend response schema
 */

/**
 * Analytics scope (workspace or organization level)
 */
export type AnalyticsScope = "workspace" | "organization";

/**
 * Time range options for analytics
 */
export type AnalyticsTimeRange = 7 | 30 | 90;

/**
 * Analytics query filters
 */
export interface AnalyticsFilters {
  scope: AnalyticsScope;
  workspace_id?: string;
  organization_id?: string;
  days: AnalyticsTimeRange;
}

/**
 * Chatbot performance metrics
 */
export interface PerformanceMetrics {
  total_conversations: number;
  total_messages: number;
  unique_visitors: number;
  avg_messages_per_session: number;
  avg_response_time_ms: number;
  satisfaction_rate: number;
  positive_feedback: number;
  negative_feedback: number;
  error_rate: number;
}

/**
 * Token usage and cost metrics
 */
export interface CostUsageMetrics {
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  api_calls: number;
  avg_tokens_per_message: number;
}

/**
 * Daily trend data point for charts
 */
export interface DailyTrend {
  date: string; // ISO date (YYYY-MM-DD)
  conversations: number;
  messages: number;
  tokens: number;
  cost_usd: number;
}

/**
 * Per-chatbot performance breakdown
 */
export interface ChatbotBreakdown {
  chatbot_id: string;
  chatbot_name: string;
  bot_type: "chatbot" | "chatflow";
  conversations: number;
  messages: number;
  tokens: number;
  satisfaction_rate: number;
}

/**
 * Complete aggregated analytics response
 */
export interface AggregatedAnalytics {
  scope: AnalyticsScope;
  scope_id: string;
  scope_name: string;
  period_days: number;
  performance: PerformanceMetrics;
  cost_usage: CostUsageMetrics;
  daily_trends: DailyTrend[];
  chatbot_breakdown: ChatbotBreakdown[];
}

/**
 * Chart color scheme for consistent styling
 */
export const CHART_COLORS = {
  primary: "#3b82f6",
  secondary: "#8b5cf6",
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
  muted: "#6b7280",
  // For multi-series charts
  series: [
    "#3b82f6", // blue
    "#8b5cf6", // purple
    "#22c55e", // green
    "#f59e0b", // amber
    "#ef4444", // red
    "#06b6d4", // cyan
  ],
} as const;

/**
 * Format numbers for display
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercentage(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Format milliseconds to readable time
 */
export function formatResponseTime(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}
