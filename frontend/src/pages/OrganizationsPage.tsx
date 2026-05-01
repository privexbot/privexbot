/**
 * Organizations Management Page
 *
 * WHY: Centralized organization and workspace management
 * HOW: Tabs-based UI with CRUD operations
 *
 * FEATURES:
 * - List all user's organizations
 * - Create/Edit/Delete organizations (role-based)
 * - View and manage workspaces per organization
 * - Switch organization/workspace context
 * - Member management (future enhancement)
 *
 * PERMISSIONS:
 * - View: All members
 * - Create org: All authenticated users
 * - Edit org: Admin/Owner
 * - Delete org: Owner only
 * - Create workspace: Admin/Owner
 * - Edit workspace: Workspace admin or Org admin/owner
 * - Delete workspace: Workspace admin or Org admin/owner (not default)
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Plus,
  Users,
  Folder,
  Settings,
  Trash2,
  Edit,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { organizationApi } from "@/api/organization";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreateOrganizationModal } from "@/components/organization/CreateOrganizationModal";
import { EditOrganizationModal } from "@/components/organization/EditOrganizationModal";
import { DeleteOrganizationDialog } from "@/components/organization/DeleteOrganizationDialog";
import { ManageOrganizationModal } from "@/components/organization/ManageOrganizationModal";
import type { Organization, Workspace } from "@/types/tenant";

export function OrganizationsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    organizations,
    currentOrganization,
    workspaces,
    currentWorkspace,
    switchOrganization,
    switchWorkspace,
    refreshData,
    hasPermission,
    isLoading: contextLoading,
  } = useApp();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateOrganization, setShowCreateOrganization] = useState(false);
  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null);
  const [deletingOrganization, setDeletingOrganization] = useState<Organization | null>(null);
  const [managingOrganization, setManagingOrganization] = useState<Organization | null>(null);

  const handleSwitchOrganization = async (orgId: string) => {
    try {
      setIsLoading(true);
      await switchOrganization(orgId);
      toast({
        variant: "success",
        title: "Organization switched",
        description: "You're now in a different organization context",
      });
      navigate("/dashboard");
    } catch (err: any) {
      console.error("[OrganizationsPage] Error switching organization:", err);
      toast({
        variant: "destructive",
        title: "Failed to switch organization",
        description: err.message || "Please try again",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchWorkspace = async (workspaceId: string) => {
    try {
      setIsLoading(true);
      await switchWorkspace(workspaceId);
      toast({
        variant: "success",
        title: "Workspace switched",
        description: "You're now in a different workspace context",
      });
      navigate("/dashboard");
    } catch (err: any) {
      console.error("[OrganizationsPage] Error switching workspace:", err);
      toast({
        variant: "destructive",
        title: "Failed to switch workspace",
        description: err.message || "Please try again",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-500 text-white";
      case "admin":
        return "bg-blue-500 text-white";
      case "member":
        return "bg-gray-500 text-white";
      default:
        return "bg-gray-400 text-white";
    }
  };

  if (contextLoading && organizations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-full overflow-y-auto bg-white dark:bg-[#1F2937] p-4 sm:p-6 lg:p-8">
        <div className="space-y-6">
        {/* Header - Improved responsive layout */}
        <div className="flex flex-col sm:flex-row sm:items-start md:items-center sm:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-50 truncate">
              Organizations
            </h1>
            <p className="text-sm md:text-base text-gray-700 dark:text-gray-200 mt-1">
              Manage your organizations and workspaces
            </p>
          </div>
          <Button
            onClick={() => setShowCreateOrganization(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px] font-medium shadow-sm whitespace-nowrap flex-shrink-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Organization
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Organizations Grid - Improved responsive breakpoints for tablets */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
          {organizations.map((org) => {
            const isActive = org.id === currentOrganization?.id;
            const canEdit = org.user_role === "admin" || org.user_role === "owner";
            const canDelete = org.user_role === "owner";

            return (
              <Card
                key={org.id}
                className={`relative transition-all bg-white dark:bg-[#374151] border-gray-200 dark:border-gray-600 ${
                  isActive ? "ring-2 ring-blue-600 shadow-lg" : "hover:shadow-md hover:border-gray-300 dark:hover:border-gray-500"
                }`}
              >
                {isActive && (
                  <div className="absolute top-3 right-3 z-10">
                    <Badge className="bg-blue-600 text-white text-xs whitespace-nowrap">
                      <Check className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-3 p-4 sm:p-5 md:p-6">
                  {/* Added proper spacing and pr to prevent overlap with Active badge */}
                  <div className="flex items-start gap-3 pr-16 md:pr-20">
                    <Building2 className="h-6 w-6 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-1" />
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base md:text-lg truncate text-gray-900 dark:text-gray-50 pr-1">
                        {org.name}
                      </CardTitle>
                      <Badge className={`mt-1.5 text-xs whitespace-nowrap ${getRoleBadgeColor(org.user_role)}`}>
                        {org.user_role}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 p-4 sm:p-5 md:p-6 pt-0">
                  {/* Stats - Improved spacing and layout for tablets */}
                  <div className="grid grid-cols-2 gap-3 md:gap-4 text-xs md:text-sm">
                    <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200 min-w-0">
                      <Users className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate font-medium">{org.member_count || 0} members</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200 min-w-0">
                      <Folder className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate font-medium">{org.workspace_count || 0} workspaces</span>
                    </div>
                  </div>

                  {/* Actions - Improved responsive layout for tablets */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2">
                    {/* Switch Button - Only shown when not active, spans full width on mobile */}
                    {!isActive && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleSwitchOrganization(org.id)}
                        disabled={isLoading}
                        className="col-span-2 md:col-span-1 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all duration-200"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Switch to"
                        )}
                      </Button>
                    )}

                    {/* Manage Button - Spans properly based on active state */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setManagingOrganization(org)}
                      className={`min-h-[44px] border-gray-300 dark:border-gray-500 text-gray-900 dark:text-gray-50 hover:bg-gray-100 hover:border-gray-400 dark:hover:bg-gray-600 dark:hover:border-gray-400 font-medium transition-all duration-200 ${
                        isActive ? "col-span-2 md:col-span-3" : "col-span-1"
                      }`}
                    >
                      <Settings className="h-4 w-4 mr-1.5 flex-shrink-0" />
                      <span>Manage</span>
                    </Button>

                    {/* Edit Button - Only shown for admins/owners */}
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingOrganization(org)}
                        className="col-span-1 min-h-[44px] border-gray-300 dark:border-gray-500 text-gray-900 dark:text-gray-50 hover:bg-gray-100 hover:border-gray-400 dark:hover:bg-gray-600 dark:hover:border-gray-400 font-medium transition-all duration-200"
                      >
                        <Edit className="h-4 w-4 md:mr-1.5 flex-shrink-0" />
                        <span className="hidden md:inline">Edit</span>
                      </Button>
                    )}

                    {/* Delete Button - Only shown for owners */}
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeletingOrganization(org)}
                        className="col-span-1 min-h-[44px] text-red-700 hover:text-red-800 border-red-300 hover:border-red-400 dark:border-red-700 dark:hover:border-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 dark:text-red-400 dark:hover:text-red-300 font-medium transition-all duration-200"
                      >
                        <Trash2 className="h-4 w-4 md:mr-1.5 flex-shrink-0" />
                        <span className="hidden md:inline">Delete</span>
                      </Button>
                    )}
                  </div>

                  {/* Workspaces Preview (if active) - Improved spacing for tablets */}
                  {isActive && workspaces.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <div className="text-xs text-gray-700 dark:text-gray-200 mb-2.5 font-semibold uppercase tracking-wide">
                        Workspaces
                      </div>
                      <div className="space-y-1.5">
                        {workspaces.slice(0, 2).map((ws) => (
                          <button
                            key={ws.id}
                            type="button"
                            className="w-full flex items-center justify-between text-sm p-2.5 md:p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-all duration-200 min-h-[44px]"
                            onClick={() => handleSwitchWorkspace(ws.id)}
                          >
                            <span className="truncate text-gray-900 dark:text-gray-50 font-medium text-left">
                              {ws.name}
                            </span>
                            {ws.id === currentWorkspace?.id && (
                              <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2" />
                            )}
                          </button>
                        ))}
                      </div>
                      {workspaces.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-2 min-h-[44px] text-xs md:text-sm text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-50 hover:bg-gray-100 dark:hover:bg-gray-600 font-medium transition-all duration-200"
                          onClick={() => setManagingOrganization(org)}
                        >
                          View all {workspaces.length} workspaces
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Empty State - Improved responsive layout */}
        {organizations.length === 0 && (
          <Card className="p-8 md:p-12 text-center bg-white dark:bg-[#374151] border-gray-200 dark:border-gray-600">
            <Building2 className="h-12 w-12 md:h-14 md:w-14 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg md:text-xl font-semibold mb-2 text-gray-900 dark:text-gray-50">
              No organizations yet
            </h3>
            <p className="text-sm md:text-base text-gray-700 dark:text-gray-200 mb-6 max-w-md mx-auto">
              Create your first organization to get started
            </p>
            <Button
              onClick={() => setShowCreateOrganization(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm min-h-[44px]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Organization
            </Button>
          </Card>
        )}

        {/* Manage Organization Modal (Workspaces) */}
        {managingOrganization && (
          <ManageOrganizationModal
            isOpen={!!managingOrganization}
            onClose={() => setManagingOrganization(null)}
            organization={managingOrganization}
            onSuccess={refreshData}
          />
        )}

        {/* Create Organization Modal */}
        <CreateOrganizationModal
          isOpen={showCreateOrganization}
          onClose={() => setShowCreateOrganization(false)}
          onOrganizationCreated={async (organization) => {
            await refreshData();
            await handleSwitchOrganization(organization.id);
          }}
          onSuccess={refreshData}
        />

        {/* Edit Organization Modal */}
        {editingOrganization && (
          <EditOrganizationModal
            isOpen={!!editingOrganization}
            onClose={() => setEditingOrganization(null)}
            organization={editingOrganization}
            onSuccess={refreshData}
          />
        )}

        {/* Delete Organization Dialog */}
        {deletingOrganization && (
          <DeleteOrganizationDialog
            isOpen={!!deletingOrganization}
            onClose={() => setDeletingOrganization(null)}
            organization={deletingOrganization}
            onSuccess={async () => {
              await refreshData();
              // If deleted org was active, switch to first available org
              if (deletingOrganization.id === currentOrganization?.id && organizations.length > 1) {
                const nextOrg = organizations.find(o => o.id !== deletingOrganization.id);
                if (nextOrg) {
                  await handleSwitchOrganization(nextOrg.id);
                }
              }
            }}
          />
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}
