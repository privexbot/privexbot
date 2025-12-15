/**
 * Create Organization Modal Component
 *
 * Discord-style modal for creating new organizations
 * Uses react-hook-form + Zod validation for proper form handling
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { organizationApi } from "@/api/organization";
import { useToast } from "@/hooks/use-toast";
import {
  createOrganizationSchema,
  type CreateOrganizationFormData,
} from "@/api/schemas/organization.schema";
import type { Organization } from "@/types/tenant";

interface CreateOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onOrganizationCreated?: (organization: Organization) => void;
}

export const CreateOrganizationModal = ({
  isOpen,
  onClose,
  onSuccess,
  onOrganizationCreated
}: CreateOrganizationModalProps) => {
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError: setFormError,
  } = useForm<CreateOrganizationFormData>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      name: "",
      billing_email: "",
    },
  });

  const onSubmit = async (data: CreateOrganizationFormData) => {
    try {
      const newOrganization = await organizationApi.create(data);

      toast({
        variant: "success",
        title: "Organization created successfully",
        description: `"${newOrganization.name}" is now active and ready to use.`,
      });

      reset(); // Reset form

      // Call organization created callback (for auto-switching)
      if (onOrganizationCreated) {
        onOrganizationCreated(newOrganization);
      }

      // Call success callback (for refreshing data)
      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (err: any) {
      console.error("[CreateOrganizationModal] Error creating organization:", err);

      // Extract error message properly
      let errorMessage = "Failed to create organization";
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

      // Set form-level error
      setFormError("root", {
        type: "manual",
        message: errorMessage,
      });

      toast({
        variant: "destructive",
        title: "Failed to create organization",
        description: errorMessage,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 dark:bg-black/80"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-[#374151] rounded-lg shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-600">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-200 dark:border-gray-600">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">
            Create Organization
          </h2>
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
              <p className="text-sm text-red-800 dark:text-red-300 font-medium">{errors.root.message}</p>
            </div>
          )}

          {/* Organization Name */}
          <div>
            <label htmlFor="organization-name" className="block text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-2">
              Organization Name <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <input
              id="organization-name"
              type="text"
              {...register("name")}
              placeholder="e.g., Acme Corp"
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-50 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-colors"
            />
            {errors.name && (
              <p className="mt-1.5 text-xs text-red-700 dark:text-red-400 font-medium">{errors.name.message}</p>
            )}
            {!errors.name && (
              <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300">
                This is the name that will appear in your organization switcher
              </p>
            )}
          </div>

          {/* Billing Email */}
          <div>
            <label htmlFor="organization-billing-email" className="block text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-2">
              Billing Email <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <input
              id="organization-billing-email"
              type="email"
              {...register("billing_email")}
              placeholder="billing@example.com"
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-50 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-colors"
            />
            {errors.billing_email && (
              <p className="mt-1.5 text-xs text-red-700 dark:text-red-400 font-medium">{errors.billing_email.message}</p>
            )}
            {!errors.billing_email && (
              <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300">
                Email address for billing and subscription notifications
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {isSubmitting ? "Creating..." : "Create Organization"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
