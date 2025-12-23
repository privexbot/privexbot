/**
 * Leads Dashboard
 *
 * Modern analytics-style dashboard for viewing and managing captured leads
 * Features card-driven aesthetic with clean typography and rounded surfaces
 * Consistent with KnowledgeBasesPage and ChatbotsPage design patterns
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { format } from 'date-fns';
import {
  Users,
  Download,
  Search,
  MapPin,
  Mail,
  Phone,
  Calendar,
  TrendingUp,
  Grid3x3,
  CheckCircle,
  AlertCircle,
  Clock,
  Globe,
  Send,
  MessageCircle,
  Terminal,
  RefreshCw,
  Map as MapIcon,
  Zap,
  Eye,
  MoreHorizontal,
  FileText,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useWorkspaceStore } from '@/store/workspace-store';
import apiClient from '@/lib/api-client';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ========================================
// TYPES
// ========================================

interface Lead {
  id: string;
  email?: string;
  phone?: string;
  name?: string;
  city?: string;
  country?: string;
  country_code?: string;
  region?: string;
  location?: {
    city?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  channel: string;
  source?: string;
  bot_type?: string;
  chatbot_id?: string;
  bot_id?: string;
  chatbot_name?: string;
  status?: string;
  notes?: string;
  captured_at: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
  consent_given?: string;
  consent_timestamp?: string;
  custom_fields?: Record<string, unknown>;
}

interface LeadStats {
  total_leads: number;
  leads_this_week: number;
  leads_this_month: number;
  top_source: string;
}

// ========================================
// UNIFIED STATS CARD COMPONENT
// ========================================

function UnifiedStatsCard({ stats }: { stats: LeadStats }) {
  const statItems = [
    {
      icon: Users,
      title: 'Total Leads',
      value: stats.total_leads.toLocaleString(),
      subtitle: 'All time captured',
    },
    {
      icon: TrendingUp,
      title: 'This Week',
      value: stats.leads_this_week.toLocaleString(),
      subtitle: 'Last 7 days',
    },
    {
      icon: Calendar,
      title: 'This Month',
      value: stats.leads_this_month.toLocaleString(),
      subtitle: 'Last 30 days',
    },
    {
      icon: Zap,
      title: 'Top Source',
      value: stats.top_source || 'N/A',
      subtitle: 'Most active channel',
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
                    'flex-1 p-6',
                    index < statItems.length - 1 &&
                      'border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-gray-700'
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
// PLATFORM BADGE COMPONENT
// ========================================

function PlatformBadge({ channel }: { channel: string | undefined }) {
  const badges: Record<string, { icon: React.ReactNode; bg: string; text: string; border: string }> = {
    whatsapp: {
      icon: <Phone className="w-3 h-3" />,
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-700 dark:text-green-300',
      border: 'border-green-200 dark:border-green-800',
    },
    telegram: {
      icon: <Send className="w-3 h-3" />,
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
    },
    discord: {
      icon: <MessageCircle className="w-3 h-3" />,
      bg: 'bg-indigo-100 dark:bg-indigo-900/30',
      text: 'text-indigo-700 dark:text-indigo-300',
      border: 'border-indigo-200 dark:border-indigo-800',
    },
    website: {
      icon: <Globe className="w-3 h-3" />,
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-700 dark:text-gray-300',
      border: 'border-gray-200 dark:border-gray-700',
    },
    api: {
      icon: <Terminal className="w-3 h-3" />,
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      text: 'text-orange-700 dark:text-orange-300',
      border: 'border-orange-200 dark:border-orange-800',
    },
    web: {
      icon: <Globe className="w-3 h-3" />,
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-700 dark:text-gray-300',
      border: 'border-gray-200 dark:border-gray-700',
    },
  };

  const normalizedChannel = channel?.toLowerCase() ?? '';
  const badge = badges[normalizedChannel] ?? badges.website;
  const displayName = channel ? channel.charAt(0).toUpperCase() + channel.slice(1) : 'Website';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border font-manrope',
        badge.bg,
        badge.text,
        badge.border
      )}
    >
      {badge.icon}
      {displayName}
    </span>
  );
}

// ========================================
// CONSENT BADGE COMPONENT
// ========================================

function ConsentBadge({ consent }: { consent: string | undefined }) {
  if (consent === 'Y') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border font-manrope bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
        <CheckCircle className="w-3 h-3" />
        Consented
      </span>
    );
  }
  if (consent === 'P') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border font-manrope bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
        <Clock className="w-3 h-3" />
        Pending
      </span>
    );
  }
  if (consent === 'N') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border font-manrope bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800">
        <AlertCircle className="w-3 h-3" />
        Declined
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border font-manrope bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700">
      <AlertCircle className="w-3 h-3" />
      None
    </span>
  );
}

// ========================================
// STATUS BADGE COMPONENT
// ========================================

function StatusBadge({ status }: { status: string | undefined }) {
  const statusConfig: Record<string, { bg: string; text: string; border: string; label: string }> = {
    new: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
      label: 'New',
    },
    contacted: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800',
      label: 'Contacted',
    },
    qualified: {
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      text: 'text-purple-700 dark:text-purple-300',
      border: 'border-purple-200 dark:border-purple-800',
      label: 'Qualified',
    },
    converted: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-700 dark:text-green-300',
      border: 'border-green-200 dark:border-green-800',
      label: 'Converted',
    },
    unqualified: {
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-600 dark:text-gray-400',
      border: 'border-gray-200 dark:border-gray-700',
      label: 'Unqualified',
    },
  };

  const normalizedStatus = status?.toLowerCase() ?? 'new';
  const config = statusConfig[normalizedStatus] ?? statusConfig.new;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border font-manrope',
        config.bg,
        config.text,
        config.border
      )}
    >
      {config.label}
    </span>
  );
}

// ========================================
// LEAD CARD COMPONENT (Grid View)
// ========================================

interface LeadCardProps {
  lead: Lead;
  index: number;
  onView: (lead: Lead) => void;
}

function LeadCard({ lead, index, onView }: LeadCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -4 }}
      className="h-full"
    >
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 h-full flex flex-col">
        <CardContent className="p-6 flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <Users className="h-6 w-6 text-gray-600 dark:text-gray-400 flex-shrink-0" />
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
                  onClick={() => onView(lead)}
                  className="font-manrope text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Name */}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope line-clamp-1 mb-1">
            {lead.name || 'Anonymous'}
          </h3>
          {lead.chatbot_name && (
            <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope mb-3">
              via {lead.chatbot_name}
            </p>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            <PlatformBadge channel={lead.channel || lead.source} />
            <ConsentBadge consent={lead.consent_given} />
          </div>

          {/* Contact Info */}
          <div className="space-y-2 mb-4 flex-1">
            {lead.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3 w-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300 font-manrope truncate">
                  {lead.email}
                </span>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3 w-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300 font-manrope">
                  {lead.phone}
                </span>
              </div>
            )}
            {lead.city && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-3 w-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300 font-manrope truncate">
                  {lead.city}
                  {lead.country ? `, ${lead.country}` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Date Info */}
          <div className="flex items-center justify-between text-xs pt-3 border-t border-gray-200 dark:border-gray-700">
            <span className="text-gray-500 dark:text-gray-400 font-manrope">Captured</span>
            <span className="text-gray-700 dark:text-gray-300 font-medium font-manrope">
              {format(new Date(lead.captured_at || lead.created_at || new Date()), 'MMM d, yyyy')}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ========================================
// EMPTY STATE COMPONENT
// ========================================

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16"
    >
      <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
        <Users className="h-8 w-8 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope mb-2">
        {hasSearch ? 'No Leads Found' : 'No Leads Yet'}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 font-manrope mb-6 max-w-md mx-auto">
        {hasSearch
          ? 'Try a different search term or adjust your filters'
          : 'Leads will appear here when captured by your chatbots from various channels'}
      </p>
    </motion.div>
  );
}

// ========================================
// MAIN COMPONENT
// ========================================

export default function LeadsDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspaceStore();

  const [viewMode, setViewMode] = useState<'table' | 'grid' | 'map'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');

  // Fetch leads
  const { data: leadsData, isLoading, refetch } = useQuery({
    queryKey: ['leads', currentWorkspace?.id, sourceFilter, statusFilter, dateRange],
    queryFn: async () => {
      const params: Record<string, string | undefined> = { workspace_id: currentWorkspace?.id };
      if (sourceFilter !== 'all') params.channel = sourceFilter;
      if (statusFilter !== 'all') params.lead_status = statusFilter;
      if (dateRange !== 'all') params.date_range = dateRange;

      const response = await apiClient.get('/leads/', { params });
      return response.data;
    },
    enabled: !!currentWorkspace,
  });

  const leads: Lead[] = leadsData?.items || [];
  const stats: LeadStats = leadsData?.stats || {
    total_leads: 0,
    leads_this_week: 0,
    leads_this_month: 0,
    top_source: 'N/A',
  };

  // Filter leads by search
  const filteredLeads = useMemo(() => {
    if (!searchQuery) return leads;

    const query = searchQuery.toLowerCase();
    return leads.filter(
      (lead) =>
        lead.name?.toLowerCase().includes(query) ||
        lead.email?.toLowerCase().includes(query) ||
        lead.phone?.includes(query) ||
        lead.city?.toLowerCase().includes(query) ||
        lead.country?.toLowerCase().includes(query)
    );
  }, [leads, searchQuery]);

  // Get leads with location for map
  const leadsWithLocation = useMemo(() => {
    return filteredLeads.filter(
      (lead) => lead.location?.latitude && lead.location?.longitude
    );
  }, [filteredLeads]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Platform', 'Consent', 'Location', 'Captured At'];
    const rows = filteredLeads.map((lead) => [
      lead.name || '',
      lead.email || '',
      lead.phone || '',
      lead.channel || lead.source || 'website',
      lead.consent_given === 'Y'
        ? 'Consented'
        : lead.consent_given === 'N'
          ? 'Declined'
          : lead.consent_given === 'P'
            ? 'Pending'
            : 'None',
      lead.city ? `${lead.city}, ${lead.country || ''}` : '',
      format(new Date(lead.captured_at || lead.created_at || new Date()), 'yyyy-MM-dd HH:mm:ss'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leads_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: 'Leads exported', description: `${filteredLeads.length} leads exported to CSV` });
  };

  // View lead handler - navigate to detail page
  const handleViewLead = (lead: Lead) => {
    navigate(`/leads/${lead.id}`);
  };

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-center py-32">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
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
                Leads Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1 font-manrope">
                Track and manage captured leads from your chatbots
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
                onClick={exportToCSV}
                disabled={filteredLeads.length === 0}
                className="flex-1 sm:flex-none font-manrope bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg shadow-sm hover:shadow-md transition-all"
              >
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">Export</span>
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
                    placeholder="Search leads by name, email, phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="w-full sm:w-40 h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope">
                      <SelectValue placeholder="Platform" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <SelectItem value="all">All Platforms</SelectItem>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="telegram">Telegram</SelectItem>
                      <SelectItem value="discord">Discord</SelectItem>
                      <SelectItem value="api">API</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-40 h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="converted">Converted</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="w-full sm:w-40 h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope">
                      <SelectValue placeholder="Date Range" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* View Mode Toggle */}
                  <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg ml-auto">
                    <Button
                      variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={() => setViewMode('table')}
                      className="h-8 w-8 rounded text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={() => setViewMode('grid')}
                      className="h-8 w-8 rounded text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      <Grid3x3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'map' ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={() => setViewMode('map')}
                      className="h-8 w-8 rounded text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      <MapIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content */}
          {filteredLeads.length === 0 ? (
            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <CardContent>
                <EmptyState hasSearch={!!searchQuery} />
              </CardContent>
            </Card>
          ) : (
            <AnimatePresence mode="wait">
              {viewMode === 'table' && (
                <motion.div
                  key="table"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800/50">
                          <tr>
                            <th className="text-left p-4 font-medium text-gray-700 dark:text-gray-300 font-manrope text-sm">
                              Name
                            </th>
                            <th className="text-left p-4 font-medium text-gray-700 dark:text-gray-300 font-manrope text-sm">
                              Contact
                            </th>
                            <th className="text-left p-4 font-medium text-gray-700 dark:text-gray-300 font-manrope text-sm hidden md:table-cell">
                              Location
                            </th>
                            <th className="text-left p-4 font-medium text-gray-700 dark:text-gray-300 font-manrope text-sm">
                              Platform
                            </th>
                            <th className="text-left p-4 font-medium text-gray-700 dark:text-gray-300 font-manrope text-sm hidden sm:table-cell">
                              Status
                            </th>
                            <th className="text-left p-4 font-medium text-gray-700 dark:text-gray-300 font-manrope text-sm hidden lg:table-cell">
                              Consent
                            </th>
                            <th className="text-left p-4 font-medium text-gray-700 dark:text-gray-300 font-manrope text-sm">
                              Captured
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {filteredLeads.map((lead, index) => (
                            <motion.tr
                              key={lead.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3, delay: index * 0.02 }}
                              onClick={() => handleViewLead(lead)}
                              className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                            >
                              <td className="p-4">
                                <p className="font-medium text-gray-900 dark:text-gray-100 font-manrope">
                                  {lead.name || 'Anonymous'}
                                </p>
                                {lead.chatbot_name && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                                    via {lead.chatbot_name}
                                  </p>
                                )}
                              </td>

                              <td className="p-4">
                                <div className="space-y-1">
                                  {lead.email && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <Mail className="w-3 h-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                                      <span className="text-gray-700 dark:text-gray-300 font-manrope truncate max-w-[200px]">
                                        {lead.email}
                                      </span>
                                    </div>
                                  )}
                                  {lead.phone && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <Phone className="w-3 h-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                                      <span className="text-gray-700 dark:text-gray-300 font-manrope">
                                        {lead.phone}
                                      </span>
                                      {(lead.custom_fields as Record<string, boolean> | undefined)
                                        ?.phone_verified && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                                          <CheckCircle className="w-2 h-2 mr-0.5" />
                                          Verified
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {!lead.email && !lead.phone && (
                                    <span className="text-sm text-gray-400 dark:text-gray-500 font-manrope">
                                      No contact info
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="p-4 hidden md:table-cell">
                                {lead.city ? (
                                  <div className="flex items-center gap-2 text-sm">
                                    <MapPin className="w-3 h-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                                    <span className="text-gray-700 dark:text-gray-300 font-manrope">
                                      {lead.city}
                                      {lead.country ? `, ${lead.country}` : ''}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-gray-400 dark:text-gray-500 font-manrope">
                                    Unknown
                                  </span>
                                )}
                              </td>

                              <td className="p-4">
                                <PlatformBadge channel={lead.channel || lead.source || 'website'} />
                              </td>

                              <td className="p-4 hidden sm:table-cell">
                                <StatusBadge status={lead.status} />
                              </td>

                              <td className="p-4 hidden lg:table-cell">
                                <ConsentBadge consent={lead.consent_given} />
                              </td>

                              <td className="p-4 text-sm text-gray-600 dark:text-gray-400 font-manrope whitespace-nowrap">
                                {format(
                                  new Date(lead.captured_at || lead.created_at || new Date()),
                                  'MMM d, yyyy'
                                )}
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </motion.div>
              )}

              {viewMode === 'grid' && (
                <motion.div
                  key="grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
                >
                  {filteredLeads.map((lead, index) => (
                    <LeadCard key={lead.id} lead={lead} index={index} onView={handleViewLead} />
                  ))}
                </motion.div>
              )}

              {viewMode === 'map' && (
                <motion.div
                  key="map"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden relative">
                    <div style={{ height: '600px' }}>
                      <MapContainer
                        center={[20, 0]}
                        zoom={2}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={false}
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        {leadsWithLocation.map((lead) => (
                          <Marker
                            key={lead.id}
                            position={[lead.location!.latitude!, lead.location!.longitude!]}
                          >
                            <Popup>
                              <div className="p-2">
                                <h4 className="font-semibold mb-1 font-manrope">
                                  {lead.name || 'Anonymous'}
                                </h4>
                                {lead.email && (
                                  <p className="text-xs mb-1 font-manrope">{lead.email}</p>
                                )}
                                {lead.city && (
                                  <p className="text-xs text-gray-500 font-manrope">
                                    {lead.city}
                                    {lead.country ? `, ${lead.country}` : ''}
                                  </p>
                                )}
                                <p className="text-xs text-gray-400 mt-2 font-manrope">
                                  {format(
                                    new Date(lead.captured_at || lead.created_at || new Date()),
                                    'MMM d, yyyy'
                                  )}
                                </p>
                              </div>
                            </Popup>
                          </Marker>
                        ))}
                      </MapContainer>
                    </div>

                    {leadsWithLocation.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
                        <div className="text-center">
                          <div className="mx-auto w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                            <MapPin className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                          </div>
                          <p className="text-gray-600 dark:text-gray-400 font-manrope">
                            No leads with location data
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 font-manrope mt-1">
                            Location is captured from IP geolocation when available
                          </p>
                        </div>
                      </div>
                    )}
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
