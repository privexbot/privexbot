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
  // Store preview draft ID for cancellation cleanup
  const [currentPreviewDraftId, setCurrentPreviewDraftId] = useState<string | null>(null);

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
      // Clear tracked draft ID
      setCurrentPreviewDraftId(null);

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
    // Clear tracked draft ID
    setCurrentPreviewDraftId(null);

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
        // Store draft ID for cancellation cleanup immediately
        setCurrentPreviewDraftId(previewDraft.draft_id);
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
      // Clear draft ID on any exit - errors already cleanup draft in catch blocks,
      // and success path sets previewData which has draftId for approve/reject handlers
      setCurrentPreviewDraftId(null);
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

              {bulkValidationResults.length > 0 ? (
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
              ) : bulkUrls.trim().length > 0 ? (
                <div className="p-6 text-center bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-6 w-6 text-amber-600 dark:text-amber-400 animate-spin" />
                    <div>
                      <h4 className="font-medium text-amber-800 dark:text-amber-200 font-manrope mb-1">
                        Validation Needed
                      </h4>
                      <p className="text-sm text-amber-700 dark:text-amber-300 font-manrope">
                        Click "Validate URLs" to check your URLs before proceeding
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex flex-col items-center gap-4">
                    <Globe className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    <div className="space-y-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white font-manrope">
                        No URLs Added Yet
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope max-w-sm mx-auto leading-relaxed">
                        Enter your website URLs above (one per line) to get started with bulk content extraction
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2 mt-2">
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full font-manrope">
                        📄 Multiple pages supported
                      </span>
                      <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1 rounded-full font-manrope">
                        ⚙️ Per-URL configuration
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Enhanced Per-URL Configuration */}
              {bulkValidationResults.length > 0 && bulkValidationResults.some(r => r.valid) && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <Settings className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 font-manrope mb-1">
                          Per-URL Configuration (Optional)
                        </h3>
                        <p className="text-xs text-blue-700 dark:text-blue-300 font-manrope leading-relaxed">
                          Customize crawl settings for individual URLs. Leave blank to use global settings defined above.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="text-xs bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full font-manrope">
                            {bulkValidationResults.filter(r => r.valid).length} URLs ready
                          </span>
                          <span className="text-xs bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded-full font-manrope">
                            {Object.keys(bulkConfigs).length} customized
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
                    {bulkValidationResults.filter(r => r.valid).map((result, index) => {
                      const hasCustomConfig = bulkConfigs[result.url] && Object.keys(bulkConfigs[result.url]).length > 0;
                      const isExpanded = selectedBulkUrl === result.url;

                      return (
                        <div key={result.url} className={`bg-white dark:bg-gray-800 border-2 rounded-xl overflow-hidden transition-all duration-200 ${
                          hasCustomConfig
                            ? 'border-blue-200 dark:border-blue-700 shadow-md'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}>
                          <div className="p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                  hasCustomConfig
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                }`}>
                                  {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-medium text-gray-900 dark:text-white font-manrope truncate" title={result.url}>
                                    {new URL(result.url).hostname}
                                  </h4>
                                  <p className="text-xs text-gray-600 dark:text-gray-400 font-manrope truncate">
                                    {result.url}
                                  </p>
                                  {hasCustomConfig && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                      <span className="text-xs text-blue-600 dark:text-blue-400 font-manrope">
                                        Custom configuration applied
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant={hasCustomConfig ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                  setSelectedBulkUrl(selectedBulkUrl === result.url ? null : result.url);
                                }}
                                className={`h-9 px-3 rounded-lg font-manrope whitespace-nowrap transition-all duration-200 ${
                                  hasCustomConfig
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                              >
                                {isExpanded ? (
                                  <>
                                    <span className="hidden sm:inline">Hide Config</span>
                                    <span className="sm:hidden">Hide</span>
                                    <span className="ml-2">▲</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="hidden sm:inline">{hasCustomConfig ? 'Edit Config' : 'Configure'}</span>
                                    <span className="sm:hidden">{hasCustomConfig ? 'Edit' : 'Config'}</span>
                                    <span className="ml-2">▼</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>

                          {selectedBulkUrl === result.url && (
                            <div className="border-t border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800/50 dark:to-blue-900/10 p-4">
                              <div className="space-y-4">
                                {/* Configuration Header */}
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium text-gray-900 dark:text-white font-manrope text-sm">
                                    Custom Configuration
                                  </h4>
                                  {hasCustomConfig && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setBulkConfigs(prev => {
                                          const updated = { ...prev };
                                          delete updated[result.url];
                                          return updated;
                                        });
                                      }}
                                      className="h-8 px-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md font-manrope text-xs"
                                    >
                                      Reset to Global
                                    </Button>
                                  )}
                                </div>

                                {/* Max Pages and Max Depth */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 font-manrope">
                                      Max Pages
                                      <span className="text-gray-500 dark:text-gray-400">(global: {config.max_pages || 50})</span>
                                    </Label>
                                    <div className="relative">
                                      <Input
                                        type="number"
                                        value={bulkConfigs[result.url]?.max_pages || ''}
                                        onChange={(e) => {
                                          const value = e.target.value ? parseInt(e.target.value) : undefined;
                                          setBulkConfigs(prev => {
                                            const updated = { ...prev };
                                            if (value === undefined) {
                                              if (updated[result.url]) {
                                                delete updated[result.url].max_pages;
                                                if (Object.keys(updated[result.url]).length === 0) {
                                                  delete updated[result.url];
                                                }
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
                                        max={500}
                                        className="h-10 pr-16 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-manrope"
                                        placeholder={`Default: ${config.max_pages || 50}`}
                                      />
                                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                        <span className="text-xs text-gray-400 dark:text-gray-500 font-manrope">pages</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 font-manrope">
                                      Max Depth
                                      <span className="text-gray-500 dark:text-gray-400">(global: {config.max_depth || 3})</span>
                                    </Label>
                                    <div className="relative">
                                      <Input
                                        type="number"
                                        value={bulkConfigs[result.url]?.max_depth || ''}
                                        onChange={(e) => {
                                          const value = e.target.value ? parseInt(e.target.value) : undefined;
                                          setBulkConfigs(prev => {
                                            const updated = { ...prev };
                                            if (value === undefined) {
                                              if (updated[result.url]) {
                                                delete updated[result.url].max_depth;
                                                if (Object.keys(updated[result.url]).length === 0) {
                                                  delete updated[result.url];
                                                }
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
                                        className="h-10 pr-16 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-manrope"
                                        placeholder={`Default: ${config.max_depth || 3}`}
                                      />
                                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                        <span className="text-xs text-gray-400 dark:text-gray-500 font-manrope">levels</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* URL-Specific Include Patterns */}
                                <div className="space-y-3">
                                  <div>
                                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 font-manrope mb-2 block">
                                      Include Patterns (URL-specific)
                                    </Label>

                                    {/* Smart Pattern Suggestions */}
                                    <div className="mb-3">
                                      <span className="text-xs text-gray-600 dark:text-gray-400 font-manrope mb-2 block">Quick suggestions:</span>
                                      <div className="flex flex-wrap gap-2">
                                        {(() => {
                                          try {
                                            const urlObj = new URL(result.url);
                                            const path = urlObj.pathname;
                                            const pathSegments = path.split('/').filter(Boolean);
                                            const suggestions = [];

                                            if (path !== '/') suggestions.push(`${path}/**`);
                                            if (pathSegments.length > 1) {
                                              const parentPath = '/' + pathSegments.slice(0, -1).join('/');
                                              suggestions.push(`${parentPath}/**`);
                                            }
                                            if (path.includes('/docs')) suggestions.push('/**/docs/**');
                                            if (path.includes('/api')) suggestions.push('/**/api/**');
                                            if (path.includes('/guide')) suggestions.push('/**/guide/**');

                                            return suggestions.slice(0, 3).map((suggestion, idx) => (
                                              <Button
                                                key={idx}
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 text-xs border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md font-manrope"
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
                                                + {suggestion}
                                              </Button>
                                            ));
                                          } catch {
                                            return [];
                                          }
                                        })()}
                                      </div>
                                    </div>

                                    <div className="flex gap-2">
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
                                                if (!currentPatterns.includes(pattern)) {
                                                  return {
                                                    ...prev,
                                                    [result.url]: {
                                                      ...current,
                                                      include_patterns: [...currentPatterns, pattern]
                                                    }
                                                  };
                                                }
                                                return prev;
                                              });
                                              input.value = '';
                                            }
                                          }
                                        }}
                                        className="flex-1 h-10 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-manrope"
                                      />
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-10 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-manrope whitespace-nowrap"
                                        onClick={(e) => {
                                          const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                                          const pattern = input?.value.trim();
                                          if (pattern) {
                                            setBulkConfigs(prev => {
                                              const current = prev[result.url] || {};
                                              const currentPatterns = current.include_patterns || [];
                                              if (!currentPatterns.includes(pattern)) {
                                                return {
                                                  ...prev,
                                                  [result.url]: {
                                                    ...current,
                                                    include_patterns: [...currentPatterns, pattern]
                                                  }
                                                };
                                              }
                                              return prev;
                                            });
                                            input.value = '';
                                          }
                                        }}
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    </div>

                                    {bulkConfigs[result.url]?.include_patterns && bulkConfigs[result.url]!.include_patterns!.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 mt-2">
                                        {bulkConfigs[result.url]?.include_patterns?.map((pattern: string, index: number) => (
                                          <Badge
                                            key={index}
                                            variant="secondary"
                                            className="cursor-pointer bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 hover:bg-green-200 dark:hover:bg-green-900/50 font-manrope px-2 py-1 text-xs"
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
                                    )}
                                  </div>

                                  {/* URL-Specific Exclude Patterns */}
                                  <div>
                                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 font-manrope mb-2 block">
                                      Exclude Patterns (URL-specific)
                                    </Label>
                                    <div className="flex gap-2">
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
                                                if (!currentPatterns.includes(pattern)) {
                                                  return {
                                                    ...prev,
                                                    [result.url]: {
                                                      ...current,
                                                      exclude_patterns: [...currentPatterns, pattern]
                                                    }
                                                  };
                                                }
                                                return prev;
                                              });
                                              input.value = '';
                                            }
                                          }
                                        }}
                                        className="flex-1 h-10 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 font-manrope"
                                      />
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-10 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-manrope whitespace-nowrap"
                                        onClick={(e) => {
                                          const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                                          const pattern = input?.value.trim();
                                          if (pattern) {
                                            setBulkConfigs(prev => {
                                              const current = prev[result.url] || {};
                                              const currentPatterns = current.exclude_patterns || [];
                                              if (!currentPatterns.includes(pattern)) {
                                                return {
                                                  ...prev,
                                                  [result.url]: {
                                                    ...current,
                                                    exclude_patterns: [...currentPatterns, pattern]
                                                  }
                                                };
                                              }
                                              return prev;
                                            });
                                            input.value = '';
                                          }
                                        }}
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    </div>

                                    {bulkConfigs[result.url]?.exclude_patterns && bulkConfigs[result.url]!.exclude_patterns!.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 mt-2">
                                        {bulkConfigs[result.url]?.exclude_patterns?.map((pattern: string, index: number) => (
                                          <Badge
                                            key={index}
                                            variant="outline"
                                            className="cursor-pointer bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 font-manrope px-2 py-1 text-xs"
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
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && handleRejectPreview()}>
              <Card className="w-full max-w-6xl max-h-[90vh] border-2 border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex flex-col">
                <CardHeader className="pb-4 border-b border-blue-200 dark:border-blue-800 flex-shrink-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100 font-manrope text-lg sm:text-xl">
                        <Eye className="h-5 w-5 sm:h-6 sm:h-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        Full Content Preview
                      </CardTitle>
                      <CardDescription className="text-blue-700 dark:text-blue-300 font-manrope text-sm sm:text-base mt-1">
                        Preview of extracted content from <span className="font-medium break-words">{previewData.url}</span>
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleRejectPreview}
                      className="h-9 w-9 p-0 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex-shrink-0"
                    >
                      <XCircle className="h-5 w-5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto">
                  <div className="space-y-4 sm:space-y-6 p-4">
                    {/* Content Statistics */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                      <div className="text-center sm:text-left p-3 bg-white/50 dark:bg-white/5 rounded-lg border border-blue-100 dark:border-blue-700/50">
                        <span className="block text-xs text-blue-600 dark:text-blue-400 font-manrope uppercase tracking-wide font-medium">Total Pages</span>
                        <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                          <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full"></div>
                          <span className="text-2xl font-bold text-blue-900 dark:text-blue-100 font-manrope">{previewData.fullPages?.length || 0}</span>
                        </div>
                      </div>
                      <div className="text-center sm:text-left p-3 bg-white/50 dark:bg-white/5 rounded-lg border border-blue-100 dark:border-blue-700/50">
                        <span className="block text-xs text-blue-600 dark:text-blue-400 font-manrope uppercase tracking-wide font-medium">Total Words</span>
                        <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                          <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full"></div>
                          <span className="text-2xl font-bold text-blue-900 dark:text-blue-100 font-manrope">{previewData.wordCount.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="text-center sm:text-left p-3 bg-white/50 dark:bg-white/5 rounded-lg border border-blue-100 dark:border-blue-700/50">
                        <span className="block text-xs text-blue-600 dark:text-blue-400 font-manrope uppercase tracking-wide font-medium">Source Title</span>
                        <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                          <div className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full"></div>
                          <span className="text-lg font-bold text-blue-900 dark:text-blue-100 font-manrope truncate" title={previewData.title}>{previewData.title}</span>
                        </div>
                      </div>
                    </div>

                    {/* Configuration Summary */}
                    <Collapsible defaultOpen={false}>
                      <CollapsibleTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-between h-12 px-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-manrope"
                        >
                          <div className="flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            <span>Configuration Details</span>
                          </div>
                          <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">
                            {(previewData.configuration?.include_patterns?.length || 0) + (previewData.configuration?.exclude_patterns?.length || 0)} rules
                          </span>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3">
                        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                              <span className="block text-xs text-gray-600 dark:text-gray-400 font-manrope uppercase tracking-wide">Crawl Method</span>
                              <span className="block font-semibold text-gray-900 dark:text-white font-manrope mt-1">{previewData.configuration?.method || 'Single Page'}</span>
                            </div>
                            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                              <span className="block text-xs text-gray-600 dark:text-gray-400 font-manrope uppercase tracking-wide">Max Pages</span>
                              <span className="block font-semibold text-gray-900 dark:text-white font-manrope mt-1">{previewData.configuration?.max_pages || 'Unlimited'}</span>
                            </div>
                            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                              <span className="block text-xs text-gray-600 dark:text-gray-400 font-manrope uppercase tracking-wide">Max Depth</span>
                              <span className="block font-semibold text-gray-900 dark:text-white font-manrope mt-1">{previewData.configuration?.max_depth || 'Unlimited'}</span>
                            </div>
                            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                              <span className="block text-xs text-gray-600 dark:text-gray-400 font-manrope uppercase tracking-wide">Filter Rules</span>
                              <span className="block font-semibold text-gray-900 dark:text-white font-manrope mt-1">
                                {(previewData.configuration?.include_patterns?.length || 0) + (previewData.configuration?.exclude_patterns?.length || 0)} patterns
                              </span>
                            </div>
                          </div>
                          {/* Pattern Details */}
                          {(previewData.configuration?.include_patterns?.length > 0 || previewData.configuration?.exclude_patterns?.length > 0) && (
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {previewData.configuration?.include_patterns?.length > 0 && (
                                  <div>
                                    <span className="block text-xs text-green-600 dark:text-green-400 font-manrope uppercase tracking-wide mb-2">Include Patterns</span>
                                    <div className="flex flex-wrap gap-1">
                                      {previewData.configuration.include_patterns.map((pattern: string, index: number) => (
                                        <Badge key={index} variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs">
                                          {pattern}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {previewData.configuration?.exclude_patterns?.length > 0 && (
                                  <div>
                                    <span className="block text-xs text-red-600 dark:text-red-400 font-manrope uppercase tracking-wide mb-2">Exclude Patterns</span>
                                    <div className="flex flex-wrap gap-1">
                                      {previewData.configuration.exclude_patterns.map((pattern: string, index: number) => (
                                        <Badge key={index} variant="outline" className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs">
                                          {pattern}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Content Preview Tabs */}
                    <div className="space-y-4">
                      <div className="border-b border-gray-200 dark:border-gray-700">
                        <nav className="flex space-x-8" aria-label="Content tabs">
                          <button
                            type="button"
                            className="border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 whitespace-nowrap py-3 px-1 text-sm font-medium font-manrope"
                          >
                            First Page Preview
                          </button>
                          {previewData.fullPages && previewData.fullPages.length > 1 && (
                            <button
                              type="button"
                              className="border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 whitespace-nowrap py-3 px-1 text-sm font-medium font-manrope"
                            >
                              All Pages ({previewData.fullPages.length})
                            </button>
                          )}
                        </nav>
                      </div>

                      {/* First Page Content */}
                      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-gray-900 dark:text-white font-manrope text-sm">Content Preview</h4>
                            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 font-manrope">
                              <span>{previewData.content ? previewData.content.split(' ').length : 0} words</span>
                              <span>•</span>
                              <span>{previewData.content ? Math.ceil(previewData.content.length / 500) : 0} min read</span>
                            </div>
                          </div>
                        </div>
                        <div className="p-4 max-h-96 overflow-y-auto">
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <pre className="text-sm text-gray-700 dark:text-gray-300 font-manrope whitespace-pre-wrap break-words leading-relaxed">
                              {previewData.content || 'No content could be extracted from the first page.'}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* All Pages Overview */}
                    {previewData.fullPages && previewData.fullPages.length > 1 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-gray-900 dark:text-white font-manrope">All Extracted Pages</h4>
                          <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full font-manrope">
                            {previewData.fullPages.length} pages total
                          </span>
                        </div>
                        <div className="grid gap-3 max-h-80 overflow-y-auto pr-2">
                          {previewData.fullPages.map((page, index) => (
                            <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                              <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-blue-600 dark:text-blue-400 text-xs font-bold">
                                      {index + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <h5 className="text-sm font-medium text-gray-900 dark:text-white font-manrope truncate" title={page.title || page.url}>
                                        {page.title || new URL(page.url || '').pathname}
                                      </h5>
                                      <p className="text-xs text-gray-600 dark:text-gray-400 font-manrope truncate">
                                        {page.url}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 font-manrope whitespace-nowrap">
                                    <span className="flex items-center gap-1">
                                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                      {page.content?.split(/\s+/).length || 0} words
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                      {Math.ceil((page.content?.length || 0) / 500)} min read
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <Collapsible>
                                <CollapsibleTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="w-full h-10 px-4 justify-between text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-none font-manrope text-sm"
                                  >
                                    <span>Preview content</span>
                                    <span className="text-xs">▼</span>
                                  </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="p-4 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-600">
                                    <div className="max-h-40 overflow-y-auto">
                                      <pre className="text-sm text-gray-700 dark:text-gray-300 font-manrope whitespace-pre-wrap break-words leading-relaxed">
                                        {(page.content || 'No content extracted from this page.').substring(0, 500)}...
                                      </pre>
                                    </div>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Decision Alert */}
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-l-4 border-amber-400 dark:border-amber-500 p-4 rounded-r-lg">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2 font-manrope text-sm">Content Preview Complete</h4>
                          <p className="text-sm text-amber-700 dark:text-amber-300 font-manrope leading-relaxed mb-3">
                            This is the full content that would be extracted and added to your knowledge base.
                            Review the content quality and coverage before making your decision.
                          </p>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-2 py-1 rounded-full font-manrope">
                              ✓ Content extracted successfully
                            </span>
                            <span className="bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-2 py-1 rounded-full font-manrope">
                              ✓ Ready for approval
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </CardContent>

                {/* Fixed Footer Actions */}
                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 flex-shrink-0">
                  <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRejectPreview}
                      className="order-2 sm:order-1 h-12 px-6 text-red-600 dark:text-red-400 border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-manrope transition-all duration-200 hover:scale-105"
                    >
                      <XCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                      Reject & Discard
                    </Button>

                    <div className="order-3 sm:order-2 hidden sm:flex flex-col items-center text-center px-4">
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                        Preview based on your crawl configuration
                      </span>
                      <div className="flex items-center gap-1 mt-1">
                        <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                        <span className="text-xs text-green-600 dark:text-green-400 font-manrope">
                          Content ready for import
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={handleApprovePreview}
                      className="order-1 sm:order-3 h-12 px-6 bg-green-600 hover:bg-green-700 text-white rounded-lg font-manrope transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                    >
                      <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                      Approve & Add Source
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
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
                    onClick={async () => {
                      // Cleanup preview draft from backend (aligns with pipeline cancel behavior)
                      if (currentPreviewDraftId) {
                        await cleanupPreviewDraft(currentPreviewDraftId);
                        setCurrentPreviewDraftId(null);
                      }
                      setIsLoadingPreview(false);
                      setPreviewProgress('');
                      setCanCancelPreview(false);
                      toast({
                        title: 'Preview Cancelled',
                        description: 'Preview operation was cancelled and draft cleaned up'
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

          </div>
        </form>
      </CardContent>
    </Card>
  );
}