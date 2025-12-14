/**
 * Content Preview Modal for Approval Phase
 *
 * Simple modal to view page content as-is without chunking strategies
 * Used in Content Approval phase to review extracted content
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  ExternalLink,
  Edit
} from 'lucide-react';

interface KBContentPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageIndex: number;
  allPages: any[];
}

export const KBContentPreviewModal: React.FC<KBContentPreviewModalProps> = ({
  open,
  onOpenChange,
  pageIndex,
  allPages,
}) => {
  const page = allPages[pageIndex];

  if (!page) {
    return null;
  }

  // Get the actual content to display (edited or original)
  const displayContent = page.edited_content || page.content || '';
  const wordCount = displayContent.split(/\s+/).filter((word: string) => word.length > 0).length;
  const charCount = displayContent.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-6xl h-[95vh] max-h-[95vh] flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl">
        <DialogHeader className="flex-shrink-0 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-gray-200 dark:border-gray-700 rounded-t-xl p-6">
          <DialogTitle className="flex items-center gap-3 text-xl sm:text-2xl font-bold text-gray-900 dark:text-white font-manrope">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            Content Preview
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope text-base leading-relaxed">
            Review the extracted content as it will be added to your knowledge base
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-6 min-h-0 overflow-hidden p-6">
          {/* Page Info */}
          <div className="flex-shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h3 className="font-bold text-xl text-gray-900 dark:text-white font-manrope leading-tight min-w-0 flex-1">
                {page.title || `Page ${pageIndex + 1}`}
              </h3>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                {page.is_edited && (
                  <Badge className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 font-manrope">
                    <Edit className="h-3 w-3 mr-1" />
                    Edited
                  </Badge>
                )}
                <Badge className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 font-manrope">
                  Page {pageIndex + 1}
                </Badge>
              </div>
            </div>

            {/* URL if available */}
            {page.url && (
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 font-manrope min-w-0 mb-4">
                <ExternalLink className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                <a
                  href={page.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline truncate min-w-0 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  {page.url}
                </a>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-gray-900 dark:text-white font-manrope">{wordCount.toLocaleString()}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 font-manrope">Words</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-gray-900 dark:text-white font-manrope">{charCount.toLocaleString()}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 font-manrope">Characters</div>
              </div>
              {page.sourceName && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white font-manrope truncate" title={page.sourceName}>{page.sourceName}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 font-manrope">Source</div>
                </div>
              )}
            </div>
          </div>

          {/* Content Display */}
          <div className="flex-1 flex flex-col space-y-4 min-h-0">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white font-manrope flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Content
                </h4>
                {page.is_edited && (
                  <Badge className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 font-manrope">
                    Showing edited version
                  </Badge>
                )}
              </div>

              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full w-full">
                  <div className="p-4 sm:p-6">
                    <div className="prose prose-sm max-w-none">
                      <div
                        className="text-sm leading-relaxed whitespace-pre-wrap break-words font-mono text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600"
                        style={{
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                          hyphens: 'auto'
                        }}
                      >
                        {displayContent}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>

          {/* Edit History (if applicable) */}
          {page.is_edited && page.last_edited_at && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 flex-shrink-0">
              <div className="text-xs text-blue-700 dark:text-blue-300 font-manrope font-medium">
                Last edited: {new Date(page.last_edited_at).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KBContentPreviewModal;