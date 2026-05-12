/**
 * AvailableVariablesPanel — upstream-aware {{variable}} picker.
 *
 * WHY: Before this, each config panel showed a STATIC list of variable
 * buttons (`{{input}}`, `{{context}}`, `{{history}}`). That confused
 * users for two reasons: (a) `{{context}}` does NOT resolve at runtime
 * (it's a debug-only key in the executor); (b) the static list never
 * mentioned the actual upstream nodes a user had wired in (so a flow
 * with a KB node didn't surface `{{kb_1}}` anywhere).
 *
 * HOW: walk the chatflow edges BFS upstream from `currentNodeId`,
 * collect every node reachable to the current one, and render each as
 * `{{<node.id>}}` with a friendly description. Plus the always-
 * available built-ins.
 *
 * VARIABLE-NAME CORRECTION (verified at chatflow_service.py:344):
 *   context["variables"][current_node["id"]] = node_result["output"]
 * The KEY is the literal React Flow node id (e.g. `kb_1` not
 * `kb_kb_1`). The Variable node is the one exception — it stores under
 * its config.variable_name, not the node id.
 */

import { useMemo } from "react";
import type { Node, Edge } from "reactflow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface AvailableVariablesPanelProps {
  /** ID of the node whose config panel is currently open. */
  nodeId: string;
  /** All nodes in the current chatflow. */
  nodes: Node[];
  /** All edges in the current chatflow. */
  edges: Edge[];
  /** Called when a variable button is clicked. The string passed in
   *  already includes the `{{...}}` braces — wrap it into a textarea or
   *  similar field at the cursor. */
  onInsert: (variable: string) => void;
}

// Friendly per-type description shown next to the variable button. Mirrors
// the per-node output reference table in
// docs/tech-docs/chatflow/04-variables-and-templating.md so the docs and
// the UI stay in sync. Keep these strings short — they render inline next
// to the {{...}} badge.
const NODE_TYPE_DESCRIPTIONS: Record<string, string> = {
  kb: "Joined KB chunk text",
  llm: "LLM response text",
  memory: "Formatted chat history",
  http: "HTTP response body",
  code: "Code block return value",
  database: "Query results (rows)",
  loop: "Loop iteration output",
  condition: "Boolean (rarely referenced)",
  // `variable` outputs under config.variable_name, NOT node.id, so it's
  // handled specially in the render below.
  variable: "User-named value",
  // `trigger` and `response` aren't directly variable-referenceable
  // (trigger output IS the {{input}}; response is terminal).
};

interface BuiltIn {
  variable: string;
  description: string;
}

const BUILT_INS: BuiltIn[] = [
  { variable: "{{input}}", description: "The user's incoming message" },
  { variable: "{{_last_output}}", description: "The previous node's output" },
  { variable: "{{history}}", description: "Chat history (when Memory node ran upstream)" },
];

/** BFS walk: return the set of node ids upstream of `targetId`
 *  (i.e. all nodes whose output can reach the target via edges). */
function getUpstreamNodeIds(
  targetId: string,
  edges: Edge[],
): Set<string> {
  const upstream = new Set<string>();
  const queue: string[] = [targetId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.target === current && !upstream.has(edge.source)) {
        upstream.add(edge.source);
        queue.push(edge.source);
      }
    }
  }
  return upstream;
}

export function AvailableVariablesPanel({
  nodeId,
  nodes,
  edges,
  onInsert,
}: AvailableVariablesPanelProps) {
  const upstreamVariables = useMemo(() => {
    const upstreamIds = getUpstreamNodeIds(nodeId, edges);
    const items: { variable: string; description: string }[] = [];
    for (const node of nodes) {
      if (!upstreamIds.has(node.id)) continue;
      const type = (node.type ?? "") as string;

      if (type === "trigger") {
        // Trigger's output is the user message — surfaced as {{input}}
        // in built-ins; don't double-list it.
        continue;
      }
      if (type === "variable") {
        // Variable nodes store under their config.variable_name (not
        // their node.id). If the user named it, surface that name; if
        // not, fall through to the generic {{<node.id>}} reference.
        const varName = (node.data?.config as { variable_name?: string } | undefined)
          ?.variable_name;
        if (varName && varName.trim()) {
          items.push({
            variable: `{{${varName.trim()}}}`,
            description: `${NODE_TYPE_DESCRIPTIONS.variable} (from "${node.data?.label ?? node.id}")`,
          });
          continue;
        }
      }

      const description =
        NODE_TYPE_DESCRIPTIONS[type] ?? "Output of this node";
      const label = (node.data?.label as string | undefined) ?? node.id;
      items.push({
        variable: `{{${node.id}}}`,
        description: `${description}${label !== node.id ? ` — ${label}` : ""}`,
      });
    }
    return items;
  }, [nodeId, nodes, edges]);

  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 font-manrope">
        <Sparkles className="h-3.5 w-3.5" />
        Available variables
      </div>

      {/* Always-available built-ins */}
      <div>
        <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-manrope mb-1">
          Built-ins
        </p>
        <div className="flex flex-wrap gap-1">
          {BUILT_INS.map((b) => (
            <Button
              key={b.variable}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs font-mono"
              title={b.description}
              onClick={() => onInsert(b.variable)}
            >
              <Badge variant="secondary" className="mr-1 text-xs font-mono">
                {b.variable}
              </Badge>
              <span className="font-manrope font-normal">{b.description}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Upstream node outputs — only the nodes actually reachable to
          the current one. Distinct ID per node, so two KB nodes named
          kb_support and kb_pricing surface as separate buttons. */}
      <div>
        <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-manrope mb-1">
          From upstream nodes ({upstreamVariables.length})
        </p>
        {upstreamVariables.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
            Connect this node's input to other nodes to reference their
            outputs here.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {upstreamVariables.map((v) => (
              <Button
                key={v.variable}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                title={v.description}
                onClick={() => onInsert(v.variable)}
              >
                <Badge variant="secondary" className="mr-1 text-xs font-mono">
                  {v.variable}
                </Badge>
                <span className="font-manrope font-normal">{v.description}</span>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
