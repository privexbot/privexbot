/**
 * First-run onboarding state (per-browser).
 *
 * Mirrors the app's existing localStorage usage (ThemeContext, AppContext
 * STORAGE_KEYS). No backend user-preferences field exists, so "seen" state
 * lives client-side. Bump the version suffix to re-surface the guide after a
 * major builder change.
 */

const STUDIO_GUIDE_KEY = "privexbot_studio_guide_v1";

/** True once the user has seen (or skipped) the Studio guide on this browser. */
export function hasSeenStudioGuide(): boolean {
  try {
    return localStorage.getItem(STUDIO_GUIDE_KEY) === "1";
  } catch {
    // Private mode / storage disabled — treat as "seen" so we don't nag.
    return true;
  }
}

/** Persist that the Studio guide has been shown. */
export function markStudioGuideSeen(): void {
  try {
    localStorage.setItem(STUDIO_GUIDE_KEY, "1");
  } catch {
    // No-op when storage is unavailable.
  }
}
