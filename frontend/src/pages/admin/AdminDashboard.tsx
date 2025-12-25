/**
 * Admin Dashboard Page
 *
 * WHY: System-wide statistics overview for staff
 * HOW: Displays counts of all major entities
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Building2,
  Layers,
  Bot,
  Workflow,
  BookOpen,
  TrendingUp,
  UserPlus,
  ArrowRight,
  Loader2,
  AlertCircle,
  KeyRound,
  Copy,
  Check,
  Trash2,
  Plus,
} from "lucide-react";
import { adminApi, type SystemStats, type InviteCodeInfo } from "@/api/admin";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1 font-manrope">
            {value.toLocaleString()}
          </p>
        </div>
        <Icon className={cn("h-6 w-6 flex-shrink-0", color)} />
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite codes state
  const [inviteCodes, setInviteCodes] = useState<InviteCodeInfo[]>([]);
  const [isLoadingCodes, setIsLoadingCodes] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const fetchInviteCodes = async () => {
    try {
      setIsLoadingCodes(true);
      const codes = await adminApi.listInviteCodes();
      setInviteCodes(codes);
    } catch (err) {
      console.error("Failed to fetch invite codes:", err);
    } finally {
      setIsLoadingCodes(false);
    }
  };

  const generateCode = async () => {
    try {
      setIsGenerating(true);
      setCodeError(null);
      await adminApi.generateInviteCode();
      await fetchInviteCodes();
    } catch (err: any) {
      console.error("Failed to generate invite code:", err);
      setCodeError(err.response?.data?.detail || "Failed to generate code");
    } finally {
      setIsGenerating(false);
    }
  };

  const revokeCode = async (code: string) => {
    try {
      await adminApi.revokeInviteCode(code);
      await fetchInviteCodes();
    } catch (err) {
      console.error("Failed to revoke code:", err);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await adminApi.getStats();
        setStats(data);
      } catch (err) {
        console.error("Failed to fetch admin stats:", err);
        setError("Failed to load statistics. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchStats();
    void fetchInviteCodes();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading statistics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-manrope">
          Backoffice Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1 font-manrope">
          System-wide statistics and overview
        </p>
      </div>

      {/* Total Counts */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 font-manrope">
          Platform Totals
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="Total Users"
            value={stats.total_users}
            icon={Users}
            color="text-blue-600 dark:text-blue-400"
          />
          <StatCard
            label="Organizations"
            value={stats.total_organizations}
            icon={Building2}
            color="text-purple-600 dark:text-purple-400"
          />
          <StatCard
            label="Workspaces"
            value={stats.total_workspaces}
            icon={Layers}
            color="text-indigo-600 dark:text-indigo-400"
          />
          <StatCard
            label="Chatbots"
            value={stats.total_chatbots}
            icon={Bot}
            color="text-green-600 dark:text-green-400"
          />
          <StatCard
            label="Chatflows"
            value={stats.total_chatflows}
            icon={Workflow}
            color="text-orange-600 dark:text-orange-400"
          />
          <StatCard
            label="Knowledge Bases"
            value={stats.total_knowledge_bases}
            icon={BookOpen}
            color="text-cyan-600 dark:text-cyan-400"
          />
        </div>
      </div>

      {/* Activity Stats */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 font-manrope">
          Recent Activity
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active Users (7d)"
            value={stats.active_users_7d}
            icon={TrendingUp}
            color="text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            label="New Users (7d)"
            value={stats.new_users_7d}
            icon={UserPlus}
            color="text-teal-600 dark:text-teal-400"
          />
          <StatCard
            label="New Users (30d)"
            value={stats.new_users_30d}
            icon={UserPlus}
            color="text-sky-600 dark:text-sky-400"
          />
          <StatCard
            label="New Orgs (7d)"
            value={stats.new_organizations_7d}
            icon={Building2}
            color="text-violet-600 dark:text-violet-400"
          />
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 font-manrope">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/admin/users"
            className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-primary/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <span className="font-medium text-gray-900 dark:text-gray-100 font-manrope">
                Search Users
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
          </Link>
          <Link
            to="/admin/organizations"
            className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-primary/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <span className="font-medium text-gray-900 dark:text-gray-100 font-manrope">
                Browse Organizations
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
          </Link>
        </div>
      </div>

      {/* Invite Codes Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope">
              Beta Invite Codes
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
              Generate and manage invite codes for beta testers
            </p>
          </div>
          <button
            onClick={generateCode}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors font-manrope"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Generate Code
          </button>
        </div>

        {codeError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm font-manrope">
            {codeError}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {isLoadingCodes ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : inviteCodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <KeyRound className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-gray-600 dark:text-gray-400 font-manrope">No invite codes yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 font-manrope">
                Generate a code to invite beta testers
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider font-manrope">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider font-manrope">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider font-manrope">
                    Expires
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider font-manrope">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {inviteCodes.map((code) => (
                  <tr key={code.code} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                    <td className="px-4 py-3">
                      <span className="font-mono font-medium text-gray-900 dark:text-gray-100">
                        {code.code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {code.is_redeemed ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-manrope">
                          Redeemed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-manrope">
                          Available
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-manrope">
                      {new Date(code.expires_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => copyCode(code.code)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          title="Copy code"
                        >
                          {copiedCode === code.code ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                        {!code.is_redeemed && (
                          <button
                            onClick={() => revokeCode(code.code)}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                            title="Revoke code"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
