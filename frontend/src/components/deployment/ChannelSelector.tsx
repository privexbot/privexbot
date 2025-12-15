/**
 * ChannelSelector - Select deployment channels
 *
 * WHY:
 * - Multi-channel deployment
 * - Visual channel selection
 * - Channel availability status
 *
 * HOW:
 * - Grid of channel cards
 * - Toggle selection
 * - Credential checks
 */

import { Globe, MessageSquare, Zap, Users } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

export type DeploymentChannel = 'website' | 'telegram' | 'discord' | 'whatsapp' | 'zapier';

interface Channel {
  id: DeploymentChannel;
  name: string;
  description: string;
  icon: React.ReactNode;
  requiresCredential: boolean;
  isAvailable: boolean;
  isPremium?: boolean;
}

interface ChannelSelectorProps {
  selectedChannels: DeploymentChannel[];
  availableChannels?: DeploymentChannel[];
  onChange: (channels: DeploymentChannel[]) => void;
}

export default function ChannelSelector({
  selectedChannels,
  availableChannels = ['website', 'telegram', 'discord', 'whatsapp', 'zapier'],
  onChange,
}: ChannelSelectorProps) {
  const channels: Channel[] = [
    {
      id: 'website',
      name: 'Website Widget',
      description: 'Embed chatbot on your website',
      icon: <Globe className="w-6 h-6" />,
      requiresCredential: false,
      isAvailable: true,
    },
    {
      id: 'telegram',
      name: 'Telegram',
      description: 'Deploy as Telegram bot',
      icon: <MessageSquare className="w-6 h-6" />,
      requiresCredential: true,
      isAvailable: availableChannels.includes('telegram'),
    },
    {
      id: 'discord',
      name: 'Discord',
      description: 'Deploy to Discord server',
      icon: <Users className="w-6 h-6" />,
      requiresCredential: true,
      isAvailable: availableChannels.includes('discord'),
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Business',
      description: 'Connect to WhatsApp Business',
      icon: <MessageSquare className="w-6 h-6" />,
      requiresCredential: true,
      isAvailable: availableChannels.includes('whatsapp'),
      isPremium: true,
    },
    {
      id: 'zapier',
      name: 'Zapier Webhook',
      description: 'Integrate with Zapier workflows',
      icon: <Zap className="w-6 h-6" />,
      requiresCredential: false,
      isAvailable: true,
    },
  ];

  const toggleChannel = (channelId: DeploymentChannel) => {
    const channel = channels.find((c) => c.id === channelId);
    if (!channel?.isAvailable) return;

    if (selectedChannels.includes(channelId)) {
      onChange(selectedChannels.filter((c) => c !== channelId));
    } else {
      onChange([...selectedChannels, channelId]);
    }
  };

  const selectAll = () => {
    const allAvailable = channels.filter((c) => c.isAvailable).map((c) => c.id);
    onChange(allAvailable);
  };

  const deselectAll = () => {
    onChange([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Select Deployment Channels</h3>
        <p className="text-sm text-muted-foreground">
          Choose where you want to deploy your chatbot
        </p>
      </div>

      {/* Select Controls */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={selectAll}
          className="text-primary hover:underline"
        >
          Select All
        </button>
        <span className="text-muted-foreground">•</span>
        <button
          onClick={deselectAll}
          className="text-primary hover:underline"
        >
          Deselect All
        </button>
        {selectedChannels.length > 0 && (
          <span className="text-muted-foreground ml-2">
            ({selectedChannels.length} selected)
          </span>
        )}
      </div>

      {/* Channel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {channels.map((channel) => {
          const isSelected = selectedChannels.includes(channel.id);

          return (
            <button
              key={channel.id}
              onClick={() => toggleChannel(channel.id)}
              disabled={!channel.isAvailable}
              className={`relative p-6 border rounded-lg text-left transition-all ${
                !channel.isAvailable
                  ? 'opacity-50 cursor-not-allowed'
                  : isSelected
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'hover:border-primary/50 hover:shadow-sm'
              }`}
            >
              {/* Checkbox */}
              <div className="absolute top-4 right-4">
                <Checkbox
                  checked={isSelected}
                  disabled={!channel.isAvailable}
                  onCheckedChange={() => toggleChannel(channel.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Content */}
              <div className="flex items-start gap-4 pr-8">
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-primary/10 text-primary'
                  }`}
                >
                  {channel.icon}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{channel.name}</h4>
                    {channel.isPremium && (
                      <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full">
                        Premium
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {channel.description}
                  </p>

                  {channel.requiresCredential && !channel.isAvailable && (
                    <p className="text-xs text-destructive mt-2">
                      ⚠️ Requires configuration
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Info */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm">
          💡 <strong>Tip:</strong> You can deploy to multiple channels simultaneously. Each channel
          will have its own configuration and analytics.
        </p>
      </div>
    </div>
  );
}
