/**
 * ChatflowDetailPage — read-only view of a deployed chatflow.
 *
 * Surfaces what the user needs AFTER deploy:
 * - UUID + status + core metadata
 * - Per-channel deployment details (website → embed code; others → setup info)
 * - A minimal test chat panel that posts to /api/v1/chatflows/{id}/test
 *
 * Kept deliberately narrow — does NOT duplicate the builder (Edit goes through
 * the edit-draft flow) and does NOT include analytics (that's a follow-up).
 */

import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Code as CodeIcon,
  Copy,
  Check,
  Edit3,
  ExternalLink,
  Globe,
  Key,
  Loader2,
  MessageCircle,
  Play,
  Power,
  RefreshCw,
  Send,
  Trash2,
  Workflow,
} from "lucide-react";
import { motion } from "framer-motion";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import EmbedCode from "@/components/shared/EmbedCode";
import CredentialSelector from "@/components/shared/CredentialSelector";
import { Switch } from "@/components/ui/switch";
import { chatflowApi } from "@/api/chatflow";
import { apiClient, handleApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import { WrongWorkspaceScreen } from "@/components/shared/WrongWorkspaceScreen";

type ChannelEntry = {
  type: string;
  enabled: boolean;
  config?: Record<string, unknown>;
};

type TestMessage = { role: "user" | "assistant"; content: string };

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Clipboard access denied.",
        variant: "destructive",
      });
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={copy} className="h-8">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      <span className="ml-1.5">{copied ? "Copied" : label}</span>
    </Button>
  );
}

function ChannelCard({
  chatflowId,
  entry,
}: {
  chatflowId: string;
  entry: ChannelEntry;
}) {
  const channelMeta: Record<string, { label: string; icon: React.ReactNode }> = {
    website: { label: "Website Widget", icon: <Globe className="h-4 w-4" /> },
    telegram: { label: "Telegram", icon: <MessageCircle className="h-4 w-4" /> },
    discord: { label: "Discord", icon: <MessageCircle className="h-4 w-4" /> },
    slack: { label: "Slack", icon: <MessageCircle className="h-4 w-4" /> },
    whatsapp: { label: "WhatsApp", icon: <MessageCircle className="h-4 w-4" /> },
    zapier: { label: "Zapier Webhook", icon: <MessageCircle className="h-4 w-4" /> },
  };
  const meta = channelMeta[entry.type] ?? {
    label: entry.type,
    icon: <MessageCircle className="h-4 w-4" />,
  };
  const cfg = entry.config ?? {};
  const webhookUrl =
    (cfg.webhook_url as string | undefined) ??
    (cfg.install_url as string | undefined) ??
    (cfg.url as string | undefined) ??
    "";
  // Only treat status === "success" as success. Anything else (including
  // missing status, which is the legacy/unregistered case) is non-success.
  const rawStatus = cfg.status as string | undefined;
  const isError = rawStatus === "error";
  const isRegistered = rawStatus === "success" || rawStatus === "ok";
  const errorMessage = (cfg.error as string | undefined) ?? "";

  // Slack uses install URL semantics, not webhook semantics.
  const urlLabel = entry.type === "slack" ? "Install URL" : "Webhook URL";
  const urlHelp =
    entry.type === "slack"
      ? "Open this URL to install the Slack app into your workspace."
      : null;

  const badgeText = !entry.enabled
    ? "disabled"
    : isError
      ? "error"
      : isRegistered
        ? "success"
        : "not registered";
  const badgeVariant = !entry.enabled || isError
    ? "destructive"
    : isRegistered
      ? "secondary"
      : "outline";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {meta.icon}
            {meta.label}
          </CardTitle>
          <Badge variant={badgeVariant}>{badgeText}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {entry.type === "website" && (
          <EmbedCode type="chatflow" id={chatflowId} showOptions={false} />
        )}
        {entry.type !== "website" && webhookUrl && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">{urlLabel}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-xs bg-gray-50 dark:bg-gray-900 border rounded px-2 py-1.5 truncate">
                {webhookUrl}
              </code>
              <CopyButton value={webhookUrl} />
            </div>
            {urlHelp && (
              <p className="text-xs text-gray-500">{urlHelp}</p>
            )}
          </div>
        )}
        {entry.type !== "website" && !webhookUrl && isError && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {errorMessage || "Channel registration failed — check the credential."}
          </p>
        )}
        {entry.type !== "website" && !webhookUrl && !isError && (
          <p className="text-xs text-gray-500">
            This channel is configured but has not been registered yet. Open
            the chatflow in the builder and click Deploy again to register the
            webhook.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TestChatPanel({ chatflowId }: { chatflowId: string }) {
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      // Per-request 90s timeout: chatflow inference goes through Secret AI
      // (cold-start latency + remote inference) plus optional KB embedding
      // and Qdrant search. The global axios timeout is 30s, which routinely
      // trips on the first message of a session. Override here so the test
      // panel waits for a real answer instead of dying mid-request.
      const response = await apiClient.post<{
        response?: string;
        message?: string;
        session_id?: string;
      }>(
        `/chatflows/${chatflowId}/test`,
        {
          message,
          session_id: sessionId,
        },
        { timeout: 90000 },
      );
      return response.data;
    },
    onSuccess: (data) => {
      if (data.session_id) setSessionId(data.session_id);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.response ?? data.message ?? "(no response)" },
      ]);
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : handleApiError(err));
    },
  });

  const onSend = () => {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    sendMutation.mutate(text);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Play className="h-4 w-4" />
          Test this chatflow
        </CardTitle>
        <CardDescription>
          Sends messages to <code className="font-mono text-xs">/api/v1/chatflows/{chatflowId}/test</code> (workspace-authenticated).
          Session persists until you clear it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md bg-gray-50 dark:bg-gray-900/40 h-64 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 ? (
            <p className="text-xs text-gray-500 text-center pt-12">
              Say hello to start the conversation.
            </p>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                    msg.role === "user"
                      ? "bg-purple-600 text-white"
                      : "bg-white dark:bg-gray-800 border"
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
              </div>
            ))
          )}
          {sendMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 border rounded-lg px-3 py-2 text-sm">
                <Loader2 className="h-3 w-3 animate-spin inline" />
                <span className="ml-1.5 text-xs text-gray-500">Thinking…</span>
              </div>
            </div>
          )}
        </div>
        {error && (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}
        <div className="mt-3 flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Type a message…"
            className="flex-1 h-10 px-3 border rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <Button onClick={onSend} disabled={!input.trim() || sendMutation.isPending}>
            <Send className="h-4 w-4" />
          </Button>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              onClick={() => {
                setMessages([]);
                setSessionId(null);
                setError(null);
              }}
            >
              Clear
            </Button>
          )}
        </div>
        {sessionId && (
          <p className="mt-2 text-[11px] text-gray-500 font-mono">
            session_id: {sessionId}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

type ApiKeySummary = {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  created_at: string;
  last_used_at?: string | null;
};

function ApiKeysPanel({ chatflowId }: { chatflowId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: keys, isLoading } = useQuery({
    queryKey: ["chatflow-api-keys", chatflowId],
    queryFn: async () => {
      const response = await apiClient.get<ApiKeySummary[]>(
        `/chatflows/${chatflowId}/api-keys`
      );
      return response.data;
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<{
        id: string;
        name: string;
        key_prefix: string;
        api_key: string;
        message: string;
      }>(`/chatflows/${chatflowId}/api-keys/regenerate`);
      return response.data;
    },
    onSuccess: (data) => {
      setRevealedKey(data.api_key);
      queryClient.invalidateQueries({ queryKey: ["chatflow-api-keys", chatflowId] });
      toast({
        title: "API key regenerated",
        description: "Save it now — it won't be shown again.",
      });
    },
    onError: (err) =>
      toast({
        title: "Regenerate failed",
        description: err instanceof Error ? err.message : handleApiError(err),
        variant: "destructive",
      }),
  });

  const activeKey = keys?.find((k) => k.is_active);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            API key
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={regenerateMutation.isPending}
          >
            {regenerateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Regenerate
          </Button>
        </div>
        <CardDescription>
          Used by the widget and any external API client. Regenerating
          invalidates the previous key everywhere it is in use.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        ) : !activeKey ? (
          <p className="text-sm text-gray-500">
            No active API key. Click <strong>Regenerate</strong> to create one.
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs bg-gray-50 dark:bg-gray-900 border rounded px-2 py-1.5 truncate">
              {activeKey.key_prefix}
              <span className="text-gray-400">…</span>
            </code>
            <span className="text-[11px] text-gray-500">
              {activeKey.last_used_at
                ? `Last used ${new Date(activeKey.last_used_at).toLocaleDateString()}`
                : "Never used"}
            </span>
          </div>
        )}

        {revealedKey && (
          <Alert>
            <AlertDescription className="space-y-2">
              <p className="text-sm font-medium">
                Save this key — it won't be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-xs bg-white dark:bg-gray-950 border rounded px-2 py-1.5 truncate">
                  {revealedKey}
                </code>
                <CopyButton value={revealedKey} />
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate API key?</AlertDialogTitle>
            <AlertDialogDescription>
              The current key stops working immediately. Any embed or webhook
              still using it will need the new value. The new key is shown
              once — copy it before navigating away.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                regenerateMutation.mutate();
              }}
            >
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Channel setup — per-channel toggle / credential picker / Save
// ────────────────────────────────────────────────────────────────────────────

type ChannelTypeKey = "website" | "telegram" | "discord" | "slack" | "whatsapp" | "zapier";

const CHANNEL_META: Record<
  ChannelTypeKey,
  { label: string; provider?: string; credentialRequired: boolean; description: string }
> = {
  website: {
    label: "Website Widget",
    credentialRequired: false,
    description: "Embed the widget on your site — no credential needed.",
  },
  telegram: {
    label: "Telegram",
    provider: "telegram",
    credentialRequired: true,
    description: "Connect a Telegram bot using its bot token credential.",
  },
  discord: {
    label: "Discord",
    provider: "discord",
    credentialRequired: true,
    description: "Connect a Discord application using its bot token credential.",
  },
  slack: {
    label: "Slack",
    credentialRequired: false,
    description:
      "Slack uses one shared installation URL — customers install the app into their workspace.",
  },
  whatsapp: {
    label: "WhatsApp",
    provider: "whatsapp",
    credentialRequired: true,
    description: "Connect a WhatsApp Business account via its access token credential.",
  },
  zapier: {
    label: "Zapier Webhook",
    credentialRequired: false,
    description: "Generates a static webhook URL Zaps can POST to.",
  },
};

const CHANNEL_ORDER: ChannelTypeKey[] = [
  "website",
  "telegram",
  "discord",
  "slack",
  "whatsapp",
  "zapier",
];

function ChannelSetupCard({
  chatflowId,
  channelType,
  current,
  onChanged,
}: {
  chatflowId: string;
  channelType: ChannelTypeKey;
  current: Record<string, unknown> | undefined;
  onChanged: () => void;
}) {
  const meta = CHANNEL_META[channelType];
  const { toast } = useToast();
  const isRegistered =
    (current?.status as string | undefined) === "success" ||
    (current?.status as string | undefined) === "ok";
  const [enabled, setEnabled] = useState(!!current);
  const [credentialId, setCredentialId] = useState<string>(
    (current?.bot_token_credential_id as string | undefined) ??
      (current?.access_token_credential_id as string | undefined) ??
      "",
  );
  // WhatsApp also needs phone_number_id and (display) phone_number.
  const [phoneNumberId, setPhoneNumberId] = useState<string>(
    (current?.phone_number_id as string | undefined) ?? "",
  );
  const [phoneNumber, setPhoneNumber] = useState<string>(
    (current?.phone_number as string | undefined) ?? "",
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { enabled };
      if (enabled && meta.credentialRequired) {
        if (!credentialId) {
          throw new Error("Pick a credential first.");
        }
        body.credential_id = credentialId;
      }
      if (enabled && channelType === "whatsapp") {
        body.config = {
          phone_number_id: phoneNumberId || undefined,
          phone_number: phoneNumber || undefined,
        };
      }
      const response = await apiClient.put<{
        channel_type: string;
        result: Record<string, unknown>;
      }>(`/chatflows/${chatflowId}/channels/${channelType}`, body);
      return response.data;
    },
    onSuccess: (data) => {
      const status = (data.result?.status as string | undefined) ?? "saved";
      const errorText = data.result?.error as string | undefined;
      if (status === "error" && errorText) {
        toast({
          title: `${meta.label}: registration failed`,
          description: errorText,
          variant: "destructive",
        });
      } else if (status === "disabled") {
        toast({ title: `${meta.label} disabled` });
      } else {
        toast({ title: `${meta.label} saved`, description: status });
      }
      onChanged();
    },
    onError: (err) =>
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : handleApiError(err),
        variant: "destructive",
      }),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{meta.label}</CardTitle>
          <div className="flex items-center gap-2">
            {isRegistered && enabled && (
              <Badge variant="secondary">connected</Badge>
            )}
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>
        <CardDescription className="text-xs">{meta.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {enabled && meta.credentialRequired && meta.provider && (
          <CredentialSelector
            provider={meta.provider as never}
            selectedId={credentialId || undefined}
            onSelect={(id) => setCredentialId(id)}
            label={`${meta.label} credential`}
            required
          />
        )}

        {enabled && channelType === "whatsapp" && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <p className="text-xs text-gray-500 mb-1">Phone number ID</p>
              <input
                className="w-full rounded border px-2 py-1.5 text-xs font-mono bg-white dark:bg-gray-900"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                placeholder="123456789012345"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Display phone number</p>
              <input
                className="w-full rounded border px-2 py-1.5 text-xs font-mono bg-white dark:bg-gray-900"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+15551234567"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {!enabled
              ? "Disabled — Save to remove this channel."
              : isRegistered
                ? "Already registered. Save again to refresh."
                : "Save to register."}
          </span>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : null}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ChannelSetupPanel({
  chatflowId,
  deployment,
}: {
  chatflowId: string;
  deployment: Record<string, Record<string, unknown>>;
}) {
  const queryClient = useQueryClient();

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold font-manrope flex items-center gap-2">
        <CodeIcon className="h-4 w-4" />
        Channel setup
      </h2>
      <p className="text-xs text-gray-500">
        Add or rotate the credentials each channel needs. Saving a channel
        registers (or refreshes) it with the upstream platform — Telegram,
        Discord, etc. — without round-tripping through the builder.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {CHANNEL_ORDER.map((type) => (
          <ChannelSetupCard
            key={type}
            chatflowId={chatflowId}
            channelType={type}
            current={deployment[type]}
            onChanged={() => {
              queryClient.invalidateQueries({ queryKey: ["chatflow", chatflowId] });
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ChatflowDetailPage() {
  const { chatflowId } = useParams<{ chatflowId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currentWorkspace } = useApp();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    data: chatflow,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["chatflow", chatflowId],
    queryFn: () => (chatflowId ? chatflowApi.get(chatflowId) : null),
    enabled: !!chatflowId,
    retry: false,
  });

  // Cross-workspace race: chatflow fetched in workspace A then user switched
  // to B. Match the KB/chatbot pattern — show the dedicated screen.
  const wrongWorkspaceFor =
    chatflow && currentWorkspace && chatflow.workspace_id !== currentWorkspace.id
      ? chatflow.workspace_id
      : null;

  const editMutation = useMutation({
    mutationFn: chatflowApi.createEditDraft,
    onSuccess: (data) => navigate(`/chatflows/builder/${data.draft_id}`),
    onError: (err) =>
      toast({
        title: "Couldn't open editor",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      }),
  });

  const toggleMutation = useMutation({
    mutationFn: chatflowApi.toggle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatflow", chatflowId] });
      queryClient.invalidateQueries({ queryKey: ["chatflows"] });
      toast({ title: "Status updated" });
    },
    onError: (err) =>
      toast({
        title: "Toggle failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: chatflowApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatflows"] });
      toast({ title: "Chatflow deleted" });
      navigate("/studio");
    },
    onError: (err) =>
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      }),
  });

  const redeployChannelsMutation = useMutation({
    mutationFn: async () => {
      if (!chatflowId) throw new Error("Missing chatflowId");
      const response = await apiClient.post<{
        chatflow_id: string;
        channels: Record<string, Record<string, unknown>>;
      }>(`/chatflows/${chatflowId}/channels/redeploy`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chatflow", chatflowId] });
      const errorChannels = Object.entries(data.channels).filter(
        ([, cfg]) => cfg?.status === "error"
      );
      toast({
        title: "Channels re-registered",
        description:
          errorChannels.length > 0
            ? `${errorChannels.length} channel(s) failed — check the cards below.`
            : "All channels updated successfully.",
        variant: errorChannels.length > 0 ? "destructive" : "default",
      });
    },
    onError: (err) =>
      toast({
        title: "Re-register failed",
        description: err instanceof Error ? err.message : handleApiError(err),
        variant: "destructive",
      }),
  });

  const channels = useMemo<ChannelEntry[]>(() => {
    // After a successful deploy, backend writes chatflow.config.deployment as
    // a flat dict keyed by channel type (e.g. {telegram: {webhook_url: ...}}).
    // Older rows (and the pre-deploy draft input) can also be:
    //   - an array of {type, enabled, config}
    //   - the wrapped form {channels: [...]} where channels is the array
    // Normalize all three shapes to ChannelEntry[].
    const raw = (chatflow?.config as { deployment?: unknown })?.deployment;
    if (!raw) return [];

    // Unwrap legacy {channels: [...]} form so existing rows still display.
    let deployment: unknown = raw;
    if (
      typeof raw === "object" &&
      !Array.isArray(raw) &&
      Array.isArray((raw as { channels?: unknown }).channels)
    ) {
      deployment = (raw as { channels: unknown[] }).channels;
    }

    if (Array.isArray(deployment)) {
      return (deployment as ChannelEntry[]).filter((c) => c?.type);
    }
    if (typeof deployment === "object" && deployment !== null) {
      return Object.entries(deployment as Record<string, Record<string, unknown>>).map(
        ([type, cfg]) => ({
          type,
          enabled: cfg?.enabled !== false,
          config: cfg,
        })
      );
    }
    return [];
  }, [chatflow]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    );
  }

  if (wrongWorkspaceFor) {
    return (
      <WrongWorkspaceScreen
        resourceKind="chatflow"
        resourceWorkspaceId={wrongWorkspaceFor}
        fallbackPath="/studio"
      />
    );
  }

  if (isError || !chatflow) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto py-16 px-4 text-center">
          <h1 className="text-xl font-semibold mb-2">Chatflow not found</h1>
          <p className="text-sm text-gray-500 mb-6">
            {error instanceof Error
              ? error.message
              : "We couldn't load this chatflow."}
          </p>
          <Button onClick={() => navigate("/studio")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Studio
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/studio")}
            className="text-gray-600 dark:text-gray-400 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Studio
          </Button>
        </div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-start justify-between gap-4"
        >
          <div className="flex items-start gap-4 min-w-0">
            <Workflow className="h-6 w-6 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-1" />
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold font-manrope truncate">
                  {chatflow.name}
                </h1>
                <Badge variant={chatflow.is_active ? "secondary" : "outline"}>
                  {chatflow.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              {chatflow.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {chatflow.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 rounded px-2 py-1">
                  {chatflow.id}
                </code>
                <CopyButton value={chatflow.id} label="Copy ID" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => toggleMutation.mutate(chatflow.id)}
              disabled={toggleMutation.isPending}
            >
              <Power className="h-4 w-4 mr-2" />
              {chatflow.is_active ? "Deactivate" : "Activate"}
            </Button>
            <Button
              onClick={() => editMutation.mutate(chatflow.id)}
              disabled={editMutation.isPending}
            >
              {editMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Edit3 className="h-4 w-4 mr-2" />
              )}
              Edit
            </Button>
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500">Nodes</p>
              <p className="text-2xl font-semibold font-manrope">
                {Array.isArray(
                  (chatflow.config as { nodes?: unknown[] })?.nodes
                )
                  ? (chatflow.config as { nodes: unknown[] }).nodes.length
                  : 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500">Version</p>
              <p className="text-2xl font-semibold font-manrope">
                {chatflow.version ?? 1}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500">Deployed</p>
              <p className="text-sm font-medium mt-1">
                {chatflow.deployed_at
                  ? new Date(chatflow.deployed_at).toLocaleString()
                  : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500">Last edit</p>
              <p className="text-sm font-medium mt-1">
                {chatflow.updated_at
                  ? new Date(chatflow.updated_at).toLocaleString()
                  : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Two-column: channels + test */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold font-manrope flex items-center gap-2">
                <CodeIcon className="h-4 w-4" />
                Deployment channels
              </h2>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => redeployChannelsMutation.mutate()}
                  disabled={
                    redeployChannelsMutation.isPending || channels.length === 0
                  }
                  title="Re-run webhook registration for all configured channels"
                >
                  {redeployChannelsMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Re-register
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editMutation.mutate(chatflow.id)}
                  disabled={editMutation.isPending}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Manage
                </Button>
              </div>
            </div>
            {channels.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No channels deployed yet. Click <strong>Edit</strong> and
                  deploy this chatflow to add website widgets or bot
                  integrations.
                </AlertDescription>
              </Alert>
            ) : (
              channels
                .filter((c) => c.enabled)
                .map((entry) => (
                  <ChannelCard
                    key={entry.type}
                    chatflowId={chatflow.id}
                    entry={entry}
                  />
                ))
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold font-manrope">Live test</h2>
            <TestChatPanel chatflowId={chatflow.id} />
          </div>
        </div>

        <div className="mt-6">
          <ApiKeysPanel chatflowId={chatflow.id} />
        </div>

        <div className="mt-6">
          <ChannelSetupPanel
            chatflowId={chatflow.id}
            deployment={(() => {
              // Normalize whatever shape `chatflow.config.deployment` is into
              // a flat dict for the panel — same as the channels reader above
              // but kept inline so the panel can take the latest from the
              // refetched query without re-running useMemo.
              const raw = (chatflow.config as { deployment?: unknown })
                ?.deployment;
              if (!raw) return {};
              if (Array.isArray(raw)) {
                const out: Record<string, Record<string, unknown>> = {};
                for (const c of raw as Array<{
                  type?: string;
                  config?: Record<string, unknown>;
                }>) {
                  if (c?.type) out[c.type] = c.config ?? {};
                }
                return out;
              }
              if (
                typeof raw === "object" &&
                Array.isArray((raw as { channels?: unknown }).channels)
              ) {
                const out: Record<string, Record<string, unknown>> = {};
                for (const c of (raw as { channels: Array<{ type?: string; config?: Record<string, unknown> }> }).channels) {
                  if (c?.type) out[c.type] = c.config ?? {};
                }
                return out;
              }
              return raw as Record<string, Record<string, unknown>>;
            })()}
          />
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chatflow?</AlertDialogTitle>
            <AlertDialogDescription>
              This will soft-delete <strong>{chatflow.name}</strong>. Active
              deployments will stop responding. You can restore within 30 days
              from the admin tools.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteMutation.mutate(chatflow.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
