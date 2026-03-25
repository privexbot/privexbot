/**
 * Human Handoff Node Configuration Panel
 *
 * Configures human agent escalation with:
 * - Handoff method (webhook, email, Slack)
 * - Context depth (full, last 10, summary)
 * - Priority level
 * - Department routing
 * - Custom handoff message
 */

import { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CredentialSelector from "@/components/shared/CredentialSelector";

interface HandoffNodeConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const HANDOFF_METHODS = [
  { value: "webhook", label: "Webhook", description: "POST to helpdesk/CRM API" },
  { value: "email", label: "Email", description: "Send transcript via email" },
  { value: "slack", label: "Slack", description: "Post to Slack channel" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const CONTEXT_DEPTHS = [
  { value: "full", label: "Full Transcript", description: "All messages" },
  { value: "last_10", label: "Last 10 Messages", description: "Recent context" },
  { value: "summary", label: "Summary Only", description: "Message counts + last 3" },
];

export function HandoffNodeConfig({ config, onChange }: HandoffNodeConfigProps) {
  const [method, setMethod] = useState(
    (config.method as string) || "webhook"
  );
  const [webhookUrl, setWebhookUrl] = useState(
    (config.webhook_url as string) || ""
  );
  const [credentialId, setCredentialId] = useState(
    (config.credential_id as string) || ""
  );
  const [emailTo, setEmailTo] = useState(
    (config.email_to as string) || ""
  );
  const [contextDepth, setContextDepth] = useState(
    (config.context_depth as string) || "full"
  );
  const [handoffMessage, setHandoffMessage] = useState(
    (config.handoff_message as string) ||
      "I'm connecting you with a human agent who can help further. They'll have the full context of our conversation."
  );
  const [priority, setPriority] = useState(
    (config.priority as string) || "normal"
  );
  const [department, setDepartment] = useState(
    (config.department as string) || ""
  );

  const emitChange = useCallback(() => {
    const newConfig: Record<string, unknown> = {
      method,
      context_depth: contextDepth,
      handoff_message: handoffMessage,
      priority,
    };

    if (method === "webhook" || method === "slack") {
      newConfig.webhook_url = webhookUrl;
    }
    if (method === "email") {
      newConfig.email_to = emailTo;
    }
    if (credentialId) {
      newConfig.credential_id = credentialId;
    }
    if (department) {
      newConfig.department = department;
    }

    onChange(newConfig);
  }, [method, webhookUrl, credentialId, emailTo, contextDepth, handoffMessage, priority, department, onChange]);

  useEffect(() => {
    const timeoutId = setTimeout(emitChange, 300);
    return () => clearTimeout(timeoutId);
  }, [emitChange]);

  return (
    <div className="space-y-4">
      {/* Handoff Method */}
      <div>
        <Label className="text-sm font-medium">
          Handoff Method <span className="text-red-500">*</span>
        </Label>
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HANDOFF_METHODS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                <div>
                  <span className="font-medium">{m.label}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {m.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Webhook URL (for webhook and slack methods) */}
      {(method === "webhook" || method === "slack") && (
        <div>
          <Label className="text-sm font-medium">
            {method === "slack" ? "Slack Webhook URL" : "Webhook URL"}{" "}
            <span className="text-red-500">*</span>
          </Label>
          <Input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder={
              method === "slack"
                ? "https://hooks.slack.com/services/..."
                : "https://helpdesk.example.com/api/handoff"
            }
            className="mt-1.5 font-mono text-sm"
          />
        </div>
      )}

      {/* Email To (for email method) */}
      {method === "email" && (
        <div>
          <Label className="text-sm font-medium">
            Recipient Email <span className="text-red-500">*</span>
          </Label>
          <Input
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            placeholder="support-team@company.com"
            className="mt-1.5 text-sm"
          />
        </div>
      )}

      {/* Credential */}
      <CredentialSelector
        provider={method === "email" ? "smtp" : "custom"}
        selectedId={credentialId}
        onSelect={setCredentialId}
        label={
          method === "email"
            ? "SMTP Credential"
            : "Authentication Credential"
        }
        required={method === "email"}
      />

      {/* Context Depth */}
      <div>
        <Label className="text-sm font-medium">Context to Include</Label>
        <Select value={contextDepth} onValueChange={setContextDepth}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONTEXT_DEPTHS.map((cd) => (
              <SelectItem key={cd.value} value={cd.value}>
                <div>
                  <span className="font-medium">{cd.label}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {cd.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Priority */}
      <div>
        <Label className="text-sm font-medium">Priority</Label>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Department */}
      <div>
        <Label className="text-sm font-medium">Department / Routing Tag</Label>
        <Input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="support, sales, billing..."
          className="mt-1.5 text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Optional tag for routing to the right team
        </p>
      </div>

      {/* Handoff Message */}
      <div>
        <Label className="text-sm font-medium">Message to User</Label>
        <Textarea
          value={handoffMessage}
          onChange={(e) => setHandoffMessage(e.target.value)}
          placeholder="I'm connecting you with a human agent..."
          className="mt-1.5 h-20 text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Message shown to the user when handoff triggers
        </p>
      </div>
    </div>
  );
}
