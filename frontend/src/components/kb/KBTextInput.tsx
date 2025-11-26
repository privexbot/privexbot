/**
 * Text Input Component
 *
 * Direct text input for knowledge base content
 */

import { useState } from 'react';
import { Type, Plus, FileText, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';

interface KBTextInputProps {
  onAdd: (sourceData: any) => void;
  onCancel: () => void;
}

export function KBTextInput({ onAdd, onCancel }: KBTextInputProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [config, setConfig] = useState({
    format: 'plain',
    preserve_formatting: true,
    auto_title: false,
    language: 'auto'
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const contentTemplates = [
    {
      id: 'faq',
      name: 'FAQ',
      description: 'Question and answer format',
      template: 'Q: What is this feature?\nA: This feature allows...\n\nQ: How do I use it?\nA: To use this feature...'
    },
    {
      id: 'procedure',
      name: 'Procedure',
      description: 'Step-by-step instructions',
      template: 'Title: How to...\n\nStep 1: First, you need to...\nStep 2: Next, you should...\nStep 3: Finally, you can...'
    },
    {
      id: 'policy',
      name: 'Policy',
      description: 'Company policy or guidelines',
      template: 'Policy: [Policy Name]\n\nOverview:\n[Brief description]\n\nGuidelines:\n1. [Guideline 1]\n2. [Guideline 2]\n\nExceptions:\n[Any exceptions]'
    },
    {
      id: 'knowledge',
      name: 'Knowledge Article',
      description: 'General knowledge content',
      template: 'Title: [Article Title]\n\nSummary:\n[Brief summary]\n\nDetails:\n[Detailed content]\n\nRelated Topics:\n- [Topic 1]\n- [Topic 2]'
    }
  ];

  const handleTemplateSelect = (templateId: string) => {
    const template = contentTemplates.find(t => t.id === templateId);
    if (template) {
      setContent(template.template);
      if (!title && config.auto_title) {
        setTitle(template.name);
      }
    }
  };

  const getContentStats = () => {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const characters = content.length;
    const lines = content.split('\n').length;

    return { words, characters, lines };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({
        title: 'Title Required',
        description: 'Please enter a title for this content',
        variant: 'destructive'
      });
      return;
    }

    if (!content.trim()) {
      toast({
        title: 'Content Required',
        description: 'Please enter some content',
        variant: 'destructive'
      });
      return;
    }

    const stats = getContentStats();
    if (stats.words < 10) {
      toast({
        title: 'Content Too Short',
        description: 'Please enter at least 10 words of content',
        variant: 'destructive'
      });
      return;
    }

    onAdd({
      title: title.trim(),
      content: content.trim(),
      config: {
        ...config,
        stats
      }
    });

    // Reset form
    setTitle('');
    setContent('');
    setConfig({
      format: 'plain',
      preserve_formatting: true,
      auto_title: false,
      language: 'auto'
    });
  };

  const stats = getContentStats();

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Type className="h-5 w-5" />
          Add Text Content
        </CardTitle>
        <CardDescription>
          Enter text content directly or use a template
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Content Templates */}
          <div className="space-y-3">
            <Label>Quick Templates (Optional)</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {contentTemplates.map((template) => (
                <Button
                  key={template.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto p-3 flex flex-col items-start text-left"
                  onClick={() => handleTemplateSelect(template.id)}
                >
                  <span className="font-medium text-xs">{template.name}</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    {template.description}
                  </span>
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Select a template to get started, or write your own content below
            </p>
          </div>

          {/* Title Input */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., How to reset your password"
              className="text-base"
            />
            <p className="text-xs text-muted-foreground">
              Give your content a descriptive title
            </p>
          </div>

          {/* Content Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content">Content *</Label>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{stats.words} words</span>
                <span>{stats.characters} characters</span>
                <span>{stats.lines} lines</span>
              </div>
            </div>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your content here..."
              rows={12}
              className="text-base font-mono"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Supports plain text, markdown formatting, and structured content
              </p>
              <div className="flex gap-2">
                {stats.words >= 10 && (
                  <Badge variant="default" className="text-xs">
                    ✓ Good length
                  </Badge>
                )}
                {stats.words < 10 && stats.words > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    Too short
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Advanced Options */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Advanced Options
                <span className="text-xs text-muted-foreground">
                  {showAdvanced ? '▼' : '▶'}
                </span>
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Content Format</Label>
                  <Select
                    value={config.format}
                    onValueChange={(value) => setConfig({ ...config, format: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plain">Plain Text</SelectItem>
                      <SelectItem value="markdown">Markdown</SelectItem>
                      <SelectItem value="structured">Structured Text</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select
                    value={config.language}
                    onValueChange={(value) => setConfig({ ...config, language: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="preserve-formatting"
                    checked={config.preserve_formatting}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, preserve_formatting: !!checked })
                    }
                  />
                  <Label htmlFor="preserve-formatting" className="text-sm">
                    Preserve line breaks and formatting
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto-title"
                    checked={config.auto_title}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, auto_title: !!checked })
                    }
                  />
                  <Label htmlFor="auto-title" className="text-sm">
                    Auto-generate title from content (if empty)
                  </Label>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Preview */}
          {content.trim() && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="bg-gray-50 p-4 rounded-lg border max-h-32 overflow-y-auto">
                <div className="text-sm font-medium mb-2">{title || 'Untitled'}</div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {content.length > 200 ? content.substring(0, 200) + '...' : content}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || !content.trim() || stats.words < 10}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Text Content
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}