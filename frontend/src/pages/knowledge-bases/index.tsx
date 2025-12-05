/**
 * Knowledge Bases Page
 *
 * Modern analytics-style dashboard for viewing and managing knowledge bases
 * Features card-driven aesthetic with clean typography and rounded surfaces
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  BookOpen,
  Plus,
  Search,
  MoreHorizontal,
  Settings,
  RefreshCw,
  FileText,
  Eye,
  Trash2,
  Activity,
  Database,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Layers,
  Grid3x3,
  List,
  Zap
} from 'lucide-react';
import { useKBStore } from '@/store/kb-store';
import { KBStatus, KBContext } from '@/types/knowledge-base';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// Unified Stats Card Component
function UnifiedStatsCard({ stats }: { stats: any }) {
  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const statItems = [
    {
      icon: Database,
      title: 'Total Knowledge Bases',
      value: stats.total,
      subtitle: 'Active in workspace'
    },
    {
      icon: FileText,
      title: 'Total Documents',
      value: stats.totalDocuments.toLocaleString(),
      subtitle: 'Across all KBs'
    },
    {
      icon: Layers,
      title: 'Vector Chunks',
      value: stats.totalChunks.toLocaleString(),
      subtitle: formatBytes(stats.totalSize)
    },
    {
      icon: Zap,
      title: 'Success Rate',
      value: `${stats.successRate}%`,
      subtitle: `${stats.failed} failed`
    }
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
                    index < statItems.length - 1 && "border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-gray-700"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                      <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    </div>
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

// Modern KB Card Component
function KBCard({ kb, onView, onEdit, onDelete, index }: any) {
  const getStatusColor = (status: KBStatus) => {
    switch (status) {
      case KBStatus.READY:
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      case KBStatus.PROCESSING:
      case KBStatus.REINDEXING:
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case KBStatus.FAILED:
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700';
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-xl">
              <BookOpen className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <DropdownMenuItem onClick={() => onEdit(kb.id)} className="font-manrope text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="font-manrope text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-chunk
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-600" />
                <DropdownMenuItem onClick={() => onDelete(kb.id)} className="font-manrope text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope line-clamp-1">
              {kb.name}
            </CardTitle>
            {kb.description && (
              <CardDescription className="text-sm text-gray-600 dark:text-gray-400 font-manrope line-clamp-2">
                {kb.description}
              </CardDescription>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col justify-between">
          {/* Status Badge */}
          <div className="mb-4">
            <div className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border",
              getStatusColor(kb.status)
            )}>
              {kb.status === KBStatus.READY && <CheckCircle className="h-3 w-3" />}
              {(kb.status === KBStatus.PROCESSING || kb.status === KBStatus.REINDEXING) && (
                <Clock className="h-3 w-3 animate-pulse" />
              )}
              {kb.status === KBStatus.FAILED && <XCircle className="h-3 w-3" />}
              <span className="font-manrope">{kb.status.charAt(0).toUpperCase() + kb.status.slice(1)}</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Documents</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope">
                {kb.stats?.documents || 0}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Layers className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Chunks</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope">
                {kb.stats?.chunks || 0}
              </p>
            </div>
          </div>

          {/* Size and Date Info */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400 font-manrope">Size</span>
              <span className="text-gray-700 dark:text-gray-300 font-medium font-manrope">
                {formatBytes(kb.stats?.total_size_bytes || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400 font-manrope">Updated</span>
              <span className="text-gray-700 dark:text-gray-300 font-medium font-manrope">
                {new Date(kb.updated_at || kb.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onView(kb.id)}
              className="font-manrope rounded-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="font-manrope rounded-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <Activity className="h-3 w-3 mr-1" />
              Test
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function KnowledgeBasesPage() {
  const navigate = useNavigate();
  const { currentWorkspace } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedContext, setSelectedContext] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [deleteKBId, setDeleteKBId] = useState<string | null>(null);

  const {
    kbs,
    isLoadingList,
    listError,
    fetchKBs,
    deleteKB,
    clearListError
  } = useKBStore();

  // Load KBs on mount and filter changes
  useEffect(() => {
    if (!currentWorkspace) return;

    const fetchFilters = {
      workspace_id: currentWorkspace.id,
      status: selectedStatus === 'all' ? undefined : selectedStatus as KBStatus,
      context: selectedContext === 'all' ? undefined : selectedContext as KBContext,
    };

    fetchKBs(fetchFilters);
  }, [currentWorkspace, selectedStatus, selectedContext, fetchKBs]);

  // Filter KBs by search query
  const filteredKBs = kbs.filter(kb =>
    kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kb.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate enhanced stats
  const stats = {
    total: kbs.length,
    ready: kbs.filter(kb => kb.status === KBStatus.READY).length,
    processing: kbs.filter(kb => kb.status === KBStatus.PROCESSING || kb.status === KBStatus.REINDEXING).length,
    failed: kbs.filter(kb => kb.status === KBStatus.FAILED).length,
    totalDocuments: kbs.reduce((sum, kb) => sum + (kb.stats?.documents || 0), 0),
    totalChunks: kbs.reduce((sum, kb) => sum + (kb.stats?.chunks || 0), 0),
    totalSize: kbs.reduce((sum, kb) => sum + (kb.stats?.total_size_bytes || 0), 0),
    successRate: kbs.length > 0 ? Math.round((kbs.filter(kb => kb.status === KBStatus.READY).length / kbs.length) * 100) : 0
  };

  const handleCreateKB = () => navigate('/knowledge-bases/create');
  const handleViewKB = (kbId: string) => navigate(`/knowledge-bases/${kbId}`);
  const handleEditKB = (kbId: string) => navigate(`/knowledge-bases/${kbId}/edit`);

  const handleDeleteKB = async (kbId: string) => {
    try {
      await deleteKB(kbId);
      toast({
        title: 'Knowledge Base Deleted',
        description: 'The knowledge base has been deleted successfully',
      });
      setDeleteKBId(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete knowledge base';
      toast({
        title: 'Delete Failed',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  };

  if (listError) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
          <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 rounded-xl">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-700 dark:text-red-300 font-manrope">
              {listError}
            </AlertDescription>
          </Alert>
          <Button
            onClick={() => { clearListError(); fetchKBs(); }}
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
                Knowledge Bases
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1 font-manrope">
                Manage and monitor your AI knowledge sources
              </p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => fetchKBs()}
                className="flex-1 sm:flex-none font-manrope rounded-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                onClick={handleCreateKB}
                className="flex-1 sm:flex-none font-manrope bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg shadow-sm hover:shadow-md transition-all"
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Create Knowledge Base</span>
                <span className="sm:hidden">Create KB</span>
              </Button>
            </div>
          </div>

          {/* Unified Stats Cards */}
          <UnifiedStatsCard stats={stats} />

          {/* Filters and Search Bar */}
          <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search knowledge bases..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="ready">Ready</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={selectedContext} onValueChange={setSelectedContext}>
                    <SelectTrigger className="h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope">
                      <SelectValue placeholder="Context" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <SelectItem value="all">All Context</SelectItem>
                      <SelectItem value="chatbot">Chatbot</SelectItem>
                      <SelectItem value="chatflow">Chatflow</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg ml-auto">
                    <Button
                      variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={() => setViewMode('grid')}
                      className="h-8 w-8 rounded text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      <Grid3x3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={() => setViewMode('list')}
                      className="h-8 w-8 rounded text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Knowledge Bases Grid/List */}
          {isLoadingList ? (
            <div className="flex justify-center items-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredKBs.length > 0 ? (
            <AnimatePresence mode="wait">
              {viewMode === 'grid' ? (
                <motion.div
                  key="grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
                >
                  {filteredKBs.map((kb, index) => (
                    <KBCard
                      key={kb.id}
                      kb={kb}
                      index={index}
                      onView={handleViewKB}
                      onEdit={handleEditKB}
                      onDelete={setDeleteKBId}
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {filteredKBs.map((kb, index) => (
                    <motion.div
                      key={kb.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
                        <CardContent className="p-4 sm:p-6">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-xl flex-shrink-0">
                                <BookOpen className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 font-manrope truncate mb-1">
                                  {kb.name}
                                </h3>
                                {kb.description && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope mb-3 line-clamp-2">
                                    {kb.description}
                                  </p>
                                )}
                                <div className="flex flex-wrap items-center gap-4 text-sm">
                                  <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                    <FileText className="h-4 w-4 flex-shrink-0" />
                                    <span className="font-manrope">{kb.stats?.documents || 0} docs</span>
                                  </span>
                                  <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                    <Layers className="h-4 w-4 flex-shrink-0" />
                                    <span className="font-manrope">{kb.stats?.chunks || 0} chunks</span>
                                  </span>
                                  <Badge
                                    variant={kb.status === KBStatus.READY ? 'default' : kb.status === KBStatus.FAILED ? 'destructive' : 'secondary'}
                                    className="font-manrope"
                                  >
                                    {kb.status}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewKB(kb.id)}
                                className="flex-1 sm:flex-none font-manrope rounded-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                  <DropdownMenuItem onClick={() => handleEditKB(kb.id)} className="font-manrope text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <Settings className="h-4 w-4 mr-2" />
                                    Edit Settings
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-600" />
                                  <DropdownMenuItem onClick={() => setDeleteKBId(kb.id)} className="font-manrope text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          ) : (
            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <CardContent className="text-center py-12 sm:py-16">
                <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full inline-flex mb-4">
                  <BookOpen className="h-8 sm:h-12 w-8 sm:w-12 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100 font-manrope">
                  No Knowledge Bases Yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 font-manrope max-w-sm mx-auto">
                  Create your first knowledge base to start building intelligent AI-powered chatbots
                </p>
                <Button
                  onClick={handleCreateKB}
                  className="font-manrope bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg shadow-sm hover:shadow-md transition-all"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Knowledge Base
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Delete Confirmation Dialog */}
          <Dialog open={!!deleteKBId} onOpenChange={() => setDeleteKBId(null)}>
            <DialogContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
              <DialogHeader>
                <DialogTitle className="text-gray-900 dark:text-gray-100 font-manrope">
                  Delete Knowledge Base?
                </DialogTitle>
                <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope">
                  This action cannot be undone. This will permanently delete the knowledge base
                  and all its associated documents and chunks.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-3 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setDeleteKBId(null)}
                  className="font-manrope rounded-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteKBId && handleDeleteKB(deleteKBId)}
                  className="font-manrope bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500 text-white rounded-lg"
                >
                  Delete Knowledge Base
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </DashboardLayout>
  );
}