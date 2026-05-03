import { LegalLayout, type LegalSection } from "@/components/landing/LegalLayout";

const sections: LegalSection[] = [
  {
    title: "Agreement",
    content: `These Terms of Use ("Terms") govern your access to and use of the hosted PrivexBot service at https://privexbot.com (the "Service"). By creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the Service.

The PrivexBot codebase is open source under Apache 2.0; the source code license is separate from these Terms. These Terms apply to the hosted Service only.`,
  },
  {
    title: "Accounts",
    content: `You must provide accurate registration information and keep your credentials secure. You are responsible for activity on your account, including any agents you deploy and any content your deployed agents generate or process. Notify us promptly at privexbot@gmail.com if you suspect unauthorized access.`,
  },
  {
    title: "Plans, fees, and billing",
    content: `The Free tier is free forever within published quotas (see /pricing). Paid plans are billed in advance per the cycle you choose (monthly or annual). Quotas are enforced per organization.

Today, plan upgrades happen via support contact (privexbot@gmail.com); self-serve checkout will be added later. Annual plans receive a published discount; refunds for annual plans are pro-rated and granted at our discretion within 30 days of purchase. Monthly plans can be cancelled at any time, effective at the end of the current cycle.

We may change prices for future billing cycles with at least 30 days' notice; existing committed cycles are honored.`,
  },
  {
    title: "Acceptable use",
    content: `Your use of the Service must comply with our Acceptable Use Policy (/acceptable-use). Briefly: no unlawful content, no abuse of AI to generate illegal material, no attempts to compromise the platform, no deceptive deployment to end users.`,
  },
  {
    title: "Your content",
    content: `You retain all rights to the content you upload (knowledge-base documents, chatbot configurations, prompts) and to the conversations your deployed agents process. You grant us a limited, non-exclusive license to host, process, and display this content solely to operate the Service for you.

We do not use your content to train shared models. We do not sell or rent your content. See the Privacy Policy for full data-handling details.`,
  },
  {
    title: "Third-party integrations",
    content: `The Service connects to third-party platforms you authorize (Google, Notion, Calendly, Discord, Slack, Telegram, WhatsApp, Zapier, and others). Your use of those platforms is governed by their own terms. We are not responsible for outages or policy changes on third-party platforms.`,
  },
  {
    title: "Service availability",
    content: `We aim for high availability but do not guarantee uninterrupted service on Free or Starter plans. Pro and Enterprise tiers may be offered service-level commitments via separate written agreement. Scheduled maintenance is announced when feasible.`,
  },
  {
    title: "Confidential compute disclaimer",
    content: `LLM inference runs inside Secret Network's Trusted Execution Environment ("TEE"). TEE technology mitigates — but does not eliminate — every conceivable side-channel risk. We do not warrant that TEE attestation guarantees absolute confidentiality against all adversaries; we operate the Service in line with current industry best practice for TEEs.`,
  },
  {
    title: "Open source",
    content: `The PrivexBot platform is published under Apache License 2.0 at https://github.com/privexbot/privexbot. You may self-host, fork, and modify the source code under that license. The Apache 2.0 license does not apply to the hosted Service brand, content, or operational infrastructure provided through privexbot.com.`,
  },
  {
    title: "Termination",
    content: `You may close your account at any time from your profile settings. We may suspend or terminate accounts that violate these Terms or the Acceptable Use Policy, with notice where reasonable. On termination, you have 30 days to export your data; after that, we may delete it as described in the Privacy Policy.`,
  },
  {
    title: "Disclaimers",
    content: `The Service is provided "as is" without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement, except where law prohibits such disclaimers. AI outputs can be inaccurate; you are responsible for reviewing outputs before relying on them in production.`,
  },
  {
    title: "Limitation of liability",
    content: `To the maximum extent permitted by law, our aggregate liability arising out of or related to the Service is limited to the greater of (a) the amount you paid us in the 12 months preceding the claim, or (b) USD 100. We are not liable for indirect, incidental, special, or consequential damages.`,
  },
  {
    title: "Changes",
    content: `We may revise these Terms. Material changes will be announced at least 14 days before they take effect, by in-app notification or email. Your continued use after the effective date constitutes acceptance.`,
  },
  {
    title: "Contact",
    content: `Questions: privexbot@gmail.com · https://discord.gg/53S3Ur9x · https://github.com/privexbot/privexbot`,
  },
];

export function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Use"
      subtitle="The contract between you and us when you use the hosted Service."
      effectiveDate="2026-04-30"
      sections={sections}
    />
  );
}
