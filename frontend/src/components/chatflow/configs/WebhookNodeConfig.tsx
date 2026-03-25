/**
 * Webhook Node Configuration Panel
 *
 * Configures outbound webhook with:
 * - URL with variable support
 * - HTTP method (POST, PUT, PATCH)
 * - Payload template with variable interpolation
 * - Retry logic and timeout
 * - Fire-and-forget option
 * - Optional credential for auth
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import CredentialSelector from "@/components/shared/CredentialSelector";

interface WebhookNodeConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const METHODS = [
  { value: "POST", color: "bg-blue-100 text-blue-700" },
  { value: "PUT", color: "bg-yellow-100 text-yellow-700" },
  { value: "PATCH", color: "bg-purple-100 text-purple-700" },
];

export function WebhookNodeConfig({ config, onChange }: WebhookNodeConfigProps) {
  const [url, setUrl] = useState((config.url as string) || "");
  const [method, setMethod] = useState((config.method as string) || "POST");
  const [payload, setPayload] = useState(
    JSON.stringify(config.payload || { message: "{{input}}" }, null, 2)
  );
  const [headers, setHeaders] = useState(
    JSON.stringify(config.headers || {}, null, 2)
  );
  const [retryCount, setRetryCount] = useState((config.retry_count as number) || 1);
  const [timeout, setTimeout_] = useState((config.timeout as number) || 10);
  const [fireAndForget, setFireAndForget] = useState(
    (config.fire_and_forget as boolean) || false
  );
  const [credentialId, setCredentialId] = useState(
    (config.credential_id as string) || ""
  );
  const [payloadError, setPayloadError] = useState("");
  const [headersError, setHeadersError] = useState("");

  const validateJson = (
    str: string,
    setter: (err: string) => void
  ): Record<string, unknown> | null => {
    if (!str.trim() || str.trim() === "{}") {
      setter("");
      return {};
    }
    try {
      const parsed = JSON.parse(str);
      setter("");
      return parsed;
    } catch {
      setter("Invalid JSON");
      return null;
    }
  };

  const emitChange = useCallback(() => {
    const parsedPayload = validateJson(payload, setPayloadError);
    const parsedHeaders = validateJson(headers, setHeadersError);

    if (parsedPayload !== null && parsedHeaders !== null) {
      onChange({
        url,
        method,
        payload: parsedPayload,
        headers: parsedHeaders,
        retry_count: retryCount,
        timeout,
        fire_and_forget: fireAndForget,
        credential_id: credentialId || undefined,
      });
    }
  }, [url, method, payload, headers, retryCount, timeout, fireAndForget, credentialId, onChange]);

  useEffect(() => {
    const timeoutId = setTimeout(emitChange, 300);
    return () => clearTimeout(timeoutId);
  }, [emitChange]);

  const currentMethod = METHODS.find((m) => m.value === method);

  return (
    <div className="space-y-4">
      {/* Method & URL */}
      <div>
        <Label className="text-sm font-medium">
          Webhook URL <span className="text-red-500">*</span>
        </Label>
        <div className="flex gap-2 mt-1.5">
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-24">
              <SelectValue>
                <Badge className={currentMethod?.color}>{method}</Badge>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  <Badge className={m.color}>{m.value}</Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://hooks.zapier.com/..."
            className="flex-1 font-mono text-sm"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Use {"{{variable}}"} for dynamic values
        </p>
      </div>

      {/* Payload */}
      <div>
        <Label className="text-sm font-medium">Payload (JSON)</Label>
        <Textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          placeholder='{"message": "{{input}}"}'
          className="mt-1.5 h-28 font-mono text-sm"
        />
        {payloadError && (
          <p className="text-xs text-red-500 mt-1">{payloadError}</p>
        )}
      </div>

      {/* Headers */}
      <div>
        <Label className="text-sm font-medium">Custom Headers (JSON)</Label>
        <Textarea
          value={headers}
          onChange={(e) => setHeaders(e.target.value)}
          placeholder="{}"
          className="mt-1.5 h-16 font-mono text-sm"
        />
        {headersError && (
          <p className="text-xs text-red-500 mt-1">{headersError}</p>
        )}
      </div>

      {/* Retry & Timeout */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium">Retries (0-3)</Label>
          <Input
            type="number"
            value={retryCount}
            onChange={(e) => setRetryCount(Math.min(3, Math.max(0, Number(e.target.value))))}
            min={0}
            max={3}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label className="text-sm font-medium">Timeout (sec)</Label>
          <Input
            type="number"
            value={timeout}
            onChange={(e) => setTimeout_(Math.min(30, Math.max(5, Number(e.target.value))))}
            min={5}
            max={30}
            className="mt-1.5"
          />
        </div>
      </div>

      {/* Fire and Forget */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Fire & Forget</Label>
          <p className="text-xs text-gray-500">
            Don't block flow on response
          </p>
        </div>
        <Switch checked={fireAndForget} onCheckedChange={setFireAndForget} />
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
