/**
 * NodeConfigErrorBoundary
 *
 * Scoped error boundary for a chatflow node's config panel. A single node
 * config that throws during render (e.g. a saved config with an unexpected
 * shape) must NOT white-screen the whole builder — it should fail locally to
 * a readable fallback so the rest of the canvas stays usable.
 *
 * React error boundaries must be class components. Keyed by the selected node
 * id from the parent so switching nodes resets the boundary.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class NodeConfigErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface for debugging; the fallback below keeps the builder alive.
    console.error("[NodeConfig] render error:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-amber-800 dark:text-amber-300">
              <p className="font-medium">Couldn&apos;t render this node&apos;s settings.</p>
              <p className="mt-1 text-amber-700 dark:text-amber-400">
                Its saved configuration looks malformed. Try removing this node
                and adding a fresh one of the same type.
              </p>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default NodeConfigErrorBoundary;
