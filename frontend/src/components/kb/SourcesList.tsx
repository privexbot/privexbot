/**
 * SourcesList - List all added sources in draft
 *
 * WHY:
 * - View all sources
 * - Remove sources
 * - Source status tracking
 *
 * HOW:
 * - List with status badges
 * - Delete functionality
 * - Source type icons
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Globe,
  Database,
  Cloud,
  Trash2,
  CheckCircle,
  Loader2,
  AlertCircle,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import apiClient, { handleApiError } from '@/lib/api-client';

interface Source {
  id: string;
  type: 'file' | 'url' | 'website_crawl' | 'notion' | 'google_docs' | 'text';
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  size?: number;
  url?: string;
  error_message?: string;
  created_at: string;
  metadata?: Record<string, any>;
}

interface SourcesListProps {
  draftId: string;
}

export default function SourcesList({ draftId }: SourcesListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<string | null>(null);

  // Fetch sources
  const { data: sources, isLoading } = useQuery({
    queryKey: ['kb-draft-sources', draftId],
    queryFn: async () => {
      const response = await apiClient.get(`/kb-drafts/${draftId}/sources`);
      return response.data.sources as Source[];
    },
    enabled: !!draftId,
    refetchInterval: 5000, // Poll for status updates
  });

  // Delete source mutation
  const deleteMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      await apiClient.delete(`/kb-drafts/${draftId}/sources/${sourceId}`);
    },
    onSuccess: () => {
      toast({ title: 'Source removed' });
      queryClient.invalidateQueries({ queryKey: ['kb-draft-sources'] });
      setDeleteDialogOpen(false);
      setSourceToDelete(null);
    },
    onError: (error) => {
      toast({
        title: 'Failed to remove source',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
  });

  const getSourceIcon = (type: string) => {
    const icons: Record<string, React.ReactElement> = {
      file: <FileText className="w-5 h-5 text-blue-500" />,
      url: <Link2 className="w-5 h-5 text-purple-500" />,
      website_crawl: <Globe className="w-5 h-5 text-green-500" />,
      notion: <Database className="w-5 h-5 text-gray-700 dark:text-gray-300" />,
      google_docs: <Cloud className="w-5 h-5 text-yellow-500" />,
      text: <FileText className="w-5 h-5 text-cyan-500" />,
    };
    return icons[type] || <FileText className="w-5 h-5" />;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, React.ReactElement> = {
      pending: (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <Loader2 className="w-3 h-3" />
          Pending
        </span>
      ),
      processing: (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
          <Loader2 className="w-3 h-3 animate-spin" />
          Processing
        </span>
      ),
      completed: (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
          <CheckCircle className="w-3 h-3" />
          Completed
        </span>
      ),
      error: (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">
          <AlertCircle className="w-3 h-3" />
          Error
        </span>
      ),
    };
    return badges[status] || badges.pending;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      file: 'File Upload',
      url: 'URL',
      website_crawl: 'Website Crawl',
      notion: 'Notion',
      google_docs: 'Google Docs',
      text: 'Pasted Text',
    };
    return labels[type] || type;
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleDelete = (sourceId: string) => {
    setSourceToDelete(sourceId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (sourceToDelete) {
      deleteMutation.mutate(sourceToDelete);
    }
  };

  const filteredSources = sources?.filter((source) =>
    source.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: sources?.length || 0,
    completed: sources?.filter((s) => s.status === 'completed').length || 0,
    processing: sources?.filter((s) => s.status === 'processing').length || 0,
    error: sources?.filter((s) => s.status === 'error').length || 0,
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-2" />
        <p className="text-sm text-muted-foreground">Loading sources...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Added Sources</h3>
          <p className="text-sm text-muted-foreground">
            {stats.total} {stats.total === 1 ? 'source' : 'sources'} •{' '}
            {stats.completed} completed
          </p>
        </div>

        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search sources..."
          className="w-64"
        />
      </div>

      {/* Status Summary */}
      {stats.total > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <div className="p-3 border rounded-lg bg-card">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-bold">{stats.total}</p>
          </div>
          <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-950">
            <p className="text-xs text-green-700 dark:text-green-300">Completed</p>
            <p className="text-xl font-bold text-green-700 dark:text-green-300">
              {stats.completed}
            </p>
          </div>
          <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950">
            <p className="text-xs text-blue-700 dark:text-blue-300">Processing</p>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
              {stats.processing}
            </p>
          </div>
          <div className="p-3 border rounded-lg bg-red-50 dark:bg-red-950">
            <p className="text-xs text-red-700 dark:text-red-300">Error</p>
            <p className="text-xl font-bold text-red-700 dark:text-red-300">{stats.error}</p>
          </div>
        </div>
      )}

      {/* Sources List */}
      {!sources || sources.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <h4 className="font-medium mb-2">No sources added yet</h4>
          <p className="text-sm text-muted-foreground">
            Add documents from various sources to build your knowledge base
          </p>
        </div>
      ) : !filteredSources || filteredSources.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-sm text-muted-foreground">No sources match your search</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSources.map((source) => (
            <div
              key={source.id}
              className={`p-4 border rounded-lg hover:shadow-md transition ${
                source.status === 'error' ? 'border-destructive' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  {getSourceIcon(source.type)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{source.name}</h4>
                      {getStatusBadge(source.status)}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{getTypeLabel(source.type)}</span>
                      {source.size && <span>• {formatFileSize(source.size)}</span>}
                      <span>• {new Date(source.created_at).toLocaleDateString()}</span>
                    </div>

                    {source.url && (
                      <div className="mt-1">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline truncate block"
                        >
                          {source.url}
                        </a>
                      </div>
                    )}

                    {source.status === 'error' && source.error_message && (
                      <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
                        {source.error_message}
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(source.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Source?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the source from the draft. If the knowledge base has been
              finalized, the document will still exist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
