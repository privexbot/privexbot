/**
 * TextPasteInput - Direct text paste input
 *
 * WHY:
 * - Quick text addition
 * - No file needed
 * - Copy-paste convenience
 *
 * HOW:
 * - Large textarea
 * - Character count
 * - Metadata input
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileText, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import apiClient, { handleApiError } from '@/lib/api-client';

interface TextPasteInputProps {
  draftId: string;
  onTextAdded?: () => void;
}

export default function TextPasteInput({ draftId, onTextAdded }: TextPasteInputProps) {
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');

  // Add text mutation
  const addTextMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/kb-drafts/${draftId}/documents/text`, {
        title: title || 'Untitled Document',
        content,
        description,
      });
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: 'Text added successfully',
        description: `${content.length} characters added to knowledge base`,
      });

      // Clear form
      setTitle('');
      setContent('');
      setDescription('');

      if (onTextAdded) onTextAdded();
    },
    onError: (error) => {
      toast({
        title: 'Failed to add text',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    if (!content.trim()) {
      toast({
        title: 'Content required',
        description: 'Please paste some content',
        variant: 'destructive',
      });
      return;
    }

    addTextMutation.mutate();
  };

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const charCount = content.length;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Paste Text
        </h3>
        <p className="text-sm text-muted-foreground">
          Copy and paste content directly into your knowledge base
        </p>
      </div>

      <div>
        <Label htmlFor="title">Document Title (Optional)</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Product Documentation"
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor="description">Description (Optional)</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this content"
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor="content">Content *</Label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste your content here..."
          className="mt-2 font-mono text-sm min-h-[300px]"
          rows={15}
        />
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <div>
            {wordCount} {wordCount === 1 ? 'word' : 'words'} • {charCount.toLocaleString()}{' '}
            characters
          </div>
          {charCount > 0 && (
            <div className={charCount < 100 ? 'text-yellow-600' : 'text-green-600'}>
              {charCount < 100 ? '⚠️ Very short content' : '✓ Good length'}
            </div>
          )}
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!content.trim() || addTextMutation.isPending}
        className="w-full"
        size="lg"
      >
        {addTextMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Adding text...
          </>
        ) : (
          <>
            <CheckCircle className="w-4 h-4 mr-2" />
            Add to Knowledge Base
          </>
        )}
      </Button>

      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm">
          💡 <strong>Tips:</strong>
        </p>
        <ul className="text-sm space-y-1 mt-2 list-disc list-inside">
          <li>Paste documentation, FAQs, or any text-based content</li>
          <li>Markdown formatting is preserved</li>
          <li>Minimum recommended length: 100 characters</li>
          <li>You can add multiple text documents</li>
        </ul>
      </div>
    </div>
  );
}
