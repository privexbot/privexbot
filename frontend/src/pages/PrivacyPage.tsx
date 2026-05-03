import { LegalLayout, type LegalSection } from "@/components/landing/LegalLayout";

const sections: LegalSection[] = [
  {
    title: "Who we are",
    content: `PrivexBot ("we", "us") provides a privacy-first AI agent platform at https://privexbot.com. The platform is open source under Apache 2.0 (https://github.com/privexbot/privexbot). This Privacy Policy explains how we handle personal data when you use the hosted service.

If you self-host the platform, you are the data controller for your deployment and this policy does not apply.`,
  },
  {
    title: "What we collect",
    content: `Account data — email, name, organization name, hashed password (or wallet address for Web3 sign-in), and account metadata (timestamps, role).
Workspace content — chatbots, chatflows, knowledge-base documents and chunks, and prompts you upload or build.
Conversations — messages exchanged with your deployed bots, including session IDs, IP-derived geolocation (city/country) when lead capture is enabled, and timestamps.
Operational telemetry — request logs (path, status, duration), error traces, and aggregated usage counters used for plan limits and billing.
Cookies & local storage — see our Cookie Policy.

We do not run third-party advertising or analytics pixels.`,
  },
  {
    title: "How AI inference works (this is the core of our privacy posture)",
    content: `LLM calls are routed through Secret Network's Trusted Execution Environment (TEE). Inputs (your prompts, retrieved KB chunks, conversation history) are processed inside an attested enclave. Outputs return to our backend over TLS.

Outside the enclave: PostgreSQL stores your account/workspace records, Qdrant stores vector embeddings, Redis stores transient session and draft state, and Celery runs background jobs (document ingestion, scraping). All of these run on infrastructure we operate.

We do not use your data to train shared models. We do not sell or rent personal data.`,
  },
  {
    title: "Lawful bases (GDPR)",
    content: `Contract — to provide the service you signed up for (account, workspaces, deployments).
Legitimate interest — to keep the service secure, prevent abuse, and improve product reliability via aggregated logs.
Consent — for optional things you explicitly enable (e.g., lead capture geolocation, marketing emails).
Legal obligation — for tax records and lawful requests.

You can withdraw consent at any time without affecting prior processing.`,
  },
  {
    title: "Retention",
    content: `Account data — kept while your account is active. Deleted within 30 days of account closure, except records we must keep for accounting/tax (typically 7 years).
Conversations — retained for the duration the workspace owner configures. Default: 90 days. Workspace admins can shorten this, export their data, or delete it on demand.
Operational logs — retained for 30 days, then aggregated/anonymized.
Backups — encrypted database backups are kept for up to 35 days.`,
  },
  {
    title: "Your rights",
    content: `If you are in the EEA, UK, or a comparable jurisdiction, you have the right to: access your data, correct it, request deletion, restrict or object to certain processing, and receive a portable copy. We honor these requests for any user, regardless of jurisdiction.

To exercise any right, email privexbot@gmail.com from the address tied to your account. We respond within 30 days. If you believe we have mishandled your data, you may complain to your local supervisory authority.`,
  },
  {
    title: "Sub-processors and infrastructure",
    content: `We use a small set of providers to operate the service. The current list is published on our Data & Compliance page (/data-compliance) and is updated when it changes. Material changes are announced at least 14 days before they take effect, where practicable.

Inference: Secret Network (TEE provider).
Cloud: hosting, managed Postgres, managed Redis, object storage — current providers listed on /data-compliance.
Email delivery: transactional email provider.
Error monitoring: error-tracking service (no message content sent).`,
  },
  {
    title: "Security",
    content: `Transport: TLS 1.2+ on every external endpoint.
At rest: database-level encryption; OAuth/integration credentials encrypted with Fernet (AES-128 + HMAC) before storage.
Access: short-lived JWTs, role-based access control across organizations and workspaces, audit logs on sensitive operations.
Inference: confidential execution in Secret VM with cryptographic attestation.
Vulnerability handling: see /security for our responsible-disclosure policy.`,
  },
  {
    title: "Children",
    content: `The service is not directed to children under 16. We do not knowingly collect personal data from children. If you believe a child has signed up, contact us and we will delete the account.`,
  },
  {
    title: "International transfers",
    content: `Our infrastructure may operate in regions outside your country of residence. Where data leaves the EEA/UK, we rely on Standard Contractual Clauses or an equivalent transfer mechanism with our sub-processors.`,
  },
  {
    title: "Changes to this policy",
    content: `We may update this policy as the product evolves. Material changes will be announced via in-app notification or email at least 14 days before they take effect. The "Effective" date at the top of this page reflects the latest revision.`,
  },
  {
    title: "Contact",
    content: `Email: privexbot@gmail.com
GitHub: https://github.com/privexbot/privexbot
Discord: https://discord.gg/53S3Ur9x

Mail us at the email address above for any privacy request, including DSARs, deletions, or sub-processor questions.`,
  },
];

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="What we collect, why, and how we keep it confidential."
      effectiveDate="2026-04-30"
      sections={sections}
    />
  );
}
