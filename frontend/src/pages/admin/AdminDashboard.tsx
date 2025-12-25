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
} from "lucide-react";
import { adminApi, type SystemStats } from "@/api/admin";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

function StatCard({ label, value, icon: Icon, color, bgColor }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {value.toLocaleString()}
          </p>
        </div>
        <div className={cn("p-3 rounded-lg", bgColor)}>
          <Icon className={cn("h-6 w-6", color)} />
        </div>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Backoffice Dashboard
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          System-wide statistics and overview
        </p>
      </div>

      {/* Total Counts */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Platform Totals
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="Total Users"
            value={stats.total_users}
            icon={Users}
            color="text-blue-600"
            bgColor="bg-blue-100 dark:bg-blue-900/30"
          />
          <StatCard
            label="Organizations"
            value={stats.total_organizations}
            icon={Building2}
            color="text-purple-600"
            bgColor="bg-purple-100 dark:bg-purple-900/30"
          />
          <StatCard
            label="Workspaces"
            value={stats.total_workspaces}
            icon={Layers}
            color="text-indigo-600"
            bgColor="bg-indigo-100 dark:bg-indigo-900/30"
          />
          <StatCard
            label="Chatbots"
            value={stats.total_chatbots}
            icon={Bot}
            color="text-green-600"
            bgColor="bg-green-100 dark:bg-green-900/30"
          />
          <StatCard
            label="Chatflows"
            value={stats.total_chatflows}
            icon={Workflow}
            color="text-orange-600"
            bgColor="bg-orange-100 dark:bg-orange-900/30"
          />
          <StatCard
            label="Knowledge Bases"
            value={stats.total_knowledge_bases}
            icon={BookOpen}
            color="text-cyan-600"
            bgColor="bg-cyan-100 dark:bg-cyan-900/30"
          />
        </div>
      </div>

      {/* Activity Stats */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Activity
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active Users (7d)"
            value={stats.active_users_7d}
            icon={TrendingUp}
            color="text-emerald-600"
            bgColor="bg-emerald-100 dark:bg-emerald-900/30"
          />
          <StatCard
            label="New Users (7d)"
            value={stats.new_users_7d}
            icon={UserPlus}
            color="text-teal-600"
            bgColor="bg-teal-100 dark:bg-teal-900/30"
          />
          <StatCard
            label="New Users (30d)"
            value={stats.new_users_30d}
            icon={UserPlus}
            color="text-sky-600"
            bgColor="bg-sky-100 dark:bg-sky-900/30"
          />
          <StatCard
            label="New Orgs (7d)"
            value={stats.new_organizations_7d}
            icon={Building2}
            color="text-violet-600"
            bgColor="bg-violet-100 dark:bg-violet-900/30"
          />
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/admin/users"
            className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-primary/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <span className="font-medium text-gray-900 dark:text-white">
                Search Users
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
          </Link>
          <Link
            to="/admin/organizations"
            className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-primary/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <span className="font-medium text-gray-900 dark:text-white">
                Browse Organizations
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}
