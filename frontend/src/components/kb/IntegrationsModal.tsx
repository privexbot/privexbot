/**
 * Integrations Modal Component
 *
 * Modal for selecting cloud service integrations
 */

import { FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

export function IntegrationsModal({ open, onOpenChange }: IntegrationsModalProps) {
  const integrations: IntegrationOption[] = [
    {
      id: 'notion',
      title: 'Notion',
      description: 'Import pages and databases from Notion workspace',
      icon: '📝',
      available: false,
      features: [
        'OAuth workspace connection',
        'Selective page import',
        'Database content sync',
        'Real-time updates'
      ]
    },
    {
      id: 'google-docs',
      title: 'Google Docs',
      description: 'Import documents from Google Drive',
      icon: '📄',
      available: false,
      features: [
        'Google Drive OAuth',
        'Selective document import',
        'Shared document access',
        'Auto-sync on changes'
      ]
    },
    {
      id: 'google-sheets',
      title: 'Google Sheets',
      description: 'Import structured data from spreadsheets',
      icon: '📊',
      available: false,
      features: [
        'CSV and structured data',
        'Multiple sheet support',
        'Custom data formatting',
        'Formula evaluation'
      ]
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Cloud Integrations</DialogTitle>
          <DialogDescription>
            Connect your cloud services to import content directly into your knowledge base
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {integrations.map((integration) => (
            <Card
              key={integration.id}
              className={`${integration.available ? 'cursor-pointer hover:bg-gray-50' : 'opacity-60'}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{integration.icon}</span>
                      <h3 className="font-semibold text-lg">{integration.title}</h3>
                      <Badge variant={integration.available ? 'default' : 'secondary'}>
                        {integration.available ? 'Available' : 'Coming Soon'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {integration.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {integration.features.map((feature, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {!integration.available && (
                    <div className="text-sm text-muted-foreground">
                      <span className="text-orange-600 font-medium">Coming Soon</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center text-sm text-muted-foreground">
          More integrations coming soon: Slack, Microsoft 365, Confluence, GitHub
        </div>
      </DialogContent>
    </Dialog>
  );
}