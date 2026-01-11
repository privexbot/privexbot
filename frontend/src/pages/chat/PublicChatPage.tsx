/**
 * PublicChatPage - Full-page chat interface for hosted chatbots
 *
 * This is a PUBLIC route (no authentication required).
 * Accessed via: /chat/{workspace_slug}/{bot_slug}
 *
 * Features:
 * - Full branding customization
 * - Fast loading
 * - Mobile responsive
 * - SEO meta tags
 * - Analytics tracking
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Send, Loader2, AlertCircle, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { config } from '@/config/env';
import { cn } from '@/lib/utils';

interface HostedPageConfig {
  chatbot_id: string;
  workspace_slug: string | null;
  slug: string | null;
  name: string;
  greeting: string | null;
  bot_name: string | null;
  color: string | null;
  secondary_color: string | null;
  avatar_url: string | null;
  font_family: string | null;
  lead_config: Record<string, unknown> | null;
  hosted_page: {
    enabled?: boolean;
    logo_url?: string;
    header_text?: string;
    footer_text?: string;
    background_color?: string;
    background_image?: string;
    meta_title?: string;
    meta_description?: string;
    favicon_url?: string;
  } | null;
}

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: string;
  sources?: Array<{
    title: string;
    url?: string;
    snippet?: string;
  }>;
}

interface ChatResponse {
  response: string;
  session_id: string;
  sources?: Array<{
    title: string;
    url?: string;
    snippet?: string;
  }>;
}

// Generate unique ID for messages
const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// API client for public endpoints (no auth required)
// URL format: /chat/{workspace_slug}/{bot_slug}
const publicApi = {
  getConfig: async (workspaceSlug: string, botSlug: string): Promise<HostedPageConfig> => {
    const response = await fetch(`${config.API_BASE_URL}/public/chat/${workspaceSlug}/${botSlug}/config`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to load chatbot' }));
      throw new Error(error.detail || 'Failed to load chatbot');
    }
    return response.json();
  },

  sendMessage: async (workspaceSlug: string, botSlug: string, message: string, sessionId?: string): Promise<ChatResponse> => {
    const response = await fetch(`${config.API_BASE_URL}/public/chat/${workspaceSlug}/${botSlug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        session_id: sessionId,
        channel_context: {
          platform: 'hosted_page',
          source_url: window.location.href,
        },
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to send message' }));
      throw new Error(error.detail || 'Failed to send message');
    }
    return response.json();
  },

  trackEvent: async (workspaceSlug: string, botSlug: string, eventType: string, data: Record<string, unknown> = {}) => {
    try {
      await fetch(`${config.API_BASE_URL}/public/chat/${workspaceSlug}/${botSlug}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          event_data: data,
          session_id: sessionStorage.getItem('chat_session_id'),
        }),
      });
    } catch {
      // Silently fail analytics - don't disrupt chat
    }
  },
};

export function PublicChatPage() {
  const { workspaceSlug, botSlug } = useParams<{ workspaceSlug: string; botSlug: string }>();
  const [chatConfig, setChatConfig] = useState<HostedPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load config on mount
  useEffect(() => {
    if (!workspaceSlug || !botSlug) {
      setError('Invalid chatbot URL');
      setLoading(false);
      return;
    }

    const loadConfig = async () => {
      try {
        const data = await publicApi.getConfig(workspaceSlug, botSlug);
        setChatConfig(data);

        // Set page title and meta tags
        if (data.hosted_page?.meta_title || data.name) {
          document.title = data.hosted_page?.meta_title || data.name;
        }

        // Add greeting message if exists
        if (data.greeting) {
          setMessages([
            {
              id: generateId(),
              role: 'bot',
              content: data.greeting,
              timestamp: new Date().toISOString(),
            },
          ]);
        }

        // Track page view
        publicApi.trackEvent(workspaceSlug, botSlug, 'page_view', {
          referrer: document.referrer,
          user_agent: navigator.userAgent,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load chatbot');
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [workspaceSlug, botSlug]);

  // Handle sending message
  const handleSend = async () => {
    if (!inputValue.trim() || sending || !workspaceSlug || !botSlug) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setSending(true);

    try {
      const response = await publicApi.sendMessage(workspaceSlug, botSlug, userMessage.content, sessionId || undefined);

      // Store session ID for conversation continuity
      if (response.session_id) {
        setSessionId(response.session_id);
        sessionStorage.setItem('chat_session_id', response.session_id);
      }

      const botMessage: Message = {
        id: generateId(),
        role: 'bot',
        content: response.response,
        timestamp: new Date().toISOString(),
        sources: response.sources,
      };

      setMessages((prev) => [...prev, botMessage]);

      // Track message event
      publicApi.trackEvent(workspaceSlug, botSlug, 'message_sent', {
        message_length: userMessage.content.length,
        has_sources: !!response.sources?.length,
      });
    } catch (err) {
      const errorMessage: Message = {
        id: generateId(),
        role: 'bot',
        content: err instanceof Error ? err.message : 'Sorry, something went wrong. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !chatConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4 p-6 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <h1 className="text-xl font-semibold text-gray-900">Unable to Load Chatbot</h1>
          <p className="text-gray-600">{error || 'This chatbot is not available.'}</p>
        </div>
      </div>
    );
  }

  // Extract styling
  const primaryColor = chatConfig.color || '#3b82f6';
  const hostedPage = chatConfig.hosted_page || {};
  const backgroundColor = hostedPage.background_color || '#f9fafb';
  const backgroundImage = hostedPage.background_image;
  const logoUrl = hostedPage.logo_url || chatConfig.avatar_url;
  const headerText = hostedPage.header_text || chatConfig.bot_name || chatConfig.name;
  const footerText = hostedPage.footer_text;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor,
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        fontFamily: chatConfig.font_family || 'system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <header
        className="flex-shrink-0 px-4 py-3 shadow-sm"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={headerText}
              className="h-10 w-10 rounded-full object-cover bg-white/20"
            />
          ) : (
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center bg-white/20"
            >
              <Bot className="h-6 w-6 text-white" />
            </div>
          )}
          <div>
            <h1 className="text-lg font-semibold text-white">{headerText}</h1>
            <p className="text-sm text-white/80">Online</p>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'bot' && (
                <div
                  className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: primaryColor }}
                >
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <Bot className="h-5 w-5 text-white" />
                  )}
                </div>
              )}

              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-3',
                  message.role === 'user'
                    ? 'text-white'
                    : 'bg-white shadow-sm border border-gray-200 text-gray-900'
                )}
                style={
                  message.role === 'user'
                    ? { backgroundColor: primaryColor }
                    : undefined
                }
              >
                {/* Render markdown content with leading spaces stripped */}
                <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
                  <ReactMarkdown>
                    {message.content.replace(/^[ \t]+/gm, '')}
                  </ReactMarkdown>
                </div>

                {/* Sources - deduplicated by URL, showing title and URL */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-500 mb-2">Sources</p>
                    <div className="space-y-1">
                      {/* Deduplicate sources by URL (or title if no URL) */}
                      {Array.from(
                        new Map(
                          message.sources.map((s) => [s.url || s.title, s])
                        ).values()
                      ).map((source, idx) => (
                        <div key={idx} className="text-xs">
                          {source.url ? (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {source.title || source.url}
                            </a>
                          ) : (
                            <span className="text-gray-600">{source.title}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {message.role === 'user' && (
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="h-5 w-5 text-gray-600" />
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {sending && (
            <div className="flex gap-3 justify-start">
              <div
                className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: primaryColor }}
              >
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div className="bg-white shadow-sm border border-gray-200 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); }}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              disabled={sending}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || sending}
              className="flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center text-white disabled:opacity-50 transition-colors"
              style={{ backgroundColor: primaryColor }}
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </footer>

      {/* Footer branding */}
      {footerText && (
        <div className="flex-shrink-0 bg-white border-t border-gray-100 px-4 py-2 text-center">
          <p className="text-xs text-gray-500">{footerText}</p>
        </div>
      )}
    </div>
  );
}

export default PublicChatPage;
