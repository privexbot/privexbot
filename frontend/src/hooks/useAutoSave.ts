/**
 * Auto-Save Hook - Debounced draft saving
 *
 * WHY:
 * - Automatic draft persistence
 * - Reduce API calls
 * - Better UX (no manual save button)
 *
 * HOW:
 * - Debounce changes (500ms)
 * - Optimistic updates
 * - Error recovery
 */

import { useEffect, useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useDraftStore } from '@/store/draft-store';
import apiClient from '@/lib/api-client';

interface UseAutoSaveOptions {
  draftId: string;
  draftType: 'chatbot' | 'chatflow' | 'kb';
  endpoint: string; // e.g., '/chatbot-drafts'
  debounceMs?: number;
}

export const useAutoSave = ({
  draftId,
  draftType,
  endpoint,
  debounceMs = 500,
}: UseAutoSaveOptions) => {
  const { updateDraft, markSaved, currentDraft } = useDraftStore();
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.patch(`${endpoint}/${draftId}`, {
        updates: data,
      });
      return response.data;
    },
    onSuccess: () => {
      markSaved(draftId);
    },
    onError: (error) => {
      console.error('Auto-save failed:', error);
      // TODO: Show toast notification
    },
  });

  // Debounced save function
  const debouncedSave = useCallback(
    (data: any) => {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        saveMutation.mutate(data);
      }, debounceMs);
    },
    [debounceMs, saveMutation]
  );

  // Save function to call from components
  const save = useCallback(
    (updates: any) => {
      // Update local state immediately (optimistic)
      updateDraft(draftId, updates);

      // Debounced API call
      debouncedSave(updates);
    },
    [draftId, updateDraft, debouncedSave]
  );

  // Save immediately (no debounce)
  const saveNow = useCallback(() => {
    if (currentDraft?.isDirty) {
      saveMutation.mutate(currentDraft.data);
    }
  }, [currentDraft, saveMutation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Save any pending changes before leaving
      if (currentDraft?.isDirty) {
        saveMutation.mutate(currentDraft.data);
      }
    };
  }, [currentDraft, saveMutation]);

  return {
    save,
    saveNow,
    isSaving: saveMutation.isPending,
    lastSaved: currentDraft?.lastSaved,
    isDirty: currentDraft?.isDirty,
  };
};
