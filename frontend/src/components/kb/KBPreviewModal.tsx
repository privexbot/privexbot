/**
 * Knowledge Base Preview Modal
 *
 * Preview chunking results before creating the knowledge base
 */

import { useState, useEffect } from 'react';
import { Eye, FileText, Zap, Settings, RefreshCw, Download, Search, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useKBStore } from '@/store/kb-store';

interface KBPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Types are imported from the main types file

export function KBPreviewModal({ open, onOpenChange }: KBPreviewModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');

  const {
    draftSources,
    chunkingConfig,
    previewDraft,
    previewData: storePreviewData,
    isLoadingPreview,
    previewError
  } = useKBStore();

  useEffect(() => {
    if (open && !storePreviewData && draftSources.length > 0) {
      generatePreview();
    }
  }, [open, draftSources.length]);

  const generatePreview = async () => {
    try {
      await previewDraft(5); // Preview first 5 pages
    } catch (error: any) {
      console.error('Preview generation failed:', error);
    }
  };

  // Remove the mock content function and use real API data

  const getSourceName = (source: any) => {
    switch (source.type) {
      case 'web':
        return source.url || 'Web Source';
      case 'file':
        return source.filename || 'File Source';
      case 'text':
        return source.title || 'Text Source';
      default:
        return 'Unknown Source';
    }
  };

  // Extract all chunks from all pages for filtering
  const allChunks = storePreviewData?.pages.flatMap((page, pageIndex) =>
    page.chunks.map((chunk, chunkIndex) => ({
      ...chunk,
      id: `${pageIndex}_${chunkIndex}`,
      source_id: page.url,
      source_name: page.title,
      chunk_index: chunkIndex,
      page_title: page.title,
      page_url: page.url
    }))
  ) || [];

  const filteredChunks = allChunks.filter(chunk => {
    const matchesSearch = !searchQuery || chunk.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSource = selectedSource === 'all' || chunk.source_id === selectedSource;
    return matchesSearch && matchesSource;
  });


  const handleRegeneratePreview = () => {
    generatePreview();
  };

  const exportPreview = () => {
    if (!storePreviewData) return;

    const exportData = {
      timestamp: new Date().toISOString(),
      config: chunkingConfig,
      preview_data: storePreviewData,
      chunks: allChunks.map(chunk => ({
        content: chunk.content,
        source_name: chunk.source_name,
        char_count: chunk.char_count,
        word_count: chunk.word_count
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kb-preview.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Chunking Preview
          </DialogTitle>
          <DialogDescription>
            Preview how your content will be split into chunks for the knowledge base
          </DialogDescription>
        </DialogHeader>

        {isLoadingPreview ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center space-y-4">
              <RefreshCw className="h-12 w-12 mx-auto animate-spin text-primary" />
              <h3 className="text-lg font-medium">Generating Preview</h3>
              <p className="text-muted-foreground">
                Processing {draftSources.length} sources with {chunkingConfig.strategy} strategy...
              </p>
              <Progress value={65} className="w-64 mx-auto" />
            </div>
          </div>
        ) : previewError ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-red-500" />
              <h3 className="text-lg font-medium">Preview Failed</h3>
              <p className="text-muted-foreground">{previewError}</p>
              <Button onClick={generatePreview}>Try Again</Button>
            </div>
          </div>
        ) : storePreviewData ? (
          <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{storePreviewData.total_chunks}</div>
                  <div className="text-sm text-muted-foreground">Total Chunks</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">
                    {allChunks.length > 0 ? Math.round(allChunks.reduce((sum, chunk) => sum + chunk.char_count, 0) / allChunks.length) : 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Avg Chars</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{storePreviewData.pages_previewed}</div>
                  <div className="text-sm text-muted-foreground">Pages</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{storePreviewData.pages.length}</div>
                  <div className="text-sm text-muted-foreground">Sources</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{storePreviewData.estimated_total_chunks}</div>
                  <div className="text-sm text-muted-foreground">Est. Total</div>
                </CardContent>
              </Card>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search chunks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <select
                className="px-3 py-2 border rounded-md"
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
              >
                <option value="all">All Sources</option>
                {storePreviewData.pages.map((page) => (
                  <option key={page.url} value={page.url}>
                    {page.title || page.url}
                  </option>
                ))}
              </select>

              <Button variant="outline" onClick={handleRegeneratePreview}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>

              <Button variant="outline" onClick={exportPreview}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>

            {/* Chunks Display */}
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-3">
                  {filteredChunks.map((chunk) => (
                    <Card key={chunk.id} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="font-medium text-sm">{chunk.source_name}</span>
                          <Badge variant="outline">Chunk {chunk.chunk_index + 1}</Badge>
                          <Badge variant="secondary">
                            {chunk.word_count} words
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {chunk.char_count} chars
                        </div>
                      </div>

                      <div className="bg-gray-50 p-3 rounded-lg">
                        <pre className="text-sm whitespace-pre-wrap font-mono overflow-x-auto">
                          {chunk.content.length > 500
                            ? chunk.content.substring(0, 500) + '...'
                            : chunk.content}
                        </pre>
                      </div>

                      {chunk.overlap_with_previous > 0 && (
                        <div className="mt-2">
                          <Badge variant="outline" className="text-xs">
                            {chunk.overlap_with_previous} chars overlap
                          </Badge>
                        </div>
                      )}

                      {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
                        <div className="mt-2">
                          <span className="text-xs text-muted-foreground">Metadata: </span>
                          {Object.entries(chunk.metadata).map(([key, value], index) => (
                            <Badge key={index} variant="secondary" className="mr-1">
                              {key}: {String(value)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </Card>
                  ))}

                  {filteredChunks.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-12 w-12 mx-auto mb-4" />
                      <p>No chunks match your search criteria</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Strategy Recommendation */}
            {storePreviewData.strategy_recommendation && (
              <Alert>
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  <strong>Recommendation:</strong> {storePreviewData.strategy_recommendation}
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center space-y-4">
              <Eye className="h-12 w-12 mx-auto text-gray-400" />
              <h3 className="text-lg font-medium">Preview Not Available</h3>
              <p className="text-muted-foreground">
                Add some sources to generate a preview
              </p>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-between border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close Preview
          </Button>

          {storePreviewData && (
            <div className="space-x-2">
              <Button variant="outline" onClick={handleRegeneratePreview} disabled={isLoadingPreview}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingPreview ? 'animate-spin' : ''}`} />
                Regenerate with Current Settings
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}