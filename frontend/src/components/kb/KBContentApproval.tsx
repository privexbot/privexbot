/**
 * Content Approval Component
 *
 * Phase 1C: Review and approve extracted content before chunking
 * Shows all extracted pages, allows bulk/individual approval
 */

import React, { useState, useEffect } from 'react';
import { useKBStore } from '@/store/kb-store';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  FileText,
  Edit,
  Eye,
  AlertCircle,
  Loader2,
  CheckSquare,
  Square,
} from 'lucide-react';
import { KBContentPreviewModal } from './KBContentPreviewModal';
import { cn } from '@/lib/utils';
import { ApprovedSource } from '@/types/knowledge-base';
import { toast } from '@/components/ui/use-toast';

interface KBContentApprovalProps {
  onApprove: (approvedSources: ApprovedSource[]) => void;
  onBack?: () => void;
}

export const KBContentApproval: React.FC<KBContentApprovalProps> = ({
  onApprove,
  onBack,
}) => {
  const {
    currentDraft,
    previewData,
    draftSources,
    approveContent,
    updateSource,
  } = useKBStore();

  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [isApproving, setIsApproving] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number | null>(null);

  // CRITICAL FIX: Get all preview pages from ALL added sources, not just global previewData
  const allPages = React.useMemo(() => {
    const pages: any[] = [];
    let pageIndex = 0;

    // Aggregate pages from ALL sources in draftSources that have preview data
    draftSources.forEach((source, sourceIndex) => {
      const sourcePreviewPages = source.metadata?.previewPages;
      const approvedPageIndices = Array.isArray(source.metadata?.approvedPageIndices)
        ? source.metadata.approvedPageIndices
        : [];

      if (sourcePreviewPages && Array.isArray(sourcePreviewPages)) {
        sourcePreviewPages.forEach((page, pageInSourceIndex) => {
          // Ensure character and word counts are calculated
          const content = page.edited_content || page.content || '';
          const wordCount = content.split(/\s+/).filter((word: string) => word.length > 0).length;
          const charCount = content.length;

          // CRITICAL: Restore approval state from draftSources metadata
          const isPageApprovedByIndex = approvedPageIndices.includes(pageInSourceIndex);

          // SIMPLE CONTENT VALIDATION: If page was edited after approval, it needs re-approval
          const pageWasEditedAfterApproval = page.is_edited && isPageApprovedByIndex;
          const isActuallyApproved = isPageApprovedByIndex && !pageWasEditedAfterApproval;

          if (pageWasEditedAfterApproval) {
            console.log(`🔄 Page ${pageInSourceIndex} in source ${source.source_id} was edited after approval - requiring re-approval`);
          }

          pages.push({
            ...page,
            originalIndex: pageIndex++,
            pageInSourceIndex: pageInSourceIndex, // Track page index within its source
            sourceId: source.source_id,
            sourceIndex: sourceIndex,
            sourceUrl: source.url || `Source ${sourceIndex + 1}`,
            sourceName: source.url || source.metadata?.title || `Source ${sourceIndex + 1}`,
            hasEdits: source.metadata?.hasEdits || false,
            // Ensure counts are properly calculated
            word_count: page.word_count || wordCount,
            char_count: page.char_count || charCount,
            is_edited: page.is_edited || false,
            // SMART APPROVAL STATE: Only approved if not edited since approval
            is_approved: isActuallyApproved || page.is_approved || false,
            approved_at: isActuallyApproved ? source.metadata?.lastApprovalAt : page.approved_at,
            // Track if this needs re-approval due to edits
            needs_reapproval: pageWasEditedAfterApproval
          });
        });
      }
    });

    console.log(`🎯 CONTENT APPROVAL: Aggregated ${pages.length} pages from ${draftSources.length} sources`);
    const approvedCount = pages.filter(p => p.is_approved).length;
    console.log(`📋 APPROVAL STATE: ${approvedCount} pages already approved (restored from navigation)`);

    draftSources.forEach((source, idx) => {
      const pageCount = Array.isArray(source.metadata?.previewPages)
        ? source.metadata.previewPages.length
        : 0;
      const approvedInSource = Array.isArray(source.metadata?.approvedPageIndices)
        ? source.metadata.approvedPageIndices.length
        : 0;
      console.log(`  Source ${idx + 1}: ${pageCount} pages, ${approvedInSource} approved (${source.url || 'N/A'})`);
    });

    return pages;
  }, [draftSources]);


  // Initialize with all NON-APPROVED pages OR pages needing re-approval selected
  useEffect(() => {
    if (allPages.length > 0 && selectedPages.size === 0) {
      // Select pages that haven't been approved OR that need re-approval
      const selectableIndices = allPages
        .map((_, index) => index)
        .filter(index => {
          const page = allPages[index];
          // Select if: not approved OR needs re-approval
          return !page.is_approved || page.needs_reapproval;
        });

      console.log(`🔄 AUTO-SELECTION: Found ${allPages.length} total pages, ${selectableIndices.length} selectable (unapproved or needs re-approval)`);
      allPages.forEach((page, index) => {
        console.log(`  Page ${index}: approved=${page.is_approved}, edited=${page.is_edited}, needs_reapproval=${page.needs_reapproval}, selectable=${!page.is_approved || page.needs_reapproval}`);
      });

      setSelectedPages(new Set(selectableIndices));
    }
  }, [allPages]);

  const togglePageSelection = (pageIndex: number) => {
    const page = allPages[pageIndex];
    // Prevent selection of already approved pages UNLESS they need re-approval
    if (page?.is_approved && !page?.needs_reapproval) {
      toast({
        title: "Page Already Approved",
        description: "This page has already been approved and cannot be selected again",
        variant: "default",
      });
      return;
    }

    const newSelected = new Set(selectedPages);
    if (newSelected.has(pageIndex)) {
      newSelected.delete(pageIndex);
    } else {
      newSelected.add(pageIndex);
    }
    setSelectedPages(newSelected);
  };

  const toggleAllPages = () => {
    // Include pages that need re-approval in the selection
    const selectableIndices = allPages
      .map((_, index) => index)
      .filter(index => {
        const page = allPages[index];
        return !page.is_approved || page.needs_reapproval;
      });

    if (selectedPages.size === selectableIndices.length) {
      setSelectedPages(new Set());
    } else {
      setSelectedPages(new Set(selectableIndices));
    }
  };


  const handleApproveSelected = async () => {
    if (selectedPages.size === 0) {
      toast({
        title: "No Pages Selected",
        description: "Please select at least one page to approve",
        variant: "destructive",
      });
      return;
    }

    setIsApproving(true);
    try {
      // Convert selected page indices to array
      const pageIndices = Array.from(selectedPages).sort((a, b) => a - b);

      // Call the approve content API with aggregated pages
      const result = await approveContent(pageIndices, allPages);

      const currentTime = new Date().toISOString();

      // CRITICAL: Update draftSources metadata for persistence across navigation
      const sourceUpdates = new Map<string, { approvedPageIndices: number[], lastApprovalAt: string }>();

      // Group approved pages by source and track indices
      pageIndices.forEach(pageIndex => {
        const page = allPages[pageIndex];
        if (page) {
          // Mark in local state (for immediate UI feedback)
          page.is_approved = true;
          page.approved_at = currentTime;
          // CRITICAL FIX: Clear edit flag after successful approval
          // This prevents endless "needs re-approval" cycles
          page.is_edited = false;
          page.needs_reapproval = false;

          // Track for source metadata update
          if (!sourceUpdates.has(page.sourceId)) {
            sourceUpdates.set(page.sourceId, { approvedPageIndices: [], lastApprovalAt: currentTime });
          }
          sourceUpdates.get(page.sourceId)!.approvedPageIndices.push(page.pageInSourceIndex);
        }
      });

      // PERSIST TO DRAFT SOURCES: Update each source's metadata AND clear edit flags
      sourceUpdates.forEach(({ approvedPageIndices, lastApprovalAt }, sourceId) => {
        // Get existing approved indices from source
        const existingSource = draftSources.find(s => s.source_id === sourceId);
        if (existingSource) {
          const existingApproved = Array.isArray(existingSource.metadata?.approvedPageIndices)
            ? existingSource.metadata.approvedPageIndices
            : [];
          const allApproved = [...new Set([...existingApproved, ...approvedPageIndices])]; // Merge and dedupe

          // CRITICAL FIX: Update previewPages to clear edit flags for approved pages
          const existingPreviewPages = existingSource.metadata?.previewPages;
          const updatedPreviewPages = Array.isArray(existingPreviewPages)
            ? existingPreviewPages.map((page: any, pageIndex: number) => {
                if (approvedPageIndices.includes(pageIndex)) {
                  // Clear edit flags for this approved page to prevent endless re-approval cycles
                  return {
                    ...page,
                    is_edited: false,
                    is_approved: true,
                    approved_at: lastApprovalAt
                  };
                }
                return page;
              })
            : [];

          console.log(`💾 PERSISTING APPROVAL: Source ${sourceId} - adding indices ${approvedPageIndices}, total approved: ${allApproved}, cleared edit flags on ${approvedPageIndices.length} pages`);

          updateSource(sourceId, {
            metadata: {
              ...existingSource.metadata,
              approvedPageIndices: allApproved,
              lastApprovalAt: lastApprovalAt,
              hasApprovedContent: true,
              approvedPageCount: allApproved.length,
              // Update the actual previewPages with cleared edit flags
              previewPages: updatedPreviewPages
            }
          });
        }
      });

      toast({
        title: "Content Approved",
        description: `Successfully approved ${pageIndices.length} pages (${pageIndices.length} pages now persistent across navigation)`,
      });

      // Clear selection after approval
      console.log(`🧹 CLEARING SELECTION: Was ${selectedPages.size} pages selected, clearing all selections`);
      setSelectedPages(new Set());

      // FORCE UI UPDATE: Trigger re-calculation of allPages with updated source data
      console.log(`🔄 APPROVAL COMPLETE: ${pageIndices.length} pages approved, UI should update with cleared edit flags`);

      // Notify parent component
      if (onApprove && result) {
        onApprove([result]);
      }
    } catch (error) {
      toast({
        title: "Approval Failed",
        description: error instanceof Error ? error.message : "Failed to approve content",
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handlePreviewPage = (pageIndex: number) => {
    setSelectedPageIndex(pageIndex);
    setShowPreviewModal(true);
  };

  const getPageStats = () => {
    const editedCount = allPages.filter(p => p.is_edited).length;
    const approvedCount = allPages.filter(p => p.is_approved).length;
    const totalWords = allPages.reduce((sum, p) => {
      const content = p.edited_content || p.content || '';
      return sum + content.split(/\s+/).filter((word: string) => word.length > 0).length;
    }, 0);

    return {
      totalPages: allPages.length,
      selectedPages: selectedPages.size,
      editedPages: editedCount,
      totalWords,
      approvedSources: approvedCount, // Now counts approved pages, not sources
    };
  };

  const stats = getPageStats();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Content Approval
          </CardTitle>
          <CardDescription>
            Review extracted content and approve pages for knowledge base creation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold">{stats.totalPages}</div>
              <div className="text-sm text-muted-foreground">Total Pages</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.selectedPages}</div>
              <div className="text-sm text-muted-foreground">Selected</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{stats.editedPages}</div>
              <div className="text-sm text-muted-foreground">Edited</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold">{stats.totalWords}</div>
              <div className="text-sm text-muted-foreground">Total Words</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.approvedSources}</div>
              <div className="text-sm text-muted-foreground">Approved</div>
            </div>
          </div>

          <Separator />

          {/* Extracted Pages Section */}
          {allPages.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Extracted Pages</h4>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleAllPages}
                  >
                    {(() => {
                      const selectableCount = allPages.filter(p => !p.is_approved || p.needs_reapproval).length;
                      const allSelectableSelected = selectedPages.size === selectableCount && selectableCount > 0;

                      return allSelectableSelected ? (
                        <>
                          <CheckSquare className="h-4 w-4 mr-1" />
                          Deselect All
                        </>
                      ) : (
                        <>
                          <Square className="h-4 w-4 mr-1" />
                          Select All ({selectableCount})
                        </>
                      );
                    })()}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApproveSelected}
                    disabled={selectedPages.size === 0 || isApproving}
                  >
                    {isApproving ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                    )}
                    Approve Selected ({selectedPages.size})
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[400px] border rounded-lg p-4">
                <div className="space-y-2">
                  {allPages.map((page, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                        page.is_approved
                          ? "bg-green-50 border-green-300 opacity-75"
                          : page.needs_reapproval
                          ? "bg-amber-50 border-amber-300"
                          : selectedPages.has(index)
                          ? "bg-blue-50 border-blue-300"
                          : "hover:bg-gray-50"
                      )}
                    >
                      <Checkbox
                        checked={selectedPages.has(index)}
                        disabled={page.is_approved && !page.needs_reapproval}
                        onCheckedChange={() => togglePageSelection(index)}
                      />

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {page.title || `Page ${index + 1}`}
                          </span>
                          {page.is_approved && (
                            <Badge variant="default" className="text-xs bg-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Approved
                            </Badge>
                          )}
                          {page.needs_reapproval && (
                            <Badge variant="outline" className="text-xs border-amber-500 text-amber-700">
                              <Edit className="h-3 w-3 mr-1" />
                              Needs Re-approval
                            </Badge>
                          )}
                          {page.is_edited && !page.needs_reapproval && (
                            <Badge variant="outline" className="text-xs">
                              <Edit className="h-3 w-3 mr-1" />
                              Edited
                            </Badge>
                          )}
                        </div>
                        {page.url && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {page.url}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          {(() => {
                            // Use same calculation as modal for consistency
                            const content = page.edited_content || page.content || '';
                            const liveWordCount = content.split(/\s+/).filter((word: string) => word.length > 0).length;
                            const liveCharCount = content.length;
                            return `${liveWordCount} words • ${liveCharCount.toLocaleString()} characters`;
                          })()}
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreviewPage(index)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}


          {/* No Content Message */}
          {allPages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No content available for approval</p>
              <p className="text-sm mt-2">
                Go back to Content Review to extract content from your sources
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content Preview Modal */}
      {showPreviewModal && selectedPageIndex !== null && (
        <KBContentPreviewModal
          open={showPreviewModal}
          onOpenChange={setShowPreviewModal}
          pageIndex={selectedPageIndex}
          allPages={allPages}
        />
      )}
    </>
  );
};

export default KBContentApproval;