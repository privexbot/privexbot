/**
 * Shared form used by both the Create and Edit dialogs in AdminTemplates.
 *
 * Fields kept deliberately flat so the two flows can share the same shape.
 * Tags are entered as a comma-separated string in the UI and split on submit.
 * The `config` JSON textarea is hidden behind an "Advanced" disclosure on
 * edit so admins don't fat-finger it; the typical edit flow only touches
 * metadata (name, slug, category, is_public, etc).
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export interface AdminTemplateFormValue {
  name: string;
  slug: string;
  description: string;
  category: string;
  icon: string;
  tagsCsv: string;
  is_public: boolean;
  configJson: string;
}

export interface AdminTemplateFormProps {
  mode: "create" | "edit";
  initial?: Partial<AdminTemplateFormValue>;
  onSubmit: (parsed: ParsedFormValue) => void | Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
  /** True when config is locked (e.g. editing — config edits gated behind disclosure). */
  hideConfigByDefault?: boolean;
}

export interface ParsedFormValue {
  name: string;
  slug?: string;
  description?: string | null;
  category?: string | null;
  icon?: string | null;
  tags: string[];
  is_public: boolean;
  config?: Record<string, unknown>;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const EMPTY_CONFIG = JSON.stringify(
  { nodes: [], edges: [], variables: {}, settings: {} },
  null,
  2,
);

export function AdminTemplateForm({
  mode,
  initial,
  onSubmit,
  onCancel,
  submitting = false,
  hideConfigByDefault = false,
}: AdminTemplateFormProps) {
  const [value, setValue] = useState<AdminTemplateFormValue>({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    description: initial?.description ?? "",
    category: initial?.category ?? "",
    icon: initial?.icon ?? "",
    tagsCsv: initial?.tagsCsv ?? "",
    is_public: initial?.is_public ?? false,
    configJson: initial?.configJson ?? EMPTY_CONFIG,
  });
  const [showConfig, setShowConfig] = useState(!hideConfigByDefault);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset when initial changes (e.g. opening edit dialog for a different row).
  useEffect(() => {
    if (initial) {
      setValue({
        name: initial.name ?? "",
        slug: initial.slug ?? "",
        description: initial.description ?? "",
        category: initial.category ?? "",
        icon: initial.icon ?? "",
        tagsCsv: initial.tagsCsv ?? "",
        is_public: initial.is_public ?? false,
        configJson: initial.configJson ?? EMPTY_CONFIG,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.name, initial?.slug, initial?.configJson]);

  const tagsPreview = useMemo(
    () =>
      value.tagsCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [value.tagsCsv],
  );

  const validate = (): { ok: boolean; parsedConfig?: Record<string, unknown> } => {
    const e: Record<string, string> = {};
    if (!value.name.trim()) e.name = "Required";
    if (value.name.length > 150) e.name = "Max 150 characters";
    if (value.slug.trim() && !SLUG_RE.test(value.slug.trim())) {
      e.slug = "lowercase a–z, 0–9, hyphens; cannot start/end with hyphen";
    }

    let parsedConfig: Record<string, unknown> | undefined;
    if (mode === "create" || showConfig) {
      try {
        const parsed = JSON.parse(value.configJson);
        if (
          !parsed ||
          typeof parsed !== "object" ||
          !Array.isArray((parsed as { nodes?: unknown }).nodes) ||
          !Array.isArray((parsed as { edges?: unknown }).edges)
        ) {
          e.configJson = "Config must be an object with `nodes` and `edges` arrays.";
        } else {
          parsedConfig = parsed as Record<string, unknown>;
        }
      } catch {
        e.configJson = "Invalid JSON.";
      }
    }

    setErrors(e);
    return { ok: Object.keys(e).length === 0, parsedConfig };
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const { ok, parsedConfig } = validate();
    if (!ok) return;
    void onSubmit({
      name: value.name.trim(),
      slug: value.slug.trim() || undefined,
      description: value.description.trim() || null,
      category: value.category.trim() || null,
      icon: value.icon.trim() || null,
      tags: tagsPreview,
      is_public: value.is_public,
      config: parsedConfig,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="tpl-name">Name *</Label>
          <Input
            id="tpl-name"
            value={value.name}
            onChange={(e) => setValue((v) => ({ ...v, name: e.target.value }))}
            placeholder="Customer support FAQ bot"
            disabled={submitting}
          />
          {errors.name && (
            <p className="text-xs text-red-600 dark:text-red-400">{errors.name}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="tpl-slug">Slug</Label>
          <Input
            id="tpl-slug"
            value={value.slug}
            onChange={(e) => setValue((v) => ({ ...v, slug: e.target.value }))}
            placeholder="auto-generate from name if blank"
            disabled={submitting}
          />
          {errors.slug && (
            <p className="text-xs text-red-600 dark:text-red-400">{errors.slug}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="tpl-icon">Icon (emoji or short label)</Label>
          <Input
            id="tpl-icon"
            value={value.icon}
            onChange={(e) => setValue((v) => ({ ...v, icon: e.target.value }))}
            placeholder="💬"
            disabled={submitting}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="tpl-category">Category</Label>
          <Input
            id="tpl-category"
            value={value.category}
            onChange={(e) => setValue((v) => ({ ...v, category: e.target.value }))}
            placeholder="support / sales / scheduling"
            disabled={submitting}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="tpl-tags">Tags (comma-separated)</Label>
        <Input
          id="tpl-tags"
          value={value.tagsCsv}
          onChange={(e) => setValue((v) => ({ ...v, tagsCsv: e.target.value }))}
          placeholder="kb, support, llm"
          disabled={submitting}
        />
        {tagsPreview.length > 0 && (
          <p className="text-xs text-gray-500">Tags: {tagsPreview.join(", ")}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="tpl-description">Description</Label>
        <Textarea
          id="tpl-description"
          rows={3}
          value={value.description}
          onChange={(e) => setValue((v) => ({ ...v, description: e.target.value }))}
          placeholder="One or two sentences shown to users in the marketplace."
          disabled={submitting}
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Switch
          id="tpl-public"
          checked={value.is_public}
          onCheckedChange={(checked) =>
            setValue((v) => ({ ...v, is_public: checked }))
          }
          disabled={submitting}
        />
        <Label htmlFor="tpl-public" className="cursor-pointer">
          Public — listed on the marketplace
        </Label>
      </div>

      {mode === "edit" && hideConfigByDefault && !showConfig && (
        <button
          type="button"
          onClick={() => setShowConfig(true)}
          className="text-xs text-blue-600 hover:underline"
        >
          Advanced — edit raw config JSON
        </button>
      )}

      {(mode === "create" || showConfig) && (
        <div className="space-y-1">
          <Label htmlFor="tpl-config">Config (JSON)</Label>
          <Textarea
            id="tpl-config"
            rows={10}
            value={value.configJson}
            onChange={(e) => setValue((v) => ({ ...v, configJson: e.target.value }))}
            className="font-mono text-xs"
            disabled={submitting}
          />
          {errors.configJson && (
            <p className="text-xs text-red-600 dark:text-red-400">{errors.configJson}</p>
          )}
          <p className="text-xs text-gray-500">
            Must contain <code>nodes</code> and <code>edges</code> arrays. To
            promote an existing chatflow visually, use the{" "}
            <strong>Create from chatflow</strong> action instead.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : mode === "create" ? "Create template" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
