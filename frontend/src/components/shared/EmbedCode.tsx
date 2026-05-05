/**
 * EmbedCode - Generate embed code for chatbot/chatflow
 *
 * WHY:
 * - Reusable embed code generator
 * - Works for both chatbot and chatflow
 * - Copy-to-clipboard functionality
 *
 * HOW:
 * - Generate script based on type
 * - Syntax highlighting
 * - Customizable options
 */

import { useState } from 'react';
import { Copy, Check, Download, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { generateEmbedCode, type EmbedCodeOptions } from '@/lib/embed-code';

type EmbedType = 'chatbot' | 'chatflow';

interface EmbedCodeProps {
  type: EmbedType;
  id: string;
  options?: EmbedCodeOptions;
  /**
   * Real API key for the embed snippet, if the caller has it. The chatbot /
   * chatflow detail pages typically only have the truncated `key_prefix`, so
   * they leave this undefined and the snippet renders with `'YOUR_API_KEY'`
   * as a placeholder for the customer to swap. Right after deploy, the
   * success modal does have the real key — pass it through here.
   */
  apiKey?: string;
  onOptionsChange?: (options: EmbedCodeOptions) => void;
  showOptions?: boolean;
}

export default function EmbedCode({
  type,
  id,
  options = {},
  apiKey,
  onOptionsChange,
  showOptions = true,
}: EmbedCodeProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const defaultOptions: EmbedCodeOptions = {
    position: 'bottom-right',
    color: '#6366f1',
    width: 400,
    height: 600,
    showBranding: true,
    ...options,
  };

  // Single source of truth — `lib/embed-code.ts:generateEmbedCode`. Removed
  // the inline generator that previously lived here; it had drifted from
  // the lib version (different field set, no apiKey support).
  const embedCode = generateEmbedCode({
    botId: id,
    apiKey,
    includeApiKey: !!apiKey,
    type,
    options: defaultOptions,
  });

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Embed code copied to clipboard' });
  };

  const downloadAsFile = () => {
    const blob = new Blob([embedCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `privexbot-${type}-${id}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Embed code downloaded' });
  };

  const updateOptions = (updates: Partial<EmbedCodeOptions>) => {
    const newOptions = { ...defaultOptions, ...updates };
    onOptionsChange?.(newOptions);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Code className="w-4 h-4" />
          Embed Code
        </Label>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={downloadAsFile}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          <Button size="sm" onClick={copyToClipboard}>
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy Code
              </>
            )}
          </Button>
        </div>
      </div>

      <Textarea
        value={embedCode}
        readOnly
        className="font-mono text-xs h-40 sm:h-48 resize-none"
      />

      {showOptions && (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <h4 className="text-sm font-medium">Widget Options</h4>

          {/* Position */}
          <div>
            <Label className="text-xs">Position</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {(['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const).map(
                (pos) => (
                  <Button
                    key={pos}
                    size="sm"
                    variant={defaultOptions.position === pos ? 'default' : 'outline'}
                    onClick={() => updateOptions({ position: pos })}
                  >
                    {pos
                      .split('-')
                      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(' ')}
                  </Button>
                )
              )}
            </div>
          </div>

          {/* Color */}
          <div>
            <Label className="text-xs">Primary Color</Label>
            <div className="flex items-center gap-3 mt-2">
              <input
                type="color"
                value={defaultOptions.color}
                onChange={(e) => updateOptions({ color: e.target.value })}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={defaultOptions.color}
                onChange={(e) => updateOptions({ color: e.target.value })}
                className="flex-1 px-3 py-2 text-sm border rounded-md font-mono"
                placeholder="#6366f1"
              />
            </div>
          </div>

          {/* Dimensions */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Width (px)</Label>
              <input
                type="number"
                value={defaultOptions.width}
                onChange={(e) => updateOptions({ width: parseInt(e.target.value) || 400 })}
                className="w-full px-3 py-2 text-sm border rounded-md mt-2"
                min="300"
                max="600"
              />
            </div>
            <div>
              <Label className="text-xs">Height (px)</Label>
              <input
                type="number"
                value={defaultOptions.height}
                onChange={(e) => updateOptions({ height: parseInt(e.target.value) || 600 })}
                className="w-full px-3 py-2 text-sm border rounded-md mt-2"
                min="400"
                max="800"
              />
            </div>
          </div>

          {/* Show Branding */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Show PrivexBot Branding</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Display "Powered by PrivexBot" footer
              </p>
            </div>
            <Switch
              checked={defaultOptions.showBranding}
              onCheckedChange={(checked) => updateOptions({ showBranding: checked })}
            />
          </div>
        </div>
      )}

      {/* Installation Instructions */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm font-medium mb-2">📋 Installation Instructions:</p>
        <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
          <li>Copy the embed code above</li>
          <li>Paste it into your HTML file before the closing &lt;/body&gt; tag</li>
          <li>
            The widget will load asynchronously and won't affect your page load speed
          </li>
          <li>Test the widget by opening your website in a browser</li>
        </ol>
      </div>

      {/* Browser Compatibility */}
      <div className="text-xs text-muted-foreground">
        <p className="font-medium mb-1">Browser Compatibility:</p>
        <p>
          Works with all modern browsers (Chrome, Firefox, Safari, Edge)
        </p>
      </div>
    </div>
  );
}
