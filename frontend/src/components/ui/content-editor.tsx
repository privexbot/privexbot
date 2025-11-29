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
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Edit Page Content
            {title && (
              <Badge variant="secondary" className="ml-2">
                {title}
              </Badge>
            )}
          </CardTitle>

          <div className="flex items-center gap-2">
            {hasEdited && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Previously Edited
              </Badge>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleRevert}
              disabled={isReverting || isLoading}
            >
              {isReverting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
              ) : (
                <Undo2 className="h-4 w-4" />
              )}
              {isReverting ? 'Reverting...' : 'Reset'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSaving || isReverting}
            >
              <Cancel className="h-4 w-4 mr-1" />
              Cancel
            </Button>

            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isSaving || isLoading}
            >
              {isSaving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Content Editor */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Edit Content (Markdown supported)
          </label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={20}
            className="font-mono text-sm resize-y"
            placeholder="Edit your content here..."
            disabled={isLoading}
          />
        </div>

        {/* Statistics */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Content Statistics</span>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <div className="font-medium text-gray-600">Characters</div>
              <div className="flex items-center gap-2">
                <span>{currentStats.characters.toLocaleString()}</span>
                {difference.characters !== 0 && (
                  <span className={`text-xs ${getDifferenceColor(difference.characters)}`}>
                    ({formatDifference(difference.characters)})
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-medium text-gray-600">Words</div>
              <div className="flex items-center gap-2">
                <span>{currentStats.words.toLocaleString()}</span>
                {difference.words !== 0 && (
                  <span className={`text-xs ${getDifferenceColor(difference.words)}`}>
                    ({formatDifference(difference.words)})
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-medium text-gray-600">Lines</div>
              <div className="flex items-center gap-2">
                <span>{currentStats.lines.toLocaleString()}</span>
                {difference.lines !== 0 && (
                  <span className={`text-xs ${getDifferenceColor(difference.lines)}`}>
                    ({formatDifference(difference.lines)})
                  </span>
                )}
              </div>
            </div>
          </div>

          {hasChanges && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                Changes: {Math.abs(difference.characters)} characters modified
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={isLoading}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy Content
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePaste}
              disabled={isLoading}
            >
              <Clipboard className="h-4 w-4 mr-1" />
              Paste
            </Button>
          </div>

          <div className="text-xs text-gray-500">
            Page {pageIndex + 1}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};