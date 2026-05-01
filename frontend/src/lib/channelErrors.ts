/**
 * Classify channel-deploy error strings into actionable buckets.
 *
 * The deploy modal and the chatflow-detail page both render per-channel
 * results from `FinalizeChatflowResponse`. When `info.status !== "success"`
 * we want to show the user a contextual next step — not just a red badge.
 *
 * Buckets:
 *   - `credential_missing` — the user picked a channel but didn't attach
 *     a credential. CTA: link to `/settings/credentials?provider=<channel>`.
 *   - `operator_config`   — backend env vars are missing (e.g. SLACK_CLIENT_ID
 *     not set). User can't fix this — it needs the platform operator. CTA:
 *     a soft "needs platform setup" message + link to /help.
 *   - `conflict`          — credential is wired to a different chatflow
 *     (Telegram block-on-collision). CTA: open the conflicting chatflow.
 *   - `api_failure`       — anything else (transient / permission /
 *     provider-side errors). CTA: re-register button.
 *
 * Detection is deliberately string-pattern based: backend errors are free
 * text today, so we match keywords. Adding `error_code` to the backend
 * response (Section 2 does this for Telegram conflicts) gives us a
 * structured override; otherwise we fall back to keyword matching.
 */

export type ChannelErrorBucket =
  | "credential_missing"
  | "operator_config"
  | "conflict"
  | "api_failure";

export interface ChannelErrorInfo {
  bucket: ChannelErrorBucket;
  message: string;
  /**
   * For `credential_missing`: which provider to preselect on the
   * `/settings/credentials` page. For `conflict`: the target entity.
   */
  hint?: {
    provider?: string;
    conflictingEntityId?: string;
    conflictingEntityType?: "chatbot" | "chatflow";
    conflictingEntityName?: string;
  };
}

const CREDENTIAL_PATTERNS = [
  /credential is required/i,
  /credential not found/i,
  /access token credential is required/i,
  /bot token credential is required/i,
];

const OPERATOR_PATTERNS = [
  /SLACK_CLIENT_ID/,
  /GOOGLE_CLIENT_ID/,
  /NOTION_CLIENT_ID/,
  /CALENDLY_CLIENT_ID/,
  /DISCORD_SHARED_/,
  /not configured/i,
  /env var/i,
  /needs platform setup/i,
];

interface RawChannelInfo {
  status?: string;
  error?: string;
  error_code?: string;
  conflict?: {
    entity_type?: "chatbot" | "chatflow";
    entity_id?: string;
    entity_name?: string;
  };
}

export function classifyChannelError(
  channelName: string,
  info: RawChannelInfo,
): ChannelErrorInfo | null {
  // `needs_install` is the Discord shared-bot path: not an error, we render
  // an "Add to Discord" CTA elsewhere instead of going through this helper.
  if (!info || info.status === "success" || info.status === "needs_install") {
    return null;
  }

  const message = info.error ?? "";
  const code = info.error_code ?? "";

  // Structured-code path takes precedence over string matching.
  if (code === "telegram_credential_in_use" || info.conflict) {
    return {
      bucket: "conflict",
      message: message || "This credential is already in use by another chatflow.",
      hint: info.conflict
        ? {
            conflictingEntityId: info.conflict.entity_id,
            conflictingEntityType: info.conflict.entity_type,
            conflictingEntityName: info.conflict.entity_name,
          }
        : undefined,
    };
  }

  if (CREDENTIAL_PATTERNS.some((re) => re.test(message))) {
    return {
      bucket: "credential_missing",
      message,
      hint: { provider: channelName },
    };
  }

  if (OPERATOR_PATTERNS.some((re) => re.test(message))) {
    return { bucket: "operator_config", message };
  }

  return { bucket: "api_failure", message };
}
