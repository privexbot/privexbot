/**
 * ModelSelector — Secret AI model dropdown, populated dynamically from
 * `/inference/models`.
 *
 * Single source of truth for every place a user picks an LLM model:
 *   - Chatflow LLM node config (`LLMNodeConfig.tsx`)
 *   - Chatbot create wizard Step 2 (`pages/chatbots/create.tsx`)
 *   - Chatbot edit page (`pages/chatbots/edit.tsx`)
 *
 * Replaces the previous hardcoded one-option dropdown that didn't actually
 * drive what the backend called at inference time. Now what the user picks
 * is what the inference service routes to (per-model client cache in
 * `secret_ai_sdk_provider.py`).
 *
 * Behavior:
 * - Loading: dropdown disabled, "Loading models…" placeholder.
 * - Live list available: shows each model id, preselects `value` when present.
 * - Saved value not in live list: the trigger renders the placeholder
 *   ("Select a model") and the dropdown lists only live entries. Out-of-
 *   list values are not surfaced; the boot-time migration script
 *   (`backend/scripts/migrate_legacy_model_field.py`) rewrites them, and
 *   the runtime coercion in `secret_ai_sdk_provider._get_client_for_model`
 *   keeps any unmigrated request from breaking the chat.
 * - SDK unreachable AND no Redis cache: empty list → disabled with
 *   "Models unavailable" placeholder.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inferenceApi, type ModelsResponse } from "@/api/inference";

export interface ModelSelectorProps {
  /** Currently selected model id, or undefined when nothing has been picked. */
  value: string | undefined;
  /** Called with the picked model id. */
  onChange: (model: string) => void;
  /** Optional label shown above the dropdown. Defaults to "Model". */
  label?: string;
  /** Forces the dropdown disabled regardless of fetch state. */
  disabled?: boolean;
  /** Visual size of the dropdown (passes through to <SelectTrigger>). */
  className?: string;
}

export function ModelSelector({
  value,
  onChange,
  label = "Model",
  disabled = false,
  className,
}: ModelSelectorProps) {
  const { data, isLoading, isError } = useQuery<ModelsResponse>({
    queryKey: ["inference-models"],
    queryFn: inferenceApi.listModels,
    // Models on Secret Network rotate rarely; 1h stale time covers normal
    // dashboard sessions without hammering the endpoint as the user clicks
    // between multiple chatflow nodes and chatbot configs.
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    // Don't refetch on every focus event — the dropdown opens often.
    refetchOnWindowFocus: false,
  });

  const liveModels = useMemo(() => data?.models ?? [], [data]);

  // The dropdown lists only what the Secret AI smart contract currently
  // advertises. Out-of-list values (e.g. a chatbot config carrying a
  // string the contract no longer hosts) are NOT prepended here — the
  // boot-time migration rewrites them, and the runtime coercion in
  // `secret_ai_sdk_provider._get_client_for_model` keeps any unmigrated
  // request from breaking. The trigger falls back to the placeholder
  // when `value` isn't in the list.
  const noModelsAvailable = !isLoading && liveModels.length === 0;
  const triggerDisabled = disabled || isLoading || noModelsAvailable;

  const placeholder = isLoading
    ? "Loading models…"
    : noModelsAvailable
      ? isError
        ? "Models unavailable — retry shortly"
        : "No models available"
      : "Select a model";

  return (
    <div>
      <Label className="text-sm font-medium">{label}</Label>
      <Select
        value={value}
        onValueChange={onChange}
        disabled={triggerDisabled}
      >
        <SelectTrigger className={className ?? "mt-1.5"}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {liveModels.map((id) => (
            <SelectItem key={id} value={id}>
              <span className="font-mono text-xs">{id}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
