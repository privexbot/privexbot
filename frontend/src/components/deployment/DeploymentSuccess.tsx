/**
 * DeploymentSuccess - Success page after deployment
 *
 * WHY:
 * - Confirm successful deployment
 * - Provide embed codes and links
 * - Guide next steps
 *
 * HOW:
 * - Channel-specific instructions
 * - Copy-to-clipboard functionality
 * - Quick links to deployments
 */

import { useState } from 'react';
import { CheckCircle, Copy, Check, Globe, MessageSquare, Users, Zap, ExternalLink, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export type DeploymentChannel = 'website' | 'telegram' | 'discord' | 'whatsapp' | 'zapier';

interface DeploymentInfo {
  channel: DeploymentChannel;
  config: any;
}

interface DeploymentSuccessProps {
  chatbotId: string;
  chatbotName: string;
  deployments: DeploymentInfo[];
  onViewAnalytics?: () => void;
  onCreateAnother?: () => void;
}

export default function DeploymentSuccess({
  chatbotId,
  chatbotName,
  deployments,
  onViewAnalytics,
  onCreateAnother,
}: DeploymentSuccessProps) {
  const { toast } = useToast();
  const [copiedItems, setCopiedItems] = useState<Record<string, boolean>>({});

  const copyToClipboard = (text: string, itemId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItems({ ...copiedItems, [itemId]: true });
    setTimeout(() => {
      setCopiedItems({ ...copiedItems, [itemId]: false });
    }, 2000);
    toast({ title: 'Copied to clipboard' });
  };

  const getChannelIcon = (channel: DeploymentChannel) => {
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
    }
  };

  const getChannelName = (channel: DeploymentChannel) => {
    return channel.charAt(0).toUpperCase() + channel.slice(1);
  };

  const renderWebsiteDeployment = (config: any) => {
    const embedCode = `<!-- PrivexBot Widget -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['PrivexBot']=o;w[o] = w[o] || function () { (w[o].q = w[o].q || []).push(arguments) };
    js = d.createElement(s), fjs = d.getElementsByTagName(s)[0];
    js.id = o; js.src = f; js.async = 1; fjs.parentNode.insertBefore(js, fjs);
  }(window, document, 'script', 'pb', '${import.meta.env.VITE_API_BASE_URL}/widget.js'));
  pb('init', '${chatbotId}', {
    position: '${config.widget_position}',
    color: '${config.widget_color}',
    greeting: ${config.greeting_message ? `'${config.greeting_message}'` : 'undefined'}
  });
</script>`;

    return (
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium mb-2">Embed Code</p>
          <div className="relative">
            <Textarea
              value={embedCode}
              readOnly
              className="font-mono text-xs h-40 pr-12"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(embedCode, 'website-embed')}
              className="absolute top-2 right-2"
            >
              {copiedItems['website-embed'] ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          📋 Paste this code before the closing &lt;/body&gt; tag on your website
        </p>
      </div>
    );
  };

  const renderTelegramDeployment = (config: any) => {
    const botUrl = config.bot_username ? `https://t.me/${config.bot_username}` : null;

    return (
      <div className="space-y-3">
        {config.bot_username && (
          <div>
            <p className="text-sm font-medium mb-2">Bot Username</p>
            <div className="flex gap-2">
              <Input value={`@${config.bot_username}`} readOnly className="flex-1" />
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
        <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm">
            ✅ Your bot is live! Users can start chatting by searching for{' '}
            <span className="font-mono font-medium">@{config.bot_username}</span> on Telegram
          </p>
        </div>
      </div>
    );
  };

  const renderDiscordDeployment = (config: any) => {
    const inviteUrl = config.client_id
      ? `https://discord.com/api/oauth2/authorize?client_id=${config.client_id}&permissions=2147483648&scope=bot%20applications.commands`
      : null;

    return (
      <div className="space-y-3">
        {inviteUrl && (
          <div>
            <p className="text-sm font-medium mb-2">Bot Invite URL</p>
            <div className="flex gap-2">
              <Input value={inviteUrl} readOnly className="flex-1 font-mono text-xs" />
              <Button
                variant="outline"
                onClick={() => copyToClipboard(inviteUrl, 'discord-invite')}
              >
                {copiedItems['discord-invite'] ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
              <Button variant="outline" asChild>
                <a href={inviteUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            </div>
          </div>
        )}
        <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm">
            ✅ Share the invite URL above to add your bot to Discord servers
          </p>
        </div>
      </div>
    );
  };

  const renderWhatsAppDeployment = (config: any) => {
    return (
      <div className="space-y-3">
        {config.phone_number_id && (
          <div>
            <p className="text-sm font-medium mb-2">Phone Number ID</p>
            <Input value={config.phone_number_id} readOnly className="font-mono" />
          </div>
        )}
        <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm">
            ✅ Your WhatsApp Business bot is configured and ready to receive messages
          </p>
        </div>
      </div>
    );
  };

  const renderZapierDeployment = (config: any) => {
    const webhookUrl = `${import.meta.env.VITE_API_BASE_URL}/webhooks/zapier/${chatbotId}`;

    return (
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium mb-2">Webhook URL</p>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="flex-1 font-mono text-xs" />
            <Button
              variant="outline"
              onClick={() => copyToClipboard(webhookUrl, 'zapier-webhook')}
            >
              {copiedItems['zapier-webhook'] ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        {config.webhook_secret && (
          <div>
            <p className="text-sm font-medium mb-2">Webhook Secret</p>
            <div className="flex gap-2">
              <Input
                value={config.webhook_secret}
                readOnly
                type="password"
                className="flex-1 font-mono text-xs"
              />
              <Button
                variant="outline"
                onClick={() => copyToClipboard(config.webhook_secret, 'zapier-secret')}
              >
                {copiedItems['zapier-secret'] ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        )}
        <div className="p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
          <p className="text-sm">
            ✅ Use this webhook URL in your Zapier "Catch Hook" trigger to start automating
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center py-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full mb-4">
          <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Deployment Successful! 🎉</h2>
        <p className="text-muted-foreground">
          {chatbotName} is now live on {deployments.length}{' '}
          {deployments.length === 1 ? 'channel' : 'channels'}
        </p>
      </div>

      {/* Deployment Details */}
      <div className="space-y-4">
        {deployments.map((deployment) => (
          <div key={deployment.channel} className="border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                {getChannelIcon(deployment.channel)}
              </div>
              <h3 className="text-lg font-semibold">{getChannelName(deployment.channel)}</h3>
            </div>

            {deployment.channel === 'website' && renderWebsiteDeployment(deployment.config)}
            {deployment.channel === 'telegram' && renderTelegramDeployment(deployment.config)}
            {deployment.channel === 'discord' && renderDiscordDeployment(deployment.config)}
            {deployment.channel === 'whatsapp' && renderWhatsAppDeployment(deployment.config)}
            {deployment.channel === 'zapier' && renderZapierDeployment(deployment.config)}
          </div>
        ))}
      </div>

      {/* Next Steps */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h4 className="text-sm font-medium mb-3">🚀 Next Steps</h4>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span>Test your chatbot by sending messages on each deployed channel</span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span>Monitor conversations and analytics from your dashboard</span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span>Update your knowledge base to improve response accuracy</span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span>Configure lead capture and integrations to automate workflows</span>
          </li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {onViewAnalytics && (
          <Button onClick={onViewAnalytics} className="flex-1">
            View Analytics
          </Button>
        )}
        {onCreateAnother && (
          <Button onClick={onCreateAnother} variant="outline" className="flex-1">
            Create Another Chatbot
          </Button>
        )}
      </div>

      {/* Support */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          Need help?{' '}
          <a href="#" className="text-primary hover:underline">
            Contact Support
          </a>{' '}
          or{' '}
          <a href="#" className="text-primary hover:underline">
            View Documentation
          </a>
        </p>
      </div>
    </div>
  );
}
