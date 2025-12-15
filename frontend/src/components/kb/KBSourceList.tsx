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
import { useKBStore } from '@/store/kb-store';
import { toast } from '@/components/ui/use-toast';
import { ContentEditor } from '@/components/ui/content-editor';

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
    previewData
  } = useKBStore();

  if (sources.length === 0) {
    return (
      <div className="text-center py-8 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
        <AlertCircle className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 font-manrope">No Sources Added Yet</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4 font-manrope">
          Use the source types above to add content
        </p>
        <div className="text-sm text-gray-500 dark:text-gray-400 space-y-2 font-manrope">
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
          <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700 font-manrope font-medium">
            <CheckCircle className="h-3 w-3 mr-1.5" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700 font-manrope font-medium">
            <AlertCircle className="h-3 w-3 mr-1.5" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 font-manrope font-medium">
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
    console.log('✅ Loading source preview with', Array.isArray(currentSource.metadata?.previewPages) ? currentSource.metadata.previewPages.length : 0, 'pages');
    if (currentSource.metadata?.hasEdits) {
      console.log('📝 Source contains edited content');
    }
  };

  // Content editing handlers
  const handleEditPage = (pageIndex: number): void => {
    setEditingPageIndex(pageIndex);
  };

  const handleSaveEdit = async (pageIndex: number, content: string, _operations: any[]): Promise<void> => {
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
    const hasStats = source.metadata?.wordCount as number | undefined;

    return (
      <div className="space-y-4">
        {/* Configuration Summary */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-4 font-manrope flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Crawl Configuration
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-manrope">
            <div className="space-y-1">
              <span className="font-medium text-gray-900 dark:text-white">URL:</span>
              <p className="text-blue-700 dark:text-blue-300 break-all">{source.url}</p>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-gray-900 dark:text-white">Method:</span>
              <p className="text-gray-700 dark:text-gray-300 capitalize">{source.config?.method || 'crawl'}</p>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-gray-900 dark:text-white">Max Pages:</span>
              <p className="text-gray-700 dark:text-gray-300">{source.config?.max_pages || 50}</p>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-gray-900 dark:text-white">Max Depth:</span>
              <p className="text-gray-700 dark:text-gray-300">{source.config?.max_depth || 3}</p>
            </div>
          </div>
          {hasPatterns && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 space-y-2 text-sm font-manrope">
              {source.config?.include_patterns?.length ? (
                <div className="space-y-1">
                  <span className="font-medium text-gray-900 dark:text-white">Include Patterns:</span>
                  <div className="flex flex-wrap gap-1">
                    {source.config.include_patterns.map((pattern: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md text-xs border border-green-200 dark:border-green-700">
                        {pattern}
                      </span>
                    ))}
                  </div>
                </div>
              ) : <></>}
              {source.config?.exclude_patterns?.length ? (
                <div className="space-y-1">
                  <span className="font-medium text-gray-900 dark:text-white">Exclude Patterns:</span>
                  <div className="flex flex-wrap gap-1">
                    {source.config.exclude_patterns.map((pattern: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-xs border border-red-200 dark:border-red-700">
                        {pattern}
                      </span>
                    ))}
                  </div>
                </div>
              ) : <></>}
            </div>
          )}
        </div>

        {/* Content Statistics */}
        {hasStats && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4 font-manrope flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              Content Statistics
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm font-manrope">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <div className="font-semibold text-lg text-gray-900 dark:text-white">
                  {(source.metadata?.pageCount as number) || 0}
                </div>
                <div className="text-gray-600 dark:text-gray-400">Total Pages</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <div className="font-semibold text-lg text-gray-900 dark:text-white">
                  {((source.metadata?.wordCount as number) || 0).toLocaleString()}
                </div>
                <div className="text-gray-600 dark:text-gray-400">Total Words</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <div className="font-semibold text-sm text-gray-900 dark:text-white">
                  {source.metadata?.crawledAt ? new Date(source.metadata.crawledAt as string).toLocaleDateString() : 'N/A'}
                </div>
                <div className="text-gray-600 dark:text-gray-400">Crawled Date</div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Editable Pages Content */}
        {hasPreviewPages ? (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h4 className="font-semibold text-gray-900 dark:text-white text-base sm:text-lg font-manrope flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Crawled Pages Content
                </h4>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyAll}
                    className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 font-manrope"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Copy All Pages</span>
                    <span className="sm:hidden">Copy All</span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 font-manrope"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Export All</span>
                        <span className="sm:hidden">Export</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                      <DropdownMenuItem
                        onClick={() => handleExportFormat('markdown')}
                        className="font-manrope text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        📄 Export as Markdown
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleExportFormat('plain_text')}
                        className="font-manrope text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        📝 Export as Plain Text
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleExportFormat('html')}
                        className="font-manrope text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
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
                <Card key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 min-w-0 flex-shrink-0">
                  <CardHeader className="py-4 px-4 sm:px-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between w-full">
                      <div className="flex flex-col gap-3 min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white font-manrope break-words">
                          <span className="font-semibold text-blue-600 dark:text-blue-400">Page {index + 1}:</span>
                          <span className="ml-2">{title}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-manrope bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded-md">
                            {content.split(/\s+/).filter(Boolean).length.toLocaleString()} words
                          </div>
                          {isEdited && (
                            <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 font-manrope">
                              <Edit2 className="h-3 w-3 mr-1" />
                              Edited
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-row gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditPage(index)}
                          className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-manrope text-xs sm:text-sm"
                        >
                          <Edit2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          <span className="hidden sm:inline">Edit</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyPage(index)}
                          className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-manrope text-xs sm:text-sm"
                        >
                          <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                        {isEdited && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRevertPage(index)}
                            className="bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/50 font-manrope text-xs sm:text-sm"
                          >
                            <Undo2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            <span className="hidden sm:inline">Revert</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
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
                      <div className="max-h-48 overflow-auto bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 p-4 rounded-lg text-sm min-w-0">
                        <div className="whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300 leading-relaxed break-words overflow-wrap-anywhere">
                          {content || (
                            <span className="text-gray-500 dark:text-gray-400 italic">No content extracted</span>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-2 font-manrope">Content Preview Unavailable</h4>
                <p className="text-sm text-amber-700 dark:text-amber-400 font-manrope leading-relaxed">
                  Full content preview not available. Only configuration data is stored for this source.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Helper function to render file source preview content
  const renderFilePreviewContent = (source: DraftSource): React.ReactElement => {
    const hasContent = source.metadata?.content;

    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4 font-manrope flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            File Information
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm font-manrope">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="font-medium text-gray-900 dark:text-white mb-1">Filename</div>
              <div className="text-gray-600 dark:text-gray-400 break-all">{(source.metadata?.file_name as string) || 'Unknown'}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="font-medium text-gray-900 dark:text-white mb-1">Size</div>
              <div className="text-gray-600 dark:text-gray-400">{(((source.metadata?.file_size as number) || 0) / 1024 / 1024).toFixed(2)} MB</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="font-medium text-gray-900 dark:text-white mb-1">Type</div>
              <div className="text-gray-600 dark:text-gray-400">{(source.metadata?.file_type as string) || 'auto-detected'}</div>
            </div>
          </div>
        </div>
        {hasContent ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4 font-manrope flex items-center gap-2">
              <Eye className="h-5 w-5 text-green-600 dark:text-green-400" />
              File Content Preview
            </h4>
            <pre className="whitespace-pre-wrap text-sm max-h-64 overflow-y-auto bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 p-4 rounded-lg font-mono text-gray-900 dark:text-gray-100 leading-relaxed">
              {String(source.metadata!.content)}
            </pre>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white font-manrope">
          Added Sources ({sources.length})
        </h3>
      </div>

      <div className="space-y-4">
        {sources.map((source, index) => (
          <Card key={source.source_id || index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-600">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-shrink-0">
                      {getSourceIcon(source.type)}
                    </div>
                    <h4 className="font-semibold text-gray-900 dark:text-white truncate font-manrope text-base sm:text-lg">
                      {getSourceTitle(source)}
                    </h4>
                    {getStatusBadge(source)}
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 font-manrope">
                    {getSourceDescription(source)}
                  </p>

                  {source.status === 'failed' && (
                    <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg mb-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        <span className="font-manrope">Processing failed. Please try again.</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 font-manrope">
                    <span className="capitalize font-medium">{source.type} source</span>
                    <span>Added {new Date().toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 p-0 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg"
                      >
                        <Settings className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        <span className="sr-only">Source options</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                      <DropdownMenuItem
                        onClick={() => handlePreviewSource(source)}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-manrope text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 focus:bg-blue-50 dark:focus:bg-blue-900/20 rounded-md"
                      >
                        <Eye className="h-4 w-4" />
                        Preview Content
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteSourceId(source.source_id || `${index}`)}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-manrope text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:bg-red-50 dark:focus:bg-red-900/20 rounded-md"
                      >
                        <Trash2 className="h-4 w-4" />
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
        <DialogContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white font-manrope flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              Remove Source?
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">
              This will remove the source from your knowledge base draft.
              You can add it back later if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setDeleteSourceId(null)}
              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-manrope"
            >
              Cancel
            </Button>
            <Button
              onClick={() => deleteSourceId && handleDeleteSource(deleteSourceId)}
              className="bg-red-600 hover:bg-red-700 text-white font-manrope"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove Source
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enhanced Preview Dialog with Full Pages Content */}
      <Dialog open={!!previewSource} onOpenChange={() => {
        setPreviewSource(null);
        setEditingPageIndex(null);
      }}>
        <DialogContent className="w-[95vw] max-w-7xl h-[95vh] flex flex-col p-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl">
          <DialogHeader className="flex-shrink-0 p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <DialogTitle className="flex items-center gap-3 text-lg sm:text-xl font-semibold text-gray-900 dark:text-white font-manrope">
              {previewSource ? (
                <div className="flex items-center justify-center">
                  {getSourceIcon(previewSource.type)}
                </div>
              ) : null}
              Full Content Preview
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope mt-2">
              {previewSource ? getSourceTitle(previewSource) : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto bg-gray-50/50 dark:bg-gray-900/50">
            <div className="p-4 sm:p-6 space-y-6">
              {previewSource?.type === SourceType.TEXT && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-4 font-manrope flex items-center gap-2">
                    <Type className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Text Content
                  </h4>
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600 font-mono text-gray-900 dark:text-gray-100 leading-relaxed">
                    {(previewSource.metadata?.content as string) || 'No content available'}
                  </pre>
                </div>
              )}

              {previewSource?.type === SourceType.WEB && renderWebPreviewContent(previewSource)}
              {previewSource?.type === SourceType.FILE && renderFilePreviewContent(previewSource)}
            </div>
          </div>

          <div className="flex justify-between items-center p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
            <div className="text-sm text-gray-500 dark:text-gray-400 font-manrope">
              {previewSource && (
                <span>
                  {previewSource.type === SourceType.WEB && 'Website Source'}
                  {previewSource.type === SourceType.FILE && 'File Source'}
                  {previewSource.type === SourceType.TEXT && 'Text Source'}
                </span>
              )}
            </div>
            <Button
              onClick={() => {
                setPreviewSource(null);
                setEditingPageIndex(null);
              }}
              className="bg-gray-600 hover:bg-gray-700 text-white font-manrope px-6"
            >
              Close Preview
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}