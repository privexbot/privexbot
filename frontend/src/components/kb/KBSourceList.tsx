/**
 * Knowledge Base Source List Component
 *
 * Displays added sources with preview and management actions
 */

import React, { useState } from 'react';
import { FileText, Globe, Type, Settings, Trash2, Eye, AlertCircle, CheckCircle, Edit2, Copy, Undo2, Download } from 'lucide-react';
import { SourceType, DraftSource } from '@/types/knowledge-base';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useKBStore } from '@/store/kb-store';
import { toast } from '@/components/ui/use-toast';
import { ContentEditor } from '@/components/ui/content-editor';
import { kbDraftApi } from '@/lib/kb-client';

interface KBSourceListProps {
  sources: DraftSource[];
}

export function KBSourceList({ sources }: KBSourceListProps) {
  const [deleteSourceId, setDeleteSourceId] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<DraftSource | null>(null);
  const [editingPageIndex, setEditingPageIndex] = useState<number | null>(null);

  const {
    removeSource,
    updateSource,
    draftSources,
    previewData,
    previewDraft,
    currentDraft
  } = useKBStore();

  if (sources.length === 0) {
    return (
      <div className="text-center py-8 px-4 bg-gray-50 rounded-lg border-2 border-dashed">
        <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Sources Added Yet</h3>
        <p className="text-gray-500 mb-2">
          Use the source types above to add content
        </p>
        <div className="text-sm text-gray-400 space-y-1">
          <p>1. Select a source type (Website, File, Text)</p>
          <p>2. Configure and preview the content</p>
          <p>3. Approve & add the source</p>
          <p>4. Continue to approval step</p>
        </div>
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

  const handlePreviewSource = async (source: DraftSource): Promise<void> => {
    // CRITICAL: Always use source-specific data (single source of truth)
    // Find the latest source data from the store to ensure we have current edits
    const currentSource = draftSources.find(s => s.source_id === source.source_id) || source;

    setPreviewSource(currentSource);

    // Check if source has its own preview pages in metadata
    const sourceHasPreviewPages = currentSource.metadata?.previewPages &&
                                   Array.isArray(currentSource.metadata.previewPages) &&
                                   currentSource.metadata.previewPages.length > 0;

    // For approved sources, we should always have preview data in metadata
    if (!sourceHasPreviewPages) {
      toast({
        title: 'Preview Unavailable',
        description: 'This source does not have preview data available. This may happen with older sources or if content extraction failed.',
        variant: 'destructive'
      });
      return;
    }

    // Success - source has its own preview data with any edits preserved
    console.log('✅ Loading source preview with', currentSource.metadata?.previewPages?.length, 'pages');
    if (currentSource.metadata?.hasEdits) {
      console.log('📝 Source contains edited content');
    }
  };

  // Content editing handlers
  const handleEditPage = (pageIndex: number): void => {
    setEditingPageIndex(pageIndex);
  };

  const handleSaveEdit = async (pageIndex: number, content: string, operations: any[]): Promise<void> => {
    try {
      if (!previewSource?.source_id) {
        throw new Error('No source ID available for editing');
      }

      // Update preview pages with edits
      const currentPreviewPages = (previewSource.metadata?.previewPages as any[]) || [];
      if (!currentPreviewPages[pageIndex]) {
        throw new Error(`Page ${pageIndex} not found`);
      }

      const updatedPages = [...currentPreviewPages];
      updatedPages[pageIndex] = {
        ...updatedPages[pageIndex],
        edited_content: content,
        original_content: updatedPages[pageIndex].original_content || updatedPages[pageIndex].content,
        is_edited: true,
        last_edited_at: new Date().toISOString()
      };

      // CRITICAL: Update the store's draftSources (single source of truth)
      updateSource(previewSource.source_id, {
        metadata: {
          ...previewSource.metadata,
          previewPages: updatedPages,
          hasEdits: updatedPages.some(p => p.is_edited),
          lastEditedAt: new Date().toISOString()
        }
      });

      // Update local component state for immediate UI feedback
      setPreviewSource({
        ...previewSource,
        metadata: {
          ...previewSource.metadata,
          previewPages: updatedPages,
          hasEdits: updatedPages.some(p => p.is_edited)
        }
      });

      setEditingPageIndex(null);
      toast({
        title: 'Content Edited',
        description: 'Edits saved. Final processing will use your edited content.',
      });
    } catch (error) {
      console.error('Failed to save content edit:', error);
      toast({
        title: 'Edit Failed',
        description: 'Failed to save edits.',
        variant: 'destructive'
      });
    }
  };

  const handleRevertPage = async (pageIndex: number): Promise<void> => {
    try {
      if (!previewSource?.source_id) {
        throw new Error('No source ID available for reverting');
      }

      // Revert the page to original content
      const currentPreviewPages = (previewSource.metadata?.previewPages as any[]) || [];
      if (!currentPreviewPages[pageIndex]) {
        throw new Error(`Page ${pageIndex} not found`);
      }

      const updatedPages = [...currentPreviewPages];
      // Remove edited content and reset to original
      delete updatedPages[pageIndex].edited_content;
      updatedPages[pageIndex].is_edited = false;
      delete updatedPages[pageIndex].last_edited_at;

      // CRITICAL: Update the store's draftSources (single source of truth)
      updateSource(previewSource.source_id, {
        metadata: {
          ...previewSource.metadata,
          previewPages: updatedPages,
          hasEdits: updatedPages.some(p => p.is_edited),
          lastEditedAt: new Date().toISOString()
        }
      });

      // Update local component state for immediate UI feedback
      setPreviewSource({
        ...previewSource,
        metadata: {
          ...previewSource.metadata,
          previewPages: updatedPages,
          hasEdits: updatedPages.some(p => p.is_edited)
        }
      });

      toast({
        title: 'Content Reverted',
        description: 'Content has been reverted to original version.',
      });
    } catch (error) {
      console.error('Failed to revert content:', error);
      toast({
        title: 'Revert Failed',
        description: 'Failed to revert content. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleCopyPage = async (pageIndex: number): Promise<void> => {
    try {
      // Frontend-only copy - get content from local state
      const sourcePreviewPages = (previewSource?.metadata?.previewPages ||
                                 previewSource?.metadata?.pages ||
                                 previewSource?.metadata?.preview_pages) as any[] | undefined;
      const storePreviewPages = previewData?.pages || [];
      const pages = sourcePreviewPages && sourcePreviewPages.length > 0 ? sourcePreviewPages : storePreviewPages;

      if (pages[pageIndex]) {
        const page = pages[pageIndex];
        const content = page.edited_content || page.content || '';
        const title = page.title || page.url || `Page ${pageIndex + 1}`;
        const formattedContent = `# ${title}\n\n${content}`;

        await navigator.clipboard.writeText(formattedContent);
        toast({
          title: 'Content Copied',
          description: 'Page content has been copied to clipboard.',
        });
      } else {
        throw new Error('Page not found');
      }
    } catch (error) {
      console.error('Failed to copy page content:', error);
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy content to clipboard.',
        variant: 'destructive'
      });
    }
  };

  const handleCopyAll = async (): Promise<void> => {
    try {
      // Frontend-only copy all - get content from local state
      const sourcePreviewPages = (previewSource?.metadata?.previewPages ||
                                 previewSource?.metadata?.pages ||
                                 previewSource?.metadata?.preview_pages) as any[] | undefined;
      const storePreviewPages = previewData?.pages || [];
      const pages = sourcePreviewPages && sourcePreviewPages.length > 0 ? sourcePreviewPages : storePreviewPages;

      if (pages.length === 0) {
        toast({
          title: 'No Content',
          description: 'No pages available to copy.',
          variant: 'destructive'
        });
        return;
      }

      // Combine all page content
      const allContent = pages.map((page, index) => {
        const content = page.edited_content || page.content || '';
        const title = page.title || page.url || `Page ${index + 1}`;
        return `# ${title}\n\n${content}\n\n---\n`;
      }).join('\n');

      await navigator.clipboard.writeText(allContent);
      toast({
        title: 'Content Copied',
        description: `All ${pages.length} pages copied to clipboard.`,
      });
    } catch (error) {
      console.error('Failed to copy all content:', error);
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy content to clipboard.',
        variant: 'destructive'
      });
    }
  };

  const handleExportFormat = async (format: 'markdown' | 'plain_text' | 'html'): Promise<void> => {
    try {
      // Frontend-only export - format content from local state
      const sourcePreviewPages = (previewSource?.metadata?.previewPages ||
                                 previewSource?.metadata?.pages ||
                                 previewSource?.metadata?.preview_pages) as any[] | undefined;
      const storePreviewPages = previewData?.pages || [];
      const pages = sourcePreviewPages && sourcePreviewPages.length > 0 ? sourcePreviewPages : storePreviewPages;

      if (pages.length === 0) {
        toast({
          title: 'No Content',
          description: 'No pages available to export.',
          variant: 'destructive'
        });
        return;
      }

      let exportContent = '';
      let fileExtension = '';
      let mimeType = '';

      if (format === 'markdown') {
        exportContent = pages.map((page, index) => {
          const content = page.edited_content || page.content || '';
          const title = page.title || page.url || `Page ${index + 1}`;
          return `# ${title}\n\n${content}\n\n---\n`;
        }).join('\n');
        fileExtension = 'md';
        mimeType = 'text/markdown';
      } else if (format === 'plain_text') {
        exportContent = pages.map((page, index) => {
          const content = page.edited_content || page.content || '';
          const title = page.title || page.url || `Page ${index + 1}`;
          return `${title}\n${'='.repeat(title.length)}\n\n${content}\n\n`;
        }).join('\n');
        fileExtension = 'txt';
        mimeType = 'text/plain';
      } else if (format === 'html') {
        exportContent = `<!DOCTYPE html>
<html>
<head>
    <title>Exported Content</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
        .page { margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #ccc; }
        pre { white-space: pre-wrap; background: #f5f5f5; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
${pages.map((page, index) => {
  const content = page.edited_content || page.content || '';
  const title = page.title || page.url || `Page ${index + 1}`;
  return `    <div class="page">
        <h1>${title}</h1>
        <pre>${content}</pre>
    </div>`;
}).join('\n')}
</body>
</html>`;
        fileExtension = 'html';
        mimeType = 'text/html';
      }

      // Create and download file
      const blob = new Blob([exportContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exported-content.${fileExtension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export Complete',
        description: `Content exported as ${format}.`,
      });
    } catch (error) {
      console.error('Failed to export content:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export content.',
        variant: 'destructive'
      });
    }
  };

  // Helper function to render web source preview content
  const renderWebPreviewContent = (source: DraftSource): React.ReactElement => {
    // Get preview pages from source metadata first, then fall back to store
    // Check multiple possible keys where preview pages might be stored
    const sourcePreviewPages = (source.metadata?.previewPages ||
                               source.metadata?.pages ||
                               source.metadata?.preview_pages) as any[] | undefined;
    const storePreviewPages = previewData?.pages || [];
    const previewPages = sourcePreviewPages && sourcePreviewPages.length > 0 ? sourcePreviewPages : storePreviewPages;
    const hasPreviewPages = Array.isArray(previewPages) && previewPages.length > 0;

    // Data flow confirmed working - preview pages loaded successfully
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

        {/* Enhanced Editable Pages Content */}
        {hasPreviewPages ? (
          <div className="space-y-4">
            <div className="bg-white p-3 sm:p-4 rounded-lg border shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Crawled Pages Content</h4>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                  <Button variant="outline" size="sm" onClick={handleCopyAll} className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100">
                    <Copy className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Copy All Pages</span>
                    <span className="sm:hidden">Copy All</span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
                        <Download className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Export All</span>
                        <span className="sm:hidden">Export</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExportFormat('markdown')}>
                        📄 Export as Markdown
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportFormat('plain_text')}>
                        📝 Export as Plain Text
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportFormat('html')}>
                        🌐 Export as HTML
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            {/* Editable Page Cards */}
            {previewPages.map((page, index) => {
              // Handle both original PagePreview and extended edited page data
              const pageData = page as any; // Allow for extended properties
              const isEdited = pageData.is_edited as boolean || false;
              const content = (pageData.edited_content as string) || page.content || '';
              const originalContent = (pageData.original_content as string) || page.content || '';
              const title = page.title || page.url || `Page ${index + 1}`;

              return (
                <Card key={index} className="border-gray-200 min-w-0 flex-shrink-0">
                  <CardHeader className="py-3 px-3 sm:px-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between w-full">
                      <div className="flex flex-col gap-2 min-w-0 flex-1">
                        <div className="text-sm font-medium break-words">
                          <strong>Page {index + 1}:</strong> <span className="font-normal">{title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-muted-foreground">
                            {content.split(/\s+/).filter(Boolean).length.toLocaleString()} words
                          </div>
                          {isEdited && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              <Edit2 className="h-3 w-3 mr-1" />
                              Edited
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-row gap-2 sm:flex-row sm:items-center flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditPage(index)}
                          className="bg-white text-xs sm:text-sm"
                        >
                          <Edit2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          <span className="hidden sm:inline">Edit</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyPage(index)}
                          className="bg-white text-xs sm:text-sm"
                        >
                          <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                        {isEdited && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRevertPage(index)}
                            className="text-orange-600 border-orange-200 hover:bg-orange-50 text-xs sm:text-sm"
                          >
                            <Undo2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            <span className="hidden sm:inline">Revert</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {editingPageIndex === index ? (
                      <ContentEditor
                        pageIndex={index}
                        originalContent={originalContent}
                        editedContent={isEdited ? content : undefined}
                        title={title}
                        onSave={async (content, operations) => await handleSaveEdit(index, content, operations)}
                        onCancel={() => setEditingPageIndex(null)}
                        onRevert={() => handleRevertPage(index)}
                      />
                    ) : (
                      <div className="max-h-48 overflow-auto bg-gray-50 p-4 rounded text-sm border min-w-0">
                        <div className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed break-words overflow-wrap-anywhere">
                          {content || 'No content extracted'}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
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
      }}>
        <DialogContent className="w-[95vw] max-w-7xl h-[95vh] flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 p-4 sm:p-6 border-b">
            <DialogTitle className="flex items-center gap-2">
              {previewSource ? getSourceIcon(previewSource.type) : null}
              Full Content Preview
            </DialogTitle>
            <DialogDescription>
              {previewSource ? getSourceTitle(previewSource) : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {previewSource?.type === SourceType.TEXT ? (
                <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg">
                  {(previewSource.metadata?.content as string) || 'No content available'}
                </pre>
              ) : null}

              {previewSource?.type === SourceType.WEB ? renderWebPreviewContent(previewSource) : null}
              {previewSource?.type === SourceType.FILE ? renderFilePreviewContent(previewSource) : null}
            </div>
          </div>

          <div className="flex justify-end p-4 border-t flex-shrink-0">
            <Button onClick={() => {
              setPreviewSource(null);
            }}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}