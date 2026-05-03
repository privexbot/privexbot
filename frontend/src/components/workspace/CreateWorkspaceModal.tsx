/**
 * Create Workspace Modal Component
 *
 * Discord-style modal for creating new workspaces within an organization
 * Uses react-hook-form + Zod validation for proper form handling
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { workspaceApi } from "@/api/workspace";
import { handleApiError } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import {
  createWorkspaceSchema,
  type CreateWorkspaceFormData,
} from "@/api/schemas/workspace.schema";
import type { Workspace } from "@/types/tenant";

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  onSuccess?: () => void;
  onWorkspaceCreated?: (workspace: Workspace) => void;
}

export const CreateWorkspaceModal = ({
  isOpen,
  onClose,
  organizationId,
  onSuccess,
  onWorkspaceCreated,
}: CreateWorkspaceModalProps) => {
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError: setFormError,
  } = useForm<CreateWorkspaceFormData>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const onSubmit = async (data: CreateWorkspaceFormData) => {
    try {
      const newWorkspace = await workspaceApi.create(organizationId, data);

      toast({
        variant: "success",
        title: "Workspace created successfully",
        description: `"${newWorkspace.name}" is now active and ready to use.`,
      });

      reset(); // Reset form

      // Call workspace created callback (for auto-switching)
      if (onWorkspaceCreated) {
        onWorkspaceCreated(newWorkspace);
      }

      // Call success callback (for refreshing data)
      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (err: any) {
      console.error("[CreateWorkspaceModal] Error creating workspace:", err);

      const errorMessage = handleApiError(err);

      setFormError("root", {
        type: "manual",
        message: errorMessage,
      });

      toast({
        variant: "destructive",
        title: "Failed to create workspace",
        description: errorMessage,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 dark:bg-black/80" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700/50">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white font-manrope">Create Workspace</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 sm:p-5 space-y-5">
          {/* Root Error Message */}
          {errors.root && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-800 dark:text-red-300 font-medium font-manrope break-words">{errors.root.message}</p>
            </div>
          )}

          {/* Workspace Name */}
          <div>
            <label
              htmlFor="workspace-name"
              className="block text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-2 font-manrope"
            >
              Workspace Name <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <input
              id="workspace-name"
              type="text"
              {...register("name")}
              placeholder="e.g., Marketing Team"
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-colors font-manrope"
            />
            {errors.name && (
              <p className="mt-1.5 text-xs text-red-700 dark:text-red-400 font-medium font-manrope">{errors.name.message}</p>
            )}
            {!errors.name && (
              <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400 font-manrope">
                This is the name that will appear in your workspace switcher
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="workspace-description"
              className="block text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-2 font-manrope"
            >
              Description
            </label>
            <textarea
              id="workspace-description"
              {...register("description")}
              placeholder="What's this workspace for?"
              rows={3}
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none transition-colors font-manrope"
            />
            {errors.description && (
              <p className="mt-1.5 text-xs text-red-700 dark:text-red-400 font-medium font-manrope">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 transition-colors font-manrope"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm font-manrope"
            >
              {isSubmitting ? "Creating..." : "Create Workspace"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
