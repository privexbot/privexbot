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
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import apiClient, { handleApiError } from '@/lib/api-client';
import { useWorkspaceStore } from '@/store/workspace-store';
import { cn } from '@/lib/utils';

// Provider types (service names)
type CredentialProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'notion'
  | 'slack'
  | 'telegram'
  | 'discord'
  | 'whatsapp'
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
  workspaceId?: string; // Explicitly pass workspace ID to avoid context mismatch
}

export default function CredentialSelector({
  provider,
  selectedId,
  onSelect,
  label = 'Credential',
  required = false,
  allowMultiple = false,
  workspaceId: propWorkspaceId,
}: CredentialSelectorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspaceStore();

  // Use prop workspaceId if provided, otherwise fall back to store
  const workspaceId = propWorkspaceId || currentWorkspace?.id;

  // Fetch credentials from API
  const { data: credentials, isLoading, error } = useQuery({
    queryKey: ['credentials', workspaceId, provider],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (workspaceId) {
        params.append('workspace_id', workspaceId);
      }
      // Use provider filter (service name like 'telegram', 'discord')
      if (provider) {
        params.append('provider', provider);
      }

      const response = await apiClient.get(`/credentials?${params}`);
      // API returns { items: [...], total, skip, limit }
      return response.data.items as Credential[];
    },
    enabled: !!workspaceId,
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
    if (!workspaceId) {
      toast({
        title: 'Workspace not selected',
        description: 'Please select a workspace before connecting credentials.',
        variant: 'destructive',
      });
      return;
    }
    const oauthUrl = `${import.meta.env.VITE_API_BASE_URL}/credentials/oauth/authorize?provider=${selectedProvider}&workspace_id=${workspaceId}`;
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
      whatsapp: 'WhatsApp',
      custom: 'Custom',
    };
    return names[providerName] || providerName;
  };

  const getStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return (
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
          <CheckCircle className="h-3 w-3" />
          <span className="font-manrope">Active</span>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
        <AlertCircle className="h-3 w-3" />
        <span className="font-manrope">Inactive</span>
      </div>
    );
  };

  const isOAuthProvider = (providerName: CredentialProvider) => {
    // Only Google and Notion use true OAuth flows
    // Telegram, Discord, WhatsApp use bot tokens entered manually
    return ['google', 'notion'].includes(providerName);
  };

  // Filter active credentials
  const activeCredentials = credentials?.filter((c) => c.is_active) || [];
  const hasCredentials = activeCredentials.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
          <Key className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          {label}
          {required && <span className="text-red-500">*</span>}
        </Label>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400 dark:text-gray-500" />
        </div>
      ) : error ? (
        <div className="text-center py-4 text-red-600 dark:text-red-400 text-sm font-manrope">
          Failed to load credentials. Please try again.
        </div>
      ) : hasCredentials ? (
        <div className="space-y-2">
          <Select value={selectedId} onValueChange={onSelect}>
            <SelectTrigger className="h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope">
              <SelectValue placeholder="Select a credential" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              {activeCredentials.map((credential) => (
                <SelectItem
                  key={credential.id}
                  value={credential.id}
                  className="font-manrope text-gray-700 dark:text-gray-300"
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="flex-1">{credential.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {getProviderName(credential.provider)}
                      </span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Selected Credential Details */}
          {selectedId && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              {(() => {
                const selected = credentials?.find((c) => c.id === selectedId);
                if (!selected) return null;

                return (
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                        {selected.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-manrope">
                          {getProviderName(selected.provider)}
                        </p>
                        {selected.last_used_at && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                            • Last used: {new Date(selected.last_used_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(selected.id)}
                      disabled={deleteMutation.isPending}
                      className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-6 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/50">
          <Key className="h-8 w-8 mx-auto text-gray-400 dark:text-gray-500 mb-2" />
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope mb-1">
            No credentials available
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 font-manrope mb-3">
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
            className="flex-1 font-manrope rounded-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <Plus className="h-4 w-4 mr-2" />
            Connect {getProviderName(provider)}
            <ExternalLink className="h-3 w-3 ml-2" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Navigate to credentials page to add new credential
              window.location.href = '/settings/credentials';
            }}
            className="flex-1 font-manrope rounded-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Credential
          </Button>
        )}
      </div>

      {/* Info Message */}
      <Alert className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <AlertDescription className="text-xs text-blue-700 dark:text-blue-300 font-manrope">
          Credentials are encrypted and stored securely. They can be reused across
          multiple {allowMultiple ? 'nodes' : 'configurations'}.
        </AlertDescription>
      </Alert>

      {/* All Credentials List (if not filtered by provider) */}
      {!provider && credentials && credentials.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope mb-3">
            All Credentials
          </h4>
          <div className="space-y-2">
            {credentials.slice(0, 5).map((credential) => (
              <div
                key={credential.id}
                className="flex items-center justify-between text-sm p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <span className="text-gray-900 dark:text-gray-100 font-manrope">
                    {credential.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                    {getProviderName(credential.provider)}
                  </span>
                  {getStatusBadge(credential.is_active)}
                </div>
              </div>
            ))}
            {credentials.length > 5 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope text-center pt-2">
                +{credentials.length - 5} more
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
