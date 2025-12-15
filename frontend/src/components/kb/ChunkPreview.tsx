/**
 * ChunkPreview - Preview how documents will be chunked
 *
 * WHY:
 * - Validate chunking config
 * - See chunk boundaries
 * - Test before finalization
 *
 * HOW:
 * - Preview API call
 * - Chunk visualization
 * - Pagination
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import apiClient, { handleApiError } from '@/lib/api-client';

interface Chunk {
  index: number;
  content: string;
  char_count: number;
  word_count: number;
  overlap_start?: string;
  overlap_end?: string;
}

interface ChunkPreviewProps {
  draftId: string;
  documentId?: string;
  sampleText?: string;
}

export default function ChunkPreview({ draftId, documentId, sampleText }: ChunkPreviewProps) {
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);

  // Fetch chunk preview
  const { data, isLoading, error } = useQuery({
    queryKey: ['chunk-preview', draftId, documentId],
    queryFn: async () => {
      const response = await apiClient.post(`/kb-drafts/${draftId}/preview-chunks`, {
        document_id: documentId,
        sample_text: sampleText,
      });
      return response.data;
    },
    enabled: !!draftId && (!!documentId || !!sampleText),
  });

  const chunks: Chunk[] = data?.chunks || [];
  const currentChunk = chunks[currentChunkIndex];

  const nextChunk = () => {
    if (currentChunkIndex < chunks.length - 1) {
      setCurrentChunkIndex(currentChunkIndex + 1);
    }
  };

  const prevChunk = () => {
    if (currentChunkIndex > 0) {
      setCurrentChunkIndex(currentChunkIndex - 1);
    }
  };

  const goToChunk = (index: number) => {
    setCurrentChunkIndex(index);
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600 dark:text-blue-400 mb-3" />
        <p className="text-base text-blue-700 dark:text-blue-300 font-manrope font-medium">Generating chunk preview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-700 rounded-xl">
        <AlertCircle className="w-8 h-8 mx-auto text-red-600 dark:text-red-400 mb-3" />
        <p className="text-base text-red-700 dark:text-red-300 font-manrope font-medium">{handleApiError(error)}</p>
      </div>
    );
  }

  if (!chunks || chunks.length === 0) {
    return (
      <div className="text-center py-12 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50 border border-gray-200 dark:border-gray-700 rounded-xl">
        <Eye className="w-8 h-8 mx-auto text-gray-500 dark:text-gray-400 mb-3" />
        <p className="text-base text-gray-700 dark:text-gray-300 font-manrope font-medium">No chunks to preview</p>
        <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope mt-2">
          Add documents or provide sample text
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4 sm:p-6 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-bold mb-2 flex items-center gap-3 text-gray-900 dark:text-white font-manrope">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
            <Eye className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          Chunk Preview
        </h3>
        <p className="text-base text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">
          Preview how your documents will be split into chunks
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl shadow-sm">
          <p className="text-sm text-blue-700 dark:text-blue-300 font-manrope font-medium mb-2">Total Chunks</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-manrope">{chunks.length}</p>
        </div>
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl shadow-sm">
          <p className="text-sm text-green-700 dark:text-green-300 font-manrope font-medium mb-2">Avg Size</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 font-manrope">
            {Math.round(chunks.reduce((sum, c) => sum + c.char_count, 0) / chunks.length)}
          </p>
        </div>
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl shadow-sm">
          <p className="text-sm text-amber-700 dark:text-amber-300 font-manrope font-medium mb-2">Min Size</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-manrope">
            {Math.min(...chunks.map((c) => c.char_count))}
          </p>
        </div>
        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl shadow-sm">
          <p className="text-sm text-purple-700 dark:text-purple-300 font-manrope font-medium mb-2">Max Size</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 font-manrope">
            {Math.max(...chunks.map((c) => c.char_count))}
          </p>
        </div>
      </div>

      {/* Chunk Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={prevChunk}
            disabled={currentChunkIndex === 0}
            className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 font-manrope"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="text-base font-semibold text-gray-900 dark:text-white font-manrope px-3 py-1 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            Chunk {currentChunkIndex + 1} of {chunks.length}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={nextChunk}
            disabled={currentChunkIndex === chunks.length - 1}
            className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 font-manrope"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400 font-manrope">
          <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-lg border border-blue-200 dark:border-blue-700">
            {currentChunk?.char_count} chars
          </span>
          <span className="text-gray-400 dark:text-gray-500">•</span>
          <span className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1 rounded-lg border border-green-200 dark:border-green-700">
            {currentChunk?.word_count} words
          </span>
        </div>
      </div>

      {/* Chunk Content */}
      <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <Label className="text-lg font-semibold text-gray-900 dark:text-white font-manrope">Chunk Content</Label>
          <span className="text-sm text-gray-500 dark:text-gray-400 font-manrope bg-gray-50 dark:bg-gray-700/50 px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-600">
            Index: {currentChunk?.index}
          </span>
        </div>

        <div className="space-y-4">
          {/* Overlap Start */}
          {currentChunk?.overlap_start && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 border-l-4 border-l-amber-500 dark:border-l-amber-400">
              <p className="text-sm text-amber-800 dark:text-amber-200 font-semibold mb-2 font-manrope">
                ⚠️ Overlap from previous chunk
              </p>
              <p className="text-amber-900 dark:text-amber-100 font-mono text-sm leading-relaxed bg-amber-100/50 dark:bg-amber-800/30 p-3 rounded-lg">
                {currentChunk.overlap_start}
              </p>
            </div>
          )}

          {/* Main Content */}
          <div className="bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-600 rounded-xl p-4 max-h-64 overflow-y-auto">
            <div className="text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
              {currentChunk?.content}
            </div>
          </div>

          {/* Overlap End */}
          {currentChunk?.overlap_end && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 border-l-4 border-l-blue-500 dark:border-l-blue-400">
              <p className="text-sm text-blue-800 dark:text-blue-200 font-semibold mb-2 font-manrope">
                ℹ️ Overlap to next chunk
              </p>
              <p className="text-blue-900 dark:text-blue-100 font-mono text-sm leading-relaxed bg-blue-100/50 dark:bg-blue-800/30 p-3 rounded-lg">
                {currentChunk.overlap_end}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chunk List */}
      <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm">
        <Label className="text-lg font-semibold text-gray-900 dark:text-white font-manrope mb-4 block">All Chunks</Label>
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3">
          {chunks.map((chunk, index) => (
            <button
              key={index}
              onClick={() => goToChunk(index)}
              className={`p-3 text-sm font-semibold border rounded-xl transition-all duration-200 font-manrope ${
                index === currentChunkIndex
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm'
              }`}
              title={`Chunk ${index + 1} (${chunk.char_count} chars)`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 dark:from-indigo-900/20 dark:to-cyan-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-4 sm:p-6 shadow-sm">
        <p className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 font-manrope mb-3">
          💡 <strong>What to look for</strong>
        </p>
        <ul className="text-sm space-y-2 list-none">
          <li className="flex items-start gap-2 text-indigo-700 dark:text-indigo-300 font-manrope leading-relaxed">
            <span className="text-indigo-500 dark:text-indigo-400 font-bold">•</span>
            Chunks should break at natural boundaries (paragraphs, sentences)
          </li>
          <li className="flex items-start gap-2 text-indigo-700 dark:text-indigo-300 font-manrope leading-relaxed">
            <span className="text-amber-500 dark:text-amber-400 font-bold">•</span>
            <span><span className="font-semibold text-amber-600 dark:text-amber-400">Yellow highlights</span> show overlapping content from previous chunk</span>
          </li>
          <li className="flex items-start gap-2 text-indigo-700 dark:text-indigo-300 font-manrope leading-relaxed">
            <span className="text-blue-500 dark:text-blue-400 font-bold">•</span>
            <span><span className="font-semibold text-blue-600 dark:text-blue-400">Blue highlights</span> show content that overlaps into next chunk</span>
          </li>
          <li className="flex items-start gap-2 text-indigo-700 dark:text-indigo-300 font-manrope leading-relaxed">
            <span className="text-indigo-500 dark:text-indigo-400 font-bold">•</span>
            Adjust chunk size/overlap if breaks look unnatural
          </li>
        </ul>
      </div>
    </div>
  );
}
