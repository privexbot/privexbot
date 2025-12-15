/**
 * Coming Soon Component
 *
 * Used for features that are not yet implemented
 */

import { ReactNode } from 'react';
import { Clock, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ComingSoonProps {
  title: string;
  description: string;
  icon?: ReactNode;
  expectedDate?: string;
  features?: string[];
}

export function ComingSoon({
  title,
  description,
  icon,
  expectedDate,
  features = []
}: ComingSoonProps) {
  return (
    <Card className="border-2 border-dashed border-gray-300">
      <CardHeader className="text-center">
        <div className="flex justify-center items-center gap-2 mb-2">
          {icon && <div className="text-gray-400">{icon}</div>}
          <Clock className="h-5 w-5 text-gray-400" />
        </div>
        <CardTitle className="text-gray-600">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <Badge variant="outline" className="mx-auto w-fit">
          Coming Soon
        </Badge>
      </CardHeader>

      {(expectedDate || features.length > 0) && (
        <CardContent className="pt-0">
          {expectedDate && (
            <div className="text-center text-sm text-gray-500 mb-4">
              Expected: {expectedDate}
            </div>
          )}

          {features.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Planned Features:</h4>
              <ul className="space-y-1">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                    <ArrowRight className="h-3 w-3" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}