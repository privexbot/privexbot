/**
 * Knowledge Base Stats Card Component
 *
 * Displays key metrics and statistics for KB overview
 */

import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface KBStatsCardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  variant?: 'default' | 'success' | 'warning' | 'error';
  subtitle?: string;
  loading?: boolean;
}

export function KBStatsCard({
  title,
  value,
  icon,
  trend,
  trendDirection = 'neutral',
  variant = 'default',
  subtitle,
  loading = false
}: KBStatsCardProps) {
  const getTrendIcon = () => {
    switch (trendDirection) {
      case 'up':
        return <TrendingUp className="h-3 w-3" />;
      case 'down':
        return <TrendingDown className="h-3 w-3" />;
      default:
        return <Minus className="h-3 w-3" />;
    }
  };

  const getTrendColor = () => {
    switch (trendDirection) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          card: 'border-green-200 bg-green-50',
          icon: 'text-green-600',
          value: 'text-green-900'
        };
      case 'warning':
        return {
          card: 'border-yellow-200 bg-yellow-50',
          icon: 'text-yellow-600',
          value: 'text-yellow-900'
        };
      case 'error':
        return {
          card: 'border-red-200 bg-red-50',
          icon: 'text-red-600',
          value: 'text-red-900'
        };
      default:
        return {
          card: 'border-gray-200 bg-white hover:bg-gray-50',
          icon: 'text-gray-600',
          value: 'text-gray-900'
        };
    }
  };

  const styles = getVariantStyles();

  const formatValue = (val: number | string) => {
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(1)}M`;
      }
      if (val >= 1000) {
        return `${(val / 1000).toFixed(1)}K`;
      }
      return val.toLocaleString();
    }
    return val;
  };

  if (loading) {
    return (
      <Card className={styles.card}>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-5 h-5 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-20"></div>
            </div>
            <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-24"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${styles.card} transition-all duration-200 cursor-default`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <div className="flex items-center space-x-2">
            <div className={styles.icon}>
              {icon}
            </div>
            <p className="text-sm font-medium text-gray-600">
              {title}
            </p>
          </div>

          {variant !== 'default' && (
            <div className="flex items-center">
              <Badge
                variant={variant === 'success' ? 'default' : variant === 'warning' ? 'secondary' : 'destructive'}
                className="text-xs"
              >
                {variant === 'success' && '✓'}
                {variant === 'warning' && '⚠'}
                {variant === 'error' && '✗'}
              </Badge>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div className={`text-2xl font-bold ${styles.value}`}>
            {formatValue(value)}
          </div>

          {(trend || subtitle) && (
            <div className="flex items-center justify-between">
              {trend && (
                <div className={`flex items-center space-x-1 text-xs ${getTrendColor()}`}>
                  {getTrendIcon()}
                  <span>{trend}</span>
                </div>
              )}

              {subtitle && (
                <p className="text-xs text-gray-500 ml-auto">
                  {subtitle}
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}