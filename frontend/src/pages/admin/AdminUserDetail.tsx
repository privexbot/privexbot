/**
 * Admin User Detail Page
 *
 * WHY: View detailed user info and resources for support
 * HOW: Display profile, auth methods, memberships, and resources
 */

import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  User,
  Users,
  Building2,
  Layers,
  Bot,
  Workflow,
  BookOpen,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Calendar,
  Shield,
  ShieldOff,
  ShieldPlus,
  Key,
  Mail,
  Wallet,
  CheckCircle,
} from "lucide-react";
import {
  adminApi,
  type UserDetail,
  type UserResources,
} from "@/api/admin";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [resources, setResources] = useState<UserResources | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStaff, setIsUpdatingStaff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if this is the current user (can't demote yourself)
  const isCurrentUser = currentUser?.id === userId;

  // Handle staff status toggle
  const handleToggleStaff = async () => {
    if (!user || !userId) return;

    try {
      setIsUpdatingStaff(true);
      const newStatus = !user.is_staff;
      const response = await adminApi.updateStaffStatus(userId, newStatus);

      // Update local state
      setUser((prev) => (prev ? { ...prev, is_staff: response.is_staff } : null));

      toast({
        title: newStatus ? "Staff Access Granted" : "Staff Access Revoked",
        description: response.message,
      });
    } catch (err: any) {
      const message = err.response?.data?.detail || "Failed to update staff status";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStaff(false);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      if (!userId) return;

      try {
        setIsLoading(true);
        setError(null);
        const [userData, resourcesData] = await Promise.all([
          adminApi.getUser(userId),
          adminApi.getUserResources(userId),
        ]);
        setUser(userData);
        setResources(resourcesData);
      } catch (err) {
        console.error("Failed to fetch user:", err);
        setError("Failed to load user. They may not exist.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchUser();
  }, [userId]);

  const getProviderIcon = (provider: string) => {
    const baseClasses = "h-5 w-5 text-gray-600 dark:text-gray-400";
    switch (provider) {
      case "email":
        return <Mail className={baseClasses} />;
      case "evm":
      case "solana":
      case "cosmos":
        return <Wallet className={baseClasses} />;
      default:
        return <Key className={baseClasses} />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-manrope">Loading user...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="p-6">
          <Link
            to="/admin/users"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6 font-manrope"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Users
          </Link>
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm text-destructive font-manrope">{error || "User not found"}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Back Link */}
      <Link
        to="/admin/users"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-manrope"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Users
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        {user.is_staff ? (
          <Shield className="h-8 w-8 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        ) : (
          <User className="h-8 w-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        )}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-manrope">
              {user.username}
            </h1>
            {user.is_staff && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-manrope">
                Staff
              </span>
            )}
            {!user.is_active && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-manrope">
                Inactive
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400 font-manrope">
            {user.created_at && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Joined {new Date(user.created_at).toLocaleDateString()}
              </span>
            )}
            <span className="font-mono text-xs">{user.id}</span>
          </div>
        </div>
      </div>

      {/* Staff Management Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2 font-manrope">
          <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          Staff Management
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300 font-manrope">
              {user.is_staff
                ? "This user has staff/admin access to the backoffice."
                : "This user does not have staff access."}
            </p>
            {isCurrentUser && (
              <p className="text-xs text-amber-600 mt-1 font-manrope">
                You cannot modify your own staff status.
              </p>
            )}
          </div>
          <button
            onClick={handleToggleStaff}
            disabled={isUpdatingStaff || isCurrentUser}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors font-manrope",
              user.is_staff
                ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50",
              (isUpdatingStaff || isCurrentUser) && "opacity-50 cursor-not-allowed"
            )}
          >
            {isUpdatingStaff ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : user.is_staff ? (
              <ShieldOff className="h-4 w-4" />
            ) : (
              <ShieldPlus className="h-4 w-4" />
            )}
            {user.is_staff ? "Revoke Staff Access" : "Grant Staff Access"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Auth Methods */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2 font-manrope">
            <Key className="h-5 w-5 text-green-600 dark:text-green-400" />
            Auth Methods ({user.auth_methods.length})
          </h2>
          {user.auth_methods.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">No auth methods</p>
          ) : (
            <div className="space-y-3">
              {user.auth_methods.map((auth, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                >
                  {getProviderIcon(auth.provider)}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100 capitalize font-manrope">
                      {auth.provider}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[200px] font-manrope">
                      {auth.identifier}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Organizations */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2 font-manrope">
            <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            Organizations ({user.organizations.length})
          </h2>
          {user.organizations.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">No organizations</p>
          ) : (
            <div className="space-y-3">
              {user.organizations.map((org) => (
                <Link
                  key={org.id}
                  to={`/admin/organizations/${org.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100 font-manrope">
                      {org.name}
                    </p>
                    <p
                      className={cn(
                        "text-xs font-manrope",
                        org.role === "owner"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-gray-600 dark:text-gray-400"
                      )}
                    >
                      {org.role}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Resources */}
      {resources && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope">
            User Resources
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chatbots */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2 font-manrope">
                <Bot className="h-4 w-4 text-green-600 dark:text-green-400" />
                Chatbots ({resources.totals.chatbots})
              </h3>
              {resources.chatbots.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">None</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {resources.chatbots.map((bot) => (
                    <div
                      key={bot.id}
                      className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate font-manrope">
                        {bot.name}
                      </p>
                      {bot.status && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-manrope">
                          {bot.status}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chatflows */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2 font-manrope">
                <Workflow className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                Chatflows ({resources.totals.chatflows})
              </h3>
              {resources.chatflows.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">None</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {resources.chatflows.map((flow) => (
                    <div
                      key={flow.id}
                      className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate font-manrope">
                        {flow.name}
                      </p>
                      {flow.status && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-manrope">
                          {flow.status}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Knowledge Bases */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2 font-manrope">
                <BookOpen className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                Knowledge Bases ({resources.totals.knowledge_bases})
              </h3>
              {resources.knowledge_bases.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">None</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {resources.knowledge_bases.map((kb) => (
                    <div
                      key={kb.id}
                      className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate font-manrope">
                        {kb.name}
                      </p>
                      {kb.status && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-manrope">
                          {kb.status}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
