/**
 * Variable Node Configuration Panel
 *
 * Configures variable manipulation with:
 * - Operation type (set, append, json_parse, extract)
 * - Variable name
 * - Value template
 * - Transform options
 */

import { useState, useEffect, useCallback } from "react";
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

interface VariableNodeConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const OPERATIONS = [
  { value: "set", label: "Set", description: "Assign a value to the variable" },
  { value: "append", label: "Append", description: "Add to existing value" },
  { value: "json_parse", label: "JSON Parse", description: "Parse JSON string to object" },
  { value: "extract", label: "Extract", description: "Extract field from object" },
];

const TRANSFORMS = [
  { value: "none", label: "None" },
  { value: "uppercase", label: "Uppercase" },
  { value: "lowercase", label: "Lowercase" },
  { value: "trim", label: "Trim Whitespace" },
  { value: "length", label: "Get Length" },
];

export function VariableNodeConfig({ config, onChange }: VariableNodeConfigProps) {
  const [operation, setOperation] = useState((config.operation as string) || "set");
  const [variableName, setVariableName] = useState((config.variable_name as string) || "");
  const [value, setValue] = useState((config.value as string) || "");
  const [transform, setTransform] = useState((config.transform as string) || "none");
  const [field, setField] = useState((config.field as string) || "");

  // Debounce changes
  const emitChange = useCallback(() => {
    const newConfig: Record<string, unknown> = {
      operation,
      variable_name: variableName,
      value,
    };

    if (transform && transform !== "none") newConfig.transform = transform;
    if (operation === "extract" && field) newConfig.field = field;

    onChange(newConfig);
  }, [operation, variableName, value, transform, field, onChange]);

  useEffect(() => {
    const timeoutId = setTimeout(emitChange, 300);
    return () => clearTimeout(timeoutId);
  }, [emitChange]);

  const currentOperation = OPERATIONS.find((op) => op.value === operation);

  return (
    <div className="space-y-4">
      {/* Operation */}
      <div>
        <Label className="text-sm font-medium">
          Operation <span className="text-red-500">*</span>
        </Label>
        <Select value={operation} onValueChange={setOperation}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATIONS.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentOperation && (
          <p className="text-xs text-gray-500 mt-1">{currentOperation.description}</p>
        )}
      </div>

      {/* Variable Name */}
      <div>
        <Label className="text-sm font-medium">
          Variable Name <span className="text-red-500">*</span>
        </Label>
        <Input
          value={variableName}
          onChange={(e) => setVariableName(e.target.value)}
          placeholder="my_variable"
          className="mt-1.5 font-mono text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Access later with {"{{my_variable}}"}
        </p>
      </div>

      {/* Value */}
      <div>
        <Label className="text-sm font-medium">Value</Label>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="{{input}}"
          className="mt-1.5 h-20 font-mono text-sm"
        />
      </div>

      {/* Extract Field (only for extract operation) */}
      {operation === "extract" && (
        <div>
          <Label className="text-sm font-medium">Field to Extract</Label>
          <Input
            value={field}
            onChange={(e) => setField(e.target.value)}
            placeholder="data.name"
            className="mt-1.5 font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Use dot notation for nested fields
          </p>
        </div>
      )}

      {/* Transform */}
      <div>
        <Label className="text-sm font-medium">Transform</Label>
        <Select value={transform} onValueChange={setTransform}>
          <SelectTrigger className="mt-1.5">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            {TRANSFORMS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
