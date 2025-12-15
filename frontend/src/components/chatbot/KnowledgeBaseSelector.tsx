/**
 * KnowledgeBaseSelector - Select and manage KB attachments
 *
 * WHY:
 * - Attach multiple KBs to chatbot
 * - Visual KB selection
 * - KB statistics display
 * - Create new KB inline
 *
 * HOW:
 * - React Query for KB list
 * - Checkbox/switch selection
 * - Quick create link
 */

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Database, Plus, FileText, Search } from 'lucide-react';
import { useState, useMemo } from 'react';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useWorkspaceStore } from '@/store/workspace-store';
import apiClient from '@/lib/api-client';

interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  total_documents: number;
  total_chunks: number;
  embedding_model: string;
}

interface KnowledgeBaseSelectorProps {
  selectedKBs: string[];
  onChange: (selectedIds: string[]) => void;
}

export default function KnowledgeBaseSelector({
  selectedKBs,
  onChange,
}: KnowledgeBaseSelectorProps) {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspaceStore();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch knowledge bases
  const { data: knowledgeBases, isLoading } = useQuery({
    queryKey: ['knowledge-bases', currentWorkspace?.id],
    queryFn: async () => {
      const response = await apiClient.get('/knowledge-bases/', {
        params: { workspace_id: currentWorkspace?.id },
      });
      return response.data.items as KnowledgeBase[];
    },
    enabled: !!currentWorkspace,
  });

  // Filter KBs by search
  const filteredKBs = useMemo(() => {
    if (!knowledgeBases) return [];
    if (!searchQuery) return knowledgeBases;

    const query = searchQuery.toLowerCase();
    return knowledgeBases.filter(
      (kb) =>
        kb.name.toLowerCase().includes(query) ||
        kb.description?.toLowerCase().includes(query)
    );
  }, [knowledgeBases, searchQuery]);

  const toggleKB = (kbId: string) => {
    if (selectedKBs.includes(kbId)) {
      onChange(selectedKBs.filter((id) => id !== kbId));
    } else {
      onChange([...selectedKBs, kbId]);
    }
  };

  const selectAll = () => {
    if (filteredKBs) {
      onChange(filteredKBs.map((kb) => kb.id));
    }
  };

  const deselectAll = () => {
    onChange([]);
  };

  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Loading knowledge bases...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-lg">Knowledge Base Integration</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Connect knowledge bases to enable RAG (Retrieval-Augmented Generation)
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/knowledge-bases/create')}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create KB
        </Button>
      </div>

      {knowledgeBases && knowledgeBases.length > 0 && (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search knowledge bases..."
              className="pl-10"
            />
          </div>

          {/* Select All / Deselect All */}
          <div className="flex items-center gap-2 text-sm">
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select All ({filteredKBs.length})
            </Button>
            <span className="text-muted-foreground">•</span>
            <Button variant="ghost" size="sm" onClick={deselectAll}>
              Deselect All
            </Button>
            {selectedKBs.length > 0 && (
              <span className="text-muted-foreground ml-2">
                ({selectedKBs.length} selected)
              </span>
            )}
          </div>
        </>
      )}

      {/* Knowledge Base List */}
      {!knowledgeBases || knowledgeBases.length === 0 ? (
        <div className="text-center py-12 bg-card border rounded-lg">
          <Database className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <h4 className="font-medium mb-2">No knowledge bases found</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Create a knowledge base to enhance your chatbot with custom data
          </p>
          <Button onClick={() => navigate('/knowledge-bases/create')}>
            <Plus className="w-4 h-4 mr-2" />
            Create Knowledge Base
          </Button>
        </div>
      ) : filteredKBs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No knowledge bases match your search
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredKBs.map((kb) => {
            const isSelected = selectedKBs.includes(kb.id);

            return (
              <div
                key={kb.id}
                className={`p-4 border rounded-lg transition cursor-pointer hover:shadow-md ${
                  isSelected ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                onClick={() => toggleKB(kb.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}
                    >
                      <Database className="w-5 h-5" />
                    </div>

                    <div className="flex-1">
                      <h4 className="font-semibold">{kb.name}</h4>
                      {kb.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {kb.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {kb.total_documents} documents
                        </div>
                        <div>{kb.total_chunks.toLocaleString()} chunks</div>
                        <div className="text-xs">
                          Model: {kb.embedding_model.replace('text-embedding-', '')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Switch
                    checked={isSelected}
                    onCheckedChange={() => toggleKB(kb.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedKBs.length > 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm">
            <strong>ℹ️ RAG Enabled:</strong> Your chatbot will retrieve relevant information from{' '}
            {selectedKBs.length} knowledge {selectedKBs.length === 1 ? 'base' : 'bases'} to
            answer questions.
          </p>
        </div>
      )}
    </div>
  );
}
