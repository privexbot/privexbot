/**
 * Coming Soon Badge Component
 *
 * Small badge to indicate upcoming features
 */

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ComingSoonBadgeProps {
  className?: string;
  children?: React.ReactNode;
}

export function ComingSoonBadge({ className, children }: ComingSoonBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs px-2 py-0.5 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 border border-blue-200",
        className
      )}
    >
      {children || "Coming Soon"}
    </Badge>
  );
}