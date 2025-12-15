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
      <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
        <CardContent className="p-6">
          <div className="text-center text-gray-600 dark:text-gray-400 font-manrope">
            No pipeline information available
          </div>
        </CardContent>
      </Card>
    );
  }

  const status = pipelineStatus;

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 rounded-lg">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
          <div>
            <p className="font-medium text-sm text-gray-900 dark:text-gray-100 font-manrope">{kb.name}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-manrope">
              {status.progress.current_step ? status.progress.current_step.replace('_', ' ') : 'Processing...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-medium">{status.progress.percent || 0}%</div>
            <div className="text-xs text-gray-600 dark:text-gray-400 font-manrope">
              Processing...
            </div>
          </div>
          <Progress value={status.progress.percent || 0} className="w-20" />
          <Dialog open={showDetails} onOpenChange={setShowDetails}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="font-manrope border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <Eye className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <DialogHeader>
                <DialogTitle className="text-gray-900 dark:text-gray-100 font-manrope">Processing Details: {kb.name}</DialogTitle>
                <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope">
                  Pipeline ID: {status.pipeline_id}
                </DialogDescription>
              </DialogHeader>
              <div className="p-4 text-center text-gray-600 dark:text-gray-400 font-manrope">
                Processing details will be available when pipeline is active.
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  return (
    <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 font-manrope">{kb.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">Processing knowledge base...</p>
            </div>
          </div>
          <Dialog open={showDetails} onOpenChange={setShowDetails}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="font-manrope border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <DialogHeader>
                <DialogTitle className="text-gray-900 dark:text-gray-100 font-manrope">Processing Details: {kb.name}</DialogTitle>
                <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope">
                  Pipeline ID: {status.pipeline_id}
                </DialogDescription>
              </DialogHeader>
              <div className="p-4 text-center text-gray-600 dark:text-gray-400 font-manrope">
                Processing details will be available when pipeline is active.
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
              Current: {status.progress.current_step ? status.progress.current_step.replace('_', ' ') : 'Processing...'}
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">{status.progress.percent || 0}%</span>
          </div>

          <Progress value={status.progress.percent || 0} className="h-2" />

          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 font-manrope">
            <span>Status: {status.message || 'Processing...'}</span>
            <span>Stage: {status.status}</span>
          </div>

          {status.progress.current_step && (
            <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                  {status.progress.current_step.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
                Currently processing this stage...
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}