/**
 * ZapierConfig - Zapier webhook configuration
 *
 * WHY:
 * - Zapier integration requires users to configure a webhook URL in Zapier
 * - Users need to copy the webhook URL and sample payload
 * - No OAuth or credentials needed — just the URL
 *
 * HOW:
 * - Display the webhook URL for the chatbot
 * - Show sample payload and response format
 * - Copy button for easy configuration
 */

import { useState } from 'react';
import { Zap, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { config } from '@/config/env';

interface ZapierConfigData {
  enabled: boolean;
}

interface ZapierConfigProps {
  chatbotId: string;
  config: ZapierConfigData;
  onChange: (config: ZapierConfigData) => void;
}

export default function ZapierConfig({ chatbotId, config: zapierConfig, onChange }: ZapierConfigProps) {
  const { toast } = useToast();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const webhookUrl = `${config.API_BASE_URL}/webhooks/zapier/${chatbotId}`;

  const samplePayload = JSON.stringify(
    {
      message: "What are your business hours?",
      session_id: "optional-session-id",
      metadata: {
        source: "zapier",
        email: "user@example.com",
      },
    },
    null,
    2
  );

  const sampleResponse = JSON.stringify(
    {
      response: "Our business hours are Monday to Friday, 9am to 5pm.",
      session_id: "uuid-session-id",
      success: true,
      sources: [],
    },
    null,
    2
  );

  const copyToClipboard = (text: string, type: 'url' | 'payload') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    }
    toast({ title: `${type === 'url' ? 'Webhook URL' : 'Sample payload'} copied to clipboard` });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Zapier Configuration
        </h3>
        <p className="text-sm text-muted-foreground">
          Connect your chatbot to Zapier for workflow automation
        </p>
      </div>

      {/* Webhook URL */}
      <div>
        <Label>Webhook URL</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Use this URL in your Zapier "Webhooks by Zapier" action
        </p>
        <div className="flex gap-2">
          <Input
            value={webhookUrl}
            readOnly
            className="font-mono text-xs"
          />
          <Button
            variant="outline"
            onClick={() => copyToClipboard(webhookUrl, 'url')}
          >
            {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Sample Request */}
      <div>
        <Label>Sample Request Payload (POST)</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Send a POST request with this JSON format
        </p>
        <div className="relative">
          <pre className="p-4 bg-muted rounded-lg text-xs font-mono overflow-x-auto">
            {samplePayload}
          </pre>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2"
            onClick={() => copyToClipboard(samplePayload, 'payload')}
          >
            {copiedPayload ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* Sample Response */}
      <div>
        <Label>Sample Response</Label>
        <p className="text-sm text-muted-foreground mb-2">
          The webhook returns this JSON format
        </p>
        <pre className="p-4 bg-muted rounded-lg text-xs font-mono overflow-x-auto">
          {sampleResponse}
        </pre>
      </div>

      {/* Setup Instructions */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm font-medium mb-2">Zapier Setup Instructions:</p>
        <ol className="text-sm space-y-1 list-decimal list-inside">
          <li>
            Go to{' '}
            <a
              href="https://zapier.com/app/editor"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Zapier Editor
              <ExternalLink className="w-3 h-3" />
            </a>
          </li>
          <li>Create a new Zap with your trigger (Gmail, Typeform, etc.)</li>
          <li>Add a "Webhooks by Zapier" action (choose "POST")</li>
          <li>Paste the webhook URL above</li>
          <li>Set payload type to "JSON" and add the message field</li>
          <li>Map your trigger data to the "message" field</li>
          <li>Test and turn on the Zap</li>
        </ol>
      </div>

      {/* Use Cases */}
      <div className="p-4 border rounded-lg bg-card">
        <h4 className="text-sm font-medium mb-3">Common Use Cases</h4>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div>
            <strong>Gmail + Chatbot:</strong> Auto-respond to incoming emails using AI
          </div>
          <div>
            <strong>Typeform + Chatbot:</strong> Process form submissions and generate responses
          </div>
          <div>
            <strong>Slack + Chatbot:</strong> Forward Slack messages for AI analysis
          </div>
          <div>
            <strong>Calendar + Chatbot:</strong> Generate meeting summaries
          </div>
        </div>
      </div>
    </div>
  );
}
