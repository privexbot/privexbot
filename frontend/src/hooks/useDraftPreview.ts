/**
 * useDraftPreview - Live preview hook for chatbot/chatflow testing
 *
 * WHY:
 * - Test drafts before finalization
 * - Real-time preview updates
 * - WebSocket or polling for live changes
 *
 * HOW:
 * - Fetch draft data
 * - Send test messages
 * - Handle preview state
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient, { handleApiError } from '@/lib/api-client';

type DraftType = 'chatbot' | 'chatflow';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface PreviewState {
  messages: Message[];
  conversationId: string | null;
  isTyping: boolean;
  error: string | null;
}

interface UseDraftPreviewOptions {
  draftType: DraftType;
  draftId: string;
  enabled?: boolean;
  pollInterval?: number;
}

interface UseDraftPreviewResult {
  // State
  messages: Message[];
  conversationId: string | null;
  isTyping: boolean;
  error: string | null;
  isSending: boolean;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  reset: () => void;

  // Draft data
  draftData: any;
  isDraftLoading: boolean;
  draftError: any;
}

export function useDraftPreview({
  draftType,
  draftId,
  enabled = true,
  pollInterval = 0,
}: UseDraftPreviewOptions): UseDraftPreviewResult {
  const [state, setState] = useState<PreviewState>({
    messages: [],
    conversationId: null,
    isTyping: false,
    error: null,
  });

  // Fetch draft data for preview configuration
  const {
    data: draftData,
    isLoading: isDraftLoading,
    error: draftError,
  } = useQuery({
    queryKey: [`${draftType}-draft`, draftId],
    queryFn: async () => {
      const response = await apiClient.get(`/${draftType}s/drafts/${draftId}`);
      return response.data;
    },
    enabled: enabled && !!draftId,
    refetchInterval: pollInterval,
  });

  // Initialize greeting message when draft data loads
  useEffect(() => {
    if (draftData && state.messages.length === 0) {
      const greeting = draftData.greeting_message || draftData.system_prompt?.split('\n')[0] || 'Hi! How can I help you?';

      setState((prev) => ({
        ...prev,
        messages: [
          {
            id: 'greeting',
            role: 'assistant',
            content: greeting,
            timestamp: new Date().toISOString(),
          },
        ],
      }));
    }
  }, [draftData, state.messages.length]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const endpoint = `/${draftType}s/drafts/${draftId}/preview/message`;
      const response = await apiClient.post(endpoint, {
        message: content,
        conversation_id: state.conversationId,
      });
      return response.data;
    },
    onMutate: (content) => {
      // Add user message optimistically
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isTyping: true,
        error: null,
      }));
    },
    onSuccess: (data) => {
      // Add assistant response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response || data.message,
        timestamp: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        conversationId: data.conversation_id || prev.conversationId,
        isTyping: false,
      }));
    },
    onError: (error: any) => {
      setState((prev) => ({
        ...prev,
        isTyping: false,
        error: handleApiError(error),
      }));
    },
  });

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || sendMessageMutation.isPending) {
        return;
      }

      await sendMessageMutation.mutateAsync(content);
    },
    [sendMessageMutation]
  );

  const reset = useCallback(() => {
    const greeting = draftData?.greeting_message || draftData?.system_prompt?.split('\n')[0] || 'Hi! How can I help you?';

    setState({
      messages: [
        {
          id: 'greeting',
          role: 'assistant',
          content: greeting,
          timestamp: new Date().toISOString(),
        },
      ],
      conversationId: null,
      isTyping: false,
      error: null,
    });
  }, [draftData]);

  return {
    // State
    messages: state.messages,
    conversationId: state.conversationId,
    isTyping: state.isTyping,
    error: state.error,
    isSending: sendMessageMutation.isPending,

    // Actions
    sendMessage,
    reset,

    // Draft data
    draftData,
    isDraftLoading,
    draftError,
  };
}
