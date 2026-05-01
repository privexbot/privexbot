/**
 * Marketplace page — browse + clone chatflow templates.
 *
 * Backed by `backend/src/app/api/v1/routes/templates.py`. Templates are
 * global (not workspace-scoped); cloning produces a draft owned by the
 * caller's active workspace.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Layers,
  Tag as TagIcon,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/contexts/AppContext";
import { templatesApi, type TemplateSummary } from "@/api/templates";
import { handleApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const ALL = "__all__";

export function MarketplacePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentWorkspace } = useApp();
  const [activeCategory, setActiveCategory] = useState<string>(ALL);
  const [selected, setSelected] = useState<TemplateSummary | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["templates", activeCategory],
    queryFn: () =>
      templatesApi.list(activeCategory === ALL ? undefined : activeCategory),
  });

  // Build the category chip list from the loaded templates so the UI doesn't
  // hardcode a list that drifts from the seed data.
  const categories = useMemo(() => {
    const set = new Set<string>();
    (templates ?? []).forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set).sort();
  }, [templates]);

  const cloneMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (!currentWorkspace?.id) {
        throw new Error("Pick a workspace before cloning a template.");
      }
      return templatesApi.clone(id, currentWorkspace.id);
    },
    onSuccess: (data) => {
      toast({
        title: "Template ready",
        description: `Opening "${data.template_name}" in the builder…`,
      });
      navigate(`/chatflows/builder/${data.draft_id}`);
    },
    onError: (err) =>
      toast({
        title: "Could not clone template",
        description: handleApiError(err),
        variant: "destructive",
      }),
  });

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="-ml-2 text-gray-600 dark:text-gray-400"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="flex items-start gap-4">
          <Sparkles className="h-6 w-6 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold font-manrope">Marketplace</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Pre-built chatflow templates you can drop into your workspace.
              Clone one to start with a working configuration; tweak in the
              builder.
            </p>
          </div>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveCategory(ALL)}
              className={cn(
                "text-xs font-medium px-3 py-1.5 rounded-full border transition-colors",
                activeCategory === ALL
                  ? "bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                  : "bg-transparent border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800",
              )}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCategory(c)}
                className={cn(
                  "text-xs font-medium px-3 py-1.5 rounded-full border capitalize transition-colors",
                  activeCategory === c
                    ? "bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                    : "bg-transparent border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (templates ?? []).length === 0 ? (
          <div className="text-center py-16 text-sm text-gray-500">
            No templates available in this category yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(templates ?? []).map((t) => (
              <Card
                key={t.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelected(t)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-2xl">{t.icon ?? "✨"}</div>
                    {t.category && (
                      <Badge variant="outline" className="capitalize">
                        {t.category}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base mt-2">{t.name}</CardTitle>
                  {t.description && (
                    <CardDescription className="line-clamp-2 text-xs">
                      {t.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {t.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {t.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded"
                        >
                          <TagIcon className="h-2.5 w-2.5" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {t.node_count} nodes
                    </span>
                    <span>Used {t.use_count}×</span>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      cloneMutation.mutate({ id: t.id });
                    }}
                    disabled={cloneMutation.isPending}
                  >
                    {cloneMutation.isPending && cloneMutation.variables?.id === t.id ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Use this template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="text-2xl">{selected.icon ?? "✨"}</span>
                  {selected.name}
                </DialogTitle>
                <DialogDescription>
                  {selected.description ?? "No description provided."}
                </DialogDescription>
              </DialogHeader>
              <div className="text-xs text-gray-500 space-y-1">
                <div className="flex items-center gap-2">
                  <Layers className="h-3 w-3" />
                  {selected.node_count} nodes, {selected.edge_count} connections
                </div>
                {selected.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {selected.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded"
                      >
                        <TagIcon className="h-2.5 w-2.5" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Close
                </Button>
                <Button
                  onClick={() =>
                    cloneMutation.mutate({ id: selected.id })
                  }
                  disabled={cloneMutation.isPending}
                >
                  {cloneMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Use this template
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
