/**
 * Database Node Configuration Panel
 *
 * Configures SQL database query node with:
 * - Credential selection (database connection)
 * - SQL query template
 * - Parameter bindings
 * - Operation type
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import apiClient from "@/lib/api-client";

interface DatabaseNodeConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const OPERATIONS = [
  { value: "query", label: "Query", description: "SELECT - Read data" },
  { value: "insert", label: "Insert", description: "INSERT - Create records" },
  { value: "update", label: "Update", description: "UPDATE - Modify records" },
  { value: "delete", label: "Delete", description: "DELETE - Remove records" },
];

const EXAMPLE_QUERIES: Record<string, string> = {
  query: "SELECT * FROM users WHERE id = :user_id",
  insert: "INSERT INTO logs (message, created_at) VALUES (:message, NOW())",
  update: "UPDATE users SET status = :status WHERE id = :user_id",
  delete: "DELETE FROM sessions WHERE user_id = :user_id",
};

interface Parameter {
  name: string;
  value: string;
}

export function DatabaseNodeConfig({ config, onChange }: DatabaseNodeConfigProps) {
  const { currentWorkspace } = useApp();

  const [credentialId, setCredentialId] = useState(
    (config.credential_id as string) || ""
  );
  const [operation, setOperation] = useState(
    (config.operation as string) || "query"
  );
  const [query, setQuery] = useState((config.query as string) || "");
  const [parameters, setParameters] = useState<Parameter[]>(
    (config.parameters as Parameter[]) || []
  );

  // Fetch available database credentials
  const { data: credentials, isLoading } = useQuery({
    queryKey: ["credentials", currentWorkspace?.id, "database"],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const response = await apiClient.get(
        `/workspaces/${currentWorkspace.id}/credentials`,
        { params: { type: "database" } }
      );
      return response.data?.items || [];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Debounce changes
  const emitChange = useCallback(() => {
    onChange({
      credential_id: credentialId,
      operation,
      query,
      parameters: parameters.filter((p) => p.name.trim() !== ""),
    });
  }, [credentialId, operation, query, parameters, onChange]);

  useEffect(() => {
    const timeoutId = setTimeout(emitChange, 300);
    return () => clearTimeout(timeoutId);
  }, [emitChange]);

  const addParameter = () => {
    setParameters([...parameters, { name: "", value: "" }]);
  };

  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const updateParameter = (index: number, field: "name" | "value", value: string) => {
    setParameters(
      parameters.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const currentOperation = OPERATIONS.find((op) => op.value === operation);

  // Extract parameter placeholders from query
  const queryParams = query.match(/:(\w+)/g)?.map((p) => p.slice(1)) || [];

  return (
    <div className="space-y-4">
      {/* Database Credential */}
      <div>
        <Label className="text-sm font-medium">
          Database Connection <span className="text-red-500">*</span>
        </Label>
        <Select value={credentialId} onValueChange={setCredentialId}>
          <SelectTrigger className="mt-1.5">
            <SelectValue
              placeholder={isLoading ? "Loading..." : "Select a database"}
            />
          </SelectTrigger>
          <SelectContent>
            {credentials?.map((cred: { id: string; name: string }) => (
              <SelectItem key={cred.id} value={cred.id}>
                {cred.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!credentials?.length && !isLoading && (
          <p className="text-xs text-amber-600 mt-1">
            No database credentials found. Add one in Settings → Credentials.
          </p>
        )}
      </div>

      {/* Operation Type */}
      <div>
        <Label className="text-sm font-medium">Operation</Label>
        <Select value={operation} onValueChange={setOperation}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATIONS.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={op.value === "delete" ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    {op.label.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-gray-500">{op.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* SQL Query */}
      <div>
        <Label className="text-sm font-medium">
          SQL Query <span className="text-red-500">*</span>
        </Label>
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={EXAMPLE_QUERIES[operation]}
          className="mt-1.5 h-24 font-mono text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Use :param_name for parameters and {"{{variable}}"} for context values
        </p>
      </div>

      {/* Detected Parameters */}
      {queryParams.length > 0 && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">
            Detected Parameters
          </p>
          <div className="flex flex-wrap gap-1">
            {queryParams.map((param) => (
              <Badge key={param} variant="outline" className="text-xs font-mono">
                :{param}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Parameter Bindings */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <Label className="text-sm font-medium">Parameter Bindings</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addParameter}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>

        {parameters.length === 0 ? (
          <p className="text-xs text-gray-500">
            No parameters defined. Click "Add" to bind query parameters.
          </p>
        ) : (
          <div className="space-y-2">
            {parameters.map((param, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Input
                  value={param.name}
                  onChange={(e) => updateParameter(index, "name", e.target.value)}
                  placeholder="param_name"
                  className="w-1/3 font-mono text-sm"
                />
                <span className="text-gray-400">=</span>
                <Input
                  value={param.value}
                  onChange={(e) => updateParameter(index, "value", e.target.value)}
                  placeholder="{{input}}"
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeParameter(index)}
                >
                  <Trash2 className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Warning */}
      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <p className="text-xs text-amber-800 dark:text-amber-200">
          <strong>Security:</strong> Always use parameterized queries to prevent
          SQL injection. Never concatenate user input directly into queries.
        </p>
      </div>
    </div>
  );
}
