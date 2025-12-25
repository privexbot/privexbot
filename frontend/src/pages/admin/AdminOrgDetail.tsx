/**
 * Admin Organization Detail Page
 *
 * WHY: View detailed organization info for support
 * HOW: Display workspaces, members, and settings
 */

import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Building2,
  Users,
  Layers,
  Bot,
  Workflow,
  BookOpen,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Calendar,
  Mail,
  Shield,
} from "lucide-react";
import { adminApi, type OrganizationDetail } from "@/api/admin";
import { cn } from "@/lib/utils";

export function AdminOrgDetail() {
  const { orgId } = useParams<{ orgId: string }>();
  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrg = async () => {
      if (!orgId) return;

      try {
        setIsLoading(true);
        setError(null);
        const data = await adminApi.getOrganization(orgId);
        setOrg(data);
      } catch (err) {
        console.error("Failed to fetch organization:", err);
        setError("Failed to load organization. It may not exist.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchOrg();
  }, [orgId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-manrope">Loading organization...</p>
        </div>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="p-6">
          <Link
            to="/admin/organizations"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6 font-manrope"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Organizations
          </Link>
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm text-destructive font-manrope">{error || "Organization not found"}</p>
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
        to="/admin/organizations"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-manrope"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Organizations
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <Building2 className="h-8 w-8 text-purple-600 dark:text-purple-400 flex-shrink-0" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-manrope">
            {org.name}
          </h1>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400 font-manrope">
            {org.billing_email && (
              <span className="flex items-center gap-1">
                <Mail className="h-4 w-4" />
                {org.billing_email}
              </span>
            )}
            {org.created_at && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Created {new Date(org.created_at).toLocaleDateString()}
              </span>
            )}
            {org.subscription_tier && (
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium font-manrope",
                  org.subscription_tier === "pro"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : org.subscription_tier === "enterprise"
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                )}
              >
                {org.subscription_tier}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workspaces */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2 font-manrope">
            <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Workspaces ({org.workspaces.length})
          </h2>
          {org.workspaces.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">No workspaces</p>
          ) : (
            <div className="space-y-3">
              {org.workspaces.map((ws) => (
                <div
                  key={ws.id}
                  className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 font-manrope">
                      {ws.name}
                      {ws.is_default && (
                        <span className="ml-2 text-xs text-gray-500 font-manrope">(default)</span>
                      )}
                    </h3>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400 font-manrope">
                    <span className="flex items-center gap-1">
                      <Bot className="h-3 w-3" />
                      {ws.chatbot_count} chatbots
                    </span>
                    <span className="flex items-center gap-1">
                      <Workflow className="h-3 w-3" />
                      {ws.chatflow_count} chatflows
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      {ws.kb_count} KBs
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Members */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2 font-manrope">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Members ({org.members.length})
          </h2>
          {org.members.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">No members</p>
          ) : (
            <div className="space-y-3">
              {org.members.map((member) => (
                <Link
                  key={member.user_id}
                  to={`/admin/users/${member.user_id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300 font-manrope">
                        {member.username[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100 font-manrope">
                        {member.username}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 font-manrope">
                        <span
                          className={cn(
                            "flex items-center gap-1",
                            member.role === "owner" && "text-amber-600 dark:text-amber-400"
                          )}
                        >
                          <Shield className="h-3 w-3" />
                          {member.role}
                        </span>
                        {!member.is_active && (
                          <span className="text-red-500">(inactive)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
