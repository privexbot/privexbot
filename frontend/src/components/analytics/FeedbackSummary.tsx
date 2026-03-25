/**
 * Feedback Summary Component
 *
 * WHY: Display positive/negative feedback summary
 * HOW: Progress bar with counts
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ThumbsUp, ThumbsDown, MessageCircle } from "lucide-react";
import type { PerformanceMetrics } from "@/types/analytics";
import { formatPercentage } from "@/types/analytics";

interface FeedbackSummaryProps {
  metrics: PerformanceMetrics | null;
  isLoading: boolean;
}

export function FeedbackSummary({ metrics, isLoading }: FeedbackSummaryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            User Feedback
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[150px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const positive = metrics?.positive_feedback ?? 0;
  const negative = metrics?.negative_feedback ?? 0;
  const total = positive + negative;
  const satisfactionRate = metrics?.satisfaction_rate ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
          User Feedback
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
            <MessageCircle className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-sm">No feedback collected yet</p>
            <p className="text-xs mt-1">
              Feedback will appear here once users rate responses
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overall satisfaction */}
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 dark:text-white">
                {formatPercentage(satisfactionRate)}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Overall satisfaction rate
              </p>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Feedback distribution
                </span>
                <span className="text-gray-500 dark:text-gray-500">
                  {total} total
                </span>
              </div>
              <div className="relative h-4 w-full rounded-full overflow-hidden bg-red-100 dark:bg-red-900/30">
                <div
                  className="absolute left-0 top-0 h-full bg-green-500 dark:bg-green-600 transition-all duration-500"
                  style={{ width: `${satisfactionRate * 100}%` }}
                />
              </div>
            </div>

            {/* Counts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/40">
                  <ThumbsUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-xl font-semibold text-green-700 dark:text-green-400">
                    {positive}
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-500">
                    Positive
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/40">
                  <ThumbsDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <div className="text-xl font-semibold text-red-700 dark:text-red-400">
                    {negative}
                  </div>
                  <div className="text-xs text-red-600 dark:text-red-500">
                    Negative
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
