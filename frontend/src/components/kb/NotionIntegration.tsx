/**
 * NotionIntegration - Import from Notion workspace
 *
 * WHY:
 * - Connect Notion workspaces
 * - Select pages/databases
 * - OAuth authentication
 *
 * HOW:
 * - OAuth flow
 * - Page browser
 * - Sync configuration
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Database, ExternalLink, Loader2, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import apiClient, { handleApiError } from '@/lib/api-client';

interface NotionPage {
  id: string;
  title: string;
  type: 'page' | 'database';
  url: string;
  icon?: string;
}

interface NotionIntegrationProps {
  draftId: string;
  workspaceId: string;
  onPagesSelected?: (pages: NotionPage[]) => void;
  onSourcesAdded?: () => void;
  /**
   * Fires immediately before the full-window OAuth redirect. The KB
   * wizard uses this to persist its local React state (current step,
   * activeSourceType) plus the Zustand draft to localStorage so the
   * post-callback remount can restore both. See lib/kb-wizard-oauth.ts.
   */
  onBeforeOAuthRedirect?: () => void;
}

export default function NotionIntegration({ draftId, workspaceId, onPagesSelected, onSourcesAdded, onBeforeOAuthRedirect }: NotionIntegrationProps) {
  const { toast } = useToast();

  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Check if Notion is connected
  const { data: credentials } = useQuery({
    queryKey: ['credentials', workspaceId, 'notion'],
    queryFn: async () => {
      const response = await apiClient.get('/credentials/', {
        params: {
          workspace_id: workspaceId,
          provider: 'notion',
        },
      });
      return response.data.items;
    },
    enabled: !!workspaceId,
  });

  const isConnected = credentials && credentials.length > 0;

  // Fetch Notion pages
  const { data: pages, isLoading, refetch } = useQuery({
    queryKey: ['notion-pages', workspaceId],
    queryFn: async () => {
      const response = await apiClient.get('/integrations/notion/pages', {
        params: { workspace_id: workspaceId },
      });
      return response.data.pages as NotionPage[];
    },
    enabled: isConnected,
  });

  // Add pages mutation
  const addPagesMutation = useMutation({
    mutationFn: async (pageIds: string[]) => {
      const response = await apiClient.post(`/kb-drafts/${draftId}/sources/notion`, {
        page_ids: pageIds,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Notion pages added',
        description: `${data.sources_added} pages added to knowledge base`,
      });
      if (onPagesSelected && pages) {
        const selected = pages.filter((p) => selectedPages.has(p.id));
        onPagesSelected(selected);
      }
      setSelectedPages(new Set());
      onSourcesAdded?.();
    },
    onError: (error) => {
      toast({
        title: 'Failed to add pages',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
  });

  const initiateOAuth = async () => {
    try {
      const response = await apiClient.post(
        `/credentials/oauth/authorize?provider=notion&workspace_id=${workspaceId}`
      );
      // Persist wizard + draft state BEFORE the redirect — `window.location.href`
      // unmounts React and wipes every in-memory store, so the post-callback
      // remount needs localStorage to rehydrate. See lib/kb-wizard-oauth.ts.
      onBeforeOAuthRedirect?.();
      window.location.href = response.data.redirect_url;
    } catch (error) {
      toast({
        title: 'Connection failed',
        description: handleApiError(error),
        variant: 'destructive',
      });
    }
  };

  const togglePage = (pageId: string) => {
    const newSelected = new Set(selectedPages);
    if (newSelected.has(pageId)) {
      newSelected.delete(pageId);
    } else {
      newSelected.add(pageId);
    }
    setSelectedPages(newSelected);
  };

  const selectAll = () => {
    if (pages) {
      setSelectedPages(new Set(pages.map((p) => p.id)));
    }
  };

  const deselectAll = () => {
    setSelectedPages(new Set());
  };

  const addSelectedPages = () => {
    addPagesMutation.mutate(Array.from(selectedPages));
  };

  const filteredPages = pages?.filter(
    (page) =>
      page.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      page.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Database className="w-5 h-5" />
            Notion Integration
          </h3>
          <p className="text-sm text-muted-foreground">
            Import pages and databases from your Notion workspace
          </p>
        </div>

        <div className="text-center py-12 border rounded-lg">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Database className="w-8 h-8 text-primary" />
          </div>

          <h4 className="font-semibold mb-2">Connect Notion</h4>
          <p className="text-sm text-muted-foreground mb-6">
            Connect your Notion workspace to import pages and databases
          </p>

          <Button onClick={initiateOAuth} size="lg">
            <ExternalLink className="w-4 h-4 mr-2" />
            Connect to Notion
          </Button>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm">
            <strong>What you'll need:</strong>
          </p>
          <ul className="text-sm space-y-1 mt-2 list-disc list-inside">
            <li>Notion account with workspace access</li>
            <li>Permission to share pages with integrations</li>
            <li>You'll be redirected to Notion to authorize</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Database className="w-5 h-5" />
            Notion Pages
          </h3>
          <p className="text-sm text-muted-foreground">
            Select pages and databases to import
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Connected account bar */}
      <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span>Connected{credentials?.[0]?.name ? ` - ${credentials[0].name.replace('Notion - ', '')}` : ''}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={initiateOAuth}>
          <RefreshCw className="w-4 h-4 mr-1" /> Reconnect
        </Button>
      </div>

      {/* Search */}
      <div>
        <Label htmlFor="search">Search Pages</Label>
        <Input
          id="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by title..."
          className="mt-2"
        />
      </div>

      {/* Select Controls */}
      {pages && pages.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <Button variant="ghost" size="sm" onClick={selectAll}>
            Select All
          </Button>
          <span className="text-muted-foreground">•</span>
          <Button variant="ghost" size="sm" onClick={deselectAll}>
            Deselect All
          </Button>
          {selectedPages.size > 0 && (
            <span className="text-muted-foreground ml-2">
              ({selectedPages.size} selected)
            </span>
          )}
        </div>
      )}

      {/* Pages List */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading pages...</p>
        </div>
      ) : !pages || pages.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-sm text-muted-foreground">No pages found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Make sure pages are shared with the integration
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredPages?.map((page) => (
            <div
              key={page.id}
              className={`p-4 border rounded-lg cursor-pointer transition ${
                selectedPages.has(page.id)
                  ? 'border-primary bg-primary/5'
                  : 'hover:border-primary/50'
              }`}
              onClick={() => togglePage(page.id)}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedPages.has(page.id)}
                  onCheckedChange={() => togglePage(page.id)}
                  onClick={(e) => e.stopPropagation()}
                />

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {page.icon && <span className="text-lg">{page.icon}</span>}
                    <h4 className="font-medium">{page.title}</h4>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="px-2 py-0.5 bg-muted rounded">
                      {page.type === 'database' ? 'Database' : 'Page'}
                    </span>
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View in Notion
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Button */}
      {selectedPages.size > 0 && (
        <Button
          onClick={addSelectedPages}
          disabled={addPagesMutation.isPending}
          className="w-full"
          size="lg"
        >
          {addPagesMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Adding pages...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Add {selectedPages.size} {selectedPages.size === 1 ? 'Page' : 'Pages'}
            </>
          )}
        </Button>
      )}
    </div>
  );
}
