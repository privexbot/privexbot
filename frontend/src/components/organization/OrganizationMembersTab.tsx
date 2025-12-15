/**
 * Organization Members Tab Component
 *
 * Displays and manages organization members
 * Uses react-hook-form + Zod validation for adding members
 * Features: Add, Remove, Update roles
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Loader2, Users as UsersIcon, Shield, Crown, User, Mail, RefreshCw, X, Clock, CheckCircle2 } from "lucide-react";
import { organizationApi } from "@/api/organization";
import { invitationApi } from "@/api/invitation";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  createOrganizationInvitationSchema,
  type CreateOrganizationInvitationFormData,
} from "@/api/schemas/invitation.schema";
import type { Organization, OrganizationMember, OrganizationRole, Invitation } from "@/types/tenant";

interface OrganizationMembersTabProps {
  organization: Organization;
  onMembersChanged?: () => void;
}

export const OrganizationMembersTab = ({
  organization,
  onMembersChanged
}: OrganizationMembersTabProps) => {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Form for sending invitations
  const {
    register,
    handleSubmit,
    formState: { errors: formErrors, isSubmitting },
    reset: resetForm,
    setError: setFormError,
  } = useForm<CreateOrganizationInvitationFormData>({
    resolver: zodResolver(createOrganizationInvitationSchema),
    defaultValues: {
      email: "",
      role: "member",
    },
  });

  // Load members and invitations
  useEffect(() => {
    loadMembers();
    loadInvitations();
  }, [organization.id]);

  const loadMembers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const orgDetails = await organizationApi.get(organization.id);
      // Backend returns members as part of detailed response
      // @ts-ignore - OrganizationDetailed may have members
      setMembers(orgDetails.members || []);
    } catch (err: any) {
      console.error("[OrganizationMembersTab] Error loading members:", err);
      const errorMessage = err.response?.data?.detail || "Failed to load members";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const loadInvitations = async () => {
    try {
      setIsLoadingInvitations(true);
      const invites = await invitationApi.listOrganizationInvitations(organization.id, "pending");
      setInvitations(invites);
    } catch (err: any) {
      console.error("[OrganizationMembersTab] Error loading invitations:", err);
      // Don't show error for invitations, they're optional
    } finally {
      setIsLoadingInvitations(false);
    }
  };

  const handleSendInvitation = async (data: CreateOrganizationInvitationFormData) => {
    try {
      await invitationApi.createOrganizationInvitation(
        organization.id,
        data.email,
        data.role
      );

      toast({
        variant: "success",
        title: "Invitation sent",
        description: `An invitation has been sent to ${data.email}`,
      });

      resetForm();
      setShowAddMember(false);
      await loadInvitations();
      if (onMembersChanged) {
        onMembersChanged();
      }
    } catch (err: any) {
      console.error("[OrganizationMembersTab] Error sending invitation:", err);

      // Extract error message properly
      let errorMessage = "Failed to send invitation";
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
        title: "Failed to send invitation",
        description: errorMessage,
      });
    }
  };

  const handleResendInvitation = async (invitationId: string, email: string) => {
    try {
      await invitationApi.resendOrganizationInvitation(organization.id, invitationId);

      toast({
        variant: "success",
        title: "Invitation resent",
        description: `Invitation has been resent to ${email}`,
      });

      await loadInvitations();
    } catch (err: any) {
      console.error("[OrganizationMembersTab] Error resending invitation:", err);
      toast({
        variant: "destructive",
        title: "Failed to resend invitation",
        description: err.response?.data?.detail || "Please try again",
      });
    }
  };

  const handleCancelInvitation = async (invitationId: string, email: string) => {
    try {
      await invitationApi.cancelOrganizationInvitation(organization.id, invitationId);

      toast({
        variant: "success",
        title: "Invitation cancelled",
        description: `Invitation to ${email} has been cancelled`,
      });

      await loadInvitations();
    } catch (err: any) {
      console.error("[OrganizationMembersTab] Error cancelling invitation:", err);
      toast({
        variant: "destructive",
        title: "Failed to cancel invitation",
        description: err.response?.data?.detail || "Please try again",
      });
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: OrganizationRole) => {
    try {
      await organizationApi.updateMemberRole(organization.id, memberId, newRole);

      toast({
        variant: "success",
        title: "Role updated",
        description: "Member role has been updated successfully",
      });

      await loadMembers();
      if (onMembersChanged) {
        onMembersChanged();
      }
    } catch (err: any) {
      console.error("[OrganizationMembersTab] Error updating role:", err);
      toast({
        variant: "destructive",
        title: "Failed to update role",
        description: err.response?.data?.detail || "Please try again",
      });
    }
  };

  const handleRemoveMember = async (memberId: string, username: string) => {
    // Use toast-based confirmation instead of window.confirm
    const confirmed = await new Promise<boolean>((resolve) => {
      toast({
        title: "Remove member?",
        description: (
          <div className="space-y-3">
            <p>Are you sure you want to remove <strong>{username}</strong> from this organization?</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  resolve(true);
                }}
                className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded"
              >
                Remove
              </button>
              <button
                onClick={() => {
                  resolve(false);
                }}
                className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        ),
        duration: 10000, // 10 seconds to decide
      });
    });

    if (!confirmed) return;

    try {
      await organizationApi.removeMember(organization.id, memberId);

      toast({
        variant: "success",
        title: "Member removed",
        description: `${username} has been removed from the organization`,
      });

      await loadMembers();
      if (onMembersChanged) {
        onMembersChanged();
      }
    } catch (err: any) {
      console.error("[OrganizationMembersTab] Error removing member:", err);
      toast({
        variant: "destructive",
        title: "Failed to remove member",
        description: err.response?.data?.detail || "Please try again",
      });
    }
  };

  const getRoleIcon = (role: OrganizationRole) => {
    switch (role) {
      case "owner":
        return <Crown className="h-4 w-4 text-purple-400" />;
      case "admin":
        return <Shield className="h-4 w-4 text-blue-400" />;
      default:
        return <User className="h-4 w-4 text-gray-400" />;
    }
  };

  const getRoleBadgeColor = (role: OrganizationRole) => {
    switch (role) {
      case "owner":
        return "bg-purple-500 text-white";
      case "admin":
        return "bg-blue-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const canManageMembers = organization.user_role === "owner" || organization.user_role === "admin";

  return (
    <div className="space-y-4">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-md p-3">
          <p className="text-sm text-red-800 dark:text-red-300 font-medium">{error}</p>
        </div>
      )}

      {/* Send Invitation Section */}
      {canManageMembers && (
        <div className="space-y-3">
          {!showAddMember ? (
            <Button
              onClick={() => setShowAddMember(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
            >
              <Mail className="h-4 w-4 mr-2" />
              Send Invitation
            </Button>
          ) : (
            <form onSubmit={handleSubmit(handleSendInvitation)} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3 border border-gray-200 dark:border-gray-600">
              {/* Root Error Message */}
              {formErrors.root && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-md p-3">
                  <p className="text-sm text-red-800 dark:text-red-300 font-medium">{formErrors.root.message}</p>
                </div>
              )}

              <div>
                <label htmlFor="invite-email" className="block text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-2">
                  Email Address <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  id="invite-email"
                  type="email"
                  {...register("email")}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-50 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-colors"
                />
                {formErrors.email && (
                  <p className="mt-1.5 text-xs text-red-700 dark:text-red-400 font-medium">{formErrors.email.message}</p>
                )}
                {!formErrors.email && (
                  <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300">
                    An invitation email will be sent to this address
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="invite-role" className="block text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-2">
                  Role
                </label>
                <select
                  id="invite-role"
                  {...register("role")}
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-colors"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                {formErrors.role && (
                  <p className="mt-1.5 text-xs text-red-700 dark:text-red-400 font-medium">{formErrors.role.message}</p>
                )}
                <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300">
                  Note: Organizations can only have one owner
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
                >
                  {isSubmitting ? "Sending..." : "Send Invitation"}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowAddMember(false);
                    resetForm();
                  }}
                  variant="outline"
                  className="flex-1 border-gray-300 dark:border-gray-500 text-gray-900 dark:text-gray-50 hover:bg-gray-100 dark:hover:bg-gray-600 font-medium"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Pending Invitations Section */}
      {canManageMembers && invitations.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Pending Invitations</h3>
            <Badge variant="outline" className="text-xs text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-500">
              {invitations.length}
            </Badge>
          </div>

          <div className="space-y-2">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 flex items-center justify-between gap-4 border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    <Mail className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 dark:text-gray-50 font-medium truncate">{invitation.email}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge className="bg-yellow-600 text-white text-xs">
                        {invitation.invited_role}
                      </Badge>
                      <span className="text-xs text-gray-600 dark:text-gray-300">
                        Expires: {new Date(invitation.expires_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResendInvitation(invitation.id, invitation.email)}
                    className="border-gray-300 dark:border-gray-500 text-blue-700 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/30"
                    title="Resend invitation"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCancelInvitation(invitation.id, invitation.email)}
                    className="text-red-700 hover:text-red-800 border-red-300 hover:border-red-400 dark:border-red-700 dark:hover:border-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 dark:text-red-400 dark:hover:text-red-300"
                    title="Cancel invitation"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Members List */}
      {!isLoading && members.length === 0 && (
        <div className="text-center py-8">
          <UsersIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
          <p className="text-sm text-gray-700 dark:text-gray-200">No members found</p>
        </div>
      )}

      {!isLoading && members.length > 0 && (
        <div className="space-y-2">
          {members.map((member) => {
            const isCurrentUser = member.user_id === user?.id;
            const canEditMember = canManageMembers && !isCurrentUser;
            const canRemoveMember = canEditMember && member.role !== "owner";

            return (
              <div
                key={member.id}
                className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 flex items-center justify-between gap-4 border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    {getRoleIcon(member.role)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-gray-900 dark:text-gray-50 font-medium truncate">
                        {member.username}
                        {isCurrentUser && <span className="text-blue-600 dark:text-blue-400 ml-1">(You)</span>}
                      </p>
                    </div>
                    {member.email && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{member.email}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {canEditMember && member.role !== "owner" ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleUpdateRole(member.id, e.target.value as OrganizationRole)}
                      className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <Badge className={`${getRoleBadgeColor(member.role)} capitalize`}>
                      {member.role}
                    </Badge>
                  )}

                  {canRemoveMember && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveMember(member.id, member.username)}
                      className="text-red-700 hover:text-red-800 border-red-300 hover:border-red-400 dark:border-red-700 dark:hover:border-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
