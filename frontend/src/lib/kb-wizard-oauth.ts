/**
 * Helpers that let the KB-creation wizard survive an OAuth round-trip.
 *
 * The Notion / Google connect buttons trigger a full-window redirect
 * (`window.location.href = ...`), which unmounts React and wipes every
 * in-memory store. Without persistence the wizard remounts at step 1 with
 * blank fields. These helpers persist the *local* React state (current
 * step, completedSteps, activeSourceType) to localStorage so create.tsx can
 * restore it after the callback. The Zustand-backed draft is saved
 * separately via `useKBStore().saveDraftToLocalStorage()` — those two calls
 * together cover the full wizard state.
 *
 * localStorage (not sessionStorage) on purpose: sessionStorage is wiped by
 * Firefox in some COOP scenarios and by Chromium during cross-origin redirect
 * chains in private windows. localStorage survives unconditionally; the
 * 10-minute TTL prevents stale restoration.
 */

const PENDING_KEY = "kb_wizard_pending_oauth";
const TTL_MS = 10 * 60 * 1000;

export type KBWizardOAuthProvider = "notion" | "google";

export interface KBWizardOAuthSnapshot {
  provider: KBWizardOAuthProvider;
  step: number;
  completedSteps: number[];
  activeSourceType: string | null;
  ts: number;
}

export function savePendingOAuth(
  snapshot: Omit<KBWizardOAuthSnapshot, "ts">,
): void {
  try {
    localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ ...snapshot, ts: Date.now() }),
    );
  } catch {
    // localStorage may throw (private mode, quota); silently degrade —
    // the wizard still loads, the user just has to re-fill step 1.
  }
}

export function consumePendingOAuth(): KBWizardOAuthSnapshot | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    localStorage.removeItem(PENDING_KEY);
    const parsed = JSON.parse(raw) as KBWizardOAuthSnapshot;
    if (Date.now() - parsed.ts > TTL_MS) return null;
    return parsed;
  } catch {
    localStorage.removeItem(PENDING_KEY);
    return null;
  }
}
