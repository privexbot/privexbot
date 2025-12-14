/**
 * Content Editor Component
 *
 * WHY: Enable manual content editing in preview pages
 * HOW: Rich textarea editor with save/revert/copy functionality
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from './button';
import { Textarea } from './textarea';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import {
  Save,
  X as Cancel,
  Undo2,
  Copy,
  Clipboard,
  FileText,
  BarChart3
} from 'lucide-react';
import { toast } from './use-toast';

interface EditOperation {
  operation: 'delete' | 'replace' | 'insert';
  position: number;
  original_text?: string;
  new_text?: string;
  timestamp: string;
}

interface ContentEditorProps {
  pageIndex: number;
  originalContent: string;
  editedContent?: string;
  title?: string;
  onSave: (content: string, operations: EditOperation[]) => Promise<void>;
  onCancel: () => void;
  onRevert: () => Promise<void>;
  isLoading?: boolean;
}

export const ContentEditor: React.FC<ContentEditorProps> = ({
  pageIndex,
  originalContent,
  editedContent,
  title,
  onSave,
  onCancel,
  onRevert,
  isLoading = false
}) => {
  const [content, setContent] = useState(editedContent || originalContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  // Update content when editedContent changes
  useEffect(() => {
    setContent(editedContent || originalContent);
  }, [editedContent, originalContent]);

  // Calculate statistics
  const originalStats = {
    characters: originalContent.length,
    words: originalContent.split(/\s+/).filter(Boolean).length,
    lines: originalContent.split('\n').length
  };

  const currentStats = {
    characters: content.length,
    words: content.split(/\s+/).filter(Boolean).length,
    lines: content.split('\n').length
  };

  const difference = {
    characters: currentStats.characters - originalStats.characters,
    words: currentStats.words - originalStats.words,
    lines: currentStats.lines - originalStats.lines
  };

  const hasChanges = content !== originalContent;
  const hasEdited = editedContent && editedContent !== originalContent;

  const handleSave = useCallback(async () => {
    if (!hasChanges) {
      onCancel();
      return;
    }

    setIsSaving(true);
    try {
      // Create simple edit operation
      const operation: EditOperation = {
        operation: 'replace',
        position: 0,
        original_text: originalContent,
        new_text: content,
        timestamp: new Date().toISOString()
      };

      await onSave(content, [operation]);

      toast({
        title: 'Content Saved',
        description: 'Your edits have been saved successfully.',
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'Failed to save your edits. Please try again.',
        variant: 'destructive'
      });
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [content, originalContent, hasChanges, onSave, onCancel]);

  const handleRevert = useCallback(async () => {
    setIsReverting(true);
    try {
      await onRevert();
      setContent(originalContent);

      toast({
        title: 'Content Reverted',
        description: 'Content has been reverted to original version.',
      });
    } catch (error) {
      toast({
        title: 'Revert Failed',
        description: 'Failed to revert content. Please try again.',
        variant: 'destructive'
      });
      console.error('Revert error:', error);
    } finally {
      setIsReverting(false);
    }
  }, [onRevert, originalContent]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: 'Content Copied',
        description: 'Content has been copied to clipboard.',
      });
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy content to clipboard.',
        variant: 'destructive'
      });
    }
  }, [content]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setContent(text);
      toast({
        title: 'Content Pasted',
        description: 'Content has been pasted from clipboard.',
      });
    } catch (error) {
      toast({
        title: 'Paste Failed',
        description: 'Failed to paste content from clipboard.',
        variant: 'destructive'
      });
    }
  }, []);

  const formatDifference = (value: number) => {
    if (value > 0) return `+${value}`;
    return value.toString();
  };

  const getDifferenceColor = (value: number) => {
    if (value > 0) return 'text-green-600 dark:text-green-400';
    if (value < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  return (
    <Card className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-gray-200 dark:border-gray-700 rounded-t-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white font-manrope flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span>Edit Page Content</span>
              {title && (
                <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 font-manrope font-medium">
                  {title}
                </Badge>
              )}
            </div>
          </CardTitle>

          <div className="flex flex-wrap items-center gap-2">
            {hasEdited && (
              <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 font-manrope font-medium">
                Previously Edited
              </Badge>
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevert}
                disabled={isReverting || isLoading}
                className="bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50 font-manrope"
              >
                {isReverting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-300 dark:border-orange-600 border-t-orange-600 dark:border-t-orange-300" />
                ) : (
                  <Undo2 className="h-4 w-4" />
                )}
                <span className="ml-1.5 hidden sm:inline">{isReverting ? 'Reverting...' : 'Reset'}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isSaving || isReverting}
                className="border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-manrope"
              >
                <Cancel className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Cancel</span>
              </Button>

              <Button
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges || isSaving || isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-manrope disabled:bg-gray-400 dark:disabled:bg-gray-600"
              >
                {isSaving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span className="ml-1.5">{isSaving ? 'Saving...' : 'Save'}</span>
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-4 sm:p-6">
        {/* Content Editor */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-900 dark:text-white font-manrope flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Edit Content
              <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 text-xs font-manrope">
                Markdown supported
              </Badge>
            </label>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
              Page {pageIndex + 1}
            </div>
          </div>
          <div className="relative">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="font-mono text-sm resize-y border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="Edit your content here..."
              disabled={isLoading}
            />
            {hasChanges && (
              <div className="absolute top-2 right-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" title="Unsaved changes" />
              </div>
            )}
          </div>
        </div>

        {/* Statistics */}
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white font-manrope">Content Statistics</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 font-manrope mb-1">Characters</div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-900 dark:text-white font-manrope">
                  {currentStats.characters.toLocaleString()}
                </span>
                {difference.characters !== 0 && (
                  <span className={`text-xs font-medium font-manrope ${getDifferenceColor(difference.characters)}`}>
                    ({formatDifference(difference.characters)})
                  </span>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 font-manrope mb-1">Words</div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-900 dark:text-white font-manrope">
                  {currentStats.words.toLocaleString()}
                </span>
                {difference.words !== 0 && (
                  <span className={`text-xs font-medium font-manrope ${getDifferenceColor(difference.words)}`}>
                    ({formatDifference(difference.words)})
                  </span>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 font-manrope mb-1">Lines</div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-900 dark:text-white font-manrope">
                  {currentStats.lines.toLocaleString()}
                </span>
                {difference.lines !== 0 && (
                  <span className={`text-xs font-medium font-manrope ${getDifferenceColor(difference.lines)}`}>
                    ({formatDifference(difference.lines)})
                  </span>
                )}
              </div>
            </div>
          </div>

          {hasChanges && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                <div className="text-xs text-gray-600 dark:text-gray-400 font-manrope font-medium">
                  {Math.abs(difference.characters)} characters modified • Unsaved changes
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={isLoading}
              className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 font-manrope"
            >
              <Copy className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Copy Content</span>
              <span className="sm:hidden">Copy</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePaste}
              disabled={isLoading}
              className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 font-manrope"
            >
              <Clipboard className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Paste</span>
              <span className="sm:hidden">Paste</span>
            </Button>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 font-manrope">
            {hasChanges ? (
              <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                <span className="font-medium">Unsaved changes</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="font-medium">All changes saved</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};