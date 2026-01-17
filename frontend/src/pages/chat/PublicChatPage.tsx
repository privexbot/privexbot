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
import { Send, Loader2, AlertCircle, Bot, User, Key, Lock, ThumbsUp, ThumbsDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { config } from '@/config/env';
import { cn } from '@/lib/utils';
import LeadCaptureForm, { LeadData } from '@/components/chat/LeadCaptureForm';
import type { LeadCaptureConfig } from '@/types/chatbot';
import { LeadCaptureTiming } from '@/types/chatbot';

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
  auth_required?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: string;
  messageId?: string; // Backend message ID for feedback
  sources?: Array<{
    title: string;
    url?: string;
    snippet?: string;
  }>;
}

interface ChatResponse {
  response: string;
  session_id: string;
  message_id: string; // For feedback
  sources?: Array<{
    // Backend returns document_title/document_url
    document_title?: string;
    document_url?: string;
    // Fallback for legacy format
    title?: string;
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

  sendMessage: async (workspaceSlug: string, botSlug: string, message: string, sessionId?: string, apiKey?: string): Promise<ChatResponse> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    const response = await fetch(`${config.API_BASE_URL}/public/chat/${workspaceSlug}/${botSlug}`, {
      method: 'POST',
      headers,
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
      // Use localStorage for session consistency (same as widget)
      const sessionKey = `chat_session_${workspaceSlug}_${botSlug}`;
      await fetch(`${config.API_BASE_URL}/public/chat/${workspaceSlug}/${botSlug}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          event_data: data,
          session_id: localStorage.getItem(sessionKey),
        }),
      });
    } catch {
      // Silently fail analytics - don't disrupt chat
    }
  },

  submitFeedback: async (chatbotId: string, messageId: string, rating: 'positive' | 'negative', apiKey?: string) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    const response = await fetch(
      `${config.API_BASE_URL}/public/bots/${chatbotId}/feedback?message_id=${messageId}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ rating }),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to submit feedback');
    }
    return response.json();
  },

  submitLead: async (
    workspaceSlug: string,
    botSlug: string,
    data: LeadData & {
      session_id: string;
      referrer?: string;
      user_agent?: string;
      language?: string;
    }
  ) => {
    const response = await fetch(`${config.API_BASE_URL}/public/chat/${workspaceSlug}/${botSlug}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to submit lead' }));
      throw new Error(error.detail || 'Failed to submit lead');
    }
    return response.json();
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

  // Authentication state for private bots
  const [authRequired, setAuthRequired] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);

  // Feedback state - persisted in sessionStorage
  const [feedbackState, setFeedbackState] = useState<Record<string, 'positive' | 'negative'>>(() => {
    try {
      const stored = sessionStorage.getItem('chat_feedback');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Lead capture state
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadCollected, setLeadCollected] = useState(false);
  const [leadConfig, setLeadConfig] = useState<LeadCaptureConfig | null>(null);

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

        // Load existing session from localStorage (consistent with widget)
        const sessionKey = `chat_session_${workspaceSlug}_${botSlug}`;
        const existingSession = localStorage.getItem(sessionKey);
        if (existingSession) {
          setSessionId(existingSession);
        }

        // Check if authentication is required for private bots
        if (data.auth_required) {
          setAuthRequired(true);
          // Check for stored API key in sessionStorage
          const storedKey = sessionStorage.getItem(`chatbot_auth_${data.chatbot_id}`);
          if (storedKey) {
            setApiKey(storedKey);
            setAuthRequired(false); // Already authenticated
          }
        }

        // Set page title and meta tags
        if (data.hosted_page?.meta_title || data.name) {
          document.title = data.hosted_page?.meta_title || data.name;
        }

        // Handle lead capture configuration
        const leadCfg = data.lead_config as unknown as LeadCaptureConfig | null;
        if (leadCfg?.enabled) {
          // Check if web platform is enabled for lead capture
          const webPlatformEnabled = leadCfg.platforms?.web?.enabled ?? true;
          if (webPlatformEnabled) {
            setLeadConfig(leadCfg);

            // Check if lead already collected this session
            const leadKey = `lead_collected_${workspaceSlug}_${botSlug}`;
            if (!localStorage.getItem(leadKey)) {
              // Show lead form based on timing
              if (leadCfg.timing === LeadCaptureTiming.BEFORE_CHAT || leadCfg.timing === 'before_chat') {
                setShowLeadForm(true);
              }
            } else {
              setLeadCollected(true);
            }
          }
        }

        // Add greeting message if exists (only for public bots or authenticated private bots)
        if (data.greeting && !data.auth_required) {
          setMessages([
            {
              id: generateId(),
              role: 'bot',
              content: data.greeting,
              timestamp: new Date().toISOString(),
            },
          ]);
        }

        // Track page view (once per session to prevent double-counting on refresh)
        const pageViewKey = `page_view_tracked_${workspaceSlug}_${botSlug}`;
        if (!sessionStorage.getItem(pageViewKey)) {
          publicApi.trackEvent(workspaceSlug, botSlug, 'page_view', {
            referrer: document.referrer,
            user_agent: navigator.userAgent,
          });
          sessionStorage.setItem(pageViewKey, 'true');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load chatbot');
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [workspaceSlug, botSlug]);

  // Handle lead form submission
  const handleLeadSubmit = async (leadData: LeadData) => {
    if (!workspaceSlug || !botSlug) return;

    await publicApi.submitLead(workspaceSlug, botSlug, {
      ...leadData,
      session_id: sessionId || `temp_${Date.now()}`,
      referrer: document.referrer,
      user_agent: navigator.userAgent,
      language: navigator.language,
    });

    // Mark lead as collected
    const leadKey = `lead_collected_${workspaceSlug}_${botSlug}`;
    localStorage.setItem(leadKey, 'true');
    setLeadCollected(true);
    setShowLeadForm(false);

    // Track lead captured event
    publicApi.trackEvent(workspaceSlug, botSlug, 'lead_collected', {
      fields: Object.keys(leadData).filter(k => leadData[k as keyof LeadData]),
    });
  };

  // Handle lead form skip
  const handleLeadSkip = () => {
    setShowLeadForm(false);
    // Track lead skipped event
    if (workspaceSlug && botSlug) {
      publicApi.trackEvent(workspaceSlug, botSlug, 'lead_skipped', {});
    }
  };

  // Handle feedback submission
  const handleFeedback = async (messageId: string, rating: 'positive' | 'negative') => {
    if (!chatConfig || feedbackState[messageId]) return;

    // Optimistic update
    const newState = { ...feedbackState, [messageId]: rating };
    setFeedbackState(newState);
    sessionStorage.setItem('chat_feedback', JSON.stringify(newState));

    try {
      await publicApi.submitFeedback(chatConfig.chatbot_id, messageId, rating, apiKey || undefined);

      // Track feedback event
      if (workspaceSlug && botSlug) {
        publicApi.trackEvent(workspaceSlug, botSlug, 'feedback_given', {
          message_id: messageId,
          rating,
        });
      }
    } catch (error) {
      // Revert on failure
      const revertState = { ...feedbackState };
      delete revertState[messageId];
      setFeedbackState(revertState);
      sessionStorage.setItem('chat_feedback', JSON.stringify(revertState));
      console.error('Failed to submit feedback:', error);
    }
  };

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
      const response = await publicApi.sendMessage(workspaceSlug, botSlug, userMessage.content, sessionId || undefined, apiKey || undefined);

      // Store session ID for conversation continuity (use localStorage for consistency with widget)
      if (response.session_id) {
        setSessionId(response.session_id);
        const sessionKey = `chat_session_${workspaceSlug}_${botSlug}`;
        localStorage.setItem(sessionKey, response.session_id);
      }

      const botMessage: Message = {
        id: generateId(),
        role: 'bot',
        content: response.response,
        timestamp: new Date().toISOString(),
        messageId: response.message_id, // Store for feedback
        // Map backend source properties to frontend format
        sources: response.sources?.map(s => ({
          title: s.document_title || s.title || 'Source',
          url: s.document_url || s.url,
          snippet: s.snippet,
        })),
      };

      setMessages((prev) => [...prev, botMessage]);

      // Track message event
      publicApi.trackEvent(workspaceSlug, botSlug, 'message_sent', {
        message_length: userMessage.content.length,
        has_sources: !!response.sources?.length,
      });

      // Check if should show lead form after N messages
      // Count user messages (excluding greeting)
      const userMessageCount = messages.filter(m => m.role === 'user').length + 1;
      const messagesBeforePrompt = leadConfig?.messages_before_prompt ?? 1;
      const isAfterNMessages = leadConfig?.timing === LeadCaptureTiming.AFTER_N_MESSAGES ||
                               leadConfig?.timing === 'after_n_messages' ||
                               leadConfig?.timing === 'after_first_message'; // backward compatibility

      if (
        leadConfig?.enabled &&
        isAfterNMessages &&
        userMessageCount === messagesBeforePrompt &&
        !leadCollected
      ) {
        // Delay slightly to let user see the response first
        setTimeout(() => setShowLeadForm(true), 1500);
      }
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

  // Handle API key authentication for private bots
  const handleAuthenticate = async () => {
    if (!apiKeyInput.trim() || !workspaceSlug || !botSlug || !chatConfig) return;

    setAuthenticating(true);
    setAuthError(null);

    try {
      // Test the API key by sending a simple message
      await publicApi.sendMessage(workspaceSlug, botSlug, 'Hello', undefined, apiKeyInput.trim());

      // If successful, store the API key and allow access
      const key = apiKeyInput.trim();
      setApiKey(key);
      setAuthRequired(false);
      sessionStorage.setItem(`chatbot_auth_${chatConfig.chatbot_id}`, key);

      // Now load the full config (greeting, etc.) by re-fetching
      const fullConfig = await publicApi.getConfig(workspaceSlug, botSlug);
      if (fullConfig.greeting) {
        setMessages([
          {
            id: generateId(),
            role: 'bot',
            content: fullConfig.greeting,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Invalid API key');
    } finally {
      setAuthenticating(false);
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

  // API Key authentication modal for private bots
  if (authRequired) {
    const primaryColor = chatConfig.color || '#3b82f6';
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center mb-6">
            {chatConfig.avatar_url ? (
              <img
                src={chatConfig.avatar_url}
                alt={chatConfig.name}
                className="h-16 w-16 rounded-full object-cover mb-4"
              />
            ) : (
              <div
                className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: primaryColor }}
              >
                <Lock className="h-8 w-8 text-white" />
              </div>
            )}
            <h1 className="text-xl font-semibold text-gray-900">{chatConfig.name}</h1>
            <p className="text-sm text-gray-500 mt-1">This chatbot requires authentication</p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="apiKey"
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => { setApiKeyInput(e.target.value); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAuthenticate(); }}
                  placeholder="sk_live_..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  disabled={authenticating}
                />
              </div>
              {authError && (
                <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {authError}
                </p>
              )}
            </div>

            <button
              onClick={handleAuthenticate}
              disabled={!apiKeyInput.trim() || authenticating}
              className="w-full py-3 px-4 rounded-xl text-white font-medium disabled:opacity-50 transition-colors"
              style={{ backgroundColor: primaryColor }}
            >
              {authenticating ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Authenticating...
                </span>
              ) : (
                'Access Chat'
              )}
            </button>

            <p className="text-xs text-center text-gray-500">
              Enter the API key provided by the chatbot owner to access this chat.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Lead capture form (before chat starts)
  if (showLeadForm && leadConfig) {
    const primaryColor = chatConfig.color || '#3b82f6';
    const hostedPage = chatConfig.hosted_page || {};
    const backgroundColor = hostedPage.background_color || '#f9fafb';

    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{
          backgroundColor,
          fontFamily: chatConfig.font_family || 'system-ui, sans-serif',
        }}
      >
        <LeadCaptureForm
          config={leadConfig}
          primaryColor={primaryColor}
          onSubmit={handleLeadSubmit}
          onSkip={leadConfig.allow_skip ? handleLeadSkip : undefined}
          title={chatConfig.name ? `Welcome to ${chatConfig.name}` : undefined}
        />
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

                {/* Feedback buttons for bot messages */}
                {message.role === 'bot' && message.messageId && (
                  <div className="flex gap-1 mt-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleFeedback(message.messageId!, 'positive')}
                      disabled={!!feedbackState[message.messageId]}
                      className={cn(
                        'p-1.5 rounded-md transition-colors text-gray-400',
                        feedbackState[message.messageId] === 'positive'
                          ? 'bg-green-100 text-green-600'
                          : 'hover:bg-gray-100 hover:text-gray-600',
                        feedbackState[message.messageId] && feedbackState[message.messageId] !== 'positive'
                          ? 'opacity-30'
                          : ''
                      )}
                      title="Helpful"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleFeedback(message.messageId!, 'negative')}
                      disabled={!!feedbackState[message.messageId]}
                      className={cn(
                        'p-1.5 rounded-md transition-colors text-gray-400',
                        feedbackState[message.messageId] === 'negative'
                          ? 'bg-red-100 text-red-600'
                          : 'hover:bg-gray-100 hover:text-gray-600',
                        feedbackState[message.messageId] && feedbackState[message.messageId] !== 'negative'
                          ? 'opacity-30'
                          : ''
                      )}
                      title="Not helpful"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
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
