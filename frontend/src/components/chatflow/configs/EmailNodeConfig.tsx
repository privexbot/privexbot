/**
 * Email Node Configuration Panel
 *
 * Configures email sending with:
 * - Send method: SMTP or Gmail (OAuth)
 * - Credential selection (filtered by method)
 * - To, CC, BCC with variable support
 * - Subject and body templates
 * - HTML or plain text body type
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CredentialSelector from "@/components/shared/CredentialSelector";

interface EmailNodeConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const AVAILABLE_VARIABLES = [
  { name: "input", description: "User message" },
  { name: "user_name", description: "User name" },
  { name: "user_email", description: "User email" },
];

export function EmailNodeConfig({ config, onChange }: EmailNodeConfigProps) {
  const [sendMethod, setSendMethod] = useState(
    (config.send_method as string) || "smtp"
  );
  const [credentialId, setCredentialId] = useState(
    (config.credential_id as string) || ""
  );
  const [to, setTo] = useState((config.to as string) || "");
  const [cc, setCc] = useState((config.cc as string) || "");
  const [bcc, setBcc] = useState((config.bcc as string) || "");
  const [subject, setSubject] = useState((config.subject as string) || "");
  const [body, setBody] = useState((config.body as string) || "");
  const [bodyType, setBodyType] = useState(
    (config.body_type as string) || "html"
  );
  const [replyTo, setReplyTo] = useState((config.reply_to as string) || "");

  const emitChange = useCallback(() => {
    onChange({
      send_method: sendMethod,
      credential_id: credentialId,
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject,
      body,
      body_type: bodyType,
      reply_to: replyTo || undefined,
    });
  }, [sendMethod, credentialId, to, cc, bcc, subject, body, bodyType, replyTo, onChange]);

  useEffect(() => {
    const timeoutId = setTimeout(emitChange, 300);
    return () => clearTimeout(timeoutId);
  }, [emitChange]);

  const insertVariable = (field: "subject" | "body", varName: string) => {
    if (field === "subject") {
      setSubject((prev) => prev + `{{${varName}}}`);
    } else {
      setBody((prev) => prev + `{{${varName}}}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Send Method */}
      <div>
        <Label className="text-sm font-medium">Send Method</Label>
        <Select value={sendMethod} onValueChange={(val) => { setSendMethod(val); setCredentialId(""); }}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="smtp">SMTP</SelectItem>
            <SelectItem value="gmail">Gmail (OAuth)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          {sendMethod === "gmail"
            ? "Send via your connected Gmail account (OAuth)"
            : "Send via SMTP server credentials"}
        </p>
      </div>

      {/* Credential */}
      <CredentialSelector
        provider={sendMethod === "gmail" ? "google_gmail" : "smtp"}
        selectedId={credentialId}
        onSelect={setCredentialId}
        label={sendMethod === "gmail" ? "Gmail Account" : "SMTP Credential"}
        required={true}
      />

      {/* To */}
      <div>
        <Label className="text-sm font-medium">
          To <span className="text-red-500">*</span>
        </Label>
        <Input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="recipient@example.com or {{user_email}}"
          className="mt-1.5 font-mono text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Separate multiple emails with commas
        </p>
      </div>

      {/* CC / BCC */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium">CC</Label>
          <Input
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder="cc@example.com"
            className="mt-1.5 text-sm"
          />
        </div>
        <div>
          <Label className="text-sm font-medium">BCC</Label>
          <Input
            value={bcc}
            onChange={(e) => setBcc(e.target.value)}
            placeholder="bcc@example.com"
            className="mt-1.5 text-sm"
          />
        </div>
      </div>

      {/* Subject */}
      <div>
        <Label className="text-sm font-medium">
          Subject <span className="text-red-500">*</span>
        </Label>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Re: {{topic}}"
          className="mt-1.5 text-sm"
        />
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {AVAILABLE_VARIABLES.map((v) => (
            <Button
              key={v.name}
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => insertVariable("subject", v.name)}
            >
              <Badge variant="secondary" className="text-xs">
                {`{{${v.name}}}`}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* Body Type */}
      <div>
        <Label className="text-sm font-medium">Body Format</Label>
        <Select value={bodyType} onValueChange={setBodyType}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="html">HTML</SelectItem>
            <SelectItem value="text">Plain Text</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Body */}
      <div>
        <Label className="text-sm font-medium">
          Body <span className="text-red-500">*</span>
        </Label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            bodyType === "html"
              ? "<h2>Hello {{user_name}}</h2>\n<p>Thank you for contacting us...</p>"
              : "Hello {{user_name}},\n\nThank you for contacting us..."
          }
          className="mt-1.5 h-32 font-mono text-sm"
        />
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {AVAILABLE_VARIABLES.map((v) => (
            <Button
              key={v.name}
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => insertVariable("body", v.name)}
            >
              <Badge variant="secondary" className="text-xs">
                {`{{${v.name}}}`}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* Reply-To */}
      <div>
        <Label className="text-sm font-medium">Reply-To</Label>
        <Input
          value={replyTo}
          onChange={(e) => setReplyTo(e.target.value)}
          placeholder="support@company.com"
          className="mt-1.5 text-sm"
        />
      </div>
    </div>
  );
}
