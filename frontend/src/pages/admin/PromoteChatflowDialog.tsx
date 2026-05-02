/**
 * Promote-from-chatflow dialog used by AdminTemplates.
 *
 * Picks a deployed chatflow from the active workspace and creates a template
 * row from it (config copied + workspace-bound IDs sanitized server-side).
 *
 * Drafts live in Redis, not the chatflows table, so every row from
 * `chatflowApi.list` is already deployed. The picker just lists what's there.
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/contexts/AppContext";
import { chatflowApi, type ChatflowListResponse } from "@/api/chatflow";
import {
  adminTemplatesApi,
  type AdminTemplate,
  type PromoteFromChatflowInput,
} from "@/api/templates";
import { handleApiError } from "@/lib/api-client";

interface PromoteChatflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (tpl: AdminTemplate) => void;
}

export function PromoteChatflowDialog({
  open,
  onOpenChange,
  onCreated,
}: PromoteChatflowDialogProps) {
  const { currentWorkspace } = useApp();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [icon, setIcon] = useState("");
  const [tagsCsv, setTagsCsv] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const reset = () => {
    setSelectedId(null);
    setName("");
    setSlug("");
    setDescription("");
    setCategory("");
    setIcon("");
    setTagsCsv("");
    setIsPublic(false);
  };

  // Reset when dialog closes so the next open starts clean.
  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const chatflowsQuery = useQuery<ChatflowListResponse>({
    queryKey: ["chatflows", currentWorkspace?.id],
    queryFn: () =>
      currentWorkspace?.id
        ? chatflowApi.list(currentWorkspace.id, 0, 200)
        : Promise.resolve({ items: [], total: 0, skip: 0, limit: 200 }),
    enabled: !!currentWorkspace?.id && open,
  });

  const chatflows = chatflowsQuery.data?.items ?? [];
  const selected = chatflows.find((c) => c.id === selectedId) ?? null;

  // Prefill name/description when a chatflow is picked.
  useEffect(() => {
    if (selected) {
      if (!name) setName(selected.name);
      if (!description && selected.description) setDescription(selected.description);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const promoteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Pick a chatflow first.");
      const body: PromoteFromChatflowInput = {
        chatflow_id: selectedId,
        name: name.trim() || undefined,
        slug: slug.trim() || undefined,
        description: description.trim() || null,
        category: category.trim() || null,
        icon: icon.trim() || null,
        tags: tagsCsv
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        is_public: isPublic,
      };
      return adminTemplatesApi.promoteFromChatflow(body);
    },
    onSuccess: (tpl) => {
      toast({
        title: "Template created",
        description: `"${tpl.name}" added to the marketplace${tpl.is_public ? "" : " (unlisted)"}.`,
      });
      // Both admin list and public marketplace should refresh.
      qc.invalidateQueries({ queryKey: ["admin", "templates"] });
      qc.invalidateQueries({ queryKey: ["templates"] });
      onCreated?.(tpl);
      onOpenChange(false);
    },
    onError: (err) => {
      toast({
        title: "Could not promote chatflow",
        description: handleApiError(err),
        variant: "destructive",
      });
    },
  });

  const tagsPreview = useMemo(
    () =>
      tagsCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [tagsCsv],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Promote chatflow to template</DialogTitle>
          <DialogDescription>
            Pick a deployed chatflow from{" "}
            <strong>{currentWorkspace?.name ?? "the active workspace"}</strong>.
            Workspace-bound references (KBs, credentials) are stripped so the
            new template prompts cloners to reselect them.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1 — chatflow picker */}
        <div className="space-y-2">
          <Label>Chatflow</Label>
          {chatflowsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading chatflows…
            </div>
          ) : chatflows.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-gray-500">
              No deployed chatflows in this workspace. Build and deploy one
              first, or switch workspaces.
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
              {chatflows.map((cf) => (
                <button
                  type="button"
                  key={cf.id}
                  onClick={() => setSelectedId(cf.id)}
                  className={
                    "w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 " +
                    (selectedId === cf.id ? "bg-blue-50 dark:bg-blue-950" : "")
                  }
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{cf.name}</span>
                    {cf.description && (
                      <span className="text-xs text-gray-500 line-clamp-1">
                        {cf.description}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {cf.node_count} nodes
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Step 2 — overrides (only visible after a pick) */}
        {selected && (
          <div className="space-y-4 pt-2 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="promote-name">Template name</Label>
                <Input
                  id="promote-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={selected.name}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="promote-slug">Slug</Label>
                <Input
                  id="promote-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="auto-generate from name if blank"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="promote-icon">Icon</Label>
                <Input
                  id="promote-icon"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="💬"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="promote-category">Category</Label>
                <Input
                  id="promote-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="support"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="promote-tags">Tags (comma-separated)</Label>
              <Input
                id="promote-tags"
                value={tagsCsv}
                onChange={(e) => setTagsCsv(e.target.value)}
                placeholder="kb, llm, support"
              />
              {tagsPreview.length > 0 && (
                <p className="text-xs text-gray-500">{tagsPreview.join(", ")}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="promote-desc">Description</Label>
              <Textarea
                id="promote-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={selected.description ?? "What does this template do?"}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="promote-public"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
              <Label htmlFor="promote-public" className="cursor-pointer">
                Publish to marketplace immediately
              </Label>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => promoteMutation.mutate()}
            disabled={!selectedId || promoteMutation.isPending}
          >
            {promoteMutation.isPending ? "Creating…" : "Create template"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
