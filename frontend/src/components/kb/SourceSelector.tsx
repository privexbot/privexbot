/**
 * SourceSelector - Choose document source type
 *
 * WHY:
 * - Multiple input methods
 * - Visual source selection
 * - Clear categorization
 *
 * HOW:
 * - Grid of source type cards
 * - Icon-based selection
 * - Category grouping
 */

import { Upload, Globe, Cloud, FileText, Link2, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type SourceType =
  | 'file_upload'
  | 'website_crawl'
  | 'notion'
  | 'google_docs'
  | 'text_paste'
  | 'url';

interface Source {
  type: SourceType;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'Direct' | 'Cloud' | 'Web';
  isPremium?: boolean;
}

const SOURCES: Source[] = [
  {
    type: 'file_upload',
    label: 'Upload Files',
    description: 'PDF, DOCX, TXT, MD files',
    icon: <Upload className="w-6 h-6" />,
    category: 'Direct',
  },
  {
    type: 'text_paste',
    label: 'Paste Text',
    description: 'Copy and paste content directly',
    icon: <FileText className="w-6 h-6" />,
    category: 'Direct',
  },
  {
    type: 'url',
    label: 'Add URL',
    description: 'Single webpage or document',
    icon: <Link2 className="w-6 h-6" />,
    category: 'Web',
  },
  {
    type: 'website_crawl',
    label: 'Crawl Website',
    description: 'Scrape entire website or sitemap',
    icon: <Globe className="w-6 h-6" />,
    category: 'Web',
  },
  {
    type: 'notion',
    label: 'Notion',
    description: 'Import from Notion workspace',
    icon: <Database className="w-6 h-6" />,
    category: 'Cloud',
  },
  {
    type: 'google_docs',
    label: 'Google Drive',
    description: 'Docs, Sheets, or Drive folders',
    icon: <Cloud className="w-6 h-6" />,
    category: 'Cloud',
  },
];

interface SourceSelectorProps {
  onSelectSource: (sourceType: SourceType) => void;
}

export default function SourceSelector({ onSelectSource }: SourceSelectorProps) {
  const categories = Array.from(new Set(SOURCES.map((s) => s.category)));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Choose a Source</h3>
        <p className="text-sm text-muted-foreground">
          Select how you want to add documents to your knowledge base
        </p>
      </div>

      {categories.map((category) => {
        const categorySources = SOURCES.filter((s) => s.category === category);

        return (
          <div key={category}>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">{category}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categorySources.map((source) => (
                <button
                  key={source.type}
                  onClick={() => onSelectSource(source.type)}
                  className="relative p-6 border rounded-lg hover:border-primary hover:shadow-lg transition-all text-left group bg-card"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center text-primary transition-colors">
                      {source.icon}
                    </div>

                    <div className="flex-1">
                      <h5 className="font-semibold mb-1">{source.label}</h5>
                      <p className="text-sm text-muted-foreground">
                        {source.description}
                      </p>
                    </div>
                  </div>

                  {source.isPremium && (
                    <div className="absolute top-2 right-2">
                      <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full">
                        Premium
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm">
          💡 <strong>Tip:</strong> You can add multiple sources from different types to the same
          knowledge base. All documents will be processed and indexed together.
        </p>
      </div>
    </div>
  );
}
