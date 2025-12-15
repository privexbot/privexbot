/**
 * KB Creation Wizard - Multi-step KB creation with draft mode
 *
 * WHY:
 * - Guided KB creation
 * - Multiple document sources
 * - Configuration before processing
 * - Auto-save drafts
 *
 * HOW:
 * - Multi-step wizard
 * - Draft API (/kb-drafts)
 * - File upload, URL crawling, cloud sync
 * - Background processing on finalize
 *
 * DEPENDENCIES:
 * - react-hook-form
 * - zod
 * - @tanstack/react-query
 * - @dnd-kit/core (for file drag-and-drop)
 */

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
  Database,
  Upload,
  Globe,
  Cloud,
  Settings,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useWorkspaceStore } from '@/store/workspace-store';
import apiClient, { handleApiError } from '@/lib/api-client';

const kbSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  chunking_strategy: z.enum(['recursive', 'sentence', 'token']),
  chunk_size: z.number().min(100).max(10000),
  chunk_overlap: z.number().min(0).max(1000),
  embedding_model: z.string(),
});

type KBFormData = z.infer<typeof kbSchema>;

const STEPS = ['Basic Info', 'Add Documents', 'Configure', 'Review'];

export default function KBCreationWizard() {
  const { draftId } = useParams<{ draftId?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspaceStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');

  // Form
  const { register, handleSubmit, watch, formState: { errors } } = useForm<KBFormData>({
    resolver: zodResolver(kbSchema),
    defaultValues: {
      chunking_strategy: 'recursive',
      chunk_size: 1000,
      chunk_overlap: 200,
      embedding_model: 'text-embedding-ada-002',
    },
  });

  // Load or create draft
  const { data: _draft } = useQuery({
    queryKey: ['kb-draft', draftId],
    queryFn: async () => {
      if (draftId) {
        const response = await apiClient.get(`/kb-drafts/${draftId}`);
        return response.data;
      } else {
        const response = await apiClient.post('/kb-drafts/', {
          workspace_id: currentWorkspace?.id,
          initial_data: { name: 'Untitled Knowledge Base' },
        });
        navigate(`/knowledge-bases/create/${response.data.draft_id}`, { replace: true });
        return response.data;
      }
    },
    enabled: !!currentWorkspace,
  });

  // Upload files mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      if (!draftId) {
        throw new Error('No draft ID available');
      }
      const response = await apiClient.post(`/kb-drafts/${draftId}/documents/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'File uploaded successfully' });
    },
    onError: (error) => {
      toast({ title: 'Upload failed', description: handleApiError(error), variant: 'destructive' });
    },
  });

  // Add URL mutation
  const addUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      if (!draftId) {
        throw new Error('No draft ID available');
      }
      const response = await apiClient.post(`/kb-drafts/${draftId}/documents/url`, { url });
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'URL added successfully' });
      setUrls((prev) => [...prev, urlInput]);
      setUrlInput('');
    },
  });

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (data: KBFormData) => {
      if (!draftId) {
        throw new Error('No draft ID available');
      }
      const response = await apiClient.patch(`/kb-drafts/${draftId}`, { updates: data });
      return response.data;
    },
  });

  // Finalize mutation
  const finalizeMutation = useMutation({
    mutationFn: async () => {
      if (!draftId) {
        throw new Error('No draft ID available');
      }
      const response = await apiClient.post(`/kb-drafts/${draftId}/finalize`);
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Knowledge base created!',
        description: `Processing ${data?.documents_queued ?? 0} documents...`,
      });
      navigate(`/knowledge-bases/${data?.kb_id}`);
    },
    onError: (error) => {
      toast({ title: 'Failed to create KB', description: handleApiError(error), variant: 'destructive' });
    },
  });

  // File drop zone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadedFiles((prev) => [...prev, ...acceptedFiles]);
    acceptedFiles.forEach((file) => {
      uploadMutation.mutate(file);
    });
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
  });

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = (data: KBFormData) => {
    updateConfigMutation.mutate(data, {
      onSuccess: () => {
        if (currentStep === STEPS.length - 1) {
          finalizeMutation.mutate();
        } else {
          nextStep();
        }
      },
    });
  };

  return (
    <div className="container mx-auto py-4 sm:py-6 lg:py-8 max-w-4xl px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold flex items-center gap-2 sm:gap-3 font-manrope">
          <Database className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-blue-600 flex-shrink-0" />
          <span className="text-gray-900 dark:text-white">Create Knowledge Base</span>
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm sm:text-base font-manrope">
          Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep]}
        </p>
      </div>

      {/* Progress */}
      <div className="mb-6 sm:mb-8">
        <Progress value={((currentStep + 1) / STEPS.length) * 100} className="h-2 sm:h-3" />
      </div>

      {/* Steps */}
      <div className="bg-card p-4 sm:p-6 lg:p-8 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm min-h-[400px] sm:min-h-[450px]">
        {/* Step 1: Basic Info */}
        {currentStep === 0 && (
          <div className="space-y-4 sm:space-y-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white font-manrope">Basic Information</h2>

            <div className="space-y-1">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">Knowledge Base Name *</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="e.g., Product Documentation"
                className="mt-1 h-11 text-base border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {errors.name && <p className="text-sm text-red-600 dark:text-red-400 mt-1 font-manrope">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="description" className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Describe what this knowledge base contains..."
                className="mt-1 min-h-[100px] sm:min-h-[120px] text-base border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={4}
              />
            </div>
          </div>
        )}

        {/* Step 2: Add Documents */}
        {currentStep === 1 && (
          <div className="space-y-4 sm:space-y-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white font-manrope">Add Documents</h2>

            {/* Enhanced Empty State - No Sources Added Yet */}
            {uploadedFiles.length === 0 && urls.length === 0 && (
              <div className="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-3xl p-6 sm:p-8 lg:p-12 mb-8 shadow-lg shadow-blue-100/50 dark:shadow-blue-900/30 overflow-hidden">
                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-200/40 to-transparent dark:from-indigo-700/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-blue-200/40 to-transparent dark:from-blue-700/20 rounded-full blur-3xl"></div>

                <div className="relative text-center max-w-5xl mx-auto">
                  {/* Header */}
                  <div className="mb-8 sm:mb-10">
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-200/30 dark:shadow-blue-900/30 ring-4 ring-white/50 dark:ring-gray-800/50">
                      <Database className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 text-blue-600 dark:text-blue-400" />
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 dark:from-blue-500/10 dark:to-indigo-500/10 rounded-full animate-pulse"></div>
                    </div>
                    <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-transparent bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 dark:from-blue-100 dark:via-indigo-100 dark:to-purple-100 bg-clip-text font-manrope mb-4">
                      No Sources Added Yet
                    </h3>
                    <p className="text-blue-700 dark:text-blue-300 font-manrope text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto font-medium">
                      Build your knowledge base with multiple content sources
                    </p>
                    <div className="mt-4 px-4 py-2 bg-blue-100/60 dark:bg-blue-900/30 rounded-full inline-block border border-blue-200/60 dark:border-blue-700/40">
                      <p className="text-sm text-blue-600 dark:text-blue-400 font-manrope font-medium">
                        🚀 Get started in just 4 simple steps
                      </p>
                    </div>
                  </div>

                  {/* Step-by-Step Guide */}
                  <div className="mb-10 sm:mb-12">
                    <h4 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white font-manrope mb-6 sm:mb-8">
                      How It Works
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
                      <div className="group relative bg-white/80 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-5 sm:p-6 border border-blue-200/60 dark:border-blue-700/40 shadow-lg shadow-blue-100/30 dark:shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-200/40 dark:hover:shadow-blue-900/30 transition-all duration-300 hover:-translate-y-1">
                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-3">
                          <div className="w-6 h-6 bg-blue-500 rounded-full shadow-lg"></div>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                          <span className="text-white font-bold font-manrope text-xl">1</span>
                        </div>
                        <h4 className="font-bold text-gray-900 dark:text-white font-manrope mb-3 text-base sm:text-lg">
                          Select Source Type
                        </h4>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">
                          Choose from Website, File, or Cloud sources
                        </p>
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </div>

                      <div className="group relative bg-white/80 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-5 sm:p-6 border border-green-200/60 dark:border-green-700/40 shadow-lg shadow-green-100/30 dark:shadow-green-900/20 hover:shadow-xl hover:shadow-green-200/40 dark:hover:shadow-green-900/30 transition-all duration-300 hover:-translate-y-1">
                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-3">
                          <div className="w-6 h-6 bg-green-500 rounded-full shadow-lg"></div>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                          <span className="text-white font-bold font-manrope text-xl">2</span>
                        </div>
                        <h4 className="font-bold text-gray-900 dark:text-white font-manrope mb-3 text-base sm:text-lg">
                          Configure & Preview
                        </h4>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">
                          Set options and preview the content
                        </p>
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 to-green-600 rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </div>

                      <div className="group relative bg-white/80 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-5 sm:p-6 border border-purple-200/60 dark:border-purple-700/40 shadow-lg shadow-purple-100/30 dark:shadow-purple-900/20 hover:shadow-xl hover:shadow-purple-200/40 dark:hover:shadow-purple-900/30 transition-all duration-300 hover:-translate-y-1">
                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-3">
                          <div className="w-6 h-6 bg-purple-500 rounded-full shadow-lg"></div>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                          <span className="text-white font-bold font-manrope text-xl">3</span>
                        </div>
                        <h4 className="font-bold text-gray-900 dark:text-white font-manrope mb-3 text-base sm:text-lg">
                          Approve & Add
                        </h4>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">
                          Review and approve the source
                        </p>
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-400 to-purple-600 rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </div>

                      <div className="group relative bg-white/80 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-5 sm:p-6 border border-amber-200/60 dark:border-amber-700/40 shadow-lg shadow-amber-100/30 dark:shadow-amber-900/20 hover:shadow-xl hover:shadow-amber-200/40 dark:hover:shadow-amber-900/30 transition-all duration-300 hover:-translate-y-1">
                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-3">
                          <div className="w-6 h-6 bg-amber-500 rounded-full shadow-lg"></div>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                          <span className="text-white font-bold font-manrope text-xl">4</span>
                        </div>
                        <h4 className="font-bold text-gray-900 dark:text-white font-manrope mb-3 text-base sm:text-lg">
                          Continue to Approval
                        </h4>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 font-manrope leading-relaxed">
                          Move to the next step when ready
                        </p>
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-amber-600 rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Source Type Cards */}
                  <div className="mb-8 sm:mb-10">
                    <h4 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white font-manrope mb-6 sm:mb-8 text-center px-4">
                      Choose Your Content Source
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 px-2 sm:px-0">
                      <div
                        onClick={() => {
                          const urlSection = document.querySelector('[data-section="url-input"]');
                          urlSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className="group relative bg-gradient-to-br from-white to-blue-50/50 dark:from-gray-800/70 dark:to-blue-900/20 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border-2 border-blue-200/60 dark:border-blue-700/40 hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-200/40 dark:hover:shadow-blue-900/30 cursor-pointer hover:-translate-y-2 active:scale-95 touch-manipulation min-h-[280px] sm:min-h-[320px] flex flex-col justify-between"
                      >
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 sm:transition-opacity duration-300">
                          <div className="w-10 h-10 sm:w-8 sm:h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                            <ChevronRight className="w-5 h-5 sm:w-4 sm:h-4 text-white" />
                          </div>
                        </div>
                        <div className="text-center flex-1">
                          <div className="relative w-20 h-20 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-xl shadow-blue-200/50 dark:shadow-blue-900/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                            <Globe className="w-10 h-10 text-white" />
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/30 to-transparent rounded-3xl animate-pulse"></div>
                          </div>
                          <h4 className="font-bold text-gray-900 dark:text-white font-manrope text-lg sm:text-xl mb-3">
                            Website URLs
                          </h4>
                          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 font-manrope mb-4 sm:mb-6 leading-relaxed px-2">
                            Scrape content from websites, documentation, or blogs
                          </p>
                        </div>
                        <div className="text-center">
                          <div className="flex flex-wrap gap-2 justify-center mb-4">
                            <span className="text-xs sm:text-sm bg-blue-100/80 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-manrope font-medium border border-blue-200/60 dark:border-blue-700/40">
                              Single pages
                            </span>
                            <span className="text-xs sm:text-sm bg-blue-100/80 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-manrope font-medium border border-blue-200/60 dark:border-blue-700/40">
                              Full crawling
                            </span>
                          </div>
                          <div className="text-sm text-blue-600 dark:text-blue-400 font-manrope font-medium opacity-0 group-hover:opacity-100 sm:transition-opacity duration-300">
                            Tap to get started →
                          </div>
                        </div>
                      </div>

                      <div
                        onClick={() => {
                          const fileSection = document.querySelector('[data-section="file-upload"]');
                          fileSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className="group relative bg-gradient-to-br from-white to-green-50/50 dark:from-gray-800/70 dark:to-green-900/20 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border-2 border-green-200/60 dark:border-green-700/40 hover:border-green-400 dark:hover:border-green-500 transition-all duration-300 hover:shadow-2xl hover:shadow-green-200/40 dark:hover:shadow-green-900/30 cursor-pointer hover:-translate-y-2 active:scale-95 touch-manipulation min-h-[280px] sm:min-h-[320px] flex flex-col justify-between"
                      >
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 sm:transition-opacity duration-300">
                          <div className="w-10 h-10 sm:w-8 sm:h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                            <ChevronRight className="w-5 h-5 sm:w-4 sm:h-4 text-white" />
                          </div>
                        </div>
                        <div className="text-center flex-1">
                          <div className="relative w-20 h-20 sm:w-20 sm:h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-xl shadow-green-200/50 dark:shadow-green-900/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                            <Upload className="w-10 h-10 text-white" />
                            <div className="absolute inset-0 bg-gradient-to-br from-green-400/30 to-transparent rounded-3xl animate-pulse"></div>
                          </div>
                          <h4 className="font-bold text-gray-900 dark:text-white font-manrope text-lg sm:text-xl mb-3">
                            File Upload
                          </h4>
                          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 font-manrope mb-4 sm:mb-6 leading-relaxed px-2">
                            Upload documents, PDFs, text files, or presentations
                          </p>
                        </div>
                        <div className="text-center">
                          <div className="flex flex-wrap gap-1 sm:gap-2 justify-center mb-4">
                            <span className="text-xs sm:text-sm bg-green-100/80 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-manrope font-medium border border-green-200/60 dark:border-green-700/40">
                              PDF
                            </span>
                            <span className="text-xs sm:text-sm bg-green-100/80 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-manrope font-medium border border-green-200/60 dark:border-green-700/40">
                              DOCX
                            </span>
                            <span className="text-xs sm:text-sm bg-green-100/80 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-manrope font-medium border border-green-200/60 dark:border-green-700/40">
                              TXT
                            </span>
                            <span className="text-xs sm:text-sm bg-green-100/80 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-manrope font-medium border border-green-200/60 dark:border-green-700/40">
                              MD
                            </span>
                          </div>
                          <div className="text-sm text-green-600 dark:text-green-400 font-manrope font-medium opacity-0 group-hover:opacity-100 sm:transition-opacity duration-300">
                            Tap to get started →
                          </div>
                        </div>
                      </div>

                      <div
                        onClick={() => {
                          const cloudSection = document.querySelector('[data-section="cloud-sources"]');
                          cloudSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className="group relative bg-gradient-to-br from-white to-purple-50/50 dark:from-gray-800/70 dark:to-purple-900/20 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border-2 border-purple-200/60 dark:border-purple-700/40 hover:border-purple-400 dark:hover:border-purple-500 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-200/40 dark:hover:shadow-purple-900/30 cursor-pointer hover:-translate-y-2 active:scale-95 touch-manipulation min-h-[280px] sm:min-h-[320px] flex flex-col justify-between"
                      >
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 sm:transition-opacity duration-300">
                          <div className="w-10 h-10 sm:w-8 sm:h-8 bg-purple-500 rounded-full flex items-center justify-center shadow-lg">
                            <ChevronRight className="w-5 h-5 sm:w-4 sm:h-4 text-white" />
                          </div>
                        </div>
                        <div className="text-center flex-1">
                          <div className="relative w-20 h-20 sm:w-20 sm:h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-xl shadow-purple-200/50 dark:shadow-purple-900/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                            <Cloud className="w-10 h-10 text-white" />
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-400/30 to-transparent rounded-3xl animate-pulse"></div>
                          </div>
                          <h4 className="font-bold text-gray-900 dark:text-white font-manrope text-lg sm:text-xl mb-3">
                            Cloud Sources
                          </h4>
                          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 font-manrope mb-4 sm:mb-6 leading-relaxed px-2">
                            Connect your Notion, Google Drive, or other services
                          </p>
                        </div>
                        <div className="text-center">
                          <div className="flex flex-wrap gap-2 justify-center mb-4">
                            <span className="text-xs sm:text-sm bg-purple-100/80 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-manrope font-medium border border-purple-200/60 dark:border-purple-700/40">
                              Notion
                            </span>
                            <span className="text-xs sm:text-sm bg-purple-100/80 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-manrope font-medium border border-purple-200/60 dark:border-purple-700/40">
                              Google Drive
                            </span>
                          </div>
                          <div className="text-sm text-purple-600 dark:text-purple-400 font-manrope font-medium opacity-0 group-hover:opacity-100 sm:transition-opacity duration-300">
                            Tap to get started →
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Call to Action */}
                  <div className="mt-8 sm:mt-10">
                    <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 rounded-2xl p-6 sm:p-8 shadow-xl shadow-blue-200/40 dark:shadow-blue-900/30 overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-xl"></div>
                      <div className="relative text-center">
                        <div className="flex items-center justify-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-white" />
                          </div>
                          <span className="font-bold text-white font-manrope text-xl sm:text-2xl">
                            Ready to get started?
                          </span>
                        </div>
                        <p className="text-base sm:text-lg text-blue-100 dark:text-blue-200 font-manrope leading-relaxed mb-6 max-w-2xl mx-auto">
                          Choose a source type above and follow the guided process to add your first content source.
                        </p>
                        <div className="flex items-center justify-center gap-2 text-sm text-blue-200 font-manrope">
                          <span className="w-2 h-2 bg-blue-300 rounded-full animate-pulse"></span>
                          <span>Your knowledge base will be ready in minutes</span>
                          <span className="w-2 h-2 bg-blue-300 rounded-full animate-pulse"></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* File Upload */}
            <div data-section="file-upload">
              <h3 className="font-medium mb-3 flex items-center gap-2 text-gray-900 dark:text-white font-manrope text-base sm:text-lg">
                <Upload className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                Upload Files
              </h3>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-4 sm:p-6 lg:p-8 text-center cursor-pointer transition-colors min-h-[120px] sm:min-h-[140px] flex flex-col items-center justify-center ${
                  isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <input {...getInputProps()} />
                {uploadMutation.isPending ? (
                  <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 mx-auto animate-spin text-blue-600 mb-2" />
                ) : (
                  <>
                    <Upload className="w-6 h-6 sm:w-8 sm:h-8 mx-auto text-gray-500 dark:text-gray-400 mb-2 sm:mb-3" />
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 font-manrope mb-1">
                      {isDragActive ? 'Drop files here' : 'Drag & drop files, or click to browse'}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-500 font-manrope">
                      Supports: PDF, DOCX, TXT, MD
                    </p>
                  </>
                )}
              </div>

              {uploadedFiles.length > 0 && (
                <div className="mt-3 sm:mt-4 space-y-2 max-h-32 sm:max-h-40 overflow-y-auto">
                  {uploadedFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 sm:gap-3 text-sm p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <span className="text-gray-900 dark:text-white font-manrope flex-1 truncate" title={file.name}>
                        {file.name}
                      </span>
                      <span className="text-green-600 dark:text-green-400 text-xs font-manrope whitespace-nowrap">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* URL Input */}
            <div data-section="url-input">
              <h3 className="font-medium mb-3 flex items-center gap-2 text-gray-900 dark:text-white font-manrope text-base sm:text-lg">
                <Globe className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                Add Website URLs
              </h3>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Input
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                  }}
                  placeholder="https://example.com/docs"
                  className="flex-1 h-11 text-base border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Button
                  onClick={() => {
                    addUrlMutation.mutate(urlInput);
                  }}
                  disabled={!urlInput || addUrlMutation.isPending}
                  className="h-11 px-4 sm:px-6 bg-blue-600 hover:bg-blue-700 text-white font-manrope rounded-lg whitespace-nowrap"
                >
                  {addUrlMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add URL'
                  )}
                </Button>
              </div>
              {urls.length > 0 && (
                <div className="mt-3 sm:mt-4 space-y-2 max-h-32 sm:max-h-40 overflow-y-auto">
                  {urls.map((url, i) => (
                    <div key={i} className="flex items-center gap-2 sm:gap-3 text-sm p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <span className="text-gray-900 dark:text-white font-manrope flex-1 truncate" title={url}>
                        {url}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cloud Sources */}
            <div data-section="cloud-sources">
              <h3 className="font-medium mb-3 flex items-center gap-2 text-gray-900 dark:text-white font-manrope text-base sm:text-lg">
                <Cloud className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                Connect Cloud Sources
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigate('/credentials?type=notion');
                  }}
                  className="h-11 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg font-manrope"
                >
                  Connect Notion
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigate('/credentials?type=google');
                  }}
                  className="h-11 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg font-manrope"
                >
                  Connect Google Drive
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Configuration */}
        {currentStep === 2 && (
          <div className="space-y-4 sm:space-y-6">
            <h2 className="text-xl sm:text-2xl font-semibold flex items-center gap-2 text-gray-900 dark:text-white font-manrope">
              <Settings className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
              Configuration
            </h2>

            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">Chunking Strategy</Label>
              <Select
                value={watch('chunking_strategy')}
                onValueChange={(value) => {
                  const event = { target: { value } };
                  void register('chunking_strategy').onChange(event);
                }}
              >
                <SelectTrigger className="mt-1 h-11 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recursive">Recursive (Recommended)</SelectItem>
                  <SelectItem value="sentence">Sentence-based</SelectItem>
                  <SelectItem value="token">Token-based</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="chunk_size" className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">Chunk Size</Label>
                <Input
                  id="chunk_size"
                  type="number"
                  {...register('chunk_size', { valueAsNumber: true })}
                  className="mt-1 h-11 text-base border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="chunk_overlap" className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">Chunk Overlap</Label>
                <Input
                  id="chunk_overlap"
                  type="number"
                  {...register('chunk_overlap', { valueAsNumber: true })}
                  className="mt-1 h-11 text-base border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 font-manrope">Embedding Model</Label>
              <Select
                value={watch('embedding_model')}
                onValueChange={(value) => {
                  const event = { target: { value } };
                  void register('embedding_model').onChange(event);
                }}
              >
                <SelectTrigger className="mt-1 h-11 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text-embedding-ada-002">OpenAI Ada 002</SelectItem>
                  <SelectItem value="text-embedding-3-small">OpenAI Embedding 3 Small</SelectItem>
                  <SelectItem value="text-embedding-3-large">OpenAI Embedding 3 Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === 3 && (
          <div className="space-y-4 sm:space-y-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white font-manrope">Review & Create</h2>

            <div className="space-y-4 sm:space-y-6">
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
                <div className="space-y-4">
                  <div className="pb-3 border-b border-gray-200 dark:border-gray-600">
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope mb-1">Name</p>
                    <p className="font-semibold text-gray-900 dark:text-white text-base sm:text-lg font-manrope">{watch('name')}</p>
                  </div>

                  <div className="pb-3 border-b border-gray-200 dark:border-gray-600">
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope mb-1">Documents</p>
                    <p className="font-semibold text-gray-900 dark:text-white text-base font-manrope">
                      {uploadedFiles.length} files, {urls.length} URLs
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope mb-1">Configuration</p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-base font-manrope">
                      <span className="font-semibold text-gray-900 dark:text-white capitalize">
                        {watch('chunking_strategy')}
                      </span>
                      <span className="hidden sm:inline text-gray-400">|</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        Size: <span className="font-semibold text-gray-900 dark:text-white">{watch('chunk_size')}</span>
                      </span>
                      <span className="hidden sm:inline text-gray-400">|</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        Overlap: <span className="font-semibold text-gray-900 dark:text-white">{watch('chunk_overlap')}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <p className="text-sm sm:text-base text-blue-700 dark:text-blue-300 font-manrope leading-relaxed">
                  🚀 Your knowledge base will be created and documents will be processed in the
                  background. You'll be notified when it's ready.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-0 mt-6 sm:mt-8">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === 0}
          className="h-11 sm:h-10 px-4 sm:px-6 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg font-manrope order-2 sm:order-1"
        >
          <ChevronLeft className="w-4 h-4 mr-2 flex-shrink-0" />
          Previous
        </Button>

        {currentStep < STEPS.length - 1 ? (
          <Button
            onClick={(e) => {
              e.preventDefault();
              void handleSubmit(onSubmit)(e);
            }}
            className="h-11 sm:h-10 px-4 sm:px-6 bg-blue-600 hover:bg-blue-700 text-white font-manrope rounded-lg order-1 sm:order-2"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2 flex-shrink-0" />
          </Button>
        ) : (
          <Button
            onClick={(e) => {
              e.preventDefault();
              void handleSubmit(onSubmit)(e);
            }}
            disabled={finalizeMutation.isPending}
            className="h-11 sm:h-12 px-4 sm:px-8 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-manrope rounded-lg order-1 sm:order-2"
          >
            {finalizeMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin flex-shrink-0" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>Create Knowledge Base</span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
