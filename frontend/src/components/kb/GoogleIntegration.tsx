/**
 * GoogleIntegration - Import from Google Docs/Sheets
 *
 * WHY:
 * - Connect Google account
 * - Select Docs and Sheets
 * - OAuth authentication
 *
 * HOW:
 * - OAuth flow (single credential for Docs + Sheets)
 * - File browser with type badges
 * - Sync configuration
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FileText, ExternalLink, Loader2, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import apiClient, { handleApiError } from '@/lib/api-client';

interface GoogleFile {
  id: string;
  name: string;
  type: 'document' | 'spreadsheet' | 'presentation' | 'unknown';
  modified_time?: string;
}

interface GoogleIntegrationProps {
  draftId: string;
  workspaceId: string;
  onSourcesAdded?: () => void;
}

export default function GoogleIntegration({ draftId, workspaceId, onSourcesAdded }: GoogleIntegrationProps) {
  const { toast } = useToast();

  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Check if Google is connected
  const { data: credentials } = useQuery({
    queryKey: ['credentials', workspaceId, 'google'],
    queryFn: async () => {
      const response = await apiClient.get('/credentials/', {
        params: {
          workspace_id: workspaceId,
          provider: 'google',
        },
      });
      return response.data.items;
    },
    enabled: !!workspaceId,
  });

  const isConnected = credentials && credentials.length > 0;

  // Fetch Google Drive files
  const { data: files, isLoading, refetch } = useQuery({
    queryKey: ['google-files', workspaceId],
    queryFn: async () => {
      const response = await apiClient.get('/integrations/google/files', {
        params: { workspace_id: workspaceId },
      });
      return response.data.files as GoogleFile[];
    },
    enabled: isConnected,
  });

  // Add files mutation
  const addFilesMutation = useMutation({
    mutationFn: async (fileItems: Array<{ id: string; type: string; name?: string }>) => {
      const response = await apiClient.post(`/kb-drafts/${draftId}/sources/google`, {
        files: fileItems,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Google files added',
        description: `${data.sources_added} files added to knowledge base`,
      });
      setSelectedFiles(new Set());
      onSourcesAdded?.();
    },
    onError: (error) => {
      toast({
        title: 'Failed to add files',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
  });

  const initiateOAuth = async () => {
    try {
      const response = await apiClient.post(
        `/credentials/oauth/authorize?provider=google&workspace_id=${workspaceId}`
      );
      window.location.href = response.data.redirect_url;
    } catch (error) {
      toast({
        title: 'Connection failed',
        description: handleApiError(error),
        variant: 'destructive',
      });
    }
  };

  const toggleFile = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const selectAll = () => {
    if (filteredFiles) {
      setSelectedFiles(new Set(filteredFiles.map((f) => f.id)));
    }
  };

  const deselectAll = () => {
    setSelectedFiles(new Set());
  };

  const addSelectedFiles = () => {
    if (!files) return;
    const fileItems = files
      .filter((f) => selectedFiles.has(f.id))
      .map((f) => ({ id: f.id, type: f.type, name: f.name }));
    addFilesMutation.mutate(fileItems);
  };

  const filteredFiles = files?.filter(
    (file) =>
      file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Google Integration
          </h3>
          <p className="text-sm text-muted-foreground">
            Import documents and spreadsheets from Google Drive
          </p>
        </div>

        <div className="text-center py-12 border rounded-lg">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-primary" />
          </div>

          <h4 className="font-semibold mb-2">Connect Google</h4>
          <p className="text-sm text-muted-foreground mb-6">
            Connect your Google account to import Docs and Sheets
          </p>

          <Button onClick={initiateOAuth} size="lg">
            <ExternalLink className="w-4 h-4 mr-2" />
            Connect to Google
          </Button>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm">
            <strong>What you'll need:</strong>
          </p>
          <ul className="text-sm space-y-1 mt-2 list-disc list-inside">
            <li>Google account with Drive access</li>
            <li>Documents or Spreadsheets to import</li>
            <li>You'll be redirected to Google to authorize</li>
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
            <FileText className="w-5 h-5" />
            Google Drive Files
          </h3>
          <p className="text-sm text-muted-foreground">
            Select documents and spreadsheets to import
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
          <span>Connected{credentials?.[0]?.name ? ` - ${credentials[0].name.replace('Google - ', '')}` : ''}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={initiateOAuth}>
          <RefreshCw className="w-4 h-4 mr-1" /> Reconnect
        </Button>
      </div>

      {/* Search */}
      <div>
        <Label htmlFor="google-search">Search Files</Label>
        <Input
          id="google-search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name..."
          className="mt-2"
        />
      </div>

      {/* Select Controls */}
      {filteredFiles && filteredFiles.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <Button variant="ghost" size="sm" onClick={selectAll}>
            Select All
          </Button>
          <span className="text-muted-foreground">•</span>
          <Button variant="ghost" size="sm" onClick={deselectAll}>
            Deselect All
          </Button>
          {selectedFiles.size > 0 && (
            <span className="text-muted-foreground ml-2">
              ({selectedFiles.size} selected)
            </span>
          )}
        </div>
      )}

      {/* Files List */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading files...</p>
        </div>
      ) : !filteredFiles || filteredFiles.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-sm text-muted-foreground">No files found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Make sure you have Google Docs or Sheets in your Drive
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              className={`p-4 border rounded-lg cursor-pointer transition ${
                selectedFiles.has(file.id)
                  ? 'border-primary bg-primary/5'
                  : 'hover:border-primary/50'
              }`}
              onClick={() => toggleFile(file.id)}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedFiles.has(file.id)}
                  onCheckedChange={() => toggleFile(file.id)}
                  onClick={(e) => e.stopPropagation()}
                />

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{file.name}</h4>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span
                      className={`px-2 py-0.5 rounded ${
                        file.type === 'document'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : file.type === 'spreadsheet'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-muted'
                      }`}
                    >
                      {file.type === 'document' ? 'Doc' : file.type === 'spreadsheet' ? 'Sheet' : file.type}
                    </span>
                    {file.modified_time && (
                      <span>
                        Modified {new Date(file.modified_time).toLocaleDateString()}
                      </span>
                    )}
                    <a
                      href={`https://docs.google.com/${file.type === 'document' ? 'document' : 'spreadsheets'}/d/${file.id}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open in Google
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
      {selectedFiles.size > 0 && (
        <Button
          onClick={addSelectedFiles}
          disabled={addFilesMutation.isPending}
          className="w-full"
          size="lg"
        >
          {addFilesMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Adding files...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Add {selectedFiles.size} {selectedFiles.size === 1 ? 'File' : 'Files'}
            </>
          )}
        </Button>
      )}
    </div>
  );
}
