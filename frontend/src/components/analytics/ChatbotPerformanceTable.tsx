/**
 * Chatbot Performance Table Component
 *
 * WHY: Show per-chatbot breakdown of performance metrics
 * HOW: Table with sortable columns
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bot, Workflow } from "lucide-react";
import type { ChatbotBreakdown } from "@/types/analytics";
import { formatNumber, formatPercentage } from "@/types/analytics";

interface ChatbotPerformanceTableProps {
  data: ChatbotBreakdown[];
  isLoading: boolean;
}

export function ChatbotPerformanceTable({
  data,
  isLoading,
}: ChatbotPerformanceTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Chatbot Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Chatbot Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-gray-500 dark:text-gray-400">
            No chatbot data available for the selected period
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
          Chatbot Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Bot</TableHead>
                <TableHead className="text-right">Conversations</TableHead>
                <TableHead className="text-right">Messages</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Satisfaction</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((bot) => (
                <TableRow key={bot.chatbot_id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {bot.bot_type === "chatbot" ? (
                        <Bot className="h-4 w-4 text-blue-500" />
                      ) : (
                        <Workflow className="h-4 w-4 text-purple-500" />
                      )}
                      <span className="text-gray-900 dark:text-white">
                        {bot.chatbot_name}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-xs capitalize"
                      >
                        {bot.bot_type}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-gray-700 dark:text-gray-300">
                    {formatNumber(bot.conversations)}
                  </TableCell>
                  <TableCell className="text-right text-gray-700 dark:text-gray-300">
                    {formatNumber(bot.messages)}
                  </TableCell>
                  <TableCell className="text-right text-gray-700 dark:text-gray-300">
                    {formatNumber(bot.tokens)}
                  </TableCell>
                  <TableCell className="text-right">
                    <SatisfactionBadge rate={bot.satisfaction_rate} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function SatisfactionBadge({ rate }: { rate: number }) {
  const percentage = formatPercentage(rate);

  let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
  let className = "";

  if (rate >= 0.8) {
    className = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800";
  } else if (rate >= 0.5) {
    className = "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800";
  } else if (rate > 0) {
    className = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";
  } else {
    className = "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  }

  return (
    <Badge variant={variant} className={className}>
      {rate > 0 ? percentage : "N/A"}
    </Badge>
  );
}
