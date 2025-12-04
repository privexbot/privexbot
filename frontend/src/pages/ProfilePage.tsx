/**
 * Profile Page (Protected)
 *
 * WHY: Manage user profile settings, preferences, and account information
 * HOW: Comprehensive profile management with update and delete functionality
 *
 * FEATURES:
 * - Profile information editing (username)
 * - Authentication methods display
 * - Account deletion with proper warnings
 * - Only visible in Personal organization
 * - Consistent with dashboard design
 * - Type-safe implementation
 * - Proper validation and error handling
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  User,
  Save,
  Trash2,
  AlertTriangle,
  Shield,
  Mail,
  Wallet,
  Key,
  Calendar,
  ArrowLeft,
  UserCheck
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { authApi } from "@/api/auth";
import type { UserProfile } from "@/types/auth";
import { updateProfileSchema, type UpdateProfileFormData } from "@/api/schemas/user.schema";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";

export function ProfilePage() {
  const navigate = useNavigate();
  const { } = useAuth();
  const { currentOrganization } = useApp();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    setValue,
  } = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
  });

  // Check if user is in their personal organization
  const isPersonalOrg = currentOrganization?.name?.includes("'s Organization") ?? false;

  // Load user profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoadingProfile(true);
        setError(null);

        const profile = await authApi.getCurrentUser();
        setUserProfile(profile);

        // Set form default values
        setValue("username", profile.username);
        reset({ username: profile.username });
      } catch (err: any) {
        console.error("Failed to load profile:", err);
        setError("Failed to load profile information");
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadProfile();
  }, [setValue, reset]);

  // Handle profile update
  const handleProfileUpdate = async (data: UpdateProfileFormData) => {
    try {
      setIsUpdating(true);
      setError(null);

      const updatedProfile = await authApi.updateProfile({
        username: data.username,
      });

      setUserProfile(updatedProfile);
      reset(data); // Reset form state to mark as not dirty

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (err: any) {
      console.error("Profile update failed:", err);
      const errorMessage = err.response?.data?.detail || "Failed to update profile";
      setError(errorMessage);

      toast({
        title: "Update failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle account deletion
  const handleAccountDelete = async () => {
    try {
      setIsDeleting(true);

      await authApi.deleteAccount();

      toast({
        title: "Account deleted",
        description: "Your account has been deleted successfully.",
      });

      // Clear local storage and redirect to home
      localStorage.clear();
      window.location.href = "/";
    } catch (err: any) {
      console.error("Account deletion failed:", err);
      const errorMessage = err.response?.data?.detail || "Failed to delete account";

      toast({
        title: "Deletion failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  // Get auth method icon and label
  const getAuthMethodInfo = (provider: string) => {
    switch (provider) {
      case "email":
        return { icon: Mail, label: "Email" };
      case "evm":
        return { icon: Wallet, label: "EVM Wallet" };
      case "solana":
        return { icon: Wallet, label: "Solana Wallet" };
      case "cosmos":
        return { icon: Wallet, label: "Cosmos Wallet" };
      default:
        return { icon: Key, label: provider };
    }
  };

  // Redirect if not in personal organization
  if (!isPersonalOrg) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto py-8 px-4">
          <Alert className="bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="text-yellow-700 dark:text-yellow-300 font-manrope">
              Profile settings are only available in your personal organization. Please switch to your personal organization to access this page.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={() => navigate("/dashboard")} className="font-manrope">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoadingProfile) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="space-y-6">
            {/* Header Skeleton */}
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-96"></div>
            </div>

            {/* Card Skeletons */}
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 font-manrope">
            Profile Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 font-manrope">
            Manage your personal account settings and authentication methods
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-700 dark:text-red-300 font-manrope">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Profile Information */}
        <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-manrope">
              <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Profile Information
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope">
              Update your personal information and display name
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(handleProfileUpdate)} className="space-y-4">
              <div>
                <Label htmlFor="username" className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                  Username
                </Label>
                <Input
                  id="username"
                  {...register("username")}
                  className="mt-1 h-10 bg-white dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg font-manrope placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  disabled={isUpdating}
                />
                {errors.username && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400 font-manrope">
                    {errors.username.message}
                  </p>
                )}
              </div>

              {/* Account Information */}
              <div className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">
                    User ID
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {userProfile?.id}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">
                    Account Status
                  </span>
                  <Badge variant="default" className="bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-200">
                    <UserCheck className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">
                    Member Since
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-manrope flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {userProfile ? new Date(userProfile.created_at).toLocaleDateString() : "—"}
                  </span>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={!isDirty || isUpdating}
                  className="font-manrope bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white disabled:opacity-50"
                >
                  {isUpdating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Authentication Methods */}
        <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-manrope">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Authentication Methods
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope">
              Manage your login methods and security settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {userProfile?.auth_methods?.length ? (
                userProfile.auth_methods.map((method, index) => {
                  const { icon: Icon, label } = getAuthMethodInfo(method.provider);
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                            {label}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 font-manrope">
                            {method.provider_id}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Linked {new Date(method.linked_at).toLocaleDateString()}
                      </Badge>
                    </div>
                  );
                })
              ) : (
                <p className="text-gray-600 dark:text-gray-400 text-sm font-manrope">
                  No authentication methods found
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="bg-white dark:bg-gray-800/50 border border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-200 font-manrope">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope">
              Irreversible and destructive actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-200 font-manrope mb-2">
                Delete Account
              </h4>
              <p className="text-sm text-red-700 dark:text-red-300 font-manrope mb-4">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>

              <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="font-manrope border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-gray-100 font-manrope">
                      Delete Account Permanently?
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope">
                      This action cannot be undone. This will permanently delete your account and all associated data including:
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400 font-manrope">
                      <li>All organizations you created or belong to</li>
                      <li>All workspaces and their contents</li>
                      <li>All chatbots, chatflows, and knowledge bases</li>
                      <li>All authentication methods and login access</li>
                    </ul>

                    <Alert className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <AlertDescription className="text-red-700 dark:text-red-300 font-manrope">
                        <strong>Warning:</strong> This action is permanent and cannot be reversed.
                      </AlertDescription>
                    </Alert>

                    <div className="flex justify-end gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setDeleteConfirmOpen(false)}
                        disabled={isDeleting}
                        className="font-manrope border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAccountDelete}
                        disabled={isDeleting}
                        className="font-manrope bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500 text-white"
                      >
                        {isDeleting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Account
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}