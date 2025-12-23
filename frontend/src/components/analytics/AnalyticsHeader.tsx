/**
 * Analytics Header Component
 *
 * WHY: Provide scope toggle and time range selector
 * HOW: Tabs for scope, select for time range
 */

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Briefcase } from "lucide-react";
import type { AnalyticsScope, AnalyticsTimeRange } from "@/types/analytics";

interface AnalyticsHeaderProps {
  scope: AnalyticsScope;
  onScopeChange: (scope: AnalyticsScope) => void;
  timeRange: AnalyticsTimeRange;
  onTimeRangeChange: (range: AnalyticsTimeRange) => void;
  scopeName: string;
  isLoading?: boolean;
}

export function AnalyticsHeader({
  scope,
  onScopeChange,
  timeRange,
  onTimeRangeChange,
  scopeName,
  isLoading,
}: AnalyticsHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Analytics
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {isLoading ? (
            <span className="animate-pulse">Loading...</span>
          ) : (
            <>Performance metrics for <span className="font-medium">{scopeName}</span></>
          )}
        </p>
      </div>

      <div className="flex items-center gap-4">
        {/* Scope Toggle */}
        <Tabs
          value={scope}
          onValueChange={(value) => onScopeChange(value as AnalyticsScope)}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="workspace" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Workspace</span>
            </TabsTrigger>
            <TabsTrigger value="organization" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Organization</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Time Range Selector */}
        <Select
          value={String(timeRange)}
          onValueChange={(value) => onTimeRangeChange(Number(value) as AnalyticsTimeRange)}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
