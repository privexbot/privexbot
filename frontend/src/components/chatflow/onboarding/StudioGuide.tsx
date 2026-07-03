/**
 * StudioGuide — an anchored coachmark tour of the node palette.
 *
 * When opened, a small speech-bubble points at the first palette node, explains
 * it minimally (purpose, optional tip, key config, credential need), and Next
 * walks the bubble down every node in the palette — covering all node types
 * even on an empty canvas. Re-openable from the header "Guide" button.
 *
 * Anchoring is plain-DOM: each palette button carries `data-tour-node="<type>"`.
 * Closing (Skip / ✕ / Escape / Done) funnels through `onOpenChange`, where the
 * caller persists the "seen" flag (see ChatflowBuilder).
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, KeyRound, X } from "lucide-react";
import { NODE_CATEGORIES, type NodeMeta } from "@/components/chatflow/nodeCatalog";

interface StudioGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS: NodeMeta[] = NODE_CATEGORIES.flatMap((c) => c.nodes);

// Bubble size used for viewport clamping (keep in sync with the rendered width).
const BUBBLE_W = 280;
const BUBBLE_H = 200;
const GAP = 12;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Placement {
  /** Bubble top-left in viewport coords. */
  top: number;
  left: number;
  /** The target's rect, for the highlight ring (null = centered fallback). */
  target: Rect | null;
  /** Caret side relative to the bubble. */
  caret: "left" | "top" | "none";
}

function computePlacement(target: Rect | null): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!target) {
    return {
      top: Math.max(8, vh / 2 - BUBBLE_H / 2),
      left: Math.max(8, vw / 2 - BUBBLE_W / 2),
      target: null,
      caret: "none",
    };
  }

  // Preferred: to the right of the palette item.
  let caret: Placement["caret"] = "left";
  let left = target.left + target.width + GAP;
  let top = target.top + target.height / 2 - BUBBLE_H / 2;

  // Flip below if it would overflow the right edge.
  if (left + BUBBLE_W + 8 > vw) {
    caret = "top";
    left = target.left;
    top = target.top + target.height + GAP;
  }

  // Clamp both axes into the viewport.
  left = Math.max(8, Math.min(vw - BUBBLE_W - 8, left));
  top = Math.max(8, Math.min(vh - BUBBLE_H - 8, top));

  // If it still can't reasonably fit (very narrow viewport), center it.
  if (vw < BUBBLE_W + 24) {
    return computePlacement(null);
  }

  return { top, left, target, caret };
}

export default function StudioGuide({ open, onOpenChange }: StudioGuideProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();

  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  // Measure the current step's target and compute the bubble placement.
  const measure = useCallback(() => {
    const el = document.querySelector<HTMLElement>(
      `[data-tour-node="${step.type}"]`
    );
    if (!el) {
      setPlacement(computePlacement(null));
      return false;
    }
    const r = el.getBoundingClientRect();
    setPlacement(
      computePlacement({ top: r.top, left: r.left, width: r.width, height: r.height })
    );
    return true;
  }, [step.type]);

  // On open / step change: scroll the target into view (via the Radix viewport
  // directly — scrollIntoView is unreliable inside Radix ScrollArea), then
  // measure across a few frames to catch any late layout (sidebar mount, fonts).
  useLayoutEffect(() => {
    if (!open) return;

    const el = document.querySelector<HTMLElement>(
      `[data-tour-node="${step.type}"]`
    );
    const viewport = el?.closest<HTMLElement>(
      "[data-radix-scroll-area-viewport]"
    );
    if (el && viewport) {
      const top = el.offsetTop - 16;
      viewport.scrollTop = Math.max(0, top);
    }

    let frames = 0;
    let found = false;
    const tick = () => {
      found = measure() || found;
      frames += 1;
      // Keep re-measuring briefly: covers the first-frame layout + a retry when
      // the palette button isn't in the DOM yet.
      if (frames < 6 || !found) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    // Move focus into the bubble for keyboard users.
    const focusTimer = window.setTimeout(() => bubbleRef.current?.focus(), 60);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.clearTimeout(focusTimer);
    };
  }, [open, step.type, measure]);

  // Re-anchor on resize and on palette scroll (scoped to the palette viewport,
  // NOT a document listener — that would fire on every React-Flow canvas pan).
  useEffect(() => {
    if (!open) return;

    let scheduled = false;
    const onChange = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        measure();
      });
    };

    window.addEventListener("resize", onChange);
    const el = document.querySelector<HTMLElement>(`[data-tour-node="${step.type}"]`);
    const viewport = el?.closest<HTMLElement>("[data-radix-scroll-area-viewport]");
    viewport?.addEventListener("scroll", onChange, { passive: true });

    return () => {
      window.removeEventListener("resize", onChange);
      viewport?.removeEventListener("scroll", onChange);
    };
  }, [open, step.type, measure]);

  // Reset to the first step whenever the tour (re)opens.
  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  // Keyboard: Escape closes, ←/→ navigate.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
      else if (e.key === "ArrowLeft") setStepIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open || !placement) return null;

  const Icon = step.icon;
  const t = placement.target;

  return createPortal(
    <>
      {/* Scrim (z-100) — captures clicks so the highlighted palette button
          can't be clicked accidentally (which would add a node). */}
      <div className="fixed inset-0 z-[100] bg-black/20" aria-hidden="true" />

      {/* Highlight ring (z-101) — purely visual. */}
      {t && (
        <div
          className="fixed z-[101] rounded-lg ring-2 ring-blue-500 pointer-events-none transition-all"
          style={{
            top: t.top - 4,
            left: t.left - 4,
            width: t.width + 8,
            height: t.height + 8,
          }}
          aria-hidden="true"
        />
      )}

      {/* Bubble (z-102). */}
      <motion.div
        ref={bubbleRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Node guide: ${step.label}, step ${stepIndex + 1} of ${STEPS.length}`}
        tabIndex={-1}
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.18 }}
        className="fixed z-[102] w-[280px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl p-4 font-manrope outline-none"
        style={{ top: placement.top, left: placement.left }}
      >
        {/* Caret */}
        {placement.caret === "left" && (
          <span className="absolute -left-1.5 top-6 h-3 w-3 rotate-45 border-l border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" />
        )}
        {placement.caret === "top" && (
          <span className="absolute -top-1.5 left-6 h-3 w-3 rotate-45 border-l border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" />
        )}

        {/* Close */}
        <button
          type="button"
          onClick={close}
          aria-label="Skip tour"
          className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 pr-5">
          <div
            className={cn(
              "h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br flex items-center justify-center text-white",
              step.color
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
              {step.label}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              {stepIndex + 1} / {STEPS.length}
            </p>
          </div>
        </div>

        {/* Body (minimal) */}
        <div className="mt-2.5 space-y-1.5 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          <p>{step.tip || step.description}</p>
          <p className="text-gray-500 dark:text-gray-400">
            {step.requiredFields ? <>Config: {step.requiredFields}</> : "No setup needed"}
          </p>
          {step.needsCredential && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <KeyRound className="h-2.5 w-2.5" />
              {step.needsCredential === "required" ? "Needs a credential" : "Credential (if used)"}
            </Badge>
          )}
        </div>

        {/* Controls */}
        <div className="mt-3 flex items-center justify-between">
          {isFirst ? (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={close}>
              Skip tour
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back
            </Button>
          )}
          {isLast ? (
            <Button size="sm" className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700" onClick={close}>
              Done
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700"
              onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
            >
              Next
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
        </div>
      </motion.div>
    </>,
    document.body
  );
}
