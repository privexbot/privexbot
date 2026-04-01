/**
 * SlackConfig - Slack workspace deployment configuration
 *
 * WHY:
 * - Deploy chatbot to Slack workspaces
 * - Shared bot architecture (one app, many workspaces)
 * - OAuth-based installation flow
 *
 * HOW:
 * - "Add to Slack" button triggers OAuth install
 * - After install, workspace appears in deployment list
 * - Channel restrictions and management
 */

import { useState } from 'react';
import { MessageSquare, ExternalLink, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { slackApi } from '@/api/slack';

interface SlackConfigData {
  enabled: boolean;
  welcome_message?: string;
  enable_dm_responses: boolean;
  respond_to_mentions: boolean;
  thread_replies: boolean;
}

interface SlackConfigProps {
  chatbotId: string;
  config: SlackConfigData;
  onChange: (config: SlackConfigData) => void;
}

export default function SlackConfig({ chatbotId, config, onChange }: SlackConfigProps) {
  const { toast } = useToast();
  const [installLoading, setInstallLoading] = useState(false);

  const updateConfig = (updates: Partial<SlackConfigData>) => {
    onChange({ ...config, ...updates });
  };

  const handleInstallSlack = async () => {
    setInstallLoading(true);
    try {
      const response = await slackApi.getInstallUrl(chatbotId);
      // Open Slack OAuth install page
      window.open(response.install_url, '_blank');
      toast({
        title: 'Slack installation started',
        description: 'Complete the installation in the Slack window that opened.',
      });
    } catch (error) {
      toast({
        title: 'Failed to get install URL',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setInstallLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Slack Configuration
        </h3>
        <p className="text-sm text-muted-foreground">
          Deploy your chatbot to Slack workspaces
        </p>
      </div>

      {/* Add to Slack Button */}
      <div className="p-6 border rounded-lg bg-card text-center space-y-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-[#4A154B] flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-lg">Add to Slack</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Install the PrivexBot app to your Slack workspace
            </p>
          </div>
        </div>

        <Button
          onClick={handleInstallSlack}
          disabled={installLoading}
          className="bg-[#4A154B] hover:bg-[#611f69] text-white"
          size="lg"
        >
          {installLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ExternalLink className="w-4 h-4 mr-2" />
          )}
          Add to Slack
        </Button>
      </div>

      {/* Welcome Message */}
      <div>
        <Label htmlFor="slack-welcome">Welcome Message (Optional)</Label>
        <Textarea
          id="slack-welcome"
          value={config.welcome_message || ''}
          onChange={(e) => updateConfig({ welcome_message: e.target.value })}
          placeholder="Hi there! I'm your AI assistant. Ask me anything or mention me with @bot."
          className="mt-2"
          rows={3}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Sent when the bot first interacts in a channel
        </p>
      </div>

      {/* DM Responses */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div>
          <Label htmlFor="slack-dm">Enable DM Responses</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Respond to direct messages from users
          </p>
        </div>
        <Switch
          id="slack-dm"
          checked={config.enable_dm_responses}
          onCheckedChange={(checked) => updateConfig({ enable_dm_responses: checked })}
        />
      </div>

      {/* Respond to Mentions */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div>
          <Label htmlFor="slack-mention">Respond to @mentions</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Respond when someone mentions @bot in a channel
          </p>
        </div>
        <Switch
          id="slack-mention"
          checked={config.respond_to_mentions}
          onCheckedChange={(checked) => updateConfig({ respond_to_mentions: checked })}
        />
      </div>

      {/* Thread Replies */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div>
          <Label htmlFor="slack-thread">Reply in Threads</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Reply to channel messages in a thread (keeps channels tidy)
          </p>
        </div>
        <Switch
          id="slack-thread"
          checked={config.thread_replies}
          onCheckedChange={(checked) => updateConfig({ thread_replies: checked })}
        />
      </div>

      {/* Setup Instructions */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm font-medium mb-2">Setup Instructions:</p>
        <ol className="text-sm space-y-1 list-decimal list-inside">
          <li>Click "Add to Slack" above</li>
          <li>Select your Slack workspace</li>
          <li>Authorize the PrivexBot app</li>
          <li>The bot will appear in your workspace automatically</li>
          <li>DM the bot or mention it with @PrivexBot in any channel</li>
          <li>Manage channel restrictions in chatbot settings after deployment</li>
        </ol>
      </div>

      {/* Required Permissions */}
      <div className="p-4 border rounded-lg bg-card">
        <h4 className="text-sm font-medium mb-3">Bot Permissions</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Send Messages</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Read @mentions</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Read DMs</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Read Channels</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Get User Info</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Workspace Info</span>
          </div>
        </div>
      </div>
    </div>
  );
}
