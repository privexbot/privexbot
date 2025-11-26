/**
 * Web Source Form Component
 *
 * Form for adding web URLs with crawl configuration
 */

import { useState } from 'react';
import { Globe, Settings, Plus } from 'lucide-react';
import { CrawlMethod, WebSourceConfig } from '@/types/knowledge-base';
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
}

export function KBWebSourceForm({ onAdd, onCancel }: KBWebSourceFormProps) {
  const [url, setUrl] = useState('');
  const [bulkUrls, setBulkUrls] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [config, setConfig] = useState<Partial<WebSourceConfig>>({
    method: CrawlMethod.CRAWL as CrawlMethod,
    max_pages: 50,
    max_depth: 3,
    include_subdomains: false,
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

  const crawlMethodOptions = [
    {
      value: CrawlMethod.SCRAPE,
      label: 'Single Page',
      description: 'Scrape only the specified page'
    },
    {
      value: CrawlMethod.CRAWL,
      label: 'Crawl',
      description: 'Crawl linked pages within the domain'
    },
    {
      value: CrawlMethod.MAP,
      label: 'Sitemap',
      description: 'Use sitemap for efficient crawling'
    },
    {
      value: CrawlMethod.SEARCH,
      label: 'Search & Extract',
      description: 'Search and extract specific content'
    },
    {
      value: CrawlMethod.EXTRACT,
      label: 'Structured Extract',
      description: 'Extract structured data from the page'
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

      onAdd({ urls, config, bulk: true, urlConfigs: bulkConfigs });

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
      include_subdomains: false,
      include_patterns: [],
      exclude_patterns: [],
    });
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Add Website URL
        </CardTitle>
        <CardDescription>
          Enter a URL to scrape content from a website
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Bulk Mode Toggle */}
          <div className="flex items-center space-x-2 mb-4">
            <Checkbox
              id="bulk-mode"
              checked={bulkMode}
              onCheckedChange={(checked) => setBulkMode(!!checked)}
            />
            <Label htmlFor="bulk-mode" className="text-sm font-medium">
              Bulk URL Mode (Add multiple URLs at once)
            </Label>
          </div>

          {/* URL Input */}
          {!bulkMode ? (
            <div className="space-y-2">
              <Label htmlFor="url">Website URL</Label>
              <div className="flex gap-2">
                <Input
                  id="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setValidationResult(null);
                  }}
                  onBlur={(e) => handleUrlValidation(e.target.value)}
                  placeholder="https://example.com"
                  className={`flex-1 ${
                    validationResult === null ? '' :
                    validationResult.valid ? 'border-green-500' :
                    'border-red-500'
                  }`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleUrlValidation(url)}
                  disabled={isValidating || !url.trim()}
                >
                  {isValidating ? '...' : '✓'}
                </Button>
              </div>

              {validationResult && !validationResult.valid && (
                <div className="space-y-1">
                  <p className="text-sm text-red-500">{validationResult.error}</p>
                  {validationResult.suggestions && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Suggestions:</p>
                      {validationResult.suggestions.map((suggestion: string, index: number) => (
                        <Button
                          key={index}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setUrl(suggestion)}
                          className="h-auto p-1 text-xs text-primary"
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {validationResult && validationResult.valid && (
                <p className="text-sm text-green-600">✓ URL is valid and accessible</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="bulk-urls">Website URLs (one per line)</Label>
              <div className="space-y-2">
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
                  className="w-full min-h-32 p-3 border rounded-md text-sm"
                  rows={6}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
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
                  {isValidating ? 'Validating...' : `Validate ${bulkUrls.split('\n').filter(url => url.trim().length > 0).length} URLs`}
                </Button>
              </div>

              {bulkValidationResults.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    Validation Results ({bulkValidationResults.filter(r => r.valid).length}/{bulkValidationResults.length} valid):
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
                    {bulkValidationResults.map((result, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-2 p-1 rounded ${
                          result.valid ? 'text-green-600' : 'text-red-500'
                        }`}
                      >
                        <span>{result.valid ? '✓' : '✗'}</span>
                        <span className="truncate">{result.url}</span>
                        {result.error && <span className="text-red-400">- {result.error}</span>}
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
                          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t">
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
                            <div className="col-span-2">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`subdomains-${result.url}`}
                                  checked={bulkConfigs[result.url]?.include_subdomains ?? config.include_subdomains ?? false}
                                  onCheckedChange={(checked) => {
                                    setBulkConfigs(prev => ({
                                      ...prev,
                                      [result.url]: {
                                        ...prev[result.url],
                                        include_subdomains: checked === true
                                      }
                                    }));
                                  }}
                                />
                                <Label htmlFor={`subdomains-${result.url}`} className="text-xs">
                                  Include Subdomains
                                </Label>
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Crawl Method</Label>
              <Select
                value={config.method}
                onValueChange={(value) => setConfig({ ...config, method: value as CrawlMethod })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {crawlMethodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {option.description}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="subdomains"
                checked={config.include_subdomains}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, include_subdomains: !!checked })
                }
              />
              <Label htmlFor="subdomains" className="text-sm">
                Include subdomains
              </Label>
            </div>
          </div>

          {/* Advanced Options */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Advanced Options
                <span className="text-xs text-muted-foreground">
                  {showAdvanced ? '▼' : '▶'}
                </span>
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-4 mt-4">
              {/* Limits */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Pages</Label>
                  <Input
                    type="number"
                    min="1"
                    max="1000"
                    value={config.max_pages}
                    onChange={(e) =>
                      setConfig({ ...config, max_pages: parseInt(e.target.value) || 50 })
                    }
                  />
                  <p className="text-xs text-muted-foreground">1-1000 pages</p>
                </div>

                <div className="space-y-2">
                  <Label>Max Depth</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={config.max_depth}
                    onChange={(e) =>
                      setConfig({ ...config, max_depth: parseInt(e.target.value) || 3 })
                    }
                  />
                  <p className="text-xs text-muted-foreground">1-10 levels</p>
                </div>
              </div>

              {/* Include Patterns */}
              <div className="space-y-2">
                <Label>Include Patterns</Label>
                <div className="flex gap-2">
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
                  />
                  <Button
                    type="button"
                    size="icon"
                    onClick={() => handleAddPattern('include')}
                    disabled={!includePattern.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(config.include_patterns || []).map((pattern: string, index: number) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => handleRemovePattern('include', index)}
                    >
                      {pattern} ×
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Patterns to include in crawling
                </p>
              </div>

              {/* Exclude Patterns */}
              <div className="space-y-2">
                <Label>Exclude Patterns</Label>
                <div className="flex gap-2">
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
                  />
                  <Button
                    type="button"
                    size="icon"
                    onClick={() => handleAddPattern('exclude')}
                    disabled={!excludePattern.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(config.exclude_patterns || []).map((pattern: string, index: number) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => handleRemovePattern('exclude', index)}
                    >
                      {pattern} ×
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Patterns to exclude from crawling
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Actions */}
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isValidating ||
                       (bulkMode ?
                         bulkUrls.trim().length === 0 || (bulkValidationResults.length > 0 && bulkValidationResults.some(r => !r.valid)) :
                         !url.trim() || (validationResult && !validationResult.valid)
                       )}
            >
              <Plus className="h-4 w-4 mr-2" />
              {bulkMode ?
                `Add ${bulkUrls.split('\n').filter(url => url.trim().length > 0).length} URLs` :
                'Add URL'
              }
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}