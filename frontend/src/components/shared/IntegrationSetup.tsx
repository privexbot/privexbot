/**
 * IntegrationSetup - Reusable integration setup for Discord/Telegram
 *
 * WHY:
 * - Avoid duplication between chatbot and chatflow
 * - Consistent integration flow
 * - Reusable validation and testing
 *
 * HOW:
 * - Platform-specific validation
 * - Test connection
 * - Step-by-step instructions
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  MessageSquare,
  Users,
  ExternalLink,
  Loader2,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import apiClient, { handleApiError } from '@/lib/api-client';

type Platform = 'telegram' | 'discord';
type EntityType = 'chatbot' | 'chatflow';

interface IntegrationConfig {
  bot_token?: string;
  bot_username?: string;
  client_id?: string;
}

interface IntegrationSetupProps {
  platform: Platform;
  entityType: EntityType;
  entityId: string;
  config: IntegrationConfig;
  onChange: (config: IntegrationConfig) => void;
}

export default function IntegrationSetup({
  platform,
  entityType,
  entityId,
  config,
  onChange,
}: IntegrationSetupProps) {
  const { toast } = useToast();
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      const endpoint = `/${entityType}s/${entityId}/${platform}/test`;
      const payload =
        platform === 'telegram'
          ? { bot_token: config.bot_token }
          : { bot_token: config.bot_token };

      const response = await apiClient.post(endpoint, payload);
      return response.data;
    },
    onMutate: () => {
      setTestStatus('testing');
    },
    onSuccess: (data) => {
      setTestStatus('success');

      if (platform === 'telegram') {
        onChange({ ...config, bot_username: data.username });
        toast({
          title: 'Connection successful',
          description: `Connected to @${data.username}`,
        });
      } else if (platform === 'discord') {
        onChange({ ...config, client_id: data.client_id });
        toast({
          title: 'Connection successful',
          description: `Connected to Discord bot: ${data.username}`,
        });
      }
    },
    onError: (error) => {
      setTestStatus('error');
      toast({
        title: 'Connection failed',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
  });

  const updateConfig = (updates: Partial<IntegrationConfig>) => {
    onChange({ ...config, ...updates });
  };

  // Platform-specific validation
  const isValidToken = (token: string) => {
    if (platform === 'telegram') {
      // Telegram format: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
      return /^\d+:[A-Za-z0-9_-]+$/.test(token);
    }
    // Discord tokens are harder to validate format-wise
    return token.length > 20;
  };

  // Generate platform-specific URLs
  const getPlatformUrl = () => {
    if (platform === 'telegram' && config.bot_username) {
      return `https://t.me/${config.bot_username}`;
    }
    if (platform === 'discord' && config.client_id) {
      return `https://discord.com/api/oauth2/authorize?client_id=${config.client_id}&permissions=2147483648&scope=bot%20applications.commands`;
    }
    return null;
  };

  const platformUrl = getPlatformUrl();

  const copyInviteUrl = () => {
    if (platformUrl) {
      navigator.clipboard.writeText(platformUrl);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
      toast({ title: `${platform === 'telegram' ? 'Bot URL' : 'Invite URL'} copied` });
    }
  };

  const getPlatformIcon = () => {
    return platform === 'telegram' ? (
      <MessageSquare className="w-5 h-5" />
    ) : (
      <Users className="w-5 h-5" />
    );
  };

  const getPlatformName = () => {
    return platform === 'telegram' ? 'Telegram' : 'Discord';
  };

  const getSetupUrl = () => {
    return platform === 'telegram'
      ? 'https://t.me/BotFather'
      : 'https://discord.com/developers/applications';
  };

  const getSetupInstructions = () => {
    if (platform === 'telegram') {
      return [
        { text: 'Open ', link: null },
        {
          text: '@BotFather',
          link: 'https://t.me/BotFather',
        },
        { text: ' on Telegram', link: null },
        { text: 'Send /newbot and follow instructions', link: null },
        { text: 'Copy the bot token and paste below', link: null },
        { text: 'Click "Test" to verify connection', link: null },
      ];
    } else {
      return [
        { text: 'Go to ', link: null },
        {
          text: 'Discord Developer Portal',
          link: 'https://discord.com/developers/applications',
        },
        { text: 'Create a new application', link: null },
        { text: 'Go to "Bot" tab and create a bot', link: null },
        { text: 'Copy the bot token and paste below', link: null },
        { text: 'Click "Test" to verify connection', link: null },
      ];
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          {getPlatformIcon()}
          {getPlatformName()} Integration
        </h3>
        <p className="text-sm text-muted-foreground">
          Connect your {entityType} to {getPlatformName()}
        </p>
      </div>

      {/* Bot Token */}
      <div>
        <Label htmlFor="bot-token">Bot Token *</Label>
        <div className="flex gap-2 mt-2">
          <Input
            id="bot-token"
            type="password"
            value={config.bot_token || ''}
            onChange={(e) => updateConfig({ bot_token: e.target.value })}
            placeholder={
              platform === 'telegram'
                ? '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'
                : 'MTk4NjIyNDgzNDcxOTI1MjQ4.Cl2FMQ.ZnCjm1XVW7vRze4b7Cq4se7kKWs'
            }
            className="flex-1 font-mono text-xs"
          />
          <Button
            onClick={() => testMutation.mutate()}
            disabled={
              !config.bot_token ||
              (platform === 'telegram' && !isValidToken(config.bot_token)) ||
              testMutation.isPending
            }
            variant="outline"
          >
            {testStatus === 'testing' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : testStatus === 'success' ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : testStatus === 'error' ? (
              <AlertCircle className="w-4 h-4 text-destructive" />
            ) : (
              'Test'
            )}
          </Button>
        </div>

        {platform === 'telegram' &&
          config.bot_token &&
          !isValidToken(config.bot_token) && (
            <p className="text-xs text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Invalid token format
            </p>
          )}

        <p className="text-xs text-muted-foreground mt-1">
          Get your bot token from{' '}
          <a
            href={getSetupUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            {platform === 'telegram' ? '@BotFather' : 'Discord Developer Portal'}
            <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      </div>

      {/* Bot Username/Invite URL (after successful connection) */}
      {testStatus === 'success' && platformUrl && (
        <div>
          <Label>{platform === 'telegram' ? 'Bot Username' : 'Bot Invite URL'}</Label>
          <p className="text-sm text-muted-foreground mb-2">
            {platform === 'telegram'
              ? 'Share this link with users to start chatting'
              : 'Share this URL to invite the bot to Discord servers'}
          </p>
          <div className="flex gap-2">
            <Input
              value={
                platform === 'telegram' ? `@${config.bot_username}` : platformUrl
              }
              readOnly
              className={platform === 'discord' ? 'font-mono text-xs' : ''}
            />
            <Button variant="outline" onClick={copyInviteUrl}>
              {copiedInvite ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button variant="outline" asChild>
              <a href={platformUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* Setup Instructions */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm font-medium mb-2">
          {platform === 'telegram' ? '🤖' : '🎮'} Setup Instructions:
        </p>
        <ol className="text-sm space-y-1 list-decimal list-inside">
          {getSetupInstructions().map((step, idx) => (
            <li key={idx}>
              {step.link ? (
                <a
                  href={step.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {step.text}
                </a>
              ) : (
                step.text
              )}
            </li>
          ))}
        </ol>
      </div>

      {/* Connection Status */}
      {testStatus === 'success' && (
        <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
            <CheckCircle className="w-5 h-5" />
            <div>
              <p className="font-medium">Successfully Connected</p>
              <p className="text-sm">
                Your {entityType} is ready to deploy on {getPlatformName()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
