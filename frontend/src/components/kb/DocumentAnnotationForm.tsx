/**
 * DocumentAnnotationForm - Add metadata to documents
 *
 * WHY:
 * - Enhance search relevance
 * - Add context
 * - Custom metadata
 *
 * HOW:
 * - Tag input
 * - Custom fields
 * - Category selection
 */

import { useState } from 'react';
import { Tag, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DocumentMetadata {
  tags: string[];
  category?: string;
  author?: string;
  source?: string;
  custom_fields: Record<string, string>;
}

interface DocumentAnnotationFormProps {
  documentId?: string;
  initialData?: DocumentMetadata;
  onChange: (metadata: DocumentMetadata) => void;
}

const CATEGORIES = [
  'Documentation',
  'FAQ',
  'Tutorial',
  'API Reference',
  'Blog Post',
  'Product Info',
  'Support',
  'Legal',
  'Other',
];

export default function DocumentAnnotationForm({
  documentId,
  initialData,
  onChange,
}: DocumentAnnotationFormProps) {
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [category, setCategory] = useState<string | undefined>(initialData?.category);
  const [author, setAuthor] = useState(initialData?.author || '');
  const [source, setSource] = useState(initialData?.source || '');
  const [customFields, setCustomFields] = useState<Record<string, string>>(
    initialData?.custom_fields || {}
  );
  const [customKey, setCustomKey] = useState('');
  const [customValue, setCustomValue] = useState('');

  const updateMetadata = (updates: Partial<DocumentMetadata>) => {
    const metadata: DocumentMetadata = {
      tags,
      category,
      author,
      source,
      custom_fields: customFields,
      ...updates,
    };
    onChange(metadata);
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      const newTags = [...tags, tagInput.trim()];
      setTags(newTags);
      setTagInput('');
      updateMetadata({ tags: newTags });
    }
  };

  const removeTag = (tag: string) => {
    const newTags = tags.filter((t) => t !== tag);
    setTags(newTags);
    updateMetadata({ tags: newTags });
  };

  const addCustomField = () => {
    if (customKey.trim() && customValue.trim()) {
      const newFields = { ...customFields, [customKey.trim()]: customValue.trim() };
      setCustomFields(newFields);
      setCustomKey('');
      setCustomValue('');
      updateMetadata({ custom_fields: newFields });
    }
  };

  const removeCustomField = (key: string) => {
    const newFields = { ...customFields };
    delete newFields[key];
    setCustomFields(newFields);
    updateMetadata({ custom_fields: newFields });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Tag className="w-5 h-5" />
          Document Annotation
        </h3>
        <p className="text-sm text-muted-foreground">
          Add metadata to improve search and organization
        </p>
      </div>

      {/* Tags */}
      <div>
        <Label>Tags</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Add tags to categorize and improve search
        </p>

        <div className="flex gap-2 mb-3">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Add a tag..."
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
          />
          <Button onClick={addTag} disabled={!tagInput.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <div
                key={tag}
                className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="hover:text-primary/70"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category */}
      <div>
        <Label htmlFor="category">Category</Label>
        <Select
          value={category}
          onValueChange={(value) => {
            setCategory(value);
            updateMetadata({ category: value });
          }}
        >
          <SelectTrigger id="category" className="mt-2">
            <SelectValue placeholder="Select a category..." />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Author */}
      <div>
        <Label htmlFor="author">Author (Optional)</Label>
        <Input
          id="author"
          value={author}
          onChange={(e) => {
            setAuthor(e.target.value);
            updateMetadata({ author: e.target.value });
          }}
          placeholder="Document author"
          className="mt-2"
        />
      </div>

      {/* Source */}
      <div>
        <Label htmlFor="source">Source (Optional)</Label>
        <Input
          id="source"
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            updateMetadata({ source: e.target.value });
          }}
          placeholder="Source URL or reference"
          className="mt-2"
        />
      </div>

      {/* Custom Fields */}
      <div>
        <Label>Custom Fields</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Add custom metadata fields
        </p>

        <div className="space-y-2 mb-3">
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              placeholder="Field name"
            />
            <Input
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder="Value"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomField())}
            />
          </div>
          <Button
            onClick={addCustomField}
            disabled={!customKey.trim() || !customValue.trim()}
            className="w-full"
            variant="outline"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Field
          </Button>
        </div>

        {Object.keys(customFields).length > 0 && (
          <div className="border rounded-lg p-3 space-y-2">
            {Object.entries(customFields).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between p-2 bg-muted rounded"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{key}</div>
                  <div className="text-xs text-muted-foreground truncate">{value}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCustomField(key)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm">
          💡 <strong>Why annotate?</strong>
        </p>
        <ul className="text-sm space-y-1 mt-2 list-disc list-inside">
          <li>Improve search accuracy and relevance</li>
          <li>Better organization and filtering</li>
          <li>Add context that AI can use</li>
          <li>Track document sources and authors</li>
        </ul>
      </div>
    </div>
  );
}
