/**
 * TrendDisplay - Simple CSS-based bar chart for daily trends
 *
 * Replaces recharts to fix React 19 compatibility issues.
 * Uses CSS flexbox for bars with hover tooltips.
 */

import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TrendDataPoint {
  date: string;
  conversations: number;
  messages: number;
  tokens: number;
  cost_usd: number;
}

interface TrendDisplayProps {
  data: TrendDataPoint[];
  title: string;
  primaryKey: 'conversations' | 'messages' | 'tokens';
  secondaryKey?: 'messages' | 'tokens' | 'cost_usd';
  primaryLabel: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  formatValue?: (value: number) => string;
  formatSecondaryValue?: (value: number) => string;
  isLoading?: boolean;
}

export function TrendDisplay({
  data,
  title,
  primaryKey,
  secondaryKey,
  primaryLabel,
  secondaryLabel,
  primaryColor = 'bg-blue-500 dark:bg-blue-400',
  secondaryColor = 'bg-purple-500 dark:bg-purple-400',
  formatValue = (v) => v.toLocaleString(),
  formatSecondaryValue = (v) => v.toLocaleString(),
  isLoading = false,
}: TrendDisplayProps) {
  if (isLoading) {
    return (
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
            <div className="h-40 bg-gray-100 dark:bg-gray-700/50 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-manrope mb-4">
            {title}
          </h3>
          <div className="flex items-center justify-center h-40 text-gray-500 dark:text-gray-400 font-manrope text-sm">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get max values for scaling
  const maxPrimary = Math.max(...data.map((d) => d[primaryKey]), 1);
  const maxSecondary = secondaryKey
    ? Math.max(...data.map((d) => d[secondaryKey]), 1)
    : 1;

  // Calculate totals
  const totalPrimary = data.reduce((sum, d) => sum + d[primaryKey], 0);
  const totalSecondary = secondaryKey
    ? data.reduce((sum, d) => sum + d[secondaryKey], 0)
    : 0;

  return (
    <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-manrope">
            {title}
          </h3>
          <div className="flex items-center gap-4 text-xs font-manrope">
            <div className="flex items-center gap-1.5">
              <div className={cn('w-2 h-2 rounded-full', primaryColor)} />
              <span className="text-gray-600 dark:text-gray-400">{primaryLabel}</span>
            </div>
            {secondaryKey && secondaryLabel && (
              <div className="flex items-center gap-1.5">
                <div className={cn('w-2 h-2 rounded-full', secondaryColor)} />
                <span className="text-gray-600 dark:text-gray-400">{secondaryLabel}</span>
              </div>
            )}
          </div>
        </div>

        {/* Bar Chart */}
        <div className="space-y-2">
          <div className="flex items-end gap-1 h-32">
            {data.map((item, idx) => {
              const primaryHeight = (item[primaryKey] / maxPrimary) * 100;
              const secondaryHeight = secondaryKey
                ? (item[secondaryKey] / maxSecondary) * 100
                : 0;

              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center gap-0.5 group relative"
                >
                  {/* Tooltip */}
                  <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white px-2 py-1 rounded text-[10px] font-manrope whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                    <div>{format(parseISO(item.date), 'MMM d')}</div>
                    <div>{primaryLabel}: {formatValue(item[primaryKey])}</div>
                    {secondaryKey && secondaryLabel && (
                      <div>{secondaryLabel}: {formatSecondaryValue(item[secondaryKey])}</div>
                    )}
                  </div>

                  {/* Bars container */}
                  <div className="w-full flex gap-0.5 items-end h-full">
                    {/* Primary bar */}
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(primaryHeight, 4)}%` }}
                      transition={{ duration: 0.5, delay: idx * 0.03 }}
                      className={cn(
                        'flex-1 rounded-t transition-all duration-300',
                        primaryColor,
                        'hover:opacity-80'
                      )}
                    />
                    {/* Secondary bar */}
                    {secondaryKey && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(secondaryHeight, 4)}%` }}
                        transition={{ duration: 0.5, delay: idx * 0.03 + 0.1 }}
                        className={cn(
                          'flex-1 rounded-t transition-all duration-300',
                          secondaryColor,
                          'hover:opacity-80'
                        )}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* X-axis labels.
              When there's only one data point, both first and last reduce
              to the same date — render it once, centered, instead of
              showing it twice with a confusing gap. */}
          <div className="text-[10px] text-gray-400 dark:text-gray-500 font-manrope">
            {data.length === 0 ? null : data.length === 1 ? (
              <div className="text-center">{format(parseISO(data[0].date), 'MMM d')}</div>
            ) : (
              <div className="flex justify-between">
                <span>{format(parseISO(data[0].date), 'MMM d')}</span>
                <span>{format(parseISO(data[data.length - 1].date), 'MMM d')}</span>
              </div>
            )}
            {data.length === 1 && (
              <p className="text-center text-[10px] text-gray-400 mt-1 italic">
                Only one day of data so far — more trends will appear over time.
              </p>
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Total {primaryLabel}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 font-manrope">
              {formatValue(totalPrimary)}
            </p>
          </div>
          {secondaryKey && secondaryLabel && (
            <div className="text-right">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Total {secondaryLabel}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 font-manrope">
                {formatSecondaryValue(totalSecondary)}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Simplified single-metric trend for smaller displays
 */
interface SimpleTrendProps {
  data: { date: string; value: number }[];
  color?: string;
  height?: number;
}

export function SimpleTrend({
  data,
  color = 'bg-blue-500 dark:bg-blue-400',
  height = 40
}: SimpleTrendProps) {
  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end gap-px" style={{ height }}>
      {data.slice(-7).map((item, idx) => {
        const barHeight = (item.value / maxValue) * 100;
        return (
          <motion.div
            key={idx}
            initial={{ height: 0 }}
            animate={{ height: `${Math.max(barHeight, 8)}%` }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className={cn('flex-1 rounded-sm', color)}
            title={`${format(parseISO(item.date), 'MMM d')}: ${item.value}`}
          />
        );
      })}
    </div>
  );
}
