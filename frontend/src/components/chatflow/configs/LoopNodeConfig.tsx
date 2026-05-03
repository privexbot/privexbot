/**
 * Loop Node Configuration Panel
 *
 * Configures array iteration with:
 * - Array source variable
 * - Max iterations limit
 * - Item and index variable names
 */

import { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface LoopNodeConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

export function LoopNodeConfig({ config, onChange }: LoopNodeConfigProps) {
  const [array, setArray] = useState((config.array as string) || "");
  const [maxIterations, setMaxIterations] = useState(
    (config.max_iterations as number) || 100
  );
  const [itemVariable, setItemVariable] = useState(
    (config.item_variable as string) || "item"
  );
  const [indexVariable, setIndexVariable] = useState(
    (config.index_variable as string) || "index"
  );

  // Debounce changes
  const emitChange = useCallback(() => {
    onChange({
      array,
      max_iterations: maxIterations,
      item_variable: itemVariable,
      index_variable: indexVariable,
    });
  }, [array, maxIterations, itemVariable, indexVariable, onChange]);

  useEffect(() => {
    const timeoutId = setTimeout(emitChange, 300);
    return () => clearTimeout(timeoutId);
  }, [emitChange]);

  return (
    <div className="space-y-4">
      {/* Array Source */}
      <div>
        <Label className="text-sm font-medium">
          Array Source <span className="text-red-500">*</span>
        </Label>
        <Input
          value={array}
          onChange={(e) => setArray(e.target.value)}
          placeholder="{{items}}"
          className="mt-1.5 font-mono text-sm"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Variable containing the array to iterate over
        </p>
      </div>

      {/* Max Iterations */}
      <div>
        <Label className="text-sm font-medium">Max Iterations</Label>
        <Input
          type="number"
          value={maxIterations}
          onChange={(e) =>
            setMaxIterations(Math.min(1000, Math.max(1, parseInt(e.target.value) || 1)))
          }
          min={1}
          max={1000}
          className="mt-1.5"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Safety limit to prevent infinite loops (max 1000)
        </p>
      </div>

      {/* Item Variable */}
      <div>
        <Label className="text-sm font-medium">Item Variable</Label>
        <Input
          value={itemVariable}
          onChange={(e) => setItemVariable(e.target.value)}
          placeholder="item"
          className="mt-1.5 font-mono text-sm"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Access current item with{" "}
          <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
            {`{{${itemVariable || "item"}}}`}
          </code>
        </p>
      </div>

      {/* Index Variable */}
      <div>
        <Label className="text-sm font-medium">Index Variable</Label>
        <Input
          value={indexVariable}
          onChange={(e) => setIndexVariable(e.target.value)}
          placeholder="index"
          className="mt-1.5 font-mono text-sm"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Access current index with{" "}
          <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
            {`{{${indexVariable || "index"}}}`}
          </code>
        </p>
      </div>
    </div>
  );
}
