/**
 * Knowledge Base Creation Page
 *
 * Multi-source KB creation with real-time preview and validation
 * Modern, responsive design with consistent branding
 */

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { savePendingOAuth, consumePendingOAuth } from "@/lib/kb-wizard-oauth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Globe,
  Database,
  Cloud,
  CheckCircle2,
  Settings,
  Brain,
} from "lucide-react";
import { useKBStore } from "@/store/kb-store";
import { useApp } from "@/contexts/AppContext";
import {
  SourceType,
  KBContext,
  KBCreationStep,
  StepperState
} from "@/types/knowledge-base";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/components/ui/use-toast";
import { Stepper } from "@/components/ui/stepper";
import { KBSourceList } from "@/components/kb/KBSourceList";
import { KBWebSourceForm } from "@/components/kb/KBWebSourceForm";
import { KBChunkingConfig } from "@/components/kb/KBChunkingConfig";
import { KBChunkingPreview } from "@/components/kb/KBChunkingPreview";
import { KBContentApproval } from "@/components/kb/KBContentApproval";
import { KBPreviewModal } from "@/components/kb/KBPreviewModal";
import { IntegrationsModal } from "@/components/kb/IntegrationsModal";
import { KBModelConfig } from "@/components/kb/KBModelConfig";
import { KBFileUploadForm } from "@/components/kb/KBFileUploadForm";
import NotionIntegration from "@/components/kb/NotionIntegration";
import GoogleIntegration from "@/components/kb/GoogleIntegration";
import { ComingSoon } from "@/components/ui/coming-soon";
import { motion } from "framer-motion";

export default function CreateKnowledgeBasePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentWorkspace } = useApp();
  const [activeSourceType, setActiveSourceType] = useState<
    SourceType | "integrations" | null
  >(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showIntegrationsModal, setShowIntegrationsModal] = useState(false);

  // Stepper state for multi-phase architecture
  const [stepperState, setStepperState] = useState<StepperState>({
    currentStep: KBCreationStep.BASIC_INFO,
    completedSteps: new Set<KBCreationStep>(),
    approvedSources: [],
    chunkingConfig: null,
    modelConfig: null,
    retrievalConfig: null,
  });

  // Define stepper steps
  const steps: any[] = [
    {
      id: KBCreationStep.BASIC_INFO,
      title: "Basic Info",
      description: "Name & settings",
      icon: <Database className="w-4 h-4" />,
    },
    {
      id: KBCreationStep.CONTENT_REVIEW,
      title: "Content Review",
      description: "Add & edit sources",
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      id: KBCreationStep.CONTENT_APPROVAL,
      title: "Content Approval",
      description: "Approve sources",
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    {
      id: KBCreationStep.CHUNKING_CONFIG,
      title: "Chunking",
      description: "Configure chunking",
      icon: <Settings className="w-4 h-4" />,
    },
    {
      id: KBCreationStep.MODEL_CONFIG,
      title: "Model & Store",
      description: "AI configuration",
      icon: <Brain className="w-4 h-4" />,
    },
    {
      id: KBCreationStep.RETRIEVAL_CONFIG,
      title: "Retrieval",
      description: "Search strategy",
      icon: <Brain className="w-4 h-4" />,
    },
    {
      id: KBCreationStep.FINALIZATION,
      title: "Finalize",
      description: "Create KB",
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
  ];

  const {
    // Draft state
    currentDraft,
    draftSources,
    formData,
    formErrors,
    isDraftDirty,
    previewData,
    modelConfig,
    chunkingConfig,
    retrievalConfig,

    // Actions
    createDraft,
    updateFormData,
    addWebSource,
    addFileSource,
    addTextSource,
    updateModelConfig,
    updateRetrievalConfig,
    finalizeDraft,
    validateForm,
    clearDraft,
    validateDraft,
    previewDraft,
    saveDraftToLocalStorage,
    restoreDraftFromLocalStorage,
  } = useKBStore();

  // Restore wizard + draft state on every mount.
  //
  // Two paths:
  //   1) Plain mount / refresh — silently rehydrate `formData` + draft +
  //      sources + configs from localStorage (24-hour TTL handled by the
  //      store helper). Without this, a page refresh wipes the typed
  //      name/description because Zustand state is in-memory.
  //   2) Post-OAuth callback (`?notion_connected=true` / `?google_connected=true`)
  //      — additionally restore the LOCAL React stepper state (current step,
  //      completedSteps, activeSourceType) that the integration components
  //      saved to localStorage just before the full-window redirect.
  //
  // The query param is cleared via replaceState so a manual refresh after
  // the callback doesn't re-trigger the toast or the stepper restore.
  useEffect(() => {
    const notionOk = searchParams.get("notion_connected") === "true";
    const googleOk = searchParams.get("google_connected") === "true";
    const googleErr = searchParams.get("google_error");

    // Always try to restore the Zustand-backed draft. No-op if the user has
    // never opened the wizard before (no localStorage entry).
    restoreDraftFromLocalStorage();

    if (googleErr) {
      toast({
        title: "Google connection failed",
        description:
          googleErr === "token_exchange_failed"
            ? "Google did not accept the authorization code. Verify the OAuth client and try again."
            : googleErr === "no_access_token"
              ? "Google returned no access token. Verify the OAuth client and try again."
              : `Google connection failed (${googleErr}). Verify the OAuth client and try again.`,
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/knowledge-bases/create");
      return;
    }

    if (notionOk || googleOk) {
      // Pull the local stepper React state back from localStorage.
      const snapshot = consumePendingOAuth();
      if (snapshot) {
        setStepperState((prev) => ({
          ...prev,
          currentStep: snapshot.step as KBCreationStep,
          completedSteps: new Set<KBCreationStep>(
            snapshot.completedSteps as KBCreationStep[],
          ),
        }));
        if (snapshot.activeSourceType) {
          setActiveSourceType(
            snapshot.activeSourceType as SourceType | "integrations" | null,
          );
        }
      }

      toast({
        title: notionOk ? "Notion connected" : "Google connected",
        description:
          "Your previous wizard progress has been restored. Continue where you left off.",
      });

      window.history.replaceState({}, "", "/knowledge-bases/create");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ensure draft exists with proper validation
  const ensureDraftExists = async () => {
    if (currentDraft || !currentWorkspace) return currentDraft;

    // Only create draft if we have a name (backend validation requirement)
    const currentName = formData.name.trim();
    if (!currentName) {
      throw new Error("Name is required before creating draft");
    }

    try {
      await createDraft(currentWorkspace.id, {
        name: currentName,
        description: formData.description || "",
        workspace_id: currentWorkspace.id,
        context: formData.context as KBContext,
      });
      return currentDraft;
    } catch (error) {
      console.error("Failed to create draft:", error);
      toast({
        title: "Error",
        description: "Failed to create knowledge base draft",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isDraftDirty) {
        // Auto-save to local storage on unmount
      }
    };
  }, [isDraftDirty]);

  // Sync model config changes to stepper state
  useEffect(() => {
    if (modelConfig && stepperState.modelConfig === null) {
      setStepperState(prev => ({
        ...prev,
        modelConfig: {
          embedding_config: {
            model: modelConfig.embedding.model,
            device: 'cpu',
            batch_size: modelConfig.embedding.batch_size,
            normalize_embeddings: true,
          },
          vector_store_config: {
            provider: modelConfig.vector_store.provider,
            collection_name_prefix: 'kb_',
            distance_metric: (modelConfig.vector_store.settings as any).distance_metric,
          }
        }
      }));
    }
  }, [modelConfig, stepperState.modelConfig]);

  // Sync chunking config changes to stepper state
  useEffect(() => {
    if (chunkingConfig && stepperState.chunkingConfig === null) {
      setStepperState(prev => ({
        ...prev,
        chunkingConfig: {
          strategy: chunkingConfig.strategy,
          chunk_size: chunkingConfig.chunk_size,
          chunk_overlap: chunkingConfig.chunk_overlap,
        }
      }));
    }
  }, [chunkingConfig, stepperState.chunkingConfig]);

  // Sync retrieval config changes to stepper state
  useEffect(() => {
    if (retrievalConfig && stepperState.retrievalConfig === null) {
      setStepperState(prev => ({
        ...prev,
        retrievalConfig: {
          strategy: retrievalConfig.strategy,
          top_k: retrievalConfig.top_k,
          score_threshold: retrievalConfig.score_threshold,
          rerank_enabled: retrievalConfig.rerank_enabled,
        }
      }));
    }
  }, [retrievalConfig, stepperState.retrievalConfig]);

  const handleFormChange = (field: string, value: string) => {
    // Update form data immediately for responsive UI
    updateFormData({ [field]: value });

    // Don't create draft on form changes - only create when adding sources
    // This prevents creating drafts with empty required fields
  };

  const handleAddSource = async (sourceType: SourceType, sourceData: Record<string, unknown>) => {
    try {
      // Ensure draft exists before adding source
      await ensureDraftExists();
      switch (sourceType) {
        case SourceType.WEB:
          if (sourceData.bulk && Array.isArray(sourceData.urls)) {
            // For bulk sources, pass per-URL configs and metadata
            await addWebSource(
              sourceData.urls as string[],
              sourceData.config as Record<string, unknown>,
              sourceData.perUrlConfigs as Record<string, Record<string, unknown>> | undefined,
              sourceData.metadata as Record<string, unknown> | undefined
            );
          } else if (typeof sourceData.url === 'string') {
            // For single source, pass preview pages if available
            await addWebSource(
              sourceData.url,
              sourceData.config as Record<string, unknown>,
              undefined,
              {
                previewPages: sourceData.previewPages,
                ...(sourceData.metadata || {})
              }
            );
          } else {
            throw new Error("No valid URL provided for web source");
          }
          break;
        case SourceType.FILE:
          if (sourceData.file instanceof File) {
            await addFileSource(sourceData.file, sourceData.config as Record<string, unknown>);
          } else {
            throw new Error("No valid file provided");
          }
          break;
        case SourceType.TEXT:
          if (typeof sourceData.content === 'string') {
            await addTextSource(sourceData.content, sourceData.title as string);
          } else {
            throw new Error("No valid content provided for text source");
          }
          break;
        default:
          throw new Error(`Unsupported source type: ${sourceType}`);
      }

      // Calculate URL count for proper messaging
      const urlCount = sourceType === SourceType.WEB && sourceData.bulk && Array.isArray(sourceData.urls)
        ? sourceData.urls.length : 1;

      toast({
        title: `Source${urlCount > 1 ? "s" : ""} Added`,
        description: `${urlCount} source${
          urlCount > 1 ? "s have" : " has"
        } been added to your knowledge base`,
      });

      setActiveSourceType(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to add source";
      toast({
        title: "Error Adding Source",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handlePreview = async () => {
    try {
      // Ensure draft exists before preview
      await ensureDraftExists();
      await previewDraft(5); // Preview first 5 pages
      setShowPreview(true);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to generate preview";
      toast({
        title: "Preview Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleCreate = async () => {
    // Ensure draft exists before validation and creation
    await ensureDraftExists();

    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      // Validate draft
      const validation = await validateDraft();

      if (!validation.is_valid) {
        toast({
          title: "Validation Failed",
          description: validation.errors.join(", "),
          variant: "destructive",
        });
        return;
      }

      // Show warnings if any
      if (validation.warnings.length > 0) {
        const proceed = confirm(
          `Warnings:\n${validation.warnings.join(
            "\n"
          )}\n\nDo you want to proceed?`
        );
        if (!proceed) return;
      }

      // Finalize and create KB
      const result = await finalizeDraft();

      toast({
        title: "Knowledge Base Created",
        description: `Processing started. Estimated time: ${validation.estimated_duration_minutes || 1} minutes`,
      });

      // Navigate to pipeline monitoring page
      navigate(
        `/knowledge-bases/${result.kbId}/pipeline-monitor?pipeline=${result.pipelineId}`
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create knowledge base";
      toast({
        title: "Creation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    if (isDraftDirty) {
      const confirmed = confirm(
        "You have unsaved changes. Are you sure you want to leave?"
      );
      if (!confirmed) return;
    }

    clearDraft();
    navigate("/knowledge-bases");
  };

  // Check if sources have pre-approved pages from immediate preview
  const hasPreApprovedSources = draftSources.some((source) => {
    const metadata = source.metadata as Record<string, unknown> | undefined;
    return metadata?.approvedSources === true;
  });
  const allPagesPreApproved = draftSources.length > 0 && draftSources.every((source) => {
    const metadata = source.metadata as Record<string, unknown> | undefined;
    const pages = (metadata?.previewPages ?? []) as Array<{ is_approved?: boolean }>;
    return pages.length > 0 && pages.every((page) => page.is_approved);
  });

  // Count total pre-approved pages
  const preApprovedPageCount = draftSources.reduce((count: number, source) => {
    const metadata = source.metadata as Record<string, unknown> | undefined;
    const pages = (metadata?.previewPages ?? []) as Array<{ is_approved?: boolean }>;
    return count + pages.filter((p) => p.is_approved).length;
  }, 0);

  // Step navigation functions
  const canNavigateToStep = (stepId: number): boolean => {
    if (stepId <= stepperState.currentStep) return true;

    // Can only proceed to next step if current requirements are met
    switch (stepperState.currentStep) {
      case KBCreationStep.BASIC_INFO:
        return stepId <= KBCreationStep.CONTENT_REVIEW && formData.name.trim() !== '';
      case KBCreationStep.CONTENT_REVIEW:
        return stepId <= KBCreationStep.CONTENT_APPROVAL && (draftSources.length > 0 || (!!previewData && previewData.pages.length > 0));
      case KBCreationStep.CONTENT_APPROVAL:
        // Allow proceeding if there are approved sources OR if all pages are pre-approved
        return stepId <= KBCreationStep.CHUNKING_CONFIG && (stepperState.approvedSources.length > 0 || hasPreApprovedSources || allPagesPreApproved);
      case KBCreationStep.CHUNKING_CONFIG:
        return stepId <= KBCreationStep.MODEL_CONFIG && stepperState.chunkingConfig !== null;
      case KBCreationStep.MODEL_CONFIG:
        return stepId <= KBCreationStep.FINALIZATION && stepperState.modelConfig !== null;
      default:
        return false;
    }
  };

  const handleStepClick = (stepId: number) => {
    if (canNavigateToStep(stepId)) {
      setStepperState(prev => ({ ...prev, currentStep: stepId as KBCreationStep }));
    }
  };

  const completeCurrentStep = () => {
    setStepperState(prev => ({
      ...prev,
      completedSteps: new Set([...prev.completedSteps, prev.currentStep]),
    }));
  };

  const proceedToNextStep = () => {
    completeCurrentStep();
    const nextStep = stepperState.currentStep + 1;
    if (nextStep <= KBCreationStep.FINALIZATION) {
      setStepperState(prev => ({ ...prev, currentStep: nextStep as KBCreationStep }));
    }
  };

  const sourceTypeOptions = [
    {
      type: SourceType.WEB,
      icon: Globe,
      title: "Website",
      description: "Crawl and scrape web pages",
      subtitle: "Available",
      available: true,
    },
    {
      type: SourceType.FILE,
      icon: FileText,
      title: "Files",
      description: "PDF, Word, Text, CSV",
      subtitle: "Available",
      available: true,
    },
    {
      type: "integrations" as const,
      icon: Cloud,
      title: "Integrations",
      description: "Connect cloud services",
      subtitle: "Click to view",
      available: true, // Enable click to open modal
    },
  ];

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="py-6 sm:py-8 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 sm:mb-8"
          >
            <Button
              variant="ghost"
              onClick={() => navigate("/knowledge-bases")}
              className="mb-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 font-manrope"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Knowledge Bases
            </Button>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 font-manrope">
                Create Knowledge Base
              </h1>
              <p className="text-gray-600 dark:text-gray-400 font-manrope">
                Add comprehensive knowledge sources to train your AI chatbots
              </p>
            </div>
          </motion.div>

          {/* Multi-Step Progress Stepper */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6 sm:mb-8"
          >
            <Stepper
              steps={steps}
              currentStep={stepperState.currentStep}
              completedSteps={stepperState.completedSteps}
              onStepClick={handleStepClick}
              canNavigateToStep={canNavigateToStep}
              className="mb-8"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6 sm:space-y-8"
          >
            {/* Step 1: Basic Information */}
            {stepperState.currentStep === KBCreationStep.BASIC_INFO && (
              <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-gray-100 font-manrope">Basic Information</CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope">
                    Configure your knowledge base settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="name" className="text-gray-900 dark:text-gray-100 font-manrope">Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleFormChange("name", e.target.value)}
                        placeholder="e.g., Product Documentation"
                        className={`bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope placeholder:text-gray-400 dark:placeholder:text-gray-500 ${formErrors.name ? "border-red-500 dark:border-red-400" : ""}`}
                      />
                      {formErrors.name && (
                        <p className="text-sm text-red-600 dark:text-red-400 font-manrope">{formErrors.name}</p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="workspace" className="text-gray-900 dark:text-gray-100 font-manrope">Workspace</Label>
                      <div className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                        <Database className="h-4 w-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-gray-900 dark:text-gray-100 font-manrope">
                            {currentWorkspace?.name || "Loading..."}
                          </span>
                          <p className="text-sm text-gray-500 dark:text-gray-400 font-manrope truncate">
                            {currentWorkspace?.description || "Current workspace"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="description" className="text-gray-900 dark:text-gray-100 font-manrope">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        handleFormChange("description", e.target.value)
                      }
                      placeholder="Describe what this knowledge base contains..."
                      rows={4}
                      className="bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none"
                    />
                  </div>

                  <div className="space-y-4">
                    <Label className="text-gray-900 dark:text-gray-100 font-manrope">Context *</Label>
                    <RadioGroup
                      value={formData.context}
                      onValueChange={(value) => handleFormChange("context", value)}
                      className="flex flex-col sm:flex-row gap-4"
                    >
                      <div className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <RadioGroupItem value="both" id="both" className="border-gray-300 dark:border-gray-600" />
                        <Label htmlFor="both" className="flex-1 text-gray-900 dark:text-gray-100 font-manrope cursor-pointer">
                          Both Contexts
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <RadioGroupItem value="chatbot" id="chatbot" className="border-gray-300 dark:border-gray-600" />
                        <Label htmlFor="chatbot" className="flex-1 text-gray-900 dark:text-gray-100 font-manrope cursor-pointer">
                          Chatbot Only
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <RadioGroupItem value="chatflow" id="chatflow" className="border-gray-300 dark:border-gray-600" />
                        <Label htmlFor="chatflow" className="flex-1 text-gray-900 dark:text-gray-100 font-manrope cursor-pointer">
                          Chatflow Only
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={proceedToNextStep}
                      disabled={!formData.name.trim()}
                      className="font-manrope bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg shadow-sm hover:shadow-md transition-all"
                    >
                      Continue to Sources
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Content Review & Editing */}
            {stepperState.currentStep === KBCreationStep.CONTENT_REVIEW && (
              <>
                {/* Knowledge Sources */}
                <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-gray-900 dark:text-gray-100 font-manrope">
                      <BookOpen className="h-5 w-5" />
                      Knowledge Sources
                      <span className="text-sm font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                        {draftSources.length} sources
                      </span>
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope">
                      Add content sources and extract their content. Multiple source types supported for comprehensive knowledge bases.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Source Type Selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
                      {sourceTypeOptions.map((option) => {
                        const Icon = option.icon;
                        const isActive = activeSourceType === option.type;
                        const isAvailable = option.available;

                        return (
                          <motion.div
                            key={option.type}
                            whileHover={{ y: isAvailable ? -2 : 0 }}
                            whileTap={{ scale: isAvailable ? 0.98 : 1 }}
                          >
                            <Card
                              className={`transition-all duration-200 ${
                                isAvailable
                                  ? `cursor-pointer ${
                                      isActive
                                        ? "ring-2 ring-blue-500 dark:ring-blue-400 border-blue-200 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30"
                                        : "hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                                    }`
                                  : "opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50"
                              } border border-gray-200 dark:border-gray-700 rounded-lg`}
                              onClick={() => {
                                if (isAvailable) {
                                  if (option.type === "integrations") {
                                    setShowIntegrationsModal(true);
                                  } else {
                                    setActiveSourceType(option.type);
                                  }
                                }
                              }}
                            >
                              <CardContent className="p-4 text-center">
                                <div className="flex flex-col items-center space-y-3">
                                  <Icon
                                    className={`h-6 w-6 ${
                                      isAvailable
                                        ? isActive
                                          ? "text-blue-600 dark:text-blue-400"
                                          : "text-gray-600 dark:text-gray-400"
                                        : "text-gray-400 dark:text-gray-500"
                                    }`}
                                  />
                                  <div>
                                    <h3
                                      className={`font-semibold font-manrope ${
                                        isAvailable ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-500"
                                      }`}
                                    >
                                      {option.title}
                                    </h3>
                                    <p
                                      className={`text-xs font-manrope mt-1 ${
                                        isAvailable
                                          ? "text-gray-600 dark:text-gray-400"
                                          : "text-gray-400 dark:text-gray-500"
                                      }`}
                                    >
                                      {option.description}
                                    </p>
                                    <p
                                      className={`text-xs font-medium font-manrope mt-1 ${
                                        isAvailable
                                          ? "text-green-600 dark:text-green-400"
                                          : "text-orange-600 dark:text-orange-400"
                                      }`}
                                    >
                                      {option.subtitle}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Active Source Form */}
                    {activeSourceType === SourceType.WEB && (
                      <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                        <KBWebSourceForm
                          onAdd={(sourceData) =>
                            handleAddSource(SourceType.WEB, sourceData)
                          }
                          onCancel={() => setActiveSourceType(null)}
                          context={formData.context as KBContext}
                        />
                      </div>
                    )}

                    {activeSourceType === SourceType.FILE && (
                      <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800/50">
                        <KBFileUploadForm
                          onBeforeUpload={ensureDraftExists}
                          onSuccess={() => {
                            toast({
                              title: "Files uploaded",
                              description: "Your files have been processed and added to the knowledge base",
                            });
                            setActiveSourceType(null);
                          }}
                          onCancel={() => setActiveSourceType(null)}
                        />
                      </div>
                    )}

                    {/*
                      Render gates: BOTH currentDraft AND currentWorkspace must
                      exist. Without the workspace check, a post-OAuth-callback
                      remount restores the draft synchronously from localStorage
                      but currentWorkspace is null while AppContext is still
                      refetching. The `currentWorkspace!.id` below would then
                      crash with "Cannot read properties of null (reading 'id')".
                    */}
                    {(activeSourceType as string) === "notion" && currentDraft && currentWorkspace && (
                      <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                        <NotionIntegration
                          draftId={currentDraft.draft_id}
                          workspaceId={currentWorkspace.id}
                          onBeforeOAuthRedirect={() => {
                            saveDraftToLocalStorage();
                            savePendingOAuth({
                              provider: "notion",
                              step: stepperState.currentStep,
                              completedSteps: Array.from(stepperState.completedSteps),
                              activeSourceType: activeSourceType as string | null,
                            });
                          }}
                          onSourcesAdded={() => {
                            setActiveSourceType(null);
                            toast({
                              title: "Notion pages added",
                              description: "Your Notion pages have been added to the knowledge base",
                            });
                          }}
                        />
                      </div>
                    )}

                    {(activeSourceType as string) === "google" && currentDraft && currentWorkspace && (
                      <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                        <GoogleIntegration
                          draftId={currentDraft.draft_id}
                          workspaceId={currentWorkspace.id}
                          onBeforeOAuthRedirect={() => {
                            saveDraftToLocalStorage();
                            savePendingOAuth({
                              provider: "google",
                              step: stepperState.currentStep,
                              completedSteps: Array.from(stepperState.completedSteps),
                              activeSourceType: activeSourceType as string | null,
                            });
                          }}
                          onSourcesAdded={() => {
                            setActiveSourceType(null);
                            toast({
                              title: "Google files added",
                              description: "Your Google Docs/Sheets have been added to the knowledge base",
                            });
                          }}
                        />
                      </div>
                    )}

                    {activeSourceType === "integrations" && (
                      <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                        <ComingSoon
                          title="More Integrations Coming Soon"
                          description="Additional cloud service integrations"
                          icon={<Cloud className="h-8 w-8" />}
                          features={[
                            "Google Docs integration",
                            "Google Sheets import",
                            "Slack conversations",
                            "Microsoft 365 documents",
                          ]}
                        />
                      </div>
                    )}

                    {/* Source List */}
                    <KBSourceList sources={draftSources} />

                    {/* Preview Data Available Notice */}
                    {previewData && previewData.pages.length > 0 && (
                      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                          <div>
                            <span className="text-sm font-medium text-blue-900 dark:text-blue-100 font-manrope">
                              Content Extracted Successfully
                            </span>
                            <p className="text-xs text-blue-700 dark:text-blue-300 font-manrope mt-1">
                              {previewData.pages.length} page(s) ready for approval. Click "Continue to Approval" to review and approve this content.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {formErrors.sources && (
                      <p className="text-sm text-red-600 dark:text-red-400 font-manrope mt-2">
                        {formErrors.sources}
                      </p>
                    )}

                    <div className="flex justify-end pt-6">
                      <Button
                        onClick={proceedToNextStep}
                        disabled={draftSources.length === 0 && (!previewData || previewData.pages.length === 0)}
                        className="font-manrope bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg shadow-sm hover:shadow-md transition-all"
                      >
                        Continue to Approval ({(() => {
                          // Count pages from ALL sources, not just global previewData
                          const totalPages = (draftSources as any[]).reduce((total: number, source: any) => {
                            const sourcePages = source.metadata?.previewPages?.length || 0;
                            return total + sourcePages;
                          }, 0);
                          return totalPages || (draftSources as any[]).length;
                        })()} items)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Step 3: Content Approval */}
            {stepperState.currentStep === KBCreationStep.CONTENT_APPROVAL && (
              <>
                <KBContentApproval
                  onApprove={(approvedSources) => {
                    setStepperState(prev => ({
                      ...prev,
                      approvedSources: [...prev.approvedSources, ...approvedSources],
                    }));
                  }}
                />
                {/* Pre-approved notice */}
                {hasPreApprovedSources && preApprovedPageCount > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4 mt-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <div>
                        <span className="text-sm font-semibold text-green-800 dark:text-green-200 font-manrope">
                          {preApprovedPageCount} page{preApprovedPageCount > 1 ? 's' : ''} pre-approved
                        </span>
                        <p className="text-xs text-green-600 dark:text-green-400 font-manrope mt-0.5">
                          These pages were approved during source addition. You can proceed directly or review them here.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-6">
                  <Button
                    variant="outline"
                    onClick={() => setStepperState(prev => ({ ...prev, currentStep: KBCreationStep.CONTENT_REVIEW as KBCreationStep }))}
                    className="font-manrope rounded-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    Back to Sources
                  </Button>
                  <Button
                    onClick={proceedToNextStep}
                    disabled={stepperState.approvedSources.length === 0 && !hasPreApprovedSources && !allPagesPreApproved && (!previewData || previewData.pages.length === 0)}
                    className="font-manrope bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg shadow-sm hover:shadow-md transition-all"
                  >
                    {hasPreApprovedSources ? 'Continue to Chunking' : 'Continue to Chunking'}
                  </Button>
                </div>
              </>
            )}

            {/* Step 4: Chunking Configuration */}
            {stepperState.currentStep === KBCreationStep.CHUNKING_CONFIG && (
              <>
                <div className="space-y-6">
                  <KBChunkingConfig
                    onConfigChange={(config) => {
                      // Update stepper state to enable next step
                      setStepperState(prev => ({
                        ...prev,
                        chunkingConfig: {
                          strategy: config.strategy,
                          chunk_size: config.chunk_size,
                          chunk_overlap: config.chunk_overlap,
                        }
                      }));
                    }}
                  />
                  <KBChunkingPreview />
                </div>
                <div className="flex justify-between pt-6">
                  <Button
                    variant="outline"
                    onClick={() => setStepperState(prev => ({ ...prev, currentStep: KBCreationStep.CONTENT_APPROVAL as KBCreationStep }))}
                    className="font-manrope rounded-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    Back to Approval
                  </Button>
                  <Button
                    onClick={proceedToNextStep}
                    disabled={stepperState.chunkingConfig === null}
                    className="font-manrope bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg shadow-sm hover:shadow-md transition-all"
                  >
                    Continue to Model Config
                  </Button>
                </div>
              </>
            )}

            {/* Step 5: Model Configuration */}
            {stepperState.currentStep === KBCreationStep.MODEL_CONFIG && (
              <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-gray-900 dark:text-gray-100 font-manrope">
                    <Brain className="h-5 w-5" />
                    Model & Vector Store Configuration
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope">
                    Configure embedding models and vector store settings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <KBModelConfig />
                  <div className="flex justify-between pt-6">
                    <Button
                      variant="outline"
                      onClick={() => setStepperState(prev => ({ ...prev, currentStep: KBCreationStep.CHUNKING_CONFIG as KBCreationStep }))}
                      className="font-manrope rounded-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      Back to Chunking
                    </Button>
                    <Button
                      onClick={proceedToNextStep}
                      disabled={stepperState.modelConfig === null}
                      className="font-manrope bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg shadow-sm hover:shadow-md transition-all"
                    >
                      Continue to Retrieval
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 6: Retrieval Configuration */}
            {stepperState.currentStep === KBCreationStep.RETRIEVAL_CONFIG && (
              <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-gray-100 font-manrope">Retrieval Configuration</CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope">
                    Configure search strategy and performance parameters
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-6">
                  {/* Search Strategy */}
                  <div className="space-y-3">
                    <Label htmlFor="search-strategy" className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                      Search Strategy
                    </Label>
                    <select
                      id="search-strategy"
                      value={stepperState.retrievalConfig?.strategy || 'hybrid_search'}
                      onChange={(e) => {
                        const newConfig = {
                          ...stepperState.retrievalConfig,
                          strategy: e.target.value as any
                        };
                        setStepperState(prev => ({ ...prev, retrievalConfig: newConfig }));
                        updateRetrievalConfig({ strategy: e.target.value as any });
                      }}
                      className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg font-manrope text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    >
                      <option value="semantic_search">Semantic Search</option>
                      <option value="keyword_search">Keyword Search</option>
                      <option value="hybrid_search">Hybrid Search (Recommended)</option>
                      <option value="mmr">MMR (Diverse Results)</option>
                      <option value="similarity_score_threshold">Threshold-based</option>
                    </select>
                  </div>

                  {/* Performance Parameters */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="top-k" className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                        Max Results (Top-K)
                      </Label>
                      <Input
                        id="top-k"
                        type="number"
                        min="1"
                        max="50"
                        value={stepperState.retrievalConfig?.top_k || 10}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 10;
                          const newConfig = {
                            ...stepperState.retrievalConfig,
                            top_k: value
                          };
                          setStepperState(prev => ({ ...prev, retrievalConfig: newConfig }));
                          updateRetrievalConfig({ top_k: value });
                        }}
                        className="font-manrope"
                      />
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-manrope">
                        Number of content chunks to retrieve (recommended: 5-15)
                      </p>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="score-threshold" className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                        Score Threshold
                      </Label>
                      <Input
                        id="score-threshold"
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={stepperState.retrievalConfig?.score_threshold || 0.7}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0.7;
                          const newConfig = {
                            ...stepperState.retrievalConfig,
                            score_threshold: value
                          };
                          setStepperState(prev => ({ ...prev, retrievalConfig: newConfig }));
                          updateRetrievalConfig({ score_threshold: value });
                        }}
                        className="font-manrope"
                      />
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-manrope">
                        Minimum relevance score (0.0-1.0, recommended: 0.6-0.8)
                      </p>
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <Button
                        variant="outline"
                        onClick={() => setStepperState(prev => ({ ...prev, currentStep: KBCreationStep.MODEL_CONFIG as KBCreationStep }))}
                        className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-manrope font-medium shadow-sm transition-all duration-200 rounded-lg"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Model Config
                      </Button>
                      <Button
                        onClick={proceedToNextStep}
                        className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-500 text-white font-manrope font-medium shadow-sm hover:shadow-md transition-all duration-200 rounded-lg"
                      >
                        Continue to Finalize
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 7: Finalization */}
            {stepperState.currentStep === KBCreationStep.FINALIZATION && (
              <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-gray-100 font-manrope">Finalize Knowledge Base</CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope">
                    Review and create your knowledge base
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                      <h4 className="font-semibold mb-3 text-gray-900 dark:text-gray-100 font-manrope">Configuration Summary</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400 font-manrope">Name:</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100 font-manrope">{formData.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400 font-manrope">Context:</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100 font-manrope">{formData.context}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400 font-manrope">Sources:</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100 font-manrope">{draftSources.length} items</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400 font-manrope">Approved:</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100 font-manrope">
                              {preApprovedPageCount > 0 ? preApprovedPageCount : stepperState.approvedSources.length} items
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between gap-3">
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={() => setStepperState(prev => ({ ...prev, currentStep: KBCreationStep.RETRIEVAL_CONFIG as KBCreationStep }))}
                          className="font-manrope rounded-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                          Back to Retrieval
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleCancel}
                          className="font-manrope rounded-lg border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                          Cancel
                        </Button>
                      </div>

                      <Button
                        onClick={handleCreate}
                        disabled={isCreating || draftSources.length === 0}
                        className="font-manrope bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg shadow-sm hover:shadow-md transition-all min-w-[160px]"
                      >
                        {isCreating
                          ? "Creating..."
                          : `Create Knowledge Base`}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>

          {/* Preview Modal */}
          <KBPreviewModal open={showPreview} onOpenChange={setShowPreview} />

          {/* Integrations Modal */}
          <IntegrationsModal
            open={showIntegrationsModal}
            onOpenChange={setShowIntegrationsModal}
            onSelectIntegration={async (id) => {
              setShowIntegrationsModal(false);
              if (id === "notion") {
                try {
                  await ensureDraftExists();
                  setActiveSourceType("notion" as any);
                } catch {
                  toast({
                    title: "Draft Required",
                    description: "Please enter a name for your knowledge base first",
                    variant: "destructive",
                  });
                }
              } else if (id === "google-docs" || id === "google-sheets") {
                try {
                  await ensureDraftExists();
                  setActiveSourceType("google" as any);
                } catch {
                  toast({
                    title: "Draft Required",
                    description: "Please enter a name for your knowledge base first",
                    variant: "destructive",
                  });
                }
              }
            }}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}