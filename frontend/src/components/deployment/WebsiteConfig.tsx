/**
 * WebsiteConfig - Website widget configuration
 *
 * WHY:
 * - Customize widget appearance
 * - Generate embed code
 * - Domain restrictions
 *
 * HOW:
 * - Position selector
 * - Color picker
 * - Domain management
 */

import { useState } from 'react';
import { Globe, Copy, Check, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface WebsiteConfig {
  enabled: boolean;
  widget_position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  widget_color: string;
  allowed_domains: string[];
  greeting_message?: string;
}

interface WebsiteConfigProps {
  chatbotId: string;
  config: WebsiteConfig;
  onChange: (config: WebsiteConfig) => void;
}

export default function WebsiteConfig({ chatbotId, config, onChange }: WebsiteConfigProps) {
  const { toast } = useToast();
  const [domainInput, setDomainInput] = useState('');
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const positions: Array<{
    value: WebsiteConfig['widget_position'];
    label: string;
  }> = [
    { value: 'bottom-right', label: 'Bottom Right' },
    { value: 'bottom-left', label: 'Bottom Left' },
    { value: 'top-right', label: 'Top Right' },
    { value: 'top-left', label: 'Top Left' },
  ];

  const updateConfig = (updates: Partial<WebsiteConfig>) => {
    onChange({ ...config, ...updates });
  };

  const addDomain = () => {
    if (domainInput.trim() && !config.allowed_domains.includes(domainInput.trim())) {
      updateConfig({
        allowed_domains: [...config.allowed_domains, domainInput.trim()],
      });
      setDomainInput('');
    }
  };

  const removeDomain = (domain: string) => {
    updateConfig({
      allowed_domains: config.allowed_domains.filter((d) => d !== domain),
    });
  };

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

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(embedCode);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
    toast({ title: 'Embed code copied to clipboard' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Website Widget Configuration
        </h3>
        <p className="text-sm text-muted-foreground">
          Customize and embed your chatbot on your website
        </p>
      </div>

      {/* Widget Position */}
      <div>
        <Label>Widget Position</Label>
        <div className="grid grid-cols-2 gap-3 mt-2">
          {positions.map((pos) => (
            <Button
              key={pos.value}
              variant={config.widget_position === pos.value ? 'default' : 'outline'}
              onClick={() => updateConfig({ widget_position: pos.value })}
              className="h-auto py-3"
            >
              {pos.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Widget Color */}
      <div>
        <Label htmlFor="widget-color">Widget Color</Label>
        <div className="flex items-center gap-3 mt-2">
          <input
            id="widget-color"
            type="color"
            value={config.widget_color}
            onChange={(e) => updateConfig({ widget_color: e.target.value })}
            className="w-20 h-12 rounded cursor-pointer"
          />
          <Input
            value={config.widget_color}
            onChange={(e) => updateConfig({ widget_color: e.target.value })}
            placeholder="#6366f1"
            className="flex-1 font-mono"
          />
        </div>
      </div>

      {/* Greeting Message */}
      <div>
        <Label htmlFor="greeting">Greeting Message (Optional)</Label>
        <Input
          id="greeting"
          value={config.greeting_message || ''}
          onChange={(e) => updateConfig({ greeting_message: e.target.value })}
          placeholder="Hi! How can I help you today?"
          className="mt-2"
        />
        <p className="text-xs text-muted-foreground mt-1">
          First message shown when widget opens
        </p>
      </div>

      {/* Allowed Domains */}
      <div>
        <Label>Allowed Domains</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Restrict widget to specific domains (use * to allow all)
        </p>

        <div className="flex gap-2 mb-3">
          <Input
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="example.com or *"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDomain())}
          />
          <Button onClick={addDomain} disabled={!domainInput.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {config.allowed_domains.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {config.allowed_domains.map((domain) => (
              <div
                key={domain}
                className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
              >
                {domain}
                <button
                  onClick={() => removeDomain(domain)}
                  className="hover:text-primary/70"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Embed Code */}
      <div>
        <Label>Embed Code</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Copy and paste this code before the closing &lt;/body&gt; tag on your website
        </p>

        <div className="relative">
          <Textarea
            value={embedCode}
            readOnly
            className="font-mono text-xs h-40 pr-12"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={copyEmbedCode}
            className="absolute top-2 right-2"
          >
            {copiedEmbed ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="p-4 border rounded-lg bg-card">
        <h4 className="text-sm font-medium mb-3">Widget Preview</h4>
        <div className="relative h-64 bg-muted/30 rounded-lg overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <p className="text-sm">Widget will appear in {positions.find(p => p.value === config.widget_position)?.label}</p>
          </div>

          {/* Preview bubble */}
          <div
            className={`absolute ${
              config.widget_position === 'bottom-right' ? 'bottom-4 right-4' :
              config.widget_position === 'bottom-left' ? 'bottom-4 left-4' :
              config.widget_position === 'top-right' ? 'top-4 right-4' :
              'top-4 left-4'
            }`}
          >
            <div
              className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
              style={{ backgroundColor: config.widget_color }}
            >
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm">
          💡 <strong>Installation Tips:</strong>
        </p>
        <ul className="text-sm space-y-1 mt-2 list-disc list-inside">
          <li>Place the code just before &lt;/body&gt; tag</li>
          <li>Widget loads asynchronously (won't slow down your site)</li>
          <li>Works with all modern browsers</li>
          <li>Mobile responsive by default</li>
        </ul>
      </div>
    </div>
  );
}

// Import for preview
import { MessageSquare } from 'lucide-react';
