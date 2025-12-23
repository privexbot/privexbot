/**
 * Lead Detail Page
 *
 * Shows detailed view of a captured lead with status management and notes
 * Supports leads from both chatbots and chatflows
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Users,
  Mail,
  Phone,
  MapPin,
  Globe,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  MessageCircle,
  Send,
  Terminal,
  Save,
  RefreshCw,
  Bot,
  Building,
  User,
  FileText,
  Shield,
  Activity,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useWorkspaceStore } from '@/store/workspace-store';
import apiClient from '@/lib/api-client';
import { motion } from 'framer-motion';
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
  timezone?: string;
  channel: string;
  source?: string;
  bot_type?: string;
  bot_id?: string;
  session_id?: string;
  ip_address?: string;
  referrer?: string;
  user_agent?: string;
  language?: string;
  status: string;
  notes?: string;
  consent_given?: string;
  consent_timestamp?: string;
  consent_method?: string;
  data_processing_agreed?: string;
  captured_at: string;
  created_at?: string;
  custom_fields?: Record<string, unknown>;
}

// ========================================
// STATUS BADGE COMPONENT
// ========================================

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
    new: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
      icon: <Clock className="w-3 h-3" />,
    },
    contacted: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800',
      icon: <MessageCircle className="w-3 h-3" />,
    },
    qualified: {
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      text: 'text-purple-700 dark:text-purple-300',
      border: 'border-purple-200 dark:border-purple-800',
      icon: <CheckCircle className="w-3 h-3" />,
    },
    converted: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-700 dark:text-green-300',
      border: 'border-green-200 dark:border-green-800',
      icon: <CheckCircle className="w-3 h-3" />,
    },
    unqualified: {
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-700 dark:text-gray-300',
      border: 'border-gray-200 dark:border-gray-700',
      icon: <XCircle className="w-3 h-3" />,
    },
  };

  const config = statusConfig[status] || statusConfig.new;
  const displayName = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border font-manrope',
        config.bg,
        config.text,
        config.border
      )}
    >
      {config.icon}
      {displayName}
    </span>
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
  };

  const normalizedChannel = channel?.toLowerCase() ?? 'website';
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
// INFO ROW COMPONENT
// ========================================

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">{label}</p>
        <p className="text-sm text-gray-900 dark:text-gray-100 font-manrope break-words">{value}</p>
      </div>
    </div>
  );
}

// ========================================
// MAIN COMPONENT
// ========================================

export default function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspaceStore();
  const queryClient = useQueryClient();

  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<string>('new');
  const [notes, setNotes] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);

  // Load lead data
  useEffect(() => {
    if (leadId) {
      loadLeadData();
    }
  }, [leadId]);

  const loadLeadData = async () => {
    if (!leadId) return;

    setIsLoading(true);
    try {
      const response = await apiClient.get(`/leads/${leadId}`);
      const data = response.data;
      setLead(data);
      setStatus(data.status || 'new');
      setNotes(data.notes || '');
    } catch (error) {
      console.error('Failed to load lead:', error);
      toast({
        title: 'Error',
        description: 'Failed to load lead details',
        variant: 'destructive',
      });
      navigate('/leads');
    } finally {
      setIsLoading(false);
    }
  };

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: { status?: string; notes?: string }) => {
      const response = await apiClient.patch(`/leads/${leadId}`, updates);
      return response.data;
    },
    onSuccess: (data) => {
      setLead(data);
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Lead Updated',
        description: 'Lead status and notes have been saved',
      });
    },
    onError: (error) => {
      console.error('Failed to update lead:', error);
      toast({
        title: 'Update Failed',
        description: 'Could not save changes. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Track changes
  useEffect(() => {
    if (lead) {
      const statusChanged = status !== (lead.status || 'new');
      const notesChanged = notes !== (lead.notes || '');
      setHasChanges(statusChanged || notesChanged);
    }
  }, [status, notes, lead]);

  const handleSave = () => {
    updateMutation.mutate({ status, notes });
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
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

  if (!lead) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 font-manrope">Lead not found</p>
              <Button
                variant="outline"
                onClick={() => navigate('/leads')}
                className="mt-4 font-manrope"
              >
                Back to Leads
              </Button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="py-6 sm:py-8 px-4 sm:px-6 lg:px-8 xl:px-12 space-y-6 sm:space-y-8 max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
          >
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/leads')}
                className="h-10 w-10 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 font-manrope">
                  {lead.name || 'Anonymous Lead'}
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <PlatformBadge channel={lead.channel} />
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-manrope">
                    Captured {format(new Date(lead.captured_at || lead.created_at || new Date()), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => loadLeadData()}
                className="flex-1 sm:flex-none font-manrope rounded-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || updateMutation.isPending}
                className="flex-1 sm:flex-none font-manrope bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Status & Notes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-1 space-y-6"
            >
              {/* Status Management */}
              <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope flex items-center gap-2">
                    <Activity className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    Lead Status
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-500 dark:text-gray-400 font-manrope">
                    Track this lead through your pipeline
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">
                      Current Status
                    </Label>
                    <Select value={status} onValueChange={handleStatusChange}>
                      <SelectTrigger className="w-full h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <SelectItem value="new">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-500" />
                            New
                          </div>
                        </SelectItem>
                        <SelectItem value="contacted">
                          <div className="flex items-center gap-2">
                            <MessageCircle className="w-4 h-4 text-amber-500" />
                            Contacted
                          </div>
                        </SelectItem>
                        <SelectItem value="qualified">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-purple-500" />
                            Qualified
                          </div>
                        </SelectItem>
                        <SelectItem value="converted">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            Converted
                          </div>
                        </SelectItem>
                        <SelectItem value="unqualified">
                          <div className="flex items-center gap-2">
                            <XCircle className="w-4 h-4 text-gray-500" />
                            Unqualified
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Visual Status */}
                  <div className="pt-2">
                    <StatusBadge status={status} />
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    Notes
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-500 dark:text-gray-400 font-manrope">
                    Internal notes about this lead
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this lead..."
                    className="min-h-[150px] bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none"
                  />
                </CardContent>
              </Card>
            </motion.div>

            {/* Right Column - Lead Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-2 space-y-6"
            >
              {/* Contact Information */}
              <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope flex items-center gap-2">
                    <User className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <InfoRow icon={User} label="Name" value={lead.name} />
                    <InfoRow icon={Mail} label="Email" value={lead.email} />
                    <InfoRow icon={Phone} label="Phone" value={lead.phone} />
                    <InfoRow icon={Globe} label="Language" value={lead.language} />
                  </div>
                </CardContent>
              </Card>

              {/* Location */}
              <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    Location
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <InfoRow icon={MapPin} label="City" value={lead.city} />
                    <InfoRow icon={MapPin} label="Region" value={lead.region} />
                    <InfoRow icon={Globe} label="Country" value={lead.country} />
                    <InfoRow icon={Clock} label="Timezone" value={lead.timezone} />
                  </div>
                </CardContent>
              </Card>

              {/* Source Information */}
              <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope flex items-center gap-2">
                    <Bot className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    Source
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <InfoRow icon={Bot} label="Bot Type" value={lead.bot_type} />
                    <InfoRow icon={Building} label="Channel" value={lead.channel} />
                    <InfoRow icon={Calendar} label="Captured At" value={lead.captured_at ? format(new Date(lead.captured_at), 'PPpp') : undefined} />
                    <InfoRow icon={Globe} label="Referrer" value={lead.referrer} />
                  </div>
                </CardContent>
              </Card>

              {/* Privacy & Consent */}
              <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope flex items-center gap-2">
                    <Shield className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    Privacy & Consent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-800">
                      <Shield className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Consent Given</p>
                        <div className="mt-1">
                          {lead.consent_given === 'Y' ? (
                            <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400 font-manrope">
                              <CheckCircle className="w-4 h-4" />
                              Yes
                            </span>
                          ) : lead.consent_given === 'P' ? (
                            <span className="inline-flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400 font-manrope">
                              <Clock className="w-4 h-4" />
                              Pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-sm text-red-600 dark:text-red-400 font-manrope">
                              <AlertCircle className="w-4 h-4" />
                              No
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <InfoRow
                      icon={Calendar}
                      label="Consent Timestamp"
                      value={lead.consent_timestamp ? format(new Date(lead.consent_timestamp), 'PPpp') : undefined}
                    />
                    <InfoRow icon={FileText} label="Consent Method" value={lead.consent_method} />
                    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-800 md:border-0">
                      <Shield className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Data Processing Agreed</p>
                        <div className="mt-1">
                          {lead.data_processing_agreed === 'Y' ? (
                            <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400 font-manrope">
                              <CheckCircle className="w-4 h-4" />
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 font-manrope">
                              <AlertCircle className="w-4 h-4" />
                              No
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Custom Fields */}
              {lead.custom_fields && Object.keys(lead.custom_fields).length > 0 && (
                <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-manrope flex items-center gap-2">
                      <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                      Custom Fields
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                      {Object.entries(lead.custom_fields).map(([key, value]) => (
                        <div key={key} className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                          <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope capitalize">
                              {key.replace(/_/g, ' ')}
                            </p>
                            <p className="text-sm text-gray-900 dark:text-gray-100 font-manrope break-words">
                              {String(value)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
