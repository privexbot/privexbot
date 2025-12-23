/**
 * CredentialSelector - Select credential for chatflow nodes and channel deployment
 *
 * WHY:
 * - Reusable credential selection
 * - OAuth integration management
 * - Secure credential storage
 *
 * HOW:
 * - Fetch available credentials from API
 * - Filter by provider (service name)
 * - Initiate OAuth flow if needed
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Key,
  Plus,
  ExternalLink,
  Loader2,
  CheckCircle,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import apiClient, { handleApiError } from '@/lib/api-client';
import { useWorkspaceStore } from '@/store/workspace-store';

// Provider types (service names)
type CredentialProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'notion'
  | 'slack'
  | 'telegram'
  | 'discord'
  | 'custom';

// API response structure matching backend CredentialResponse
interface Credential {
  id: string;
  workspace_id: string;
  name: string;
  credential_type: string;
  provider?: string;
  is_active: boolean;
  usage_count: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

interface CredentialSelectorProps {
  provider?: CredentialProvider;
  selectedId?: string;
  onSelect: (credentialId: string) => void;
  label?: string;
  required?: boolean;
  allowMultiple?: boolean;
  providers?: CredentialProvider[];
}

export default function CredentialSelector({
  provider,
  selectedId,
  onSelect,
  label = 'Credential',
  required = false,
  allowMultiple = false,
}: CredentialSelectorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspaceStore();

  // Fetch credentials from API
  const { data: credentials, isLoading, error } = useQuery({
    queryKey: ['credentials', currentWorkspace?.id, provider],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentWorkspace?.id) {
        params.append('workspace_id', currentWorkspace.id);
      }
      // Use provider filter (service name like 'telegram', 'discord')
      if (provider) {
        params.append('provider', provider);
      }

      const response = await apiClient.get(`/credentials?${params}`);
      // API returns { items: [...], total, skip, limit }
      return response.data.items as Credential[];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Delete credential mutation
  const deleteMutation = useMutation({
    mutationFn: async (credentialId: string) => {
      await apiClient.delete(`/credentials/${credentialId}`);
    },
    onSuccess: () => {
      toast({ title: 'Credential deleted' });
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to delete credential',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
  });

  const initiateOAuthFlow = (selectedProvider: CredentialProvider) => {
    const oauthUrl = `${import.meta.env.VITE_API_BASE_URL}/credentials/oauth/authorize?provider=${selectedProvider}&workspace_id=${currentWorkspace?.id}`;
    window.location.href = oauthUrl;
  };

  const getProviderName = (providerName?: string) => {
    if (!providerName) return 'Unknown';
    const names: Record<string, string> = {
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      google: 'Google',
      notion: 'Notion',
      slack: 'Slack',
      telegram: 'Telegram',
      discord: 'Discord',
      custom: 'Custom',
    };
    return names[providerName] || providerName;
  };

  const getStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return (
        <Badge className="bg-green-500 hover:bg-green-600 text-xs">
          <CheckCircle className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="text-xs">
        <AlertCircle className="w-3 h-3 mr-1" />
        Inactive
      </Badge>
    );
  };

  const isOAuthProvider = (providerName: CredentialProvider) => {
    // Telegram and Discord use bot tokens, not OAuth in traditional sense
    // but we can use the OAuth flow UI for them
    return ['telegram', 'discord'].includes(providerName);
  };

  // Filter active credentials
  const activeCredentials = credentials?.filter((c) => c.is_active) || [];
  const hasCredentials = activeCredentials.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Key className="w-4 h-4" />
          {label}
          {required && <span className="text-destructive">*</span>}
        </Label>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-4 text-red-500 text-sm">
          Failed to load credentials. Please try again.
        </div>
      ) : hasCredentials ? (
        <div className="space-y-2">
          <Select value={selectedId} onValueChange={onSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Select a credential" />
            </SelectTrigger>
            <SelectContent>
              {activeCredentials.map((credential) => (
                <SelectItem key={credential.id} value={credential.id}>
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="flex-1">{credential.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {getProviderName(credential.provider)}
                      </Badge>
                      {getStatusBadge(credential.is_active)}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Selected Credential Details */}
          {selectedId && (
            <div className="p-3 bg-muted/50 rounded-lg">
              {(() => {
                const selected = credentials?.find((c) => c.id === selectedId);
                if (!selected) return null;

                return (
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{selected.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground">
                          {getProviderName(selected.provider)}
                        </p>
                        {selected.last_used_at && (
                          <p className="text-xs text-muted-foreground">
                            • Last used:{' '}
                            {new Date(selected.last_used_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(selected.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-6 border rounded-lg border-dashed">
          <Key className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium mb-1">No credentials available</p>
          <p className="text-xs text-muted-foreground mb-3">
            Add a credential to continue
          </p>
        </div>
      )}

      {/* Add New Credential */}
      <div className="flex gap-2">
        {provider && isOAuthProvider(provider) ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => initiateOAuthFlow(provider)}
            className="flex-1"
          >
            <Plus className="w-4 h-4 mr-2" />
            Connect {getProviderName(provider)}
            <ExternalLink className="w-3 h-3 ml-2" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Navigate to credentials page to add new credential
              window.location.href = '/settings/credentials';
            }}
            className="flex-1"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Credential
          </Button>
        )}
      </div>

      {/* Info Message */}
      <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-xs text-blue-800 dark:text-blue-200">
          Credentials are encrypted and stored securely. They can be reused across
          multiple {allowMultiple ? 'nodes' : 'configurations'}.
        </p>
      </div>

      {/* All Credentials List (if not filtered by provider) */}
      {!provider && credentials && credentials.length > 0 && (
        <div className="border rounded-lg p-3">
          <h4 className="text-sm font-medium mb-3">All Credentials</h4>
          <div className="space-y-2">
            {credentials.slice(0, 5).map((credential) => (
              <div
                key={credential.id}
                className="flex items-center justify-between text-sm p-2 hover:bg-muted/50 rounded"
              >
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-muted-foreground" />
                  <span>{credential.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {getProviderName(credential.provider)}
                  </Badge>
                  {getStatusBadge(credential.is_active)}
                </div>
              </div>
            ))}
            {credentials.length > 5 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                +{credentials.length - 5} more
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
