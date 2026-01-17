/**
 * Chatbot Type Definitions
 *
 * WHY: Type-safe chatbot management matching backend API at /api/v1/chatbots/
 * HOW: Comprehensive TypeScript interfaces for draft, deployed, and config types
 */

// ========================================
// ENUMS & CONSTANTS
// ========================================

/**
 * Chatbot Status - Lifecycle states
 */
export const ChatbotStatus = {
  DRAFT: "draft",
  ACTIVE: "active",
  PAUSED: "paused",
  ARCHIVED: "archived",
} as const;

export type ChatbotStatus = (typeof ChatbotStatus)[keyof typeof ChatbotStatus];

/**
 * Deployment Channels
 */
export const DeploymentChannel = {
  WEBSITE: "website",
  TELEGRAM: "telegram",
  DISCORD: "discord",
  WHATSAPP: "whatsapp",
  API: "api",
  SECRETVM: "secretvm",
} as const;

export type DeploymentChannel = (typeof DeploymentChannel)[keyof typeof DeploymentChannel];

/**
 * Creation Wizard Steps
 */
export const ChatbotCreationStep = {
  BASIC_INFO: 1,
  PROMPT_AI_CONFIG: 2,
  KNOWLEDGE_BASES: 3,
  APPEARANCE_BEHAVIOR: 4,
  DEPLOY: 5,
} as const;

export type ChatbotCreationStep = (typeof ChatbotCreationStep)[keyof typeof ChatbotCreationStep];

/**
 * AI Model Options
 * Backend uses Secret AI (DeepSeek-R1-Distill-Llama-70B)
 */
export const AIModel = {
  SECRET_AI: "secret-ai-v1",
} as const;

export type AIModel = (typeof AIModel)[keyof typeof AIModel];

/**
 * Persona Tone Options
 */
export const PersonaTone = {
  PROFESSIONAL: "professional",
  FRIENDLY: "friendly",
  CASUAL: "casual",
  FORMAL: "formal",
} as const;

export type PersonaTone = (typeof PersonaTone)[keyof typeof PersonaTone];

/**
 * Grounding Mode - How strictly AI uses knowledge base
 *
 * STRICT: AI ONLY answers from KB, refuses if not found (Recommended)
 * GUIDED: AI prefers KB but can supplement with general knowledge (with disclosure)
 * FLEXIBLE: AI uses KB to enhance responses, freely uses general knowledge
 */
export const GroundingMode = {
  STRICT: "strict",
  GUIDED: "guided",
  FLEXIBLE: "flexible",
} as const;

export type GroundingMode = (typeof GroundingMode)[keyof typeof GroundingMode];

/**
 * Widget Position Options
 */
export const WidgetPosition = {
  BOTTOM_RIGHT: "bottom-right",
  BOTTOM_LEFT: "bottom-left",
} as const;

export type WidgetPosition = (typeof WidgetPosition)[keyof typeof WidgetPosition];

/**
 * Lead Capture Timing Options (Simplified)
 */
export const LeadCaptureTiming = {
  BEFORE_CHAT: "before_chat",
  AFTER_N_MESSAGES: "after_n_messages",
} as const;

export type LeadCaptureTiming = (typeof LeadCaptureTiming)[keyof typeof LeadCaptureTiming];

/**
 * Field Visibility Options for Standard Fields
 */
export const FieldVisibility = {
  REQUIRED: "required",
  OPTIONAL: "optional",
  HIDDEN: "hidden",
} as const;

export type FieldVisibility = (typeof FieldVisibility)[keyof typeof FieldVisibility];

/**
 * Custom Field Types (Basic)
 */
export const CustomFieldType = {
  TEXT: "text",
  EMAIL: "email",
  PHONE: "phone",
  SELECT: "select",
} as const;

export type CustomFieldType = (typeof CustomFieldType)[keyof typeof CustomFieldType];

// ========================================
// CONFIGURATION TYPES
// ========================================

/**
 * Persona Configuration
 */
export interface PersonaConfig {
  name?: string;
  role?: string;
  tone?: PersonaTone;
  personality_traits?: string[];
}

/**
 * Instruction Item - Custom instructions for the AI
 */
export interface InstructionItem {
  id: string;
  content: string;
  enabled: boolean;
}

/**
 * Restriction Item - Things the AI should not do
 */
export interface RestrictionItem {
  id: string;
  content: string;
  enabled: boolean;
}

/**
 * Custom Messages Configuration
 */
export interface MessagesConfig {
  greeting?: string;
}

/**
 * Widget Appearance Configuration
 */
export interface AppearanceConfig {
  primary_color?: string;
  secondary_color?: string;
  font_family?: string;
  avatar_url?: string;
  chat_title?: string;
  position?: WidgetPosition;
  bubble_style?: "rounded" | "square";
}

/**
 * Memory Configuration
 */
export interface MemoryConfig {
  enabled: boolean;
  max_messages: number;
  summary_enabled?: boolean;
}

/**
 * Behavior Configuration - AI response features
 */
export interface BehaviorConfig {
  enable_citations?: boolean;
  enable_follow_up_questions?: boolean;
  conversation_openers?: string[];
  grounding_mode?: GroundingMode;
}

/**
 * Lead Capture Field - For form-based capture (web)
 */
export interface LeadCaptureField {
  name: string;
  type: CustomFieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];  // For 'select' type
}

/**
 * Custom Field Definition - User-defined fields
 */
export interface LeadCaptureCustomField {
  id: string;              // Unique identifier (e.g., "cf_company")
  name: string;            // Field name (e.g., "company")
  type: CustomFieldType;
  label: string;           // Display label (e.g., "Company Name")
  required: boolean;
  placeholder?: string;
  options?: string[];      // For 'select' type
}

/**
 * Standard Fields Configuration - email, name, phone visibility
 */
export interface StandardFieldsConfig {
  email: FieldVisibility;
  name: FieldVisibility;
  phone: FieldVisibility;
}

/**
 * Platform-specific lead capture settings
 */
export interface LeadCapturePlatformConfig {
  enabled: boolean;            // Enable lead capture for this platform
  prompt_for_email?: boolean;  // Messaging: prompt for email in conversation
  prompt_for_phone?: boolean;  // Messaging: prompt for phone in conversation (Telegram only)
}

/**
 * Privacy & consent settings
 */
export interface LeadCapturePrivacyConfig {
  require_consent: boolean;
  consent_message: string;
  auto_capture_notice: string;  // Transparency message about IP/browser capture
}

/**
 * Lead Capture Configuration - Multi-Platform Support
 *
 * Stored in chatbot.lead_capture_config (JSONB)
 * One chatbot = one lead form config
 */
export interface LeadCaptureConfig {
  // Master switch
  enabled: boolean;

  // Timing configuration
  timing: LeadCaptureTiming;
  messages_before_prompt?: number;  // 1-10, used when timing='after_n_messages'

  // Standard fields configuration (for web form)
  fields: StandardFieldsConfig;

  // Custom fields (optional, user-defined)
  custom_fields?: LeadCaptureCustomField[];

  // Allow skip option (web form only)
  allow_skip: boolean;

  // Privacy & consent
  privacy: LeadCapturePrivacyConfig;

  // Platform-specific settings (each can be enabled independently)
  platforms: {
    web: LeadCapturePlatformConfig;       // Widget + Public page (share same config)
    telegram: LeadCapturePlatformConfig;
    discord: LeadCapturePlatformConfig;
    whatsapp: LeadCapturePlatformConfig;
  };
}

/**
 * Default Lead Capture Configuration
 */
export const DEFAULT_LEAD_CAPTURE_CONFIG: LeadCaptureConfig = {
  enabled: false,
  timing: LeadCaptureTiming.BEFORE_CHAT,
  messages_before_prompt: 3,
  fields: {
    email: FieldVisibility.REQUIRED,
    name: FieldVisibility.OPTIONAL,
    phone: FieldVisibility.HIDDEN,
  },
  custom_fields: [],
  allow_skip: true,
  privacy: {
    require_consent: false,
    consent_message: 'I agree to the collection and processing of my data.',
    auto_capture_notice: 'We collect IP address and browser info for analytics.',
  },
  platforms: {
    web: { enabled: true },
    telegram: { enabled: false, prompt_for_email: false },
    discord: { enabled: false, prompt_for_email: false },
    whatsapp: { enabled: false, prompt_for_email: false },
  },
};

// ========================================
// VARIABLE COLLECTION TYPES
// ========================================

/**
 * Variable Field Types
 */
export const VariableFieldType = {
  TEXT: "text",
  EMAIL: "email",
  PHONE: "phone",
  NUMBER: "number",
  SELECT: "select",
} as const;

export type VariableFieldType = (typeof VariableFieldType)[keyof typeof VariableFieldType];

/**
 * Variable Collection Timing
 */
export const VariableCollectionTiming = {
  BEFORE_CHAT: "before_chat",
  ON_DEMAND: "on_demand",
} as const;

export type VariableCollectionTiming = (typeof VariableCollectionTiming)[keyof typeof VariableCollectionTiming];

/**
 * Variable Field - A single variable to collect
 *
 * Variables can be referenced in system prompt using {{variable_name}} syntax
 * Example: "You are helping {{user_name}} who works at {{company}}."
 */
export interface VariableField {
  id: string;
  name: string; // Variable name for {{name}} substitution (no spaces, alphanumeric + underscore)
  type: VariableFieldType;
  label: string; // Display label for the form
  placeholder?: string;
  required: boolean;
  default_value?: string;
  options?: string[]; // For select type
}

/**
 * Variables Configuration
 */
export interface VariablesConfig {
  enabled: boolean;
  variables: VariableField[];
  collection_timing: VariableCollectionTiming;
}

/**
 * Default Variables Configuration
 */
export const DEFAULT_VARIABLES_CONFIG: VariablesConfig = {
  enabled: false,
  variables: [],
  collection_timing: VariableCollectionTiming.BEFORE_CHAT,
};

/**
 * AI Configuration
 */
export interface AIConfig {
  model: string;
  temperature: number;
  max_tokens: number;
}

/**
 * Prompt Configuration
 */
export interface PromptConfig {
  system_prompt: string;
  persona?: PersonaConfig;
  instructions?: InstructionItem[];
  restrictions?: RestrictionItem[];
  messages?: MessagesConfig;
}

// ========================================
// KNOWLEDGE BASE ATTACHMENT TYPES
// ========================================

/**
 * Knowledge Base Attachment
 */
export interface KBAttachment {
  kb_id: string;
  name: string;
  enabled: boolean;
  priority: number;
  retrieval_override?: {
    top_k?: number;
    score_threshold?: number;
    strategy?: string;
  };
}

/**
 * Request to attach a KB
 */
export interface AttachKBRequest {
  kb_id: string;
  enabled?: boolean;
  priority?: number;
  retrieval_override?: Record<string, unknown>;
}

// ========================================
// DEPLOYMENT TYPES
// ========================================

/**
 * Channel Configuration
 */
export interface ChannelConfig {
  type: DeploymentChannel;
  enabled: boolean;
  config?: Record<string, unknown>;
  credential_id?: string; // For channels requiring bot tokens (Telegram, Discord)
}

/**
 * Deploy Chatbot Request
 */
export interface DeployChatbotRequest {
  channels: ChannelConfig[];
  is_public?: boolean;
  behavior?: BehaviorConfig;
  conversation_openers?: string[];
}

/**
 * Deployment Response - Contains API key shown only once
 */
export interface DeploymentResponse {
  status: string;
  chatbot_id: string;
  api_key: string;
  api_key_prefix: string;
  channels: Record<string, unknown>;
  message: string;
}

/**
 * API Key Info - For listing keys (without the actual key for security)
 */
export interface APIKeyInfo {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  created_at: string;
  last_used_at?: string | null;
  expires_at?: string | null;
}

/**
 * API Key Create Response - Contains the actual key (shown only once!)
 */
export interface APIKeyCreateResponse {
  id: string;
  name: string;
  key_prefix: string;
  api_key: string;
  message: string;
}

// ========================================
// DRAFT TYPES (Phase 1 - Redis)
// ========================================

/**
 * Create Chatbot Draft Request
 */
export interface CreateChatbotDraftRequest {
  name: string;
  description?: string;
  workspace_id: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  system_prompt?: string;
}

/**
 * Update Chatbot Draft Request
 */
export interface UpdateChatbotDraftRequest {
  name?: string;
  description?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  system_prompt?: string;
  persona?: PersonaConfig;
  instructions?: InstructionItem[];
  restrictions?: RestrictionItem[];
  messages?: MessagesConfig;
  appearance?: AppearanceConfig;
  memory?: MemoryConfig;
  lead_capture?: LeadCaptureConfig;
  variables_config?: VariablesConfig;
  is_public?: boolean;
}

/**
 * Chatbot Draft Data - Stored in Redis
 */
export interface ChatbotDraftData {
  name: string;
  description?: string;
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  persona?: PersonaConfig;
  instructions?: InstructionItem[];
  restrictions?: RestrictionItem[];
  messages?: MessagesConfig;
  knowledge_bases: KBAttachment[];
  appearance: AppearanceConfig;
  memory: MemoryConfig;
  lead_capture?: LeadCaptureConfig;
  deployment: { channels: ChannelConfig[] };
}

/**
 * Chatbot Draft Response
 */
export interface ChatbotDraft {
  id: string;
  type: string;
  workspace_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  data: ChatbotDraftData;
  preview?: unknown;
}

/**
 * Draft Creation Response
 */
export interface CreateDraftResponse {
  draft_id: string;
  expires_at: string;
  message: string;
}

// ========================================
// DEPLOYED CHATBOT TYPES (Phase 3)
// ========================================

/**
 * Chatbot Metrics
 */
export interface ChatbotMetrics {
  total_conversations: number;
  total_messages: number;
  avg_response_time_ms?: number;
  avg_messages_per_session?: number;
  active_sessions?: number;
  satisfaction_rate?: number;
  last_updated?: string;
}

/**
 * Chatbot Summary - For list views
 */
export interface ChatbotSummary {
  id: string;
  name: string;
  description?: string;
  status: ChatbotStatus;
  created_at: string;
  deployed_at?: string;
  cached_metrics: ChatbotMetrics;
}

/**
 * Full Chatbot - For detail views
 */
export interface Chatbot {
  id: string;
  name: string;
  slug?: string;
  workspace_slug?: string;
  description?: string;
  status: ChatbotStatus;
  is_public?: boolean;
  workspace_id: string;
  ai_config: AIConfig;
  prompt_config: PromptConfig;
  kb_config: {
    knowledge_bases?: KBAttachment[];
  };
  branding_config: AppearanceConfig;
  deployment_config: {
    channels?: ChannelConfig[];
  };
  behavior_config: {
    memory: MemoryConfig;
  };
  lead_capture_config?: LeadCaptureConfig;
  analytics_config?: Record<string, unknown>;
  cached_metrics: ChatbotMetrics;
  created_at: string;
  deployed_at?: string;
}

// ========================================
// TEST/PREVIEW TYPES
// ========================================

/**
 * Test Message Request
 */
export interface TestMessageRequest {
  message: string;
  session_id?: string;
}

/**
 * Source Reference in Response
 */
export interface SourceReference {
  content: string;
  score: number;
  document_title?: string;
  document_url?: string;
}

/**
 * Test Message Response
 */
export interface TestMessageResponse {
  response: string;
  sources?: SourceReference[];
  session_id: string;
  message_id: string;
}

/**
 * Chat Message for UI
 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceReference[];
  timestamp: string;
}

// ========================================
// ANALYTICS TYPES
// ========================================

/**
 * Analytics Overview from widget events
 */
export interface AnalyticsOverview {
  total_conversations: number;
  total_messages: number;
  unique_visitors: number;
  avg_messages_per_session: number;
  widget_loads: number;
}

/**
 * Engagement metrics
 */
export interface AnalyticsEngagement {
  widget_opens: number;
  conversation_starts: number;
  engagement_rate: number;
}

/**
 * Response quality metrics (success/error tracking)
 */
export interface ResponseQuality {
  total_responses: number;
  successful_responses: number;
  failed_responses: number;
  error_rate: number;
  success_rate: number;
}

/**
 * Daily trend data point
 */
export interface AnalyticsTrend {
  date: string;
  conversations: number;
  messages: number;
}

/**
 * Hourly distribution data point
 */
export interface HourlyDistribution {
  hour: number;
  count: number;
}

/**
 * Feedback summary
 */
export interface FeedbackSummary {
  total_feedback: number;
  positive: number;
  negative: number;
  satisfaction_rate: number;
  recent_feedback: Array<{
    rating: string;
    comment?: string;
    submitted_at?: string;
    message_preview?: string;
  }>;
}

/**
 * Widget events breakdown
 */
export interface EventsBreakdown {
  widget_loaded?: number;
  widget_opened?: number;
  widget_closed?: number;
  message_sent?: number;
  message_received?: number;
  lead_collected?: number;
  lead_skipped?: number;
  feedback_given?: number;
  error?: number;
}

/**
 * Full analytics data from service
 */
export interface AnalyticsData {
  overview: AnalyticsOverview;
  engagement: AnalyticsEngagement;
  response_quality?: ResponseQuality;
  trends: AnalyticsTrend[];
  hourly_distribution: HourlyDistribution[];
  period_days: number;
}

/**
 * Chatbot Analytics Response - comprehensive analytics from backend
 */
export interface ChatbotAnalytics {
  chatbot_id: string;
  period_days: number;
  analytics?: AnalyticsData;
  feedback?: FeedbackSummary;
  events?: EventsBreakdown;
  basic_stats?: Record<string, unknown>;
  cached_metrics?: Record<string, unknown>;
  error?: string;

  // Legacy fields (for backward compatibility)
  total_conversations?: number;
  total_messages?: number;
  unique_users?: number;
  avg_response_time_ms?: number;
  satisfaction_rate?: number;
  top_queries?: string[];
  error_rate?: number;
}

// ========================================
// LIST & PAGINATION
// ========================================

/**
 * Chatbot List Filters
 */
export interface ChatbotListFilters {
  workspace_id: string;
  status?: ChatbotStatus;
  search?: string;
  skip?: number;
  limit?: number;
}

/**
 * Paginated Chatbot Response
 */
export interface PaginatedChatbotResponse {
  items: ChatbotSummary[];
  total: number;
  skip: number;
  limit: number;
}

// ========================================
// FORM STATE TYPES
// ========================================

/**
 * Draft Form Data - For wizard state
 */
export interface ChatbotFormData {
  // Step 1: Basic Info
  name: string;
  description: string;

  // Step 2: Prompt & AI Config
  system_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  persona?: PersonaConfig;
  instructions: InstructionItem[];
  restrictions: RestrictionItem[];
  messages: MessagesConfig;
  behavior: BehaviorConfig;
  variables_config: VariablesConfig; // Variable collection for {{variable}} substitution

  // Step 3: Knowledge Bases
  knowledge_bases: KBAttachment[];

  // Step 4: Appearance & Behavior
  appearance: AppearanceConfig;
  memory: MemoryConfig;
  lead_capture?: LeadCaptureConfig;

  // Step 5: Deployment
  channels: ChannelConfig[];
  is_public: boolean;
}

/**
 * Form Validation Errors
 */
export interface ChatbotFormErrors {
  name?: string;
  description?: string;
  system_prompt?: string;
  model?: string;
  temperature?: string;
  max_tokens?: string;
  knowledge_bases?: string;
  appearance?: string;
  channels?: string;
  general?: string;
}

// ========================================
// DEFAULT VALUES
// ========================================

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  primary_color: "#3b82f6",
  secondary_color: "#8b5cf6",
  position: WidgetPosition.BOTTOM_RIGHT,
  bubble_style: "rounded",
  chat_title: "Chat with us",
};

export const DEFAULT_MEMORY: MemoryConfig = {
  enabled: true,
  max_messages: 20,
  summary_enabled: false,
};

export const DEFAULT_AI_CONFIG: AIConfig = {
  model: AIModel.SECRET_AI,
  temperature: 0.7,
  max_tokens: 2000,
};

export const DEFAULT_MESSAGES: MessagesConfig = {
  greeting: "Hello! How can I help you today?",
};

export const DEFAULT_BEHAVIOR: BehaviorConfig = {
  enable_citations: false,
  enable_follow_up_questions: false,
  conversation_openers: [],
  grounding_mode: GroundingMode.STRICT,
};

export const DEFAULT_FORM_DATA: ChatbotFormData = {
  name: "",
  description: "",
  system_prompt: "You are a helpful assistant. Be concise and helpful in your responses.",
  model: AIModel.SECRET_AI,
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

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Get status display label
 */
export function getStatusLabel(status: ChatbotStatus): string {
  switch (status) {
    case ChatbotStatus.DRAFT:
      return "Draft";
    case ChatbotStatus.ACTIVE:
      return "Active";
    case ChatbotStatus.PAUSED:
      return "Paused";
    case ChatbotStatus.ARCHIVED:
      return "Archived";
    default:
      return status;
  }
}

/**
 * Get channel display label
 */
export function getChannelLabel(channel: DeploymentChannel): string {
  switch (channel) {
    case DeploymentChannel.WEBSITE:
      return "Website Widget";
    case DeploymentChannel.TELEGRAM:
      return "Telegram";
    case DeploymentChannel.DISCORD:
      return "Discord";
    case DeploymentChannel.WHATSAPP:
      return "WhatsApp";
    case DeploymentChannel.API:
      return "REST API";
    case DeploymentChannel.SECRETVM:
      return "SecretVM";
    default:
      return channel;
  }
}

/**
 * Get model display label
 */
export function getModelLabel(model: string): string {
  switch (model) {
    case AIModel.SECRET_AI:
      return "Secret AI (Privacy-Preserving)";
    default:
      return model;
  }
}

/**
 * Type guard for ChatbotStatus
 */
export function isChatbotStatus(value: string): value is ChatbotStatus {
  return Object.values(ChatbotStatus).includes(value as ChatbotStatus);
}

/**
 * Type guard for DeploymentChannel
 */
export function isDeploymentChannel(value: string): value is DeploymentChannel {
  return Object.values(DeploymentChannel).includes(value as DeploymentChannel);
}
