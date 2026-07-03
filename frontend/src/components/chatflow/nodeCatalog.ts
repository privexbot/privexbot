/**
 * Node catalog — single source of truth for the chatflow builder's node metadata.
 *
 * Both the builder's left palette (`ChatflowBuilder.tsx`) and the Studio guide's
 * node reference (`onboarding/StudioGuide.tsx`) render from this list, so the two
 * never drift.
 *
 * `requiredFields` / `needsCredential` are display-only hints for the guide.
 * They mirror the deploy validator in `ChatflowBuilder.tsx` (`validateNodeConfig`),
 * which remains the source of truth — keep them in sync if that validator changes.
 */

import {
  Zap,
  GitBranch,
  Repeat,
  MessageCircle,
  Sparkles,
  Database,
  History,
  Globe,
  Settings,
  Code,
  Send,
  Mail,
  Bell,
  UserCheck,
  UserPlus,
  Calendar,
  type LucideIcon,
} from "lucide-react";

export interface NodeMeta {
  type: string;
  label: string;
  icon: LucideIcon;
  /** Tailwind gradient classes for the icon chip, e.g. "from-emerald-500 to-green-600". */
  color: string;
  description: string;
  /** Short summary of the fields the validator requires (display-only). "" = none. */
  requiredFields?: string;
  /** Whether the node uses a stored credential. "required" = always; "optional" = sometimes/warn-only. */
  needsCredential?: "required" | "optional";
  /** Optional one-line usage hint shown in the onboarding coachmark (≤ ~8 words). */
  tip?: string;
}

export interface NodeCategory {
  title: string;
  nodes: NodeMeta[];
}

export const NODE_CATEGORIES: NodeCategory[] = [
  {
    title: "Flow Control",
    nodes: [
      { type: "trigger", label: "Trigger", icon: Zap, color: "from-emerald-500 to-green-600", description: "Start of the workflow", requiredFields: "", tip: "Every flow starts here — receives the user's message" },
      { type: "condition", label: "Condition", icon: GitBranch, color: "from-amber-500 to-orange-600", description: "Branching logic", requiredFields: "Operator, variable, compare value", tip: "Branches the flow true / false" },
      { type: "loop", label: "Loop", icon: Repeat, color: "from-rose-500 to-pink-600", description: "Iterate over arrays", requiredFields: "Array variable", tip: "Repeats steps over a list" },
      { type: "response", label: "Response", icon: MessageCircle, color: "from-red-500 to-rose-600", description: "Final output", requiredFields: "", tip: "Every flow ends here — the reply sent back" },
    ],
  },
  {
    title: "AI & Knowledge",
    nodes: [
      { type: "llm", label: "LLM", icon: Sparkles, color: "from-purple-500 to-pink-600", description: "AI text generation", requiredFields: "Prompt or system prompt", tip: "Generates a reply with Secret AI" },
      { type: "kb", label: "Knowledge Base", icon: Database, color: "from-blue-500 to-cyan-600", description: "RAG retrieval", requiredFields: "Knowledge base", tip: "Looks up answers in your knowledge base" },
      { type: "memory", label: "Memory", icon: History, color: "from-teal-500 to-cyan-600", description: "Chat history", requiredFields: "", tip: "Recalls earlier messages in the chat" },
    ],
  },
  {
    title: "Data & Integration",
    nodes: [
      { type: "http", label: "HTTP Request", icon: Globe, color: "from-green-500 to-emerald-600", description: "External API calls", requiredFields: "URL + method", needsCredential: "optional" },
      { type: "variable", label: "Variable", icon: Settings, color: "from-indigo-500 to-violet-600", description: "Set/transform data", requiredFields: "Operation + variable name" },
      { type: "code", label: "Code", icon: Code, color: "from-gray-700 to-gray-900", description: "Python scripts", requiredFields: "Python code" },
      { type: "database", label: "Database", icon: Database, color: "from-slate-600 to-slate-800", description: "SQL queries (PostgreSQL)", requiredFields: "Credential + query", needsCredential: "required" },
    ],
  },
  {
    title: "Actions & Automation",
    nodes: [
      { type: "webhook", label: "Webhook", icon: Send, color: "from-orange-500 to-amber-600", description: "Push to Zapier, Make, etc.", requiredFields: "URL" },
      { type: "email", label: "Email", icon: Mail, color: "from-sky-500 to-blue-600", description: "Send emails (SMTP/Gmail)", requiredFields: "Recipient + subject", needsCredential: "optional" },
      { type: "notification", label: "Notification", icon: Bell, color: "from-teal-500 to-cyan-600", description: "Alert team via Slack/Discord", requiredFields: "Channel, message, and a webhook URL or credential", needsCredential: "required" },
      { type: "handoff", label: "Handoff", icon: UserCheck, color: "from-violet-500 to-fuchsia-600", description: "Escalate to human agent", requiredFields: "Method (+ recipient & credential for email; URL for webhook/Slack)", needsCredential: "optional" },
      { type: "lead_capture", label: "Lead Capture", icon: UserPlus, color: "from-emerald-500 to-green-600", description: "Collect & store leads", requiredFields: "At least one field (name + source)" },
      { type: "calendly", label: "Calendly", icon: Calendar, color: "from-blue-500 to-indigo-600", description: "Schedule meetings", requiredFields: "Credential + action", needsCredential: "required" },
    ],
  },
];
