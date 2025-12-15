/**
 * WebsiteCrawler - Configure website scraping
 *
 * WHY:
 * - Crawl documentation sites
 * - Sitemap support
 * - URL pattern filtering
 *
 * HOW:
 * - URL input with validation
 * - Crawl depth configuration
 * - Include/exclude patterns
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Globe, Plus, X, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import apiClient, { handleApiError } from '@/lib/api-client';

interface WebsiteCrawlerProps {
  draftId: string;
  onCrawlStarted?: () => void;
}

export default function WebsiteCrawler({ draftId, onCrawlStarted }: WebsiteCrawlerProps) {
  const { toast } = useToast();

  const [baseUrl, setBaseUrl] = useState('');
  const [maxDepth, setMaxDepth] = useState(3);
  const [maxPages, setMaxPages] = useState(100);
  const [includePatterns, setIncludePatterns] = useState<string[]>([]);
  const [excludePatterns, setExcludePatterns] = useState<string[]>([]);
  const [useSitemap, setUseSitemap] = useState(true);
  const [sitemapUrl, setSitemapUrl] = useState('');

  const [includeInput, setIncludeInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');

  // Start crawl mutation
  const crawlMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/kb-drafts/${draftId}/documents/crawl`, {
        base_url: baseUrl,
        max_depth: maxDepth,
        max_pages: maxPages,
        include_patterns: includePatterns,
        exclude_patterns: excludePatterns,
        use_sitemap: useSitemap,
        sitemap_url: sitemapUrl || undefined,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Crawl started',
        description: `Crawling ${baseUrl}. This may take a few minutes.`,
      });
      if (onCrawlStarted) onCrawlStarted();
    },
    onError: (error) => {
      toast({
        title: 'Failed to start crawl',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
  });

  const addPattern = (type: 'include' | 'exclude') => {
    const input = type === 'include' ? includeInput : excludeInput;
    const setter = type === 'include' ? setIncludePatterns : setExcludePatterns;
    const inputSetter = type === 'include' ? setIncludeInput : setExcludeInput;

    if (input.trim()) {
      setter((prev) => [...prev, input.trim()]);
      inputSetter('');
    }
  };

  const removePattern = (type: 'include' | 'exclude', pattern: string) => {
    const setter = type === 'include' ? setIncludePatterns : setExcludePatterns;
    setter((prev) => prev.filter((p) => p !== pattern));
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const canStartCrawl = baseUrl && isValidUrl(baseUrl);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Website Crawler
        </h3>
        <p className="text-sm text-muted-foreground">
          Crawl a website to extract and index its content
        </p>
      </div>

      {/* Base URL */}
      <div>
        <Label htmlFor="base-url">Base URL *</Label>
        <Input
          id="base-url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://docs.example.com"
          className="mt-2"
        />
        {baseUrl && !isValidUrl(baseUrl) && (
          <p className="text-xs text-destructive mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Invalid URL format
          </p>
        )}
      </div>

      {/* Sitemap */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div>
          <Label htmlFor="use-sitemap">Use Sitemap</Label>
          <p className="text-sm text-muted-foreground">
            Automatically detect and crawl from sitemap.xml
          </p>
        </div>
        <Switch
          id="use-sitemap"
          checked={useSitemap}
          onCheckedChange={setUseSitemap}
        />
      </div>

      {useSitemap && (
        <div>
          <Label htmlFor="sitemap-url">Sitemap URL (Optional)</Label>
          <Input
            id="sitemap-url"
            value={sitemapUrl}
            onChange={(e) => setSitemapUrl(e.target.value)}
            placeholder="https://docs.example.com/sitemap.xml"
            className="mt-2"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Leave empty to auto-detect sitemap.xml
          </p>
        </div>
      )}

      {/* Crawl Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="max-depth">Max Depth</Label>
          <Input
            id="max-depth"
            type="number"
            value={maxDepth}
            onChange={(e) => setMaxDepth(parseInt(e.target.value))}
            min={1}
            max={10}
            className="mt-2"
          />
          <p className="text-xs text-muted-foreground mt-1">
            How many levels deep to crawl
          </p>
        </div>

        <div>
          <Label htmlFor="max-pages">Max Pages</Label>
          <Input
            id="max-pages"
            type="number"
            value={maxPages}
            onChange={(e) => setMaxPages(parseInt(e.target.value))}
            min={1}
            max={1000}
            className="mt-2"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Maximum pages to crawl
          </p>
        </div>
      </div>

      {/* Include Patterns */}
      <div>
        <Label>Include Patterns (Optional)</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Only crawl URLs matching these patterns
        </p>

        <div className="flex gap-2 mb-2">
          <Input
            value={includeInput}
            onChange={(e) => setIncludeInput(e.target.value)}
            placeholder="/docs/* or /api/*"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPattern('include'))}
          />
          <Button onClick={() => addPattern('include')} disabled={!includeInput.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {includePatterns.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {includePatterns.map((pattern) => (
              <div
                key={pattern}
                className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm"
              >
                {pattern}
                <button
                  onClick={() => removePattern('include', pattern)}
                  className="hover:text-green-900 dark:hover:text-green-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exclude Patterns */}
      <div>
        <Label>Exclude Patterns (Optional)</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Skip URLs matching these patterns
        </p>

        <div className="flex gap-2 mb-2">
          <Input
            value={excludeInput}
            onChange={(e) => setExcludeInput(e.target.value)}
            placeholder="/admin/* or /login"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPattern('exclude'))}
          />
          <Button onClick={() => addPattern('exclude')} disabled={!excludeInput.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {excludePatterns.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {excludePatterns.map((pattern) => (
              <div
                key={pattern}
                className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full text-sm"
              >
                {pattern}
                <button
                  onClick={() => removePattern('exclude', pattern)}
                  className="hover:text-red-900 dark:hover:text-red-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Start Crawl Button */}
      <Button
        onClick={() => crawlMutation.mutate()}
        disabled={!canStartCrawl || crawlMutation.isPending}
        className="w-full"
        size="lg"
      >
        {crawlMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Starting crawl...
          </>
        ) : (
          <>
            <Globe className="w-4 h-4 mr-2" />
            Start Crawling
          </>
        )}
      </Button>

      {/* Info */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm">
          💡 <strong>Tips:</strong>
        </p>
        <ul className="text-sm space-y-1 mt-2 list-disc list-inside">
          <li>The crawler will respect robots.txt</li>
          <li>Only publicly accessible pages will be crawled</li>
          <li>Large sites may take several minutes to crawl</li>
        </ul>
      </div>
    </div>
  );
}
