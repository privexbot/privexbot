/**
 * Integrations Modal Component
 *
 * Modal for selecting cloud service integrations
 */

import { ExternalLink, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface IntegrationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface IntegrationOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  available: boolean;
  features: string[];
}

export function IntegrationsModal({
  open,
  onOpenChange,
}: IntegrationsModalProps) {
  const integrations: IntegrationOption[] = [
    {
      id: "notion",
      title: "Notion",
      description: "Import pages and databases from Notion workspace",
      icon: "📝",
      available: false,
      features: [
        "OAuth workspace connection",
        "Selective page import",
        "Database content sync",
        "Real-time updates",
      ],
    },
    {
      id: "google-docs",
      title: "Google Docs",
      description: "Import documents from Google Drive",
      icon: "📄",
      available: false,
      features: [
        "Google Drive OAuth",
        "Selective document import",
        "Shared document access",
        "Auto-sync on changes",
      ],
    },
    {
      id: "google-sheets",
      title: "Google Sheets",
      description: "Import structured data from spreadsheets",
      icon: "📊",
      available: false,
      features: [
        "CSV and structured data",
        "Multiple sheet support",
        "Custom data formatting",
        "Formula evaluation",
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-white dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white font-manrope">
            <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Cloud Integrations
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope">
            Connect your cloud services to import content directly into your
            knowledge base
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {integrations.map((integration) => (
            <Card
              key={integration.id}
              className={`transition-all duration-200 shadow-sm hover:shadow-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl ${
                integration.available
                  ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  : "opacity-90"
              }`}
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start gap-4 sm:gap-6">
                  <span className="text-2xl sm:text-3xl flex-shrink-0">
                    {integration.icon}
                  </span>

                  <div className="flex-1 min-w-0">
                    {/* Title and status badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                      <h3 className="font-bold text-lg sm:text-xl text-gray-900 dark:text-white font-manrope">
                        {integration.title}
                      </h3>
                      <Badge
                        className={`text-xs font-manrope font-medium w-fit ${
                          integration.available
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700"
                            : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700"
                        }`}
                      >
                        {integration.available ? "Available" : "Coming Soon"}
                      </Badge>
                    </div>

                    {/* Description with proper contrast */}
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope mb-4 leading-relaxed">
                      {integration.description}
                    </p>

                    {/* Feature badges with enhanced styling */}
                    <div className="flex flex-wrap gap-2">
                      {integration.features.map((feature, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="text-xs bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-manrope font-medium hover:bg-gray-100 dark:hover:bg-gray-600/50 transition-colors"
                        >
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Action area with enhanced styling */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {integration.available ? (
                      <Button
                        className="bg-blue-600 hover:bg-blue-700 text-white font-manrope font-medium shadow-sm transition-all duration-200 hover:shadow-md"
                        size="sm"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Connect
                      </Button>
                    ) : (
                      <div className="bg-gray-50 dark:bg-gray-700/30 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="text-xs text-gray-600 dark:text-gray-400 font-manrope font-medium text-center">
                          Coming Soon
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
