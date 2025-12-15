/**
 * Deployments - Multi-channel deployment configuration
 *
 * WHY:
 * - Configure deployment channels
 * - Website embed code
 * - Telegram/WhatsApp/Discord setup
 * - Zapier webhook integration
 *
 * HOW:
 * - Channel configuration forms
 * - Embed code generator
 * - Webhook URLs
 * - Test deployment
 *
 * DEPENDENCIES:
 * - @tanstack/react-query
 * - react-hook-form
 * - zod
 * - lucide-react
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Rocket,
  Globe,
  Copy,
  Check,
  Settings,
  ExternalLink,
  MessageSquare,
  Zap,
  Code,
  Smartphone,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useWorkspaceStore } from '@/store/workspace-store';
import apiClient, { handleApiError } from '@/lib/api-client';

const deploymentSchema = z.object({
  website_enabled: z.boolean().default(false),
  allowed_domains: z.array(z.string()).default([]),
  widget_position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).default('bottom-right'),
  widget_color: z.string().default('#6366f1'),
  telegram_enabled: z.boolean().default(false),
  telegram_bot_token: z.string().optional(),
  whatsapp_enabled: z.boolean().default(false),
  whatsapp_phone_id: z.string().optional(),
  discord_enabled: z.boolean().default(false),
  discord_bot_token: z.string().optional(),
  zapier_enabled: z.boolean().default(false),
});

type DeploymentFormData = z.infer<typeof deploymentSchema>;

export default function Deployments() {
  const { chatbotId } = useParams<{ chatbotId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspaceStore();

  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [domainInput, setDomainInput] = useState('');

  // Form
  const { register, watch, setValue, handleSubmit } = useForm<DeploymentFormData>({
    resolver: zodResolver(deploymentSchema),
    defaultValues: {
      website_enabled: false,
      allowed_domains: [],
      widget_position: 'bottom-right',
      widget_color: '#6366f1',
    },
  });

  const formData = watch();

  // Fetch deployment config
  const { data: deployment, isLoading } = useQuery({
    queryKey: ['deployment', chatbotId],
    queryFn: async () => {
      const response = await apiClient.get(`/deployments/${chatbotId}`);
      return response.data;
    },
    enabled: !!chatbotId,
  });

  // Load deployment data into form
  useState(() => {
    if (deployment) {
      Object.entries(deployment).forEach(([key, value]) => {
        setValue(key as any, value);
      });
    }
  });

  // Update deployment mutation
  const updateMutation = useMutation({
    mutationFn: async (data: DeploymentFormData) => {
      const response = await apiClient.patch(`/deployments/${chatbotId}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Deployment settings updated' });
      queryClient.invalidateQueries({ queryKey: ['deployment'] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to update',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: DeploymentFormData) => {
    updateMutation.mutate(data);
  };

  // Generate embed code
  const embedCode = `<!-- PrivexBot Widget -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['PrivexBot']=o;w[o] = w[o] || function () { (w[o].q = w[o].q || []).push(arguments) };
    js = d.createElement(s), fjs = d.getElementsByTagName(s)[0];
    js.id = o; js.src = f; js.async = 1; fjs.parentNode.insertBefore(js, fjs);
  }(window, document, 'script', 'pb', '${import.meta.env.VITE_API_BASE_URL}/widget.js'));
  pb('init', '${chatbotId}', {
    position: '${formData.widget_position}',
    color: '${formData.widget_color}'
  });
</script>`;

  const webhookUrl = `${import.meta.env.VITE_API_BASE_URL}/webhooks/zapier/${chatbotId}`;

  const copyToClipboard = (text: string, type: 'embed' | 'webhook') => {
    navigator.clipboard.writeText(text);
    if (type === 'embed') {
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
    } else {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    }
    toast({ title: 'Copied to clipboard' });
  };

  const addDomain = () => {
    if (domainInput && !formData.allowed_domains.includes(domainInput)) {
      setValue('allowed_domains', [...formData.allowed_domains, domainInput]);
      setDomainInput('');
    }
  };

  const removeDomain = (domain: string) => {
    setValue(
      'allowed_domains',
      formData.allowed_domains.filter((d) => d !== domain)
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading deployment settings...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Rocket className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Deployment Settings</h1>
            <p className="text-muted-foreground">Configure multi-channel deployment</p>
          </div>
        </div>

        <Button onClick={handleSubmit(onSubmit)} disabled={updateMutation.isPending} size="lg">
          {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="website">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="website">
            <Globe className="w-4 h-4 mr-2" />
            Website
          </TabsTrigger>
          <TabsTrigger value="telegram">
            <MessageSquare className="w-4 h-4 mr-2" />
            Telegram
          </TabsTrigger>
          <TabsTrigger value="whatsapp">
            <Smartphone className="w-4 h-4 mr-2" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="discord">
            <MessageSquare className="w-4 h-4 mr-2" />
            Discord
          </TabsTrigger>
          <TabsTrigger value="zapier">
            <Zap className="w-4 h-4 mr-2" />
            Zapier
          </TabsTrigger>
        </TabsList>

        {/* Website Tab */}
        <TabsContent value="website" className="space-y-6 mt-6">
          <div className="bg-card p-6 rounded-lg border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Website Widget</h3>
              <Switch
                checked={formData.website_enabled}
                onCheckedChange={(checked) => setValue('website_enabled', checked)}
              />
            </div>

            {formData.website_enabled && (
              <div className="space-y-4">
                <div>
                  <Label>Widget Position</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {(['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const).map((pos) => (
                      <Button
                        key={pos}
                        variant={formData.widget_position === pos ? 'default' : 'outline'}
                        onClick={() => setValue('widget_position', pos)}
                      >
                        {pos.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="widget-color">Widget Color</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Input
                      id="widget-color"
                      type="color"
                      {...register('widget_color')}
                      className="w-20 h-10"
                    />
                    <Input value={formData.widget_color} {...register('widget_color')} className="flex-1" />
                  </div>
                </div>

                <div>
                  <Label>Allowed Domains</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Add domains where the widget can be embedded (use * for all)
                  </p>
                  <div className="flex gap-2 mb-3">
                    <Input
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      placeholder="example.com"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDomain())}
                    />
                    <Button onClick={addDomain}>Add</Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {formData.allowed_domains.map((domain) => (
                      <div
                        key={domain}
                        className="inline-flex items-center gap-2 px-3 py-1 bg-muted rounded-full text-sm"
                      >
                        {domain}
                        <button
                          onClick={() => removeDomain(domain)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Embed Code</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Copy and paste this code before the closing &lt;/body&gt; tag
                  </p>
                  <div className="relative">
                    <Textarea
                      value={embedCode}
                      readOnly
                      className="font-mono text-xs h-32"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(embedCode, 'embed')}
                    >
                      {copiedEmbed ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Telegram Tab */}
        <TabsContent value="telegram" className="space-y-6 mt-6">
          <div className="bg-card p-6 rounded-lg border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Telegram Bot</h3>
              <Switch
                checked={formData.telegram_enabled}
                onCheckedChange={(checked) => setValue('telegram_enabled', checked)}
              />
            </div>

            {formData.telegram_enabled && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="telegram-token">Bot Token</Label>
                  <Input
                    id="telegram-token"
                    type="password"
                    {...register('telegram_bot_token')}
                    placeholder="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    className="mt-2 font-mono"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
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

                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <h4 className="font-medium mb-2">Setup Instructions:</h4>
                  <ol className="text-sm space-y-1 list-decimal list-inside">
                    <li>Create a bot with @BotFather on Telegram</li>
                    <li>Copy the bot token and paste it above</li>
                    <li>Save settings to activate the bot</li>
                    <li>Users can now chat with your bot on Telegram</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp" className="space-y-6 mt-6">
          <div className="bg-card p-6 rounded-lg border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">WhatsApp Business</h3>
              <Switch
                checked={formData.whatsapp_enabled}
                onCheckedChange={(checked) => setValue('whatsapp_enabled', checked)}
              />
            </div>

            {formData.whatsapp_enabled && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="whatsapp-phone">Phone Number ID</Label>
                  <Input
                    id="whatsapp-phone"
                    {...register('whatsapp_phone_id')}
                    placeholder="123456789012345"
                    className="mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    From{' '}
                    <a
                      href="https://business.facebook.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Meta Business Manager
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                </div>

                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <h4 className="font-medium mb-2">Requirements:</h4>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>WhatsApp Business Account</li>
                    <li>Verified Meta Business Manager account</li>
                    <li>Approved WhatsApp Business API access</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Discord Tab */}
        <TabsContent value="discord" className="space-y-6 mt-6">
          <div className="bg-card p-6 rounded-lg border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Discord Bot</h3>
              <Switch
                checked={formData.discord_enabled}
                onCheckedChange={(checked) => setValue('discord_enabled', checked)}
              />
            </div>

            {formData.discord_enabled && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="discord-token">Bot Token</Label>
                  <Input
                    id="discord-token"
                    type="password"
                    {...register('discord_bot_token')}
                    placeholder="MTk4NjIyNDgzNDcxOTI1MjQ4.Cl2FMQ.ZnCjm1XVW7vRze4b7Cq4se7kKWs"
                    className="mt-2 font-mono"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
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

                <div className="p-4 bg-indigo-50 dark:bg-indigo-950 rounded-lg">
                  <h4 className="font-medium mb-2">Setup Instructions:</h4>
                  <ol className="text-sm space-y-1 list-decimal list-inside">
                    <li>Create an application in Discord Developer Portal</li>
                    <li>Add a bot to your application</li>
                    <li>Copy the bot token and paste it above</li>
                    <li>Invite the bot to your Discord server</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Zapier Tab */}
        <TabsContent value="zapier" className="space-y-6 mt-6">
          <div className="bg-card p-6 rounded-lg border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Zapier Integration</h3>
              <Switch
                checked={formData.zapier_enabled}
                onCheckedChange={(checked) => setValue('zapier_enabled', checked)}
              />
            </div>

            {formData.zapier_enabled && (
              <div className="space-y-4">
                <div>
                  <Label>Webhook URL</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Use this URL in your Zapier webhook trigger
                  </p>
                  <div className="relative">
                    <Input value={webhookUrl} readOnly className="pr-12 font-mono" />
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute top-1 right-1"
                      onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                    >
                      {copiedWebhook ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <h4 className="font-medium mb-2">How to Use:</h4>
                  <ol className="text-sm space-y-1 list-decimal list-inside">
                    <li>Create a new Zap in Zapier</li>
                    <li>Choose "Webhooks by Zapier" as the trigger</li>
                    <li>Select "Catch Hook" and paste the webhook URL above</li>
                    <li>Set up your action (e.g., add to Google Sheets, send email)</li>
                    <li>Test and activate your Zap</li>
                  </ol>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Webhook Payload Format
                  </h4>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`{
  "chatbot_id": "${chatbotId}",
  "user_id": "user_123",
  "message": "User question",
  "response": "Bot response",
  "timestamp": "2024-01-15T10:30:00Z",
  "metadata": {}
}`}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
