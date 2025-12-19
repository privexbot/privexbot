/**
 * Knowledge Base Detail Page
 *
 * Shows detailed view of a specific knowledge base with documents, chunks, and management options
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  ArrowLeft,
  FileText,
  Database,
  Settings,
  Trash2,
  RefreshCw,
  BookOpen,
  Eye,
  Edit,
  MoreHorizontal,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Search
} from 'lucide-react';
import kbClient from '@/lib/kb-client';
import { useApp } from '@/contexts/AppContext';
import { KnowledgeBase, KBDocument } from '@/types/knowledge-base';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { KBTestSearch } from '@/components/kb/KBTestSearch';

export default function KBDetailPage() {
  const { kbId } = useParams<{ kbId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentWorkspace, workspaces } = useApp();

  // Read initial tab from URL query parameter (e.g., ?tab=test-search)
  const initialTab = searchParams.get('tab') || 'overview';

  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [chunks, setChunks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  /**
   * Calculate effective chunk count from multiple sources
   * Priority: kb.total_chunks > sum of document chunk_counts > PostgreSQL chunks
   */
  const getEffectiveChunkCount = (): number => {
    // Priority 1: Use total_chunks from KB if available
    if (kb && (kb as any).total_chunks && (kb as any).total_chunks > 0) {
      return (kb as any).total_chunks;
    }

    // Priority 2: Sum from documents' chunk_count
    if (Array.isArray(documents) && documents.length > 0) {
      const totalFromDocs = documents.reduce(
        (sum: number, doc: KBDocument) => sum + (doc.chunk_count || 0), 0
      );
      if (totalFromDocs > 0) return totalFromDocs;
    }

    // Priority 3: Fallback to PostgreSQL chunks
    return Array.isArray(chunks) ? chunks.length : 0;
  };

  /**
   * Calculate average chunk size
   * Uses PostgreSQL chunks if available, otherwise estimates from document metadata
   */
  const getAverageChunkSize = (): number => {
    // If we have PostgreSQL chunks with character counts
    if (Array.isArray(chunks) && chunks.length > 0) {
      const totalChars = chunks.reduce((acc, chunk) => acc + (chunk.character_count || 0), 0);
      return Math.round(totalChars / chunks.length);
    }

    // For Qdrant-only storage, estimate from documents
    const effectiveChunkCount = getEffectiveChunkCount();
    if (effectiveChunkCount > 0 && Array.isArray(documents) && documents.length > 0) {
      // Check for processing metadata with chunk_size info
      const processingMeta = documents.find(
        (doc: KBDocument) => (doc as any).processing_metadata?.chunk_size
      );

      if (processingMeta && (processingMeta as any).processing_metadata?.chunk_size) {
        // Use configured chunk size from processing metadata
        return (processingMeta as any).processing_metadata.chunk_size;
      }

      // Sum total characters from all documents
      const totalChars = documents.reduce((acc: number, doc: KBDocument) => {
        // Use character_count if available, otherwise estimate from word_count
        const charCount = doc.character_count || ((doc.word_count || 0) * 5);
        return acc + charCount;
      }, 0);

      // Calculate average (with safety check)
      if (totalChars > 0) {
        return Math.round(totalChars / effectiveChunkCount);
      }
    }

    return 0;
  };

  /**
   * Check if this KB uses Qdrant-only storage (file uploads)
   */
  const isQdrantOnlyStorage = (): boolean => {
    if (!Array.isArray(documents) || documents.length === 0) return false;

    const hasFileUploads = documents.some(
      (doc: KBDocument) => doc.source_type === 'file_upload'
    );
    const hasQdrantOnlyMeta = documents.some(
      (doc: KBDocument) => (doc as any).processing_metadata?.chunk_storage_location === 'qdrant_only'
    );

    return hasFileUploads || hasQdrantOnlyMeta;
  };

  /**
   * Check if a document can be edited
   * File upload documents cannot be edited since content is in Qdrant only
   */
  const canEditDocument = (doc: KBDocument): boolean => {
    // File upload documents cannot be edited - content is in Qdrant only
    if (doc.source_type === 'file_upload') return false;
    // Qdrant-only storage documents cannot be edited
    if ((doc as any).processing_metadata?.chunk_storage_location === 'qdrant_only') return false;
    return true;
  };

  useEffect(() => {
    if (kbId && currentWorkspace) {
      loadKBData();
    }
  }, [kbId, currentWorkspace]);

  const loadKBData = async () => {
    if (!kbId || !currentWorkspace) return;

    setIsLoading(true);
    try {
      // Load KB details
      const kbData = await kbClient.kb.get(kbId);

      // Verify KB belongs to current workspace
      if (kbData.workspace_id !== currentWorkspace.id) {
        // Check if user has access to the KB's workspace
        const kbWorkspace = workspaces.find(ws => ws.id === kbData.workspace_id);

        if (kbWorkspace) {
          // User has access to the workspace, suggest switching
          toast({
            title: 'Wrong Workspace',
            description: `This knowledge base belongs to "${kbWorkspace.name}". Please switch to that workspace to access it.`,
            variant: 'destructive'
          });
        } else {
          // User doesn't have access to the workspace
          toast({
            title: 'Access Denied',
            description: 'You do not have permission to view this knowledge base',
            variant: 'destructive'
          });
        }
        navigate('/knowledge-bases');
        return;
      }

      setKb(kbData);

      // Load documents and chunks in parallel
      const [documentsData, chunksData] = await Promise.all([
        kbClient.kb.getDocuments(kbId),
        kbClient.kb.getChunks(kbId, 1, 100) // Fetch up to 100 chunks to show all
      ]);


      setDocuments(documentsData || []);
      setChunks(chunksData || []);
    } catch (error) {
      console.error('Failed to load KB data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load knowledge base details',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteKB = async () => {
    if (!kbId || !kb) return;

    try {
      await kbClient.kb.delete(kbId);
      toast({
        title: 'Success',
        description: `Knowledge base "${kb.name}" has been deleted`,
      });
      setDeleteDialogOpen(false);
      navigate('/knowledge-bases');
    } catch (error) {
      console.error('Failed to delete KB:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete knowledge base',
        variant: 'destructive'
      });
      setDeleteDialogOpen(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'draft':
        return <Clock className="h-4 w-4 text-orange-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      ready: "default",
      processing: "secondary",
      failed: "destructive",
      draft: "outline"
    };
    return variants[status] || "outline";
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <RefreshCw className="h-12 w-12 mx-auto animate-spin text-primary" />
            <h3 className="text-lg font-medium">Loading Knowledge Base</h3>
            <p className="text-muted-foreground">Fetching details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!kb) {
    return (
      <DashboardLayout>
        <div className="py-8 px-4 sm:px-6 lg:px-8 xl:px-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Knowledge base not found or you don't have access to it.
            </AlertDescription>
          </Alert>
          <Button className="mt-4" onClick={() => navigate('/knowledge-bases')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Knowledge Bases
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="py-8 px-4 sm:px-6 lg:px-8 xl:px-12 space-y-8">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate('/knowledge-bases')}
            className="mb-6 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-manrope"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Knowledge Bases
          </Button>

          <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4 sm:p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-4">
                  <BookOpen className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white font-manrope break-words">
                        {kb.name}
                      </h1>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getStatusIcon(kb.status)}
                        <Badge variant={getStatusBadge(kb.status)} className="font-manrope">
                          {kb.status.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {kb.description && (
                  <p className="text-gray-600 dark:text-gray-400 text-base font-manrope leading-relaxed">
                    {kb.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400 font-manrope">
                  <span className="bg-gray-100 dark:bg-gray-700/50 px-3 py-1 rounded-lg">
                    Created {new Date(kb.created_at).toLocaleDateString()}
                  </span>
                  <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-lg">
                    {Array.isArray(documents) ? documents.length : (kb as any).total_documents || 0} documents
                  </span>
                  <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1 rounded-lg">
                    {getEffectiveChunkCount().toLocaleString()} chunks
                    {isQdrantOnlyStorage() && <span className="ml-1 text-xs opacity-75">(vector DB)</span>}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Direct Settings Button */}
                <Button
                  variant="outline"
                  onClick={() => navigate(`/knowledge-bases/${kbId}/edit`)}
                  className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:border-purple-300 dark:hover:border-purple-600 flex-shrink-0 transition-all duration-200 font-manrope"
                >
                  <Settings className="h-4 w-4 mr-2 text-purple-600 dark:text-purple-400" />
                  Settings
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:border-purple-300 dark:hover:border-purple-600 flex-shrink-0 transition-all duration-200">
                      <MoreHorizontal className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="font-manrope bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-700 rounded-xl shadow-lg backdrop-blur-sm min-w-[160px]">
                  <DropdownMenuItem onClick={loadKBData} className="hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-300 transition-colors duration-200 rounded-lg mx-1 my-1">
                    <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-3" />
                    Refresh
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-700 dark:text-gray-300 hover:text-red-700 dark:hover:text-red-300 transition-colors duration-200 rounded-lg mx-1 my-1">
                    <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400 mr-3" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        </div>

        {/* Statistics Overview */}
        <div>
          {/* Mobile: Horizontal scrolling cards */}
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:hidden scrollbar-hide">
            <div className="flex-shrink-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-4 shadow-sm min-w-[140px]">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300 font-manrope">Documents</span>
                </div>
                <span className="text-xl font-bold text-blue-900 dark:text-blue-100 font-manrope">
                  {Array.isArray(documents) ? documents.length : (kb as any).total_documents || 0}
                </span>
              </div>
            </div>

            <div className="flex-shrink-0 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-200 dark:border-green-700 rounded-xl p-4 shadow-sm min-w-[140px]">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-300 font-manrope">Chunks</span>
                </div>
                <span className="text-xl font-bold text-green-900 dark:text-green-100 font-manrope">
                  {getEffectiveChunkCount().toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex-shrink-0 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border border-purple-200 dark:border-purple-700 rounded-xl p-4 shadow-sm min-w-[140px]">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-medium text-purple-700 dark:text-purple-300 font-manrope">Total Words</span>
                </div>
                <span className="text-xl font-bold text-purple-900 dark:text-purple-100 font-manrope">
                  {Array.isArray(documents)
                    ? documents.reduce((acc, doc) => acc + ((doc as any).word_count || 0), 0).toLocaleString()
                    : '0'}
                </span>
              </div>
            </div>

            <div className="flex-shrink-0 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-200 dark:border-amber-700 rounded-xl p-4 shadow-sm min-w-[140px]">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300 font-manrope">Avg Chunk</span>
                </div>
                <span className="text-xl font-bold text-amber-900 dark:text-amber-100 font-manrope">
                  {getAverageChunkSize().toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop: Grid layout */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-700 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300 font-manrope">Documents</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 font-manrope">
                      {Array.isArray(documents) ? documents.length : (kb as any).total_documents || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-200 dark:border-green-700 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Database className="h-6 w-6 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-300 font-manrope">Chunks</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100 font-manrope">
                      {getEffectiveChunkCount().toLocaleString()}
                    </p>
                    {isQdrantOnlyStorage() && (
                      <p className="text-xs text-green-600 dark:text-green-400 font-manrope">Vector DB</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border border-purple-200 dark:border-purple-700 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  <div>
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-300 font-manrope">Total Words</p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 font-manrope">
                      {Array.isArray(documents)
                        ? documents.reduce((acc, doc) => acc + ((doc as any).word_count || 0), 0).toLocaleString()
                        : '0'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-200 dark:border-amber-700 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Database className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300 font-manrope">Avg Chunk Size</p>
                    <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 font-manrope">
                      {getAverageChunkSize().toLocaleString()}
                    </p>
                    {isQdrantOnlyStorage() && getAverageChunkSize() > 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-manrope">chars (estimated)</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm w-full justify-start overflow-x-auto">
              <TabsTrigger
                value="overview"
                className="flex-shrink-0 data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-900 dark:data-[state=active]:text-blue-100 font-medium font-manrope"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="documents"
                className="flex-shrink-0 data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-900 dark:data-[state=active]:text-blue-100 font-medium font-manrope"
              >
                Documents
              </TabsTrigger>
              <TabsTrigger
                value="chunks"
                className="flex-shrink-0 data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-900 dark:data-[state=active]:text-blue-100 font-medium font-manrope"
              >
                Chunks
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="flex-shrink-0 data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-900 dark:data-[state=active]:text-blue-100 font-medium font-manrope"
              >
                Settings
              </TabsTrigger>
              <TabsTrigger
                value="test-search"
                className="flex-shrink-0 data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-900 dark:data-[state=active]:text-blue-100 font-medium font-manrope"
              >
                <Search className="h-4 w-4 mr-1" />
                Test Search
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview">
            <div className="space-y-6">
              <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border-b border-indigo-200 dark:border-indigo-700 rounded-t-xl p-6">
                  <div className="flex items-center gap-3">
                    <Settings className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <CardTitle className="text-xl font-bold text-indigo-900 dark:text-indigo-100 font-manrope">Knowledge Base Information</CardTitle>
                      <CardDescription className="text-indigo-700 dark:text-indigo-300 font-manrope mt-1">
                        Basic information and configuration details
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                      <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope block mb-2">Knowledge Base ID</label>
                      <p className="font-mono text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-3 py-2 rounded border break-all">{kb.id}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                      <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope block mb-2">Context</label>
                      <p className="capitalize text-gray-900 dark:text-gray-100 font-manrope">{kb.context || 'both'}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                      <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope block mb-2">Chunking Strategy</label>
                      <p className="capitalize text-gray-900 dark:text-gray-100 font-manrope">
                        {((kb as any).config?.chunking_config?.strategy ||
                          (kb as any).chunking_config?.strategy ||
                          (kb as any).config?.chunking?.strategy ||
                          'by_heading'
                        ).replace(/_/g, ' ')}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                      <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-manrope block mb-2">Last Updated</label>
                      <p className="text-gray-900 dark:text-gray-100 font-manrope">{kb.updated_at ? new Date(kb.updated_at).toLocaleString() : 'Never'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="documents">
            <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-b border-emerald-200 dark:border-emerald-700 rounded-t-xl p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <CardTitle className="text-xl font-bold text-emerald-900 dark:text-emerald-100 font-manrope">
                        Documents ({Array.isArray(documents) ? documents.length : (kb as any).total_documents || 0})
                      </CardTitle>
                      <CardDescription className="text-emerald-700 dark:text-emerald-300 font-manrope mt-1">
                        All documents in this knowledge base
                      </CardDescription>
                    </div>
                  </div>

                  {/* Manage Documents button - navigates to dedicated documents page */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                    onClick={() => navigate(`/knowledge-bases/${kbId}/documents`)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Manage Documents
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {!Array.isArray(documents) || documents.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No documents yet</h3>
                    <p className="text-muted-foreground">
                      Documents will appear here after processing
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Array.isArray(documents) && documents.map((doc) => (
                      <div key={doc.id} className="bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 rounded-xl p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                              <h4 className="font-semibold text-gray-900 dark:text-gray-100 font-manrope">{(doc as any).name || doc.title}</h4>
                              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 font-manrope">{(doc as any).source_type || 'unknown'}</Badge>
                              <div className="flex items-center gap-1">
                                {getStatusIcon((doc as any).status || 'unknown')}
                                <Badge variant={getStatusBadge((doc as any).status || 'unknown')} className="text-xs font-manrope">
                                  {(doc as any).status || 'unknown'}
                                </Badge>
                              </div>
                            </div>
                            {(doc as any).url && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 font-manrope">
                                <span className="font-medium">Source:</span> <a href={(doc as any).url || '#'} target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline">
                                  {(doc as any).url || '#'}
                                </a>
                              </p>
                            )}
                            {(doc as any).content_preview && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 font-manrope bg-white dark:bg-gray-800 p-3 rounded-lg border">{(doc as any).content_preview || 'No preview available'}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-manrope">
                              <span className="bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded">{(doc as any).word_count || 0} words</span>
                              <span className="bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded">{doc.chunk_count || 0} chunks</span>
                              <span className="bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded">{new Date(doc.created_at).toLocaleString()}</span>
                              {/* Storage location indicator */}
                              {(doc as any).processing_metadata?.chunk_storage_location === 'qdrant_only' && (
                                <Badge variant="outline" className="bg-cyan-50 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300">
                                  Qdrant Only
                                </Badge>
                              )}
                              {/* Enhanced metadata indicator */}
                              {(doc as any).processing_metadata?.enhanced_metadata_enabled && (
                                <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300">
                                  Enhanced Metadata
                                </Badge>
                              )}
                            </div>
                            {/* Processing metadata details */}
                            {(doc as any).processing_metadata && (
                              <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 text-xs">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Strategy:</span>
                                    <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">
                                      {((doc as any).processing_metadata?.chunking_strategy || 'N/A').replace(/_/g, ' ')}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Chunk Size:</span>
                                    <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">
                                      {(doc as any).processing_metadata?.chunk_size || 'N/A'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Overlap:</span>
                                    <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">
                                      {(doc as any).processing_metadata?.chunk_overlap || 'N/A'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Embeddings:</span>
                                    <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">
                                      {(doc as any).processing_metadata?.embeddings_generated || 0}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all duration-200">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="font-manrope bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-700 rounded-xl shadow-lg backdrop-blur-sm min-w-[160px]">
                              <DropdownMenuItem
                                onSelect={() => navigate(`/knowledge-bases/${kbId}/documents/${doc.id}`)}
                                className="hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-300 transition-colors duration-200 rounded-lg mx-1 my-1"
                              >
                                <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-3" />
                                View Content
                              </DropdownMenuItem>
                              {canEditDocument(doc) ? (
                                <DropdownMenuItem
                                  onSelect={() => navigate(`/knowledge-bases/${kbId}/documents/${doc.id}/edit`)}
                                  className="hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-gray-700 dark:text-gray-300 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors duration-200 rounded-lg mx-1 my-1"
                                >
                                  <Edit className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mr-3" />
                                  Edit
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  disabled
                                  className="text-gray-400 dark:text-gray-500 cursor-not-allowed rounded-lg mx-1 my-1"
                                >
                                  <Edit className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-3" />
                                  Edit (File Upload)
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chunks">
            <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <CardHeader className="bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-900/20 dark:to-teal-900/20 border-b border-cyan-200 dark:border-cyan-700 rounded-t-xl p-6">
                <div className="flex items-center gap-3">
                  <Database className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                  <div>
                    <CardTitle className="text-xl font-bold text-cyan-900 dark:text-cyan-100 font-manrope">
                      Chunks ({getEffectiveChunkCount().toLocaleString()})
                      {isQdrantOnlyStorage() && (
                        <Badge variant="outline" className="ml-2 text-xs bg-cyan-50 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300">
                          Vector DB
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-cyan-700 dark:text-cyan-300 font-manrope mt-1">
                      Text chunks used for search and retrieval
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {!Array.isArray(chunks) || chunks.length === 0 ? (
                  (() => {
                    // Get storage info from documents for enhanced metadata display
                    const storageInfo = documents.find(
                      (doc: KBDocument) => (doc as any).processing_metadata?.chunk_storage_location
                    )?.processing_metadata as Record<string, any> | undefined;

                    // Use helper function to check Qdrant-only storage
                    if (isQdrantOnlyStorage() || storageInfo?.chunk_storage_location === 'qdrant_only') {
                      return (
                        <div className="text-center py-8">
                          <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/30 dark:to-blue-900/30 rounded-xl p-6 mx-auto max-w-lg border border-cyan-200 dark:border-cyan-700">
                            <Database className="h-12 w-12 mx-auto text-cyan-600 dark:text-cyan-400 mb-4" />
                            <h3 className="text-lg font-bold text-cyan-900 dark:text-cyan-100 mb-2 font-manrope">
                              Chunks Stored in Vector Database
                            </h3>
                            <p className="text-cyan-700 dark:text-cyan-300 font-manrope mb-4">
                              This knowledge base uses file uploads. Chunks are stored directly in the vector database (Qdrant) for optimal performance and privacy.
                            </p>
                            <div className="grid grid-cols-3 gap-4 mt-4">
                              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-cyan-100 dark:border-cyan-800">
                                <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 font-manrope">
                                  {getEffectiveChunkCount().toLocaleString()}
                                </p>
                                <p className="text-xs text-cyan-700 dark:text-cyan-300 font-manrope">Total Chunks</p>
                              </div>
                              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-cyan-100 dark:border-cyan-800">
                                <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 font-manrope">
                                  {documents.length}
                                </p>
                                <p className="text-xs text-cyan-700 dark:text-cyan-300 font-manrope">Documents</p>
                              </div>
                              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-cyan-100 dark:border-cyan-800">
                                <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 font-manrope">
                                  {getAverageChunkSize().toLocaleString()}
                                </p>
                                <p className="text-xs text-cyan-700 dark:text-cyan-300 font-manrope">Avg Size</p>
                              </div>
                            </div>
                            {storageInfo?.enhanced_metadata_enabled && (
                              <Badge className="mt-4 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-manrope">
                                Enhanced Metadata Enabled
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // Regular empty state for web scraping KBs without chunks
                    return (
                      <div className="text-center py-8">
                        <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No chunks yet</h3>
                        <p className="text-muted-foreground">
                          Chunks will appear here after document processing
                        </p>
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-4">
                    {Array.isArray(chunks) && chunks.slice(0, 20).map((chunk, index) => (
                      <div key={chunk.id} className="bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 rounded-xl p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Database className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 font-manrope">Chunk {chunk.position || index + 1}</span>
                            {chunk.document_name && (
                              <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 font-manrope">
                                {chunk.document_name}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-manrope bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded">
                            {chunk.character_count || 0} chars
                          </span>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 font-manrope leading-relaxed">
                            {chunk.content}
                          </p>
                        </div>
                      </div>
                    ))}
                    {Array.isArray(chunks) && chunks.length > 20 && (
                      <div className="text-center py-6">
                        <div className="bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-900/20 dark:to-teal-900/20 border border-cyan-200 dark:border-cyan-700 rounded-xl p-4">
                          <p className="text-cyan-700 dark:text-cyan-300 font-manrope">
                            Showing first 20 chunks of {Array.isArray(chunks) ? chunks.length : 0} total
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-b border-violet-200 dark:border-violet-700 rounded-t-xl p-6">
                <div className="flex items-center gap-3">
                  <Settings className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                  <div>
                    <CardTitle className="text-xl font-bold text-violet-900 dark:text-violet-100 font-manrope">Knowledge Base Settings</CardTitle>
                    <CardDescription className="text-violet-700 dark:text-violet-300 font-manrope mt-1">
                      Configuration and management options
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-8">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-6">
                    <h4 className="text-lg font-bold text-blue-900 dark:text-blue-100 font-manrope mb-4 flex items-center gap-3">
                      <span className="text-2xl">🔧</span>
                      Chunking Configuration
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-100 dark:border-blue-800">
                        <label className="text-sm font-semibold text-blue-700 dark:text-blue-300 font-manrope block mb-2">Strategy</label>
                        <p className="capitalize text-gray-900 dark:text-gray-100 font-manrope">
                          {((kb as any).config?.chunking_config?.strategy ||
                            (kb as any).chunking_config?.strategy ||
                            (kb as any).config?.chunking?.strategy ||
                            'by_heading'
                          ).replace(/_/g, ' ')}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-100 dark:border-blue-800">
                        <label className="text-sm font-semibold text-blue-700 dark:text-blue-300 font-manrope block mb-2">Chunk Size</label>
                        <p className="text-gray-900 dark:text-gray-100 font-manrope">
                          {(() => {
                            const strategy = (kb as any).config?.chunking_config?.strategy ||
                                          (kb as any).config?.chunking?.strategy;
                            const chunkSize = (kb as any).config?.chunking_config?.chunk_size ??
                                            (kb as any).config?.chunking?.chunk_size;

                            if (strategy === 'no_chunking' || strategy === 'full_content' || chunkSize === null) {
                              return 'Full Document';
                            }
                            if (chunkSize === undefined || chunkSize === 0) {
                              return 'Not Configured';
                            }
                            return `${chunkSize} characters`;
                          })()}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-100 dark:border-blue-800">
                        <label className="text-sm font-semibold text-blue-700 dark:text-blue-300 font-manrope block mb-2">Chunk Overlap</label>
                        <p className="text-gray-900 dark:text-gray-100 font-manrope">
                          {(() => {
                            const strategy = (kb as any).config?.chunking_config?.strategy ||
                                          (kb as any).config?.chunking?.strategy;
                            const chunkOverlap = (kb as any).config?.chunking_config?.chunk_overlap ??
                                                (kb as any).config?.chunking?.chunk_overlap;

                            if (strategy === 'no_chunking' || strategy === 'full_content' || chunkOverlap === null) {
                              return 'Not Applicable';
                            }
                            if (chunkOverlap === undefined) {
                              return 'Not Configured';
                            }
                            return `${chunkOverlap} characters`;
                          })()}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-100 dark:border-blue-800">
                        <label className="text-sm font-semibold text-blue-700 dark:text-blue-300 font-manrope block mb-2">Preserve Headings</label>
                        <p className="text-gray-900 dark:text-gray-100 font-manrope">
                          {((kb as any).config?.chunking_config?.preserve_headings ||
                            (kb as any).chunking_config?.preserve_headings ||
                            (kb as any).config?.chunking?.preserve_headings) ? 'Yes' : 'No'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl p-6">
                    <h4 className="text-lg font-bold text-emerald-900 dark:text-emerald-100 font-manrope mb-4 flex items-center gap-3">
                      <span className="text-2xl">🤖</span>
                      Model & Embedding Configuration
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-emerald-100 dark:border-emerald-800">
                        <label className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 font-manrope block mb-2">Embedding Model</label>
                        <p className="text-gray-900 dark:text-gray-100 font-manrope">
                          {(kb as any).config?.embedding_config?.model ||
                           kb.embedding_config?.model ||
                           'all-MiniLM-L6-v2'}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-emerald-100 dark:border-emerald-800">
                        <label className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 font-manrope block mb-2">Vector Store</label>
                        <p className="text-gray-900 dark:text-gray-100 font-manrope capitalize">
                          {(kb as any).config?.vector_store_config?.provider ||
                           kb.vector_store_config?.provider ||
                           'qdrant'}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-emerald-100 dark:border-emerald-800">
                        <label className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 font-manrope block mb-2">Distance Metric</label>
                        <p className="text-gray-900 dark:text-gray-100 font-manrope capitalize">
                          {(kb as any).config?.vector_store_config?.distance_metric ||
                           kb.vector_store_config?.distance_metric ||
                           (kb.vector_store_config?.settings as any)?.distance_metric ||
                           'cosine'}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-emerald-100 dark:border-emerald-800">
                        <label className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 font-manrope block mb-2">HNSW M</label>
                        <p className="text-gray-900 dark:text-gray-100 font-manrope">
                          {(kb as any).config?.vector_store_config?.hnsw_m ||
                           (kb.vector_store_config?.settings as any)?.hnsw_m ||
                           16}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-emerald-100 dark:border-emerald-800">
                        <label className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 font-manrope block mb-2">Indexing Method</label>
                        <p className="capitalize text-gray-900 dark:text-gray-100 font-manrope">
                          {((kb as any).indexing_method || 'high_quality').replace(/_/g, ' ')}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-emerald-100 dark:border-emerald-800">
                        <label className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 font-manrope block mb-2">Context</label>
                        <p className="capitalize text-gray-900 dark:text-gray-100 font-manrope">{kb.context || 'both'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-6">
                    <h4 className="text-lg font-bold text-purple-900 dark:text-purple-100 font-manrope mb-4 flex items-center gap-3">
                      <span className="text-2xl">🔍</span>
                      Retrieval Configuration
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-100 dark:border-purple-800">
                        <label className="text-sm font-semibold text-purple-700 dark:text-purple-300 font-manrope block mb-2">Search Strategy</label>
                        <p className="text-gray-900 dark:text-gray-100 font-manrope capitalize">
                          {((kb as any).config?.retrieval_config?.strategy ||
                           (kb as any).context_settings?.retrieval_config?.strategy ||
                           'hybrid_search').replace(/_/g, ' ')}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-100 dark:border-purple-800">
                        <label className="text-sm font-semibold text-purple-700 dark:text-purple-300 font-manrope block mb-2">Top K Results</label>
                        <p className="text-gray-900 dark:text-gray-100 font-manrope">
                          {(kb as any).config?.retrieval_config?.top_k ||
                           (kb as any).context_settings?.retrieval_config?.top_k ||
                           5}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-100 dark:border-purple-800">
                        <label className="text-sm font-semibold text-purple-700 dark:text-purple-300 font-manrope block mb-2">Score Threshold</label>
                        <p className="text-gray-900 dark:text-gray-100 font-manrope">
                          {(kb as any).config?.retrieval_config?.score_threshold ||
                           (kb as any).context_settings?.retrieval_config?.score_threshold ||
                           0.7}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200 dark:border-red-700 rounded-xl p-6">
                    <h4 className="text-lg font-bold text-red-900 dark:text-red-100 font-manrope mb-4 flex items-center gap-3">
                      <span className="text-2xl">⚠️</span>
                      Danger Zone
                    </h4>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-red-100 dark:border-red-800">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <h5 className="font-semibold text-gray-900 dark:text-gray-100 font-manrope mb-2">Delete Knowledge Base</h5>
                          <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">
                            This will permanently delete this knowledge base and all its data. This action cannot be undone.
                          </p>
                        </div>
                        <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} className="flex-shrink-0 font-manrope">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="test-search">
            <KBTestSearch
              kbId={kbId || ''}
              kbName={kb.name}
              kbStatus={kb.status}
            />
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 rounded-xl shadow-xl max-w-md">
            <DialogHeader className="text-center pb-4">
              <AlertCircle className="w-12 h-12 mx-auto text-red-600 dark:text-red-400 mb-4" />
              <DialogTitle className="text-xl font-bold text-red-900 dark:text-red-100 font-manrope">Delete Knowledge Base</DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope leading-relaxed mt-3">
                Are you sure you want to delete <span className="font-semibold text-red-700 dark:text-red-300">"{kb?.name}"</span>?
                <br /><br />
                This action <span className="font-semibold">cannot be undone</span> and will permanently remove the knowledge base and all its data.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-6">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                className="flex-1 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-manrope"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteKB}
                className="flex-1 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 font-manrope"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Knowledge Base
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}