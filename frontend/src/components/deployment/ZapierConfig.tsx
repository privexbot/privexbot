/**
 * ZapierConfig - Zapier webhook configuration
 *
 * WHY:
 * - Integrate with Zapier
 * - Webhook URL generation
 * - Payload examples
 *
 * HOW:
 * - Generate webhook URL
 * - Copy to clipboard
 * - Show payload format
 */

import { useState } from 'react';
import { Zap, Copy, Check, Code, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface ZapierConfig {
  enabled: boolean;
  webhook_secret?: string;
  include_conversation_history: boolean;
  include_user_metadata: boolean;
  include_sentiment_analysis: boolean;
}

interface ZapierConfigProps {
  chatbotId: string;
  config: ZapierConfig;
  onChange: (config: ZapierConfig) => void;
}

export default function ZapierConfig({ chatbotId, config, onChange }: ZapierConfigProps) {
  const { toast } = useToast();
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_API_BASE_URL}/webhooks/zapier/${chatbotId}`;

  // Generate random secret if not exists
  const generateSecret = () => {
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    onChange({ ...config, webhook_secret: secret });
    toast({ title: 'Webhook secret generated' });
  };

  const updateConfig = (updates: Partial<ZapierConfig>) => {
    onChange({ ...config, ...updates });
  };

  const copyToClipboard = (text: string, type: 'webhook' | 'secret' | 'payload') => {
    navigator.clipboard.writeText(text);

    if (type === 'webhook') {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } else if (type === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    }

    toast({ title: 'Copied to clipboard' });
  };

  const samplePayload = {
    event: 'message.sent',
    chatbot_id: chatbotId,
    conversation_id: 'conv_abc123',
    user_id: 'user_xyz789',
    timestamp: '2024-01-15T10:30:00Z',
    user_message: 'What are your business hours?',
    bot_response: 'We are open Monday-Friday, 9 AM to 5 PM EST.',
    ...(config.include_conversation_history && {
      conversation_history: [
        {
          role: 'user',
          content: 'Hello',
          timestamp: '2024-01-15T10:29:00Z',
        },
        {
          role: 'assistant',
          content: 'Hi! How can I help you today?',
          timestamp: '2024-01-15T10:29:05Z',
        },
      ],
    }),
    ...(config.include_user_metadata && {
      user_metadata: {
        email: 'user@example.com',
        name: 'John Doe',
        location: 'New York, US',
      },
    }),
    ...(config.include_sentiment_analysis && {
      sentiment: {
        score: 0.8,
        label: 'positive',
        confidence: 0.92,
      },
    }),
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Zap className="w-5 h-5 text-orange-500" />
          Zapier Webhook Integration
        </h3>
        <p className="text-sm text-muted-foreground">
          Connect your chatbot to 5,000+ apps via Zapier
        </p>
      </div>

      {/* Webhook URL */}
      <div>
        <Label>Webhook URL</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Use this URL in your Zapier "Catch Hook" trigger
        </p>
        <div className="flex gap-2">
          <Input
            value={webhookUrl}
            readOnly
            className="font-mono text-xs"
          />
          <Button
            variant="outline"
            onClick={() => copyToClipboard(webhookUrl, 'webhook')}
          >
            {copiedWebhook ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Webhook Secret */}
      <div>
        <Label>Webhook Secret (Optional)</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Verify webhook requests for security
        </p>
        <div className="flex gap-2">
          <Input
            value={config.webhook_secret || ''}
            readOnly
            placeholder="Click generate to create secret"
            className="flex-1 font-mono text-xs"
            type="password"
          />
          {config.webhook_secret && (
            <Button
              variant="outline"
              onClick={() => copyToClipboard(config.webhook_secret!, 'secret')}
            >
              {copiedSecret ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          )}
          <Button onClick={generateSecret}>
            {config.webhook_secret ? 'Regenerate' : 'Generate'}
          </Button>
        </div>
        {config.webhook_secret && (
          <p className="text-xs text-muted-foreground mt-1">
            Secret is sent in X-Webhook-Signature header
          </p>
        )}
      </div>

      {/* Conversation History */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div>
          <Label htmlFor="history">Include Conversation History</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Send previous messages in the conversation
          </p>
        </div>
        <Switch
          id="history"
          checked={config.include_conversation_history}
          onCheckedChange={(checked) =>
            updateConfig({ include_conversation_history: checked })
          }
        />
      </div>

      {/* User Metadata */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div>
          <Label htmlFor="metadata">Include User Metadata</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Send user email, name, location if available
          </p>
        </div>
        <Switch
          id="metadata"
          checked={config.include_user_metadata}
          onCheckedChange={(checked) => updateConfig({ include_user_metadata: checked })}
        />
      </div>

      {/* Sentiment Analysis */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div>
          <Label htmlFor="sentiment">Include Sentiment Analysis</Label>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered sentiment detection (positive/negative/neutral)
          </p>
        </div>
        <Switch
          id="sentiment"
          checked={config.include_sentiment_analysis}
          onCheckedChange={(checked) =>
            updateConfig({ include_sentiment_analysis: checked })
          }
        />
      </div>

      {/* Payload Format */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="flex items-center gap-2">
            <Code className="w-4 h-4" />
            Webhook Payload Format
          </Label>
          <Button
            size="sm"
            variant="outline"
            onClick={() => copyToClipboard(JSON.stringify(samplePayload, null, 2), 'payload')}
          >
            {copiedPayload ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            Copy JSON
          </Button>
        </div>

        <Textarea
          value={JSON.stringify(samplePayload, null, 2)}
          readOnly
          className="font-mono text-xs h-80"
        />
      </div>

      {/* Setup Instructions */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm font-medium mb-2">⚡ Setup Instructions:</p>
        <ol className="text-sm space-y-1 list-decimal list-inside">
          <li>
            Create a new Zap at{' '}
            <a
              href="https://zapier.com/app/zaps"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Zapier
              <ExternalLink className="w-3 h-3" />
            </a>
          </li>
          <li>Choose "Webhooks by Zapier" as the trigger</li>
          <li>Select "Catch Hook" event</li>
          <li>Copy the webhook URL above and paste in Zapier</li>
          <li>Test the webhook by sending a message to your chatbot</li>
          <li>Set up your action (e.g., add to Google Sheets, send email)</li>
        </ol>
      </div>

      {/* Use Cases */}
      <div className="p-4 border rounded-lg bg-card">
        <h4 className="text-sm font-medium mb-3">💡 Popular Use Cases</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
            <div>
              <p className="font-medium">Lead Capture</p>
              <p className="text-muted-foreground">
                Add new leads to Google Sheets, Airtable, or CRM
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-muted-foreground">
                Send email alerts for specific keywords or sentiments
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
            <div>
              <p className="font-medium">Ticket Creation</p>
              <p className="text-muted-foreground">
                Create support tickets in Zendesk, Jira, or Freshdesk
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
            <div>
              <p className="font-medium">Slack Notifications</p>
              <p className="text-muted-foreground">
                Send high-priority messages to Slack channels
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Events Triggered */}
      <div className="p-4 border rounded-lg bg-card">
        <h4 className="text-sm font-medium mb-3">Triggered Events</h4>
        <div className="space-y-2 text-sm font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">message.sent</span>
            <span>New message sent to user</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">conversation.started</span>
            <span>New conversation started</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">lead.captured</span>
            <span>User information captured</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">feedback.received</span>
            <span>User feedback submitted</span>
          </div>
        </div>
      </div>
    </div>
  );
}
