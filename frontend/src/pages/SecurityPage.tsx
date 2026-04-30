import { LegalLayout, type LegalSection } from "@/components/landing/LegalLayout";

const sections: LegalSection[] = [
  {
    title: "Threat model",
    content: `PrivexBot is built around one core threat: that an LLM provider — including us — could read your prompts, KB chunks, or conversation logs. Our entire architecture answers that single question.

Inference runs inside Secret Network's Trusted Execution Environment (TEE). The enclave processes your data with memory encryption, and remote attestation lets you verify the executing code. We, the platform operators, cannot read what is happening inside the enclave.`,
  },
  {
    title: "Confidential compute",
    content: `Provider: Secret Network (SCRT Labs grant ecosystem).
Mechanism: Intel SGX-based enclaves running attested binaries.
What this protects: prompts, system prompts, retrieved KB chunks, conversation history sent to the model, and model outputs as they cross the enclave boundary.
What this does NOT protect: data you choose to log outside the enclave (conversation history saved for analytics, KB documents stored in our PostgreSQL/Qdrant). Self-hosting addresses this for the most sensitive cases.`,
  },
  {
    title: "Encryption",
    content: `In transit: TLS 1.2+ on every public endpoint. HSTS enforced.
At rest: managed PostgreSQL and Redis with provider-level encryption. Object storage encrypted at rest.
Application-layer: integration credentials (Notion, Google, Calendly OAuth tokens, API keys for HTTP nodes, etc.) are encrypted with Fernet (AES-128-CBC + HMAC-SHA256) using a separate ENCRYPTION_KEY before storage. Decryption only happens in memory at use-time.`,
  },
  {
    title: "Authentication",
    content: `- Email + password — Argon2id hashing, password reset via signed email links.
- Wallet sign-in — MetaMask, Phantom, Keplr (signed message authentication).
- Sessions — short-lived access tokens with refresh-token rotation.
- 2FA — on the roadmap (TOTP).`,
  },
  {
    title: "Authorization",
    content: `Multi-tenancy: Organization → Workspace boundary on every operational query. Cross-org reads are blocked at the route layer, not "trusted" in services.
Roles: Organization owner / admin / member. Staff role for platform operators (admin endpoints).
Audit: sensitive actions (member invites, KB deletions, deploys, OAuth credential creation) are written to audit logs.`,
  },
  {
    title: "Open source as a security primitive",
    content: `The whole platform is published under Apache 2.0 at https://github.com/privexbot/privexbot. Anyone can audit how authentication, encryption, and the TEE handoff work. Anyone can self-host to keep all data — including embeddings and conversation logs — inside their own environment.`,
  },
  {
    title: "Vulnerability disclosure",
    content: `We welcome reports from the security community. Please email privexbot@gmail.com with subject "security" and include:
- Affected component and version (commit SHA if applicable)
- Reproduction steps
- Impact assessment

We will acknowledge within 3 business days and aim to ship a fix or mitigation within 30 days for high-severity issues. Please do not publicly disclose before we have had a chance to remediate.

We do not currently run a paid bug-bounty program, but we credit reporters in release notes (with permission).`,
  },
  {
    title: "Incident response",
    content: `If we confirm an incident affecting customer data, we will notify affected workspace owners by email without undue delay (within 72 hours where GDPR applies). Notifications include: what happened, what data was involved, what we have done to contain it, and what you can do.

Status updates for ongoing incidents will be posted to https://github.com/privexbot/privexbot/issues with the "incident" label.`,
  },
  {
    title: "Operational security",
    content: `- All staff access requires SSO + 2FA.
- Production access is least-privilege; database write access is restricted to a small set of operators and audited.
- Backups: encrypted, 35-day retention, periodic restore drills.
- Dependency updates: automated security alerts; critical CVEs patched within 7 days.`,
  },
  {
    title: "What we don't claim",
    content: `We are not currently SOC 2 / ISO 27001 / HIPAA-certified. We are an early-stage open-source project taking security seriously and being transparent about our posture. If your industry mandates a specific certification, talk to us before relying on the hosted Service in production.`,
  },
  {
    title: "Contact",
    content: `Security reports: privexbot@gmail.com (subject: "security")
General: https://discord.gg/53S3Ur9x
Code: https://github.com/privexbot/privexbot`,
  },
];

export function SecurityPage() {
  return (
    <LegalLayout
      title="Security & Trust"
      subtitle="How we protect your data, and the limits we're honest about."
      effectiveDate="2026-04-30"
      sections={sections}
    />
  );
}
