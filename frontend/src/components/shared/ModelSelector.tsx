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
 * - Saved value not in live list (legacy / between-deploy-and-migrate edge):
 *   shows it anyway at the top of the list with a small "legacy" badge so
 *   editing existing chatbots never silently drops the selection.
 * - SDK unreachable AND no Redis cache: empty list → disabled with
 *   "Models unavailable" placeholder. Caller's form should likely allow
 *   submitting with whatever was previously saved.
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

interface ModelOption {
  id: string;
  legacy: boolean;
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

  const liveModels = data?.models ?? [];

  const options = useMemo<ModelOption[]>(() => {
    // Defensive: surface the saved value even when the live list doesn't
    // contain it. The migration script handles the long tail, but a
    // chatbot saved between deploy and migration would otherwise show
    // no preselection.
    if (value && !liveModels.includes(value)) {
      return [
        { id: value, legacy: true },
        ...liveModels.map((id) => ({ id, legacy: false })),
      ];
    }
    return liveModels.map((id) => ({ id, legacy: false }));
  }, [liveModels, value]);

  const noModelsAvailable = !isLoading && options.length === 0;
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
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs">{opt.id}</span>
                {opt.legacy && (
                  <span className="text-[10px] uppercase tracking-wide rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-1 py-0.5">
                    legacy
                  </span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
