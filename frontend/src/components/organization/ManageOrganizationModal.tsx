/**
 * Manage Organization Modal Component
 *
 * Comprehensive modal for managing an organization's workspaces
 * Displays all workspaces, allows CRUD operations
 */

import { useState, useEffect } from "react";
import { X, Plus, Edit, Trash2, Check, Loader2, Folder, Users } from "lucide-react";
import { organizationApi } from "@/api/organization";
import { workspaceApi } from "@/api/workspace";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/contexts/AppContext";
import { CreateWorkspaceModal } from "@/components/workspace/CreateWorkspaceModal";
import { EditWorkspaceModal } from "@/components/workspace/EditWorkspaceModal";
import { DeleteWorkspaceDialog } from "@/components/workspace/DeleteWorkspaceDialog";
import { OrganizationMembersTab } from "@/components/organization/OrganizationMembersTab";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Organization, Workspace } from "@/types/tenant";

interface ManageOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  organization: Organization;
  onSuccess?: () => void;
}

export const ManageOrganizationModal = ({
  isOpen,
  onClose,
  organization,
  onSuccess
}: ManageOrganizationModalProps) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(null);
  const { toast } = useToast();
  const { currentOrganization, currentWorkspace, switchOrganization, switchWorkspace, refreshData } = useApp();

  // Load workspaces when modal opens
  useEffect(() => {
    if (isOpen) {
      loadWorkspaces();
    }
  }, [isOpen, organization.id]);

  const loadWorkspaces = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const workspacesData = await organizationApi.getWorkspaces(organization.id);
      setWorkspaces(workspacesData);
    } catch (err: any) {
      console.error("[ManageOrganizationModal] Error loading workspaces:", err);
      const errorMessage = err.response?.data?.detail || "Failed to load workspaces";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Failed to load workspaces",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchWorkspace = async (workspaceId: string) => {
    try {
      // Check if workspace belongs to a different organization
      const isDifferentOrg = currentOrganization?.id !== organization.id;

      if (isDifferentOrg) {
        // Switch to the organization first, then the workspace
        await switchOrganization(organization.id, workspaceId);
        toast({
          variant: "success",
          title: "Organization and workspace switched",
          description: `Switched to ${organization.name} organization and selected workspace`,
        });
      } else {
        // Just switch workspace in current organization
        await switchWorkspace(workspaceId);
        toast({
          variant: "success",
          title: "Workspace switched",
          description: "You're now in a different workspace context",
        });
      }
      onClose();
    } catch (err: any) {
      console.error("[ManageOrganizationModal] Error switching workspace:", err);
      toast({
        variant: "destructive",
        title: "Failed to switch workspace",
        description: err.message || "Please try again",
      });
    }
  };

  const handleDeleteSuccess = async () => {
    await loadWorkspaces();
    if (onSuccess) {
      onSuccess();
    }
  };

  if (!isOpen) return null;

  const canCreateWorkspace = organization.user_role === "admin" || organization.user_role === "owner";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 dark:bg-black/80"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-[#374151] rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-600">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-200 dark:border-gray-600 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">
              Manage Workspaces
            </h2>
            <p className="text-sm text-gray-700 dark:text-gray-200 mt-1">
              {organization.name}
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
        <Tabs defaultValue="workspaces" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-4 grid w-auto grid-cols-2 bg-gray-100 dark:bg-gray-700">
            <TabsTrigger value="workspaces" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-900 dark:text-gray-50">
              <Folder className="h-4 w-4 mr-2" />
              Workspaces
            </TabsTrigger>
            <TabsTrigger value="members" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-900 dark:text-gray-50">
              <Users className="h-4 w-4 mr-2" />
              Members
            </TabsTrigger>
          </TabsList>

          {/* Workspaces Tab */}
          <TabsContent value="workspaces" className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 mt-0">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-md p-3">
                <p className="text-sm text-red-800 dark:text-red-300 font-medium">{error}</p>
              </div>
            )}

            {/* Create Workspace Button */}
            {canCreateWorkspace && (
              <Button
                onClick={() => setShowCreateWorkspace(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Workspace
              </Button>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            )}

            {/* Workspaces List */}
            {!isLoading && workspaces.length === 0 && (
              <div className="text-center py-8">
                <Folder className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                <p className="text-sm text-gray-700 dark:text-gray-200">No workspaces found</p>
              </div>
            )}

            {!isLoading && workspaces.length > 0 && (
              <div className="space-y-3">
                {workspaces.map((workspace) => {
                  const isActive = workspace.id === currentWorkspace?.id;
                  const canEdit = workspace.user_role === "admin" || organization.user_role === "admin" || organization.user_role === "owner";
                  const canDelete = !workspace.is_default && (workspace.user_role === "admin" || organization.user_role === "admin" || organization.user_role === "owner");

                  return (
                    <div
                      key={workspace.id}
                      className={`bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border transition-all ${
                        isActive
                          ? "border-blue-600 shadow-md ring-2 ring-blue-600"
                          : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="text-gray-900 dark:text-gray-50 font-medium truncate">
                              {workspace.name}
                            </h3>
                            {isActive && (
                              <Badge className="bg-blue-600 text-white text-xs">
                                <Check className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            )}
                            {workspace.is_default && (
                              <Badge variant="outline" className="text-xs text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-500">
                                Default
                              </Badge>
                            )}
                          </div>
                          {workspace.description && (
                            <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">
                              {workspace.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-300">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {workspace.member_count || 0} members
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!isActive && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSwitchWorkspace(workspace.id)}
                              className="text-xs border-gray-300 dark:border-gray-500 text-gray-900 dark:text-gray-50 hover:bg-gray-100 dark:hover:bg-gray-600 font-medium"
                            >
                              Switch to
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingWorkspace(workspace)}
                              className="text-xs border-gray-300 dark:border-gray-500 text-gray-900 dark:text-gray-50 hover:bg-gray-100 dark:hover:bg-gray-600"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeletingWorkspace(workspace)}
                              className="text-xs text-red-700 hover:text-red-800 border-red-300 hover:border-red-400 dark:border-red-700 dark:hover:border-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="flex-1 overflow-y-auto p-4 sm:p-5 mt-0">
            <OrganizationMembersTab
              organization={organization}
              onMembersChanged={onSuccess}
            />
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-gray-200 dark:border-gray-600 flex-shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-gray-300 dark:border-gray-500 text-gray-900 dark:text-gray-50 hover:bg-gray-100 dark:hover:bg-gray-600 font-medium"
          >
            Close
          </Button>
        </div>
      </div>

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={showCreateWorkspace}
        onClose={() => setShowCreateWorkspace(false)}
        organizationId={organization.id}
        onWorkspaceCreated={async (workspace) => {
          // IMPORTANT: Refresh data FIRST so workspace is in context
          await refreshData();
          await loadWorkspaces();
          // Now workspace should be available for switching
          await handleSwitchWorkspace(workspace.id);
        }}
        onSuccess={loadWorkspaces}
      />

      {/* Edit Workspace Modal */}
      {editingWorkspace && (
        <EditWorkspaceModal
          isOpen={!!editingWorkspace}
          onClose={() => setEditingWorkspace(null)}
          workspace={editingWorkspace}
          organizationId={organization.id}
          onSuccess={async () => {
            await loadWorkspaces();
            setEditingWorkspace(null);
            if (onSuccess) {
              onSuccess();
            }
          }}
        />
      )}

      {/* Delete Workspace Dialog */}
      {deletingWorkspace && (
        <DeleteWorkspaceDialog
          isOpen={!!deletingWorkspace}
          onClose={() => setDeletingWorkspace(null)}
          workspace={deletingWorkspace}
          organizationId={organization.id}
          onSuccess={async () => {
            await handleDeleteSuccess();
            setDeletingWorkspace(null);
          }}
        />
      )}
    </div>
  );
};
