/**
 * Knowledge Base Store - State management with Zustand
 *
 * WHY: Centralized state management for KB operations
 * HOW: Zustand store with draft management, pipeline monitoring, and CRUD operations
 */

import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import {
  KBSummary,
  KnowledgeBase,
  KBDraft,
  KBListFilters,
  KBStatus,
  KBContext,
  SourceType,
  CrawlMethod,
  DraftSource,
  ChunkingConfig,
  ChunkingStrategy,
  WebSourceConfig,
  AddWebSourceRequest,
  PipelineStatusResponse,
  PipelineStatus,
  PreviewResponse,
  QuickPreviewResponse,
  DraftValidationResponse,
} from "@/types/knowledge-base";
import kbClient from "@/lib/kb-client";

// ========================================
// STORE STATE INTERFACE
// ========================================

interface KBStoreState {
  // ========================================
  // LIST STATE
  // ========================================
  kbs: KBSummary[];
  isLoadingList: boolean;
  listError: string | null;
  filters: KBListFilters;

  // ========================================
  // DETAIL STATE
  // ========================================
  currentKB: KnowledgeBase | null;
  isLoadingDetail: boolean;
  detailError: string | null;

  // ========================================
  // DRAFT STATE
  // ========================================
  currentDraft: KBDraft | null;
  draftSources: DraftSource[];
  chunkingConfig: ChunkingConfig;
  isDraftDirty: boolean;
  isCreatingDraft: boolean;
  draftError: string | null;

  // ========================================
  // PREVIEW STATE
  // ========================================
  previewData: PreviewResponse | null;
  quickPreviewData: QuickPreviewResponse | null;
  isLoadingPreview: boolean;
  previewError: string | null;

  // ========================================
  // PIPELINE STATE
  // ========================================
  activePipelines: Record<string, PipelineStatusResponse>;
  pollingIntervals: Record<string, ReturnType<typeof setTimeout>>;

  // ========================================
  // FORM STATE
  // ========================================
  formData: {
    name: string;
    description: string;
    workspace_id: string;
    context: KBContext;
  };
  formErrors: Record<string, string>;
  isSubmitting: boolean;
}

interface KBStoreActions {
  // ========================================
  // LIST ACTIONS
  // ========================================
  fetchKBs: (filters?: KBListFilters) => Promise<void>;
  setFilters: (filters: Partial<KBListFilters>) => void;
  clearListError: () => void;

  // ========================================
  // DETAIL ACTIONS
  // ========================================
  fetchKB: (kbId: string) => Promise<void>;
  getKB: (kbId: string) => Promise<KnowledgeBase>;
  getKBDocuments: (kbId: string) => Promise<any[]>;
  getKBChunks: (kbId: string) => Promise<any[]>;
  updateKB: (kbId: string, updates: Partial<KnowledgeBase>) => Promise<void>;
  deleteKB: (kbId: string) => Promise<void>;
  clearCurrentKB: () => void;

  // ========================================
  // DRAFT ACTIONS
  // ========================================
  createDraft: (
    workspaceId: string,
    initialData?: Partial<KBStoreState["formData"]>
  ) => Promise<void>;
  updateFormData: (data: Partial<KBStoreState["formData"]>) => void;
  addWebSource: (
    urlOrUrls: string | string[],
    config?: Partial<WebSourceConfig>,
    perUrlConfigs?: Record<string, Partial<WebSourceConfig>>,
    metadata?: Record<string, unknown>
  ) => Promise<DraftSource[]>;
  addFileSource: (
    file: File,
    config?: Record<string, unknown>
  ) => Promise<void>;
  addTextSource: (content: string, title?: string) => Promise<void>;
  updateSource: (sourceId: string, updates: Partial<DraftSource>) => void;
  removeSource: (sourceId: string) => void;
  updateChunkingConfig: (config: Partial<ChunkingConfig>) => void;
  validateDraft: () => Promise<DraftValidationResponse>;
  finalizeDraft: () => Promise<{ kbId: string; pipelineId: string }>;
  clearDraft: () => void;
  saveDraftToLocalStorage: () => void;
  restoreDraftFromLocalStorage: () => boolean;

  // ========================================
  // PREVIEW ACTIONS
  // ========================================
  quickPreview: (
    url: string,
    options?: { strategy?: ChunkingStrategy }
  ) => Promise<void>;
  previewDraft: (maxPages?: number) => Promise<void>;
  clearPreview: () => void;

  // ========================================
  // PIPELINE ACTIONS
  // ========================================
  fetchPipelineStatus: (pipelineId: string) => Promise<PipelineStatusResponse>;
  startPipelinePolling: (
    pipelineId: string,
    onComplete?: (status: PipelineStatusResponse) => void
  ) => void;
  stopPipelinePolling: (pipelineId: string) => void;
  stopAllPolling: () => void;
  updatePipelineStatus: (
    pipelineId: string,
    status: PipelineStatusResponse
  ) => void;

  // ========================================
  // FORM ACTIONS
  // ========================================
  setFormError: (field: string, error: string) => void;
  clearFormError: (field: string) => void;
  clearAllFormErrors: () => void;
  validateForm: () => boolean;
  resetForm: () => void;
}

// ========================================
// INITIAL STATE
// ========================================

const initialFormData = {
  name: "",
  description: "",
  workspace_id: "",
  context: KBContext.BOTH, // Default to both for maximum flexibility
};

const initialChunkingConfig: ChunkingConfig = {
  strategy: ChunkingStrategy.BY_HEADING,
  chunk_size: 1000,
  chunk_overlap: 200,
};

// ========================================
// ZUSTAND STORE
// ========================================

export const useKBStore = create<KBStoreState & KBStoreActions>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // ========================================
        // INITIAL STATE
        // ========================================
        kbs: [],
        isLoadingList: false,
        listError: null,
        filters: {},

        currentKB: null,
        isLoadingDetail: false,
        detailError: null,

        currentDraft: null,
        draftSources: [],
        chunkingConfig: initialChunkingConfig,
        isDraftDirty: false,
        isCreatingDraft: false,
        draftError: null,

        previewData: null,
        quickPreviewData: null,
        isLoadingPreview: false,
        previewError: null,

        activePipelines: {},
        pollingIntervals: {},

        formData: initialFormData,
        formErrors: {},
        isSubmitting: false,

        // ========================================
        // LIST ACTIONS
        // ========================================
        fetchKBs: async (filters) => {
          set((state) => {
            state.isLoadingList = true;
            state.listError = null;
            if (filters) state.filters = { ...state.filters, ...filters };
          });

          try {
            // Always include current workspace in filters if not explicitly overridden
            const finalFilters = {
              ...get().filters,
              ...filters,
            };

            const response = await kbClient.kb.list(finalFilters);
            set((state) => {
              state.kbs = response.items || response;
              state.isLoadingList = false;
            });
          } catch (error: unknown) {
            set((state) => {
              state.listError = kbClient.errors.getUserMessage(error);
              state.isLoadingList = false;
            });
          }
        },

        setFilters: (filters) => {
          set((state) => {
            state.filters = { ...state.filters, ...filters };
          });
          // Auto-fetch with new filters
          get().fetchKBs();
        },

        clearListError: () =>
          set((state) => {
            state.listError = null;
          }),

        // ========================================
        // DETAIL ACTIONS
        // ========================================
        fetchKB: async (kbId) => {
          set((state) => {
            state.isLoadingDetail = true;
            state.detailError = null;
          });

          try {
            const kb = await kbClient.kb.get(kbId);
            set((state) => {
              state.currentKB = kb;
              state.isLoadingDetail = false;
            });
          } catch (error: unknown) {
            set((state) => {
              state.detailError = kbClient.errors.getUserMessage(error);
              state.isLoadingDetail = false;
            });
          }
        },

        getKB: async (kbId) => {
          const kb = await kbClient.kb.get(kbId);
          return kb;
        },

        getKBDocuments: async (kbId) => {
          const response = await kbClient.kb.getDocuments(kbId);
          return Array.isArray(response) ? response : (response as any)?.documents || [];
        },

        getKBChunks: async (kbId) => {
          const response = await kbClient.kb.getChunks(kbId);
          return Array.isArray(response) ? response : (response as any)?.chunks || [];
        },

        updateKB: async (kbId, updates) => {
          try {
            const updatedKB = await kbClient.kb.update(kbId, updates);
            set((state) => {
              state.currentKB = updatedKB;
              // Also update in list if present
              const index = state.kbs.findIndex((kb) => kb.id === kbId);
              if (index !== -1) {
                state.kbs[index] = { ...state.kbs[index], ...updates };
              }
            });
          } catch (error: unknown) {
            set((state) => {
              state.detailError = kbClient.errors.getUserMessage(error);
            });
            throw error;
          }
        },

        deleteKB: async (kbId) => {
          try {
            await kbClient.kb.delete(kbId);
            set((state) => {
              // Remove from list
              state.kbs = state.kbs.filter((kb) => kb.id !== kbId);
              // Clear current if it was deleted
              if (state.currentKB?.id === kbId) {
                state.currentKB = null;
              }
            });
          } catch (error: unknown) {
            throw new Error(kbClient.errors.getUserMessage(error));
          }
        },

        clearCurrentKB: () =>
          set((state) => {
            state.currentKB = null;
          }),

        // ========================================
        // DRAFT ACTIONS
        // ========================================
        createDraft: async (workspaceId, initialData) => {
          set((state) => {
            state.isCreatingDraft = true;
            state.draftError = null;
          });

          try {
            const formData = {
              ...get().formData,
              workspace_id: workspaceId,
              ...initialData,
            };
            const draft = await kbClient.draft.create({
              name: formData.name || "",
              description: formData.description || "",
              workspace_id: workspaceId,
              context: formData.context,
            });

            set((state) => {
              state.currentDraft = draft;
              state.draftSources = [];
              state.formData = formData;
              state.isDraftDirty = false;
              state.isCreatingDraft = false;
            });

            // Auto-save to local storage
            get().saveDraftToLocalStorage();
          } catch (error: unknown) {
            set((state) => {
              state.draftError = kbClient.errors.getUserMessage(error);
              state.isCreatingDraft = false;
            });
            throw error;
          }
        },

        updateFormData: (data) => {
          set((state) => {
            state.formData = { ...state.formData, ...data };
            state.isDraftDirty = true;
          });
        },

        addWebSource: async (urlOrUrls, config = {}, perUrlConfigs = {}, metadata = {}) => {
          const { currentDraft } = get();
          if (!currentDraft) throw new Error("No draft available");

          try {
            const defaultConfig = {
              method: CrawlMethod.CRAWL,
              max_pages: 50,
              max_depth: 3,
            };

            const request: AddWebSourceRequest = {
              config: { ...defaultConfig, ...config },
            };

            // Handle both single URL and bulk URLs
            if (Array.isArray(urlOrUrls)) {
              request.urls = urlOrUrls;
              if (Object.keys(perUrlConfigs).length > 0) {
                request.per_url_configs = perUrlConfigs as Record<string, WebSourceConfig>;
              }
            } else {
              request.url = urlOrUrls;
            }

            const result = await kbClient.draft.addWebSources(
              currentDraft.draft_id,
              request
            );

            console.log('API Response:', result);

            // Handle both single and bulk response formats
            if (!result) {
              console.error('Invalid API response: null or undefined');
              throw new Error('Invalid API response: no data returned');
            }

            const newSources: DraftSource[] = [];
            const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];

            // Handle bulk mode response (source_ids array)
            if (result.source_ids && Array.isArray(result.source_ids)) {
              result.source_ids.forEach((sourceId, index) => {
                const url = urls[index];
                if (url && sourceId) {
                  const urlConfig = perUrlConfigs[url] || config;
                  newSources.push({
                    source_id: sourceId,
                    type: SourceType.WEB,
                    url,
                    config: { ...defaultConfig, ...urlConfig },
                    status: "pending",
                    created_at: new Date().toISOString(),
                  });
                }
              });

              // Log bulk operation results
              if (result.duplicates_skipped && result.duplicates_skipped > 0) {
                console.log(`Skipped ${result.duplicates_skipped} duplicate URLs`);
              }
              if (result.invalid_urls && result.invalid_urls.length > 0) {
                console.warn('Invalid URLs skipped:', result.invalid_urls);
              }
            }
            // Handle single mode response (source_id)
            else if (result.source_id) {
              const url = urls[0];
              const urlConfig = perUrlConfigs[url] || config;
              newSources.push({
                source_id: result.source_id,
                type: SourceType.WEB,
                url,
                config: { ...defaultConfig, ...urlConfig },
                status: "pending",
                created_at: new Date().toISOString(),
                metadata: metadata || {},
              });
            }
            else {
              console.error('Invalid API response structure:', result);
              throw new Error(`Invalid API response: expected source_id or source_ids, got ${JSON.stringify(result)}`);
            }

            set((state) => {
              state.draftSources.push(...newSources);
              state.isDraftDirty = true;
            });

            get().saveDraftToLocalStorage();
            return newSources;
          } catch (error: unknown) {
            set((state) => {
              state.draftError = kbClient.errors.getUserMessage(error);
            });
            throw error;
          }
        },

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        addFileSource: async (file: File, _config?: Record<string, unknown>) => {
          const { currentDraft } = get();
          if (!currentDraft) throw new Error("No draft available");

          try {
            // TODO: Implement file upload to backend
            // const result = await kbClient.draft.addFileSource(currentDraft.draft_id, file, _config);
            // Note: _config parameter will be used when backend implementation is complete

            const newSource: DraftSource = {
              source_id: `file_${Date.now()}`, // Temporary ID
              type: SourceType.FILE,
              status: 'pending',
              created_at: new Date().toISOString(),
              metadata: {
                file_name: file.name,
                file_size: file.size,
                file_type: file.type,
              },
            };

            set((state) => {
              state.draftSources.push(newSource);
              state.isDraftDirty = true;
            });

            get().saveDraftToLocalStorage();
          } catch (error: unknown) {
            set((state) => {
              state.draftError = kbClient.errors.getUserMessage(error);
            });
            throw error;
          }
        },

        addTextSource: async (content: string, title?: string) => {
          const { currentDraft } = get();
          if (!currentDraft) throw new Error("No draft available");

          try {
            // TODO: Implement text source addition to backend
            // const result = await kbClient.draft.addTextSource(currentDraft.draft_id, { content, title });

            const newSource: DraftSource = {
              source_id: `text_${Date.now()}`, // Temporary ID
              type: SourceType.TEXT,
              status: 'pending',
              created_at: new Date().toISOString(),
              metadata: {
                content,
                title: title || "Pasted Text",
              },
            };

            set((state) => {
              state.draftSources.push(newSource);
              state.isDraftDirty = true;
            });

            get().saveDraftToLocalStorage();
          } catch (error: unknown) {
            set((state) => {
              state.draftError = kbClient.errors.getUserMessage(error);
            });
            throw error;
          }
        },

        updateSource: (sourceId: string, updates: Partial<DraftSource>) => {
          set((state) => {
            const index = state.draftSources.findIndex(
              (source) => source.source_id === sourceId
            );
            if (index !== -1) {
              state.draftSources[index] = {
                ...state.draftSources[index],
                ...updates,
              };
              state.isDraftDirty = true;
            }
          });
          get().saveDraftToLocalStorage();
        },

        removeSource: (sourceId) => {
          const { currentDraft } = get();
          if (!currentDraft) return;

          // Optimistic update
          set((state) => {
            state.draftSources = state.draftSources.filter(
              (s) => s.source_id !== sourceId
            );
            state.isDraftDirty = true;
          });

          // Background API call
          kbClient.draft
            .removeSource(currentDraft.draft_id, sourceId)
            .catch((error) => {
              console.error("Failed to remove source:", error);
              // Could revert optimistic update here
            });

          get().saveDraftToLocalStorage();
        },

        updateChunkingConfig: (config) => {
          set((state) => {
            state.chunkingConfig = { ...state.chunkingConfig, ...config };
            state.isDraftDirty = true;
          });

          const { currentDraft } = get();
          if (currentDraft) {
            // Debounced API update - implement actual update call when needed
            // kbClient.draft.updateChunking(currentDraft.draft_id, config);
          }

          get().saveDraftToLocalStorage();
        },

        validateDraft: async () => {
          const { currentDraft } = get();
          if (!currentDraft) throw new Error("No draft to validate");

          try {
            const validation = await kbClient.draft.validate(
              currentDraft.draft_id
            );
            return validation;
          } catch (error: unknown) {
            set((state) => {
              state.draftError = kbClient.errors.getUserMessage(error);
            });
            throw error;
          }
        },

        finalizeDraft: async () => {
          const { currentDraft } = get();
          if (!currentDraft) throw new Error("No draft to finalize");

          set((state) => {
            state.isSubmitting = true;
          });

          try {
            const result = await kbClient.draft.finalize(currentDraft.draft_id);

            set((state) => {
              state.isSubmitting = false;
              // Don't clear draft immediately - let processing page handle it
            });

            return {
              kbId: result.kb_id,
              pipelineId: result.pipeline_id,
            };
          } catch (error: unknown) {
            set((state) => {
              state.draftError = kbClient.errors.getUserMessage(error);
              state.isSubmitting = false;
            });
            throw error;
          }
        },

        clearDraft: () => {
          // Stop any ongoing polling
          const { currentDraft } = get();
          if (currentDraft) {
            kbClient.draft.delete(currentDraft.draft_id).catch(console.error);
          }

          set((state) => {
            state.currentDraft = null;
            state.draftSources = [];
            state.chunkingConfig = initialChunkingConfig;
            state.formData = initialFormData;
            state.isDraftDirty = false;
            state.draftError = null;
            state.previewData = null;
            state.quickPreviewData = null;
            state.formErrors = {};
          });

          // Clear local storage
          localStorage.removeItem("kb_draft_state");
        },

        saveDraftToLocalStorage: () => {
          const state = get();
          if (!state.currentDraft) return;

          const draftState = {
            draft: state.currentDraft,
            sources: state.draftSources,
            chunkingConfig: state.chunkingConfig,
            formData: state.formData,
            timestamp: Date.now(),
          };

          localStorage.setItem("kb_draft_state", JSON.stringify(draftState));
        },

        restoreDraftFromLocalStorage: () => {
          try {
            const stored = localStorage.getItem("kb_draft_state");
            if (!stored) return false;

            const { draft, sources, chunkingConfig, formData, timestamp } =
              JSON.parse(stored);

            // Check if expired (24 hours)
            if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
              localStorage.removeItem("kb_draft_state");
              return false;
            }

            set((state) => {
              state.currentDraft = draft;
              state.draftSources = sources;
              state.chunkingConfig = chunkingConfig;
              state.formData = formData;
              state.isDraftDirty = true;
            });

            return true;
          } catch (error) {
            console.error("Failed to restore draft:", error);
            localStorage.removeItem("kb_draft_state");
            return false;
          }
        },

        // ========================================
        // PREVIEW ACTIONS
        // ========================================
        quickPreview: async (url, options = {}) => {
          set((state) => {
            state.isLoadingPreview = true;
            state.previewError = null;
            state.quickPreviewData = null;
          });

          try {
            const { currentDraft } = get();
            if (!currentDraft) throw new Error("No draft available");

            const result = await kbClient.preview.quickPreview({
              url,
              ...(options.strategy && { chunking_config: { strategy: options.strategy } })
            });

            set((state) => {
              state.quickPreviewData = result;
              state.isLoadingPreview = false;
            });
          } catch (error: unknown) {
            set((state) => {
              state.previewError = kbClient.errors.getUserMessage(error);
              state.isLoadingPreview = false;
            });
          }
        },

        previewDraft: async (maxPages = 5) => {
          const { currentDraft } = get();
          if (!currentDraft) throw new Error("No draft available");

          set((state) => {
            state.isLoadingPreview = true;
            state.previewError = null;
            state.previewData = null;
          });

          try {
            const result = await kbClient.draft.preview(
              currentDraft.draft_id,
              maxPages
            );

            set((state) => {
              state.previewData = result;
              state.isLoadingPreview = false;
            });
          } catch (error: unknown) {
            set((state) => {
              state.previewError = kbClient.errors.getUserMessage(error);
              state.isLoadingPreview = false;
            });
          }
        },

        clearPreview: () => {
          set((state) => {
            state.previewData = null;
            state.quickPreviewData = null;
            state.previewError = null;
          });
        },

        // ========================================
        // PIPELINE ACTIONS
        // ========================================
        fetchPipelineStatus: async (pipelineId) => {
          try {
            const status = await kbClient.pipeline.getStatus(pipelineId);
            get().updatePipelineStatus(pipelineId, status);
            return status;
          } catch (error) {
            console.error("Failed to fetch pipeline status:", error);
            throw error;
          }
        },

        startPipelinePolling: (pipelineId, onComplete) => {
          // Stop existing polling for this pipeline
          get().stopPipelinePolling(pipelineId);

          const poll = async () => {
            try {
              const status = await kbClient.pipeline.getStatus(pipelineId);
              get().updatePipelineStatus(pipelineId, status);

              // Check if completed
              if (
                status.status === PipelineStatus.COMPLETED ||
                status.status === PipelineStatus.FAILED ||
                status.status === PipelineStatus.CANCELLED
              ) {
                get().stopPipelinePolling(pipelineId);
                onComplete?.(status);
                return;
              }

              // Schedule next poll
              const interval = setTimeout(poll, 3000);
              set((state) => {
                state.pollingIntervals[pipelineId] = interval;
              });
            } catch (error) {
              console.error("Pipeline polling error:", error);
              // Continue polling with exponential backoff
              const interval = setTimeout(poll, 5000);
              set((state) => {
                state.pollingIntervals[pipelineId] = interval;
              });
            }
          };

          // Start polling immediately
          poll();
        },

        stopPipelinePolling: (pipelineId) => {
          const { pollingIntervals } = get();
          const interval = pollingIntervals[pipelineId];
          if (interval) {
            clearTimeout(interval);
            set((state) => {
              delete state.pollingIntervals[pipelineId];
            });
          }
        },

        stopAllPolling: () => {
          const { pollingIntervals } = get();
          Object.values(pollingIntervals).forEach((interval: ReturnType<typeof setTimeout>) => clearTimeout(interval));
          set((state) => {
            state.pollingIntervals = {};
          });
        },

        updatePipelineStatus: (pipelineId, status) => {
          set((state) => {
            state.activePipelines[pipelineId] = status;
          });
        },

        // ========================================
        // FORM ACTIONS
        // ========================================
        setFormError: (field, error) => {
          set((state) => {
            state.formErrors[field] = error;
          });
        },

        clearFormError: (field) => {
          set((state) => {
            delete state.formErrors[field];
          });
        },

        clearAllFormErrors: () => {
          set((state) => {
            state.formErrors = {};
          });
        },

        validateForm: () => {
          const { formData } = get();
          const errors: Record<string, string> = {};

          // Validate required fields
          if (!formData.name.trim()) {
            errors.name = "Name is required";
          } else if (formData.name.length < 3) {
            errors.name = "Name must be at least 3 characters";
          } else if (formData.name.length > 100) {
            errors.name = "Name must be less than 100 characters";
          }

          if (!formData.workspace_id) {
            errors.workspace_id = "Workspace is required";
          }

          // Validate sources
          const { draftSources } = get();
          if (draftSources.length === 0) {
            errors.sources = "At least one source is required";
          }

          set((state) => {
            state.formErrors = errors;
          });

          return Object.keys(errors).length === 0;
        },

        resetForm: () => {
          set((state) => {
            state.formData = initialFormData;
            state.formErrors = {};
            state.chunkingConfig = initialChunkingConfig;
          });
        },
      }))
    ),
    {
      name: "kb-store",
    }
  )
);

// ========================================
// SELECTORS
// ========================================

/**
 * Useful selectors for components
 */
export const kbSelectors = {
  isDraftValid: (state: KBStoreState) =>
    state.formData.name.trim().length >= 3 &&
    state.formData.workspace_id &&
    state.draftSources.length > 0,

  hasActivePipeline: (state: KBStoreState) =>
    Object.values(state.activePipelines).some(
      (pipeline) =>
        pipeline.status === PipelineStatus.RUNNING ||
        pipeline.status === PipelineStatus.QUEUED
    ),

  getProcessingKBs: (state: KBStoreState) =>
    state.kbs.filter(
      (kb) =>
        kb.status === KBStatus.PROCESSING || kb.status === KBStatus.REINDEXING
    ),

  estimatedProcessingTime: (state: KBStoreState) => {
    const sources = state.draftSources.length;
    return sources * 5; // Rough estimate: 5 minutes per source
  },
};

// ========================================
// CLEANUP ON PAGE UNLOAD
// ========================================

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    // Stop all polling
    useKBStore.getState().stopAllPolling();
  });
}

export default useKBStore;
