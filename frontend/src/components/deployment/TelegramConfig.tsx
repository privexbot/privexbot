/**
 * TelegramConfig - Telegram bot configuration
 *
 * WHY:
 * - Deploy to Telegram
 * - Bot token management
 * - Command configuration
 *
 * HOW:
 * - Token input with validation
 * - Test connection
 * - Bot link generation
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MessageSquare, ExternalLink, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import apiClient, { handleApiError } from '@/lib/api-client';

interface TelegramConfig {
  enabled: boolean;
  bot_token?: string;
  bot_username?: string;
  welcome_message?: string;
  enable_typing_indicator: boolean;
  enable_inline_mode: boolean;
}

interface TelegramConfigProps {
  chatbotId: string;
  config: TelegramConfig;
  onChange: (config: TelegramConfig) => void;
}

export default function TelegramConfig({ chatbotId, config, onChange }: TelegramConfigProps) {
  const { toast } = useToast();
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/deployments/${chatbotId}/telegram/test`, {
        bot_token: config.bot_token,
      });
      return response.data;
    },
    onMutate: () => {
      setTestStatus('testing');
    },
    onSuccess: (data) => {
      setTestStatus('success');
      onChange({ ...config, bot_username: data.username });
      toast({
        title: 'Connection successful',
        description: `Connected to @${data.username}`,
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

  const updateConfig = (updates: Partial<TelegramConfig>) => {
    onChange({ ...config, ...updates });
  };

  const isValidToken = (token: string) => {
    // Telegram bot tokens format: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
    return /^\d+:[A-Za-z0-9_-]+$/.test(token);
  };

  const botUrl = config.bot_username ? `https://t.me/${config.bot_username}` : null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Telegram Bot Configuration
        </h3>
        <p className="text-sm text-muted-foreground">
          Deploy your chatbot as a Telegram bot
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
            placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
            className="flex-1 font-mono"
          />
          <Button
            onClick={() => testMutation.mutate()}
            disabled={!config.bot_token || !isValidToken(config.bot_token) || testMutation.isPending}
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

        {config.bot_token && !isValidToken(config.bot_token) && (
          <p className="text-xs text-destructive mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Invalid token format
          </p>
        )}

        <p className="text-xs text-muted-foreground mt-1">
          Get your bot token from{' '}
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            @BotFather
            <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      </div>

      {/* Bot Username (read-only) */}
      {config.bot_username && (
        <div>
          <Label>Bot Username</Label>
          <div className="flex items-center gap-2 mt-2">
            <Input
              value={`@${config.bot_username}`}
              readOnly
              className="flex-1"
            />
            {botUrl && (
              <Button variant="outline" asChild>
                <a href={botUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Welcome Message */}
      <div>
        <Label htmlFor="welcome">Welcome Message (Optional)</Label>
        <Textarea
          id="welcome"
          value={config.welcome_message || ''}
          onChange={(e) => updateConfig({ welcome_message: e.target.value })}
          placeholder="Welcome to our bot! How can I help you today?"
          className="mt-2"
          rows={3}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Sent when users start the bot with /start
        </p>
      </div>

      {/* Typing Indicator */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div>
          <Label htmlFor="typing">Enable Typing Indicator</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Show "typing..." while generating response
          </p>
        </div>
        <Switch
          id="typing"
          checked={config.enable_typing_indicator}
          onCheckedChange={(checked) => updateConfig({ enable_typing_indicator: checked })}
        />
      </div>

      {/* Inline Mode */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div>
          <Label htmlFor="inline">Enable Inline Mode</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Allow users to invoke bot in any chat with @botname
          </p>
        </div>
        <Switch
          id="inline"
          checked={config.enable_inline_mode}
          onCheckedChange={(checked) => updateConfig({ enable_inline_mode: checked })}
        />
      </div>

      {/* Setup Instructions */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm font-medium mb-2">🤖 Setup Instructions:</p>
        <ol className="text-sm space-y-1 list-decimal list-inside">
          <li>
            Open{' '}
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              @BotFather
            </a>{' '}
            on Telegram
          </li>
          <li>Send /newbot and follow instructions</li>
          <li>Copy the bot token and paste above</li>
          <li>Click "Test" to verify connection</li>
          <li>Save and deploy your chatbot</li>
        </ol>
      </div>

      {/* Bot Commands */}
      <div className="p-4 border rounded-lg bg-card">
        <h4 className="text-sm font-medium mb-3">Available Commands</h4>
        <div className="space-y-2 text-sm font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">/start</span>
            <span>Start conversation</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">/help</span>
            <span>Show help message</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">/reset</span>
            <span>Clear conversation history</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">/feedback</span>
            <span>Send feedback</span>
          </div>
        </div>
      </div>
    </div>
  );
}
