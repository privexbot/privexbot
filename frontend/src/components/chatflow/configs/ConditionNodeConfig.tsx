/**
 * Condition Node Configuration Panel
 *
 * Configures branching logic with:
 * - Operator selection (equals, contains, gt, lt, etc.)
 * - Variable to check
 * - Comparison value
 */

import { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface ConditionNodeConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const OPERATORS = [
  { value: "equals", label: "Equals", description: "Exact match", category: "String" },
  { value: "not_equals", label: "Not Equals", description: "Does not match", category: "String" },
  { value: "contains", label: "Contains", description: "Includes substring", category: "String" },
  { value: "not_contains", label: "Not Contains", description: "Excludes substring", category: "String" },
  { value: "starts_with", label: "Starts With", description: "Begins with text", category: "String" },
  { value: "ends_with", label: "Ends With", description: "Ends with text", category: "String" },
  { value: "gt", label: "> Greater Than", description: "Numeric comparison", category: "Numeric" },
  { value: "lt", label: "< Less Than", description: "Numeric comparison", category: "Numeric" },
  { value: "gte", label: ">= Greater/Equal", description: "Numeric comparison", category: "Numeric" },
  { value: "lte", label: "<= Less/Equal", description: "Numeric comparison", category: "Numeric" },
  { value: "is_empty", label: "Is Empty", description: "Null or empty", category: "Existence" },
  { value: "is_not_empty", label: "Is Not Empty", description: "Has value", category: "Existence" },
  { value: "regex", label: "Regex Match", description: "Pattern matching", category: "Pattern" },
];

const VARIABLE_SUGGESTIONS = [
  { name: "input", description: "User message" },
  { name: "context", description: "KB retrieval" },
];

export function ConditionNodeConfig({ config, onChange }: ConditionNodeConfigProps) {
  const [operator, setOperator] = useState((config.operator as string) || "contains");
  const [variable, setVariable] = useState((config.variable as string) || "{{input}}");
  const [value, setValue] = useState((config.value as string) || "");

  // Check if operator needs a value
  const needsValue = !["is_empty", "is_not_empty"].includes(operator);

  // Debounce changes
  const emitChange = useCallback(() => {
    onChange({
      operator,
      variable,
      value: needsValue ? value : "",
    });
  }, [operator, variable, value, needsValue, onChange]);

  useEffect(() => {
    const timeoutId = setTimeout(emitChange, 300);
    return () => clearTimeout(timeoutId);
  }, [emitChange]);

  // Get current operator info
  const currentOperator = OPERATORS.find((op) => op.value === operator);

  return (
    <div className="space-y-4">
      {/* Operator Selection */}
      <div>
        <Label className="text-sm font-medium">
          Operator <span className="text-red-500">*</span>
        </Label>
        <Select value={operator} onValueChange={setOperator}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATORS.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                <div className="flex items-center gap-2">
                  <span>{op.label}</span>
                  <Badge variant="outline" className="text-xs">
                    {op.category}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentOperator && (
          <p className="text-xs text-gray-500 mt-1">{currentOperator.description}</p>
        )}
      </div>

      {/* Variable to Check */}
      <div>
        <Label className="text-sm font-medium">
          Variable <span className="text-red-500">*</span>
        </Label>
        <Input
          value={variable}
          onChange={(e) => setVariable(e.target.value)}
          placeholder="{{input}}"
          className="mt-1.5 font-mono text-sm"
        />
        <div className="flex gap-1 mt-2 flex-wrap">
          {VARIABLE_SUGGESTIONS.map((v) => (
            <button
              key={v.name}
              type="button"
              onClick={() => setVariable(`{{${v.name}}}`)}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              {`{{${v.name}}}`}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison Value */}
      {needsValue && (
        <div>
          <Label className="text-sm font-medium">
            Compare Value <span className="text-red-500">*</span>
          </Label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={operator === "regex" ? "^[a-z]+$" : "Enter value..."}
            className="mt-1.5"
          />
          {operator === "regex" && (
            <p className="text-xs text-gray-500 mt-1">
              Enter a regular expression pattern
            </p>
          )}
        </div>
      )}

      {/* Preview */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-xs font-medium text-gray-500 mb-1">Condition Preview</p>
        <p className="text-sm font-mono">
          <span className="text-purple-600">{variable}</span>
          <span className="text-gray-500"> {currentOperator?.label || operator} </span>
          {needsValue && <span className="text-green-600">"{value}"</span>}
        </p>
      </div>
    </div>
  );
}
