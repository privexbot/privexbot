/**
 * Manage Workspace Modal Component
 *
 * Comprehensive modal for managing workspace settings and members
 * Features tabs for Settings and Members
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Settings, Users, Loader2 } from "lucide-react";
import { workspaceApi } from "@/api/workspace";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/contexts/AppContext";
import { WorkspaceMembersTab } from "@/components/workspace/WorkspaceMembersTab";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  editWorkspaceSchema,
  type EditWorkspaceFormData,
} from "@/api/schemas/workspace.schema";
import type { Workspace } from "@/types/tenant";

interface ManageWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
  organizationId: string;
  onSuccess?: () => void;
}

export const ManageWorkspaceModal = ({
  isOpen,
  onClose,
  workspace,
  organizationId,
  onSuccess
}: ManageWorkspaceModalProps) => {
  const { toast } = useToast();
  const { refreshData } = useApp();
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors: formErrors, isDirty },
    reset,
    setError: setFormError,
  } = useForm<EditWorkspaceFormData>({
    resolver: zodResolver(editWorkspaceSchema),
    defaultValues: {
      name: workspace.name,
      description: workspace.description || "",
    },
  });

  // Update form when workspace changes
  useEffect(() => {
    if (isOpen) {
      reset({
        name: workspace.name,
        description: workspace.description || "",
      });
    }
  }, [isOpen, workspace, reset]);

  const handleSaveSettings = async (data: EditWorkspaceFormData) => {
    try {
      setIsSaving(true);
      await workspaceApi.update(organizationId, workspace.id, data);

      toast({
        variant: "success",
        title: "Workspace updated",
        description: "Settings have been saved successfully",
      });

      // Refresh data to show updated workspace
      await refreshData();

      if (onSuccess) {
        onSuccess();
      }

      // Reset form dirty state
      reset(data);
    } catch (err: any) {
      console.error("[ManageWorkspaceModal] Error updating workspace:", err);

      let errorMessage = "Failed to update workspace";
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          errorMessage = detail.map((e: any) => e.msg || e.message || String(e)).join(', ');
        } else if (typeof detail === 'object') {
          errorMessage = detail.msg || detail.message || JSON.stringify(detail);
        }
      }

      setFormError("root", {
        type: "manual",
        message: errorMessage,
      });

      toast({
        variant: "destructive",
        title: "Failed to update workspace",
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const canEditSettings = workspace.user_role === "admin" || workspace.user_role === "editor";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 dark:bg-black/80"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700/50 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white font-manrope">
              Manage Workspace
            </h2>
            <p className="text-sm text-gray-700 dark:text-gray-400 mt-1 font-manrope">
              {workspace.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content with Tabs */}
        <Tabs defaultValue="settings" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-4 grid w-auto grid-cols-2 bg-gray-100 dark:bg-gray-700/50">
            <TabsTrigger value="settings" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-900 dark:text-white font-manrope">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="members" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-900 dark:text-white font-manrope">
              <Users className="h-4 w-4 mr-2" />
              Members
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings" className="flex-1 overflow-y-auto p-4 sm:p-5 mt-0">
            <form onSubmit={handleSubmit(handleSaveSettings)} className="space-y-5">
              {/* Root Error Message */}
              {formErrors.root && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-md p-3">
                  <p className="text-sm text-red-800 dark:text-red-300 font-medium font-manrope">{formErrors.root.message}</p>
                </div>
              )}

              {/* Workspace Name */}
              <div>
                <label htmlFor="workspace-name" className="block text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-2 font-manrope">
                  Workspace Name <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  id="workspace-name"
                  type="text"
                  {...register("name")}
                  disabled={!canEditSettings}
                  placeholder="Enter workspace name"
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-manrope"
                />
                {formErrors.name && (
                  <p className="mt-1.5 text-xs text-red-700 dark:text-red-400 font-medium font-manrope">{formErrors.name.message}</p>
                )}
              </div>

              {/* Workspace Description */}
              <div>
                <label htmlFor="workspace-description" className="block text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-2 font-manrope">
                  Description (Optional)
                </label>
                <textarea
                  id="workspace-description"
                  {...register("description")}
                  disabled={!canEditSettings}
                  placeholder="Enter workspace description"
                  rows={3}
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none transition-colors font-manrope"
                />
                {formErrors.description && (
                  <p className="mt-1.5 text-xs text-red-700 dark:text-red-400 font-medium font-manrope">{formErrors.description.message}</p>
                )}
              </div>

              {/* Workspace Info */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2 border border-gray-200 dark:border-gray-600">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400 font-manrope">Your Role</span>
                  <span className="text-gray-900 dark:text-white capitalize font-medium font-manrope">{workspace.user_role}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400 font-manrope">Created</span>
                  <span className="text-gray-900 dark:text-white font-medium font-manrope">
                    {new Date(workspace.created_at).toLocaleDateString()}
                  </span>
                </div>
                {workspace.is_default && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400 font-manrope">Type</span>
                    <span className="text-blue-700 dark:text-blue-400 font-medium font-manrope">Default Workspace</span>
                  </div>
                )}
              </div>

              {/* Save Button */}
              {canEditSettings && (
                <div className="flex gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={!isDirty || isSaving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm disabled:opacity-50 font-manrope"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => reset()}
                    disabled={!isDirty || isSaving}
                    className="flex-1 border-gray-300 dark:border-gray-500 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600 font-medium font-manrope"
                  >
                    Reset
                  </Button>
                </div>
              )}

              {!canEditSettings && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-800 rounded-md p-3">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium font-manrope">
                    You need admin or editor role to edit workspace settings
                  </p>
                </div>
              )}
            </form>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="flex-1 overflow-y-auto p-4 sm:p-5 mt-0">
            <WorkspaceMembersTab
              workspace={workspace}
              organizationId={organizationId}
              onMembersChanged={onSuccess}
            />
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-gray-200 dark:border-gray-700/50 flex-shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-gray-300 dark:border-gray-500 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600 font-medium font-manrope"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
