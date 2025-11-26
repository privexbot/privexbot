/**
 * Knowledge Base Processing Status Component
 *
 * Real-time pipeline monitoring using actual API endpoints
 */

import { useState } from 'react';
import { Activity, Eye } from 'lucide-react';
import { KnowledgeBase, KBSummary, PipelineStatusResponse } from '@/types/knowledge-base';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

// Using PipelineStatusResponse from types

interface KBProcessingStatusProps {
  kb: KnowledgeBase | KBSummary;
  pipelineStatus?: PipelineStatusResponse;
  compact?: boolean;
}

export function KBProcessingStatus({ kb, pipelineStatus, compact = false }: KBProcessingStatusProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!pipelineStatus) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No pipeline information available
          </div>
        </CardContent>
      </Card>
    );
  }

  const status = pipelineStatus;

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-blue-500 animate-spin" />
          <div>
            <p className="font-medium text-sm">{kb.name}</p>
            <p className="text-xs text-muted-foreground">
              {status.progress.current_step ? status.progress.current_step.replace('_', ' ') : 'Processing...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-medium">{status.progress.percent || 0}%</div>
            <div className="text-xs text-muted-foreground">
              Processing...
            </div>
          </div>
          <Progress value={status.progress.percent || 0} className="w-20" />
          <Dialog open={showDetails} onOpenChange={setShowDetails}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Processing Details: {kb.name}</DialogTitle>
                <DialogDescription>
                  Pipeline ID: {status.pipeline_id}
                </DialogDescription>
              </DialogHeader>
              <div className="p-4 text-center text-muted-foreground">
                Processing details will be available when pipeline is active.
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-blue-500" />
            <div>
              <h3 className="font-semibold">{kb.name}</h3>
              <p className="text-sm text-muted-foreground">Processing knowledge base...</p>
            </div>
          </div>
          <Dialog open={showDetails} onOpenChange={setShowDetails}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Processing Details: {kb.name}</DialogTitle>
                <DialogDescription>
                  Pipeline ID: {status.pipeline_id}
                </DialogDescription>
              </DialogHeader>
              <div className="p-4 text-center text-muted-foreground">
                Processing details will be available when pipeline is active.
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Current: {status.progress.current_step ? status.progress.current_step.replace('_', ' ') : 'Processing...'}
            </span>
            <span className="text-sm font-medium">{status.progress.percent || 0}%</span>
          </div>

          <Progress value={status.progress.percent || 0} className="h-2" />

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Status: {status.message || 'Processing...'}</span>
            <span>Stage: {status.status}</span>
          </div>

          {status.progress.current_step && (
            <div className="p-3 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-blue-500 animate-spin" />
                <span className="text-sm font-medium">
                  {status.progress.current_step.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Currently processing this stage...
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}