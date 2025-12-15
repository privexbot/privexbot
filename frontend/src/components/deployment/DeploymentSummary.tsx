/**
 * DeploymentSummary - Shows deployment status per channel
 *
 * WHY:
 * - Monitor deployment health
 * - Quick access to deployments
 * - Error handling and retry
 *
 * HOW:
 * - Status polling per channel
 * - Test/verify buttons
 * - Quick links to deployments
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Globe,
  MessageSquare,
  Users,
  Zap,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import apiClient, { handleApiError } from '@/lib/api-client';

type DeploymentStatus = 'active' | 'inactive' | 'error' | 'pending';

interface ChannelDeployment {
  channel: string;
  enabled: boolean;
  status: DeploymentStatus;
  last_deployed_at?: string;
  last_tested_at?: string;
  error_message?: string;
  config: any;
}

interface DeploymentSummaryProps {
  chatbotId: string;
}

export default function DeploymentSummary({ chatbotId }: DeploymentSummaryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch deployment status
  const { data: deployments, isLoading } = useQuery({
    queryKey: ['deployments', chatbotId],
    queryFn: async () => {
      const response = await apiClient.get(`/deployments/${chatbotId}`);
      return response.data.deployments as ChannelDeployment[];
    },
    refetchInterval: 10000, // Poll every 10 seconds
  });

  // Test channel mutation
  const testMutation = useMutation({
    mutationFn: async (channel: string) => {
      const response = await apiClient.post(`/deployments/${chatbotId}/${channel}/test`);
      return response.data;
    },
    onSuccess: (_, channel) => {
      toast({
        title: 'Test successful',
        description: `${channel} deployment is working correctly`,
      });
      queryClient.invalidateQueries({ queryKey: ['deployments', chatbotId] });
    },
    onError: (error, channel) => {
      toast({
        title: 'Test failed',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
  });

  // Retry deployment mutation
  const retryMutation = useMutation({
    mutationFn: async (channel: string) => {
      const response = await apiClient.post(`/deployments/${chatbotId}/${channel}/retry`);
      return response.data;
    },
    onSuccess: (_, channel) => {
      toast({
        title: 'Retry initiated',
        description: `Redeploying to ${channel}...`,
      });
      queryClient.invalidateQueries({ queryKey: ['deployments', chatbotId] });
    },
    onError: (error) => {
      toast({
        title: 'Retry failed',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
  });

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'website':
        return <Globe className="w-5 h-5" />;
      case 'telegram':
        return <MessageSquare className="w-5 h-5" />;
      case 'discord':
        return <Users className="w-5 h-5" />;
      case 'whatsapp':
        return <MessageSquare className="w-5 h-5" />;
      case 'zapier':
        return <Zap className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getChannelName = (channel: string) => {
    return channel.charAt(0).toUpperCase() + channel.slice(1);
  };

  const getStatusBadge = (status: DeploymentStatus) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </Badge>
        );
      case 'inactive':
        return (
          <Badge variant="secondary">
            <XCircle className="w-3 h-3 mr-1" />
            Inactive
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Pending
          </Badge>
        );
    }
  };

  const getChannelUrl = (deployment: ChannelDeployment) => {
    switch (deployment.channel) {
      case 'website':
        return deployment.config.allowed_domains?.[0]
          ? `https://${deployment.config.allowed_domains[0]}`
          : null;
      case 'telegram':
        return deployment.config.bot_username
          ? `https://t.me/${deployment.config.bot_username}`
          : null;
      case 'discord':
        return deployment.config.client_id
          ? `https://discord.com/api/oauth2/authorize?client_id=${deployment.config.client_id}&permissions=2147483648&scope=bot%20applications.commands`
          : null;
      case 'zapier':
        return `${import.meta.env.VITE_API_BASE_URL}/webhooks/zapier/${chatbotId}`;
      default:
        return null;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const enabledDeployments = deployments?.filter((d) => d.enabled) || [];

  if (enabledDeployments.length === 0) {
    return (
      <div className="text-center py-12">
        <Globe className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="text-lg font-semibold mb-2">No Deployments Yet</h3>
        <p className="text-sm text-muted-foreground">
          Enable at least one channel to start deploying your chatbot
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Deployment Status</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['deployments', chatbotId] })}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {enabledDeployments.map((deployment) => {
          const channelUrl = getChannelUrl(deployment);

          return (
            <div
              key={deployment.channel}
              className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {getChannelIcon(deployment.channel)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{getChannelName(deployment.channel)}</h4>
                      {getStatusBadge(deployment.status)}
                    </div>

                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center gap-4">
                        <span>Deployed: {formatDate(deployment.last_deployed_at)}</span>
                        <span>Tested: {formatDate(deployment.last_tested_at)}</span>
                      </div>

                      {deployment.error_message && (
                        <p className="text-destructive flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {deployment.error_message}
                        </p>
                      )}

                      {channelUrl && deployment.status === 'active' && (
                        <a
                          href={channelUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          View deployment
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testMutation.mutate(deployment.channel)}
                    disabled={testMutation.isPending || deployment.status === 'pending'}
                  >
                    {testMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Test'
                    )}
                  </Button>

                  {deployment.status === 'error' && (
                    <Button
                      size="sm"
                      onClick={() => retryMutation.mutate(deployment.channel)}
                      disabled={retryMutation.isPending}
                    >
                      {retryMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall Status */}
      <div className="p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Deployments</span>
          <span className="font-medium">{enabledDeployments.length}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-muted-foreground">Active</span>
          <span className="font-medium text-green-600">
            {enabledDeployments.filter((d) => d.status === 'active').length}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-muted-foreground">Errors</span>
          <span className="font-medium text-destructive">
            {enabledDeployments.filter((d) => d.status === 'error').length}
          </span>
        </div>
      </div>
    </div>
  );
}
