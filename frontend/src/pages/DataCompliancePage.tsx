import { LegalLayout, type LegalSection } from "@/components/landing/LegalLayout";

const sections: LegalSection[] = [
  {
    title: "Data flow at a glance",
    content: `1. You upload a document → it is parsed (Crawl4AI / Unstructured / Jina adapters), chunked, embedded, and the chunk text + vector are stored in PostgreSQL and Qdrant respectively.
2. End-user sends a message → backend retrieves matching chunks via Qdrant, packages them with the system prompt and chat history, and sends the bundle into Secret Network's TEE for LLM inference.
3. The model response returns to the backend over TLS, is logged for the workspace's retention window, and is delivered to the user across the configured channel (web widget, Discord, Slack, Telegram, WhatsApp, Zapier, REST API).

Inputs to the model only contain what the chatflow nodes assemble (KB chunks, prompt, history). Nothing else leaves our infrastructure during inference.`,
  },
  {
    title: "Where data lives",
    content: `PostgreSQL — accounts, organizations, workspaces, chatbots, chatflows, knowledge bases, document records and chunk text, sessions, messages, leads, notifications, audit logs.
Qdrant — vector embeddings of KB chunks. Embeddings only; no plaintext document content.
Redis — drafts (24h TTL), session state, rate-limit counters, Celery broker.
Object storage — uploaded files (original PDFs, etc.) when you choose to retain them.
TEE (Secret Network) — ephemeral inference state. Nothing is persisted inside the enclave.`,
  },
  {
    title: "Encryption",
    content: `In transit — TLS 1.2+ on every public endpoint.
At rest — database-level encryption on managed Postgres and Redis. Files in object storage encrypted at rest by the provider.
Application-layer — third-party OAuth tokens and API credentials are encrypted with Fernet (AES-128 + HMAC) using a separate ENCRYPTION_KEY before being written to the database.
Inference — Secret VM encrypts memory in the TEE; remote attestation lets you verify the executing code.`,
  },
  {
    title: "Authentication and access control",
    content: `Sign-in: email + password (Argon2 hashed) or wallet sign-in (MetaMask, Phantom, Keplr).
Sessions: short-lived access tokens + refresh tokens.
RBAC: organization roles (owner / admin / member), workspace-level membership, staff-only admin endpoints.
API access: per-deployment API keys with prefix-only display after creation.
Audit: sensitive actions (member invites, KB deletes, deploys) are written to audit logs.`,
  },
  {
    title: "Sub-processors",
    content: `Inference: Secret Network (TEE provider).
Cloud infrastructure: hosting, managed PostgreSQL, managed Redis, managed object storage. Specific provider names and regions are disclosed under DPA. Email privexbot@gmail.com to request the current list.
Email delivery: transactional email provider for verification, invitations, alerts.
Error monitoring: error-tracking SaaS for stack traces and request metadata. Application messages and KB content are not sent.

Material additions are announced at least 14 days in advance where practicable.`,
  },
  {
    title: "Data retention defaults",
    content: `Account records — life of the account + 30 days post-closure (longer for tax records).
Workspace content — life of the workspace; deleted on demand.
Conversations — 90 days by default, configurable per workspace.
Operational logs — 30 days then aggregated.
Backups — encrypted database backups for up to 35 days.`,
  },
  {
    title: "Data subject access requests",
    content: `Email privexbot@gmail.com from your account address. We respond within 30 days. We can provide:
- A JSON export of your account, workspaces, KBs, chatbots, and chatflows
- A CSV export of conversations within your retention window
- Deletion (soft-delete now, hard-delete on the next backup-purge cycle)
- A list of sub-processors that may have processed your specific records`,
  },
  {
    title: "DPA / GDPR",
    content: `A Data Processing Agreement is available for Pro and Enterprise customers. Email privexbot@gmail.com with subject "DPA request" and we will provide our standard DPA, which includes Standard Contractual Clauses for international transfers.`,
  },
  {
    title: "Compliance posture",
    content: `We are an early-stage open-source project, not currently SOC 2 / ISO 27001 / HIPAA-certified. The platform is built with privacy-by-design (TEE inference, encryption, RBAC, retention controls, self-host option) and is suitable for many privacy-sensitive use cases. If your jurisdiction or industry imposes specific certification requirements, talk to us before relying on the hosted Service for production data.`,
  },
  {
    title: "Open source = self-host option",
    content: `The platform is Apache 2.0 (https://github.com/privexbot/privexbot). You can run the full stack on your own infrastructure to keep all data — including embeddings and conversation logs — inside your environment. The hosted Service is a convenience; the open codebase is the long-term guarantee.`,
  },
  {
    title: "Contact",
    content: `Privacy/compliance: privexbot@gmail.com
Engineering: https://github.com/privexbot/privexbot/issues
Community: https://discord.gg/53S3Ur9x`,
  },
];

export function DataCompliancePage() {
  return (
    <LegalLayout
      title="Data & Compliance"
      subtitle="A practical, technically accurate description of how data flows through PrivexBot."
      effectiveDate="2026-04-30"
      sections={sections}
    />
  );
}
