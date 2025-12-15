/**
 * LeadsDashboard - Lead capture analytics with map visualization
 *
 * WHY:
 * - Track captured leads
 * - Geographic visualization
 * - Export capabilities
 * - Search and filtering
 *
 * HOW:
 * - React Query for data fetching
 * - Leaflet for maps
 * - CSV export
 * - Date range filtering
 *
 * DEPENDENCIES:
 * - @tanstack/react-query
 * - react-leaflet
 * - leaflet
 * - date-fns
 * - lucide-react
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { format } from 'date-fns';
import {
  Users,
  Download,
  Search,
  Filter,
  MapPin,
  Mail,
  Phone,
  Calendar,
  TrendingUp,
  Grid3x3,
  Map as MapIcon,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useWorkspaceStore } from '@/store/workspace-store';
import apiClient, { handleApiError } from '@/lib/api-client';

interface Lead {
  id: string;
  email?: string;
  phone?: string;
  name?: string;
  location?: {
    city?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  source: string;
  chatbot_id: string;
  chatbot_name?: string;
  captured_at: string;
  metadata?: Record<string, any>;
}

interface LeadStats {
  total_leads: number;
  leads_this_week: number;
  leads_this_month: number;
  top_source: string;
}

export default function LeadsDashboard() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspaceStore();

  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');

  // Fetch leads
  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['leads', currentWorkspace?.id, sourceFilter, dateRange],
    queryFn: async () => {
      const params: any = { workspace_id: currentWorkspace?.id };
      if (sourceFilter !== 'all') params.source = sourceFilter;
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
        lead.location?.city?.toLowerCase().includes(query)
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
    const headers = ['Name', 'Email', 'Phone', 'Source', 'Location', 'Captured At'];
    const rows = filteredLeads.map((lead) => [
      lead.name || '',
      lead.email || '',
      lead.phone || '',
      lead.source,
      lead.location ? `${lead.location.city}, ${lead.location.country}` : '',
      format(new Date(lead.captured_at), 'yyyy-MM-dd HH:mm:ss'),
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading leads...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Leads Dashboard</h1>
            <p className="text-muted-foreground">{stats.total_leads} total leads captured</p>
          </div>
        </div>

        <Button onClick={exportToCSV} disabled={filteredLeads.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="w-4 h-4" />
            <span className="text-sm">Total Leads</span>
          </div>
          <p className="text-2xl font-bold">{stats.total_leads}</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">This Week</span>
          </div>
          <p className="text-2xl font-bold">{stats.leads_this_week}</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">This Month</span>
          </div>
          <p className="text-2xl font-bold">{stats.leads_this_month}</p>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <MapPin className="w-4 h-4" />
            <span className="text-sm">Top Source</span>
          </div>
          <p className="text-lg font-semibold truncate">{stats.top_source}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, phone..."
            className="pl-10"
          />
        </div>

        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="website">Website</SelectItem>
            <SelectItem value="telegram">Telegram</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1 border rounded-lg p-1">
          <Button
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            <Grid3x3 className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'map' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('map')}
          >
            <MapIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {filteredLeads.length === 0 ? (
        <div className="text-center py-16 bg-card border rounded-lg">
          <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No leads found</h3>
          <p className="text-muted-foreground">
            {searchQuery
              ? 'Try a different search term'
              : 'Leads will appear here when captured by your chatbots'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium">Name</th>
                  <th className="text-left p-4 font-medium">Contact</th>
                  <th className="text-left p-4 font-medium">Location</th>
                  <th className="text-left p-4 font-medium">Source</th>
                  <th className="text-left p-4 font-medium">Captured</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-muted/50 transition">
                    <td className="p-4">
                      <p className="font-medium">{lead.name || 'Anonymous'}</p>
                      {lead.chatbot_name && (
                        <p className="text-xs text-muted-foreground">via {lead.chatbot_name}</p>
                      )}
                    </td>

                    <td className="p-4">
                      <div className="space-y-1">
                        {lead.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-3 h-3 text-muted-foreground" />
                            {lead.email}
                          </div>
                        )}
                        {lead.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            {lead.phone}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="p-4">
                      {lead.location?.city ? (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          {lead.location.city}, {lead.location.country}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Unknown</span>
                      )}
                    </td>

                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {lead.source}
                      </span>
                    </td>

                    <td className="p-4 text-sm text-muted-foreground">
                      {format(new Date(lead.captured_at), 'MMM d, yyyy HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden" style={{ height: '600px' }}>
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
                    <h4 className="font-semibold mb-1">{lead.name || 'Anonymous'}</h4>
                    {lead.email && <p className="text-xs mb-1">{lead.email}</p>}
                    {lead.location && (
                      <p className="text-xs text-muted-foreground">
                        {lead.location.city}, {lead.location.country}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(lead.captured_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {leadsWithLocation.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="text-center">
                <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No leads with location data</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
