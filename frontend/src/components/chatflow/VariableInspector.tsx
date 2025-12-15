/**
 * VariableInspector - View and debug workflow variables
 *
 * WHY:
 * - Debug workflow execution
 * - Track variable values
 * - Understand data flow
 *
 * HOW:
 * - Display current variables
 * - JSON formatting
 * - Real-time updates
 */

import { useState } from 'react';
import { Eye, EyeOff, Copy, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface Variable {
  name: string;
  value: any;
  type: string;
  lastUpdated?: string;
}

interface VariableInspectorProps {
  variables?: Record<string, any>;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function VariableInspector({
  variables = {},
  onRefresh,
  isRefreshing = false,
}: VariableInspectorProps) {
  const [expandedVars, setExpandedVars] = useState<Set<string>>(new Set());
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  const toggleExpand = (varName: string) => {
    const newExpanded = new Set(expandedVars);
    if (newExpanded.has(varName)) {
      newExpanded.delete(varName);
    } else {
      newExpanded.add(varName);
    }
    setExpandedVars(newExpanded);
  };

  const copyValue = (varName: string, value: any) => {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    navigator.clipboard.writeText(stringValue);
    setCopiedVar(varName);
    setTimeout(() => setCopiedVar(null), 2000);
  };

  const getValueType = (value: any): string => {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    return typeof value;
  };

  const formatValue = (value: any, expanded: boolean): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    const type = getValueType(value);

    if (type === 'object' || type === 'array') {
      if (expanded) {
        return JSON.stringify(value, null, 2);
      }
      return type === 'array' ? `[${value.length} items]` : '{...}';
    }

    if (type === 'string') {
      return expanded ? value : value.length > 50 ? value.substring(0, 50) + '...' : value;
    }

    return String(value);
  };

  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      string: 'text-green-600 dark:text-green-400',
      number: 'text-blue-600 dark:text-blue-400',
      boolean: 'text-purple-600 dark:text-purple-400',
      object: 'text-orange-600 dark:text-orange-400',
      array: 'text-yellow-600 dark:text-yellow-400',
      null: 'text-gray-500',
      undefined: 'text-gray-500',
    };
    return colors[type] || 'text-gray-600';
  };

  const variableEntries = Object.entries(variables);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Variable Inspector</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {variableEntries.length} {variableEntries.length === 1 ? 'variable' : 'variables'}
          </p>
        </div>
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>

      {/* Variables List */}
      <div className="flex-1 overflow-y-auto p-4">
        {variableEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No variables yet</p>
            <p className="text-xs mt-1">
              Variables will appear here during workflow execution
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {variableEntries.map(([name, value]) => {
              const type = getValueType(value);
              const isExpanded = expandedVars.has(name);
              const canExpand = type === 'object' || type === 'array' || (type === 'string' && value.length > 50);

              return (
                <div key={name} className="border rounded-lg p-3 hover:shadow-sm transition">
                  {/* Variable Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Label className="font-mono text-sm">{name}</Label>
                        <span className={`text-xs ${getTypeColor(type)}`}>
                          {type}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {canExpand && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(name)}
                        >
                          {isExpanded ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyValue(name, value)}
                      >
                        {copiedVar === name ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Variable Value */}
                  <div
                    className={`text-sm bg-muted rounded p-2 font-mono break-all ${
                      isExpanded ? 'whitespace-pre-wrap' : 'truncate'
                    }`}
                  >
                    {formatValue(value, isExpanded)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t bg-muted/50">
        <p className="text-xs text-muted-foreground">
          💡 <strong>Tip:</strong> Variables are automatically updated during workflow execution.
          Click the eye icon to expand complex values.
        </p>
      </div>
    </div>
  );
}
