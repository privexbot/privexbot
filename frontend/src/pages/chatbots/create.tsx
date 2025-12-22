/**
 * Chatbot Creation Wizard
 *
 * 5-step wizard for creating AI chatbots:
 * 1. Basic Info - Name, description, greeting
 * 2. Prompt & AI Config - System prompt, model settings
 * 3. Knowledge Bases - Attach KBs with priority
 * 4. Appearance & Behavior - Widget styling, memory
 * 5. Deploy - Channel selection, preview, deploy
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Sparkles,
  Database,
  Palette,
  Rocket,
  Check,
  AlertCircle,
  Loader2,
  MessageSquare,
  Globe,
  Send,
  Copy,
  CheckCircle,
  Settings,
  Brain,
  Plus,
  Trash2,
  GripVertical,
} from "lucide-react";
import { useChatbotStore } from "@/store/chatbot-store";
import { useApp } from "@/contexts/AppContext";
import {
  ChatbotCreationStep,
  AIModel,
  DeploymentChannel,
  getModelLabel,
  getChannelLabel,
  DEFAULT_FORM_DATA,
  ChatbotFormErrors,
} from "@/types/chatbot";
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
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useKBStore } from "@/store/kb-store";

// ========================================
// STEP CONFIGURATION
// ========================================

const STEPS = [
  { id: 1, title: "Basic Info", icon: Bot, description: "Name & greeting" },
  { id: 2, title: "Prompt & AI", icon: Sparkles, description: "AI configuration" },
  { id: 3, title: "Knowledge Bases", icon: Database, description: "Connect KBs" },
  { id: 4, title: "Appearance", icon: Palette, description: "Widget styling" },
  { id: 5, title: "Deploy", icon: Rocket, description: "Launch chatbot" },
];

// ========================================
// STEPPER COMPONENT
// ========================================

interface StepperProps {
  currentStep: number;
  onStepClick: (step: number) => void;
  completedSteps: Set<number>;
}

function Stepper({ currentStep, onStepClick, completedSteps }: StepperProps) {
  return (
    <div className="flex items-center justify-center mb-8 overflow-x-auto pb-2">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isCompleted = completedSteps.has(step.id);
        const isClickable = step.id <= currentStep || isCompleted;

        return (
          <div key={step.id} className="flex items-center">
            <button
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              className={cn(
                "flex flex-col items-center gap-2 px-4 py-2 transition-all",
                isClickable && "cursor-pointer",
                !isClickable && "cursor-not-allowed opacity-50"
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                  isActive &&
                    "bg-blue-600 border-blue-600 text-white",
                  isCompleted && !isActive &&
                    "bg-green-600 border-green-600 text-white",
                  !isActive && !isCompleted &&
                    "border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500"
                )}
              >
                {isCompleted && !isActive ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    "text-xs font-medium font-manrope",
                    isActive
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-400"
                  )}
                >
                  {step.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope hidden sm:block">
                  {step.description}
                </p>
              </div>
            </button>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-8 sm:w-16 h-0.5 mx-1",
                  completedSteps.has(step.id)
                    ? "bg-green-600"
                    : "bg-gray-200 dark:bg-gray-700"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ========================================
// STEP 1: BASIC INFO
// ========================================

interface Step1Props {
  formData: typeof DEFAULT_FORM_DATA;
  formErrors: ChatbotFormErrors;
  onUpdate: (data: Partial<typeof DEFAULT_FORM_DATA>) => void;
}

function Step1BasicInfo({ formData, formErrors, onUpdate }: Step1Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label
          htmlFor="name"
          className="text-gray-900 dark:text-gray-100 font-manrope"
        >
          Chatbot Name *
        </Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="e.g., Customer Support Bot"
          className={cn(
            "h-11 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope",
            formErrors.name && "border-red-500"
          )}
        />
        {formErrors.name && (
          <p className="text-sm text-red-500 font-manrope">{formErrors.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="description"
          className="text-gray-900 dark:text-gray-100 font-manrope"
        >
          Description
        </Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Internal description for your team..."
          rows={3}
          className="bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="greeting"
          className="text-gray-900 dark:text-gray-100 font-manrope"
        >
          Greeting Message
        </Label>
        <Textarea
          id="greeting"
          value={formData.messages.greeting || ""}
          onChange={(e) =>
            onUpdate({
              messages: { ...formData.messages, greeting: e.target.value },
            })
          }
          placeholder="Hello! How can I help you today?"
          rows={2}
          className="bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope resize-none"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
          This message appears when users first open the chat widget
        </p>
      </div>
    </div>
  );
}

// ========================================
// STEP 2: PROMPT & AI CONFIG
// ========================================

function Step2PromptAI({ formData, formErrors, onUpdate }: Step1Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label
          htmlFor="system_prompt"
          className="text-gray-900 dark:text-gray-100 font-manrope"
        >
          System Prompt *
        </Label>
        <Textarea
          id="system_prompt"
          value={formData.system_prompt}
          onChange={(e) => onUpdate({ system_prompt: e.target.value })}
          placeholder="You are a helpful assistant..."
          rows={6}
          className={cn(
            "bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope resize-none",
            formErrors.system_prompt && "border-red-500"
          )}
        />
        {formErrors.system_prompt && (
          <p className="text-sm text-red-500 font-manrope">
            {formErrors.system_prompt}
          </p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
          Instructions that define how your chatbot behaves
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-gray-900 dark:text-gray-100 font-manrope">
            AI Model
          </Label>
          <Select
            value={formData.model}
            onValueChange={(value) => onUpdate({ model: value })}
          >
            <SelectTrigger className="h-11 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <SelectItem value={AIModel.SECRET_AI}>
                {getModelLabel(AIModel.SECRET_AI)}
              </SelectItem>
              <SelectItem value={AIModel.GPT4}>
                {getModelLabel(AIModel.GPT4)}
              </SelectItem>
              <SelectItem value={AIModel.GPT35}>
                {getModelLabel(AIModel.GPT35)}
              </SelectItem>
              <SelectItem value={AIModel.LLAMA3}>
                {getModelLabel(AIModel.LLAMA3)}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-gray-900 dark:text-gray-100 font-manrope">
            Max Tokens
          </Label>
          <Input
            type="number"
            value={formData.max_tokens}
            onChange={(e) =>
              onUpdate({ max_tokens: parseInt(e.target.value) || 2000 })
            }
            min={100}
            max={8000}
            className="h-11 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-gray-900 dark:text-gray-100 font-manrope">
            Temperature: {formData.temperature.toFixed(1)}
          </Label>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
            {formData.temperature < 0.5
              ? "More focused"
              : formData.temperature > 1.2
              ? "More creative"
              : "Balanced"}
          </span>
        </div>
        <Slider
          value={[formData.temperature]}
          onValueChange={([value]) => onUpdate({ temperature: value })}
          min={0}
          max={2}
          step={0.1}
          className="w-full"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
          Lower values make responses more deterministic, higher values more
          creative
        </p>
      </div>
    </div>
  );
}

// ========================================
// STEP 3: KNOWLEDGE BASES
// ========================================

interface Step3Props extends Step1Props {
  attachedKBs: { kb_id: string; name: string; enabled: boolean; priority: number }[];
  onAttachKB: (kbId: string, name: string) => Promise<void>;
  onDetachKB: (kbId: string) => Promise<void>;
  onToggleKB: (kbId: string, enabled: boolean) => void;
}

function Step3KnowledgeBases({
  attachedKBs,
  onAttachKB,
  onDetachKB,
  onToggleKB,
}: Step3Props) {
  const navigate = useNavigate();
  const { kbs, fetchKBs, isLoadingList } = useKBStore();
  const { currentWorkspace } = useApp();
  const [isAttaching, setIsAttaching] = useState<string | null>(null);

  useEffect(() => {
    if (currentWorkspace) {
      fetchKBs({ workspace_id: currentWorkspace.id, status: "ready" });
    }
  }, [currentWorkspace, fetchKBs]);

  const handleAttach = async (kb: { id: string; name: string }) => {
    setIsAttaching(kb.id);
    try {
      await onAttachKB(kb.id, kb.name);
      toast({ title: "Knowledge base attached" });
    } catch (error) {
      toast({
        title: "Failed to attach KB",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsAttaching(null);
    }
  };

  const handleDetach = async (kbId: string) => {
    try {
      await onDetachKB(kbId);
      toast({ title: "Knowledge base detached" });
    } catch (error) {
      toast({
        title: "Failed to detach KB",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const availableKBs = kbs.filter(
    (kb) => !attachedKBs.some((attached) => attached.kb_id === kb.id)
  );

  return (
    <div className="space-y-6">
      {/* Attached KBs */}
      {attachedKBs.length > 0 && (
        <div className="space-y-3">
          <Label className="text-gray-900 dark:text-gray-100 font-manrope">
            Attached Knowledge Bases
          </Label>
          <div className="space-y-2">
            {attachedKBs.map((kb) => (
              <div
                key={kb.kb_id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100 font-manrope">
                      {kb.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                      Priority: {kb.priority}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={kb.enabled}
                    onCheckedChange={(checked) => onToggleKB(kb.kb_id, checked)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDetach(kb.kb_id)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available KBs */}
      <div className="space-y-3">
        <Label className="text-gray-900 dark:text-gray-100 font-manrope">
          Available Knowledge Bases
        </Label>
        {isLoadingList ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : availableKBs.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
            <Database className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600 dark:text-gray-400 font-manrope mb-4">
              {kbs.length === 0
                ? "No knowledge bases available"
                : "All knowledge bases are attached"}
            </p>
            <Button
              variant="outline"
              onClick={() => navigate("/knowledge-bases/create")}
              className="font-manrope"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Knowledge Base
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {availableKBs.map((kb) => (
              <div
                key={kb.id}
                className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100 font-manrope">
                        {kb.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                        {kb.total_documents || 0} docs, {kb.total_chunks || 0} chunks
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAttach({ id: kb.id, name: kb.name })}
                    disabled={isAttaching === kb.id}
                    className="font-manrope bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isAttaching === kb.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <Brain className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-700 dark:text-blue-300 font-manrope">
          Attach knowledge bases to enable RAG (Retrieval Augmented Generation).
          Your chatbot will search these KBs to provide accurate, context-aware
          responses.
        </AlertDescription>
      </Alert>
    </div>
  );
}

// ========================================
// STEP 4: APPEARANCE & BEHAVIOR
// ========================================

function Step4Appearance({ formData, onUpdate }: Step1Props) {
  const colorOptions = [
    { value: "#3b82f6", label: "Blue" },
    { value: "#8b5cf6", label: "Purple" },
    { value: "#10b981", label: "Green" },
    { value: "#f59e0b", label: "Orange" },
    { value: "#ef4444", label: "Red" },
    { value: "#6b7280", label: "Gray" },
  ];

  return (
    <div className="space-y-6">
      {/* Widget Position */}
      <div className="space-y-3">
        <Label className="text-gray-900 dark:text-gray-100 font-manrope">
          Widget Position
        </Label>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() =>
              onUpdate({
                appearance: { ...formData.appearance, position: "bottom-right" },
              })
            }
            className={cn(
              "flex-1 font-manrope",
              formData.appearance.position === "bottom-right" &&
                "ring-2 ring-blue-500 border-blue-500"
            )}
          >
            Bottom Right
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              onUpdate({
                appearance: { ...formData.appearance, position: "bottom-left" },
              })
            }
            className={cn(
              "flex-1 font-manrope",
              formData.appearance.position === "bottom-left" &&
                "ring-2 ring-blue-500 border-blue-500"
            )}
          >
            Bottom Left
          </Button>
        </div>
      </div>

      {/* Primary Color */}
      <div className="space-y-3">
        <Label className="text-gray-900 dark:text-gray-100 font-manrope">
          Primary Color
        </Label>
        <div className="flex flex-wrap gap-3">
          {colorOptions.map((color) => (
            <button
              key={color.value}
              onClick={() =>
                onUpdate({
                  appearance: { ...formData.appearance, primary_color: color.value },
                })
              }
              className={cn(
                "w-10 h-10 rounded-full border-2 transition-all",
                formData.appearance.primary_color === color.value
                  ? "ring-2 ring-offset-2 ring-blue-500"
                  : "border-gray-200 dark:border-gray-600"
              )}
              style={{ backgroundColor: color.value }}
              title={color.label}
            />
          ))}
        </div>
      </div>

      {/* Chat Title */}
      <div className="space-y-2">
        <Label className="text-gray-900 dark:text-gray-100 font-manrope">
          Chat Title
        </Label>
        <Input
          value={formData.appearance.chat_title || ""}
          onChange={(e) =>
            onUpdate({
              appearance: { ...formData.appearance, chat_title: e.target.value },
            })
          }
          placeholder="Chat with us"
          className="h-11 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope"
        />
      </div>

      {/* Memory Settings */}
      <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-gray-900 dark:text-gray-100 font-manrope">
              Conversation Memory
            </Label>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope mt-1">
              Remember previous messages in the conversation
            </p>
          </div>
          <Switch
            checked={formData.memory.enabled}
            onCheckedChange={(checked) =>
              onUpdate({ memory: { ...formData.memory, enabled: checked } })
            }
          />
        </div>

        {formData.memory.enabled && (
          <div className="space-y-2">
            <Label className="text-gray-900 dark:text-gray-100 font-manrope text-sm">
              Max Messages to Remember: {formData.memory.max_messages}
            </Label>
            <Slider
              value={[formData.memory.max_messages]}
              onValueChange={([value]) =>
                onUpdate({ memory: { ...formData.memory, max_messages: value } })
              }
              min={5}
              max={50}
              step={5}
              className="w-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ========================================
// STEP 5: DEPLOY
// ========================================

interface Step5Props extends Step1Props {
  isDeploying: boolean;
  deploymentResult: {
    chatbot_id: string;
    api_key: string;
    channels: Record<string, unknown>;
  } | null;
  testMessages: { role: string; content: string }[];
  isTestLoading: boolean;
  onDeploy: () => Promise<void>;
  onSendTestMessage: (message: string) => Promise<void>;
  onClearTest: () => void;
}

function Step5Deploy({
  formData,
  onUpdate,
  isDeploying,
  deploymentResult,
  testMessages,
  isTestLoading,
  onDeploy,
  onSendTestMessage,
  onClearTest,
}: Step5Props) {
  const [testInput, setTestInput] = useState("");
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const handleSendTest = async () => {
    if (!testInput.trim()) return;
    await onSendTestMessage(testInput);
    setTestInput("");
  };

  const copyApiKey = () => {
    if (deploymentResult?.api_key) {
      navigator.clipboard.writeText(deploymentResult.api_key);
      setCopiedApiKey(true);
      setTimeout(() => setCopiedApiKey(false), 2000);
    }
  };

  const embedCode = deploymentResult
    ? `<script>
  window.privexbotConfig = {
    botId: '${deploymentResult.chatbot_id}',
    apiKey: '${deploymentResult.api_key}'
  };
</script>
<script src="https://cdn.privexbot.com/widget.js" async></script>`
    : "";

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  const channelOptions = [
    { type: DeploymentChannel.WEBSITE, icon: Globe, description: "Website widget" },
    { type: DeploymentChannel.API, icon: Settings, description: "REST API access" },
  ];

  const toggleChannel = (type: DeploymentChannel) => {
    const channels = [...formData.channels];
    const existingIndex = channels.findIndex((c) => c.type === type);

    if (existingIndex >= 0) {
      channels[existingIndex] = {
        ...channels[existingIndex],
        enabled: !channels[existingIndex].enabled,
      };
    } else {
      channels.push({ type, enabled: true });
    }

    onUpdate({ channels });
  };

  const isChannelEnabled = (type: DeploymentChannel) => {
    return formData.channels.some((c) => c.type === type && c.enabled);
  };

  if (deploymentResult) {
    return (
      <div className="space-y-6">
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 font-manrope mb-2">
            Chatbot Deployed Successfully!
          </h3>
          <p className="text-gray-600 dark:text-gray-400 font-manrope">
            Your chatbot is now live and ready to use.
          </p>
        </div>

        {/* API Key */}
        <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="text-amber-800 dark:text-amber-200 font-manrope text-base">
              API Key (Save this now!)
            </CardTitle>
            <CardDescription className="text-amber-700 dark:text-amber-300 font-manrope">
              This key is only shown once. Store it securely.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-white dark:bg-gray-800 rounded-lg text-sm font-mono border border-amber-300 dark:border-amber-700 overflow-x-auto">
                {deploymentResult.api_key}
              </code>
              <Button variant="outline" size="icon" onClick={copyApiKey}>
                {copiedApiKey ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Embed Code */}
        <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-gray-100 font-manrope text-base">
              Embed Code
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope">
              Add this code to your website to display the chat widget
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm font-mono overflow-x-auto border border-gray-200 dark:border-gray-700">
                {embedCode}
              </pre>
              <Button
                variant="outline"
                size="sm"
                onClick={copyEmbed}
                className="absolute top-2 right-2"
              >
                {copiedEmbed ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Channel Selection & Deploy */}
      <div className="space-y-6">
        <div className="space-y-3">
          <Label className="text-gray-900 dark:text-gray-100 font-manrope">
            Deployment Channels
          </Label>
          <div className="space-y-2">
            {channelOptions.map((channel) => {
              const Icon = channel.icon;
              const enabled = isChannelEnabled(channel.type);
              return (
                <div
                  key={channel.type}
                  onClick={() => toggleChannel(channel.type)}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all",
                    enabled
                      ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
                      : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:border-gray-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        enabled
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-gray-400"
                      )}
                    />
                    <div>
                      <p
                        className={cn(
                          "font-medium font-manrope",
                          enabled
                            ? "text-blue-900 dark:text-blue-100"
                            : "text-gray-700 dark:text-gray-300"
                        )}
                      >
                        {getChannelLabel(channel.type)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                        {channel.description}
                      </p>
                    </div>
                  </div>
                  <Switch checked={enabled} />
                </div>
              );
            })}
          </div>
        </div>

        <Button
          onClick={onDeploy}
          disabled={isDeploying || !formData.channels.some((c) => c.enabled)}
          className="w-full h-12 font-manrope bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm hover:shadow-md transition-all"
        >
          {isDeploying ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Deploying...
            </>
          ) : (
            <>
              <Rocket className="h-5 w-5 mr-2" />
              Deploy Chatbot
            </>
          )}
        </Button>
      </div>

      {/* Right: Test Preview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-gray-900 dark:text-gray-100 font-manrope">
            Test Preview
          </Label>
          {testMessages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onClearTest}>
              Clear
            </Button>
          )}
        </div>
        <div className="h-[400px] bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {testMessages.length === 0 && (
              <div className="text-center py-12">
                <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400 font-manrope text-sm">
                  Send a message to test your chatbot
                </p>
              </div>
            )}
            {testMessages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[80%] p-3 rounded-lg",
                  msg.role === "user"
                    ? "ml-auto bg-blue-600 text-white"
                    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600"
                )}
              >
                <p className="text-sm font-manrope">{msg.content}</p>
              </div>
            ))}
            {isTestLoading && (
              <div className="max-w-[80%] p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-600">
            <div className="flex gap-2">
              <Input
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendTest()}
                placeholder="Type a message..."
                className="flex-1 h-10 bg-white dark:bg-gray-800 font-manrope"
                disabled={isTestLoading}
              />
              <Button
                onClick={handleSendTest}
                disabled={!testInput.trim() || isTestLoading}
                className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================================
// MAIN COMPONENT
// ========================================

export default function CreateChatbotPage() {
  const navigate = useNavigate();
  const { currentWorkspace } = useApp();
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [showExitDialog, setShowExitDialog] = useState(false);

  const {
    currentDraft,
    formData,
    formErrors,
    attachedKBs,
    currentStep,
    isDraftDirty,
    isCreatingDraft,
    isDeploying,
    deploymentResult,
    testMessages,
    isTestLoading,
    createDraft,
    updateFormData,
    saveDraft,
    attachKB,
    detachKB,
    toggleKB,
    setStep,
    validateStep,
    clearDraft,
    deploy,
    sendTestMessage,
    clearTestConversation,
  } = useChatbotStore();

  // Create draft on mount
  useEffect(() => {
    if (!currentDraft && currentWorkspace && !isCreatingDraft) {
      createDraft(currentWorkspace.id).catch(console.error);
    }
  }, [currentWorkspace, currentDraft, isCreatingDraft, createDraft]);

  // Auto-save on changes
  useEffect(() => {
    if (isDraftDirty && currentDraft) {
      const timeout = setTimeout(() => {
        saveDraft().catch(console.error);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isDraftDirty, currentDraft, saveDraft]);

  const handleStepClick = (step: number) => {
    // Validate current step before moving
    if (step > currentStep) {
      if (!validateStep(currentStep as ChatbotCreationStep)) {
        return;
      }
      setCompletedSteps((prev) => new Set([...prev, currentStep]));
    }
    setStep(step as ChatbotCreationStep);
  };

  const handleNext = () => {
    if (!validateStep(currentStep as ChatbotCreationStep)) {
      return;
    }
    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    setStep((currentStep + 1) as ChatbotCreationStep);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setStep((currentStep - 1) as ChatbotCreationStep);
    }
  };

  const handleDeploy = async () => {
    try {
      await deploy();
      toast({
        title: "Chatbot deployed!",
        description: "Your chatbot is now live.",
      });
    } catch (error) {
      toast({
        title: "Deployment failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleExit = () => {
    if (isDraftDirty) {
      setShowExitDialog(true);
    } else {
      clearDraft();
      navigate("/chatbots");
    }
  };

  const confirmExit = () => {
    clearDraft();
    navigate("/chatbots");
  };

  // Loading state
  if (isCreatingDraft) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 font-manrope">
              Creating chatbot draft...
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto py-6 sm:py-8 px-4 sm:px-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleExit}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-manrope">
                  Create Chatbot
                </h1>
                <p className="text-gray-600 dark:text-gray-400 font-manrope text-sm">
                  {formData.name || "New Chatbot"}
                </p>
              </div>
            </div>
          </div>

          {/* Stepper */}
          <Stepper
            currentStep={currentStep}
            onStepClick={handleStepClick}
            completedSteps={completedSteps}
          />

          {/* Step Content */}
          <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-gray-100 font-manrope">
                {STEPS[currentStep - 1]?.title}
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400 font-manrope">
                {STEPS[currentStep - 1]?.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {currentStep === 1 && (
                    <Step1BasicInfo
                      formData={formData}
                      formErrors={formErrors}
                      onUpdate={updateFormData}
                    />
                  )}
                  {currentStep === 2 && (
                    <Step2PromptAI
                      formData={formData}
                      formErrors={formErrors}
                      onUpdate={updateFormData}
                    />
                  )}
                  {currentStep === 3 && (
                    <Step3KnowledgeBases
                      formData={formData}
                      formErrors={formErrors}
                      onUpdate={updateFormData}
                      attachedKBs={attachedKBs}
                      onAttachKB={attachKB}
                      onDetachKB={detachKB}
                      onToggleKB={toggleKB}
                    />
                  )}
                  {currentStep === 4 && (
                    <Step4Appearance
                      formData={formData}
                      formErrors={formErrors}
                      onUpdate={updateFormData}
                    />
                  )}
                  {currentStep === 5 && (
                    <Step5Deploy
                      formData={formData}
                      formErrors={formErrors}
                      onUpdate={updateFormData}
                      isDeploying={isDeploying}
                      deploymentResult={deploymentResult}
                      testMessages={testMessages}
                      isTestLoading={isTestLoading}
                      onDeploy={handleDeploy}
                      onSendTestMessage={sendTestMessage}
                      onClearTest={clearTestConversation}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Navigation Buttons */}
          {!deploymentResult && (
            <div className="flex items-center justify-between mt-6">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
                className="font-manrope rounded-lg"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              {currentStep < 5 ? (
                <Button
                  onClick={handleNext}
                  className="font-manrope bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : null}
            </div>
          )}

          {/* Success: Go to Dashboard */}
          {deploymentResult && (
            <div className="flex justify-center mt-6">
              <Button
                onClick={() => navigate("/chatbots")}
                className="font-manrope bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Exit Confirmation Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-100 font-manrope">
              Unsaved Changes
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400 font-manrope">
              You have unsaved changes. Are you sure you want to leave? Your draft
              will be saved for 24 hours.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowExitDialog(false)}
              className="font-manrope rounded-lg"
            >
              Keep Editing
            </Button>
            <Button
              onClick={confirmExit}
              className="font-manrope bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              Leave Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
