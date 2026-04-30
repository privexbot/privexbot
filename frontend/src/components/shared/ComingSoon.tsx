/**
 * Coming Soon Component
 *
 * WHY: Reusable component for pages that are not yet implemented
 * HOW: Consistent design with dashboard layout, proper accessibility, and dark mode support
 *
 * FEATURES:
 * - Consistent with project design system
 * - WCAG AA compliant contrast ratios
 * - Responsive design
 * - Dark mode support
 * - Type-safe props with proper validation
 */

import { ExternalLink, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ComingSoonProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor?: string;
  expectedDate?: string;
  onBackToDashboard?: () => void;
  /** Optional external resource (e.g. hosted docs) shown alongside Back-to-Dashboard. */
  externalLink?: { label: string; href: string };
  className?: string;
}

export function ComingSoon({
  title,
  description,
  icon: Icon,
  iconColor = "text-blue-600 dark:text-blue-400",
  expectedDate,
  onBackToDashboard,
  externalLink,
  className,
}: ComingSoonProps) {
  return (
    <div className={cn("w-full bg-background min-h-screen", className)}>
      <div className="px-4 sm:px-6 lg:pl-6 lg:pr-8 xl:pl-8 xl:pr-12 2xl:pl-8 2xl:pr-16 max-w-none">
        <div className="flex items-center justify-center min-h-screen py-12">
          <div className="max-w-md w-full text-center">
            {/* Icon */}
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full bg-gray-100 dark:bg-gray-800 transition-transform hover:scale-105">
                <Icon className={cn("h-8 w-8 md:h-10 md:w-10", iconColor)} />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {title}
            </h1>

            {/* Description */}
            <p className="text-base text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
              {description}
            </p>

            {/* Expected Date */}
            {expectedDate && (
              <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                  Expected Release: {expectedDate}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {externalLink && (
                <Button
                  asChild
                  variant="outline"
                  className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium px-6 py-2 rounded-lg transition-all duration-200"
                >
                  <a
                    href={externalLink.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {externalLink.label}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button
                onClick={onBackToDashboard}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium px-6 py-2 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
              >
                Back to Dashboard
              </Button>
            </div>

            {/* Additional Info */}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-6">
              We're working hard to bring you this feature. Stay tuned for updates!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}