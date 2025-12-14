/**
 * Stats Cards Component
 *
 * WHY: Display key workspace metrics in a unified, visually cohesive layout
 * HOW: Icon and label on same line, value prominent, growth indicators beneath
 *
 * DESIGN:
 * - Cards feel unified with shortened vertical dividers between them
 * - Responsive grid: 1 column (mobile) → 2 columns (sm) → 4 columns (lg)
 * - Icon and label on SAME LINE (Title Case, not UPPERCASE)
 * - Metric value prominent below
 * - Growth indicator beneath the value
 * - Vertical dividers positioned more to the right, not touching horizontal dividers
 */

import { Network, Book, MessageCircle, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/types/dashboard";

interface StatsCardsProps {
  stats: DashboardStats;
  isLoading?: boolean;
  timeRange?: string; // For dynamic reference period
  customDateRange?: string | null; // For custom date selections
}

export function StatsCards({ stats, isLoading, timeRange, customDateRange }: StatsCardsProps) {
  // Helper function to get exact comparison period with specific dates
  const getReferencePeriod = (timeRange?: string, customDateRange?: string | null) => {
    const today = new Date();

    // If custom date range is selected, calculate exact previous period
    if (customDateRange) {
      const [startStr, endStr] = customDateRange.split(' - ');
      if (startStr && endStr) {
        // Parse the selected dates (assuming current year)
        const startDate = new Date(startStr + ', 2024');
        const endDate = new Date(endStr + ', 2024');
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

        // Calculate the exact previous period (same duration, immediately before)
        const prevEndDate = new Date(startDate);
        prevEndDate.setDate(prevEndDate.getDate() - 1);
        const prevStartDate = new Date(prevEndDate);
        prevStartDate.setDate(prevStartDate.getDate() - daysDiff);

        const prevStartStr = prevStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const prevEndStr = prevEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        return `vs ${prevStartStr}-${prevEndStr}`;
      }
    }

    // Standard time range comparisons with calculated dates
    switch (timeRange) {
      case "Last 24 hours": {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const dayBefore = new Date(today);
        dayBefore.setDate(dayBefore.getDate() - 2);

        const yesterdayStr = yesterday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const dayBeforeStr = dayBefore.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `vs ${dayBeforeStr}-${yesterdayStr}`;
      }
      case "Last 7 days": {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const fourteenDaysAgo = new Date(today);
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const startStr = fourteenDaysAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endStr = sevenDaysAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `vs ${startStr}-${endStr}`;
      }
      case "Last 30 days": {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sixtyDaysAgo = new Date(today);
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        const startStr = sixtyDaysAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endStr = thirtyDaysAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `vs ${startStr}-${endStr}`;
      }
      case "Last 90 days": {
        const ninetyDaysAgo = new Date(today);
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const oneEightyDaysAgo = new Date(today);
        oneEightyDaysAgo.setDate(oneEightyDaysAgo.getDate() - 180);

        const startStr = oneEightyDaysAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endStr = ninetyDaysAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `vs ${startStr}-${endStr}`;
      }
      default: {
        // Default to last 30 days comparison
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sixtyDaysAgo = new Date(today);
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        const startStr = sixtyDaysAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endStr = thirtyDaysAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `vs ${startStr}-${endStr}`;
      }
    }
  };

  const referencePeriod = getReferencePeriod(timeRange, customDateRange);
  if (isLoading) {
    return (
      <div className="w-full bg-white dark:bg-[#1F2937] transition-all duration-500 ease-out">
        <div className="px-4 sm:px-6 lg:pl-6 lg:pr-8 xl:pl-8 xl:pr-12 2xl:pl-8 2xl:pr-16 max-w-none">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={cn(
                "p-4 sm:p-5 md:p-6 lg:p-7 relative",
                "border-b border-gray-200 dark:border-gray-700/50 sm:border-b-0 last:border-b-0",
                "animate-pulse transition-all duration-500 ease-out"
              )}
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg flex-shrink-0 transition-all duration-300" />
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded transition-all duration-300" />
                </div>
                <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded transition-all duration-300" />
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>
    );
  }

  // Custom chatbot SVG component
  const ChatbotIcon = ({ className }: { className?: string }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M20.5696 19.0752L20.0096 18.5056L19.6816 18.8256L19.7936 19.2688L20.5696 19.0752ZM21.6 23.2L21.4064 23.976C21.5403 24.0093 21.6806 24.0075 21.8136 23.9706C21.9466 23.9337 22.0678 23.863 22.1654 23.7654C22.263 23.5678 22.3337 23.5466 22.3706 23.4136C22.4075 23.2806 22.4093 23.1403 22.376 23.0064L21.6 23.2ZM15.2 21.6L14.6336 21.0336L13.6352 22.0336L15.0064 22.376L15.2 21.6ZM15.24 21.56L15.8048 22.1264C15.9215 22.0101 15.9995 21.8606 16.0281 21.6983C16.0566 21.536 16.0344 21.3688 15.9644 21.2197C15.8943 21.0705 15.7799 20.9466 15.6368 20.8649C15.4937 20.7832 15.3289 20.7477 15.1648 20.7632L15.24 21.56ZM11.2 0V4H12.8V0H11.2ZM14.4 3.2H9.6V4.8H14.4V3.2ZM24 12.8C24 10.2539 22.9886 7.81212 21.1882 6.01178C19.3879 4.21143 16.9461 3.2 14.4 3.2V4.8C15.4506 4.8 16.4909 5.00693 17.4615 5.40896C18.4321 5.811 19.314 6.40028 20.0569 7.14315C20.7997 7.88601 21.389 8.76793 21.791 9.73853C22.1931 10.7091 22.4 11.7494 22.4 12.8H24ZM21.1296 19.6464C22.0402 18.7538 22.7633 17.6882 23.2562 16.5122C23.7491 15.3362 24.002 14.0751 24 12.8H22.4C22.402 13.8627 22.1915 14.9136 21.7807 15.8937C21.3699 16.8738 20.7688 17.7619 20.0096 18.5056L21.1296 19.6464ZM22.3776 23.0064L21.344 18.88L19.792 19.2672L20.8224 23.392L22.3776 23.0064ZM15.0064 22.376L21.4064 23.976L21.7936 22.424L15.3936 20.824L15.0064 22.376ZM14.6736 20.9952L14.6336 21.0336L15.7664 22.1648L15.8048 22.1264L14.6736 20.9952ZM14.4 22.4C14.7093 22.4 15.0144 22.3856 15.3152 22.3568L15.1648 20.7632C14.9106 20.7877 14.6554 20.7999 14.4 20.8V22.4ZM9.6 22.4H14.4V20.8H9.6V22.4ZM0 12.8C0 15.3461 1.01143 17.7879 2.81177 19.5882C4.61212 21.3886 7.05392 22.4 9.6 22.4V20.8C8.54942 20.8 7.50914 20.5931 6.53853 20.191C5.56793 19.789 4.68601 19.1997 3.94315 18.4569C2.44285 16.9566 1.6 14.9217 1.6 12.8H0ZM9.6 3.2C7.05392 3.2 4.61212 4.21143 2.81177 6.01178C1.01143 7.81212 0 10.2539 0 12.8H1.6C1.6 10.6783 2.44285 8.64344 3.94315 7.14315C5.44344 5.64285 7.47827 4.8 9.6 4.8V3.2ZM12 12.8C11.3635 12.8 10.753 12.5471 10.3029 12.0971C9.85286 11.647 9.6 11.0365 9.6 10.4H8C8 11.4609 8.42143 12.4783 9.17157 13.2284C9.92172 13.9786 10.9391 14.4 12 14.4V12.8ZM14.4 10.4C14.4 11.0365 14.1471 11.647 13.6971 12.0971C13.247 12.5471 12.6365 12.8 12 12.8V14.4C13.0609 14.4 14.0783 13.9786 14.8284 13.2284C15.5786 12.4783 16 11.4609 16 10.4H14.4ZM12 8C12.6365 8 13.247 8.25286 13.6971 8.70294C14.1471 9.15303 14.4 9.76348 14.4 10.4H16C16 9.33913 15.5786 8.32172 14.8284 7.57157C14.0783 6.82143 13.0609 6.4 12 6.4V8ZM12 6.4C10.9391 6.4 9.92172 6.82143 9.17157 7.57157C8.42143 8.32172 8 9.33913 8 10.4H9.6C9.6 9.76348 9.85286 9.15303 10.3029 8.70294C10.753 8.25286 11.3635 8 12 8V6.4ZM12 19.2C13.7024 19.2 15.2672 18.608 16.5008 17.6208L15.4992 16.3728C14.5392 17.1408 13.3248 17.6 12 17.6V19.2ZM7.4992 17.6208C8.7312 18.608 10.2992 19.2 12 19.2V17.6C10.7276 17.6028 9.49272 17.1697 8.5008 16.3728L7.4992 17.6208Z" fill="currentColor"/>
    </svg>
  );

  const statItems = [
    {
      icon: ChatbotIcon,
      label: "Total Chatbots",
      value: stats.total_chatbots,
      delta: stats.chatbots_delta,
      color: "blue",
    },
    {
      icon: Network,
      label: "Total Chatflows",
      value: stats.total_chatflows,
      delta: stats.chatflows_delta,
      color: "purple",
    },
    {
      icon: Book,
      label: "Knowledge Bases",
      value: stats.total_knowledge_bases,
      delta: stats.knowledge_bases_delta,
      color: "green",
    },
    {
      icon: MessageCircle,
      label: "Conversations",
      value: stats.total_conversations.toLocaleString(),
      delta: stats.conversations_delta,
      color: "orange",
    },
  ];

  return (
    <div className="w-full bg-white dark:bg-[#1F2937] transition-all duration-500 ease-out">
      <div className="px-4 sm:px-6 lg:pl-6 lg:pr-8 xl:pl-8 xl:pr-12 2xl:pl-8 2xl:pr-16 max-w-none">
        {/* Unified Stats Grid with Shortened Vertical Dividers and smooth animations */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 relative transition-all duration-300 ease-out">
        {statItems.map((stat, index) => {
          const Icon = stat.icon;
          const isPositive = stat.delta !== undefined && stat.delta > 0;
          const isNegative = stat.delta !== undefined && stat.delta < 0;

          // Icon colors
          const iconColors = {
            blue: "text-blue-700 dark:text-blue-300",
            purple: "text-purple-700 dark:text-purple-300",
            green: "text-green-700 dark:text-green-300",
            orange: "text-orange-700 dark:text-orange-300",
          };

          return (
            <div
              key={index}
              className={cn(
                "p-4 sm:p-5 md:p-6 lg:p-7 group hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all duration-300 cursor-default relative transform hover:scale-[1.02]",
                // Bottom border on mobile for separation
                "border-b border-gray-200 dark:border-gray-700/50 sm:border-b-0 last:border-b-0"
              )}
            >
              {/* Shortened Vertical Divider - Positioned more to the right */}
              {index < 3 && (
                <>
                  {/* Desktop dividers (4 columns) */}
                  <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 h-16 w-px bg-gray-200 dark:bg-gray-700/50" />
                  {/* Tablet dividers (2 columns) */}
                  {index < 2 && (
                    <div className="hidden sm:block lg:hidden absolute right-0 top-1/2 -translate-y-1/2 h-16 w-px bg-gray-200 dark:bg-gray-700/50" />
                  )}
                  {/* Special case for 3rd item on tablet (2x2 grid) */}
                  {index === 2 && (
                    <div className="hidden sm:block lg:hidden absolute right-0 top-1/2 -translate-y-1/2 h-16 w-px bg-gray-200 dark:bg-gray-700/50" />
                  )}
                </>
              )}

              <div className="space-y-3">
                {/* Icon and Label on Same Line */}
                <div className="flex items-center gap-2">
                  {/* Icon */}
                  <div className="inline-flex flex-shrink-0 transition-transform group-hover:scale-105">
                    <Icon
                      className={cn("h-4 w-4 sm:h-5 sm:w-5", iconColors[stat.color as keyof typeof iconColors])}
                    />
                  </div>

                  {/* Label - Title Case */}
                  <p className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400 font-manrope">
                    {stat.label}
                  </p>
                </div>

                {/* Value - Large and Prominent with smooth transitions */}
                <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white transition-all duration-500 ease-out font-manrope">
                  <span className="inline-block transition-transform duration-500 ease-out group-hover:scale-105">
                    {stat.value}
                  </span>
                </p>

                {/* Growth Indicator Badge (Beneath Value) with smooth animations */}
                {stat.delta !== undefined && (
                  <div
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs transition-all duration-300 ease-out transform hover:scale-105",
                      isPositive &&
                        "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
                      isNegative &&
                        "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
                      !isPositive &&
                        !isNegative &&
                        "bg-gray-100 dark:bg-gray-700/30 text-gray-700 dark:text-gray-400"
                    )}
                  >
                    {/* Growth icon */}
                    {isPositive ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : isNegative ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : null}

                    {/* Bold percentage */}
                    <span className="font-bold text-xs font-manrope">
                      {isPositive ? '+' : ''}{Math.abs(stat.delta).toFixed(1)}%
                    </span>

                    {/* Smaller contextual comparison dates */}
                    <span className="text-[10px] opacity-75 font-normal font-manrope">
                      {referencePeriod}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
