/**
 * Chatbots Page
 *
 * Modern analytics-style dashboard for viewing and managing chatbots
 * Features card-driven aesthetic with clean typography and rounded surfaces
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Bot,
  Plus,
  Search,
  MoreHorizontal,
  Settings,
  RefreshCw,
  MessageSquare,
  Eye,
  Trash2,
  Activity,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Pause,
  Grid3x3,
  List,
  Zap,
  Play,
  Code,
} from "lucide-react";
import { useChatbotStore } from "@/store/chatbot-store";
import { ChatbotStatus, getStatusLabel } from "@/types/chatbot";
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

// ========================================
// STATS CARD COMPONENT
// ========================================

interface StatsData {
  total: number;
  active: number;
  paused: number;
  archived: number;
  totalConversations: number;
  totalMessages: number;
}

function UnifiedStatsCard({ stats }: { stats: StatsData }) {
  const statItems = [
    {
      icon: Bot,
      title: "Total Chatbots",
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
      icon: MessageSquare,
      title: "Conversations",
      value: stats.totalConversations.toLocaleString(),
      subtitle: "All time",
    },
    {
      icon: Zap,
      title: "Messages",
      value: stats.totalMessages.toLocaleString(),
      subtitle: "Total processed",
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
// CHATBOT CARD COMPONENT
// ========================================

interface ChatbotCardProps {
  chatbot: {
    id: string;
    name: string;
    description?: string;
    status: ChatbotStatus;
    created_at: string;
    deployed_at?: string;
    cached_metrics: {
      total_conversations: number;
      total_messages: number;
      avg_response_time_ms: number;
    };
  };
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onTest: (id: string) => void;
  onDelete: (id: string) => void;
  index: number;
}

function ChatbotCard({
  chatbot,
  onView,
  onEdit,
  onTest,
  onDelete,
  index,
}: ChatbotCardProps) {
  const getStatusColor = (status: ChatbotStatus) => {
    switch (status) {
      case ChatbotStatus.ACTIVE:
        return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800";
      case ChatbotStatus.PAUSED:
        return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case ChatbotStatus.ARCHIVED:
        return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700";
      case ChatbotStatus.DRAFT:
      default:
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    }
  };

  const getStatusIcon = (status: ChatbotStatus) => {
    switch (status) {
      case ChatbotStatus.ACTIVE:
        return <CheckCircle className="h-3 w-3" />;
      case ChatbotStatus.PAUSED:
        return <Pause className="h-3 w-3" />;
      case ChatbotStatus.ARCHIVED:
        return <XCircle className="h-3 w-3" />;
      case ChatbotStatus.DRAFT:
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const formatResponseTime = (ms: number) => {
    if (!ms) return "N/A";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
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
            <Bot className="h-6 w-6 text-gray-600 dark:text-gray-400 flex-shrink-0" />
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
                  onClick={() => onEdit(chatbot.id)}
                  className="font-manrope text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onView(chatbot.id)}
                  className="font-manrope text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <Code className="h-4 w-4 mr-2" />
                  Embed Code
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-600" />
                <DropdownMenuItem
                  onClick={() => onDelete(chatbot.id)}
                  className="font-manrope text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope line-clamp-1">
              {chatbot.name}
            </CardTitle>
            {chatbot.description && (
              <CardDescription className="text-sm text-gray-600 dark:text-gray-400 font-manrope line-clamp-2">
                {chatbot.description}
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
                getStatusColor(chatbot.status)
              )}
            >
              {getStatusIcon(chatbot.status)}
              <span className="font-manrope">{getStatusLabel(chatbot.status)}</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                  Conversations
                </span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope">
                {chatbot.cached_metrics?.total_conversations || 0}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                  Messages
                </span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope">
                {chatbot.cached_metrics?.total_messages || 0}
              </p>
            </div>
          </div>

          {/* Response Time and Date Info */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400 font-manrope">
                Avg Response
              </span>
              <span className="text-gray-700 dark:text-gray-300 font-medium font-manrope">
                {formatResponseTime(chatbot.cached_metrics?.avg_response_time_ms)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400 font-manrope">
                Deployed
              </span>
              <span className="text-gray-700 dark:text-gray-300 font-medium font-manrope">
                {chatbot.deployed_at
                  ? new Date(chatbot.deployed_at).toLocaleDateString()
                  : "Not deployed"}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onView(chatbot.id)}
              className="font-manrope rounded-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTest(chatbot.id)}
              className="font-manrope rounded-lg border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
            >
              <Play className="h-3 w-3 mr-1" />
              Test
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(chatbot.id)}
              className="font-manrope rounded-lg border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
            >
              <Activity className="h-3 w-3 mr-1" />
              Stats
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

function EmptyState({ onCreateChatbot }: { onCreateChatbot: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16"
    >
      <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
        <Bot className="h-8 w-8 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope mb-2">
        No Chatbots Yet
      </h3>
      <p className="text-gray-600 dark:text-gray-400 font-manrope mb-6 max-w-md mx-auto">
        Create your first AI chatbot to start engaging with your customers. Connect
        knowledge bases and deploy to multiple channels.
      </p>
      <Button
        onClick={onCreateChatbot}
        className="font-manrope bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg shadow-sm hover:shadow-md transition-all"
      >
        <Plus className="h-4 w-4 mr-2" />
        Create Your First Chatbot
      </Button>
    </motion.div>
  );
}

// ========================================
// MAIN COMPONENT
// ========================================

export function ChatbotsPage() {
  const navigate = useNavigate();
  const { currentWorkspace } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    chatbots,
    isLoadingList,
    listError,
    fetchChatbots,
    archiveChatbot,
    clearListError,
  } = useChatbotStore();

  // Load chatbots on mount and filter changes
  useEffect(() => {
    if (!currentWorkspace) return;

    const filters = {
      workspace_id: currentWorkspace.id,
      status:
        selectedStatus === "all"
          ? undefined
          : (selectedStatus as ChatbotStatus),
    };

    fetchChatbots(filters);
  }, [currentWorkspace, selectedStatus, fetchChatbots]);

  // Filter chatbots by search query
  const filteredChatbots = chatbots.filter(
    (cb) =>
      cb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cb.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate stats
  const stats: StatsData = {
    total: chatbots.length,
    active: chatbots.filter((cb) => cb.status === ChatbotStatus.ACTIVE).length,
    paused: chatbots.filter((cb) => cb.status === ChatbotStatus.PAUSED).length,
    archived: chatbots.filter((cb) => cb.status === ChatbotStatus.ARCHIVED)
      .length,
    totalConversations: chatbots.reduce(
      (sum, cb) => sum + (cb.cached_metrics?.total_conversations || 0),
      0
    ),
    totalMessages: chatbots.reduce(
      (sum, cb) => sum + (cb.cached_metrics?.total_messages || 0),
      0
    ),
  };

  const handleCreateChatbot = () => navigate("/chatbots/create");
  const handleViewChatbot = (id: string) => navigate(`/chatbots/${id}`);
  const handleEditChatbot = (id: string) => navigate(`/chatbots/${id}/edit`);
  const handleTestChatbot = (id: string) =>
    navigate(`/chatbots/${id}?tab=test`);

  const handleDeleteChatbot = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      await archiveChatbot(deleteId);
      toast({
        title: "Chatbot Archived",
        description: "The chatbot has been archived successfully",
      });
      setDeleteId(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to archive chatbot";
      toast({
        title: "Archive Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Error state
  if (listError) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
          <Alert
            variant="destructive"
            className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 rounded-xl"
          >
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-700 dark:text-red-300 font-manrope">
              {listError}
            </AlertDescription>
          </Alert>
          <Button
            onClick={() => {
              clearListError();
              if (currentWorkspace) {
                fetchChatbots({ workspace_id: currentWorkspace.id });
              }
            }}
            className="mt-4 font-manrope bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg"
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
                Chatbots
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1 font-manrope">
                Create and manage your AI-powered chatbots
              </p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => {
                  if (currentWorkspace) {
                    fetchChatbots({ workspace_id: currentWorkspace.id });
                  }
                }}
                className="flex-1 sm:flex-none font-manrope rounded-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                onClick={handleCreateChatbot}
                className="flex-1 sm:flex-none font-manrope bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg shadow-sm hover:shadow-md transition-all"
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Create Chatbot</span>
                <span className="sm:hidden">Create</span>
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
                    placeholder="Search chatbots..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-full sm:w-40 h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
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
          {isLoadingList && (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          )}

          {/* Empty State */}
          {!isLoadingList && filteredChatbots.length === 0 && (
            <EmptyState onCreateChatbot={handleCreateChatbot} />
          )}

          {/* Chatbot Grid */}
          {!isLoadingList && filteredChatbots.length > 0 && (
            <div
              className={cn(
                viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
                  : "space-y-4"
              )}
            >
              <AnimatePresence mode="popLayout">
                {filteredChatbots.map((chatbot, index) => (
                  <ChatbotCard
                    key={chatbot.id}
                    chatbot={chatbot}
                    onView={handleViewChatbot}
                    onEdit={handleEditChatbot}
                    onTest={handleTestChatbot}
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
            <DialogTitle className="text-gray-900 dark:text-gray-100 font-manrope">
              Archive Chatbot
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope">
              Are you sure you want to archive this chatbot? It will no longer be
              accessible to users, but you can restore it later.
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
              onClick={handleDeleteChatbot}
              disabled={isDeleting}
              className="font-manrope bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              {isDeleting ? "Archiving..." : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
