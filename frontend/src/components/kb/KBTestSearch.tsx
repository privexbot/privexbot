/**
 * KBTestSearch - Test search functionality for Knowledge Bases
 *
 * WHY: Users need to validate their KB works before deploying chatbots
 * HOW: Uses the enhanced-search API with configurable strategies
 */

import { useState } from 'react';
import {
  Search,
  Loader2,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  Target,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import kbClient from '@/lib/kb-client';

interface SearchResult {
  chunk_id: string;
  content: string;
  score: number;
  confidence: number;
  document_id: string;
  page_url?: string;
  page_title?: string;
  content_type?: string;
  strategy_used?: string;
  reasoning?: string;
}

interface SearchResponse {
  results: SearchResult[];
  search_strategy_used: string;
  total_results: number;
  processing_time_ms?: number;
  fallback_used: boolean;
}

interface KBTestSearchProps {
  kbId: string;
  kbName: string;
  kbStatus: string;
}

const SEARCH_STRATEGIES = [
  { value: 'adaptive', label: 'Adaptive (Recommended)', description: 'Automatically selects best strategy' },
  { value: 'hybrid', label: 'Hybrid Search', description: 'Combines semantic + keyword search' },
  { value: 'precise', label: 'Precise', description: 'Exact keyword matching' },
  { value: 'contextual', label: 'Contextual', description: 'Deep semantic understanding' },
];

export function KBTestSearch({ kbId, kbName, kbStatus }: KBTestSearchProps) {
  const [query, setQuery] = useState('');
  const [strategy, setStrategy] = useState('adaptive');
  const [topK, setTopK] = useState(5);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({
        title: 'Query Required',
        description: 'Please enter a search query',
        variant: 'destructive'
      });
      return;
    }

    if (kbStatus !== 'ready') {
      toast({
        title: 'KB Not Ready',
        description: 'Knowledge base must be in "ready" status to search',
        variant: 'destructive'
      });
      return;
    }

    setIsSearching(true);
    setResults(null);

    try {
      const response = await kbClient.search.search({
        kb_id: kbId,
        query: query.trim(),
        search_strategy: strategy,
        top_k: topK,
        include_reasoning: true,
        requester_type: 'api'
      });

      setResults(response);

      if (response.total_results === 0) {
        toast({
          title: 'No Results',
          description: 'No matching content found. Try a different query or adjust settings.',
        });
      }
    } catch (error: any) {
      console.error('Search failed:', error);
      toast({
        title: 'Search Failed',
        description: error.response?.data?.detail || error.message || 'Failed to search knowledge base',
        variant: 'destructive'
      });
    } finally {
      setIsSearching(false);
    }
  };

  const toggleExpanded = (chunkId: string) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(chunkId)) {
      newExpanded.delete(chunkId);
    } else {
      newExpanded.add(chunkId);
    }
    setExpandedResults(newExpanded);
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30';
    if (score >= 0.6) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30';
    return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30';
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return { label: 'High', variant: 'default' as const };
    if (confidence >= 0.6) return { label: 'Medium', variant: 'secondary' as const };
    return { label: 'Low', variant: 'outline' as const };
  };

  return (
    <div className="space-y-6">
      {/* Search Configuration */}
      <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-b border-blue-200 dark:border-blue-700 rounded-t-xl p-6">
          <div className="flex items-center gap-3">
            <Search className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <div>
              <CardTitle className="text-xl font-bold text-blue-900 dark:text-blue-100 font-manrope">
                Test Search
              </CardTitle>
              <CardDescription className="text-blue-700 dark:text-blue-300 font-manrope mt-1">
                Test retrieval from "{kbName}" before deploying
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Query Input */}
          <div className="space-y-2">
            <Label htmlFor="query" className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope">
              Search Query
            </Label>
            <div className="flex gap-3">
              <Input
                id="query"
                placeholder="Enter your search query... (e.g., 'How do I reset my password?')"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 font-manrope"
                disabled={isSearching || kbStatus !== 'ready'}
              />
              <Button
                onClick={handleSearch}
                disabled={isSearching || !query.trim() || kbStatus !== 'ready'}
                className="bg-blue-600 hover:bg-blue-700 text-white font-manrope px-6"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Search Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strategy Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope">
                Search Strategy
              </Label>
              <Select value={strategy} onValueChange={setStrategy}>
                <SelectTrigger className="font-manrope">
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                <SelectContent>
                  {SEARCH_STRATEGIES.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="font-manrope">
                      <div className="flex flex-col">
                        <span className="font-medium">{s.label}</span>
                        <span className="text-xs text-gray-500">{s.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Top K Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope">
                  Results Count (Top K)
                </Label>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 font-manrope">
                  {topK}
                </span>
              </div>
              <Slider
                value={[topK]}
                onValueChange={(value) => setTopK(value[0])}
                min={1}
                max={20}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                Number of results to retrieve (1-20)
              </p>
            </div>
          </div>

          {/* KB Status Warning */}
          {kbStatus !== 'ready' && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
              <p className="text-amber-700 dark:text-amber-300 font-manrope text-sm">
                <strong>Note:</strong> Knowledge base status is "{kbStatus}". Search is only available when status is "ready".
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {results && (
        <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-b border-emerald-200 dark:border-emerald-700 rounded-t-xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <CardTitle className="text-xl font-bold text-emerald-900 dark:text-emerald-100 font-manrope">
                    Search Results ({results.total_results})
                  </CardTitle>
                  <CardDescription className="text-emerald-700 dark:text-emerald-300 font-manrope mt-1">
                    Strategy: {results.search_strategy_used.replace(/_/g, ' ')}
                    {results.fallback_used && ' (fallback)'}
                  </CardDescription>
                </div>
              </div>
              {results.processing_time_ms && (
                <Badge variant="outline" className="bg-white dark:bg-gray-800 font-manrope">
                  <Clock className="h-3 w-3 mr-1" />
                  {results.processing_time_ms.toFixed(0)}ms
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {results.total_results === 0 ? (
              <div className="text-center py-12">
                <Search className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 font-manrope mb-2">
                  No Results Found
                </h3>
                <p className="text-gray-500 dark:text-gray-400 font-manrope">
                  Try adjusting your query or search settings
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {results.results.map((result, index) => {
                  const isExpanded = expandedResults.has(result.chunk_id);
                  const confidenceBadge = getConfidenceBadge(result.confidence);

                  return (
                    <div
                      key={result.chunk_id}
                      className="bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
                    >
                      {/* Result Header */}
                      <div className="p-4 flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge variant="outline" className="font-manrope">
                              #{index + 1}
                            </Badge>
                            <Badge
                              className={`font-manrope ${getScoreColor(result.score)}`}
                            >
                              <Target className="h-3 w-3 mr-1" />
                              Score: {(result.score * 100).toFixed(1)}%
                            </Badge>
                            <Badge variant={confidenceBadge.variant} className="font-manrope">
                              <Zap className="h-3 w-3 mr-1" />
                              {confidenceBadge.label} Confidence
                            </Badge>
                            {result.content_type && (
                              <Badge variant="outline" className="font-manrope text-xs">
                                {result.content_type}
                              </Badge>
                            )}
                          </div>

                          {/* Page Title */}
                          {result.page_title && (
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="h-4 w-4 text-gray-500" />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">
                                {result.page_title}
                              </span>
                            </div>
                          )}

                          {/* Content Preview */}
                          <p className={`text-sm text-gray-600 dark:text-gray-400 font-manrope ${isExpanded ? '' : 'line-clamp-3'}`}>
                            {result.content}
                          </p>

                          {/* Source URL */}
                          {result.page_url && (
                            <a
                              href={result.page_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline font-manrope"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {result.page_url.substring(0, 50)}...
                            </a>
                          )}

                          {/* Reasoning (expanded) */}
                          {isExpanded && result.reasoning && (
                            <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                              <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 font-manrope mb-1">
                                AI Reasoning:
                              </p>
                              <p className="text-sm text-purple-600 dark:text-purple-400 font-manrope">
                                {result.reasoning}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Expand/Collapse Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(result.chunk_id)}
                          className="flex-shrink-0"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tips Section */}
      {!results && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-700 rounded-xl">
          <CardContent className="p-6">
            <h4 className="text-lg font-bold text-purple-900 dark:text-purple-100 font-manrope mb-4">
              Search Tips
            </h4>
            <ul className="space-y-2 text-sm text-purple-700 dark:text-purple-300 font-manrope">
              <li className="flex items-start gap-2">
                <span className="text-purple-500">•</span>
                <span><strong>Adaptive strategy</strong> automatically selects the best approach based on your query</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500">•</span>
                <span><strong>Hybrid search</strong> combines keyword matching with semantic understanding</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500">•</span>
                <span>Use <strong>natural language questions</strong> for best results (e.g., "How do I...")</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500">•</span>
                <span>Higher <strong>Top K</strong> returns more results but may include less relevant matches</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
