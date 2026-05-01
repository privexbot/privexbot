/**
 * Single source of truth for credential provider metadata.
 *
 * Both `Credentials.tsx` (the management page) and `CredentialSelector.tsx`
 * (the picker shown inside chatflow node config) import from here so the
 * provider list, labels, and icons stay aligned. Previously these lived as
 * two separately-maintained arrays — adding a provider in one place and
 * forgetting the other was a recurring drift source.
 *
 * Keep this file flat: no React, no API calls. Pure metadata that can be
 * imported anywhere without pulling in the network layer.
 */

export type CredentialProvider =
  | "notion"
  | "google"        // Drive / Docs / Sheets
  | "google_gmail"  // Gmail send + userinfo
  | "slack"
  | "telegram"
  | "discord"
  | "whatsapp"
  | "calendly"
  | "database"
  | "smtp"
  | "custom";

// NOTE: "openai" and "anthropic" were intentionally REMOVED from this list.
// Storing those credentials did nothing in practice — the LLM node calls
// `inference_service`, which reads `OPENAI_API_KEY` / `SECRET_AI_API_KEY`
// from operator-managed env vars (`backend/src/app/core/config.py`). No
// node executor or service ever queried `Credential.provider == "openai"`.
// Re-add only when bring-your-own-key for the LLM node is actually wired up.

export interface CredentialProviderInfo {
  /** Stable string used as `Credential.provider` in the database. */
  value: CredentialProvider;
  /** Display label shown in pickers and badges. */
  label: string;
  /** Emoji glyph rendered next to the label (kept simple — no asset deps). */
  icon: string;
  /**
   * `true` when the provider supports OAuth init via
   * `POST /credentials/oauth/authorize`. Manual token paste is still
   * accepted for these providers but the OAuth flow is the recommended
   * path. `false` when the only acceptable mechanism is a manual token
   * paste (Telegram, WhatsApp, Discord BYOB).
   */
  requiresOAuth: boolean;
  /** `true` when the credential is a database connection string. */
  requiresDatabase: boolean;
}

/**
 * Canonical provider list. Order matters — it's the order pickers render.
 * To add a provider: edit this array AND add a backend handler in
 * `routes/credentials.py`. No other frontend file should hard-code provider
 * labels.
 */
export const CREDENTIAL_PROVIDERS: CredentialProviderInfo[] = [
  { value: "notion",       label: "Notion",             icon: "📝", requiresOAuth: true,  requiresDatabase: false },
  // The backend's `google` provider already requests Drive + Docs + Sheets
  // readonly scopes (see credentials.py google branch), so the credential
  // row stored is `provider="google"`. Keep "Google Drive" label for clarity.
  { value: "google",       label: "Google Drive",       icon: "📁", requiresOAuth: true,  requiresDatabase: false },
  { value: "google_gmail", label: "Gmail",              icon: "📧", requiresOAuth: true,  requiresDatabase: false },
  { value: "slack",        label: "Slack",              icon: "💬", requiresOAuth: true,  requiresDatabase: false },
  { value: "telegram",     label: "Telegram Bot",       icon: "✈️", requiresOAuth: false, requiresDatabase: false },
  { value: "discord",      label: "Discord Bot",        icon: "🎮", requiresOAuth: false, requiresDatabase: false },
  { value: "whatsapp",     label: "WhatsApp Business",  icon: "💬", requiresOAuth: false, requiresDatabase: false },
  { value: "calendly",     label: "Calendly",           icon: "📅", requiresOAuth: true,  requiresDatabase: false },
  { value: "database",     label: "Database",           icon: "🗄️", requiresOAuth: false, requiresDatabase: true  },
  { value: "smtp",         label: "SMTP Email Server",  icon: "📨", requiresOAuth: false, requiresDatabase: false },
];

/** Lookup helper — returns undefined for unknown providers. */
export function getProviderInfo(
  provider: string | undefined,
): CredentialProviderInfo | undefined {
  if (!provider) return undefined;
  return CREDENTIAL_PROVIDERS.find((p) => p.value === provider);
}
