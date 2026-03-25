/**
 * Studio Page - Chatflows Dashboard
 *
 * WHY: Main dashboard for managing visual workflow chatflows
 * HOW: Consistent design with ChatbotsPage - cards, stats, filters
 *
 * FEATURES:
 * - List deployed chatflows with stats
 * - Search and filter functionality
 * - Grid/List view toggle
 * - Create new chatflow navigation
 * - Delete/Toggle active status
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Workflow,
  Plus,
  Search,
  MoreHorizontal,
  RefreshCw,
  Eye,
  Trash2,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Pause,
  Grid3x3,
  List,
  GitBranch,
  Power,
  Edit3,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  chatflowApi,
  chatflowDraftApi,
  type ChatflowSummary,
} from "@/api/chatflow";

// ========================================
// STATS CARD COMPONENT
// ========================================

interface StatsData {
  total: number;
  active: number;
  inactive: number;
  totalNodes: number;
}

function UnifiedStatsCard({ stats }: { stats: StatsData }) {
  const statItems = [
    {
      icon: Workflow,
      title: "Total Chatflows",
      value: stats.total,
      subtitle: "In workspace",
    },
    {
      icon: CheckCircle,
      title: "Active",
      value: stats.active,
      subtitle: "Currently running",
    },
    {
      icon: Pause,
      title: "Inactive",
      value: stats.inactive,
      subtitle: "Paused workflows",
    },
    {
      icon: GitBranch,
      title: "Total Nodes",
      value: stats.totalNodes.toLocaleString(),
      subtitle: "Across all flows",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row">
            {statItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={index}
                  className={cn(
                    "flex-1 p-6",
                    index < statItems.length - 1 &&
                      "border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-gray-700"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope truncate">
                        {item.title}
                      </p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-manrope">
                        {item.value}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ========================================
// CHATFLOW CARD COMPONENT
// ========================================

interface ChatflowCardProps {
  chatflow: ChatflowSummary;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  index: number;
}

function ChatflowCard({
  chatflow,
  onView,
  onEdit,
  onToggle,
  onDelete,
  index,
}: ChatflowCardProps) {
  const getStatusColor = (isActive: boolean) => {
    return isActive
      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
      : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700";
  };

  const getStatusIcon = (isActive: boolean) => {
    return isActive ? (
      <CheckCircle className="h-3 w-3" />
    ) : (
      <XCircle className="h-3 w-3" />
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -4 }}
      className="h-full"
    >
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 h-full flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Workflow className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <DropdownMenuItem
                  onClick={() => onEdit(chatflow.id)}
                  className="font-manrope text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit Workflow
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onView(chatflow.id)}
                  className="font-manrope text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-600" />
                <DropdownMenuItem
                  onClick={() => onToggle(chatflow.id)}
                  className="font-manrope text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                >
                  <Power className="h-4 w-4 mr-2" />
                  {chatflow.is_active ? "Deactivate" : "Activate"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(chatflow.id)}
                  className="font-manrope text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope line-clamp-1">
              {chatflow.name}
            </CardTitle>
            {chatflow.description && (
              <CardDescription className="text-sm text-gray-600 dark:text-gray-400 font-manrope line-clamp-2">
                {chatflow.description}
              </CardDescription>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col justify-between">
          {/* Status Badge */}
          <div className="mb-4">
            <div
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border",
                getStatusColor(chatflow.is_active)
              )}
            >
              {getStatusIcon(chatflow.is_active)}
              <span className="font-manrope">
                {chatflow.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <GitBranch className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                  Nodes
                </span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope">
                {chatflow.node_count || 0}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                  Created
                </span>
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                {chatflow.created_at
                  ? new Date(chatflow.created_at).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onView(chatflow.id)}
              className="font-manrope rounded-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(chatflow.id)}
              className="font-manrope rounded-lg border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30"
            >
              <Edit3 className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ========================================
// EMPTY STATE COMPONENT
// ========================================

function EmptyState({ onCreateChatflow }: { onCreateChatflow: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16"
    >
      <div className="mx-auto w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-6">
        <Workflow className="h-8 w-8 text-purple-600 dark:text-purple-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope mb-2">
        No Chatflows Yet
      </h3>
      <p className="text-gray-600 dark:text-gray-400 font-manrope mb-6 max-w-md mx-auto">
        Create your first visual workflow to build sophisticated conversational
        experiences with drag-and-drop simplicity.
      </p>
      <Button
        onClick={onCreateChatflow}
        className="font-manrope bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-500 text-white rounded-lg shadow-sm hover:shadow-md transition-all"
      >
        <Plus className="h-4 w-4 mr-2" />
        Create Your First Chatflow
      </Button>
    </motion.div>
  );
}

// ========================================
// MAIN COMPONENT
// ========================================

export function StudioPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentWorkspace } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Delete dialog state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch chatflows
  const {
    data: chatflowsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["chatflows", currentWorkspace?.id],
    queryFn: () =>
      currentWorkspace
        ? chatflowApi.list(currentWorkspace.id)
        : Promise.resolve({ items: [], total: 0, skip: 0, limit: 50 }),
    enabled: !!currentWorkspace,
  });

  const chatflows = chatflowsData?.items || [];

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: chatflowApi.toggle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatflows"] });
      toast({
        title: "Status Updated",
        description: "Chatflow status has been toggled.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to toggle status",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: chatflowApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatflows"] });
      toast({
        title: "Chatflow Deleted",
        description: "The chatflow has been permanently deleted.",
      });
      setDeleteId(null);
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description:
          error instanceof Error ? error.message : "Failed to delete chatflow",
        variant: "destructive",
      });
    },
  });

  // Create draft mutation
  const createDraftMutation = useMutation({
    mutationFn: chatflowDraftApi.create,
    onSuccess: (data) => {
      navigate(`/chatflows/builder/${data.draft_id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create chatflow",
        variant: "destructive",
      });
    },
  });

  // Edit draft mutation
  const editDraftMutation = useMutation({
    mutationFn: chatflowApi.createEditDraft,
    onSuccess: (data) => {
      navigate(`/chatflows/builder/${data.draft_id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to load chatflow for editing",
        variant: "destructive",
      });
    },
  });

  // Filter chatflows by search and status
  const filteredChatflows = chatflows.filter((cf) => {
    const matchesSearch =
      cf.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cf.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      selectedStatus === "all" ||
      (selectedStatus === "active" && cf.is_active) ||
      (selectedStatus === "inactive" && !cf.is_active);

    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats: StatsData = {
    total: chatflows.length,
    active: chatflows.filter((cf) => cf.is_active).length,
    inactive: chatflows.filter((cf) => !cf.is_active).length,
    totalNodes: chatflows.reduce((sum, cf) => sum + (cf.node_count || 0), 0),
  };

  // Handlers
  const handleCreateChatflow = useCallback(() => {
    if (!currentWorkspace) {
      toast({
        title: "No Workspace",
        description: "Please select a workspace first.",
        variant: "destructive",
      });
      return;
    }

    createDraftMutation.mutate({
      workspace_id: currentWorkspace.id,
      initial_data: {
        name: "Untitled Chatflow",
        nodes: [],
        edges: [],
      },
    });
  }, [currentWorkspace, createDraftMutation]);

  const handleViewChatflow = (id: string) => {
    // For now, navigate to builder - can add detail page later
    navigate(`/chatflows/builder/${id}`);
  };

  const handleEditChatflow = (id: string) => {
    editDraftMutation.mutate(id);
  };

  const handleToggleChatflow = (id: string) => {
    toggleMutation.mutate(id);
  };

  const handleDeleteChatflow = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
    }
  };

  // Error state
  if (error) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
          <Alert
            variant="destructive"
            className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 rounded-xl"
          >
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-700 dark:text-red-300 font-manrope">
              {error instanceof Error ? error.message : "Failed to load chatflows"}
            </AlertDescription>
          </Alert>
          <Button
            onClick={() => refetch()}
            className="mt-4 font-manrope bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-500 text-white rounded-lg"
          >
            Try Again
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="py-6 sm:py-8 px-4 sm:px-6 lg:px-8 xl:px-12 space-y-6 sm:space-y-8">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 font-manrope">
                Chatflows
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1 font-manrope">
                Design visual workflows with drag-and-drop simplicity
              </p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => refetch()}
                className="flex-1 sm:flex-none font-manrope rounded-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                onClick={handleCreateChatflow}
                disabled={createDraftMutation.isPending}
                className="flex-1 sm:flex-none font-manrope bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-500 text-white rounded-lg shadow-sm hover:shadow-md transition-all"
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">
                  {createDraftMutation.isPending
                    ? "Creating..."
                    : "Create Chatflow"}
                </span>
                <span className="sm:hidden">
                  {createDraftMutation.isPending ? "..." : "Create"}
                </span>
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <UnifiedStatsCard stats={stats} />

          {/* Filters and Search Bar */}
          <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search chatflows..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                  />
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                  <Select
                    value={selectedStatus}
                    onValueChange={setSelectedStatus}
                  >
                    <SelectTrigger className="w-full sm:w-40 h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* View Mode Toggle */}
                  <div className="flex border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode("grid")}
                      className={cn(
                        "rounded-none h-10 px-3",
                        viewMode === "grid"
                          ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          : "text-gray-500 dark:text-gray-400"
                      )}
                    >
                      <Grid3x3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode("list")}
                      className={cn(
                        "rounded-none h-10 px-3",
                        viewMode === "list"
                          ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          : "text-gray-500 dark:text-gray-400"
                      )}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredChatflows.length === 0 && (
            <EmptyState onCreateChatflow={handleCreateChatflow} />
          )}

          {/* Chatflow Grid */}
          {!isLoading && filteredChatflows.length > 0 && (
            <div
              className={cn(
                viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
                  : "space-y-4"
              )}
            >
              <AnimatePresence mode="popLayout">
                {filteredChatflows.map((chatflow, index) => (
                  <ChatflowCard
                    key={chatflow.id}
                    chatflow={chatflow}
                    onView={handleViewChatflow}
                    onEdit={handleEditChatflow}
                    onToggle={handleToggleChatflow}
                    onDelete={(id) => setDeleteId(id)}
                    index={index}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-100 font-manrope flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Delete Chatflow
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope">
              Are you sure you want to delete this chatflow? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              className="font-manrope rounded-lg border-gray-200 dark:border-gray-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteChatflow}
              disabled={deleteMutation.isPending}
              className="font-manrope bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
