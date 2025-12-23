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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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

interface LeadAnalytics {
  total_leads: number;
  new_leads: number;
  contacted: number;
  qualified: number;
  converted: number;
  conversion_rate: number;
  leads_by_day: { date: string; count: number }[];
  top_bots: { bot_id: string; bot_name: string; bot_type: string; lead_count: number }[];
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
// ANALYTICS CHARTS COMPONENTS
// ========================================

function LeadsOverTimeChart({ data }: { data: { date: string; count: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500 dark:text-gray-400 font-manrope text-sm">
        No data available
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-32">
        {data.slice(-14).map((item, idx) => {
          const height = (item.count / maxCount) * 100;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-manrope opacity-0 group-hover:opacity-100 transition-opacity">
                {item.count}
              </span>
              <div
                className="w-full bg-blue-500 dark:bg-blue-400 rounded-t transition-all duration-300 hover:bg-blue-600 dark:hover:bg-blue-300"
                style={{ height: `${Math.max(height, 4)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 font-manrope">
        <span>{data.length > 0 ? format(new Date(data[Math.max(0, data.length - 14)].date), 'MMM d') : ''}</span>
        <span>{data.length > 0 ? format(new Date(data[data.length - 1].date), 'MMM d') : ''}</span>
      </div>
    </div>
  );
}

function ConversionFunnelChart({
  analytics,
}: {
  analytics: LeadAnalytics;
}) {
  const stages = [
    { label: 'New', count: analytics.new_leads, color: 'bg-blue-500 dark:bg-blue-400' },
    { label: 'Contacted', count: analytics.contacted, color: 'bg-amber-500 dark:bg-amber-400' },
    { label: 'Qualified', count: analytics.qualified, color: 'bg-purple-500 dark:bg-purple-400' },
    { label: 'Converted', count: analytics.converted, color: 'bg-green-500 dark:bg-green-400' },
  ];

  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="space-y-3">
      {stages.map((stage, idx) => {
        const width = (stage.count / maxCount) * 100;
        return (
          <div key={idx} className="space-y-1">
            <div className="flex justify-between text-sm font-manrope">
              <span className="text-gray-700 dark:text-gray-300">{stage.label}</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">{stage.count}</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(width, 2)}%` }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className={cn('h-full rounded-full', stage.color)}
              />
            </div>
          </div>
        );
      })}
      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400 font-manrope">Conversion Rate</span>
          <span className="text-lg font-bold text-green-600 dark:text-green-400 font-manrope">
            {(analytics.conversion_rate * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function TopBotsChart({ bots }: { bots: LeadAnalytics['top_bots'] }) {
  if (!bots || bots.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400 font-manrope text-sm">
        No chatbot data
      </div>
    );
  }

  const maxCount = Math.max(...bots.map((b) => b.lead_count), 1);

  return (
    <div className="space-y-3">
      {bots.slice(0, 5).map((bot, idx) => {
        const width = (bot.lead_count / maxCount) * 100;
        return (
          <div key={bot.bot_id} className="space-y-1">
            <div className="flex justify-between text-sm font-manrope">
              <span className="text-gray-700 dark:text-gray-300 truncate max-w-[70%]">{bot.bot_name}</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">{bot.lead_count}</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AnalyticsSection({ analytics, isLoading }: { analytics: LeadAnalytics | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                <div className="h-32 bg-gray-100 dark:bg-gray-700/50 rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6"
    >
      {/* Leads Over Time */}
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-manrope mb-4">
            Leads Over Time
          </h3>
          <LeadsOverTimeChart data={analytics.leads_by_day} />
        </CardContent>
      </Card>

      {/* Conversion Funnel */}
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-manrope mb-4">
            Conversion Funnel
          </h3>
          <ConversionFunnelChart analytics={analytics} />
        </CardContent>
      </Card>

      {/* Top Performing Bots */}
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-manrope mb-4">
            Top Performing Bots
          </h3>
          <TopBotsChart bots={analytics.top_bots} />
        </CardContent>
      </Card>
    </motion.div>
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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to page 1 when filters change
  const handleFilterChange = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    value: string
  ) => {
    setter(value);
    setCurrentPage(1);
  };

  // Fetch leads with pagination
  const { data: leadsData, isLoading, refetch } = useQuery({
    queryKey: ['leads', currentWorkspace?.id, sourceFilter, statusFilter, dateRange, currentPage, pageSize],
    queryFn: async () => {
      const skip = (currentPage - 1) * pageSize;
      const params: Record<string, string | number | undefined> = {
        workspace_id: currentWorkspace?.id,
        skip,
        limit: pageSize,
      };
      if (sourceFilter !== 'all') params.channel = sourceFilter;
      if (statusFilter !== 'all') params.lead_status = statusFilter;
      if (dateRange !== 'all') params.date_range = dateRange;

      const response = await apiClient.get('/leads/', { params });
      return response.data;
    },
    enabled: !!currentWorkspace,
  });

  const leads: Lead[] = leadsData?.items || [];
  const totalLeads: number = leadsData?.total || 0;
  const totalPages = Math.ceil(totalLeads / pageSize);
  const stats: LeadStats = leadsData?.stats || {
    total_leads: 0,
    leads_this_week: 0,
    leads_this_month: 0,
    top_source: 'N/A',
  };

  // Fetch analytics data
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['leads-analytics', currentWorkspace?.id],
    queryFn: async () => {
      const response = await apiClient.get('/leads/analytics/summary', {
        params: { workspace_id: currentWorkspace?.id, days: 30 },
      });
      return response.data as LeadAnalytics;
    },
    enabled: !!currentWorkspace,
  });

  // Pagination helpers
  const canGoBack = currentPage > 1;
  const canGoForward = currentPage < totalPages;
  const startItem = totalLeads === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalLeads);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const showAround = 1; // Show 1 page around current

    if (totalPages <= 7) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);

      if (currentPage > 3) {
        pages.push('ellipsis');
      }

      const start = Math.max(2, currentPage - showAround);
      const end = Math.min(totalPages - 1, currentPage + showAround);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }

      if (!pages.includes(totalPages)) pages.push(totalPages);
    }

    return pages;
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

  // Export to CSV via backend
  const [isExporting, setIsExporting] = useState(false);

  const exportToCSV = async () => {
    if (!currentWorkspace?.id) return;

    setIsExporting(true);
    try {
      const params: Record<string, string | undefined> = {
        workspace_id: currentWorkspace.id,
      };
      if (statusFilter !== 'all') params.status = statusFilter;

      const response = await apiClient.get('/leads/export/csv', {
        params,
        responseType: 'blob',
      });

      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `leads_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast({ title: 'Leads exported', description: 'CSV file downloaded successfully' });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export leads. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
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
                disabled={totalLeads === 0 || isExporting}
                className="flex-1 sm:flex-none font-manrope bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50"
              >
                {isExporting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export CSV'}</span>
                <span className="sm:hidden">{isExporting ? '...' : 'Export'}</span>
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <UnifiedStatsCard stats={stats} />

          {/* Analytics Charts */}
          <AnalyticsSection analytics={analyticsData ?? null} isLoading={analyticsLoading} />

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
                  <Select value={sourceFilter} onValueChange={(v) => handleFilterChange(setSourceFilter, v)}>
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

                  <Select value={statusFilter} onValueChange={(v) => handleFilterChange(setStatusFilter, v)}>
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

                  <Select value={dateRange} onValueChange={(v) => handleFilterChange(setDateRange, v)}>
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
            <>
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

            {/* Pagination Controls */}
            {totalPages > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      {/* Info */}
                      <div className="text-sm text-gray-600 dark:text-gray-400 font-manrope order-2 sm:order-1">
                        Showing <span className="font-medium text-gray-900 dark:text-gray-100">{startItem}</span> to{' '}
                        <span className="font-medium text-gray-900 dark:text-gray-100">{endItem}</span> of{' '}
                        <span className="font-medium text-gray-900 dark:text-gray-100">{totalLeads}</span> leads
                      </div>

                      {/* Page Controls */}
                      <div className="flex items-center gap-1 order-1 sm:order-2">
                        {/* First Page */}
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setCurrentPage(1)}
                          disabled={!canGoBack}
                          className="h-8 w-8 rounded-lg border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                          <ChevronsLeft className="h-4 w-4" />
                        </Button>

                        {/* Previous Page */}
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={!canGoBack}
                          className="h-8 w-8 rounded-lg border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>

                        {/* Page Numbers */}
                        <div className="hidden sm:flex items-center gap-1 mx-1">
                          {getPageNumbers().map((page, idx) =>
                            page === 'ellipsis' ? (
                              <span
                                key={`ellipsis-${idx}`}
                                className="w-8 h-8 flex items-center justify-center text-gray-400 dark:text-gray-500 font-manrope"
                              >
                                ...
                              </span>
                            ) : (
                              <Button
                                key={page}
                                variant={currentPage === page ? 'default' : 'outline'}
                                size="icon"
                                onClick={() => setCurrentPage(page)}
                                className={cn(
                                  'h-8 w-8 rounded-lg font-manrope text-sm',
                                  currentPage === page
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
                                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                )}
                              >
                                {page}
                              </Button>
                            )
                          )}
                        </div>

                        {/* Mobile Page Indicator */}
                        <span className="sm:hidden px-2 text-sm text-gray-600 dark:text-gray-400 font-manrope">
                          {currentPage} / {totalPages}
                        </span>

                        {/* Next Page */}
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={!canGoForward}
                          className="h-8 w-8 rounded-lg border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>

                        {/* Last Page */}
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={!canGoForward}
                          className="h-8 w-8 rounded-lg border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                          <ChevronsRight className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Page Size Selector */}
                      <div className="flex items-center gap-2 order-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400 font-manrope hidden sm:inline">
                          Per page:
                        </span>
                        <Select
                          value={pageSize.toString()}
                          onValueChange={(v) => {
                            setPageSize(Number(v));
                            setCurrentPage(1);
                          }}
                        >
                          <SelectTrigger className="w-16 h-8 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
