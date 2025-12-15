/**
 * Credentials - Manage API credentials and integrations
 *
 * WHY:
 * - Store OAuth tokens securely
 * - Manage third-party integrations
 * - Test credential validity
 * - Sync cloud sources
 *
 * HOW:
 * - React Query for CRUD
 * - OAuth callback handling
 * - Test connection functionality
 * - Masked credential display
 *
 * DEPENDENCIES:
 * - @tanstack/react-query
 * - react-router-dom
 * - lucide-react
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Key,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useWorkspaceStore } from '@/store/workspace-store';
import apiClient, { handleApiError } from '@/lib/api-client';

interface Credential {
  id: string;
  name: string;
  credential_type: 'openai' | 'notion' | 'google_drive' | 'slack' | 'telegram';
  is_valid: boolean;
  last_verified_at?: string;
  created_at: string;
}

const CREDENTIAL_TYPES = [
  { value: 'openai', label: 'OpenAI API Key', icon: '🤖', requiresOAuth: false },
  { value: 'notion', label: 'Notion', icon: '📝', requiresOAuth: true },
  { value: 'google_drive', label: 'Google Drive', icon: '📁', requiresOAuth: true },
  { value: 'slack', label: 'Slack', icon: '💬', requiresOAuth: true },
  { value: 'telegram', label: 'Telegram Bot', icon: '✈️', requiresOAuth: false },
];

export default function Credentials() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspaceStore();
  const [searchParams] = useSearchParams();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [credentialToDelete, setCredentialToDelete] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    credential_type: 'openai' as const,
    api_key: '',
  });

  // Fetch credentials
  const { data: credentials, isLoading } = useQuery({
    queryKey: ['credentials', currentWorkspace?.id],
    queryFn: async () => {
      const response = await apiClient.get('/credentials/', {
        params: { workspace_id: currentWorkspace?.id },
      });
      return response.data.items as Credential[];
    },
    enabled: !!currentWorkspace,
  });

  // Create credential mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiClient.post('/credentials/', {
        workspace_id: currentWorkspace?.id,
        ...data,
      });
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Credential added successfully' });
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      setDialogOpen(false);
      setFormData({ name: '', credential_type: 'openai', api_key: '' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to add credential',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (credentialId: string) => {
      await apiClient.delete(`/credentials/${credentialId}`);
    },
    onSuccess: () => {
      toast({ title: 'Credential deleted' });
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      setDeleteDialogOpen(false);
      setCredentialToDelete(null);
    },
    onError: (error) => {
      toast({
        title: 'Failed to delete',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
  });

  // Test credential mutation
  const testMutation = useMutation({
    mutationFn: async (credentialId: string) => {
      const response = await apiClient.post(`/credentials/${credentialId}/test`);
      return response.data;
    },
    onSuccess: (data, credentialId) => {
      if (data.is_valid) {
        toast({ title: 'Credential is valid', description: 'Connection successful' });
      } else {
        toast({
          title: 'Credential is invalid',
          description: data.error || 'Connection failed',
          variant: 'destructive',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
    },
    onError: (error) => {
      toast({
        title: 'Test failed',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
  });

  // OAuth initiation
  const initiateOAuth = (credentialType: string) => {
    const oauthUrl = `${import.meta.env.VITE_API_BASE_URL}/credentials/oauth/authorize?provider=${credentialType}&workspace_id=${currentWorkspace?.id}`;
    window.location.href = oauthUrl;
  };

  const handleDelete = (credentialId: string) => {
    setCredentialToDelete(credentialId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (credentialToDelete) {
      deleteMutation.mutate(credentialToDelete);
    }
  };

  const toggleShowSecret = (credentialId: string) => {
    setShowSecrets((prev) => ({ ...prev, [credentialId]: !prev[credentialId] }));
  };

  const selectedType = CREDENTIAL_TYPES.find((t) => t.value === formData.credential_type);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading credentials...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Key className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">API Credentials</h1>
            <p className="text-muted-foreground">
              Manage integrations and API keys
            </p>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="w-4 h-4 mr-2" />
              Add Credential
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Credential</DialogTitle>
              <DialogDescription>
                Connect a third-party service or add an API key
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div>
                <Label>Service Type</Label>
                <Select
                  value={formData.credential_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, credential_type: value as any })
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CREDENTIAL_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Production OpenAI Key"
                  className="mt-2"
                />
              </div>

              {selectedType?.requiresOAuth ? (
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <p className="text-sm mb-3">
                    This service requires OAuth authentication. You'll be redirected to authorize access.
                  </p>
                  <Button
                    onClick={() => initiateOAuth(formData.credential_type)}
                    className="w-full"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Connect with {selectedType.label}
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      value={formData.api_key}
                      onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                      placeholder="sk-..."
                      className="mt-2 font-mono"
                    />
                  </div>

                  <Button
                    onClick={() => createMutation.mutate(formData)}
                    disabled={!formData.name || !formData.api_key || createMutation.isPending}
                    className="w-full"
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      'Add Credential'
                    )}
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* OAuth Callback Success */}
      {searchParams.get('oauth') === 'success' && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="font-medium text-green-800 dark:text-green-200">
              Successfully connected! Your credential has been saved.
            </p>
          </div>
        </div>
      )}

      {/* Credentials List */}
      {!credentials || credentials.length === 0 ? (
        <div className="text-center py-16 bg-card border rounded-lg">
          <Key className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No credentials yet</h3>
          <p className="text-muted-foreground mb-6">
            Add your first API credential to start integrating services
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Credential
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {credentials.map((credential) => {
            const type = CREDENTIAL_TYPES.find((t) => t.value === credential.credential_type);

            return (
              <div
                key={credential.id}
                className="bg-card border rounded-lg p-6 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-2xl">
                      {type?.icon || '🔑'}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{credential.name}</h3>
                        {credential.is_valid ? (
                          <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                            <CheckCircle className="w-4 h-4" />
                            Valid
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-sm text-destructive">
                            <XCircle className="w-4 h-4" />
                            Invalid
                          </div>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground mb-3">
                        {type?.label} • Created {new Date(credential.created_at).toLocaleDateString()}
                      </p>

                      {credential.last_verified_at && (
                        <p className="text-xs text-muted-foreground">
                          Last verified: {new Date(credential.last_verified_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testMutation.mutate(credential.id)}
                      disabled={testMutation.isPending}
                    >
                      {testMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleShowSecret(credential.id)}
                    >
                      {showSecrets[credential.id] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(credential.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {showSecrets[credential.id] && (
                  <div className="mt-4 pt-4 border-t">
                    <Label className="text-xs">API Key / Token</Label>
                    <div className="mt-1 p-2 bg-muted rounded font-mono text-sm break-all">
                      {type?.requiresOAuth ? (
                        <span className="text-muted-foreground">OAuth token (managed securely)</span>
                      ) : (
                        'sk-••••••••••••••••'
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Credential?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this credential. Any integrations using this credential
              will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
