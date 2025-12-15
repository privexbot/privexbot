/**
 * GoogleDocsIntegration - Import from Google Drive
 *
 * WHY:
 * - Connect Google Drive
 * - Import Docs, Sheets, Slides
 * - Folder support
 *
 * HOW:
 * - OAuth authentication
 * - File/folder browser
 * - Type filtering
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Cloud, ExternalLink, Loader2, CheckCircle, RefreshCw, Folder, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useWorkspaceStore } from '@/store/workspace-store';
import apiClient, { handleApiError } from '@/lib/api-client';

interface GoogleFile {
  id: string;
  name: string;
  type: 'document' | 'spreadsheet' | 'presentation' | 'folder' | 'pdf';
  mimeType: string;
  webViewLink: string;
  modifiedTime: string;
}

interface GoogleDocsIntegrationProps {
  draftId: string;
  onFilesSelected?: (files: GoogleFile[]) => void;
}

export default function GoogleDocsIntegration({
  draftId,
  onFilesSelected,
}: GoogleDocsIntegrationProps) {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspaceStore();

  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('all');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Check if Google Drive is connected
  const { data: credentials } = useQuery({
    queryKey: ['credentials', currentWorkspace?.id, 'google_drive'],
    queryFn: async () => {
      const response = await apiClient.get('/credentials/', {
        params: {
          workspace_id: currentWorkspace?.id,
          credential_type: 'google_drive',
        },
      });
      return response.data.items;
    },
    enabled: !!currentWorkspace,
  });

  const isConnected = credentials && credentials.length > 0;

  // Fetch Google Drive files
  const { data: files, isLoading, refetch } = useQuery({
    queryKey: ['google-drive-files', currentWorkspace?.id, currentFolderId, fileTypeFilter],
    queryFn: async () => {
      const response = await apiClient.get('/integrations/google-drive/files', {
        params: {
          workspace_id: currentWorkspace?.id,
          folder_id: currentFolderId,
          file_type: fileTypeFilter !== 'all' ? fileTypeFilter : undefined,
        },
      });
      return response.data.files as GoogleFile[];
    },
    enabled: isConnected,
  });

  // Add files mutation
  const addFilesMutation = useMutation({
    mutationFn: async (fileIds: string[]) => {
      const response = await apiClient.post(`/kb-drafts/${draftId}/documents/google-drive`, {
        file_ids: fileIds,
      });
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: 'Google Drive files added',
        description: `${selectedFiles.size} files added to knowledge base`,
      });
      if (onFilesSelected && files) {
        const selected = files.filter((f) => selectedFiles.has(f.id));
        onFilesSelected(selected);
      }
    },
    onError: (error) => {
      toast({
        title: 'Failed to add files',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
  });

  const initiateOAuth = () => {
    const oauthUrl = `${import.meta.env.VITE_API_BASE_URL}/credentials/oauth/authorize?provider=google_drive&workspace_id=${currentWorkspace?.id}`;
    window.location.href = oauthUrl;
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
    if (files) {
      const selectableFiles = files.filter((f) => f.type !== 'folder');
      setSelectedFiles(new Set(selectableFiles.map((f) => f.id)));
    }
  };

  const deselectAll = () => {
    setSelectedFiles(new Set());
  };

  const addSelectedFiles = () => {
    addFilesMutation.mutate(Array.from(selectedFiles));
  };

  const openFolder = (folderId: string) => {
    setCurrentFolderId(folderId);
    setSelectedFiles(new Set());
  };

  const goBack = () => {
    setCurrentFolderId(null);
    setSelectedFiles(new Set());
  };

  const filteredFiles = files?.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFileIcon = (file: GoogleFile) => {
    if (file.type === 'folder') return <Folder className="w-5 h-5 text-yellow-500" />;
    return <FileText className="w-5 h-5 text-blue-500" />;
  };

  const getFileTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      document: 'Google Doc',
      spreadsheet: 'Google Sheet',
      presentation: 'Google Slides',
      pdf: 'PDF',
      folder: 'Folder',
    };
    return labels[type] || type;
  };

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Cloud className="w-5 h-5" />
            Google Drive Integration
          </h3>
          <p className="text-sm text-muted-foreground">
            Import documents from your Google Drive
          </p>
        </div>

        <div className="text-center py-12 border rounded-lg">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Cloud className="w-8 h-8 text-primary" />
          </div>

          <h4 className="font-semibold mb-2">Connect Google Drive</h4>
          <p className="text-sm text-muted-foreground mb-6">
            Connect your Google account to import Docs, Sheets, and PDFs
          </p>

          <Button onClick={initiateOAuth} size="lg">
            <ExternalLink className="w-4 h-4 mr-2" />
            Connect to Google Drive
          </Button>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm">
            <strong>What you'll need:</strong>
          </p>
          <ul className="text-sm space-y-1 mt-2 list-disc list-inside">
            <li>Google account</li>
            <li>Permission to view files in Drive</li>
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
            <Cloud className="w-5 h-5" />
            Google Drive Files
          </h3>
          <p className="text-sm text-muted-foreground">
            Select documents to import
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Breadcrumb */}
      {currentFolderId && (
        <Button variant="ghost" size="sm" onClick={goBack}>
          ← Back to My Drive
        </Button>
      )}

      {/* Filters */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="search">Search Files</Label>
          <Input
            id="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name..."
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="file-type">File Type</Label>
          <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
            <SelectTrigger id="file-type" className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="document">Google Docs</SelectItem>
              <SelectItem value="spreadsheet">Google Sheets</SelectItem>
              <SelectItem value="presentation">Google Slides</SelectItem>
              <SelectItem value="pdf">PDFs</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Select Controls */}
      {files && files.filter((f) => f.type !== 'folder').length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <Button variant="ghost" size="sm" onClick={selectAll}>
            Select All Files
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
      ) : !files || files.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-sm text-muted-foreground">No files found</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredFiles?.map((file) => (
            <div
              key={file.id}
              className={`p-4 border rounded-lg cursor-pointer transition ${
                file.type === 'folder'
                  ? 'hover:bg-accent'
                  : selectedFiles.has(file.id)
                  ? 'border-primary bg-primary/5'
                  : 'hover:border-primary/50'
              }`}
              onClick={() => {
                if (file.type === 'folder') {
                  openFolder(file.id);
                } else {
                  toggleFile(file.id);
                }
              }}
            >
              <div className="flex items-start gap-3">
                {file.type !== 'folder' && (
                  <Checkbox
                    checked={selectedFiles.has(file.id)}
                    onCheckedChange={() => toggleFile(file.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getFileIcon(file)}
                    <h4 className="font-medium">{file.name}</h4>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="px-2 py-0.5 bg-muted rounded">
                      {getFileTypeLabel(file.type)}
                    </span>
                    <span>Modified {new Date(file.modifiedTime).toLocaleDateString()}</span>
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open in Drive
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
