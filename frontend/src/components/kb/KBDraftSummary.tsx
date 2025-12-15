/**
 * KBDraftSummary - Final summary before finalization
 *
 * WHY:
 * - Review all settings
 * - Confirm before creation
 * - Cost estimation
 *
 * HOW:
 * - Summary cards
 * - Source list
 * - Configuration display
 */

import { CheckCircle, Database, FileText, Settings, Zap, AlertCircle } from 'lucide-react';

interface KBDraftSummaryProps {
  draftData: {
    name: string;
    description?: string;
    sources_count: number;
    total_documents: number;
    estimated_chunks: number;
    chunking_config: {
      strategy: string;
      chunk_size: number;
      chunk_overlap: number;
    };
    indexing_config: {
      embedding_model: string;
      distance_metric: string;
      enable_hybrid_search: boolean;
      enable_reranking: boolean;
    };
  };
}

export default function KBDraftSummary({ draftData }: KBDraftSummaryProps) {
  const estimateCost = () => {
    // Rough cost estimation based on OpenAI Ada pricing
    const costPerMillion = 0.1; // $0.10 per 1M tokens
    const avgCharsPerToken = 4;
    const estimatedTokens = (draftData.estimated_chunks * draftData.chunking_config.chunk_size) / avgCharsPerToken;
    const estimatedCost = (estimatedTokens / 1000000) * costPerMillion;
    return estimatedCost.toFixed(4);
  };

  const estimateIndexTime = () => {
    // Rough estimation: ~100 chunks per second
    const seconds = draftData.estimated_chunks / 100;
    if (seconds < 60) return `~${Math.ceil(seconds)} seconds`;
    return `~${Math.ceil(seconds / 60)} minutes`;
  };

  const getStrategyLabel = (strategy: string) => {
    const labels: Record<string, string> = {
      recursive: 'Recursive (Recommended)',
      sentence: 'Sentence-based',
      token: 'Token-based',
      semantic: 'Semantic (AI-powered)',
    };
    return labels[strategy] || strategy;
  };

  const getModelLabel = (model: string) => {
    const labels: Record<string, string> = {
      'text-embedding-ada-002': 'OpenAI Ada 002',
      'text-embedding-3-small': 'OpenAI Embedding 3 Small',
      'text-embedding-3-large': 'OpenAI Embedding 3 Large',
      'cohere-embed-english-v3.0': 'Cohere English v3',
      'voyage-02': 'Voyage AI v2',
    };
    return labels[model] || model;
  };

  const hasWarnings = draftData.sources_count === 0 || draftData.estimated_chunks === 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
          Ready to Create
        </h3>
        <p className="text-sm text-muted-foreground">
          Review your knowledge base configuration before finalizing
        </p>
      </div>

      {/* Warnings */}
      {hasWarnings && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">Warnings</p>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 mt-1 space-y-1">
                {draftData.sources_count === 0 && (
                  <li>• No sources added - add at least one document</li>
                )}
                {draftData.estimated_chunks === 0 && (
                  <li>• No content to index - documents may be empty</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Basic Info */}
      <div className="p-6 border rounded-lg bg-card">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-primary" />
          <h4 className="font-semibold">Knowledge Base Info</h4>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Name</p>
            <p className="font-medium">{draftData.name}</p>
          </div>

          {draftData.description && (
            <div>
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="text-sm">{draftData.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Sources */}
      <div className="p-6 border rounded-lg bg-card">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-blue-500" />
          <h4 className="font-semibold">Sources</h4>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Sources Added</p>
            <p className="text-2xl font-bold">{draftData.sources_count}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Documents</p>
            <p className="text-2xl font-bold">{draftData.total_documents}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Estimated Chunks</p>
            <p className="text-2xl font-bold">{draftData.estimated_chunks.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Chunking Config */}
      <div className="p-6 border rounded-lg bg-card">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-orange-500" />
          <h4 className="font-semibold">Chunking Configuration</h4>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Strategy</p>
            <p className="font-medium">
              {getStrategyLabel(draftData.chunking_config.strategy)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Chunk Size</p>
            <p className="font-medium">{draftData.chunking_config.chunk_size} characters</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Overlap</p>
            <p className="font-medium">{draftData.chunking_config.chunk_overlap} characters</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Effective Size</p>
            <p className="font-medium">
              {draftData.chunking_config.chunk_size - draftData.chunking_config.chunk_overlap}{' '}
              characters
            </p>
          </div>
        </div>
      </div>

      {/* Indexing Config */}
      <div className="p-6 border rounded-lg bg-card">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-purple-500" />
          <h4 className="font-semibold">Indexing Configuration</h4>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Embedding Model</p>
            <p className="font-medium">
              {getModelLabel(draftData.indexing_config.embedding_model)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Distance Metric</p>
            <p className="font-medium capitalize">{draftData.indexing_config.distance_metric}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Hybrid Search</p>
            <p className="font-medium">
              {draftData.indexing_config.enable_hybrid_search ? 'Enabled' : 'Disabled'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">AI Reranking</p>
            <p className="font-medium">
              {draftData.indexing_config.enable_reranking ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        </div>
      </div>

      {/* Cost Estimation */}
      <div className="p-6 border rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
        <h4 className="font-semibold mb-4">Estimated Costs & Time</h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Indexing Cost (est.)</p>
            <p className="text-xl font-bold">${estimateCost()}</p>
            <p className="text-xs text-muted-foreground mt-1">Based on OpenAI Ada pricing</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Processing Time (est.)</p>
            <p className="text-xl font-bold">{estimateIndexTime()}</p>
            <p className="text-xs text-muted-foreground mt-1">May vary based on system load</p>
          </div>
        </div>
      </div>

      {/* What Happens Next */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm font-medium mb-2">🚀 What happens when you finalize:</p>
        <ol className="text-sm space-y-1 list-decimal list-inside">
          <li>All documents will be processed and split into chunks</li>
          <li>Chunks will be embedded using {getModelLabel(draftData.indexing_config.embedding_model)}</li>
          <li>Vector index will be created for fast semantic search</li>
          <li>Knowledge base will be ready to attach to chatbots</li>
        </ol>
        <p className="text-xs text-muted-foreground mt-3">
          ⏱️ Processing happens in the background. You'll be notified when it's complete.
        </p>
      </div>
    </div>
  );
}
