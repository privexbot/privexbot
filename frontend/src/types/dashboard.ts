/**
 * Dashboard Type Definitions
 *
 * WHY: Type-safe dashboard data for stats, activities, and resources
 * HOW: TypeScript interfaces for dashboard components
 */

import type { KBStatus } from "./knowledge-base";

// Resource types in the platform
export type ResourceType = "chatbot" | "chatflow" | "knowledge_base" | "lead";

// Resource statuses
export type ResourceStatus = "active" | "inactive" | "draft" | "deployed" | "archived";

// Activity types
export type ActivityType =
  | "chatbot_created"
  | "chatbot_updated"
  | "chatbot_deployed"
  | "chatflow_created"
  | "chatflow_updated"
  | "chatflow_deployed"
  | "kb_created"
  | "kb_updated"
  | "lead_captured"
  | "conversation_started"
  | "error_occurred"
  | "settings_changed";

/**
 * Dashboard Statistics
 */
export interface DashboardStats {
  total_chatbots: number;
  total_chatflows: number;
  total_knowledge_bases: number;
  total_leads: number;
  total_conversations: number;
  active_conversations: number;
  // Delta changes (percentage)
  chatbots_delta?: number;
  chatflows_delta?: number;
  knowledge_bases_delta?: number;
  leads_delta?: number;
  conversations_delta?: number;
}

/**
 * Recent Activity Item
 */
export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  resource_type?: ResourceType;
  resource_id?: string;
  resource_name?: string;
  user_id?: string;
  username?: string;
  timestamp: string; // ISO 8601
  metadata?: Record<string, any>;
}

/**
 * Chatbot Summary (for dashboard display)
 */
export interface ChatbotSummary {
  id: string;
  name: string;
  description?: string;
  status: ResourceStatus;
  conversations_count: number;
  last_active_at?: string;
  created_at: string;
  updated_at: string;
  deployed_at?: string;
}

/**
 * Chatflow Summary (for dashboard display)
 */
export interface ChatflowSummary {
  id: string;
  name: string;
  description?: string;
  status: ResourceStatus;
  nodes_count: number;
  conversations_count: number;
  last_active_at?: string;
  created_at: string;
  updated_at: string;
  deployed_at?: string;
}

/**
 * Knowledge Base Summary (for dashboard display)
 */
export interface KnowledgeBaseSummary {
  id: string;
  name: string;
  description?: string;
  status: KBStatus; // Use proper KB status type for semantic accuracy
  documents_count: number;
  total_chunks: number;
  last_indexed_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Dashboard Data (aggregated response)
 */
export interface DashboardData {
  stats: DashboardStats;
  recent_activities: Activity[];
  recent_chatbots: ChatbotSummary[];
  recent_chatflows: ChatflowSummary[];
  recent_knowledge_bases: KnowledgeBaseSummary[];
}

/**
 * Time Range Filter for dashboard
 */
export type TimeRange = "24h" | "7d" | "30d" | "90d" | "1y";

/**
 * Dashboard Filters
 */
export interface DashboardFilters {
  time_range?: TimeRange;
  custom_date_range?: { start: string; end: string };
  search?: string;
  resource_types?: ResourceType[];
}
