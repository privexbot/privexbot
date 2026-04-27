/**
 * Code Node Configuration Panel
 *
 * Configures Python code execution with:
 * - Code editor
 * - Timeout settings
 * - Available variables reference
 */

import { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface CodeNodeConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const SAFE_BUILTINS = [
  "len", "str", "int", "float", "bool", "list", "dict",
  "tuple", "set", "range", "enumerate", "zip", "sum",
  "min", "max", "abs", "round", "sorted", "reversed"
];

const ALLOWED_MODULES = ["json", "re", "math", "datetime"];

const EXAMPLE_CODE = `# Available variables:
# - input_data: Previous node's output (or user message if first node)
# - user_message: The original user message (always available)
# - variables: Dict of all node outputs (access by node ID)

# Your code here:
result = input_data.upper()

# Set 'result' to return a value`;

export function CodeNodeConfig({ config, onChange }: CodeNodeConfigProps) {
  const [code, setCode] = useState((config.code as string) || EXAMPLE_CODE);
  const [timeout, setTimeout_] = useState((config.timeout as number) || 5);

  // Debounce changes
  const emitChange = useCallback(() => {
    onChange({
      code,
      timeout,
    });
  }, [code, timeout, onChange]);

  useEffect(() => {
    const timeoutId = setTimeout(emitChange, 300);
    return () => clearTimeout(timeoutId);
  }, [emitChange]);

  return (
    <div className="space-y-4">
      {/* Code Editor */}
      <div>
        <Label className="text-sm font-medium">
          Python Code <span className="text-red-500">*</span>
        </Label>
        <Textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={EXAMPLE_CODE}
          className="mt-1.5 h-48 font-mono text-sm"
          style={{ tabSize: 4 }}
        />
      </div>

      {/* Timeout */}
      <div>
        <Label className="text-sm font-medium">Timeout (seconds)</Label>
        <Input
          type="number"
          value={timeout}
          onChange={(e) => setTimeout_(Number(e.target.value))}
          min={1}
          max={30}
          className="mt-1.5 w-24"
        />
        <p className="text-xs text-gray-500 mt-1">
          Maximum execution time (1-30 seconds)
        </p>
      </div>

      {/* Available Functions */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-xs font-medium text-gray-500 mb-2">Safe Builtins</p>
        <div className="flex flex-wrap gap-1">
          {SAFE_BUILTINS.map((fn) => (
            <Badge key={fn} variant="outline" className="text-xs font-mono">
              {fn}
            </Badge>
          ))}
        </div>
      </div>

      {/* Allowed Modules */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-xs font-medium text-gray-500 mb-2">Allowed Modules</p>
        <div className="flex flex-wrap gap-1">
          {ALLOWED_MODULES.map((mod) => (
            <Badge key={mod} variant="secondary" className="text-xs font-mono">
              {mod}
            </Badge>
          ))}
        </div>
      </div>

      {/* Security Note */}
      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <p className="text-xs text-amber-800 dark:text-amber-200">
          <strong>Security:</strong> Code runs in a sandboxed environment.
          No file access, network access, or dangerous operations allowed.
        </p>
      </div>
    </div>
  );
}
