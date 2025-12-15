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
  ModelConfig,
  VectorStoreProvider,
  DistanceMetric,
  IndexType,
  WebSourceConfig,
  AddWebSourceRequest,
  PipelineStatusResponse,
  PipelineStatus,
  PreviewResponse,
  QuickPreviewResponse,
  DraftValidationResponse,
  ApprovedSource,
  FinalizeRequest,
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
  modelConfig: ModelConfig;
  retrievalConfig: {
    strategy: 'semantic_search' | 'keyword_search' | 'hybrid_search' | 'mmr' | 'similarity_score_threshold';
    top_k: number;
    score_threshold: number;
    rerank_enabled: boolean;
  };
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
  updateModelConfig: (config: Partial<ModelConfig>) => void;
  updateRetrievalConfig: (config: Partial<KBStoreState['retrievalConfig']>) => void;
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
  approveContent: (pageIndices: number[], allPages: any[]) => Promise<ApprovedSource>;

  // ========================================
  // CONTENT EDITING ACTIONS
  // ========================================
  updatePageContent: (
    pageIndex: number,
    content: string,
    operations?: any[]
  ) => Promise<void>;
  revertPageContent: (pageIndex: number, revisionId?: string) => Promise<void>;
  exportContent: (
    pageIndices?: number[],
    format?: 'markdown' | 'plain_text' | 'html' | 'json'
  ) => Promise<string>;
  copyPageContent: (pageIndex: number, format?: 'markdown' | 'plain_text' | 'html') => Promise<string>;

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
  // Required parameters (user-configurable via UI)
  strategy: ChunkingStrategy.BY_HEADING,
  chunk_size: 1000, // User can modify via slider (100-4000)
  chunk_overlap: 200, // User can modify via slider (0-500)

  // Backend-supported parameters (user-configurable via UI)
  preserve_code_blocks: true, // User can modify via checkbox - API supports this
  preserve_structure: true, // User can modify via checkbox - Enhanced service supports this
  include_metadata: true, // User can modify via checkbox - Enhanced service supports this
  adaptive_sizing: false, // User can modify via checkbox - Enhanced service supports this
  context_window: 2, // User can modify via slider (0-5) - Enhanced service supports this

  // Additional parameters (user-configurable via UI - mixed backend support)
  semantic_threshold: 0.7, // User can modify via slider for semantic strategy (0-1)
  custom_separators: ['\n\n', '\n'], // User can modify via textarea for custom strategy
  min_chunk_size: 50, // User can modify via input (10-500)
  max_chunk_size: 2048, // User can modify via input (256-4096)
  preserve_headings: true, // User can modify via checkbox
  remove_duplicates: false, // User can modify via checkbox
  smart_splitting: true, // User can modify via checkbox
};

const initialModelConfig: ModelConfig = {
  embedding: {
    provider: 'local',
    model: 'all-MiniLM-L6-v2',
    dimensions: 384,
    batch_size: 32,
  },
  vector_store: {
    provider: VectorStoreProvider.QDRANT,
    settings: {
      collection_naming: 'kb_{kb_id}',
      distance_metric: DistanceMetric.COSINE,
      index_type: IndexType.HNSW,
      vector_size: 384,
      hnsw_config: {
        m: 16,
        ef_construct: 100,
      },
      batch_size: 100,
      indexing_threshold: 10000,
    },
  },
};

const initialRetrievalConfig = {
  strategy: 'hybrid_search' as const,
  top_k: 10,
  score_threshold: 0.7,
  rerank_enabled: false,
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
        modelConfig: initialModelConfig,
        retrievalConfig: initialRetrievalConfig,
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

            // Check if preview pages are provided in metadata (from extraction)
            const previewPages = (metadata as any)?.previewPages;

            if (previewPages && previewPages.length > 0) {
              // CRITICAL FIX: Transfer extracted content to main draft AND add sources to backend

              try {
                // STEP 1: Add sources to backend draft (required for approval API)
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

                const backendResult = await kbClient.draft.addWebSources(
                  currentDraft.draft_id,
                  request
                );

                // STEP 2: Create preview data structure with proper source IDs
                // CRITICAL: Clear approval flags - this is "add to draft", not "approve for KB"
                const previewDataForBackend = {
                  pages: previewPages.map((page: any, index: number) => ({
                    ...page,
                    word_count: page.content ? page.content.split(/\s+/).length : 0,
                    char_count: page.content ? page.content.length : 0,
                    // Map to backend source IDs
                    source_id: backendResult.source_id || backendResult.source_ids?.[0] || `source_${index}`,
                    // CLEAR APPROVAL STATE: Adding to draft ≠ approving for KB
                    is_approved: false,
                    approved_at: undefined,
                    approved_by: undefined
                  })),
                  pages_previewed: previewPages.length,
                  total_chunks: 0,
                  strategy: ChunkingStrategy.BY_HEADING,
                  generated_at: new Date().toISOString(),
                  config: { ...defaultConfig, ...config }
                };

                // STEP 3: Transfer preview data to main draft
                await kbClient.draft.updatePreviewData(currentDraft.draft_id, previewDataForBackend);

                // STEP 4: Update frontend state
                const newSources: DraftSource[] = [];
                const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];

                if (backendResult.source_ids && Array.isArray(backendResult.source_ids)) {
                  // Bulk response
                  backendResult.source_ids.forEach((sourceId, index) => {
                    const url = urls[index];
                    if (url && sourceId) {
                      newSources.push({
                        source_id: sourceId,
                        type: SourceType.WEB,
                        url,
                        config: { ...defaultConfig, ...perUrlConfigs[url] || config },
                        status: "completed",
                        created_at: new Date().toISOString(),
                        metadata: {
                          ...metadata,
                          hasPreviewData: true,
                          // CLEAN PREVIEW PAGES: Remove any preview approval states
                          previewPages: previewPages.map((page: any) => ({
                            ...page,
                            is_approved: false,
                            approved_at: undefined,
                            approved_by: undefined
                          }))
                        }
                      });
                    }
                  });
                } else if (backendResult.source_id) {
                  // Single response
                  newSources.push({
                    source_id: backendResult.source_id,
                    type: SourceType.WEB,
                    url: urls[0],
                    config: { ...defaultConfig, ...config },
                    status: "completed",
                    created_at: new Date().toISOString(),
                    metadata: {
                      ...metadata,
                      hasPreviewData: true,
                      // CLEAN PREVIEW PAGES: Remove any preview approval states
                      previewPages: previewPages.map((page: any) => ({
                        ...page,
                        is_approved: false,
                        approved_at: undefined,
                        approved_by: undefined
                      }))
                    }
                  });
                }

                set((state) => {
                  state.previewData = {
                    draft_id: currentDraft.draft_id,
                    pages_previewed: previewPages.length,
                    total_chunks: 0,
                    strategy: ChunkingStrategy.BY_HEADING,
                    pages: previewPages.map((page: any) => ({
                      ...page,
                      is_approved: false,
                      approved_at: undefined,
                      approved_by: undefined
                    })),
                    estimated_total_chunks: 0
                  };

                  state.draftSources.push(...newSources);
                  state.isDraftDirty = true;
                });

                get().saveDraftToLocalStorage();
                return newSources;
              } catch (error) {
                throw error;
              }
            }

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


            // Handle both single and bulk response formats
            if (!result) {
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
                    metadata: {
                      ...metadata,
                      hasPreviewData: !!previewPages
                    }
                  });
                }
              });

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
                metadata: {
                  ...metadata,
                  hasPreviewData: !!previewPages
                }
              });
            }
            else {
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
          // File upload feature is not yet implemented
          const error = new Error("📄 File Upload - Coming Soon!\n\nFile upload functionality is currently under development. Please use web URLs for now, or check back soon for file upload support.");
          set((state) => {
            state.draftError = "File upload feature is coming soon! Please use web URLs for now.";
          });
          throw error;
        },

        addTextSource: async (content: string, title?: string) => {
          // Text source feature is not yet implemented
          const error = new Error("📝 Text Sources - Coming Soon!\n\nDirect text input functionality is currently under development. Please use web URLs for now, or check back soon for text paste support.");
          set((state) => {
            state.draftError = "Text sources feature is coming soon! Please use web URLs for now.";
          });
          throw error;
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
            .catch(() => {
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
            // CRITICAL FIX: Send COMPLETE chunking configuration, not just changed fields
            const completeChunkingConfig = get().chunkingConfig;
            // Update backend draft with COMPLETE chunking config
            kbClient.draft.updateChunking(currentDraft.draft_id, { chunking_config: completeChunkingConfig })
              .catch(() => {
                // Silently handle errors - UI will show validation on finalize
              });
          }

          get().saveDraftToLocalStorage();
        },

        updateModelConfig: (config) => {
          set((state) => {
            state.modelConfig = { ...state.modelConfig, ...config };
            state.isDraftDirty = true;
          });

          const { currentDraft } = get();

          if (currentDraft) {
            // Call backend API to save model configuration
            const modelConfig = get().modelConfig;
            const apiRequest = {
              embedding_config: {
                model: modelConfig.embedding.model,
                device: 'cpu',
                batch_size: modelConfig.embedding.batch_size,
                normalize_embeddings: true,
              },
              vector_store_config: {
                provider: modelConfig.vector_store.provider,
                collection_name_prefix: 'kb_',
                distance_metric: (modelConfig.vector_store.settings as any).distance_metric,
              },
              retrieval_config: {
                strategy: 'hybrid_search',
                top_k: 5, // Default backend value
                score_threshold: 0.7,
                rerank_enabled: false,
              }
            };

            kbClient.draft.configureModels(currentDraft.draft_id, apiRequest)
              .catch(() => {
                // Silently handle errors - UI will show validation on finalize
              });
          }

          get().saveDraftToLocalStorage();
        },

        updateRetrievalConfig: (config) => {
          set((state) => {
            state.retrievalConfig = { ...state.retrievalConfig, ...config };
            state.isDraftDirty = true;
          });

          const { currentDraft } = get();

          if (currentDraft) {
            // Build API request for retrieval config
            const retrievalConfig = get().retrievalConfig;
            const apiRequest = {
              retrieval_config: {
                strategy: retrievalConfig.strategy,
                top_k: retrievalConfig.top_k,
                score_threshold: retrievalConfig.score_threshold,
                rerank_enabled: retrievalConfig.rerank_enabled,
              }
            };

            // Note: Need to implement backend endpoint for retrieval config
            // For now, we'll call model config endpoint which includes retrieval
            kbClient.draft.configureModels(currentDraft.draft_id, {
              embedding_config: {
                model: get().modelConfig.embedding.model,
                device: 'cpu',
                batch_size: get().modelConfig.embedding.batch_size,
                normalize_embeddings: true,
              },
              vector_store_config: {
                provider: get().modelConfig.vector_store.provider,
                collection_name_prefix: 'kb_',
                distance_metric: (get().modelConfig.vector_store.settings as any).distance_metric,
              },
              retrieval_config: apiRequest.retrieval_config
            })
              .catch(() => {
                // Silently handle errors - UI will show validation on finalize
              });
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
          const { currentDraft, chunkingConfig, modelConfig, retrievalConfig } = get();
          if (!currentDraft) throw new Error("No draft to finalize");

          set((state) => {
            state.isSubmitting = true;
          });

          try {
            // Save all current configurations to Redis before finalization
            // This prevents the race condition where frontend state differs from Redis state

            // 1. Save chunking configuration
            const completeChunkingConfig = {
              strategy: chunkingConfig.strategy,
              chunk_size: chunkingConfig.chunk_size,
              chunk_overlap: chunkingConfig.chunk_overlap,
              preserve_code_blocks: chunkingConfig.preserve_code_blocks,
              preserve_structure: chunkingConfig.preserve_structure,
              include_metadata: chunkingConfig.include_metadata,
              adaptive_sizing: chunkingConfig.adaptive_sizing,
              context_window: chunkingConfig.context_window,
              preserve_headings: chunkingConfig.preserve_headings,
              min_chunk_size: chunkingConfig.min_chunk_size,
              max_chunk_size: chunkingConfig.max_chunk_size,
              semantic_threshold: chunkingConfig.semantic_threshold,
              custom_separators: chunkingConfig.custom_separators,
              remove_duplicates: chunkingConfig.remove_duplicates,
              smart_splitting: chunkingConfig.smart_splitting
            };
            await kbClient.draft.updateChunking(currentDraft.draft_id, {
              chunking_config: completeChunkingConfig
            });

            // 2. Save model & embedding configurations
            const modelConfigRequest = {
              embedding_config: {
                model: modelConfig.embedding.model,
                device: 'cpu',
                batch_size: modelConfig.embedding.batch_size,
                normalize_embeddings: true,
              },
              vector_store_config: {
                provider: modelConfig.vector_store.provider,
                collection_name_prefix: 'kb_',
                distance_metric: (modelConfig.vector_store.settings as any).distance_metric,
              },
              retrieval_config: {
                strategy: retrievalConfig.strategy,
                top_k: retrievalConfig.top_k,
                score_threshold: retrievalConfig.score_threshold,
                rerank_enabled: retrievalConfig.rerank_enabled,
              }
            };

            await kbClient.draft.configureModels(currentDraft.draft_id, modelConfigRequest);

            // Now finalize with the saved configurations
            const finalizeRequest: FinalizeRequest = {
              chunking_config: {
                strategy: chunkingConfig.strategy,
                chunk_size: chunkingConfig.chunk_size,
                chunk_overlap: chunkingConfig.chunk_overlap,
                preserve_headings: chunkingConfig.preserve_headings,
                min_chunk_size: chunkingConfig.min_chunk_size,
                max_chunk_size: chunkingConfig.max_chunk_size
              },
              embedding_config: {
                model: modelConfig.embedding.model,
                batch_size: modelConfig.embedding.batch_size,
                device: "cpu",
                normalize: true
              },
              vector_store_config: {
                provider: modelConfig.vector_store.provider,
                settings: modelConfig.vector_store.settings
              },
              retrieval_config: {
                strategy: retrievalConfig.strategy,
                top_k: retrievalConfig.top_k,
                score_threshold: retrievalConfig.score_threshold,
                rerank_enabled: retrievalConfig.rerank_enabled,
              },
              indexing_method: modelConfig.indexing_method ?? 'balanced',
              priority: "normal"
            };

            const result = await kbClient.draft.finalize(currentDraft.draft_id, finalizeRequest);

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
            kbClient.draft.delete(currentDraft.draft_id).catch(() => {});
          }

          set((state) => {
            state.currentDraft = null;
            state.draftSources = [];
            state.chunkingConfig = initialChunkingConfig;
            state.modelConfig = initialModelConfig;
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
            modelConfig: state.modelConfig,
            formData: state.formData,
            timestamp: Date.now(),
          };

          localStorage.setItem("kb_draft_state", JSON.stringify(draftState));
        },

        restoreDraftFromLocalStorage: () => {
          try {
            const stored = localStorage.getItem("kb_draft_state");
            if (!stored) return false;

            const { draft, sources, chunkingConfig, modelConfig, formData, timestamp } =
              JSON.parse(stored);

            // Check if expired (24 hours)
            if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
              localStorage.removeItem("kb_draft_state");
              return false;
            }

            set((state) => {
              state.currentDraft = draft;
              state.draftSources = sources;
              state.chunkingConfig = chunkingConfig || initialChunkingConfig;
              state.modelConfig = modelConfig || initialModelConfig;
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

        approveContent: async (pageIndices: number[], allPages: any[]) => {
          const { currentDraft } = get();
          if (!currentDraft) throw new Error("No draft available");

          try {
            // Group selected pages by source_id for source-centric approval
            const sourceGroups = new Map<string, {
              source_id: string;
              approved_page_indices: number[];
              page_updates: Array<{
                page_index: number;
                edited_content?: string;
                is_edited: boolean;
              }>;
            }>();

            // Process each selected page and group by source
            pageIndices.forEach(globalIndex => {
              const page = allPages[globalIndex];
              if (!page?.sourceId) return;

              if (!sourceGroups.has(page.sourceId)) {
                sourceGroups.set(page.sourceId, {
                  source_id: page.sourceId,
                  approved_page_indices: [],
                  page_updates: []
                });
              }

              const group = sourceGroups.get(page.sourceId)!;

              // Find the page index within this specific source
              const sourcePages = allPages.filter(p => p.sourceId === page.sourceId);
              const sourcePageIndex = sourcePages.findIndex(p => p.originalIndex === page.originalIndex);

              if (sourcePageIndex !== -1) {
                group.approved_page_indices.push(sourcePageIndex);

                // Include page update if content was edited OR needs re-approval
                if ((page.is_edited || page.needs_reapproval) && page.edited_content) {
                  group.page_updates.push({
                    page_index: sourcePageIndex,
                    edited_content: page.edited_content,
                    is_edited: true
                  });
                } else if (page.needs_reapproval) {
                  // Even without edited_content, if needs_reapproval is true, include it as an edit
                  group.page_updates.push({
                    page_index: sourcePageIndex,
                    is_edited: true
                  });
                }
              }
            });

            // Convert map to array for API call
            const sourceApprovals = Array.from(sourceGroups.values());

            // Call the new source-centric API
            const result = await kbClient.draft.approveSources(
              currentDraft.draft_id,
              sourceApprovals
            );

            // Handle backend duplicate prevention
            if (!result.success) {
              if (result.summary?.duplicate_prevention_triggered) {
                // All pages were already approved
                throw new Error("All selected pages have already been approved previously. Please select different pages or navigate to see the current approval status.");
              } else {
                // Other failure
                throw new Error(result.message || "Failed to approve content");
              }
            }

            set((state) => {
              state.isDraftDirty = true;
            });

            get().saveDraftToLocalStorage();

            // Return compatible ApprovedSource format
            return {
              id: `approved_${Date.now()}`,
              type: 'approved_content' as const,
              name: `Approved Content (${result.summary.total_pages_approved} pages)`,
              status: 'approved' as const,
              approved_pages: [], // Backend handles the full structure
              metadata: {
                total_pages: result.summary.total_pages_approved,
                total_content_size: 0, // Will be calculated by backend
                edited_pages: result.summary.total_edited_pages,
                original_url: '',
                approval_source: 'content_review'
              },
              added_at: new Date().toISOString(),
              added_by: ''
            };
          } catch (error: unknown) {
            set((state) => {
              state.draftError = kbClient.errors.getUserMessage(error);
            });
            throw error;
          }
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
            state.modelConfig = initialModelConfig;
          });
        },

        // ========================================
        // CONTENT EDITING ACTIONS
        // ========================================
        updatePageContent: async (pageIndex, content, operations = []) => {
          const { currentDraft } = get();
          if (!currentDraft) {
            throw new Error("No draft found");
          }

          try {
            // Update the local state only (no backend API call needed)
            set((state) => {
              if (!state.previewData?.pages) return;

              const page = state.previewData.pages[pageIndex];
              if (page) {
                (page as any).edited_content = content;
                (page as any).is_edited = true;
                (page as any).last_edited_at = new Date().toISOString();
              }
            });
          } catch (error) {
            console.error("Failed to update page content:", error);
            throw error;
          }
        },

        revertPageContent: async (pageIndex, revisionId) => {
          const { currentDraft } = get();
          if (!currentDraft) {
            throw new Error("No draft found");
          }

          try {
            // Update the local state only (no backend API call needed)
            set((state) => {
              if (!state.previewData?.pages) return;

              const page = state.previewData.pages[pageIndex];
              if (page) {
                if (revisionId) {
                  // Reverted to specific revision - keep as edited
                  (page as any).is_edited = true;
                } else {
                  // Reverted to original - clear edited state
                  delete (page as any).edited_content;
                  (page as any).is_edited = false;
                }
                (page as any).last_edited_at = new Date().toISOString();
              }
            });
          } catch (error) {
            console.error("Failed to revert page content:", error);
            throw error;
          }
        },

        exportContent: async (pageIndices, format = 'markdown') => {
          const { currentDraft } = get();
          if (!currentDraft) {
            throw new Error("No draft found");
          }

          try {
            // Export content locally (no backend API call needed)
            const { previewData } = get();
            if (!previewData?.pages) {
              throw new Error("No preview data available");
            }

            const pagesToExport = pageIndices ?
              pageIndices.map(i => previewData.pages[i]).filter(Boolean) :
              previewData.pages;

            const content = pagesToExport.map(page => {
              const text = (page as any).edited_content || (page as any).content || '';
              return text;
            }).join('\n\n---\n\n');

            return content;
          } catch (error) {
            console.error("Failed to export content:", error);
            throw error;
          }
        },

        copyPageContent: async (pageIndex, format = 'markdown') => {
          const { currentDraft } = get();
          if (!currentDraft) {
            throw new Error("No draft found");
          }

          try {
            // Copy page content locally (no backend API call needed)
            const { previewData } = get();
            if (!previewData?.pages) {
              throw new Error("No preview data available");
            }

            const page = previewData.pages[pageIndex];
            if (!page) {
              throw new Error("Page not found");
            }

            const content = (page as any).edited_content || (page as any).content || '';

            // Copy to clipboard
            await navigator.clipboard.writeText(content);
            return content;
          } catch (error) {
            console.error("Failed to copy page content:", error);
            throw error;
          }
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
