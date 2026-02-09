/**
 * HTTP Node Configuration Panel
 *
 * Configures API request node with:
 * - HTTP method and URL
 * - Headers and body
 * - Credential selection
 * - Timeout settings
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
import { Badge } from "@/components/ui/badge";
import CredentialSelector from "@/components/shared/CredentialSelector";

interface HTTPNodeConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const HTTP_METHODS = [
  { value: "GET", color: "bg-green-100 text-green-700" },
  { value: "POST", color: "bg-blue-100 text-blue-700" },
  { value: "PUT", color: "bg-yellow-100 text-yellow-700" },
  { value: "PATCH", color: "bg-purple-100 text-purple-700" },
  { value: "DELETE", color: "bg-red-100 text-red-700" },
];

export function HTTPNodeConfig({ config, onChange }: HTTPNodeConfigProps) {
  const [method, setMethod] = useState((config.method as string) || "GET");
  const [url, setUrl] = useState((config.url as string) || "");
  const [headers, setHeaders] = useState(
    JSON.stringify(config.headers || { "Content-Type": "application/json" }, null, 2)
  );
  const [body, setBody] = useState(JSON.stringify(config.body || {}, null, 2));
  const [timeout, setTimeout_] = useState((config.timeout as number) || 30);
  const [credentialId, setCredentialId] = useState((config.credential_id as string) || "");
  const [headersError, setHeadersError] = useState("");
  const [bodyError, setBodyError] = useState("");

  // Validate JSON
  const validateJson = (str: string, setter: (err: string) => void): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(str);
      setter("");
      return parsed;
    } catch {
      setter("Invalid JSON");
      return null;
    }
  };

  // Debounce changes
  const emitChange = useCallback(() => {
    const parsedHeaders = validateJson(headers, setHeadersError);
    const parsedBody = method !== "GET" ? validateJson(body, setBodyError) : {};

    if (parsedHeaders !== null && (method === "GET" || parsedBody !== null)) {
      onChange({
        method,
        url,
        headers: parsedHeaders,
        body: parsedBody,
        timeout,
        credential_id: credentialId || undefined,
      });
    }
  }, [method, url, headers, body, timeout, credentialId, onChange]);

  useEffect(() => {
    const timeoutId = setTimeout(emitChange, 300);
    return () => clearTimeout(timeoutId);
  }, [emitChange]);

  const currentMethod = HTTP_METHODS.find((m) => m.value === method);

  return (
    <div className="space-y-4">
      {/* Method & URL */}
      <div>
        <Label className="text-sm font-medium">
          Endpoint <span className="text-red-500">*</span>
        </Label>
        <div className="flex gap-2 mt-1.5">
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-28">
              <SelectValue>
                <Badge className={currentMethod?.color}>{method}</Badge>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {HTTP_METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  <Badge className={m.color}>{m.value}</Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.example.com/endpoint"
            className="flex-1 font-mono text-sm"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Use {"{{variable}}"} for dynamic values
        </p>
      </div>

      {/* Headers */}
      <div>
        <Label className="text-sm font-medium">Headers (JSON)</Label>
        <Textarea
          value={headers}
          onChange={(e) => setHeaders(e.target.value)}
          placeholder='{"Content-Type": "application/json"}'
          className="mt-1.5 h-24 font-mono text-sm"
        />
        {headersError && (
          <p className="text-xs text-red-500 mt-1">{headersError}</p>
        )}
      </div>

      {/* Body (only for non-GET) */}
      {method !== "GET" && (
        <div>
          <Label className="text-sm font-medium">Body (JSON)</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder='{"message": "{{input}}"}'
            className="mt-1.5 h-24 font-mono text-sm"
          />
          {bodyError && (
            <p className="text-xs text-red-500 mt-1">{bodyError}</p>
          )}
        </div>
      )}

      {/* Timeout */}
      <div>
        <Label className="text-sm font-medium">Timeout (seconds)</Label>
        <Input
          type="number"
          value={timeout}
          onChange={(e) => setTimeout_(Number(e.target.value))}
          min={1}
          max={120}
          className="mt-1.5 w-24"
        />
      </div>

      {/* Credential */}
      <CredentialSelector
        provider="custom"
        selectedId={credentialId}
        onSelect={setCredentialId}
        label="Authentication Credential"
        required={false}
      />
    </div>
  );
}
