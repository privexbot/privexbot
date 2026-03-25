/**
 * Notification Node Configuration Panel
 *
 * Configures team notifications with:
 * - Channel selection (Slack, Discord, Teams, Custom)
 * - Webhook URL or credential
 * - Message template with variables
 * - Urgency level and title
 * - Optional mention
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CredentialSelector from "@/components/shared/CredentialSelector";

interface NotificationNodeConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const CHANNELS = [
  { value: "slack", label: "Slack" },
  { value: "discord", label: "Discord" },
  { value: "teams", label: "Microsoft Teams" },
  { value: "custom", label: "Custom Webhook" },
];

const URGENCY_LEVELS = [
  { value: "info", label: "Info", emoji: "ℹ️" },
  { value: "warning", label: "Warning", emoji: "⚠️" },
  { value: "alert", label: "Alert", emoji: "🚨" },
];

const AVAILABLE_VARIABLES = [
  { name: "input", description: "User message" },
  { name: "user_name", description: "User name" },
  { name: "user_email", description: "User email" },
];

export function NotificationNodeConfig({
  config,
  onChange,
}: NotificationNodeConfigProps) {
  const [channel, setChannel] = useState(
    (config.channel as string) || "slack"
  );
  const [webhookUrl, setWebhookUrl] = useState(
    (config.webhook_url as string) || ""
  );
  const [credentialId, setCredentialId] = useState(
    (config.credential_id as string) || ""
  );
  const [message, setMessage] = useState((config.message as string) || "");
  const [title, setTitle] = useState((config.title as string) || "");
  const [urgency, setUrgency] = useState(
    (config.urgency as string) || "info"
  );
  const [mention, setMention] = useState((config.mention as string) || "");

  const emitChange = useCallback(() => {
    onChange({
      channel,
      webhook_url: webhookUrl || undefined,
      credential_id: credentialId || undefined,
      message,
      title: title || undefined,
      urgency,
      mention: mention || undefined,
    });
  }, [channel, webhookUrl, credentialId, message, title, urgency, mention, onChange]);

  useEffect(() => {
    const timeoutId = setTimeout(emitChange, 300);
    return () => clearTimeout(timeoutId);
  }, [emitChange]);

  const insertVariable = (varName: string) => {
    setMessage((prev) => prev + `{{${varName}}}`);
  };

  return (
    <div className="space-y-4">
      {/* Channel */}
      <div>
        <Label className="text-sm font-medium">
          Channel <span className="text-red-500">*</span>
        </Label>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHANNELS.map((ch) => (
              <SelectItem key={ch.value} value={ch.value}>
                {ch.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Webhook URL */}
      <div>
        <Label className="text-sm font-medium">
          Webhook URL {!credentialId && <span className="text-red-500">*</span>}
        </Label>
        <Input
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder={
            channel === "slack"
              ? "https://hooks.slack.com/services/..."
              : channel === "discord"
              ? "https://discord.com/api/webhooks/..."
              : channel === "teams"
              ? "https://outlook.office.com/webhook/..."
              : "https://your-webhook-url.com/..."
          }
          className="mt-1.5 font-mono text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Or use a credential below instead
        </p>
      </div>

      {/* Credential (alternative to URL) */}
      <CredentialSelector
        provider="custom"
        selectedId={credentialId}
        onSelect={setCredentialId}
        label="Webhook Credential (alternative)"
        required={false}
      />

      {/* Title */}
      <div>
        <Label className="text-sm font-medium">Title</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New Lead Alert"
          className="mt-1.5 text-sm"
        />
      </div>

      {/* Message */}
      <div>
        <Label className="text-sm font-medium">
          Message <span className="text-red-500">*</span>
        </Label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="New lead from {{user_name}} ({{user_email}}): {{input}}"
          className="mt-1.5 h-24 text-sm"
        />
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {AVAILABLE_VARIABLES.map((v) => (
            <Button
              key={v.name}
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => insertVariable(v.name)}
            >
              <Badge variant="secondary" className="text-xs">
                {`{{${v.name}}}`}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* Urgency */}
      <div>
        <Label className="text-sm font-medium">Urgency</Label>
        <Select value={urgency} onValueChange={setUrgency}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {URGENCY_LEVELS.map((u) => (
              <SelectItem key={u.value} value={u.value}>
                {u.emoji} {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mention */}
      <div>
        <Label className="text-sm font-medium">Mention</Label>
        <Input
          value={mention}
          onChange={(e) => setMention(e.target.value)}
          placeholder={
            channel === "slack" ? "@channel or @here" : "Optional mention"
          }
          className="mt-1.5 text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Tag a channel, group, or user
        </p>
      </div>

      {/* Preview */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-xs font-medium text-gray-500 mb-1">
          Sending to
        </p>
        <p className="text-sm">
          <span className="font-medium capitalize">{channel}</span>
          {title && <span className="text-gray-500"> &mdash; {title}</span>}
        </p>
      </div>
    </div>
  );
}
