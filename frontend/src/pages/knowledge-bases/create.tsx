/**
 * Knowledge Base Creation Page
 *
 * Multi-source KB creation with real-time preview and validation
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Globe,
  Type,
  Database,
  Cloud,
  Link,
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
import { ComingSoon } from "@/components/ui/coming-soon";

export default function CreateKnowledgeBasePage() {
  const navigate = useNavigate();
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

    // Actions
    createDraft,
    updateFormData,
    addWebSource,
    addFileSource,
    addTextSource,
    updateModelConfig,
    finalizeDraft,
    validateForm,
    clearDraft,
    validateDraft,
    previewDraft,
  } = useKBStore();

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
        description: `Processing started. Estimated time: ${validation.estimated_duration_minutes} minutes`,
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
        return stepId <= KBCreationStep.CHUNKING_CONFIG && stepperState.approvedSources.length > 0;
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
      subtitle: "Coming Soon",
      available: false,
    },
    {
      type: SourceType.TEXT,
      icon: Type,
      title: "Text",
      description: "Paste content directly",
      subtitle: "Coming Soon",
      available: false,
    },
    {
      type: SourceType.COMBINE,
      icon: Link,
      title: "Combine",
      description: "Merge multiple sources",
      subtitle: "Coming Soon",
      available: false,
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
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/knowledge-bases")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sources
          </Button>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Create Knowledge Source
            </h1>
            <p className="text-muted-foreground">
              Add comprehensive knowledge sources to train your chatbots
            </p>
          </div>
        </div>

        {/* Multi-Step Progress Stepper */}
        <div className="mb-8">
          <Stepper
            steps={steps}
            currentStep={stepperState.currentStep}
            completedSteps={stepperState.completedSteps}
            onStepClick={handleStepClick}
            canNavigateToStep={canNavigateToStep}
            className="mb-8"
          />
        </div>

        <div className="space-y-8">
          {/* Step 1: Basic Information */}
          {stepperState.currentStep === KBCreationStep.BASIC_INFO && (
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Configure your knowledge base settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleFormChange("name", e.target.value)}
                      placeholder="e.g., Product Documentation"
                      className={formErrors.name ? "border-red-500" : ""}
                    />
                    {formErrors.name && (
                      <p className="text-sm text-red-500">{formErrors.name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="workspace">Workspace</Label>
                    <div className="flex items-center space-x-2 p-3 border rounded-md bg-muted/50">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {currentWorkspace?.name || "Loading..."}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({currentWorkspace?.description || "Current workspace"})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      handleFormChange("description", e.target.value)
                    }
                    placeholder="Describe what this knowledge base contains..."
                    rows={3}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Context *</Label>
                  <RadioGroup
                    value={formData.context}
                    onValueChange={(value) => handleFormChange("context", value)}
                    className="flex space-x-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="both" id="both" />
                      <Label htmlFor="both">Both</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="chatbot" id="chatbot" />
                      <Label htmlFor="chatbot">Chatbot</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="chatflow" id="chatflow" />
                      <Label htmlFor="chatflow">Chatflow</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="flex justify-end mt-6">
                  <Button
                    onClick={proceedToNextStep}
                    disabled={!formData.name.trim()}
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
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Knowledge Sources
                    <span className="text-sm text-muted-foreground">
                      {draftSources.length} items • Multiple source types supported
                    </span>
                  </CardTitle>
                  <CardDescription>
                    Add content sources and extract their content. Use "Preview Content" to see what will be extracted, then "Approve & Add Source" to proceed.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Source Type Selection */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
                    {sourceTypeOptions.map((option) => {
                      const Icon = option.icon;
                      const isActive = activeSourceType === option.type;
                      const isAvailable = option.available;

                      return (
                        <Card
                          key={option.type}
                          className={`transition-colors ${
                            isAvailable
                              ? `cursor-pointer ${
                                  isActive
                                    ? "ring-2 ring-primary"
                                    : "hover:bg-gray-50"
                                }`
                              : "opacity-60 cursor-not-allowed"
                          }`}
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
                            <div className="flex flex-col items-center space-y-2">
                              <Icon
                                className={`h-8 w-8 ${
                                  isAvailable
                                    ? "text-muted-foreground"
                                    : "text-gray-400"
                                }`}
                              />
                              <div>
                                <h3
                                  className={`font-medium ${
                                    isAvailable ? "" : "text-gray-500"
                                  }`}
                                >
                                  {option.title}
                                </h3>
                                <p
                                  className={`text-xs ${
                                    isAvailable
                                      ? "text-muted-foreground"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {option.description}
                                </p>
                                <p
                                  className={`text-xs font-medium ${
                                    isAvailable
                                      ? "text-green-600"
                                      : "text-orange-600"
                                  }`}
                                >
                                  {option.subtitle}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Active Source Form */}
                  {activeSourceType === SourceType.WEB && (
                    <KBWebSourceForm
                      onAdd={(sourceData) =>
                        handleAddSource(SourceType.WEB, sourceData)
                      }
                      onCancel={() => setActiveSourceType(null)}
                      context={formData.context as KBContext}
                    />
                  )}

                  {activeSourceType === SourceType.FILE && (
                    <ComingSoon
                      title="File Upload"
                      description="Upload documents, PDFs, spreadsheets and other files"
                      icon={<FileText className="h-8 w-8" />}
                      features={[
                        "PDF document processing",
                        "Word document support",
                        "Excel and CSV parsing",
                        "Drag & drop interface",
                        "OCR for scanned documents",
                      ]}
                    />
                  )}

                  {activeSourceType === SourceType.TEXT && (
                    <ComingSoon
                      title="Text Input"
                      description="Add content by directly pasting or typing text"
                      icon={<Type className="h-8 w-8" />}
                      features={[
                        "Rich text formatting",
                        "Markdown support",
                        "Content templates",
                        "Auto-save drafts",
                      ]}
                    />
                  )}

                  {activeSourceType === "integrations" && (
                    <ComingSoon
                      title="Cloud Integrations"
                      description="Connect and sync with your favorite cloud services"
                      icon={<Cloud className="h-8 w-8" />}
                      features={[
                        "Notion workspace sync",
                        "Google Docs integration",
                        "Google Sheets import",
                        "Slack conversations",
                        "Microsoft 365 documents",
                      ]}
                    />
                  )}

                  {/* Source List */}
                  <KBSourceList sources={draftSources} />

                  {/* Preview Data Available Notice */}
                  {previewData && previewData.pages.length > 0 && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">
                          Content Extracted Successfully
                        </span>
                      </div>
                      <p className="text-xs text-blue-700 mt-1">
                        {previewData.pages.length} page(s) ready for approval. Click "Continue to Approval" to review and approve this content.
                      </p>
                    </div>
                  )}

                  {formErrors.sources && (
                    <p className="text-sm text-red-500 mt-2">
                      {formErrors.sources}
                    </p>
                  )}

                  <div className="flex justify-end mt-6">
                    <Button
                      onClick={proceedToNextStep}
                      disabled={draftSources.length === 0 && (!previewData || previewData.pages.length === 0)}
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
              <div className="flex justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={() => setStepperState(prev => ({ ...prev, currentStep: KBCreationStep.CONTENT_REVIEW as KBCreationStep }))}
                >
                  Back to Sources
                </Button>
                <Button
                  onClick={proceedToNextStep}
                  disabled={stepperState.approvedSources.length === 0 && (!previewData || previewData.pages.length === 0)}
                >
                  Continue to Chunking
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
              <div className="flex justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={() => setStepperState(prev => ({ ...prev, currentStep: KBCreationStep.CONTENT_APPROVAL as KBCreationStep }))}
                >
                  Back to Approval
                </Button>
                <Button
                  onClick={proceedToNextStep}
                  disabled={stepperState.chunkingConfig === null}
                >
                  Continue to Model Config
                </Button>
              </div>
            </>
          )}

          {/* Step 5: Model Configuration */}
          {stepperState.currentStep === KBCreationStep.MODEL_CONFIG && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Model & Vector Store Configuration
                </CardTitle>
                <CardDescription>
                  Configure embedding models and vector store settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <KBModelConfig />
                <div className="flex justify-between mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setStepperState(prev => ({ ...prev, currentStep: KBCreationStep.CHUNKING_CONFIG as KBCreationStep }))}
                  >
                    Back to Chunking
                  </Button>
                  <Button
                    onClick={proceedToNextStep}
                    disabled={stepperState.modelConfig === null}
                  >
                    Continue to Finalize
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 6: Finalization */}
          {stepperState.currentStep === KBCreationStep.FINALIZATION && (
            <Card>
              <CardHeader>
                <CardTitle>Finalize Knowledge Base</CardTitle>
                <CardDescription>
                  Review and create your knowledge base
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <h4 className="font-medium mb-2">Configuration Summary</h4>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>• Name: {formData.name}</p>
                      <p>• Context: {formData.context}</p>
                      <p>• Sources: {draftSources.length} items</p>
                      <p>• Approved Sources: {stepperState.approvedSources.length} items</p>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={handleCancel}>
                      Cancel
                    </Button>

                    <div className="flex gap-3">
                      <Button
                        onClick={handleCreate}
                        disabled={isCreating || draftSources.length === 0}
                        className="min-w-[140px]"
                      >
                        {isCreating
                          ? "Creating..."
                          : `Create Knowledge Base`}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Preview Modal */}
        <KBPreviewModal open={showPreview} onOpenChange={setShowPreview} />

        {/* Integrations Modal */}
        <IntegrationsModal
          open={showIntegrationsModal}
          onOpenChange={setShowIntegrationsModal}
        />
      </div>
    </DashboardLayout>
  );
}
