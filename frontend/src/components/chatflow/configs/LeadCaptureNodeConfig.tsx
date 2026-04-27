/**
 * Lead Capture Node Configuration Panel
 *
 * Configures lead collection with:
 * - Field definitions (name, source, required, validation)
 * - Internal storage toggle
 * - CRM webhook for external sync
 * - Duplicate handling strategy
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
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import CredentialSelector from "@/components/shared/CredentialSelector";

interface LeadField {
  name: string;
  source: string;
  required: boolean;
  validate?: string;
}

interface LeadCaptureNodeConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const VALIDATION_TYPES = [
  { value: "", label: "None" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "url", label: "URL" },
];

const DUPLICATE_HANDLING = [
  { value: "update", label: "Update Existing", description: "Merge with existing lead" },
  { value: "skip", label: "Skip", description: "Don't create if exists" },
  { value: "create", label: "Always Create", description: "Create new regardless" },
];

const DEFAULT_FIELDS: LeadField[] = [
  { name: "name", source: "{{user_name}}", required: true },
  { name: "email", source: "{{user_email}}", required: true, validate: "email" },
];

export function LeadCaptureNodeConfig({
  config,
  onChange,
}: LeadCaptureNodeConfigProps) {
  const [fields, setFields] = useState<LeadField[]>(
    (config.fields as LeadField[]) || DEFAULT_FIELDS
  );
  const [storeInternally, setStoreInternally] = useState(
    config.store_internally !== false
  );
  // Initial CRM-enabled state: truthy if a URL was previously saved.
  const [crmEnabled, setCrmEnabled] = useState(
    Boolean((config.crm_webhook_url as string) || "")
  );
  const [crmWebhookUrl, setCrmWebhookUrl] = useState(
    (config.crm_webhook_url as string) || ""
  );
  const [crmCredentialId, setCrmCredentialId] = useState(
    (config.crm_credential_id as string) || ""
  );
  const [duplicateHandling, setDuplicateHandling] = useState(
    (config.duplicate_handling as string) || "update"
  );

  const emitChange = useCallback(() => {
    onChange({
      fields,
      store_internally: storeInternally,
      // When CRM is disabled, explicitly drop both fields so stale values
      // from a previous session don't get re-saved.
      crm_webhook_url: crmEnabled ? crmWebhookUrl || undefined : undefined,
      crm_credential_id: crmEnabled ? crmCredentialId || undefined : undefined,
      duplicate_handling: duplicateHandling,
    });
  }, [fields, storeInternally, crmEnabled, crmWebhookUrl, crmCredentialId, duplicateHandling, onChange]);

  useEffect(() => {
    const timeoutId = setTimeout(emitChange, 300);
    return () => clearTimeout(timeoutId);
  }, [emitChange]);

  const addField = () => {
    setFields([
      ...fields,
      { name: "", source: "", required: false },
    ]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<LeadField>) => {
    setFields(
      fields.map((field, i) =>
        i === index ? { ...field, ...updates } : field
      )
    );
  };

  return (
    <div className="space-y-4">
      {/* Fields */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium">
            Fields <span className="text-red-500">*</span>
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={addField}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Field
          </Button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={index}
              className="p-3 border rounded-lg space-y-2 bg-gray-50 dark:bg-gray-800"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">
                  Field {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                  onClick={() => removeField(index)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    value={field.name}
                    onChange={(e) =>
                      updateField(index, { name: e.target.value })
                    }
                    placeholder="Field name"
                    className="text-sm h-8"
                  />
                </div>
                <div>
                  <Input
                    value={field.source}
                    onChange={(e) =>
                      updateField(index, { source: e.target.value })
                    }
                    placeholder="{{variable}}"
                    className="text-sm h-8 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={field.required}
                    onCheckedChange={(checked) =>
                      updateField(index, { required: checked })
                    }
                    className="scale-75"
                  />
                  <span className="text-xs text-gray-500">Required</span>
                </div>

                <Select
                  value={field.validate || ""}
                  onValueChange={(value) =>
                    updateField(index, { validate: value || undefined })
                  }
                >
                  <SelectTrigger className="h-7 text-xs w-24">
                    <SelectValue placeholder="Validate" />
                  </SelectTrigger>
                  <SelectContent>
                    {VALIDATION_TYPES.map((v) => (
                      <SelectItem key={v.value} value={v.value || "none"}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Store Internally */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Store in PrivexBot</Label>
          <p className="text-xs text-gray-500">Save to internal leads table</p>
        </div>
        <Switch
          checked={storeInternally}
          onCheckedChange={setStoreInternally}
        />
      </div>

      {/* Duplicate Handling */}
      <div>
        <Label className="text-sm font-medium">Duplicate Handling</Label>
        <Select value={duplicateHandling} onValueChange={setDuplicateHandling}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DUPLICATE_HANDLING.map((d) => (
              <SelectItem key={d.value} value={d.value}>
                <div>
                  <span className="font-medium">{d.label}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {d.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* CRM push — off by default; only render the URL + credential
          inputs once the user opts in. */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Push to external CRM</Label>
          <p className="text-xs text-gray-500">
            Forward lead data to a webhook (HubSpot, Salesforce, Zapier, etc.)
          </p>
        </div>
        <Switch checked={crmEnabled} onCheckedChange={setCrmEnabled} />
      </div>

      {crmEnabled && (
        <>
          <div>
            <Label className="text-sm font-medium">CRM Webhook URL</Label>
            <Input
              value={crmWebhookUrl}
              onChange={(e) => setCrmWebhookUrl(e.target.value)}
              placeholder="https://api.hubspot.com/..."
              className="mt-1.5 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              POSTs the captured lead as JSON to this URL.
            </p>
          </div>
          {crmWebhookUrl && (
            <CredentialSelector
              provider="custom"
              selectedId={crmCredentialId}
              onSelect={setCrmCredentialId}
              label="CRM Authentication"
              required={false}
            />
          )}
        </>
      )}

      {/* Summary */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-xs font-medium text-gray-500 mb-1">
          Lead Capture Summary
        </p>
        <p className="text-sm">
          {fields.filter((f) => f.name).length} fields configured
          {storeInternally ? " + Internal storage" : ""}
          {crmEnabled && crmWebhookUrl ? " + CRM sync" : ""}
        </p>
      </div>
    </div>
  );
}
