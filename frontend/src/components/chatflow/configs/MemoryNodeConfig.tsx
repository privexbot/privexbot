/**
 * Memory Node Configuration Panel
 *
 * Configures chat history/memory node with:
 * - Maximum messages to retrieve
 * - Output format (text, json, structured)
 * - System message inclusion
 */

import { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MemoryNodeConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const OUTPUT_FORMATS = [
  {
    value: "text",
    label: "Plain Text",
    description: "Human-readable conversation format",
  },
  {
    value: "json",
    label: "JSON Array",
    description: "Structured array of message objects",
  },
  {
    value: "structured",
    label: "Structured",
    description: "Formatted with role prefixes",
  },
];

export function MemoryNodeConfig({ config, onChange }: MemoryNodeConfigProps) {
  const [maxMessages, setMaxMessages] = useState(
    (config.max_messages as number) || 10
  );
  const [format, setFormat] = useState((config.format as string) || "text");
  const [includeSystem, setIncludeSystem] = useState(
    (config.include_system as boolean) ?? true
  );

  // Debounce changes
  const emitChange = useCallback(() => {
    onChange({
      max_messages: maxMessages,
      format,
      include_system: includeSystem,
    });
  }, [maxMessages, format, includeSystem, onChange]);

  useEffect(() => {
    const timeoutId = setTimeout(emitChange, 300);
    return () => clearTimeout(timeoutId);
  }, [emitChange]);

  const currentFormat = OUTPUT_FORMATS.find((f) => f.value === format);

  return (
    <div className="space-y-4">
      {/* Max Messages */}
      <div>
        <div className="flex justify-between items-center">
          <Label className="text-sm font-medium">Max Messages</Label>
          <span className="text-sm text-gray-500 font-mono">{maxMessages}</span>
        </div>
        <Slider
          value={[maxMessages]}
          onValueChange={(val) => setMaxMessages(val[0])}
          min={1}
          max={50}
          step={1}
          className="mt-2"
        />
        <p className="text-xs text-gray-500 mt-1">
          Number of recent messages to retrieve from history
        </p>
      </div>

      {/* Output Format */}
      <div>
        <Label className="text-sm font-medium">Output Format</Label>
        <Select value={format} onValueChange={setFormat}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OUTPUT_FORMATS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentFormat && (
          <p className="text-xs text-gray-500 mt-1">{currentFormat.description}</p>
        )}
      </div>

      {/* Include System Messages */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Include System Messages</Label>
          <p className="text-xs text-gray-500">
            Include system prompts in retrieved history
          </p>
        </div>
        <Switch checked={includeSystem} onCheckedChange={setIncludeSystem} />
      </div>

      {/* Preview */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-xs font-medium text-gray-500 mb-2">Output Preview</p>
        <div className="text-xs font-mono text-gray-600 dark:text-gray-400">
          {format === "text" && (
            <pre className="whitespace-pre-wrap">
              {`User: Hello\nAssistant: Hi! How can I help?\nUser: {{input}}`}
            </pre>
          )}
          {format === "json" && (
            <pre className="whitespace-pre-wrap">
              {`[
  {"role": "user", "content": "Hello"},
  {"role": "assistant", "content": "Hi!"},
  {"role": "user", "content": "{{input}}"}
]`}
            </pre>
          )}
          {format === "structured" && (
            <pre className="whitespace-pre-wrap">
              {`[USER]: Hello
[ASSISTANT]: Hi! How can I help?
[USER]: {{input}}`}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
