/**
 * Knowledge Base Source List Component
 *
 * Displays added sources with preview and management actions
 */

import React, { useState } from 'react';
import { FileText, Globe, Type, Settings, Trash2, Eye, AlertCircle, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { SourceType, DraftSource } from '@/types/knowledge-base';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useKBStore } from '@/store/kb-store';
import { toast } from '@/components/ui/use-toast';

interface KBSourceListProps {
  sources: DraftSource[];
}

export function KBSourceList({ sources }: KBSourceListProps) {
  const [deleteSourceId, setDeleteSourceId] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<DraftSource | null>(null);
  const [expandedPages, setExpandedPages] = useState<boolean>(false);

  const { removeSource } = useKBStore();

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

  const getSourceIcon = (type: SourceType): React.ReactElement => {
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

  const getSourceTitle = (source: DraftSource): string => {
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

  const getSourceDescription = (source: DraftSource): string => {
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

  const getStatusBadge = (source: DraftSource): React.ReactElement => {
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

  const handleDeleteSource = (sourceId: string): void => {
    try {
      removeSource(sourceId);
      toast({
        title: 'Source Removed',
        description: 'The source has been removed from your knowledge base',
      });
      setDeleteSourceId(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove source';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  };

  const handlePreviewSource = (source: DraftSource): void => {
    setPreviewSource(source);
  };

  // Helper function to render web source preview content
  const renderWebPreviewContent = (source: DraftSource): React.ReactElement => {
    const previewPages = source.metadata?.previewPages as unknown[] | undefined;
    const hasPreviewPages = Array.isArray(previewPages) && previewPages.length > 0;
    const hasPatterns = source.config?.include_patterns?.length || source.config?.exclude_patterns?.length;
    const hasStats = source.metadata?.wordCount;

    return (
      <div className="space-y-4">
        {/* Configuration Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Crawl Configuration</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="font-medium">URL:</span> <span className="text-blue-700">{source.url}</span>
            </div>
            <div>
              <span className="font-medium">Method:</span> <span className="text-gray-700">{source.config?.method || 'crawl'}</span>
            </div>
            <div>
              <span className="font-medium">Max Pages:</span> <span className="text-gray-700">{source.config?.max_pages || 50}</span>
            </div>
            <div>
              <span className="font-medium">Max Depth:</span> <span className="text-gray-700">{source.config?.max_depth || 3}</span>
            </div>
          </div>
          {hasPatterns ? (
            <div className="mt-3 space-y-1 text-sm">
              {source.config?.include_patterns?.length ? (
                <div><span className="font-medium">Include:</span> <span className="text-green-700">{source.config.include_patterns.join(', ')}</span></div>
              ) : null}
              {source.config?.exclude_patterns?.length ? (
                <div><span className="font-medium">Exclude:</span> <span className="text-red-700">{source.config.exclude_patterns.join(', ')}</span></div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Content Statistics */}
        {hasStats ? (
          <div className="flex gap-6 text-sm bg-gray-50 p-3 rounded">
            <span><strong>Total Pages:</strong> {(source.metadata?.pageCount as number) || 0}</span>
            <span><strong>Total Words:</strong> {((source.metadata?.wordCount as number) || 0).toLocaleString()}</span>
            <span><strong>Crawled At:</strong> {source.metadata?.crawledAt ? new Date(source.metadata.crawledAt as string).toLocaleString() : 'N/A'}</span>
          </div>
        ) : null}

        {/* Full Pages Content */}
        {hasPreviewPages ? (
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">Crawled Pages Content</h4>

            {/* First page always visible */}
            <Card className="border-gray-200">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <strong>Page 1:</strong> {String((previewPages![0] as Record<string, unknown>)?.title || (previewPages![0] as Record<string, unknown>)?.url || 'Main Page')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {String((previewPages![0] as Record<string, unknown>)?.content || '').split(/\s+/).filter(Boolean).length.toLocaleString()} words
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-48 overflow-y-auto bg-gray-50 p-3 rounded text-sm">
                  {String((previewPages![0] as Record<string, unknown>)?.content || 'No content extracted')}
                </div>
              </CardContent>
            </Card>

            {/* Additional pages collapsible */}
            {previewPages!.length > 1 ? (
              <Collapsible open={expandedPages} onOpenChange={setExpandedPages}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span>View All {previewPages!.length} Pages</span>
                    {expandedPages ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 mt-3">
                  {previewPages!.slice(1).map((page: unknown, index: number) => (
                    <Card key={index} className="border-gray-200">
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            <strong>Page {index + 2}:</strong> {String((page as Record<string, unknown>)?.title || (page as Record<string, unknown>)?.url || `Page ${index + 2}`)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {String((page as Record<string, unknown>)?.content || '').split(/\s+/).filter(Boolean).length} words
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="max-h-32 overflow-y-auto bg-gray-50 p-3 rounded text-sm">
                          {String((page as Record<string, unknown>)?.content || 'No content extracted')}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <AlertCircle className="h-5 w-5 text-amber-600 inline mr-2" />
            <span className="text-sm text-amber-800">
              Full content preview not available. Only configuration data is stored for this source.
            </span>
          </div>
        )}
      </div>
    );
  };

  // Helper function to render file source preview content
  const renderFilePreviewContent = (source: DraftSource): React.ReactElement => {
    const hasContent = source.metadata?.content;

    return (
      <div className="space-y-3">
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <p><strong>Filename:</strong> {(source.metadata?.file_name as string) || 'Unknown'}</p>
          <p><strong>Size:</strong> {(((source.metadata?.file_size as number) || 0) / 1024 / 1024).toFixed(2)} MB</p>
          <p><strong>Type:</strong> {(source.metadata?.file_type as string) || 'auto-detected'}</p>
        </div>
        {hasContent ? (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-semibold mb-2">File Content Preview</h4>
            <pre className="whitespace-pre-wrap text-sm max-h-64 overflow-y-auto bg-gray-50 p-3 rounded">
              {String(source.metadata!.content)}
            </pre>
          </div>
        ) : null}
      </div>
    );
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

                  {source.status === 'failed' ? (
                    <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      Processing failed. Please try again.
                    </p>
                  ) : null}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="capitalize">{source.type} source</span>
                    <span>Added {new Date().toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
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

      {/* Enhanced Preview Dialog with Full Pages Content */}
      <Dialog open={!!previewSource} onOpenChange={() => {
        setPreviewSource(null);
        setExpandedPages(false);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewSource ? getSourceIcon(previewSource.type) : null}
              Full Content Preview
            </DialogTitle>
            <DialogDescription>
              {previewSource ? getSourceTitle(previewSource) : ''}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[60vh]">
            <div className="p-4 space-y-4">
              {previewSource?.type === SourceType.TEXT ? (
                <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg">
                  {(previewSource.metadata?.content as string) || 'No content available'}
                </pre>
              ) : null}

              {previewSource?.type === SourceType.WEB ? renderWebPreviewContent(previewSource) : null}
              {previewSource?.type === SourceType.FILE ? renderFilePreviewContent(previewSource) : null}
            </div>
          </ScrollArea>

          <div className="flex justify-end mt-4 border-t pt-4">
            <Button onClick={() => {
              setPreviewSource(null);
              setExpandedPages(false);
            }}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}