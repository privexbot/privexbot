/**
 * DiscordConfig - Discord bot configuration
 *
 * WHY:
 * - Deploy to Discord servers
 * - Bot token management
 * - Server permissions
 *
 * HOW:
 * - Token input with validation
 * - Invite link generation
 * - Command prefix config
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Users, ExternalLink, Loader2, CheckCircle, AlertCircle, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import apiClient, { handleApiError } from '@/lib/api-client';

interface DiscordConfig {
  enabled: boolean;
  bot_token?: string;
  client_id?: string;
  command_prefix: string;
  welcome_message?: string;
  enable_slash_commands: boolean;
  enable_dm_responses: boolean;
}

interface DiscordConfigProps {
  chatbotId: string;
  config: DiscordConfig;
  onChange: (config: DiscordConfig) => void;
}

export default function DiscordConfig({ chatbotId, config, onChange }: DiscordConfigProps) {
  const { toast } = useToast();
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/deployments/${chatbotId}/discord/test`, {
        bot_token: config.bot_token,
      });
      return response.data;
    },
    onMutate: () => {
      setTestStatus('testing');
    },
    onSuccess: (data) => {
      setTestStatus('success');
      onChange({ ...config, client_id: data.client_id });
      toast({
        title: 'Connection successful',
        description: `Connected to Discord bot: ${data.username}`,
      });
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

  const updateConfig = (updates: Partial<DiscordConfig>) => {
    onChange({ ...config, ...updates });
  };

  // Generate Discord invite URL
  const inviteUrl = config.client_id
    ? `https://discord.com/api/oauth2/authorize?client_id=${config.client_id}&permissions=2147483648&scope=bot%20applications.commands`
    : null;

  const copyInviteUrl = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
      toast({ title: 'Invite URL copied to clipboard' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Discord Bot Configuration
        </h3>
        <p className="text-sm text-muted-foreground">
          Deploy your chatbot to Discord servers
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
            placeholder="MTk4NjIyNDgzNDcxOTI1MjQ4.Cl2FMQ.ZnCjm1XVW7vRze4b7Cq4se7kKWs"
            className="flex-1 font-mono text-xs"
          />
          <Button
            onClick={() => testMutation.mutate()}
            disabled={!config.bot_token || testMutation.isPending}
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

        <p className="text-xs text-muted-foreground mt-1">
          Get your bot token from{' '}
          <a
            href="https://discord.com/developers/applications"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            Discord Developer Portal
            <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      </div>

      {/* Invite URL */}
      {inviteUrl && (
        <div>
          <Label>Bot Invite URL</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Share this URL to invite the bot to Discord servers
          </p>
          <div className="flex gap-2">
            <Input
              value={inviteUrl}
              readOnly
              className="font-mono text-xs"
            />
            <Button variant="outline" onClick={copyInviteUrl}>
              {copiedInvite ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button variant="outline" asChild>
              <a href={inviteUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* Command Prefix */}
      <div>
        <Label htmlFor="prefix">Command Prefix</Label>
        <Input
          id="prefix"
          value={config.command_prefix}
          onChange={(e) => updateConfig({ command_prefix: e.target.value })}
          placeholder="!"
          maxLength={3}
          className="mt-2 w-24 font-mono text-center text-lg"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Example: {config.command_prefix}help, {config.command_prefix}ask
        </p>
      </div>

      {/* Welcome Message */}
      <div>
        <Label htmlFor="welcome">Welcome Message (Optional)</Label>
        <Textarea
          id="welcome"
          value={config.welcome_message || ''}
          onChange={(e) => updateConfig({ welcome_message: e.target.value })}
          placeholder="👋 Welcome! I'm your AI assistant. Ask me anything!"
          className="mt-2"
          rows={3}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Sent when bot joins a server or in DMs
        </p>
      </div>

      {/* Slash Commands */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div>
          <Label htmlFor="slash">Enable Slash Commands</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Use /commands instead of prefix (recommended)
          </p>
        </div>
        <Switch
          id="slash"
          checked={config.enable_slash_commands}
          onCheckedChange={(checked) => updateConfig({ enable_slash_commands: checked })}
        />
      </div>

      {/* DM Responses */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div>
          <Label htmlFor="dm">Enable DM Responses</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Respond to direct messages from users
          </p>
        </div>
        <Switch
          id="dm"
          checked={config.enable_dm_responses}
          onCheckedChange={(checked) => updateConfig({ enable_dm_responses: checked })}
        />
      </div>

      {/* Setup Instructions */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm font-medium mb-2">🤖 Setup Instructions:</p>
        <ol className="text-sm space-y-1 list-decimal list-inside">
          <li>
            Go to{' '}
            <a
              href="https://discord.com/developers/applications"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Discord Developer Portal
            </a>
          </li>
          <li>Create a new application</li>
          <li>Go to "Bot" tab and create a bot</li>
          <li>Copy the bot token and paste above</li>
          <li>Click "Test" to verify connection</li>
          <li>Use the invite URL to add bot to servers</li>
        </ol>
      </div>

      {/* Bot Commands */}
      <div className="p-4 border rounded-lg bg-card">
        <h4 className="text-sm font-medium mb-3">Available Commands</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between font-mono">
            <span className="text-muted-foreground">
              {config.enable_slash_commands ? '/ask' : `${config.command_prefix}ask`}
            </span>
            <span>Ask a question</span>
          </div>
          <div className="flex justify-between font-mono">
            <span className="text-muted-foreground">
              {config.enable_slash_commands ? '/help' : `${config.command_prefix}help`}
            </span>
            <span>Show help message</span>
          </div>
          <div className="flex justify-between font-mono">
            <span className="text-muted-foreground">
              {config.enable_slash_commands ? '/reset' : `${config.command_prefix}reset`}
            </span>
            <span>Clear conversation</span>
          </div>
          <div className="flex justify-between font-mono">
            <span className="text-muted-foreground">
              {config.enable_slash_commands ? '/feedback' : `${config.command_prefix}feedback`}
            </span>
            <span>Send feedback</span>
          </div>
        </div>
      </div>

      {/* Required Permissions */}
      <div className="p-4 border rounded-lg bg-card">
        <h4 className="text-sm font-medium mb-3">Required Permissions</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Read Messages</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Send Messages</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Embed Links</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Read Message History</span>
          </div>
        </div>
      </div>
    </div>
  );
}
