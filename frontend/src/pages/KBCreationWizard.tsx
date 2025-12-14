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

            {/* File Upload */}
            <div>
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
            <div>
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
            <div>
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
