import { LegalLayout, type LegalSection } from "@/components/landing/LegalLayout";

const sections: LegalSection[] = [
  {
    title: "Scope",
    content: `This Acceptable Use Policy applies to the hosted PrivexBot service and to any content you create, upload, or generate through it — including knowledge bases, chatbot configurations, prompts, and the conversations your deployed agents process.`,
  },
  {
    title: "What you must not do",
    content: `Illegal content — anything unlawful in your jurisdiction or the jurisdiction your service operates in. This includes child sexual abuse material, content that incites or organizes violence, content that infringes intellectual property you do not own, and content that violates applicable export controls or sanctions.

Targeted harm — using AI agents to harass, threaten, dox, or stalk individuals; mass-produce defamatory content; or impersonate real people or organizations to defraud.

Misinformation at scale — building agents whose primary purpose is to deceive people about who they are talking to (e.g., posing as a human medical/legal/financial professional without proper authorization), or to manufacture political disinformation.

Security abuse — probing, scanning, or attempting to compromise the platform; bypassing rate limits or quotas; using credentials that aren't yours; reverse-engineering the TEE attestation flow to forge proofs.

Service abuse — using the Free tier to evade paid limits via multi-account; reselling our API to third parties without our written consent; running denial-of-service attacks against your own deployed agents to inflate metrics.

Malicious software — generating, distributing, or testing malware, phishing kits, ransomware, credential stealers, or surveillance tools.

Privacy violations — uploading personal data of individuals you do not have a lawful basis to process; using the platform to build agents that surveil employees or end-users without disclosure.`,
  },
  {
    title: "AI-specific guardrails",
    content: `LLMs hallucinate. You are responsible for what your deployed agents tell users. If your agent gives advice that materially affects health, legal, or financial decisions, you must (a) disclose to users that they are talking to AI, and (b) include a human-review path.

Do not deploy agents that systematically and willfully misrepresent their own nature when directly asked. (Persona play with users who understand the context is fine — wholesale deception is not.)`,
  },
  {
    title: "Self-hosted deployments",
    content: `If you self-host the platform under Apache 2.0, this policy does not bind your users on technical grounds — the source code is yours to run. We still ask that you adopt similar guardrails for your own deployment, both for safety and for the health of the ecosystem.`,
  },
  {
    title: "Reporting",
    content: `If you encounter a deployed agent that violates this policy, email privexbot@gmail.com with the URL or channel and a short description. We respond to abuse reports as priority workload.`,
  },
  {
    title: "Enforcement",
    content: `Depending on severity, we may: warn the workspace owner, throttle access, suspend the offending agent, suspend the account, or terminate it. We aim to act in proportion and to give the workspace owner a chance to remediate, except in cases of clear illegal content where we will act first.`,
  },
  {
    title: "Changes",
    content: `We may update this policy as the threat landscape and the product evolve. Material changes are announced at least 14 days in advance. Continued use after the effective date constitutes acceptance.`,
  },
  {
    title: "Contact",
    content: `Abuse reports & questions: privexbot@gmail.com`,
  },
];

export function AcceptableUsePage() {
  return (
    <LegalLayout
      title="Acceptable Use Policy"
      subtitle="What is and isn't OK to build and deploy on PrivexBot."
      effectiveDate="2026-04-30"
      sections={sections}
    />
  );
}
