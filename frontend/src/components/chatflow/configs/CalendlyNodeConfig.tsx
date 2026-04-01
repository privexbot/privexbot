/**
 * Calendly Node Configuration Panel
 *
 * Configures Calendly scheduling with:
 * - Calendly credential selection (OAuth)
 * - Action: get_link or list_events
 * - Event type name filter
 * - Message template with {{calendly_link}} variable
 */

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

interface CalendlyNodeConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

export function CalendlyNodeConfig({ config, onChange }: CalendlyNodeConfigProps) {
  const updateField = (field: string, value: unknown) => {
    onChange({ ...config, [field]: value });
  };

  return (
    <div className="space-y-4">
      {/* Credential */}
      <div>
        <Label className="text-xs font-medium">Calendly Account *</Label>
        <div className="mt-1">
          <CredentialSelector
            selectedId={(config.credential_id as string) || ""}
            onSelect={(val) => updateField("credential_id", val)}
            provider="calendly"
            label="Calendly Account"
            required={true}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Connect your Calendly account via OAuth in Settings &gt; Credentials
        </p>
      </div>

      {/* Action */}
      <div>
        <Label className="text-xs font-medium">Action</Label>
        <Select
          value={(config.action as string) || "get_link"}
          onValueChange={(val) => updateField("action", val)}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="get_link">Get Booking Link</SelectItem>
            <SelectItem value="list_events">List Event Types</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          {(config.action as string) === "list_events"
            ? "Returns a list of all active event types with links"
            : "Returns a scheduling link for end-users to book a meeting"}
        </p>
      </div>

      {/* Event Type Name (only for get_link) */}
      {(config.action as string) !== "list_events" && (
        <div>
          <Label className="text-xs font-medium">Event Type Name (Optional)</Label>
          <Input
            value={(config.event_type_name as string) || ""}
            onChange={(e) => updateField("event_type_name", e.target.value)}
            placeholder="30-Minute Meeting"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Leave empty to use the first active event type
          </p>
        </div>
      )}

      {/* Message Template (only for get_link) */}
      {(config.action as string) !== "list_events" && (
        <div>
          <Label className="text-xs font-medium">Message Template</Label>
          <Textarea
            value={
              (config.message_template as string) ||
              "Book a meeting with us: {{calendly_link}}"
            }
            onChange={(e) => updateField("message_template", e.target.value)}
            className="mt-1 font-mono text-xs"
            rows={3}
          />
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-xs">
              {"{{calendly_link}}"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Replaced with the actual booking URL
            </span>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-xs">
          The Calendly node fetches scheduling links from your connected Calendly account.
          End-users can click the link to book a meeting directly.
        </p>
      </div>
    </div>
  );
}

export default CalendlyNodeConfig;
