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
} from "lucide-react";
import { useKBStore } from "@/store/kb-store";
import { useApp } from "@/contexts/AppContext";
import { SourceType, KBContext } from "@/types/knowledge-base";
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
import { KBSourceList } from "@/components/kb/KBSourceList";
import { KBWebSourceForm } from "@/components/kb/KBWebSourceForm";
import { KBChunkingConfig } from "@/components/kb/KBChunkingConfig";
import { KBPreviewModal } from "@/components/kb/KBPreviewModal";
import { IntegrationsModal } from "@/components/kb/IntegrationsModal";
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

  const {
    // Draft state
    currentDraft,
    draftSources,
    formData,
    formErrors,
    isDraftDirty,

    // Actions
    createDraft,
    updateFormData,
    addWebSource,
    addFileSource,
    addTextSource,
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

      // Navigate to processing page
      navigate(
        `/knowledge-bases/${result.kbId}/processing?pipeline=${result.pipelineId}`
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

        <div className="space-y-8">
          {/* Basic Information */}
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
            </CardContent>
          </Card>

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
                Choose source types and add content from different sources
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

              {formErrors.sources && (
                <p className="text-sm text-red-500 mt-2">
                  {formErrors.sources}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Chunking Configuration */}
          <KBChunkingConfig />

          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>

            <div className="flex gap-3">
              {draftSources.length > 0 && (
                <Button variant="outline" onClick={handlePreview}>
                  Preview Chunking
                </Button>
              )}

              <Button
                onClick={handleCreate}
                disabled={isCreating || draftSources.length === 0}
                className="min-w-[140px]"
              >
                {isCreating
                  ? "Creating..."
                  : `Create ${draftSources.length} Sources`}
              </Button>
            </div>
          </div>

          {/* Footer Info */}
          <div className="text-center text-sm text-muted-foreground">
            <p>{draftSources.length} knowledge sources ready to create</p>
          </div>
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
