/**
 * Knowledge Base Source List Component
 *
 * Displays added sources with preview and management actions
 */

import { useState } from 'react';
import { FileText, Globe, Type, Settings, Trash2, Eye, AlertCircle, CheckCircle } from 'lucide-react';
import { SourceType, DraftSource } from '@/types/knowledge-base';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useKBStore } from '@/store/kb-store';
import { toast } from '@/components/ui/use-toast';

interface KBSourceListProps {
  sources: DraftSource[];
}

export function KBSourceList({ sources }: KBSourceListProps) {
  const [deleteSourceId, setDeleteSourceId] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<DraftSource | null>(null);

  const { removeSource, updateSource } = useKBStore();

  if (sources.length === 0) {
    return (
      <div className="text-center py-8 px-4 bg-gray-50 rounded-lg border-2 border-dashed">
        <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Sources Added</h3>
        <p className="text-gray-500 mb-4">
          Add content sources above to build your knowledge base
        </p>
      </div>
    );
  }

  const getSourceIcon = (type: SourceType) => {
    switch (type) {
      case SourceType.WEB:
        return <Globe className="h-4 w-4" />;
      case SourceType.FILE:
        return <FileText className="h-4 w-4" />;
      case SourceType.TEXT:
        return <Type className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getSourceTitle = (source: DraftSource) => {
    switch (source.type) {
      case SourceType.WEB:
        return source.url || 'Web Source';
      case SourceType.FILE:
        return (source.metadata?.file_name as string) || 'File Source';
      case SourceType.TEXT:
        return (source.metadata?.title as string) || 'Text Source';
      default:
        return 'Unknown Source';
    }
  };

  const getSourceDescription = (source: DraftSource) => {
    switch (source.type) {
      case SourceType.WEB:
        return `${source.config?.method || 'crawl'} • max ${source.config?.max_pages || 50} pages`;
      case SourceType.FILE:
        return `${((source.metadata?.file_size as number) || 0) / 1024 / 1024} MB • ${(source.metadata?.file_type as string) || 'auto'}`;
      case SourceType.TEXT:
        return `${((source.metadata?.content as string)?.length || 0).toLocaleString()} characters`;
      default:
        return '';
    }
  };

  const getStatusBadge = (source: DraftSource) => {
    const status = source.status || 'pending';

    switch (status) {
      case 'completed':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            Pending
          </Badge>
        );
    }
  };

  const handleDeleteSource = (sourceId: string) => {
    try {
      removeSource(sourceId);
      toast({
        title: 'Source Removed',
        description: 'The source has been removed from your knowledge base',
      });
      setDeleteSourceId(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove source',
        variant: 'destructive'
      });
    }
  };

  const handlePreviewSource = (source: DraftSource) => {
    setPreviewSource(source);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          Added Sources ({sources.length})
        </h3>
      </div>

      <div className="space-y-3">
        {sources.map((source, index) => (
          <Card key={source.source_id || index} className="transition-colors hover:bg-accent/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    {getSourceIcon(source.type)}
                    <h4 className="font-medium truncate">
                      {getSourceTitle(source)}
                    </h4>
                    {getStatusBadge(source)}
                  </div>

                  <p className="text-sm text-muted-foreground mb-2">
                    {getSourceDescription(source)}
                  </p>

                  {source.status === 'failed' && (
                    <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      Processing failed. Please try again.
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="capitalize">{source.type} source</span>
                    <span>Added {new Date().toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreviewSource(source)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handlePreviewSource(source)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Preview Content
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteSourceId(source.source_id || `${index}`)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove Source
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteSourceId} onOpenChange={() => setDeleteSourceId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Source?</DialogTitle>
            <DialogDescription>
              This will remove the source from your knowledge base draft.
              You can add it back later if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteSourceId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteSourceId && handleDeleteSource(deleteSourceId)}
            >
              Remove Source
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewSource} onOpenChange={() => setPreviewSource(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewSource && getSourceIcon(previewSource.type)}
              Source Preview
            </DialogTitle>
            <DialogDescription>
              {previewSource && getSourceTitle(previewSource)}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-auto max-h-96 bg-gray-50 p-4 rounded-lg">
            {previewSource?.type === SourceType.TEXT && (
              <pre className="whitespace-pre-wrap text-sm">
                {(previewSource.metadata?.content as string) || 'No content available'}
              </pre>
            )}

            {previewSource?.type === SourceType.WEB && (
              <div className="space-y-2">
                <p><strong>URL:</strong> {previewSource.url}</p>
                <p><strong>Method:</strong> {previewSource.config?.method}</p>
                <p><strong>Max Pages:</strong> {previewSource.config?.max_pages}</p>
                <p><strong>Max Depth:</strong> {previewSource.config?.max_depth}</p>
                {previewSource.config?.include_patterns?.length && (
                  <p><strong>Include Patterns:</strong> {previewSource.config.include_patterns?.join(', ')}</p>
                )}
                {previewSource.config?.exclude_patterns?.length && (
                  <p><strong>Exclude Patterns:</strong> {previewSource.config.exclude_patterns?.join(', ')}</p>
                )}
              </div>
            )}

            {previewSource?.type === SourceType.FILE && (
              <div className="space-y-2">
                <p><strong>Filename:</strong> {(previewSource.metadata?.file_name as string) || 'Unknown'}</p>
                <p><strong>Size:</strong> {(((previewSource.metadata?.file_size as number) || 0) / 1024 / 1024).toFixed(2)} MB</p>
                <p><strong>Type:</strong> {(previewSource.metadata?.file_type as string) || 'auto-detected'}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setPreviewSource(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}