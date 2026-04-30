import { LegalLayout, type LegalSection } from "@/components/landing/LegalLayout";

const sections: LegalSection[] = [
  {
    title: "Why this page exists",
    content: `We believe in being honest about what we drop on your device. This page lists every cookie and local-storage entry the hosted PrivexBot service uses, what each one does, and how long it lives.`,
  },
  {
    title: "What we use",
    content: `Local storage:
- access_token / refresh_token — JWTs that keep you signed in. Cleared on sign-out.
- workspace-storage — your last selected workspace, persisted across reloads. Cleared on sign-out.
- theme — your light/dark/system preference. Persists until you change it.

Session storage:
- Short-lived state for OAuth callbacks (CSRF token + return URL). Cleared as soon as the OAuth round-trip completes.

Cookies:
- We do not currently set any cookies on privexbot.com beyond what your browser may set for our hosting/CDN provider for HTTPS and basic security purposes (no tracking, no advertising).`,
  },
  {
    title: "What we do not use",
    content: `No third-party advertising trackers. No marketing pixels (no Meta Pixel, no LinkedIn Insight, etc.). No session-replay tools. No analytics that record individual user behavior across sites.

We may add a privacy-respecting analytics tool (e.g., Plausible / self-hosted) in the future. If we do, we will update this page and require consent in jurisdictions where consent is mandatory.`,
  },
  {
    title: "Your controls",
    content: `You can clear local storage and cookies through your browser at any time. Doing so will sign you out and reset your theme preference. The Service will still function — you will simply need to sign in again.

If you self-host the platform, you control everything. This page only describes the hosted Service.`,
  },
  {
    title: "Changes",
    content: `We will update this page whenever we add or remove a cookie / storage entry. The "Effective" date at the top reflects the latest revision.`,
  },
  {
    title: "Contact",
    content: `Questions about this policy: privexbot@gmail.com`,
  },
];

export function CookiePolicyPage() {
  return (
    <LegalLayout
      title="Cookie Policy"
      subtitle="Every cookie and local-storage entry we use, what it does, and how long it lives."
      effectiveDate="2026-04-30"
      sections={sections}
    />
  );
}
