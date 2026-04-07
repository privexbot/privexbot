/**
 * Response Node Configuration Panel
 *
 * Configures the final output sent back to the user:
 * - Message template (with variable interpolation)
 * - Output format (text, json, markdown)
 * - Include sources toggle
 */

import { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ResponseNodeConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const FORMATS = [
  { value: "text", label: "Plain Text", description: "Standard text response" },
  { value: "markdown", label: "Markdown", description: "Formatted with markdown" },
  { value: "json", label: "JSON", description: "Structured JSON output" },
];

const VARIABLE_BUTTONS = [
  { label: "{{_last_output}}", description: "Previous node output" },
  { label: "{{input}}", description: "User message" },
];

export function ResponseNodeConfig({ config, onChange }: ResponseNodeConfigProps) {
  const [message, setMessage] = useState((config.message as string) || "");
  const [format, setFormat] = useState((config.format as string) || "text");
  const [includeSources, setIncludeSources] = useState(
    (config.include_sources as boolean) || false
  );

  // Debounce changes
  const emitChange = useCallback(() => {
    const newConfig: Record<string, unknown> = {
      format,
      include_sources: includeSources,
    };

    // Only include message if user explicitly set one
    if (message.trim()) {
      newConfig.message = message;
    }

    onChange(newConfig);
  }, [message, format, includeSources, onChange]);

  useEffect(() => {
    const timeoutId = setTimeout(emitChange, 300);
    return () => clearTimeout(timeoutId);
  }, [emitChange]);

  return (
    <div className="space-y-4">
      {/* Message Template */}
      <div>
        <Label className="text-sm font-medium">Message Template</Label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="{{_last_output}}"
          className="mt-1.5 h-24 font-mono text-sm"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Leave empty to use the previous node's output. Use {"{{variable}}"} syntax to reference variables.
        </p>

        {/* Variable helper buttons */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {VARIABLE_BUTTONS.map((v) => (
            <button
              key={v.label}
              type="button"
              onClick={() => setMessage((prev) => prev + v.label)}
              className="px-2 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title={v.description}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Format */}
      <div>
        <Label className="text-sm font-medium">Format</Label>
        <Select value={format} onValueChange={setFormat}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMATS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {FORMATS.find((f) => f.value === format) && (
          <p className="text-xs text-gray-500 mt-1">
            {FORMATS.find((f) => f.value === format)?.description}
          </p>
        )}
      </div>

      {/* Include Sources */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Include Sources</Label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Attach KB sources used in the response
          </p>
        </div>
        <Switch checked={includeSources} onCheckedChange={setIncludeSources} />
      </div>
    </div>
  );
}
