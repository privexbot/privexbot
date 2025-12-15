/**
 * WhatsAppConfig - WhatsApp Business configuration
 *
 * WHY:
 * - Deploy to WhatsApp Business
 * - Business profile setup
 * - Message templates
 *
 * HOW:
 * - Phone number ID input
 * - Access token management
 * - Template configuration
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MessageSquare, ExternalLink, Loader2, CheckCircle, AlertCircle, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import apiClient, { handleApiError } from '@/lib/api-client';

interface WhatsAppConfig {
  enabled: boolean;
  phone_number_id?: string;
  access_token?: string;
  business_account_id?: string;
  welcome_message?: string;
  enable_media_messages: boolean;
  enable_quick_replies: boolean;
}

interface WhatsAppConfigProps {
  chatbotId: string;
  config: WhatsAppConfig;
  onChange: (config: WhatsAppConfig) => void;
}

export default function WhatsAppConfig({ chatbotId, config, onChange }: WhatsAppConfigProps) {
  const { toast } = useToast();
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/deployments/${chatbotId}/whatsapp/test`, {
        phone_number_id: config.phone_number_id,
        access_token: config.access_token,
      });
      return response.data;
    },
    onMutate: () => {
      setTestStatus('testing');
    },
    onSuccess: (data) => {
      setTestStatus('success');
      onChange({ ...config, business_account_id: data.business_account_id });
      toast({
        title: 'Connection successful',
        description: `Connected to WhatsApp Business`,
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

  const updateConfig = (updates: Partial<WhatsAppConfig>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-5 h-5" />
          <h3 className="text-lg font-semibold">WhatsApp Business Configuration</h3>
          <Crown className="w-5 h-5 text-yellow-500" />
          <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full">
            Premium
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Deploy your chatbot to WhatsApp Business API
        </p>
      </div>

      {/* Premium Notice */}
      <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div className="flex items-start gap-2">
          <Crown className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-200">Premium Feature</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              WhatsApp Business API integration requires a premium plan and approved Meta Business
              account.
            </p>
          </div>
        </div>
      </div>

      {/* Phone Number ID */}
      <div>
        <Label htmlFor="phone-id">Phone Number ID *</Label>
        <Input
          id="phone-id"
          value={config.phone_number_id || ''}
          onChange={(e) => updateConfig({ phone_number_id: e.target.value })}
          placeholder="123456789012345"
          className="mt-2 font-mono"
        />
        <p className="text-xs text-muted-foreground mt-1">
          From Meta Business Manager → WhatsApp → API Setup
        </p>
      </div>

      {/* Access Token */}
      <div>
        <Label htmlFor="access-token">Access Token *</Label>
        <div className="flex gap-2 mt-2">
          <Input
            id="access-token"
            type="password"
            value={config.access_token || ''}
            onChange={(e) => updateConfig({ access_token: e.target.value })}
            placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="flex-1 font-mono text-xs"
          />
          <Button
            onClick={() => testMutation.mutate()}
            disabled={
              !config.phone_number_id ||
              !config.access_token ||
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
        <p className="text-xs text-muted-foreground mt-1">
          System user access token from Meta Business Manager
        </p>
      </div>

      {/* Business Account ID (read-only) */}
      {config.business_account_id && (
        <div>
          <Label>Business Account ID</Label>
          <Input
            value={config.business_account_id}
            readOnly
            className="mt-2 font-mono"
          />
        </div>
      )}

      {/* Welcome Message */}
      <div>
        <Label htmlFor="welcome">Welcome Message (Optional)</Label>
        <Textarea
          id="welcome"
          value={config.welcome_message || ''}
          onChange={(e) => updateConfig({ welcome_message: e.target.value })}
          placeholder="Hello! Welcome to our WhatsApp chatbot. How can I help you?"
          className="mt-2"
          rows={3}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Sent when users first message your business
        </p>
      </div>

      {/* Media Messages */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div>
          <Label htmlFor="media">Enable Media Messages</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Send images, videos, and documents
          </p>
        </div>
        <Switch
          id="media"
          checked={config.enable_media_messages}
          onCheckedChange={(checked) => updateConfig({ enable_media_messages: checked })}
        />
      </div>

      {/* Quick Replies */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div>
          <Label htmlFor="quick-replies">Enable Quick Replies</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Show quick reply buttons for common responses
          </p>
        </div>
        <Switch
          id="quick-replies"
          checked={config.enable_quick_replies}
          onCheckedChange={(checked) => updateConfig({ enable_quick_replies: checked })}
        />
      </div>

      {/* Setup Instructions */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm font-medium mb-2">📱 Setup Instructions:</p>
        <ol className="text-sm space-y-1 list-decimal list-inside">
          <li>
            Apply for WhatsApp Business API access at{' '}
            <a
              href="https://business.facebook.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Meta Business Manager
            </a>
          </li>
          <li>Get your application approved (may take several days)</li>
          <li>Set up a phone number in WhatsApp Manager</li>
          <li>Create a system user and generate access token</li>
          <li>Copy Phone Number ID and Access Token above</li>
          <li>Click "Test" to verify connection</li>
        </ol>
      </div>

      {/* Requirements */}
      <div className="p-4 border rounded-lg bg-card">
        <h4 className="text-sm font-medium mb-3">Requirements</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5" />
            <div>
              <p className="font-medium">Verified Meta Business Account</p>
              <p className="text-muted-foreground">
                Your business must be verified by Meta
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5" />
            <div>
              <p className="font-medium">Approved WhatsApp Business API Access</p>
              <p className="text-muted-foreground">
                Application review can take 5-7 business days
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5" />
            <div>
              <p className="font-medium">Dedicated Phone Number</p>
              <p className="text-muted-foreground">
                Cannot use personal WhatsApp numbers
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5" />
            <div>
              <p className="font-medium">Message Template Approval</p>
              <p className="text-muted-foreground">
                Initial messages must use approved templates
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Notice */}
      <div className="p-4 border rounded-lg bg-card">
        <h4 className="text-sm font-medium mb-2">💰 Pricing</h4>
        <p className="text-sm text-muted-foreground">
          WhatsApp charges per conversation (24-hour window):
        </p>
        <ul className="text-sm space-y-1 mt-2 list-disc list-inside text-muted-foreground">
          <li>User-initiated: Free for first 1,000/month</li>
          <li>Business-initiated: Varies by country (~$0.005-$0.10)</li>
          <li>Check latest pricing in Meta Business Manager</li>
        </ul>
      </div>
    </div>
  );
}
