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

type EmbedType = 'chatbot' | 'chatflow';

interface EmbedOptions {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  color?: string;
  greeting?: string;
  width?: number;
  height?: number;
  showBranding?: boolean;
}

interface EmbedCodeProps {
  type: EmbedType;
  id: string;
  options?: EmbedOptions;
  onOptionsChange?: (options: EmbedOptions) => void;
  showOptions?: boolean;
}

export default function EmbedCode({
  type,
  id,
  options = {},
  onOptionsChange,
  showOptions = true,
}: EmbedCodeProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const defaultOptions: EmbedOptions = {
    position: 'bottom-right',
    color: '#6366f1',
    width: 400,
    height: 600,
    showBranding: true,
    ...options,
  };

  const generateEmbedCode = () => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    const widgetType = type === 'chatbot' ? 'chatbot' : 'chatflow';

    // Generate options object for the script
    const scriptOptions: Record<string, any> = {
      position: defaultOptions.position,
      color: defaultOptions.color,
      width: defaultOptions.width,
      height: defaultOptions.height,
      showBranding: defaultOptions.showBranding,
    };

    if (defaultOptions.greeting) {
      scriptOptions.greeting = defaultOptions.greeting;
    }

    const optionsString = JSON.stringify(scriptOptions, null, 2)
      .split('\n')
      .map((line, idx) => (idx === 0 ? line : `    ${line}`))
      .join('\n');

    return `<!-- PrivexBot ${type === 'chatbot' ? 'Chatbot' : 'Chatflow'} Widget -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['PrivexBot']=o;w[o] = w[o] || function () { (w[o].q = w[o].q || []).push(arguments) };
    js = d.createElement(s), fjs = d.getElementsByTagName(s)[0];
    js.id = o; js.src = f; js.async = 1; fjs.parentNode.insertBefore(js, fjs);
  }(window, document, 'script', 'pb', '${baseUrl}/widget.js'));
  pb('init', {
    type: '${widgetType}',
    id: '${id}',
    options: ${optionsString}
  });
</script>`;
  };

  const embedCode = generateEmbedCode();

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

  const updateOptions = (updates: Partial<EmbedOptions>) => {
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
        className="font-mono text-xs h-64 resize-none"
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
          Works with all modern browsers (Chrome, Firefox, Safari, Edge). IE11 is not
          supported.
        </p>
      </div>
    </div>
  );
}
