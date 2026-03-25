/**
 * Unified Embed Code Generator
 *
 * This is the SINGLE SOURCE OF TRUTH for embed code generation.
 * All components should use these functions to generate consistent embed code.
 */

import { config } from '@/config/env';

export interface EmbedCodeOptions {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  color?: string;
  greeting?: string;
  botName?: string;
  width?: number;
  height?: number;
  showBranding?: boolean;
}

/**
 * Generate consistent embed code for chatbots/chatflows.
 *
 * Uses the pb('init', {...}) format with IIFE loader for async loading.
 * Widget URL comes from WIDGET_CDN_URL config.
 */
export function generateEmbedCode(params: {
  botId: string;
  apiKey?: string;
  options?: EmbedCodeOptions;
  includeApiKey?: boolean;
  type?: 'chatbot' | 'chatflow';
}): string {
  const { botId, apiKey, options = {}, includeApiKey = true, type = 'chatbot' } = params;

  const widgetUrl = config.WIDGET_CDN_URL;
  const apiUrl = config.API_BASE_URL;

  // Build options object
  const initOptions: Record<string, unknown> = {
    baseURL: apiUrl,
  };

  if (options.position) initOptions.position = options.position;
  if (options.color) initOptions.color = options.color;
  if (options.greeting) initOptions.greeting = options.greeting;
  if (options.botName) initOptions.botName = options.botName;
  if (options.width) initOptions.width = options.width;
  if (options.height) initOptions.height = options.height;
  if (options.showBranding !== undefined) initOptions.showBranding = options.showBranding;

  const optionsStr = JSON.stringify(initOptions, null, 2)
    .split('\n')
    .map((line, idx) => (idx === 0 ? line : `    ${line}`))
    .join('\n');

  const apiKeyValue = includeApiKey && apiKey
    ? `'${apiKey}'`
    : "'YOUR_API_KEY' // Replace with your API key";

  const typeComment = type === 'chatbot' ? 'Chatbot' : 'Chatflow';

  return `<!-- PrivexBot ${typeComment} Widget -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['PrivexBot']=o;w[o] = w[o] || function () { (w[o].q = w[o].q || []).push(arguments) };
    js = d.createElement(s), fjs = d.getElementsByTagName(s)[0];
    js.id = o; js.src = f; js.async = 1; fjs.parentNode.insertBefore(js, fjs);
  }(window, document, 'script', 'pb', '${widgetUrl}/widget.js'));
  pb('init', {
    id: '${botId}',
    apiKey: ${apiKeyValue},
    options: ${optionsStr}
  });
</script>`;
}

/**
 * Generate simple embed code (post-deployment with real API key)
 *
 * Uses window.privexbotConfig for simpler, cleaner embed code.
 * The widget auto-initializes when it detects this config.
 */
export function generateSimpleEmbedCode(botId: string, apiKey: string): string {
  const widgetUrl = config.WIDGET_CDN_URL;
  const apiUrl = config.API_BASE_URL;

  return `<script>
  window.privexbotConfig = {
    botId: '${botId}',
    apiKey: '${apiKey}',
    baseURL: '${apiUrl}'
  };
</script>
<script src="${widgetUrl}/widget.js" async></script>`;
}
