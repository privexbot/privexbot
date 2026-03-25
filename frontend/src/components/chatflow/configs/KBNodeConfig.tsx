/**
 * Knowledge Base Node Configuration Panel
 *
 * Configures KB retrieval node with:
 * - Knowledge base selection
 * - Query template
 * - Search parameters (top_k, threshold, method)
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/contexts/AppContext";
import kbClient from "@/lib/kb-client";

interface KBNodeConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const SEARCH_METHODS = [
  { value: "hybrid_search", label: "Hybrid Search (Recommended)" },
  { value: "semantic", label: "Semantic (Vector Only)" },
  { value: "bm25", label: "BM25 (Keyword Only)" },
];

export function KBNodeConfig({ config, onChange }: KBNodeConfigProps) {
  const { currentWorkspace } = useApp();

  const [kbId, setKbId] = useState((config.kb_id as string) || "");
  const [query, setQuery] = useState((config.query as string) || "{{input}}");
  const [topK, setTopK] = useState((config.top_k as number) || 5);
  const [threshold, setThreshold] = useState((config.threshold as number) || 0.7);
  const [searchMethod, setSearchMethod] = useState((config.search_method as string) || "hybrid_search");
  const [useKbDefaults, setUseKbDefaults] = useState(config.top_k === undefined);

  // Fetch available knowledge bases
  const { data: knowledgeBases, isLoading } = useQuery({
    queryKey: ["knowledge-bases", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const response = await kbClient.kb.list({ workspace_id: currentWorkspace.id });
      return response.items || [];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Debounce changes
  const emitChange = useCallback(() => {
    const newConfig: Record<string, unknown> = {
      kb_id: kbId,
      query,
      search_method: searchMethod,
    };

    if (!useKbDefaults) {
      newConfig.top_k = topK;
      newConfig.threshold = threshold;
    }

    onChange(newConfig);
  }, [kbId, query, topK, threshold, searchMethod, useKbDefaults, onChange]);

  useEffect(() => {
    const timeoutId = setTimeout(emitChange, 300);
    return () => clearTimeout(timeoutId);
  }, [emitChange]);

  return (
    <div className="space-y-4">
      {/* Knowledge Base Selection */}
      <div>
        <Label className="text-sm font-medium">
          Knowledge Base <span className="text-red-500">*</span>
        </Label>
        <Select value={kbId} onValueChange={setKbId}>
          <SelectTrigger className="mt-1.5">
            <SelectValue placeholder={isLoading ? "Loading..." : "Select a knowledge base"} />
          </SelectTrigger>
          <SelectContent>
            {knowledgeBases?.map((kb: { id: string; name: string }) => (
              <SelectItem key={kb.id} value={kb.id}>
                {kb.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Query Template */}
      <div>
        <Label className="text-sm font-medium">Query Template</Label>
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="{{input}}"
          className="mt-1.5 h-20 font-mono text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Use {"{{input}}"} for user message
        </p>
      </div>

      {/* Search Method */}
      <div>
        <Label className="text-sm font-medium">Search Method</Label>
        <Select value={searchMethod} onValueChange={setSearchMethod}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEARCH_METHODS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Use KB Defaults Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Use KB Default Settings</Label>
          <p className="text-xs text-gray-500">Use the KB's configured values</p>
        </div>
        <Switch checked={useKbDefaults} onCheckedChange={setUseKbDefaults} />
      </div>

      {/* Custom Settings */}
      {!useKbDefaults && (
        <>
          {/* Top K */}
          <div>
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Top K Results</Label>
              <span className="text-sm text-gray-500 font-mono">{topK}</span>
            </div>
            <Slider
              value={[topK]}
              onValueChange={(val) => setTopK(val[0])}
              min={1}
              max={20}
              step={1}
              className="mt-2"
            />
          </div>

          {/* Threshold */}
          <div>
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Score Threshold</Label>
              <span className="text-sm text-gray-500 font-mono">{threshold.toFixed(2)}</span>
            </div>
            <Slider
              value={[threshold]}
              onValueChange={(val) => setThreshold(val[0])}
              min={0}
              max={1}
              step={0.05}
              className="mt-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum relevance score (0-1)
            </p>
          </div>
        </>
      )}
    </div>
  );
}
