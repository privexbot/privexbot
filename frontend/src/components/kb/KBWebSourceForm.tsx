/**
 * Web Source Form Component
 *
 * Form for adding web URLs with crawl configuration
 */

import { useState } from 'react';
import { Globe, Settings, Plus, Eye, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { CrawlMethod, WebSourceConfig, KBContext } from '@/types/knowledge-base';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import kbClient from '@/lib/kb-client';

interface KBWebSourceFormProps {
  onAdd: (sourceData: any) => void;
  onCancel: () => void;
  context?: KBContext; // Add context prop
}

export function KBWebSourceForm({ onAdd, onCancel, context = 'both' as KBContext }: KBWebSourceFormProps) {
  const { currentWorkspace } = useApp();
  const [url, setUrl] = useState('');
  const [bulkUrls, setBulkUrls] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [config, setConfig] = useState<Partial<WebSourceConfig>>({
    method: CrawlMethod.CRAWL as CrawlMethod,
    max_pages: 50,
    max_depth: 3,
    include_patterns: [] as string[],
    exclude_patterns: [] as string[],
  });
  const [includePattern, setIncludePattern] = useState('');
  const [excludePattern, setExcludePattern] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [bulkValidationResults, setBulkValidationResults] = useState<Array<{url: string, valid: boolean, error?: string}>>([]);
  const [bulkConfigs, setBulkConfigs] = useState<Record<string, Partial<WebSourceConfig>>>({});
  const [selectedBulkUrl, setSelectedBulkUrl] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    url: string,
    title: string,
    content: string,
    wordCount: number,
    chunks?: any[],
    fullPages?: any[],
    draftId?: string,
    sourceId?: string,
    configuration?: any
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState<string>('');
  const [canCancelPreview, setCanCancelPreview] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Cleanup function to delete temporary preview draft
  const cleanupPreviewDraft = async (draftId: string) => {
    try {
      await kbClient.draft.delete(draftId);
      console.log('Cleaned up preview draft:', draftId);
    } catch (error) {
      console.error('Failed to cleanup preview draft:', error);
    }
  };

  // Handle approve preview - add to main draft
  const handleApprovePreview = async () => {
    if (!previewData) return;

    try {
      // Call the original onAdd function with the configuration, URL, and full pages data
      onAdd({
        url: previewData.url,
        config: previewData.configuration,
        previewPages: previewData.fullPages, // Pass full pages for later preview
        metadata: {
          title: previewData.title,
          wordCount: previewData.wordCount,
          pageCount: previewData.fullPages?.length || 0,
          crawledAt: new Date().toISOString()
        }
      });

      // Clean up temporary preview draft
      if (previewData.draftId) {
        await cleanupPreviewDraft(previewData.draftId);
      }

      // Close preview
      setShowPreview(false);
      setPreviewData(null);

      toast({
        title: 'Source Added',
        description: `Added ${previewData.url} to your knowledge base`,
      });
    } catch (error) {
      console.error('Failed to approve preview:', error);
      toast({
        title: 'Error Adding Source',
        description: 'Failed to add the source to your knowledge base',
        variant: 'destructive'
      });
    }
  };

  // Handle reject preview - cleanup and close
  const handleRejectPreview = async () => {
    if (!previewData) return;

    // Clean up temporary preview draft
    if (previewData.draftId) {
      await cleanupPreviewDraft(previewData.draftId);
    }

    // Close preview
    setShowPreview(false);
    setPreviewData(null);

    toast({
      title: 'Preview Rejected',
      description: 'The content preview has been discarded',
    });
  };

  const crawlMethodOptions = [
    {
      value: CrawlMethod.SCRAPE,
      label: 'Single Page',
      description: 'Scrape content from a single page only'
    },
    {
      value: CrawlMethod.CRAWL,
      label: 'Crawl Website',
      description: 'Crawl multiple linked pages within the domain'
    }
  ];

  const handleUrlValidation = async (urlToValidate: string) => {
    if (!urlToValidate.trim()) {
      setValidationResult(null);
      return;
    }

    setIsValidating(true);
    try {
      const isValid = kbClient.errors.validateUrl(urlToValidate);
      const result = {
        valid: isValid,
        error: isValid ? undefined : 'Please enter a valid URL'
      };
      setValidationResult(result);

      if (!result.valid) {
        toast({
          title: 'Invalid URL',
          description: result.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('URL validation failed:', error);
      setValidationResult({ valid: false, error: 'Validation failed' });
    } finally {
      setIsValidating(false);
    }
  };

  const handleBulkUrlValidation = async (urls: string[]) => {
    setIsValidating(true);
    try {
      const results = urls.map(url => {
        const isValid = kbClient.errors.validateUrl(url);
        return {
          url,
          valid: isValid,
          error: isValid ? undefined : 'Invalid URL format'
        };
      });

      setBulkValidationResults(results);

      const invalidCount = results.filter(r => !r.valid).length;
      if (invalidCount > 0) {
        toast({
          title: 'URL Validation',
          description: `${invalidCount} of ${results.length} URLs are invalid`,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Bulk URL validation failed:', error);
      setBulkValidationResults([]);
    } finally {
      setIsValidating(false);
    }
  };

  const handlePreviewContent = async () => {
    // In bulk mode, preview ALL validated URLs, not just selected one
    const urlsToPreview = bulkMode
      ? bulkValidationResults.filter(r => r.valid).map(r => r.url)
      : [url];

    if (urlsToPreview.length === 0) {
      toast({
        title: 'No URLs to Preview',
        description: bulkMode ? 'Please validate URLs first' : 'Please enter a valid URL',
        variant: 'destructive'
      });
      return;
    }

    setIsLoadingPreview(true);
    setPreviewData(null);

    try {
      // Step 1: Create temporary preview draft if needed
      let previewDraft;
      try {
        const previewName = bulkMode && urlsToPreview.length > 1
          ? `Preview ${urlsToPreview.length} URLs`
          : `Preview ${urlsToPreview[0].substring(0, 50)}...`;

        previewDraft = await kbClient.draft.create({
          name: previewName,
          description: bulkMode && urlsToPreview.length > 1
            ? `Previewing ${urlsToPreview.length} URLs: ${urlsToPreview.map((u: string) => u.split('/')[2]).join(', ')}`
            : `Temporary draft for previewing ${urlsToPreview[0]}`,
          workspace_id: currentWorkspace?.id || 'default_workspace',
          context: context // Use dynamic context from props
        });
        console.log('Created preview draft:', previewDraft.draft_id);
      } catch (draftError) {
        console.error('Failed to create preview draft:', draftError);
        throw new Error('Unable to create preview draft. Please try again.');
      }

      // Step 2: Add ALL web sources to draft based on mode
      let sourceResponse;
      try {
        if (bulkMode && urlsToPreview.length > 1) {
          // Bulk mode: Add all URLs with their specific configurations
          for (const urlToAdd of urlsToPreview) {
            const sourceConfig = {
              method: config.method || CrawlMethod.CRAWL,
              max_pages: bulkConfigs[urlToAdd]?.max_pages || config.max_pages || 10,
              max_depth: bulkConfigs[urlToAdd]?.max_depth || config.max_depth || 3,
              // Use URL-specific patterns if available, otherwise empty array
              include_patterns: bulkConfigs[urlToAdd]?.include_patterns || [],
              exclude_patterns: bulkConfigs[urlToAdd]?.exclude_patterns || [],
              include_subdomains: config.include_subdomains || false,
              wait_time: config.wait_time || 0,
              headers: config.headers || {}
            };

            console.log(`Adding source ${urlToAdd} with config:`, sourceConfig);

            await kbClient.draft.addWebSources(previewDraft.draft_id, {
              url: urlToAdd,
              config: sourceConfig
            });
          }
          console.log(`Added ${urlsToPreview.length} sources to preview draft`);
          sourceResponse = { message: `Added ${urlsToPreview.length} sources` };
        } else {
          // Single URL mode
          const sourceConfig = {
            method: config.method || CrawlMethod.CRAWL,
            max_pages: config.max_pages || 10,
            max_depth: config.max_depth || 3,
            include_patterns: config.include_patterns || [],
            exclude_patterns: config.exclude_patterns || [],
            include_subdomains: config.include_subdomains || false,
            wait_time: config.wait_time || 0,
            headers: config.headers || {}
          };

        console.log('Preview configuration being sent:', {
          url: urlsToPreview[0],
          config: sourceConfig,
          draftId: previewDraft.draft_id
        });

        console.log('Current UI config state:', config);
        console.log('CrawlMethod values:', {
          CRAWL: CrawlMethod.CRAWL,
          SCRAPE: CrawlMethod.SCRAPE,
          currentMethod: config.method
        });

        sourceResponse = await kbClient.draft.addWebSources(previewDraft.draft_id, {
          url: urlsToPreview[0],
          config: sourceConfig
        });
        console.log('Added web source for preview:', sourceResponse);
        }
      } catch (sourceError) {
        console.error('Failed to add web source:', sourceError);
        // Clean up draft
        await kbClient.draft.delete(previewDraft.draft_id).catch(console.error);
        throw new Error('Unable to process URL. Please check the URL and try again.');
      }

      // Step 3: Run preview to crawl content with progress feedback
      console.log('🔥 CRITICAL FIX: Running preview to crawl content (missing step identified)...');
      setPreviewProgress('Starting crawl operation...');
      setCanCancelPreview(true);

      try {
        const previewResponse = await kbClient.draft.preview(previewDraft.draft_id, 5);
        console.log('✅ Preview triggered successfully:', previewResponse);
        setPreviewProgress('Crawl completed, processing results...');
      } catch (previewError) {
        console.error('❌ Preview failed:', previewError);
        setPreviewProgress('Preview failed, cleaning up...');
        await kbClient.draft.delete(previewDraft.draft_id).catch(console.error);
        throw new Error('Failed to crawl content. The website may be blocking automated access or your configuration needs adjustment.');
      }

      // Step 4: Wait for preview processing to complete
      // Multi-URL crawling can take 1-2 minutes, especially with multiple pages per URL
      const waitTime = bulkMode && urlsToPreview.length > 1 ? 15000 :
                       config.method === CrawlMethod.CRAWL ? 10000 : 6000;
      console.log(`⏳ Waiting ${waitTime}ms for preview processing to complete...`);
      console.log(`📊 Processing ${urlsToPreview.length} URL(s) with crawl method - this may take 1-2 minutes`);
      await new Promise(resolve => setTimeout(resolve, waitTime));

      let fullPages;
      let retryCount = 0;
      const maxRetries = 3;

      // Store sourceConfig reference for later comparison
      const sentConfig = {
        method: config.method || CrawlMethod.CRAWL,
        max_pages: config.max_pages || 50,
        max_depth: config.max_depth || 3,
        include_patterns: config.include_patterns || [],
        exclude_patterns: config.exclude_patterns || [],
        include_subdomains: config.include_subdomains || false,
        wait_time: config.wait_time || 0,
        headers: config.headers || {}
      };

      // Step 5: Get pages from preview data (should now have content!)
      while (retryCount < maxRetries) {
        try {
          // First check draft and source status
          const draftDetails = await kbClient.draft.get(previewDraft.draft_id);
          console.log(`Draft details (attempt ${retryCount + 1}) - FULL RESPONSE:`, JSON.stringify(draftDetails, null, 2));

          // Check for sources in the correct location (data.sources)
          let source = null;
          if ((draftDetails as any)?.data?.sources && Array.isArray((draftDetails as any).data.sources)) {
            const sources = (draftDetails as any).data.sources;

            if (bulkMode && urlsToPreview.length > 1) {
              // In bulk mode, check if all sources are present
              console.log(`🔍 BULK MODE: Checking for ${urlsToPreview.length} sources in data.sources array:`, sources);
              const foundSources = sources.filter((s: any) => urlsToPreview.includes(s.url));
              console.log(`Found ${foundSources.length}/${urlsToPreview.length} sources for bulk preview`);
              if (foundSources.length > 0) {
                source = foundSources[0]; // Use first source for preview purposes
                console.log('Using first source for bulk preview:', source);
              }
            } else if (sourceResponse?.source_id) {
              // Single mode: look for specific source_id
              source = sources.find((s: any) => s.id === sourceResponse.source_id);
              if (source) {
                console.log(`Source found in data.sources:`, source);
                console.log('🔍 CONFIG COMPARISON:');
                console.log('  Frontend sent:', sentConfig);
                console.log('  Backend stored:', source.config);
                console.log('  Config matches:', JSON.stringify(sentConfig) === JSON.stringify(source.config));
              } else {
                console.log(`Source with ID ${sourceResponse.source_id} not found in data.sources array:`, sources);
              }
            } else {
              // Single mode but no source_id available, try to find by URL
              source = sources.find((s: any) => s.url === urlsToPreview[0]);
              if (source) {
                console.log(`Source found by URL match:`, source);
              } else {
                console.log(`No source found for URL ${urlsToPreview[0]} in data.sources array:`, sources);
              }
            }
          } else if (draftDetails && Array.isArray(draftDetails.sources)) {
            // Fallback: check direct sources array (original expected structure)
            if (sourceResponse?.source_id) {
              source = draftDetails.sources.find((s: any) => s.source_id === sourceResponse.source_id);
              if (source) {
                console.log(`Source found in direct sources array:`, source);
              }
            }
          } else {
            console.log('Sources not found. Checking data.sources:', !!(draftDetails as any)?.data?.sources);
          }

          fullPages = await kbClient.draft.getPages(previewDraft.draft_id, 1, 10);
          console.log(`📄 Retrieved pages (attempt ${retryCount + 1}):`, fullPages);

          if (fullPages && fullPages.length > 0) {
            console.log('✅ SUCCESS: Pages found after preview!');
            break; // Success, exit retry loop
          }

          // Since backend doesn't provide source status, we rely on pages being available
          // If no pages but source exists, assume still processing and retry
          if (retryCount < maxRetries - 1) {
            console.log(`No pages found yet, retrying in 3 seconds... (attempt ${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 3000));
          }

        } catch (pagesError) {
          console.error(`Failed to get pages (attempt ${retryCount + 1}):`, pagesError);

          if (retryCount === maxRetries - 1) {
            // Clean up draft on final failure
            await kbClient.draft.delete(previewDraft.draft_id).catch(console.error);
            throw new Error('Content extraction is taking longer than expected. This may be due to the website being slow to respond or your crawl configuration. Please try again or adjust your settings.');
          }

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        retryCount++;
      }

      if (!fullPages || fullPages.length === 0) {
        // Clean up draft and provide helpful error message
        await kbClient.draft.delete(previewDraft.draft_id).catch(console.error);
        const methodType = config.method === CrawlMethod.CRAWL ? 'crawling multiple pages' : 'scraping single page';
        throw new Error(`No content could be extracted from this URL using ${methodType}. This could be due to:\n• The website blocks automated access\n• Your include/exclude patterns are too restrictive\n• The website requires JavaScript rendering\n• Try adjusting your crawl configuration or use a different URL.`);
      }

      // Step 4: Process and display full content preview
      const totalPages = fullPages.length;
      const totalContent = fullPages.map(page => page.content || '').join('\n\n');
      const totalWords = totalContent.split(/\s+/).filter(word => word.length > 0).length;
      const firstPageContent = fullPages[0]?.content || 'No content extracted';

      // In bulk mode, aggregate data from all URLs
      let aggregatedTitle = fullPages[0]?.title || new URL(urlsToPreview[0]).hostname;
      let aggregatedConfigs: Record<string, Partial<WebSourceConfig>> = {};

      if (bulkMode && urlsToPreview.length > 1) {
        aggregatedTitle = `${urlsToPreview.length} URLs from ${urlsToPreview.map(u => new URL(u).hostname).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`;

        // Store configurations for each URL that was processed
        urlsToPreview.forEach(url => {
          aggregatedConfigs[url] = {
            ...config,
            ...bulkConfigs[url],
            max_pages: bulkConfigs[url]?.max_pages || config.max_pages || 10,
            max_depth: bulkConfigs[url]?.max_depth || config.max_depth || 3,
            include_patterns: bulkConfigs[url]?.include_patterns || [],
            exclude_patterns: bulkConfigs[url]?.exclude_patterns || []
          };
        });
      }

      const realPreviewData = {
        url: bulkMode && urlsToPreview.length > 1 ? urlsToPreview.join(', ') : urlsToPreview[0],
        urls: bulkMode ? urlsToPreview : undefined, // Store all URLs for bulk mode
        title: aggregatedTitle,
        content: firstPageContent,
        wordCount: totalWords,
        chunks: [], // No chunks in full content preview
        fullPages: fullPages,
        draftId: previewDraft.draft_id, // Store draft ID for cleanup
        sourceId: sourceResponse?.source_id || `preview_${previewDraft.draft_id}`, // Handle bulk mode where source_id may be undefined
        configuration: config,
        perUrlConfigs: bulkMode ? aggregatedConfigs : undefined // Store per-URL configs for bulk
      };

      setPreviewData(realPreviewData);
      setShowPreview(true);

      toast({
        title: 'Content Preview Ready',
        description: `Extracted ${totalPages} page${totalPages !== 1 ? 's' : ''} with ${totalWords} words total`,
      });

    } catch (error: unknown) {
      console.error('Content preview failed:', error);

      let errorMessage = 'Unable to preview content. Please check the URL and try again.';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object') {
        const errorObj = error as any;
        if (errorObj.response?.data?.detail) {
          errorMessage = errorObj.response.data.detail;
        } else if (errorObj.response?.data?.message) {
          errorMessage = errorObj.response.data.message;
        } else if (errorObj.message) {
          errorMessage = errorObj.message;
        }
      }

      toast({
        title: 'Preview Failed',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsLoadingPreview(false);
      setPreviewProgress('');
      setCanCancelPreview(false);
    }
  };

  const handleAddPattern = (type: 'include' | 'exclude') => {
    const pattern = type === 'include' ? includePattern : excludePattern;
    if (!pattern.trim()) return;

    const updatedConfig = { ...config };
    if (type === 'include') {
      updatedConfig.include_patterns = [...(config.include_patterns || []), pattern];
      setIncludePattern('');
    } else {
      updatedConfig.exclude_patterns = [...(config.exclude_patterns || []), pattern];
      setExcludePattern('');
    }
    setConfig(updatedConfig);
  };

  const handleRemovePattern = (type: 'include' | 'exclude', index: number) => {
    const updatedConfig = { ...config };
    if (type === 'include') {
      updatedConfig.include_patterns = (config.include_patterns || []).filter((_: string, i: number) => i !== index);
    } else {
      updatedConfig.exclude_patterns = (config.exclude_patterns || []).filter((_: string, i: number) => i !== index);
    }
    setConfig(updatedConfig);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (bulkMode) {
      // Handle bulk URL submission
      const urls = bulkUrls
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      if (urls.length === 0) {
        toast({
          title: 'URLs Required',
          description: 'Please enter at least one URL',
          variant: 'destructive'
        });
        return;
      }

      // Validate all URLs
      const invalidUrls = urls.filter(url => !kbClient.errors.validateUrl(url));
      if (invalidUrls.length > 0) {
        toast({
          title: 'Invalid URLs',
          description: `${invalidUrls.length} URLs are invalid. Please fix them before adding.`,
          variant: 'destructive'
        });
        return;
      }

      // Merge global config with per-URL configs including patterns
      const finalUrlConfigs: Record<string, Partial<WebSourceConfig>> = {};
      for (const url of urls) {
        finalUrlConfigs[url] = {
          ...config,
          ...bulkConfigs[url],
          // Override with URL-specific patterns if they exist
          include_patterns: bulkConfigs[url]?.include_patterns || config.include_patterns || [],
          exclude_patterns: bulkConfigs[url]?.exclude_patterns || config.exclude_patterns || []
        };
      }

      onAdd({ urls, config, bulk: true, urlConfigs: finalUrlConfigs });

      // Reset form
      setBulkUrls('');
      setBulkValidationResults([]);
      setBulkConfigs({});
      setSelectedBulkUrl(null);
    } else {
      // Handle single URL submission
      if (!url.trim()) {
        toast({
          title: 'URL Required',
          description: 'Please enter a valid URL',
          variant: 'destructive'
        });
        return;
      }

      if (validationResult && !validationResult.valid) {
        toast({
          title: 'Invalid URL',
          description: 'Please fix the URL errors before adding',
          variant: 'destructive'
        });
        return;
      }

      onAdd({ url: url.trim(), config });

      // Reset form
      setUrl('');
      setValidationResult(null);
    }

    // Reset common config
    setConfig({
      method: CrawlMethod.CRAWL,
      max_pages: 50,
      max_depth: 3,
      include_patterns: [],
      exclude_patterns: [],
    });
  };

  return (
    <Card className="border-2 border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white font-manrope text-lg sm:text-xl">
          <Globe className="h-5 w-5 sm:h-6 sm:h-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          Add Website URL
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope text-sm sm:text-base">
          Enter a URL to scrape content from a website
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Bulk Mode Toggle */}
          <div className="flex items-start space-x-3 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <Checkbox
              id="bulk-mode"
              checked={bulkMode}
              onCheckedChange={(checked) => setBulkMode(!!checked)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label htmlFor="bulk-mode" className="text-sm sm:text-base font-medium text-gray-900 dark:text-white font-manrope cursor-pointer">
                Bulk URL Mode
              </Label>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-manrope mt-1">
                Add multiple URLs at once
              </p>
            </div>
          </div>

          {/* URL Input */}
          {!bulkMode ? (
            <div className="space-y-2">
              <Label htmlFor="url" className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">Website URL</Label>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Input
                  id="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setValidationResult(null);
                  }}
                  onBlur={(e) => handleUrlValidation(e.target.value)}
                  placeholder="https://example.com"
                  className={`flex-1 h-11 text-base border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-manrope ${
                    validationResult === null ? '' :
                    validationResult.valid ? 'border-green-500 dark:border-green-400' :
                    'border-red-500 dark:border-red-400'
                  }`}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 px-4 sm:w-auto border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg font-manrope whitespace-nowrap"
                  onClick={() => handleUrlValidation(url)}
                  disabled={isValidating || !url.trim()}
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    '✓ Validate'
                  )}
                </Button>
              </div>

              {validationResult && !validationResult.valid && (
                <div className="space-y-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400 font-manrope">{validationResult.error}</p>
                  {validationResult.suggestions && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-manrope">Suggestions:</p>
                      <div className="flex flex-wrap gap-1">
                        {validationResult.suggestions.map((suggestion: string, index: number) => (
                          <Button
                            key={index}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setUrl(suggestion)}
                            className="h-8 px-2 text-xs text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 font-manrope"
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {validationResult && validationResult.valid && (
                <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-600 dark:text-green-400 font-manrope flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    URL is valid and accessible
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Label htmlFor="bulk-urls" className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">Website URLs (one per line)</Label>
              <div className="space-y-3">
                <textarea
                  id="bulk-urls"
                  value={bulkUrls}
                  onChange={(e) => {
                    setBulkUrls(e.target.value);
                    setBulkValidationResults([]);
                  }}
                  onBlur={() => {
                    const urls = bulkUrls
                      .split('\n')
                      .map(url => url.trim())
                      .filter(url => url.length > 0);
                    if (urls.length > 0) {
                      handleBulkUrlValidation(urls);
                    }
                  }}
                  placeholder={`https://example.com/page1
https://example.com/page2
https://docs.example.com
...`}
                  className="w-full min-h-32 sm:min-h-40 p-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm sm:text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-manrope resize-none"
                  rows={6}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 px-4 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg font-manrope"
                  onClick={() => {
                    const urls = bulkUrls
                      .split('\n')
                      .map(url => url.trim())
                      .filter(url => url.length > 0);
                    if (urls.length > 0) {
                      handleBulkUrlValidation(urls);
                    }
                  }}
                  disabled={isValidating || !bulkUrls.trim()}
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    `Validate ${bulkUrls.split('\n').filter(url => url.trim().length > 0).length} URLs`
                  )}
                </Button>
              </div>

              {bulkValidationResults.length > 0 && (
                <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="text-sm text-gray-700 dark:text-gray-300 font-manrope font-medium">
                    Validation Results ({bulkValidationResults.filter(r => r.valid).length}/{bulkValidationResults.length} valid):
                  </div>
                  <div className="max-h-32 sm:max-h-40 overflow-y-auto space-y-1.5">
                    {bulkValidationResults.map((result, index) => (
                      <div
                        key={index}
                        className={`flex items-start gap-3 p-2 rounded-lg border ${
                          result.valid
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                        }`}
                      >
                        <span className="mt-0.5 flex-shrink-0">
                          {result.valid ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs sm:text-sm font-manrope truncate block" title={result.url}>{result.url}</span>
                          {result.error && <span className="text-xs font-manrope text-red-600 dark:text-red-400 mt-1 block">{result.error}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Per-URL Configuration */}
              {bulkValidationResults.length > 0 && bulkValidationResults.some(r => r.valid) && (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-muted-foreground">
                    Per-URL Overrides (Optional) - Leave blank to use global settings
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {bulkValidationResults.filter(r => r.valid).map((result) => (
                      <div key={result.url} className="p-3 border rounded-md bg-muted/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium truncate pr-2">{result.url}</div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedBulkUrl(selectedBulkUrl === result.url ? null : result.url);
                            }}
                          >
                            {selectedBulkUrl === result.url ? 'Hide Config' : 'Configure'}
                          </Button>
                        </div>

                        {selectedBulkUrl === result.url && (
                          <div className="space-y-3 mt-3 pt-3 border-t">
                            {/* Max Pages and Max Depth */}
                            <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label className="text-xs">Max Pages (default: {config.max_pages || 50})</Label>
                              <Input
                                type="number"
                                value={bulkConfigs[result.url]?.max_pages || ''}
                                onChange={(e) => {
                                  const value = e.target.value ? parseInt(e.target.value) : undefined;
                                  setBulkConfigs(prev => {
                                    const updated = { ...prev };
                                    if (value === undefined) {
                                      delete updated[result.url]?.max_pages;
                                      if (updated[result.url] && Object.keys(updated[result.url]).length === 0) {
                                        delete updated[result.url];
                                      }
                                    } else {
                                      updated[result.url] = {
                                        ...prev[result.url],
                                        max_pages: value
                                      };
                                    }
                                    return updated;
                                  });
                                }}
                                min={1}
                                max={200}
                                className="h-8"
                                placeholder={`Default: ${config.max_pages || 50}`}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Max Depth (default: {config.max_depth || 3})</Label>
                              <Input
                                type="number"
                                value={bulkConfigs[result.url]?.max_depth || ''}
                                onChange={(e) => {
                                  const value = e.target.value ? parseInt(e.target.value) : undefined;
                                  setBulkConfigs(prev => {
                                    const updated = { ...prev };
                                    if (value === undefined) {
                                      delete updated[result.url]?.max_depth;
                                      if (updated[result.url] && Object.keys(updated[result.url]).length === 0) {
                                        delete updated[result.url];
                                      }
                                    } else {
                                      updated[result.url] = {
                                        ...prev[result.url],
                                        max_depth: value
                                      };
                                    }
                                    return updated;
                                  });
                                }}
                                min={1}
                                max={10}
                                className="h-8"
                                placeholder={`Default: ${config.max_depth || 3}`}
                              />
                            </div>
                            </div>

                            {/* URL-Specific Include Patterns */}
                            <div className="space-y-2">
                              <Label className="text-xs">Include Patterns (for this URL)</Label>

                              {/* Pattern Suggestions */}
                              <div className="flex flex-wrap gap-1 mb-2">
                                <Label className="text-xs text-muted-foreground">Suggestions:</Label>
                                {(() => {
                                  const url = result.url;
                                  const path = new URL(url).pathname;
                                  const pathSegments = path.split('/').filter(Boolean);

                                  const suggestions = [];
                                  // Current path and all sub-paths
                                  if (path !== '/') {
                                    suggestions.push(`${path}/**`);
                                  }
                                  // Parent directory
                                  if (pathSegments.length > 1) {
                                    const parentPath = '/' + pathSegments.slice(0, -1).join('/');
                                    suggestions.push(`${parentPath}/**`);
                                  }
                                  // Common patterns based on URL
                                  if (path.includes('/docs')) suggestions.push('/**/docs/**');
                                  if (path.includes('/api')) suggestions.push('/**/api/**');
                                  if (path.includes('/concepts')) suggestions.push('/**/concepts/**');
                                  if (path.includes('/guide')) suggestions.push('/**/guide/**');
                                  if (path.includes('/sdk')) suggestions.push('/**/sdk/**');

                                  return suggestions.slice(0, 3).map((suggestion, idx) => (
                                    <Button
                                      key={idx}
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-6 text-xs"
                                      onClick={() => {
                                        setBulkConfigs(prev => {
                                          const current = prev[result.url] || {};
                                          const currentPatterns = current.include_patterns || [];
                                          if (!currentPatterns.includes(suggestion)) {
                                            return {
                                              ...prev,
                                              [result.url]: {
                                                ...current,
                                                include_patterns: [...currentPatterns, suggestion]
                                              }
                                            };
                                          }
                                          return prev;
                                        });
                                      }}
                                    >
                                      {suggestion}
                                    </Button>
                                  ));
                                })()}
                              </div>

                              <Input
                                placeholder="e.g., /docs/**, /api/**"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const input = e.currentTarget;
                                    const pattern = input.value.trim();
                                    if (pattern) {
                                      setBulkConfigs(prev => {
                                        const current = prev[result.url] || {};
                                        const currentPatterns = current.include_patterns || [];
                                        return {
                                          ...prev,
                                          [result.url]: {
                                            ...current,
                                            include_patterns: [...currentPatterns, pattern]
                                          }
                                        };
                                      });
                                      input.value = '';
                                    }
                                  }
                                }}
                              />
                              <div className="flex flex-wrap gap-1">
                                {bulkConfigs[result.url]?.include_patterns?.map((pattern: string, index: number) => (
                                  <Badge
                                    key={index}
                                    variant="secondary"
                                    className="cursor-pointer"
                                    onClick={() => {
                                      setBulkConfigs(prev => {
                                        const current = prev[result.url] || {};
                                        const patterns = current.include_patterns || [];
                                        return {
                                          ...prev,
                                          [result.url]: {
                                            ...current,
                                            include_patterns: patterns.filter((_, i) => i !== index)
                                          }
                                        };
                                      });
                                    }}
                                  >
                                    {pattern} ×
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            {/* URL-Specific Exclude Patterns */}
                            <div className="space-y-2">
                              <Label className="text-xs">Exclude Patterns (for this URL)</Label>
                              <Input
                                placeholder="e.g., /admin/**, *.pdf"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const input = e.currentTarget;
                                    const pattern = input.value.trim();
                                    if (pattern) {
                                      setBulkConfigs(prev => {
                                        const current = prev[result.url] || {};
                                        const currentPatterns = current.exclude_patterns || [];
                                        return {
                                          ...prev,
                                          [result.url]: {
                                            ...current,
                                            exclude_patterns: [...currentPatterns, pattern]
                                          }
                                        };
                                      });
                                      input.value = '';
                                    }
                                  }
                                }}
                              />
                              <div className="flex flex-wrap gap-1">
                                {bulkConfigs[result.url]?.exclude_patterns?.map((pattern: string, index: number) => (
                                  <Badge
                                    key={index}
                                    variant="outline"
                                    className="cursor-pointer"
                                    onClick={() => {
                                      setBulkConfigs(prev => {
                                        const current = prev[result.url] || {};
                                        const patterns = current.exclude_patterns || [];
                                        return {
                                          ...prev,
                                          [result.url]: {
                                            ...current,
                                            exclude_patterns: patterns.filter((_, i) => i !== index)
                                          }
                                        };
                                      });
                                    }}
                                  >
                                    {pattern} ×
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Basic Configuration */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">Crawl Method</Label>
              <Select
                value={config.method}
                onValueChange={(value) => setConfig({ ...config, method: value as CrawlMethod })}
              >
                <SelectTrigger className="h-11 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {crawlMethodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="font-manrope">
                      <div className="py-1">
                        <div className="font-medium text-gray-900 dark:text-white">{option.label}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                          {option.description}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced Options */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto h-11 px-4 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg font-manrope justify-start"
              >
                <Settings className="h-4 w-4 mr-2" />
                Advanced Options
                <span className="ml-auto text-sm">
                  {showAdvanced ? '▼' : '▶'}
                </span>
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-4 sm:space-y-6 mt-4 p-4 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700 rounded-lg">
              {/* Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">Max Pages</Label>
                  <Input
                    type="number"
                    min="1"
                    max="1000"
                    value={config.max_pages}
                    onChange={(e) =>
                      setConfig({ ...config, max_pages: parseInt(e.target.value) || 50 })
                    }
                    className="h-11 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-manrope"
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-manrope">1-1000 pages</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">Max Depth</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={config.max_depth}
                    onChange={(e) =>
                      setConfig({ ...config, max_depth: parseInt(e.target.value) || 3 })
                    }
                    className="h-11 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-manrope"
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-manrope">1-10 levels</p>
                </div>
              </div>

              {/* Include Patterns */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">Include Patterns</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="/docs/**, /api/**"
                    value={includePattern}
                    onChange={(e) => setIncludePattern(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPattern('include');
                      }
                    }}
                    className="flex-1 h-11 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-manrope"
                  />
                  <Button
                    type="button"
                    className="h-11 px-4 bg-blue-600 hover:bg-blue-700 text-white font-manrope rounded-lg whitespace-nowrap"
                    onClick={() => handleAddPattern('include')}
                    disabled={!includePattern.trim()}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Pattern
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(config.include_patterns || []).map((pattern: string, index: number) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="cursor-pointer bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 hover:bg-green-200 dark:hover:bg-green-900/50 font-manrope px-3 py-1"
                      onClick={() => handleRemovePattern('include', index)}
                    >
                      {pattern} ×
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-manrope">
                  Patterns to include in crawling
                </p>
              </div>

              {/* Exclude Patterns */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">Exclude Patterns</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="/admin/**, /auth/**"
                    value={excludePattern}
                    onChange={(e) => setExcludePattern(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPattern('exclude');
                      }
                    }}
                    className="flex-1 h-11 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-manrope"
                  />
                  <Button
                    type="button"
                    className="h-11 px-4 bg-red-600 hover:bg-red-700 text-white font-manrope rounded-lg whitespace-nowrap"
                    onClick={() => handleAddPattern('exclude')}
                    disabled={!excludePattern.trim()}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Pattern
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(config.exclude_patterns || []).map((pattern: string, index: number) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="cursor-pointer bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 font-manrope px-3 py-1"
                      onClick={() => handleRemovePattern('exclude', index)}
                    >
                      {pattern} ×
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-manrope">
                  Patterns to exclude from crawling
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Enhanced Content Preview with Approval Workflow */}
          {showPreview && previewData && (
            <Card className="border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-xl shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100 font-manrope text-lg sm:text-xl">
                    <Eye className="h-5 w-5 sm:h-6 sm:h-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    Full Content Preview
                  </CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleRejectPreview}
                    className="h-8 w-8 p-0 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex-shrink-0"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription className="text-blue-700 dark:text-blue-300 font-manrope text-sm sm:text-base pr-8">
                  Preview of extracted content from <span className="font-medium">{previewData.url}</span> based on your configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4 sm:space-y-6">
                  {/* Content Statistics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 p-4 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="text-center sm:text-left">
                      <span className="block text-xs text-blue-600 dark:text-blue-400 font-manrope uppercase tracking-wide">Total Pages</span>
                      <span className="block text-lg font-bold text-blue-900 dark:text-blue-100 font-manrope">{previewData.fullPages?.length || 0}</span>
                    </div>
                    <div className="text-center sm:text-left">
                      <span className="block text-xs text-blue-600 dark:text-blue-400 font-manrope uppercase tracking-wide">Total Words</span>
                      <span className="block text-lg font-bold text-blue-900 dark:text-blue-100 font-manrope">{previewData.wordCount.toLocaleString()}</span>
                    </div>
                    <div className="text-center sm:text-left">
                      <span className="block text-xs text-blue-600 dark:text-blue-400 font-manrope uppercase tracking-wide">Title</span>
                      <span className="block text-lg font-bold text-blue-900 dark:text-blue-100 font-manrope truncate" title={previewData.title}>{previewData.title}</span>
                    </div>
                  </div>

                  {/* Configuration Summary */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h4 className="font-medium mb-3 text-sm text-gray-900 dark:text-white font-manrope">Configuration Used:</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="block text-xs text-gray-600 dark:text-gray-400 font-manrope">Method:</span>
                        <span className="font-medium text-gray-900 dark:text-white font-manrope">{previewData.configuration?.method || 'Single Page'}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-600 dark:text-gray-400 font-manrope">Max Pages:</span>
                        <span className="font-medium text-gray-900 dark:text-white font-manrope">{previewData.configuration?.max_pages || 'Not set'}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-600 dark:text-gray-400 font-manrope">Max Depth:</span>
                        <span className="font-medium text-gray-900 dark:text-white font-manrope">{previewData.configuration?.max_depth || 'Not set'}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-600 dark:text-gray-400 font-manrope">Patterns:</span>
                        <span className="font-medium text-gray-900 dark:text-white font-manrope">{(previewData.configuration?.include_patterns?.length || 0) + (previewData.configuration?.exclude_patterns?.length || 0)} rules</span>
                      </div>
                    </div>
                  </div>

                  {/* First Page Content Preview */}
                  <div>
                    <h4 className="font-medium mb-3 text-gray-900 dark:text-white font-manrope">First Page Content:</h4>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-48 sm:max-h-64 overflow-y-auto">
                      <pre className="text-sm text-gray-700 dark:text-gray-300 font-manrope whitespace-pre-wrap break-words">
                        {previewData.content || 'No content could be extracted from the first page.'}
                      </pre>
                    </div>
                  </div>

                  {/* All Pages Preview */}
                  {previewData.fullPages && previewData.fullPages.length > 1 && (
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full sm:w-auto h-11 px-4 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg font-manrope"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          View All {previewData.fullPages.length} Pages
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-4 space-y-3">
                        {previewData.fullPages.slice(1).map((page, index) => (
                          <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-gray-600">
                              <div className="text-sm text-gray-600 dark:text-gray-400 font-manrope truncate" title={page.title || page.url}>
                                Page {index + 2}: {page.title || page.url}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500 font-manrope whitespace-nowrap">
                                {page.content?.split(/\s+/).length || 0} words
                              </div>
                            </div>
                            <div className="max-h-32 sm:max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                              <pre className="text-sm text-gray-700 dark:text-gray-300 font-manrope whitespace-pre-wrap break-words">
                                {page.content || 'No content extracted from this page.'}
                              </pre>
                            </div>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Decision Alert */}
                  <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2 font-manrope">Content Preview Complete</h4>
                      <p className="text-sm text-amber-700 dark:text-amber-300 font-manrope leading-relaxed">
                        This is the full content that would be extracted and added to your knowledge base.
                        Review the content quality and coverage before deciding.
                      </p>
                    </div>
                  </div>

                  {/* Approval Actions */}
                  <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRejectPreview}
                      className="order-2 sm:order-1 h-11 px-4 sm:px-6 text-red-600 dark:text-red-400 border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-manrope"
                    >
                      <XCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                      Reject & Discard
                    </Button>

                    <div className="order-3 sm:order-2 hidden sm:flex text-xs text-gray-500 dark:text-gray-400 font-manrope text-center px-4">
                      Preview based on your crawl configuration
                    </div>

                    <Button
                      type="button"
                      onClick={handleApprovePreview}
                      className="order-1 sm:order-3 h-11 px-4 sm:px-6 bg-green-600 hover:bg-green-700 text-white rounded-lg font-manrope"
                    >
                      <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                      Approve & Add Source
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="order-3 sm:order-1 h-11 px-4 sm:px-6 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg font-manrope"
            >
              Cancel
            </Button>

            {/* Preview Button - Fixed nested button issue */}
            {isLoadingPreview ? (
              <div className="order-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                <div className="flex items-center px-4 py-3 border border-blue-200 dark:border-blue-700 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex-1">
                  <Loader2 className="h-4 w-4 mr-3 animate-spin text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-sm font-manrope text-blue-700 dark:text-blue-300 truncate">
                      {bulkMode && bulkValidationResults.filter(r => r.valid).length > 1
                        ? `Crawling ${bulkValidationResults.filter(r => r.valid).length} URLs...`
                        : config.method === CrawlMethod.CRAWL ? 'Crawling website...' : 'Extracting content...'}
                    </span>
                    {previewProgress && (
                      <div className="text-xs text-blue-600 dark:text-blue-400 font-manrope mt-0.5 truncate">
                        {previewProgress}
                      </div>
                    )}
                  </div>
                </div>
                {canCancelPreview && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsLoadingPreview(false);
                      setPreviewProgress('');
                      setCanCancelPreview(false);
                      toast({
                        title: 'Preview Cancelled',
                        description: 'Preview operation was cancelled by user'
                      });
                    }}
                    className="h-11 px-4 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-manrope whitespace-nowrap"
                  >
                    Cancel Preview
                  </Button>
                )}
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={handlePreviewContent}
                disabled={bulkMode ?
                           bulkValidationResults.filter(r => r.valid).length === 0 :
                           !url.trim() || (validationResult && !validationResult.valid)
                         }
                className="order-2 h-11 px-4 sm:px-6 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg font-manrope"
              >
                <Eye className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Preview Content</span>
              </Button>
            )}

            <Button
              type="submit"
              disabled={isValidating ||
                       (bulkMode ?
                         bulkUrls.trim().length === 0 || (bulkValidationResults.length > 0 && bulkValidationResults.some(r => !r.valid)) :
                         !url.trim() || (validationResult && !validationResult.valid)
                       )}
              className="order-1 sm:order-3 h-11 px-4 sm:px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-manrope rounded-lg"
            >
              <Plus className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate">
                {bulkMode ?
                  `Add ${bulkUrls.split('\n').filter(url => url.trim().length > 0).length} URLs` :
                  'Add URL'
                }
              </span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}