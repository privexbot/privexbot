/**
 * ChatflowBuilder - Visual drag-and-drop workflow editor
 *
 * WHY:
 * - Complex multi-step chatbots with branching logic
 * - Visual workflow design with drag-and-drop
 * - Real-time auto-save and validation
 *
 * HOW:
 * - ReactFlow for visual canvas
 * - Custom node components with handles
 * - Sidebar for node palette and configuration
 * - Consistent with dashboard design patterns
 *
 * NODE TYPES (matching backend):
 * - trigger: Start node (user message entry)
 * - llm: AI text generation
 * - kb: Knowledge base retrieval
 * - condition: Branching logic
 * - http: API calls
 * - variable: Variable manipulation
 * - code: Python code execution
 * - memory: Chat history access
 * - database: SQL queries
 * - loop: Iteration over arrays
 * - response: Final output
 */

import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  NodeTypes,
  Handle,
  Position,
  BackgroundVariant,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  Workflow,
  Play,
  AlertCircle,
  Rocket,
  Sparkles,
  Database,
  GitBranch,
  Globe,
  Code,
  ArrowLeft,
  ChevronRight,
  Settings,
  Zap,
  History,
  Repeat,
  MessageCircle,
  X,
  Check,
  Loader2,
  Send,
  Mail,
  Bell,
  UserCheck,
  UserPlus,
  Calendar,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import EmbedCode from "@/components/shared/EmbedCode";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { chatflowDraftApi, type FinalizeChatflowResponse } from "@/api/chatflow";
import { config as envConfig } from "@/config/env";
import ChannelSelector, { type DeploymentChannel } from "@/components/deployment/ChannelSelector";
import { WrongWorkspaceScreen } from "@/components/shared/WrongWorkspaceScreen";
import { classifyChannelError } from "@/lib/channelErrors";

// Node configuration panel for type-specific settings
import { LLMNodeConfig } from "@/components/chatflow/configs/LLMNodeConfig";
import { KBNodeConfig } from "@/components/chatflow/configs/KBNodeConfig";
import { ConditionNodeConfig } from "@/components/chatflow/configs/ConditionNodeConfig";
import { HTTPNodeConfig } from "@/components/chatflow/configs/HTTPNodeConfig";
import { VariableNodeConfig } from "@/components/chatflow/configs/VariableNodeConfig";
import { CodeNodeConfig } from "@/components/chatflow/configs/CodeNodeConfig";
import { MemoryNodeConfig } from "@/components/chatflow/configs/MemoryNodeConfig";
import { DatabaseNodeConfig } from "@/components/chatflow/configs/DatabaseNodeConfig";
import { ResponseNodeConfig } from "@/components/chatflow/configs/ResponseNodeConfig";
import { LoopNodeConfig } from "@/components/chatflow/configs/LoopNodeConfig";
import { WebhookNodeConfig } from "@/components/chatflow/configs/WebhookNodeConfig";
import { EmailNodeConfig } from "@/components/chatflow/configs/EmailNodeConfig";
import { NotificationNodeConfig } from "@/components/chatflow/configs/NotificationNodeConfig";
import { HandoffNodeConfig } from "@/components/chatflow/configs/HandoffNodeConfig";
import { LeadCaptureNodeConfig } from "@/components/chatflow/configs/LeadCaptureNodeConfig";
import { CalendlyNodeConfig } from "@/components/chatflow/configs/CalendlyNodeConfig";

// ========================================
// NODE COMPONENT DEFINITIONS
// ========================================

interface NodeData {
  label: string;
  config?: Record<string, unknown>;
  /** Set by the validator; do not persist (stripped before auto-save). */
  _hasIssue?: boolean;
}

// ========================================
// VALIDATION (per-node)
// ========================================

export type ValidationIssue = {
  nodeId?: string;
  nodeLabel?: string;
  nodeType?: string;
  message: string;
  severity: "error" | "warning";
};

/**
 * Per-node config validator. Grounded in backend node.execute() requirements
 * (see backend/src/app/chatflow/nodes/*_node.py). Only flags fields that have
 * no sensible default and will fail at runtime.
 */
function validateNodeConfig(node: Node): ValidationIssue[] {
  const config = ((node.data as NodeData)?.config ?? {}) as Record<string, unknown>;
  const label = ((node.data as NodeData)?.label ?? node.type ?? "Unnamed") as string;
  const out: ValidationIssue[] = [];
  const base = { nodeId: node.id, nodeLabel: label, nodeType: node.type };
  const err = (message: string) => out.push({ ...base, message, severity: "error" });
  const warn = (message: string) => out.push({ ...base, message, severity: "warning" });
  const str = (v: unknown) =>
    typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();

  switch (node.type) {
    case "llm":
      if (!str(config.prompt) && !str(config.system_prompt))
        err("Add a prompt or system prompt");
      break;
    case "condition": {
      const op = config.operator as string | undefined;
      if (!op) err("Operator is required");
      if (!str(config.variable)) err("Variable is required");
      const needsValue = op && !["is_empty", "is_not_empty"].includes(op);
      if (needsValue && (config.value === undefined || config.value === null || config.value === ""))
        err("Compare value is required");
      break;
    }
    case "lead_capture": {
      const fields = (config.fields as Array<Record<string, unknown>>) || [];
      if (!Array.isArray(fields) || fields.length === 0) {
        err("At least one field is required");
      } else {
        fields.forEach((f, i) => {
          if (!str(f?.name)) err(`Field ${i + 1} is missing a name`);
          if (!str(f?.source))
            err(`Field "${str(f?.name) || i + 1}" is missing a source`);
        });
      }
      break;
    }
    case "kb":
      if (!config.kb_id) err("Knowledge base must be selected");
      break;
    case "http":
      if (!str(config.url)) err("URL is required");
      if (!config.method) err("HTTP method is required");
      break;
    case "database":
      if (!config.credential_id) err("Database credential is required");
      if (!str(config.query)) err("Query is required");
      break;
    case "webhook":
      if (!str(config.url)) err("Webhook URL is required");
      break;
    case "email":
      if (!str(config.to)) err("Recipient (to) is required");
      if (!str(config.subject)) err("Subject is required");
      if (!config.credential_id)
        warn("Email credential is usually required to send");
      break;
    case "notification":
      if (!config.channel) err("Channel is required");
      if (!str(config.message)) err("Message is required");
      break;
    case "handoff":
      if (!config.method) err("Handoff method is required");
      break;
    case "calendly":
      if (!config.credential_id) err("Calendly credential is required");
      if (!config.action) err("Action is required");
      break;
    case "code":
      if (!str(config.code)) err("Code is required");
      break;
    case "variable":
      if (!config.operation) err("Operation is required");
      if (!str(config.variable_name)) err("Variable name is required");
      break;
    case "loop":
      if (!str(config.array)) err("Array variable is required");
      break;
    // trigger, response, memory: no required config
  }

  return out;
}

/** Per-node connection checks. */
function validateNodeConnections(node: Node, edges: Edge[]): ValidationIssue[] {
  const label = ((node.data as NodeData)?.label ?? node.type) as string;
  const out: ValidationIssue[] = [];
  const base = { nodeId: node.id, nodeLabel: label, nodeType: node.type };
  const err = (m: string) => out.push({ ...base, message: m, severity: "error" });
  const warn = (m: string) => out.push({ ...base, message: m, severity: "warning" });

  const inbound = edges.filter((e) => e.target === node.id);
  const outbound = edges.filter((e) => e.source === node.id);

  if (node.type !== "trigger" && inbound.length === 0) err("No incoming connection");
  if (node.type !== "response" && outbound.length === 0) err("No outgoing connection");
  if (node.type === "condition" && outbound.length < 2)
    warn(
      "Only one branch wired — wire both True and False outputs to avoid dead paths"
    );

  return out;
}

/**
 * Semantic heuristic: if a condition compares `{{input}}` but there is an
 * upstream node whose output the user probably wanted to branch on, warn them
 * to reference `{{_last_output}}` or the node's ID.
 */
function checkConditionInputSemantics(
  node: Node,
  nodes: Node[],
  edges: Edge[]
): ValidationIssue[] {
  if (node.type !== "condition") return [];
  const config = ((node.data as NodeData)?.config ?? {}) as Record<string, unknown>;
  const variable = typeof config.variable === "string" ? config.variable.trim() : "";
  if (variable !== "{{input}}") return [];

  const interestingUpstream = new Set([
    "llm",
    "kb",
    "http",
    "code",
    "database",
  ]);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const queue: string[] = edges
    .filter((e) => e.target === node.id)
    .map((e) => e.source);
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const n = byId.get(id);
    if (!n) continue;
    if (interestingUpstream.has(n.type ?? "")) {
      const label = ((node.data as NodeData)?.label ?? node.type) as string;
      return [
        {
          nodeId: node.id,
          nodeLabel: label,
          nodeType: node.type,
          severity: "warning",
          message:
            "Compares raw user input. To branch on the previous node's output, use {{_last_output}} or {{<node_id>.output}}.",
        },
      ];
    }
    for (const e of edges) if (e.target === id) queue.push(e.source);
  }
  return [];
}

// Base node wrapper with handles
function BaseNode({
  children,
  className,
  hasInput = true,
  hasOutput = true,
  selected,
  hasIssue,
}: {
  children: React.ReactNode;
  className?: string;
  hasInput?: boolean;
  hasOutput?: boolean;
  selected?: boolean;
  hasIssue?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative min-w-[160px] transition-all duration-200 rounded-xl",
        selected && "ring-2 ring-purple-500 ring-offset-2 ring-offset-gray-900",
        hasIssue &&
          !selected &&
          "ring-2 ring-red-500/70 ring-offset-2 ring-offset-transparent",
        className
      )}
    >
      {hasInput && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-gray-400 !border-2 !border-gray-600 hover:!bg-purple-500 transition-colors"
        />
      )}
      {children}
      {hasOutput && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-gray-400 !border-2 !border-gray-600 hover:!bg-purple-500 transition-colors"
        />
      )}
      {hasIssue && (
        <div
          aria-hidden
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center shadow"
        >
          !
        </div>
      )}
    </div>
  );
}

// Trigger Node (Start)
function TriggerNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  return (
    <BaseNode hasInput={false} selected={selected} hasIssue={data._hasIssue}>
      <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg border border-emerald-400">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">Trigger</div>
            <div className="text-xs opacity-80">{data.label || "User Message"}</div>
          </div>
        </div>
      </div>
    </BaseNode>
  );
}

// LLM Node
function LLMNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  return (
    <BaseNode selected={selected} hasIssue={data._hasIssue}>
      <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg border border-purple-400">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">LLM</div>
            <div className="text-xs opacity-80">{data.label || "AI Generation"}</div>
          </div>
        </div>
      </div>
    </BaseNode>
  );
}

// KB Node
function KBNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  return (
    <BaseNode selected={selected} hasIssue={data._hasIssue}>
      <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-lg border border-blue-400">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">Knowledge Base</div>
            <div className="text-xs opacity-80">{data.label || "Retrieve Context"}</div>
          </div>
        </div>
      </div>
    </BaseNode>
  );
}

// Condition Node (with two outputs)
function ConditionNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  return (
    <div
      className={cn(
        "relative min-w-[160px] transition-all duration-200 rounded-xl",
        selected && "ring-2 ring-purple-500 ring-offset-2 ring-offset-gray-900",
        data._hasIssue &&
          !selected &&
          "ring-2 ring-red-500/70 ring-offset-2 ring-offset-transparent"
      )}
    >
      {data._hasIssue && (
        <div
          aria-hidden
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center shadow z-10"
        >
          !
        </div>
      )}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-gray-600 hover:!bg-purple-500 transition-colors"
      />
      <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg border border-amber-400">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <GitBranch className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">Condition</div>
            <div className="text-xs opacity-80">{data.label || "If/Else"}</div>
          </div>
        </div>
      </div>
      {/* True/False handles */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{ left: "30%" }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-green-600"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ left: "70%" }}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-red-600"
      />
    </div>
  );
}

// HTTP Node
function HTTPNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  return (
    <BaseNode selected={selected} hasIssue={data._hasIssue}>
      <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg border border-green-400">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">HTTP Request</div>
            <div className="text-xs opacity-80">{data.label || "API Call"}</div>
          </div>
        </div>
      </div>
    </BaseNode>
  );
}

// Variable Node
function VariableNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  return (
    <BaseNode selected={selected} hasIssue={data._hasIssue}>
      <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg border border-indigo-400">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">Variable</div>
            <div className="text-xs opacity-80">{data.label || "Set Value"}</div>
          </div>
        </div>
      </div>
    </BaseNode>
  );
}

// Code Node
function CodeNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  return (
    <BaseNode selected={selected} hasIssue={data._hasIssue}>
      <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 text-white shadow-lg border border-gray-500">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Code className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">Code</div>
            <div className="text-xs opacity-80">{data.label || "Python Script"}</div>
          </div>
        </div>
      </div>
    </BaseNode>
  );
}

// Memory Node
function MemoryNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  return (
    <BaseNode selected={selected} hasIssue={data._hasIssue}>
      <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg border border-teal-400">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <History className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">Memory</div>
            <div className="text-xs opacity-80">{data.label || "Chat History"}</div>
          </div>
        </div>
      </div>
    </BaseNode>
  );
}

// Database Node
function DatabaseNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  return (
    <BaseNode selected={selected} hasIssue={data._hasIssue}>
      <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-lg border border-slate-500">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">Database</div>
            <div className="text-xs opacity-80">{data.label || "SQL Query"}</div>
          </div>
        </div>
      </div>
    </BaseNode>
  );
}

// Loop Node
function LoopNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  return (
    <BaseNode selected={selected} hasIssue={data._hasIssue}>
      <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg border border-rose-400">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Repeat className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">Loop</div>
            <div className="text-xs opacity-80">{data.label || "Iterate Array"}</div>
          </div>
        </div>
      </div>
    </BaseNode>
  );
}

// Response Node
function ResponseNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  return (
    <BaseNode hasOutput={false} selected={selected} hasIssue={data._hasIssue}>
      <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg border border-red-400">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">Response</div>
            <div className="text-xs opacity-80">{data.label || "Final Output"}</div>
          </div>
        </div>
      </div>
    </BaseNode>
  );
}

// Webhook Node
function WebhookNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  return (
    <BaseNode selected={selected} hasIssue={data._hasIssue}>
      <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg border border-orange-400">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Send className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">Webhook</div>
            <div className="text-xs opacity-80">{data.label || "Outbound Webhook"}</div>
          </div>
        </div>
      </div>
    </BaseNode>
  );
}

// Email Node
function EmailNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  return (
    <BaseNode selected={selected} hasIssue={data._hasIssue}>
      <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg border border-sky-400">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">Email</div>
            <div className="text-xs opacity-80">{data.label || "Send Email"}</div>
          </div>
        </div>
      </div>
    </BaseNode>
  );
}

// Notification Node
function NotificationNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  return (
    <BaseNode selected={selected} hasIssue={data._hasIssue}>
      <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg border border-teal-400">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">Notification</div>
            <div className="text-xs opacity-80">{data.label || "Team Alert"}</div>
          </div>
        </div>
      </div>
    </BaseNode>
  );
}

// Handoff Node
function HandoffNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  return (
    <BaseNode selected={selected} hasIssue={data._hasIssue}>
      <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-lg border border-violet-400">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">Handoff</div>
            <div className="text-xs opacity-80">{data.label || "Human Agent"}</div>
          </div>
        </div>
      </div>
    </BaseNode>
  );
}

// Lead Capture Node
function LeadCaptureNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  return (
    <BaseNode selected={selected} hasIssue={data._hasIssue}>
      <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg border border-emerald-400">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">Lead Capture</div>
            <div className="text-xs opacity-80">{data.label || "Collect Lead"}</div>
          </div>
        </div>
      </div>
    </BaseNode>
  );
}

// Calendly Node
function CalendlyNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  return (
    <BaseNode selected={selected} hasIssue={data._hasIssue}>
      <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg border border-blue-400">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">Calendly</div>
            <div className="text-xs opacity-80">{data.label || "Schedule Meeting"}</div>
          </div>
        </div>
      </div>
    </BaseNode>
  );
}

// Register all node types
const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  llm: LLMNode,
  kb: KBNode,
  condition: ConditionNode,
  http: HTTPNode,
  variable: VariableNode,
  code: CodeNode,
  memory: MemoryNode,
  database: DatabaseNode,
  loop: LoopNode,
  response: ResponseNode,
  webhook: WebhookNode,
  email: EmailNode,
  notification: NotificationNode,
  handoff: HandoffNode,
  lead_capture: LeadCaptureNode,
  calendly: CalendlyNode,
};

// ========================================
// NODE PALETTE DEFINITION
// ========================================

const NODE_CATEGORIES = [
  {
    title: "Flow Control",
    nodes: [
      { type: "trigger", label: "Trigger", icon: Zap, color: "from-emerald-500 to-green-600", description: "Start of the workflow" },
      { type: "condition", label: "Condition", icon: GitBranch, color: "from-amber-500 to-orange-600", description: "Branching logic" },
      { type: "loop", label: "Loop", icon: Repeat, color: "from-rose-500 to-pink-600", description: "Iterate over arrays" },
      { type: "response", label: "Response", icon: MessageCircle, color: "from-red-500 to-rose-600", description: "Final output" },
    ],
  },
  {
    title: "AI & Knowledge",
    nodes: [
      { type: "llm", label: "LLM", icon: Sparkles, color: "from-purple-500 to-pink-600", description: "AI text generation" },
      { type: "kb", label: "Knowledge Base", icon: Database, color: "from-blue-500 to-cyan-600", description: "RAG retrieval" },
      { type: "memory", label: "Memory", icon: History, color: "from-teal-500 to-cyan-600", description: "Chat history" },
    ],
  },
  {
    title: "Data & Integration",
    nodes: [
      { type: "http", label: "HTTP Request", icon: Globe, color: "from-green-500 to-emerald-600", description: "External API calls" },
      { type: "variable", label: "Variable", icon: Settings, color: "from-indigo-500 to-violet-600", description: "Set/transform data" },
      { type: "code", label: "Code", icon: Code, color: "from-gray-700 to-gray-900", description: "Python scripts" },
      { type: "database", label: "Database", icon: Database, color: "from-slate-600 to-slate-800", description: "SQL queries" },
    ],
  },
  {
    title: "Actions & Automation",
    nodes: [
      { type: "webhook", label: "Webhook", icon: Send, color: "from-orange-500 to-amber-600", description: "Push to Zapier, Make, etc." },
      { type: "email", label: "Email", icon: Mail, color: "from-sky-500 to-blue-600", description: "Send emails (SMTP/Gmail)" },
      { type: "notification", label: "Notification", icon: Bell, color: "from-teal-500 to-cyan-600", description: "Alert team via Slack/Discord" },
      { type: "handoff", label: "Handoff", icon: UserCheck, color: "from-violet-500 to-fuchsia-600", description: "Escalate to human agent" },
      { type: "lead_capture", label: "Lead Capture", icon: UserPlus, color: "from-emerald-500 to-green-600", description: "Collect & store leads" },
      { type: "calendly", label: "Calendly", icon: Calendar, color: "from-blue-500 to-indigo-600", description: "Schedule meetings" },
    ],
  },
];

// ========================================
// MAIN COMPONENT
// ========================================

export default function ChatflowBuilder() {
  const { draftId } = useParams<{ draftId?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentWorkspace } = useApp();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [flowName, setFlowName] = useState("Untitled Chatflow");
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDeployDialogOpen, setIsDeployDialogOpen] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<DeploymentChannel[]>(["website"]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  // Deploy result: populated after a successful finalize so the success
  // dialog can show the chatflow ID, per-channel details, and the one-time
  // API key. Previously these were discarded in onSuccess.
  const [deployResult, setDeployResult] = useState<FinalizeChatflowResponse | null>(null);

  // Load draft
  const {
    data: draft,
    isLoading: isLoadingDraft,
    isError: isDraftError,
    error: draftError,
  } = useQuery({
    queryKey: ["chatflow-draft", draftId],
    queryFn: () => (draftId ? chatflowDraftApi.get(draftId) : null),
    enabled: !!draftId,
    // Draft 404s are a terminal signal (stale/expired/invalid ID) — do not spam retries.
    retry: false,
  });

  // Create draft if none exists
  const createDraftMutation = useMutation({
    mutationFn: chatflowDraftApi.create,
    onSuccess: (data) => {
      navigate(`/chatflows/builder/${data.draft_id}`, { replace: true });
    },
  });

  // Create draft on mount if no draftId
  useEffect(() => {
    if (!draftId && currentWorkspace && !createDraftMutation.isPending) {
      createDraftMutation.mutate({
        workspace_id: currentWorkspace.id,
        initial_data: {
          name: "Untitled Chatflow",
          nodes: [
            {
              id: "trigger_1",
              type: "trigger",
              position: { x: 250, y: 50 },
              data: { label: "User Message" },
            },
          ],
          edges: [],
        },
      });
    }
  }, [draftId, currentWorkspace]);

  // Load nodes and edges from draft
  useEffect(() => {
    if (draft?.data) {
      setFlowName(draft.data.name || "Untitled Chatflow");
      if (draft.data.nodes) {
        // Cast draft nodes to ReactFlow Node type
        setNodes(draft.data.nodes as Node[]);
      }
      if (draft.data.edges) {
        // Cast draft edges to ReactFlow Edge type
        setEdges(draft.data.edges as Edge[]);
      }
      // Detect edit mode: draft has source_entity_id when created from deployed chatflow
      if (draft.source_entity_id) {
        setIsEditMode(true);
      }
    }
  }, [draft, setNodes, setEdges]);

  // Recover from a stale draftId in the URL (e.g. a deployed-chatflow UUID or
  // an expired draft). Without this, the builder renders a blank canvas and
  // auto-saves every second into a 404 loop. Return the user to Studio.
  useEffect(() => {
    if (!isDraftError) return;
    toast({
      title: "Chatflow draft unavailable",
      description:
        draftError instanceof Error && draftError.message
          ? draftError.message
          : "This draft has expired or the link is invalid. Open the chatflow from Studio to continue editing.",
      variant: "destructive",
    });
    navigate("/studio", { replace: true });
  }, [isDraftError, draftError, navigate, toast]);

  // Auto-save mutation — strips underscore-prefixed internal fields (e.g.
  // `_hasIssue`) from node.data so they don't end up in Redis.
  const saveMutation = useMutation({
    mutationFn: (data: { nodes: Node[]; edges: Edge[]; name: string }) =>
      chatflowDraftApi.update(draftId!, {
        nodes: data.nodes.map((n) => ({
          ...n,
          data: Object.fromEntries(
            Object.entries((n.data ?? {}) as Record<string, unknown>).filter(
              ([k]) => !k.startsWith("_")
            )
          ),
        })),
        edges: data.edges,
        name: data.name,
      }),
    onSuccess: () => {
      setLastSaved(new Date());
      setIsSaving(false);
    },
    onError: (error) => {
      setIsSaving(false);
      // Surface the failure instead of silently losing the user's edits.
      // A 404 here means the draft the URL references no longer exists —
      // the draft-load effect above will navigate back to Studio.
      toast({
        title: "Auto-save failed",
        description:
          error instanceof Error
            ? error.message
            : "Your changes weren't saved. Check your connection and try again.",
        variant: "destructive",
      });
    },
  });

  // Auto-save on changes. Skip when the draft is known-bad so we don't spam
  // 404 requests while the recovery effect navigates away.
  useEffect(() => {
    if (!draftId || nodes.length === 0 || isDraftError) return;

    const timeoutId = setTimeout(() => {
      setIsSaving(true);
      saveMutation.mutate({ nodes, edges, name: flowName });
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [nodes, edges, flowName, draftId, isDraftError]);

  // Add edge handler
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: true,
            style: { stroke: "#9333ea", strokeWidth: 2 },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  // Add node handler
  const addNode = useCallback(
    (type: string, label: string) => {
      const newNode: Node = {
        id: `${type}_${Date.now()}`,
        type,
        position: {
          x: 250 + Math.random() * 100,
          y: 150 + nodes.length * 100,
        },
        data: { label },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [nodes.length, setNodes]
  );

  // Node selection handler
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  // Handler for node config changes - updates node.data.config
  const handleNodeConfigChange = useCallback(
    (newConfig: Record<string, unknown>) => {
      if (!selectedNode) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id
            ? { ...n, data: { ...n.data, config: newConfig } }
            : n
        )
      );
      // Update selectedNode to keep it in sync
      setSelectedNode((prev) =>
        prev ? { ...prev, data: { ...prev.data, config: newConfig } } : null
      );
    },
    [selectedNode, setNodes]
  );

  // Render node-specific configuration panel
  const renderNodeConfig = useCallback(() => {
    if (!selectedNode) return null;
    const config = (selectedNode.data?.config || {}) as Record<string, unknown>;

    switch (selectedNode.type) {
      case "llm":
        return <LLMNodeConfig config={config} onChange={handleNodeConfigChange} />;
      case "kb":
        return <KBNodeConfig config={config} onChange={handleNodeConfigChange} />;
      case "condition":
        return <ConditionNodeConfig config={config} onChange={handleNodeConfigChange} />;
      case "http":
        return <HTTPNodeConfig config={config} onChange={handleNodeConfigChange} />;
      case "variable":
        return <VariableNodeConfig config={config} onChange={handleNodeConfigChange} />;
      case "code":
        return <CodeNodeConfig config={config} onChange={handleNodeConfigChange} />;
      case "memory":
        return <MemoryNodeConfig config={config} onChange={handleNodeConfigChange} />;
      case "database":
        return <DatabaseNodeConfig config={config} onChange={handleNodeConfigChange} />;
      case "trigger":
        return (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This node activates when a user sends a message via any deployed channel
              (website widget, Telegram, Discord, Slack, etc.).
            </p>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-md p-3">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Available Variables
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{"{{input}}"}</code>
                {" "}&mdash; The user's message text
              </p>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              No additional configuration required.
            </p>
          </div>
        );
      case "response":
        return <ResponseNodeConfig config={config} onChange={handleNodeConfigChange} />;
      case "loop":
        return <LoopNodeConfig config={config} onChange={handleNodeConfigChange} />;
      case "webhook":
        return <WebhookNodeConfig config={config} onChange={handleNodeConfigChange} />;
      case "email":
        return <EmailNodeConfig config={config} onChange={handleNodeConfigChange} />;
      case "notification":
        return <NotificationNodeConfig config={config} onChange={handleNodeConfigChange} />;
      case "handoff":
        return <HandoffNodeConfig config={config} onChange={handleNodeConfigChange} />;
      case "lead_capture":
        return <LeadCaptureNodeConfig config={config} onChange={handleNodeConfigChange} />;
      case "calendly":
        return <CalendlyNodeConfig config={config} onChange={handleNodeConfigChange} />;
      default:
        return (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No configuration available for this node type.
          </p>
        );
    }
  }, [selectedNode, handleNodeConfigChange]);

  // Deploy mutation
  const deployMutation = useMutation({
    mutationFn: (channels: DeploymentChannel[]) =>
      chatflowDraftApi.finalize(draftId!, {
        channels: channels.map((ch) => ({
          type: ch,
          enabled: true,
          config: {},
        })),
      }),
    onSuccess: (result) => {
      // Keep the user here: open the success dialog so they can grab the
      // chatflow ID, per-channel details, and (first and only view of) the
      // API key. They can jump to the detail page or back to Studio from it.
      setIsDeployDialogOpen(false);
      setDeployResult(result);
      toast({
        title: isEditMode ? "Chatflow Updated!" : "Chatflow Deployed!",
        description: isEditMode
          ? "Your chatflow has been updated successfully."
          : "Your chatflow is now live.",
      });
    },
    onError: (error) => {
      toast({
        title: "Deployment Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  // Validate workflow — composes workflow-level checks with per-node config,
  // per-node connection, and semantic heuristic validators. Writes structured
  // issues so the banner can name the offending node and zoom to it on click.
  const validateWorkflow = useCallback(() => {
    const issues: ValidationIssue[] = [];

    // Workflow-level: must have Trigger + Response
    const hasTrigger = nodes.some((n) => n.type === "trigger");
    if (!hasTrigger) {
      issues.push({
        message: "Workflow must have a Trigger node",
        severity: "error",
      });
    }
    const hasResponse = nodes.some((n) => n.type === "response");
    if (!hasResponse) {
      issues.push({
        message: "Workflow must have a Response node",
        severity: "error",
      });
    }

    // Per-node: config + connections + heuristics
    for (const node of nodes) {
      issues.push(...validateNodeConfig(node));
      issues.push(...validateNodeConnections(node, edges));
      issues.push(...checkConditionInputSemantics(node, nodes, edges));
    }

    // Stable ordering: errors first, then by node label
    issues.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
      return (a.nodeLabel ?? "").localeCompare(b.nodeLabel ?? "");
    });

    setValidationIssues(issues);
    return issues.every((i) => i.severity !== "error");
  }, [nodes, edges]);

  // Sync error issues onto node.data._hasIssue so nodes can render a red ring.
  // Only touches nodes whose marker actually changed, so this effect settles
  // after one pass and doesn't thrash auto-save.
  useEffect(() => {
    const issueIds = new Set(
      validationIssues
        .filter((i) => i.severity === "error" && i.nodeId)
        .map((i) => i.nodeId!)
    );
    setNodes((curr) => {
      let changed = false;
      const next = curr.map((n) => {
        const shouldMark = issueIds.has(n.id);
        const current = Boolean((n.data as NodeData)?._hasIssue);
        if (shouldMark === current) return n;
        changed = true;
        return {
          ...n,
          data: { ...(n.data as NodeData), _hasIssue: shouldMark },
        };
      });
      return changed ? next : curr;
    });
  }, [validationIssues, setNodes]);

  // Focus a node by id: select it (opens config drawer) and recenter the canvas.
  const focusNode = useCallback(
    (nodeId: string | undefined) => {
      if (!nodeId) return;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      setSelectedNode(node);
      if (rfInstance) {
        // Node dimensions aren't measured reliably here; ~220×80 covers the
        // typical node size well enough for re-centering.
        rfInstance.setCenter(
          node.position.x + 110,
          node.position.y + 40,
          { zoom: 1.25, duration: 400 }
        );
      }
    },
    [nodes, rfInstance]
  );

  // Loading state
  if (isLoadingDraft || createDraftMutation.isPending) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            <p className="text-gray-600 dark:text-gray-400">Loading workflow...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Cross-workspace race: draft was opened in workspace A then user switched
  // to B. Show the dedicated screen instead of letting auto-save drift into a
  // 403/404 loop.
  if (
    draft &&
    currentWorkspace &&
    draft.workspace_id !== currentWorkspace.id
  ) {
    return (
      <WrongWorkspaceScreen
        resourceKind="chatflow-draft"
        resourceWorkspaceId={draft.workspace_id}
        fallbackPath="/studio"
      />
    );
  }

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900">
        {/* Left Sidebar - Node Palette */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                  Node Palette
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Drag nodes to the canvas
                </p>
              </div>
              <ScrollArea className="h-[calc(100%-80px)]">
                <div className="p-4 space-y-6">
                  {NODE_CATEGORIES.map((category) => (
                    <div key={category.title}>
                      <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                        {category.title}
                      </h3>
                      <div className="space-y-2">
                        {category.nodes.map((node) => {
                          const Icon = node.icon;
                          return (
                            <button
                              key={node.type}
                              onClick={() => addNode(node.type, node.label)}
                              className="w-full p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    "p-2 rounded-lg bg-gradient-to-br text-white",
                                    node.color
                                  )}
                                >
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {node.label}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    {node.description}
                                  </p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="h-14 px-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/studio")}
                className="text-gray-600 dark:text-gray-400"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-2">
                <Workflow className="w-5 h-5 text-purple-600" />
                <Input
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  className="h-8 w-48 bg-transparent border-none focus:ring-1 focus:ring-purple-500 font-medium"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {isSaving ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : lastSaved ? (
                  <>
                    <Check className="w-3 h-3 text-green-500" />
                    <span>Saved {lastSaved.toLocaleTimeString()}</span>
                  </>
                ) : (
                  <span>Auto-save enabled</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {validationIssues.length > 0 && (
                <Badge
                  variant={
                    validationIssues.some((i) => i.severity === "error")
                      ? "destructive"
                      : "secondary"
                  }
                  className="gap-1"
                >
                  <AlertCircle className="w-3 h-3" />
                  {validationIssues.filter((i) => i.severity === "error").length} errors
                  {validationIssues.some((i) => i.severity === "warning") &&
                    ` · ${validationIssues.filter((i) => i.severity === "warning").length} warnings`}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (validateWorkflow()) {
                    toast({
                      title: "Validation Passed",
                      description: "Workflow is ready to deploy",
                    });
                  }
                }}
              >
                <Play className="w-4 h-4 mr-2" />
                Validate
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  // Gate deploy on validation — running validators first also
                  // populates the banner so the user sees what to fix.
                  if (!validateWorkflow()) {
                    toast({
                      title: "Fix validation errors",
                      description:
                        "Resolve the highlighted issues before deploying.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setIsDeployDialogOpen(true);
                }}
                disabled={deployMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {deployMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Rocket className="w-4 h-4 mr-2" />
                )}
                {isEditMode ? "Update" : "Deploy"}
              </Button>
            </div>
          </div>

          {/* Validation Banner — clickable entries focus the offending node */}
          <AnimatePresence>
            {validationIssues.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                {/* Errors section */}
                {validationIssues.some((i) => i.severity === "error") && (
                  <div className="px-4 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200/60 dark:border-red-800/60">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-red-800 dark:text-red-200">
                          Validation errors
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {validationIssues
                            .filter((i) => i.severity === "error")
                            .map((issue, i) => (
                              <li key={`err-${i}`}>
                                {issue.nodeId ? (
                                  <button
                                    onClick={() => focusNode(issue.nodeId)}
                                    className="text-left text-xs text-red-700 dark:text-red-300 hover:underline"
                                  >
                                    <span className="font-medium">
                                      {issue.nodeLabel}
                                    </span>
                                    {issue.nodeType && (
                                      <span className="opacity-60">
                                        {" "}
                                        ({issue.nodeType})
                                      </span>
                                    )}{" "}
                                    — {issue.message}
                                  </button>
                                ) : (
                                  <span className="text-xs text-red-700 dark:text-red-300">
                                    — {issue.message}
                                  </span>
                                )}
                              </li>
                            ))}
                        </ul>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setValidationIssues([])}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Warnings section */}
                {validationIssues.some((i) => i.severity === "warning") && (
                  <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                          Warnings
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {validationIssues
                            .filter((i) => i.severity === "warning")
                            .map((issue, i) => (
                              <li key={`warn-${i}`}>
                                {issue.nodeId ? (
                                  <button
                                    onClick={() => focusNode(issue.nodeId)}
                                    className="text-left text-xs text-amber-700 dark:text-amber-300 hover:underline"
                                  >
                                    <span className="font-medium">
                                      {issue.nodeLabel}
                                    </span>
                                    {issue.nodeType && (
                                      <span className="opacity-60">
                                        {" "}
                                        ({issue.nodeType})
                                      </span>
                                    )}{" "}
                                    — {issue.message}
                                  </button>
                                ) : (
                                  <span className="text-xs text-amber-700 dark:text-amber-300">
                                    — {issue.message}
                                  </span>
                                )}
                              </li>
                            ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ReactFlow Canvas */}
          <div className="flex-1">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              onInit={setRfInstance}
              fitView
              defaultEdgeOptions={{
                animated: true,
                style: { stroke: "#9333ea", strokeWidth: 2 },
              }}
              className="bg-gray-100 dark:bg-gray-900"
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
                className="bg-gray-100 dark:bg-gray-900"
              />
              <Controls className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg" />
              <MiniMap
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                nodeColor={(node) => {
                  switch (node.type) {
                    case "trigger":
                      return "#10b981";
                    case "llm":
                      return "#a855f7";
                    case "kb":
                      return "#3b82f6";
                    case "condition":
                      return "#f59e0b";
                    case "response":
                      return "#ef4444";
                    default:
                      return "#6b7280";
                  }
                }}
              />
            </ReactFlow>
          </div>

          {/* Stats Footer */}
          <div className="h-10 px-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-4">
              <span>Nodes: {nodes.length}</span>
              <span>Edges: {edges.length}</span>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                {isSidebarOpen ? "Hide" : "Show"} Palette
              </Button>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Node Configuration (Sheet) */}
        <Sheet open={!!selectedNode} onOpenChange={() => setSelectedNode(null)}>
          <SheetContent className="w-[400px] sm:w-[540px]">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configure Node
              </SheetTitle>
              <SheetDescription>
                Configure the settings and behavior for this node.
              </SheetDescription>
            </SheetHeader>
            {selectedNode && (
              <ScrollArea className="h-[calc(100vh-10rem)]">
                <div className="mt-6 space-y-4 pr-4">
                  {/* Node Type Badge */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Node Type</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400 capitalize mt-1">
                        {selectedNode.type}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {selectedNode.type}
                    </Badge>
                  </div>

                  {/* Node Label */}
                  <div>
                    <Label className="text-sm font-medium">Label</Label>
                    <Input
                      value={selectedNode.data.label || ""}
                      onChange={(e) => {
                        const newLabel = e.target.value;
                        setNodes((nds) =>
                          nds.map((n) =>
                            n.id === selectedNode.id
                              ? { ...n, data: { ...n.data, label: newLabel } }
                              : n
                          )
                        );
                        setSelectedNode((prev) =>
                          prev ? { ...prev, data: { ...prev.data, label: newLabel } } : null
                        );
                      }}
                      className="mt-1.5"
                      placeholder="Enter node label..."
                    />
                  </div>

                  <Separator />

                  {/* Node-specific Configuration */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Configuration</h4>
                    {renderNodeConfig()}
                  </div>

                  <Separator />

                  {/* Delete Node Button */}
                  <div className="pt-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                        setEdges((eds) =>
                          eds.filter(
                            (e) =>
                              e.source !== selectedNode.id &&
                              e.target !== selectedNode.id
                          )
                        );
                        setSelectedNode(null);
                      }}
                    >
                      Delete Node
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            )}
          </SheetContent>
        </Sheet>
      </div>

      {/* Deploy Dialog */}
      <Dialog open={isDeployDialogOpen} onOpenChange={setIsDeployDialogOpen}>
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Rocket className="w-4 h-4 text-purple-600" />
              {isEditMode ? "Update Chatflow" : "Deploy Chatflow"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {isEditMode
                ? "Review the channels and update your chatflow."
                : "Select the channels where you want to deploy your chatflow."}
            </DialogDescription>
          </DialogHeader>
          <ChannelSelector
            selectedChannels={selectedChannels}
            onChange={setSelectedChannels}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeployDialogOpen(false)}
              disabled={deployMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => deployMutation.mutate(selectedChannels)}
              disabled={deployMutation.isPending || selectedChannels.length === 0}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {deployMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4 mr-2" />
              )}
              {isEditMode ? "Update" : "Deploy to"} {selectedChannels.length} Channel{selectedChannels.length !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deployment Success Dialog — shows chatflow UUID, API key (once),
          and per-channel details (website → embed code, others → webhook URL). */}
      <Dialog
        open={!!deployResult}
        onOpenChange={(open) => {
          if (!open) setDeployResult(null);
        }}
      >
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              {isEditMode ? "Chatflow updated" : "Chatflow deployed"}
            </DialogTitle>
            <DialogDescription>
              {deployResult?.api_key
                ? "Save the API key now — it is shown only once."
                : isEditMode
                  ? "Channels re-registered. Your existing API key is unchanged — view or rotate it on the detail page."
                  : "Deployment complete. Open the detail page to view the API key, channels, and live test."}
            </DialogDescription>
          </DialogHeader>

          {deployResult && (
            <div className="space-y-4">
              {/* Chatflow ID */}
              <div>
                <Label className="text-xs text-gray-500">Chatflow ID</Label>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 font-mono text-xs bg-gray-100 dark:bg-gray-800 rounded px-2 py-1.5 truncate">
                    {deployResult.chatflow_id}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(deployResult.chatflow_id);
                      toast({ title: "Chatflow ID copied" });
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              {/* One-time API key */}
              {deployResult.api_key && (
                <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
                  <Label className="text-xs font-medium text-amber-800 dark:text-amber-200">
                    API key (shown once — save it now)
                  </Label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="flex-1 font-mono text-xs bg-white dark:bg-gray-900 border rounded px-2 py-1.5 truncate">
                      {deployResult.api_key}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void navigator.clipboard.writeText(deployResult.api_key!);
                        toast({ title: "API key copied" });
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                  {deployResult.api_key_prefix && (
                    <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                      Prefix {deployResult.api_key_prefix} will be visible on the
                      detail page; the full key will not.
                    </p>
                  )}
                </div>
              )}

              {/* Per-channel details */}
              {deployResult.channels && Object.keys(deployResult.channels).length > 0 && (
                <div>
                  <Label className="text-xs text-gray-500">Channels</Label>
                  <div className="mt-2 space-y-3">
                    {Object.entries(deployResult.channels).map(([channelName, info]) => {
                      // Classify failures into actionable buckets so each
                      // row can show the right next-step CTA. Helper lives
                      // in `lib/channelErrors.ts` and is shared with the
                      // chatflow detail page.
                      const errorInfo = classifyChannelError(channelName, info);
                      const needsInstall = info.status === "needs_install";
                      const installUrl =
                        (info as { install_url?: string }).install_url ||
                        info.webhook_url;
                      const installInstructions =
                        (info as { instructions?: string }).instructions;

                      return (
                        <div
                          key={channelName}
                          className="rounded-md border p-3 bg-white dark:bg-gray-900"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium capitalize">{channelName}</span>
                            {info.status === "success" ? (
                              <Badge variant="secondary">success</Badge>
                            ) : needsInstall ? (
                              <Badge
                                variant="outline"
                                className="text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700"
                              >
                                Install required
                              </Badge>
                            ) : errorInfo?.bucket === "operator_config" ? (
                              <Badge
                                variant="outline"
                                className="text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                              >
                                Skipped
                              </Badge>
                            ) : errorInfo?.bucket === "credential_missing" ? (
                              <Badge
                                variant="outline"
                                className="text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                              >
                                Needs credential
                              </Badge>
                            ) : errorInfo?.bucket === "conflict" ? (
                              <Badge variant="destructive">Conflict</Badge>
                            ) : (
                              <Badge variant="destructive">{info.status}</Badge>
                            )}
                          </div>
                          {needsInstall && installUrl && (
                            <div className="space-y-2">
                              {installInstructions && (
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {installInstructions}
                                </p>
                              )}
                              <Button
                                size="sm"
                                onClick={() => {
                                  window.open(installUrl, "_blank", "noopener,noreferrer");
                                }}
                                className="font-manrope bg-indigo-600 hover:bg-indigo-700 text-white"
                              >
                                {channelName === "discord"
                                  ? "Add to Discord"
                                  : `Install ${channelName}`}
                              </Button>
                            </div>
                          )}
                          {channelName === "website" && info.status === "success" && (
                            <EmbedCode
                              type="chatflow"
                              id={deployResult.chatflow_id}
                              showOptions={false}
                            />
                          )}
                          {channelName !== "website" && info.webhook_url && !needsInstall && (
                            <div className="flex items-center gap-2">
                              <code className="flex-1 min-w-0 font-mono text-xs bg-gray-50 dark:bg-gray-800 rounded px-2 py-1 break-all">
                                {info.webhook_url}
                              </code>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  void navigator.clipboard.writeText(info.webhook_url!);
                                  toast({ title: "Webhook URL copied" });
                                }}
                              >
                                Copy
                              </Button>
                            </div>
                          )}
                          {errorInfo && (
                            <div className="mt-1 space-y-2">
                              <p
                                className={
                                  errorInfo.bucket === "operator_config"
                                    ? "text-xs text-gray-500 dark:text-gray-400"
                                    : errorInfo.bucket === "credential_missing"
                                      ? "text-xs text-amber-700 dark:text-amber-400"
                                      : "text-xs text-red-600 dark:text-red-400"
                                }
                              >
                                {errorInfo.bucket === "operator_config"
                                  ? `Not configured — ${errorInfo.message}`
                                  : errorInfo.message}
                              </p>
                              {errorInfo.bucket === "credential_missing" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    navigate(
                                      `/settings/credentials?provider=${encodeURIComponent(
                                        errorInfo.hint?.provider ?? channelName,
                                      )}`,
                                    );
                                  }}
                                  className="font-manrope"
                                >
                                  Add {channelName} credential
                                </Button>
                              )}
                              {/* No CTA for operator_config — end users can't
                                  fix env vars; the message itself is enough. */}
                              {errorInfo.bucket === "conflict" && errorInfo.hint?.conflictingEntityId && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    navigate(`/studio/${errorInfo.hint!.conflictingEntityId!}`);
                                  }}
                                  className="font-manrope"
                                >
                                  Open {errorInfo.hint.conflictingEntityName ?? "conflicting chatflow"}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-md bg-gray-50 dark:bg-gray-900/60 p-3 text-xs text-gray-600 dark:text-gray-400">
                Test it via the public widget endpoint:
                <pre className="mt-1 font-mono whitespace-pre-wrap break-all text-xs">
{(() => {
  // Build the full URL from the configured API base — works in dev (localhost),
  // staging, and production without hardcoding any host.
  const apiBase = envConfig.API_BASE_URL.replace(/\/+$/, "");
  const url = `${apiBase}/public/bots/${deployResult.chatflow_id}/chat`;
  const auth = deployResult.api_key
    ? deployResult.api_key
    : "<your-api-key>";
  return `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${auth}" \\
  -d '{"message": "hello"}'`;
})()}
                </pre>
                {!deployResult.api_key && (
                  <p className="mt-2 text-[11px]">
                    Grab the key from the chatflow detail page (Regenerate if
                    you no longer have it).
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setDeployResult(null);
                navigate("/studio");
              }}
              className="w-full sm:w-auto whitespace-nowrap"
            >
              Back to Studio
            </Button>
            <Button
              onClick={() => {
                if (deployResult) {
                  setDeployResult(null);
                  navigate(`/studio/${deployResult.chatflow_id}`);
                }
              }}
              className="w-full sm:w-auto whitespace-nowrap bg-purple-600 hover:bg-purple-700"
            >
              Open detail page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
