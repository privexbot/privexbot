/**
 * WrongWorkspaceScreen
 *
 * Rendered on a resource detail page when the resource the URL points at
 * belongs to a workspace other than the user's currently active one. Replaces
 * the older toast + redirect-to-list pattern that flashed an error and lost
 * context.
 *
 * Behaviour:
 * - If the resource's workspace is one the user belongs to in the active org,
 *   offer a one-click "Switch to <workspace>" button that flips the workspace
 *   context (the calling page will re-render with the resource visible).
 * - Otherwise, just offer "Back to {parent list}" — we deliberately don't
 *   try to switch organization too; that's a heavier transition and the user
 *   can pick the right org from the org switcher.
 */

import { useNavigate } from "react-router-dom";
import { ArrowLeft, FolderX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useApp } from "@/contexts/AppContext";

type ResourceKind = "chatbot" | "knowledge-base" | "chatflow" | "chatflow-draft";

interface WrongWorkspaceScreenProps {
  resourceKind: ResourceKind;
  resourceWorkspaceId?: string;
  fallbackPath: string;
}

const RESOURCE_LABEL: Record<ResourceKind, { singular: string; list: string }> = {
  chatbot: { singular: "chatbot", list: "Chatbots" },
  "knowledge-base": { singular: "knowledge base", list: "Knowledge Bases" },
  chatflow: { singular: "chatflow", list: "Studio" },
  "chatflow-draft": { singular: "chatflow draft", list: "Studio" },
};

export function WrongWorkspaceScreen({
  resourceKind,
  resourceWorkspaceId,
  fallbackPath,
}: WrongWorkspaceScreenProps) {
  const navigate = useNavigate();
  const { workspaces, switchWorkspace } = useApp();
  const labels = RESOURCE_LABEL[resourceKind];

  const targetWorkspace = resourceWorkspaceId
    ? workspaces.find((w) => w.id === resourceWorkspaceId)
    : undefined;

  const handleSwitch = async () => {
    if (!targetWorkspace) return;
    try {
      await switchWorkspace(targetWorkspace.id);
    } catch {
      // switchWorkspace already surfaces its own error; fall through to the
      // fallback button so the user has an out.
    }
  };

  return (
    <DashboardLayout>
      <div className="w-full bg-background min-h-screen">
        <div className="px-4 sm:px-6 lg:pl-6 lg:pr-8 xl:pl-8 xl:pr-12 max-w-3xl mx-auto py-12 md:py-16">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-8 md:p-10 text-center">
            <FolderX
              className="h-10 w-10 text-gray-400 dark:text-gray-500 mx-auto mb-4"
              strokeWidth={1.75}
            />
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white font-manrope mb-3">
              {targetWorkspace
                ? `This ${labels.singular} lives in another workspace`
                : `This ${labels.singular} isn't available here`}
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-manrope leading-relaxed mb-8">
              {targetWorkspace
                ? `It belongs to "${targetWorkspace.name}" in your current organization. Switch to that workspace to view it.`
                : `It belongs to a workspace outside your active organization. Pick the right organization from the switcher, or head back to your ${labels.list.toLowerCase()}.`}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-center">
              {targetWorkspace && (
                <Button
                  onClick={handleSwitch}
                  className="font-manrope bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
                >
                  Switch to {targetWorkspace.name}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  navigate(fallbackPath);
                }}
                className="font-manrope border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to {labels.list}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
