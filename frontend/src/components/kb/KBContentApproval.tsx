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

    // DEBUG: Log draftSources state
    if (draftSources.length === 0) {
      console.log('⚠️ WARNING: draftSources is EMPTY in KBContentApproval');
    }

    // Aggregate pages from ALL sources in draftSources that have preview data
    draftSources.forEach((source, sourceIndex) => {
      // Support both metadata.previewPages (frontend) and preview_pages (backend direct)
      const sourcePreviewPages = source.metadata?.previewPages || source.metadata?.preview_pages;
      const approvedPageIndices = Array.isArray(source.metadata?.approvedPageIndices)
        ? source.metadata.approvedPageIndices
        : [];

      console.log(`🔍 DEBUG: Source ${sourceIndex + 1} (${source.type}) - source_id=${source.source_id}, approvedPageIndices:`, approvedPageIndices, 'previewPages count:', Array.isArray(sourcePreviewPages) ? sourcePreviewPages.length : 0);

      if (sourcePreviewPages && Array.isArray(sourcePreviewPages)) {
        sourcePreviewPages.forEach((page, pageInSourceIndex) => {
          // Ensure character and word counts are calculated
          const content = page.edited_content || page.content || '';
          const wordCount = content.split(/\s+/).filter((word: string) => word.length > 0).length;
          const charCount = content.length;

          // CRITICAL: Restore approval state from draftSources metadata
          const isPageApprovedByIndex = approvedPageIndices.includes(pageInSourceIndex);

          // SIMPLE CONTENT VALIDATION: If page was edited after approval, it needs re-approval
          const pageWasEditedAfterApproval = Boolean(page.is_edited) && isPageApprovedByIndex;
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
            is_edited: Boolean(page.is_edited),
            // CRITICAL FIX: Use calculated approval state, ignore backend page.is_approved
            // Backend may return pages with is_approved=true from previous sessions
            is_approved: isActuallyApproved,
            approved_at: isActuallyApproved ? source.metadata?.lastApprovalAt : null,
            // Track if this needs re-approval due to edits (ensure boolean)
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


  // Check for pre-approved pages from immediate preview
  const preApprovedCount = React.useMemo(() => {
    return allPages.filter(p => p.is_approved && !p.needs_reapproval).length;
  }, [allPages]);

  const hasPreApprovedSources = React.useMemo(() => {
    return draftSources.some(source => source.metadata?.approvedSources === true);
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

  // Auto-approve pre-approved sources from immediate preview
  useEffect(() => {
    if (hasPreApprovedSources && preApprovedCount === allPages.length && allPages.length > 0) {
      console.log(`✅ ALL PAGES PRE-APPROVED: Auto-notifying parent that ${preApprovedCount} pages are already approved`);
      // All pages were pre-approved during source addition, notify parent
      toast({
        title: "Content Pre-Approved",
        description: `All ${preApprovedCount} pages were approved during source addition. You can proceed to the next step.`,
      });
    }
  }, [hasPreApprovedSources, preApprovedCount, allPages.length]);

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
      <Card className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-b border-gray-200 dark:border-gray-700 rounded-t-xl">
          <CardTitle className="flex items-center gap-3 text-xl sm:text-2xl font-bold text-gray-900 dark:text-white font-manrope">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            Content Approval
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope text-base leading-relaxed">
            Review extracted content and approve pages for knowledge base creation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-4 sm:p-6">
          {/* Statistics */}
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-600 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white font-manrope">{stats.totalPages.toLocaleString()}</div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-manrope font-medium">Total Pages</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 sm:p-4 border border-blue-200 dark:border-blue-700 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400 font-manrope">{stats.selectedPages.toLocaleString()}</div>
                <div className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 font-manrope font-medium">Selected</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3 sm:p-4 border border-amber-200 dark:border-amber-700 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400 font-manrope">{stats.editedPages.toLocaleString()}</div>
                <div className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 font-manrope font-medium">Edited</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-3 sm:p-4 border border-purple-200 dark:border-purple-700 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400 font-manrope">{stats.totalWords.toLocaleString()}</div>
                <div className="text-xs sm:text-sm text-purple-700 dark:text-purple-300 font-manrope font-medium">Total Words</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3 sm:p-4 border border-green-200 dark:border-green-700 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400 font-manrope">{stats.approvedSources.toLocaleString()}</div>
                <div className="text-xs sm:text-sm text-green-700 dark:text-green-300 font-manrope font-medium">Approved</div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Extracted Pages Section */}
          {allPages.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white font-manrope flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Extracted Pages
                </h4>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleAllPages}
                    className="border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-manrope"
                  >
                    {(() => {
                      const selectableCount = allPages.filter(p => !p.is_approved || p.needs_reapproval).length;
                      const allSelectableSelected = selectedPages.size === selectableCount && selectableCount > 0;

                      return allSelectableSelected ? (
                        <>
                          <CheckSquare className="h-4 w-4 mr-1.5" />
                          <span className="hidden sm:inline">Deselect All</span>
                          <span className="sm:hidden">Deselect</span>
                        </>
                      ) : (
                        <>
                          <Square className="h-4 w-4 mr-1.5" />
                          <span className="hidden sm:inline">Select All ({selectableCount})</span>
                          <span className="sm:hidden">All ({selectableCount})</span>
                        </>
                      );
                    })()}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApproveSelected}
                    disabled={selectedPages.size === 0 || isApproving}
                    className="bg-green-600 hover:bg-green-700 text-white font-manrope disabled:bg-gray-400 dark:disabled:bg-gray-600"
                  >
                    {isApproving ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    )}
                    <span className="hidden sm:inline">Approve Selected ({selectedPages.size})</span>
                    <span className="sm:hidden">Approve ({selectedPages.size})</span>
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[400px] border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900/50 p-3 sm:p-4">
                <div className="space-y-3">
                  {allPages.map((page, index) => (
                    <div
                      key={index}
                      className={cn(
                        "rounded-xl border transition-all duration-200 shadow-sm hover:shadow-md overflow-hidden",
                        page.is_approved
                          ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 opacity-90"
                          : page.needs_reapproval
                          ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700"
                          : selectedPages.has(index)
                          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700"
                          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      )}
                    >
                      {/* Mobile: Stacked Layout */}
                      <div className="block sm:hidden">
                        <div className="p-4 space-y-3">
                          {/* Header with checkbox and title */}
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={selectedPages.has(index)}
                              disabled={page.is_approved && !page.needs_reapproval}
                              onCheckedChange={() => togglePageSelection(index)}
                              className="mt-1 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-2">
                                <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                                <span className="font-semibold text-gray-900 dark:text-white font-manrope text-sm leading-tight break-words">
                                  {page.title || `Page ${index + 1}`}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Badges */}
                          <div className="flex flex-wrap gap-1.5 pl-9">
                            {page.is_approved && (
                              <Badge className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 font-manrope">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Approved
                              </Badge>
                            )}
                            {page.needs_reapproval && (
                              <Badge className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 font-manrope">
                                <Edit className="h-3 w-3 mr-1" />
                                Needs Re-approval
                              </Badge>
                            )}
                            {page.is_edited && !page.needs_reapproval && (
                              <Badge className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 font-manrope">
                                <Edit className="h-3 w-3 mr-1" />
                                Edited
                              </Badge>
                            )}
                          </div>

                          {/* URL (if available) */}
                          {page.url && (
                            <div className="pl-9">
                              <div className="text-xs text-gray-500 dark:text-gray-400 font-manrope bg-gray-50 dark:bg-gray-700/30 px-2 py-1 rounded break-all text-wrap max-w-full">
                                {page.url}
                              </div>
                            </div>
                          )}

                          {/* Stats */}
                          <div className="pl-9">
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                              {(() => {
                                const content = page.edited_content || page.content || '';
                                const liveWordCount = content.split(/\s+/).filter((word: string) => word.length > 0).length;
                                const liveCharCount = content.length;
                                return `${liveWordCount.toLocaleString()} words • ${liveCharCount.toLocaleString()} characters`;
                              })()}
                            </div>
                          </div>

                          {/* Preview button */}
                          <div className="pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePreviewPage(index)}
                              className="border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-manrope w-full"
                            >
                              <Eye className="h-4 w-4" />
                              <span className="ml-1.5">Preview Content</span>
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Desktop: Horizontal Layout */}
                      <div className="hidden sm:flex sm:items-center gap-4 p-4">
                        <Checkbox
                          checked={selectedPages.has(index)}
                          disabled={page.is_approved && !page.needs_reapproval}
                          onCheckedChange={() => togglePageSelection(index)}
                          className="flex-shrink-0"
                        />

                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-start gap-2">
                            <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold text-gray-900 dark:text-white font-manrope block truncate">
                                {page.title || `Page ${index + 1}`}
                              </span>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {page.is_approved && (
                                  <Badge className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 font-manrope">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Approved
                                  </Badge>
                                )}
                                {page.needs_reapproval && (
                                  <Badge className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 font-manrope">
                                    <Edit className="h-3 w-3 mr-1" />
                                    Needs Re-approval
                                  </Badge>
                                )}
                                {page.is_edited && !page.needs_reapproval && (
                                  <Badge className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 font-manrope">
                                    <Edit className="h-3 w-3 mr-1" />
                                    Edited
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          {page.url && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-manrope truncate bg-gray-50 dark:bg-gray-700/30 px-2 py-1 rounded max-w-md" title={page.url}>
                              {page.url}
                            </div>
                          )}

                          <div className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                            {(() => {
                              const content = page.edited_content || page.content || '';
                              const liveWordCount = content.split(/\s+/).filter((word: string) => word.length > 0).length;
                              const liveCharCount = content.length;
                              return `${liveWordCount.toLocaleString()} words • ${liveCharCount.toLocaleString()} characters`;
                            })()}
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreviewPage(index)}
                          className="border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-manrope flex-shrink-0"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="ml-1.5">Preview</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}


          {/* No Content Message */}
          {allPages.length === 0 && (
            <div className="text-center py-12 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
              <AlertCircle className="h-10 w-10 text-gray-400 dark:text-gray-500 mx-auto mb-6" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white font-manrope mb-2">No content available for approval</h3>
              <p className="text-gray-600 dark:text-gray-400 font-manrope leading-relaxed max-w-md mx-auto">
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