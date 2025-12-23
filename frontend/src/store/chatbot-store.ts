/**
 * Chatbot Store - State management with Zustand
 *
 * WHY: Centralized state management for chatbot operations
 * HOW: Zustand store with draft management, test preview, and CRUD operations
 */

import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import chatbotClient from "@/api/chatbot";
import type {
  ChatbotSummary,
  Chatbot,
  ChatbotDraft,
  ChatbotFormData,
  ChatbotFormErrors,
  ChatbotListFilters,
  ChatbotCreationStep,
  KBAttachment,
  ChannelConfig,
  ChatMessage,
  SourceReference,
  DeploymentResponse,
} from "@/types/chatbot";
import {
  DEFAULT_APPEARANCE,
  DEFAULT_MEMORY,
  DEFAULT_MESSAGES,
  DEFAULT_BEHAVIOR,
  DEFAULT_VARIABLES_CONFIG,
  DeploymentChannel,
} from "@/types/chatbot";

// ========================================
// STORE STATE INTERFACE
// ========================================

interface ChatbotStoreState {
  // ========================================
  // LIST STATE
  // ========================================
  chatbots: ChatbotSummary[];
  isLoadingList: boolean;
  listError: string | null;
  filters: ChatbotListFilters;
  totalCount: number;

  // ========================================
  // DETAIL STATE
  // ========================================
  currentChatbot: Chatbot | null;
  isLoadingDetail: boolean;
  detailError: string | null;

  // ========================================
  // DRAFT STATE
  // ========================================
  currentDraft: ChatbotDraft | null;
  formData: ChatbotFormData;
  formErrors: ChatbotFormErrors;
  attachedKBs: KBAttachment[];
  currentStep: ChatbotCreationStep;
  isDraftDirty: boolean;
  isCreatingDraft: boolean;
  isSavingDraft: boolean;
  draftError: string | null;

  // ========================================
  // TEST/PREVIEW STATE
  // ========================================
  testMessages: ChatMessage[];
  isTestLoading: boolean;
  testSessionId: string | null;
  testSources: SourceReference[];
  testError: string | null;

  // ========================================
  // DEPLOYMENT STATE
  // ========================================
  isDeploying: boolean;
  deploymentResult: DeploymentResponse | null;
  deploymentError: string | null;
}

interface ChatbotStoreActions {
  // ========================================
  // LIST ACTIONS
  // ========================================
  fetchChatbots: (filters?: Partial<ChatbotListFilters>) => Promise<void>;
  setFilters: (filters: Partial<ChatbotListFilters>) => void;
  clearListError: () => void;

  // ========================================
  // DETAIL ACTIONS
  // ========================================
  fetchChatbot: (chatbotId: string) => Promise<void>;
  updateChatbot: (
    chatbotId: string,
    updates: Partial<ChatbotFormData>
  ) => Promise<void>;
  archiveChatbot: (chatbotId: string) => Promise<void>;
  restoreChatbot: (chatbotId: string) => Promise<void>;
  deleteChatbotPermanently: (chatbotId: string) => Promise<{
    sessions: number;
    api_keys: number;
    leads: number;
  }>;
  updateChatbotStatus: (chatbotId: string, newStatus: "active" | "paused") => Promise<void>;
  clearCurrentChatbot: () => void;

  // ========================================
  // DRAFT ACTIONS
  // ========================================
  createDraft: (
    workspaceId: string,
    initialData?: Partial<ChatbotFormData>
  ) => Promise<string>;
  updateFormData: (data: Partial<ChatbotFormData>) => void;
  saveDraft: () => Promise<void>;
  attachKB: (kbId: string, name: string, priority?: number) => Promise<void>;
  detachKB: (kbId: string) => Promise<void>;
  updateKBPriority: (kbId: string, priority: number) => void;
  toggleKB: (kbId: string, enabled: boolean) => void;
  setStep: (step: ChatbotCreationStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  validateStep: (step: ChatbotCreationStep) => boolean;
  clearDraft: () => void;
  deleteDraft: () => Promise<void>;
  saveDraftToLocalStorage: () => void;
  restoreDraftFromLocalStorage: () => boolean;
  setFormError: (field: keyof ChatbotFormErrors, error: string | undefined) => void;
  clearFormErrors: () => void;

  // ========================================
  // TEST ACTIONS
  // ========================================
  sendTestMessage: (message: string) => Promise<void>;
  clearTestConversation: () => void;

  // ========================================
  // DEPLOYMENT ACTIONS
  // ========================================
  updateChannels: (channels: ChannelConfig[]) => void;
  toggleChannel: (channelType: DeploymentChannel, enabled: boolean) => void;
  deploy: () => Promise<DeploymentResponse>;
  clearDeploymentResult: () => void;

  // ========================================
  // UTILITY ACTIONS
  // ========================================
  reset: () => void;
}

// ========================================
// INITIAL STATE
// ========================================

const initialFormData: ChatbotFormData = {
  name: "",
  description: "",
  system_prompt:
    "You are a helpful assistant. Be concise and helpful in your responses.",
  model: "secret-ai-v1",
  temperature: 0.7,
  max_tokens: 2000,
  instructions: [],
  restrictions: [],
  messages: DEFAULT_MESSAGES,
  behavior: DEFAULT_BEHAVIOR,
  variables_config: DEFAULT_VARIABLES_CONFIG,
  knowledge_bases: [],
  appearance: DEFAULT_APPEARANCE,
  memory: DEFAULT_MEMORY,
  channels: [{ type: DeploymentChannel.WEBSITE, enabled: true }],
  is_public: true,
};

const initialState: ChatbotStoreState = {
  // List state
  chatbots: [],
  isLoadingList: false,
  listError: null,
  filters: { workspace_id: "", limit: 50 },
  totalCount: 0,

  // Detail state
  currentChatbot: null,
  isLoadingDetail: false,
  detailError: null,

  // Draft state
  currentDraft: null,
  formData: initialFormData,
  formErrors: {},
  attachedKBs: [],
  currentStep: 1,
  isDraftDirty: false,
  isCreatingDraft: false,
  isSavingDraft: false,
  draftError: null,

  // Test state
  testMessages: [],
  isTestLoading: false,
  testSessionId: null,
  testSources: [],
  testError: null,

  // Deployment state
  isDeploying: false,
  deploymentResult: null,
  deploymentError: null,
};

// ========================================
// LOCAL STORAGE KEY
// ========================================

const DRAFT_STORAGE_KEY = "chatbot_draft_state";

// ========================================
// CREATE STORE
// ========================================

export const useChatbotStore = create<ChatbotStoreState & ChatbotStoreActions>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        ...initialState,

        // ========================================
        // LIST ACTIONS
        // ========================================

        fetchChatbots: async (filters) => {
          const state = get();
          const mergedFilters = { ...state.filters, ...filters };

          if (!mergedFilters.workspace_id) {
            set((s) => {
              s.listError = "Workspace ID is required";
            });
            return;
          }

          set((s) => {
            s.isLoadingList = true;
            s.listError = null;
            s.filters = mergedFilters;
          });

          try {
            const response = await chatbotClient.chatbot.list(mergedFilters);

            set((s) => {
              s.chatbots = response.items;
              s.totalCount = response.total;
              s.isLoadingList = false;
            });
          } catch (error) {
            set((s) => {
              s.isLoadingList = false;
              s.listError = chatbotClient.errors.getUserMessage(error);
            });
          }
        },

        setFilters: (filters) => {
          set((s) => {
            s.filters = { ...s.filters, ...filters };
          });
        },

        clearListError: () => {
          set((s) => {
            s.listError = null;
          });
        },

        // ========================================
        // DETAIL ACTIONS
        // ========================================

        fetchChatbot: async (chatbotId) => {
          set((s) => {
            s.isLoadingDetail = true;
            s.detailError = null;
          });

          try {
            const chatbot = await chatbotClient.chatbot.get(chatbotId);

            set((s) => {
              s.currentChatbot = chatbot;
              s.isLoadingDetail = false;
            });
          } catch (error) {
            set((s) => {
              s.isLoadingDetail = false;
              s.detailError = chatbotClient.errors.getUserMessage(error);
            });
          }
        },

        updateChatbot: async (chatbotId, updates) => {
          try {
            await chatbotClient.chatbot.update(chatbotId, {
              name: updates.name,
              description: updates.description,
              system_prompt: updates.system_prompt,
              model: updates.model,
              temperature: updates.temperature,
              max_tokens: updates.max_tokens,
              appearance: updates.appearance,
              memory: updates.memory,
            });

            // Refresh the chatbot
            await get().fetchChatbot(chatbotId);
          } catch (error) {
            throw new Error(chatbotClient.errors.getUserMessage(error));
          }
        },

        archiveChatbot: async (chatbotId) => {
          try {
            await chatbotClient.chatbot.archive(chatbotId);

            // Remove from list (or update status if showing archived)
            set((s) => {
              const chatbot = s.chatbots.find((cb) => cb.id === chatbotId);
              if (chatbot) {
                // Update status instead of removing
                chatbot.status = "archived" as ChatbotSummary["status"];
              }
              // If not filtering by archived, remove from visible list
              if (s.filters.status !== "archived") {
                s.chatbots = s.chatbots.filter((cb) => cb.id !== chatbotId);
                s.totalCount = Math.max(0, s.totalCount - 1);
              }
            });
          } catch (error) {
            throw new Error(chatbotClient.errors.getUserMessage(error));
          }
        },

        restoreChatbot: async (chatbotId) => {
          try {
            const result = await chatbotClient.chatbot.restore(chatbotId);

            // Update status in list
            set((s) => {
              const chatbot = s.chatbots.find((cb) => cb.id === chatbotId);
              if (chatbot) {
                chatbot.status = result.new_status as ChatbotSummary["status"];
              }
              // If filtering by archived, remove from visible list
              if (s.filters.status === "archived") {
                s.chatbots = s.chatbots.filter((cb) => cb.id !== chatbotId);
                s.totalCount = Math.max(0, s.totalCount - 1);
              }
            });
          } catch (error) {
            throw new Error(chatbotClient.errors.getUserMessage(error));
          }
        },

        deleteChatbotPermanently: async (chatbotId) => {
          try {
            const result = await chatbotClient.chatbot.deletePermanently(chatbotId);

            // Remove from list permanently
            set((s) => {
              s.chatbots = s.chatbots.filter((cb) => cb.id !== chatbotId);
              s.totalCount = Math.max(0, s.totalCount - 1);
            });

            return result.deleted_resources;
          } catch (error) {
            throw new Error(chatbotClient.errors.getUserMessage(error));
          }
        },

        updateChatbotStatus: async (chatbotId, newStatus) => {
          try {
            const result = await chatbotClient.chatbot.updateStatus(chatbotId, newStatus);

            // Update status in list
            set((s) => {
              const chatbot = s.chatbots.find((cb) => cb.id === chatbotId);
              if (chatbot) {
                chatbot.status = result.new_status as ChatbotSummary["status"];
              }
              // Also update current chatbot if it's the same one
              if (s.currentChatbot && s.currentChatbot.id === chatbotId) {
                s.currentChatbot.status = result.new_status as ChatbotSummary["status"];
              }
            });
          } catch (error) {
            throw new Error(chatbotClient.errors.getUserMessage(error));
          }
        },

        clearCurrentChatbot: () => {
          set((s) => {
            s.currentChatbot = null;
            s.detailError = null;
          });
        },

        // ========================================
        // DRAFT ACTIONS
        // ========================================

        createDraft: async (workspaceId, initialData) => {
          set((s) => {
            s.isCreatingDraft = true;
            s.draftError = null;
          });

          try {
            const mergedData = { ...initialFormData, ...initialData };

            const response = await chatbotClient.draft.create({
              name: mergedData.name || "New Chatbot",
              description: mergedData.description,
              workspace_id: workspaceId,
              model: mergedData.model,
              temperature: mergedData.temperature,
              max_tokens: mergedData.max_tokens,
              system_prompt: mergedData.system_prompt,
            });

            // Fetch the full draft
            const draft = await chatbotClient.draft.get(response.draft_id);

            set((s) => {
              s.currentDraft = draft;
              s.formData = {
                ...initialFormData,
                ...mergedData,
                name: draft.data.name,
              };
              s.attachedKBs = draft.data.knowledge_bases || [];
              s.currentStep = 1;
              s.isDraftDirty = false;
              s.isCreatingDraft = false;
            });

            return response.draft_id;
          } catch (error) {
            set((s) => {
              s.isCreatingDraft = false;
              s.draftError = chatbotClient.errors.getUserMessage(error);
            });
            throw error;
          }
        },

        updateFormData: (data) => {
          set((s) => {
            s.formData = { ...s.formData, ...data };
            s.isDraftDirty = true;
          });
        },

        saveDraft: async () => {
          const state = get();

          if (!state.currentDraft) {
            return;
          }

          set((s) => {
            s.isSavingDraft = true;
          });

          try {
            await chatbotClient.draft.update(state.currentDraft.id, {
              name: state.formData.name,
              description: state.formData.description,
              model: state.formData.model,
              temperature: state.formData.temperature,
              max_tokens: state.formData.max_tokens,
              system_prompt: state.formData.system_prompt,
              persona: state.formData.persona,
              instructions: state.formData.instructions,
              restrictions: state.formData.restrictions,
              messages: state.formData.messages,
              appearance: state.formData.appearance,
              memory: state.formData.memory,
              lead_capture: state.formData.lead_capture,
              variables_config: state.formData.variables_config,
            });

            set((s) => {
              s.isDraftDirty = false;
              s.isSavingDraft = false;
            });
          } catch (error) {
            set((s) => {
              s.isSavingDraft = false;
              s.draftError = chatbotClient.errors.getUserMessage(error);
            });
          }
        },

        attachKB: async (kbId, name, priority = 1) => {
          const state = get();

          if (!state.currentDraft) {
            throw new Error("No draft available");
          }

          try {
            await chatbotClient.draft.attachKB(state.currentDraft.id, {
              kb_id: kbId,
              enabled: true,
              priority,
            });

            const newKB: KBAttachment = {
              kb_id: kbId,
              name,
              enabled: true,
              priority,
            };

            set((s) => {
              s.attachedKBs = [...s.attachedKBs, newKB];
              s.formData.knowledge_bases = [...s.formData.knowledge_bases, newKB];
              s.isDraftDirty = true;
            });
          } catch (error) {
            throw new Error(chatbotClient.errors.getUserMessage(error));
          }
        },

        detachKB: async (kbId) => {
          const state = get();

          if (!state.currentDraft) {
            throw new Error("No draft available");
          }

          try {
            await chatbotClient.draft.detachKB(state.currentDraft.id, kbId);

            set((s) => {
              s.attachedKBs = s.attachedKBs.filter((kb) => kb.kb_id !== kbId);
              s.formData.knowledge_bases = s.formData.knowledge_bases.filter(
                (kb) => kb.kb_id !== kbId
              );
              s.isDraftDirty = true;
            });
          } catch (error) {
            throw new Error(chatbotClient.errors.getUserMessage(error));
          }
        },

        updateKBPriority: (kbId, priority) => {
          set((s) => {
            const kb = s.attachedKBs.find((k) => k.kb_id === kbId);
            if (kb) {
              kb.priority = priority;
              s.isDraftDirty = true;
            }
          });
        },

        toggleKB: (kbId, enabled) => {
          set((s) => {
            const kb = s.attachedKBs.find((k) => k.kb_id === kbId);
            if (kb) {
              kb.enabled = enabled;
              s.isDraftDirty = true;
            }
          });
        },

        setStep: (step) => {
          set((s) => {
            s.currentStep = step;
          });
        },

        nextStep: () => {
          set((s) => {
            if (s.currentStep < 5) {
              s.currentStep = (s.currentStep + 1) as ChatbotCreationStep;
            }
          });
        },

        prevStep: () => {
          set((s) => {
            if (s.currentStep > 1) {
              s.currentStep = (s.currentStep - 1) as ChatbotCreationStep;
            }
          });
        },

        validateStep: (step) => {
          const state = get();
          const errors: ChatbotFormErrors = {};

          switch (step) {
            case 1: // Basic Info
              if (!state.formData.name.trim()) {
                errors.name = "Name is required";
              } else if (state.formData.name.length < 3) {
                errors.name = "Name must be at least 3 characters";
              } else if (state.formData.name.length > 100) {
                errors.name = "Name must be less than 100 characters";
              }
              break;

            case 2: // Prompt & AI Config
              if (!state.formData.system_prompt.trim()) {
                errors.system_prompt = "System prompt is required";
              }
              if (
                state.formData.temperature < 0 ||
                state.formData.temperature > 2
              ) {
                errors.temperature = "Temperature must be between 0 and 2";
              }
              if (
                state.formData.max_tokens < 100 ||
                state.formData.max_tokens > 8000
              ) {
                errors.max_tokens = "Max tokens must be between 100 and 8000";
              }
              break;

            case 3: // Knowledge Bases - optional
              break;

            case 4: // Appearance & Behavior - optional
              break;

            case 5: {
              // Deploy
              const enabledChannels = state.formData.channels.filter(
                (c) => c.enabled
              );
              if (enabledChannels.length === 0) {
                errors.channels = "At least one channel must be enabled";
              }
              break;
            }
          }

          set((s) => {
            s.formErrors = errors;
          });

          return Object.keys(errors).length === 0;
        },

        clearDraft: () => {
          localStorage.removeItem(DRAFT_STORAGE_KEY);

          set((s) => {
            s.currentDraft = null;
            s.formData = initialFormData;
            s.formErrors = {};
            s.attachedKBs = [];
            s.currentStep = 1;
            s.isDraftDirty = false;
            s.draftError = null;
            s.testMessages = [];
            s.testSessionId = null;
            s.testSources = [];
            s.deploymentResult = null;
          });
        },

        deleteDraft: async () => {
          const state = get();

          if (!state.currentDraft) {
            return;
          }

          try {
            await chatbotClient.draft.delete(state.currentDraft.id);
            get().clearDraft();
          } catch (error) {
            throw new Error(chatbotClient.errors.getUserMessage(error));
          }
        },

        saveDraftToLocalStorage: () => {
          const state = get();

          if (!state.currentDraft) {
            return;
          }

          const draftState = {
            draftId: state.currentDraft.id,
            formData: state.formData,
            attachedKBs: state.attachedKBs,
            currentStep: state.currentStep,
            timestamp: Date.now(),
          };

          localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftState));
        },

        restoreDraftFromLocalStorage: () => {
          const stored = localStorage.getItem(DRAFT_STORAGE_KEY);

          if (!stored) {
            return false;
          }

          try {
            const { formData, attachedKBs, currentStep, timestamp } =
              JSON.parse(stored) as { draftId: string; formData: ChatbotFormData; attachedKBs: KBAttachment[]; currentStep: ChatbotCreationStep; timestamp: number };

            // Check if draft is expired (24 hours)
            if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
              localStorage.removeItem(DRAFT_STORAGE_KEY);
              return false;
            }

            set((s) => {
              s.formData = formData;
              s.attachedKBs = attachedKBs;
              s.currentStep = currentStep;
            });

            return true;
          } catch {
            localStorage.removeItem(DRAFT_STORAGE_KEY);
            return false;
          }
        },

        setFormError: (field, error) => {
          set((s) => {
            if (error) {
              s.formErrors[field] = error;
            } else {
              delete s.formErrors[field];
            }
          });
        },

        clearFormErrors: () => {
          set((s) => {
            s.formErrors = {};
          });
        },

        // ========================================
        // TEST ACTIONS
        // ========================================

        sendTestMessage: async (message) => {
          const state = get();

          if (!state.currentDraft) {
            throw new Error("No draft available");
          }

          // Add user message
          const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content: message,
            timestamp: new Date().toISOString(),
          };

          set((s) => {
            s.testMessages = [...s.testMessages, userMessage];
            s.isTestLoading = true;
            s.testError = null;
          });

          try {
            const response = await chatbotClient.draft.test(
              state.currentDraft.id,
              {
                message,
                session_id: state.testSessionId || undefined,
              }
            );

            // Add assistant message
            const assistantMessage: ChatMessage = {
              id: response.message_id,
              role: "assistant",
              content: response.response,
              sources: response.sources,
              timestamp: new Date().toISOString(),
            };

            set((s) => {
              s.testMessages = [...s.testMessages, assistantMessage];
              s.testSessionId = response.session_id;
              s.testSources = response.sources || [];
              s.isTestLoading = false;
            });
          } catch (error) {
            set((s) => {
              s.isTestLoading = false;
              s.testError = chatbotClient.errors.getUserMessage(error);
            });
            throw error;
          }
        },

        clearTestConversation: () => {
          set((s) => {
            s.testMessages = [];
            s.testSessionId = null;
            s.testSources = [];
            s.testError = null;
          });
        },

        // ========================================
        // DEPLOYMENT ACTIONS
        // ========================================

        updateChannels: (channels) => {
          set((s) => {
            s.formData.channels = channels;
            s.isDraftDirty = true;
          });
        },

        toggleChannel: (channelType, enabled) => {
          set((s) => {
            const channel = s.formData.channels.find(
              (c) => c.type === channelType
            );
            if (channel) {
              channel.enabled = enabled;
            } else {
              s.formData.channels.push({ type: channelType, enabled });
            }
            s.isDraftDirty = true;
          });
        },

        deploy: async () => {
          const state = get();

          if (!state.currentDraft) {
            throw new Error("No draft available");
          }

          set((s) => {
            s.isDeploying = true;
            s.deploymentError = null;
          });

          try {
            // Save draft first
            await get().saveDraft();

            // Deploy with all configuration
            const result = await chatbotClient.draft.deploy(
              state.currentDraft.id,
              {
                channels: state.formData.channels,
                is_public: state.formData.is_public,
                behavior: state.formData.behavior,
                conversation_openers: state.formData.behavior?.conversation_openers,
              }
            );

            set((s) => {
              s.isDeploying = false;
              s.deploymentResult = result;
            });

            // Clear draft after successful deployment
            localStorage.removeItem(DRAFT_STORAGE_KEY);

            return result;
          } catch (error) {
            set((s) => {
              s.isDeploying = false;
              s.deploymentError = chatbotClient.errors.getUserMessage(error);
            });
            throw error;
          }
        },

        clearDeploymentResult: () => {
          set((s) => {
            s.deploymentResult = null;
            s.deploymentError = null;
          });
        },

        // ========================================
        // UTILITY ACTIONS
        // ========================================

        reset: () => {
          set(() => initialState);
        },
      }))
    ),
    { name: "chatbot-store" }
  )
);

// ========================================
// SELECTORS
// ========================================

export const selectChatbots = (state: ChatbotStoreState) => state.chatbots;
export const selectCurrentChatbot = (state: ChatbotStoreState) =>
  state.currentChatbot;
export const selectCurrentDraft = (state: ChatbotStoreState) =>
  state.currentDraft;
export const selectFormData = (state: ChatbotStoreState) => state.formData;
export const selectFormErrors = (state: ChatbotStoreState) => state.formErrors;
export const selectAttachedKBs = (state: ChatbotStoreState) =>
  state.attachedKBs;
export const selectCurrentStep = (state: ChatbotStoreState) =>
  state.currentStep;
export const selectTestMessages = (state: ChatbotStoreState) =>
  state.testMessages;
export const selectDeploymentResult = (state: ChatbotStoreState) =>
  state.deploymentResult;

// Loading selectors
export const selectIsLoadingList = (state: ChatbotStoreState) =>
  state.isLoadingList;
export const selectIsLoadingDetail = (state: ChatbotStoreState) =>
  state.isLoadingDetail;
export const selectIsCreatingDraft = (state: ChatbotStoreState) =>
  state.isCreatingDraft;
export const selectIsSavingDraft = (state: ChatbotStoreState) =>
  state.isSavingDraft;
export const selectIsTestLoading = (state: ChatbotStoreState) =>
  state.isTestLoading;
export const selectIsDeploying = (state: ChatbotStoreState) =>
  state.isDeploying;

// Error selectors
export const selectListError = (state: ChatbotStoreState) => state.listError;
export const selectDetailError = (state: ChatbotStoreState) =>
  state.detailError;
export const selectDraftError = (state: ChatbotStoreState) => state.draftError;
export const selectTestError = (state: ChatbotStoreState) => state.testError;
export const selectDeploymentError = (state: ChatbotStoreState) =>
  state.deploymentError;
