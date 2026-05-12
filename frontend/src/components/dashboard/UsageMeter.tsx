/**
 * UsageMeter — compact 3-bar usage card on the user-facing dashboard.
 *
 * WHY: A user who's about to hit the soft-degrade threshold (120% of
 * messages_per_month, after which inference is skipped) needs to see it
 * coming. The data is already in `GET /billing/plan`'s `breakdown`
 * dict; this just surfaces the three resources that matter most for
 * "am I about to lose service": messages, KB docs, web pages.
 *
 * HOW: Reads from the same endpoint BillingsPage uses. Skips bars for
 * unlimited resources. Conditional color (green / amber / red) at 60% /
 * 90% so the visual matches user-mental-model "fine / heads-up / red".
 */

import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { billingApi, type PlanStatus, type PlanBreakdownEntry } from "@/api/billing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const TRACKED: Array<{ key: keyof PlanStatus["breakdown"]; label: string }> = [
  { key: "messages_per_month", label: "Messages this month" },
  { key: "kb_documents", label: "Knowledge base documents" },
  { key: "web_pages_per_month", label: "Web pages scraped this month" },
];

function barColor(percent: number | null): string {
  if (percent === null) return "bg-muted-foreground";
  if (percent >= 90) return "bg-red-500 dark:bg-red-400";
  if (percent >= 60) return "bg-amber-500 dark:bg-amber-400";
  return "bg-green-500 dark:bg-green-400";
}

function formatLine(entry: PlanBreakdownEntry): string {
  if (entry.unlimited) return `${entry.usage.toLocaleString()} (unlimited)`;
  return `${entry.usage.toLocaleString()} / ${entry.limit.toLocaleString()}`;
}

export function UsageMeter() {
  const { data, isLoading, isError } = useQuery<PlanStatus>({
    queryKey: ["billing-plan-usage-meter"],
    queryFn: () => billingApi.getPlan(),
    staleTime: 60_000, // refresh every minute is plenty for a meter
  });

  if (isLoading || isError || !data) return null;

  // Skip the whole widget if every tracked resource is unlimited
  // (e.g. Enterprise) — there's nothing meaningful to render.
  const visibleEntries = TRACKED.map(({ key, label }) => ({
    key,
    label,
    entry: data.breakdown[key],
  })).filter((e) => e.entry && !e.entry.unlimited);

  if (visibleEntries.length === 0) return null;

  return (
    <Card className="bg-white dark:bg-[#374151] border-gray-200 dark:border-gray-600">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-200 font-manrope flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Plan usage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleEntries.map(({ key, label, entry }) => {
          const pct = entry.percent_used ?? 0;
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-manrope">
                <span className="text-gray-600 dark:text-gray-300">{label}</span>
                <span className="font-medium text-gray-900 dark:text-gray-50">
                  {formatLine(entry)}
                </span>
              </div>
              <Progress
                value={Math.min(pct, 100)}
                className={cn(
                  "h-1.5 [&>div]:transition-colors",
                  // Override the default indicator color via a CSS attribute
                  // so we can tint based on usage. Tailwind class on the
                  // Indicator is set via the parent's data-state hook.
                )}
              >
                <div
                  className={cn("h-full transition-all", barColor(pct))}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </Progress>
            </div>
          );
        })}
        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-manrope pt-1">
          Bars turn amber at 60% and red at 90%. Heads-up when the message
          counter is red — at 120% the bot stops calling the LLM until the
          next billing cycle.
        </p>
      </CardContent>
    </Card>
  );
}
