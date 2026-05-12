/**
 * LLM Node Configuration Panel
 *
 * Configures AI text generation node with:
 * - Prompt template with variable insertion
 * - Model selection
 * - Temperature control
 * - Max tokens limit
 * - System prompt
 */

import { useState, useEffect, useCallback } from "react";
import type { Node, Edge } from "reactflow";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { AvailableVariablesPanel } from "@/components/chatflow/AvailableVariablesPanel";

interface LLMNodeConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  /** Optional graph context for the variables panel. When provided, the
   *  panel walks upstream from `nodeId` to surface the actual reachable
   *  variables (e.g. `{{kb_1}}`). Without it, only built-ins render. */
  nodeId?: string;
  nodes?: Node[];
  edges?: Edge[];
}

const AVAILABLE_MODELS = [
  { value: "secret-ai-v1", label: "Secret AI (Privacy-Preserving)" },
];

export function LLMNodeConfig({ config, onChange, nodeId, nodes, edges }: LLMNodeConfigProps) {
  const [prompt, setPrompt] = useState((config.prompt as string) || "");
  const [model, setModel] = useState((config.model as string) || "secret-ai-v1");
  const [temperature, setTemperature] = useState((config.temperature as number) || 0.7);
  const [maxTokens, setMaxTokens] = useState((config.max_tokens as number) || 2000);
  const [systemPrompt, setSystemPrompt] = useState((config.system_prompt as string) || "");

  // Debounce changes to avoid excessive updates
  const emitChange = useCallback(() => {
    onChange({
      prompt,
      model,
      temperature,
      max_tokens: maxTokens,
      system_prompt: systemPrompt,
    });
  }, [prompt, model, temperature, maxTokens, systemPrompt, onChange]);

  // Emit changes on field updates
  useEffect(() => {
    const timeoutId = setTimeout(emitChange, 300);
    return () => clearTimeout(timeoutId);
  }, [emitChange]);

  // Append the already-braced variable string at the end of the prompt.
  // The AvailableVariablesPanel passes the full `{{<id>}}` form so we
  // don't double-brace.
  const insertVariable = (variable: string) => {
    setPrompt((prev) => prev + variable);
  };

  return (
    <div className="space-y-4">
      {/* System Prompt */}
      <div>
        <Label className="text-sm font-medium">System Prompt</Label>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are a helpful assistant..."
          className="mt-1.5 h-20 text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Instructions that define the AI's behavior
        </p>
      </div>

      {/* Prompt Template */}
      <div>
        <Label className="text-sm font-medium">
          Prompt Template <span className="text-red-500">*</span>
        </Label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={"Based on: {{context}}\n\nUser: {{input}}\n\nAssistant:"}
          className="mt-1.5 h-32 font-mono text-sm"
        />
        {/* Upstream-aware variables panel — replaces the old static
            three-button row that included a misleading {{context}}
            entry (which never resolves at runtime). */}
        {nodeId && nodes && edges && (
          <div className="mt-2">
            <AvailableVariablesPanel
              nodeId={nodeId}
              nodes={nodes}
              edges={edges}
              onInsert={insertVariable}
            />
          </div>
        )}
      </div>

      {/* Model Selection */}
      <div>
        <Label className="text-sm font-medium">Model</Label>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AVAILABLE_MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Temperature */}
      <div>
        <div className="flex justify-between items-center">
          <Label className="text-sm font-medium">Temperature</Label>
          <span className="text-sm text-gray-500 font-mono">{temperature.toFixed(1)}</span>
        </div>
        <Slider
          value={[temperature]}
          onValueChange={(val) => setTemperature(val[0])}
          min={0}
          max={2}
          step={0.1}
          className="mt-2"
        />
        <p className="text-xs text-gray-500 mt-1">
          Lower = focused, Higher = creative
        </p>
      </div>

      {/* Max Tokens */}
      <div>
        <Label className="text-sm font-medium">Max Tokens</Label>
        <Input
          type="number"
          value={maxTokens}
          onChange={(e) => setMaxTokens(Number(e.target.value))}
          min={100}
          max={8000}
          className="mt-1.5"
        />
        <p className="text-xs text-gray-500 mt-1">
          Maximum length of the AI response
        </p>
      </div>
    </div>
  );
}
