/**
 * Admin Templates — staff-only marketplace curation page.
 *
 * Lists all templates (public + unlisted), supports:
 *   - Create from scratch (raw JSON config)
 *   - Promote from existing deployed chatflow (handles workspace-bound IDs)
 *   - Edit metadata
 *   - Toggle publish (is_public)
 *   - Delete
 *
 * Mutations invalidate BOTH `["admin", "templates"]` (this page) and
 * `["templates"]` (public MarketplacePage) so a fresh publish appears
 * immediately when staff navigate to /marketplace.
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  Plus,
  ArrowUpFromLine,
  Pencil,
  Trash2,
  EyeOff,
  Eye,
  Tag as TagIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  adminTemplatesApi,
  type AdminTemplate,
  type TemplateCreateInput,
  type TemplateUpdateInput,
} from "@/api/templates";
import { handleApiError } from "@/lib/api-client";
import { AdminTemplateForm, type ParsedFormValue } from "./AdminTemplateForm";
import { PromoteChatflowDialog } from "./PromoteChatflowDialog";

type Filter = "all" | "listed" | "unlisted";

export function AdminTemplates() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [filter, setFilter] = useState<Filter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [editing, setEditing] = useState<AdminTemplate | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminTemplate | null>(null);

  const listQuery = useQuery({
    queryKey: ["admin", "templates"],
    queryFn: () => adminTemplatesApi.list(),
  });

  const templates = listQuery.data ?? [];

  const filtered = useMemo(() => {
    if (filter === "listed") return templates.filter((t) => t.is_public);
    if (filter === "unlisted") return templates.filter((t) => !t.is_public);
    return templates;
  }, [filter, templates]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["admin", "templates"] });
    qc.invalidateQueries({ queryKey: ["templates"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: TemplateCreateInput) => adminTemplatesApi.create(body),
    onSuccess: (tpl) => {
      toast({
        title: "Template created",
        description: `"${tpl.name}" is now ${tpl.is_public ? "public" : "unlisted"}.`,
      });
      invalidateAll();
      setCreateOpen(false);
    },
    onError: (err) =>
      toast({
        title: "Could not create template",
        description: handleApiError(err),
        variant: "destructive",
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: TemplateUpdateInput }) =>
      adminTemplatesApi.update(id, body),
    onSuccess: () => {
      toast({ title: "Template updated" });
      invalidateAll();
      setEditing(null);
    },
    onError: (err) =>
      toast({
        title: "Could not update template",
        description: handleApiError(err),
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminTemplatesApi.delete(id),
    onSuccess: () => {
      toast({ title: "Template deleted" });
      invalidateAll();
      setPendingDelete(null);
    },
    onError: (err) =>
      toast({
        title: "Could not delete template",
        description: handleApiError(err),
        variant: "destructive",
      }),
  });

  const togglePublish = (t: AdminTemplate) => {
    updateMutation.mutate({ id: t.id, body: { is_public: !t.is_public } });
  };

  const handleCreate = (parsed: ParsedFormValue) => {
    createMutation.mutate({
      name: parsed.name,
      slug: parsed.slug,
      description: parsed.description ?? undefined,
      category: parsed.category ?? undefined,
      icon: parsed.icon ?? undefined,
      tags: parsed.tags,
      config: parsed.config ?? {},
      is_public: parsed.is_public,
    });
  };

  const handleEdit = (parsed: ParsedFormValue) => {
    if (!editing) return;
    updateMutation.mutate({
      id: editing.id,
      body: {
        name: parsed.name,
        slug: parsed.slug,
        description: parsed.description ?? undefined,
        category: parsed.category ?? undefined,
        icon: parsed.icon ?? undefined,
        tags: parsed.tags,
        config: parsed.config,
        is_public: parsed.is_public,
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-manrope flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-blue-600" />
              Marketplace Templates
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Curate the chatflow templates available to all users in the marketplace.
              {!listQuery.isLoading && (
                <>
                  {" · "}
                  <span className="text-gray-500">
                    {templates.filter((t) => t.is_public).length} public,{" "}
                    {templates.filter((t) => !t.is_public).length} unlisted
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPromoteOpen(true)}>
              <ArrowUpFromLine className="h-4 w-4 mr-1.5" />
              Create from chatflow
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create from scratch
            </Button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2">
          {(["all", "listed", "unlisted"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={
                "px-3 py-1 rounded-full text-xs font-medium border transition-colors " +
                (filter === f
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700")
              }
            >
              {f === "all" ? "All" : f === "listed" ? "Listed" : "Unlisted"}
            </button>
          ))}
        </div>

        {/* Body */}
        {listQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading templates…
          </div>
        ) : listQuery.isError ? (
          <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-900 p-4 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-medium text-red-900 dark:text-red-200">Failed to load templates</p>
              <p className="text-sm text-red-700 dark:text-red-300">
                {handleApiError(listQuery.error)}
              </p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-gray-500">
            {templates.length === 0
              ? "No templates yet. Create one from scratch or promote a deployed chatflow."
              : `No ${filter === "listed" ? "public" : "unlisted"} templates.`}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => (
              <div
                key={t.id}
                className="rounded-md border bg-white dark:bg-gray-800 p-4 flex items-start gap-4"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-lg">
                  {t.icon || "📦"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{t.name}</span>
                    <code className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-900 px-1.5 py-0.5 rounded">
                      {t.slug}
                    </code>
                    {t.is_public ? (
                      <Badge variant="secondary">Listed</Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-500">
                        Unlisted
                      </Badge>
                    )}
                    {t.category && (
                      <span className="text-xs text-gray-500">· {t.category}</span>
                    )}
                  </div>
                  {t.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                      {t.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-2 flex-wrap">
                    <span>
                      {t.node_count} nodes · {t.edge_count} edges
                    </span>
                    <span>· {t.use_count} clones</span>
                    {(t.tags ?? []).length > 0 && (
                      <span className="flex items-center gap-1">
                        · <TagIcon className="h-3 w-3" />
                        {(t.tags ?? []).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => togglePublish(t)}
                    disabled={updateMutation.isPending}
                  >
                    {t.is_public ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5 mr-1" />
                        Unpublish
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Publish
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(t)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPendingDelete(t)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create template</DialogTitle>
            <DialogDescription>
              Define metadata and paste a chatflow config JSON. To clone an existing
              deployed chatflow, use <strong>Create from chatflow</strong> instead.
            </DialogDescription>
          </DialogHeader>
          <AdminTemplateForm
            mode="create"
            onSubmit={handleCreate}
            onCancel={() => setCreateOpen(false)}
            submitting={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit template</DialogTitle>
            <DialogDescription>
              Update metadata. Config edits are gated behind the Advanced toggle.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <AdminTemplateForm
              mode="edit"
              hideConfigByDefault
              initial={{
                name: editing.name,
                slug: editing.slug,
                description: editing.description ?? "",
                category: editing.category ?? "",
                icon: editing.icon ?? "",
                tagsCsv: (editing.tags ?? []).join(", "),
                is_public: editing.is_public,
                configJson: JSON.stringify(editing.config ?? {}, null, 2),
              }}
              onSubmit={handleEdit}
              onCancel={() => setEditing(null)}
              submitting={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Promote-from-chatflow */}
      <PromoteChatflowDialog open={promoteOpen} onOpenChange={setPromoteOpen} />

      {/* Delete confirm */}
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingDelete?.name}</strong> will be permanently removed
              from the marketplace. Existing chatflows that were cloned from it
              are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
              }}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
