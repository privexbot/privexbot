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
import { Separator } from '@/components/ui/separator';
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
  const wordCount = displayContent.split(/\s+/).filter(word => word.length > 0).length;
  const charCount = displayContent.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-6xl h-[95vh] max-h-[95vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Content Preview
          </DialogTitle>
          <DialogDescription>
            Review the extracted content as it will be added to your knowledge base
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-4 min-h-0 overflow-hidden">
          {/* Page Info */}
          <div className="flex-shrink-0 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-medium text-lg leading-tight min-w-0 flex-1">
                {page.title || `Page ${pageIndex + 1}`}
              </h3>
              <div className="flex items-center gap-2 flex-shrink-0">
                {page.is_edited && (
                  <Badge variant="outline" className="text-xs">
                    <Edit className="h-3 w-3 mr-1" />
                    Edited
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  Page {pageIndex + 1}
                </Badge>
              </div>
            </div>

            {/* URL if available */}
            {page.url && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                <ExternalLink className="h-4 w-4 flex-shrink-0" />
                <a
                  href={page.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline truncate min-w-0"
                >
                  {page.url}
                </a>
              </div>
            )}

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{wordCount.toLocaleString()} words</span>
              <span>•</span>
              <span>{charCount.toLocaleString()} characters</span>
              {page.sourceName && (
                <>
                  <span>•</span>
                  <span className="truncate">Source: {page.sourceName}</span>
                </>
              )}
            </div>

            <Separator />
          </div>

          {/* Content Display */}
          <div className="flex-1 flex flex-col space-y-2 min-h-0">
            <div className="flex items-center justify-between flex-shrink-0">
              <h4 className="font-medium">Content</h4>
              {page.is_edited && (
                <Badge variant="outline" className="text-xs">
                  Showing edited version
                </Badge>
              )}
            </div>

            <div className="flex-1 border rounded-lg overflow-hidden">
              <ScrollArea className="h-full w-full">
                <div className="p-4">
                  <div className="prose prose-sm max-w-none">
                    <div
                      className="text-sm leading-relaxed whitespace-pre-wrap break-words font-mono"
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

          {/* Edit History (if applicable) */}
          {page.is_edited && page.last_edited_at && (
            <div className="text-xs text-muted-foreground flex-shrink-0">
              Last edited: {new Date(page.last_edited_at).toLocaleString()}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KBContentPreviewModal;