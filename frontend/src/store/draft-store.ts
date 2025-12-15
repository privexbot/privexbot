/**
 * Draft Store - Auto-save draft management
 *
 * WHY:
 * - Track draft state
 * - Auto-save with debounce
 * - TTL extension
 * - Optimistic updates
 *
 * HOW:
 * - Zustand store
 * - Debounced API calls
 * - Local state sync
 */

import { create } from 'zustand';

interface Draft {
  id: string;
  type: 'chatbot' | 'chatflow' | 'kb';
  data: any;
  expires_at: string;
  lastSaved?: string;
  isDirty: boolean;
}

interface DraftState {
  drafts: Map<string, Draft>;
  currentDraft: Draft | null;

  setDraft: (draft: Draft) => void;
  updateDraft: (draftId: string, data: Partial<Draft['data']>) => void;
  markSaved: (draftId: string) => void;
  clearDraft: (draftId: string) => void;
  setCurrentDraft: (draft: Draft | null) => void;
}

export const useDraftStore = create<DraftState>((set, get) => ({
  drafts: new Map(),
  currentDraft: null,

  setDraft: (draft) => {
    const drafts = new Map(get().drafts);
    drafts.set(draft.id, draft);
    set({ drafts, currentDraft: draft });
  },

  updateDraft: (draftId, data) => {
    const drafts = new Map(get().drafts);
    const draft = drafts.get(draftId);

    if (draft) {
      const updated = {
        ...draft,
        data: { ...draft.data, ...data },
        isDirty: true,
      };
      drafts.set(draftId, updated);
      set({ drafts, currentDraft: updated });
    }
  },

  markSaved: (draftId) => {
    const drafts = new Map(get().drafts);
    const draft = drafts.get(draftId);

    if (draft) {
      const updated = {
        ...draft,
        isDirty: false,
        lastSaved: new Date().toISOString(),
      };
      drafts.set(draftId, updated);
      set({ drafts });
    }
  },

  clearDraft: (draftId) => {
    const drafts = new Map(get().drafts);
    drafts.delete(draftId);
    set({ drafts, currentDraft: null });
  },

  setCurrentDraft: (draft) => set({ currentDraft: draft }),
}));
