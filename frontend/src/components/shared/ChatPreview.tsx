/**
 * ChatPreview - Test chat widget for chatbot/chatflow
 *
 * WHY:
 * - Test conversations before deployment
 * - Works for both chatbot and chatflow
 * - Real-time message streaming
 *
 * HOW:
 * - WebSocket or polling for messages
 * - Message history
 * - Typing indicator
 */

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Send,
  Loader2,
  Bot,
  User,
  RefreshCw,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import apiClient, { handleApiError } from '@/lib/api-client';

type EntityType = 'chatbot' | 'chatflow';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatPreviewProps {
  type: EntityType;
  id: string;
  greeting?: string;
  color?: string;
  expanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
}

export default function ChatPreview({
  type,
  id,
  greeting = 'Hi! How can I help you today?',
  color = '#6366f1',
  expanded = false,
  onExpandChange,
}: ChatPreviewProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'greeting',
      role: 'assistant',
      content: greeting,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const endpoint = `/${type}s/${id}/test/message`;
      const response = await apiClient.post(endpoint, {
        message,
        conversation_id: conversationId,
      });
      return response.data;
    },
    onMutate: (message) => {
      // Add user message optimistically
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsTyping(true);
    },
    onSuccess: (data) => {
      // Save conversation ID for continuity
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      // Add assistant response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    },
    onError: (error) => {
      setIsTyping(false);
      toast({
        title: 'Failed to send message',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sendMutation.isPending) return;

    sendMutation.mutate(trimmed);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const resetConversation = () => {
    setMessages([
      {
        id: 'greeting',
        role: 'assistant',
        content: greeting,
        timestamp: new Date().toISOString(),
      },
    ]);
    setConversationId(null);
    setInput('');
    setIsTyping(false);
    toast({ title: 'Conversation reset' });
  };

  const toggleExpanded = () => {
    onExpandChange?.(!expanded);
  };

  return (
    <div
      className={`flex flex-col bg-background border rounded-lg overflow-hidden shadow-lg transition-all ${
        expanded ? 'h-[600px]' : 'h-[500px]'
      }`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 text-white"
        style={{ backgroundColor: color }}
      >
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <div>
            <h3 className="font-semibold">Test Chat</h3>
            <p className="text-xs opacity-90">
              {type === 'chatbot' ? 'Chatbot Preview' : 'Chatflow Preview'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={resetConversation}
            className="text-white hover:bg-white/20"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          {onExpandChange && (
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleExpanded}
              className="text-white hover:bg-white/20"
            >
              {expanded ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              {/* Avatar */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {message.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={`flex-1 max-w-[80%] ${
                  message.role === 'user' ? 'text-right' : 'text-left'
                }`}
              >
                <div
                  className={`inline-block px-4 py-2 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-muted px-4 py-2 rounded-lg">
                <div className="flex gap-1">
                  <div
                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <div
                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <div
                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={sendMutation.isPending}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            style={{ backgroundColor: color }}
            className="text-white hover:opacity-90"
          >
            {sendMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          This is a test environment. Messages are not saved.
        </p>
      </div>
    </div>
  );
}
