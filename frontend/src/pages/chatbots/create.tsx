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

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
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
  Lock,
  Unlock,
  Users,
  Shield,
  Link2,
  Info,
} from "lucide-react";
import { useChatbotStore } from "@/store/chatbot-store";
import { useApp } from "@/contexts/AppContext";
import {
  ChatbotCreationStep,
  DeploymentChannel,
  getChannelLabel,
  DEFAULT_FORM_DATA,
  ChatbotFormErrors,
  VariableField,
  VariableFieldType,
  GroundingMode,
  DEFAULT_LEAD_CAPTURE_CONFIG,
  FieldVisibility,
  LeadCaptureTiming,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
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
          onChange={(e) => { onUpdate({ name: e.target.value }); }}
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
          onChange={(e) => { onUpdate({ description: e.target.value }); }}
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
            { onUpdate({
              messages: { ...formData.messages, greeting: e.target.value },
            }); }
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
  const [newOpener, setNewOpener] = useState("");
  const [newVarName, setNewVarName] = useState("");
  const [newVarLabel, setNewVarLabel] = useState("");
  const [newVarType, setNewVarType] = useState<VariableFieldType>(VariableFieldType.TEXT);
  const [varError, setVarError] = useState("");

  // Variable insertion menu state
  const [showVariableMenu, setShowVariableMenu] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [variableFilter, setVariableFilter] = useState("");
  const systemPromptRef = useRef<HTMLTextAreaElement>(null);

  const addConversationOpener = () => {
    if (!newOpener.trim()) return;
    const openers = formData.behavior?.conversation_openers || [];
    if (openers.length >= 4) return; // Max 4 openers
    onUpdate({
      behavior: {
        ...formData.behavior,
        conversation_openers: [...openers, newOpener.trim()],
      },
    });
    setNewOpener("");
  };

  const removeConversationOpener = (index: number) => {
    const openers = formData.behavior?.conversation_openers || [];
    onUpdate({
      behavior: {
        ...formData.behavior,
        conversation_openers: openers.filter((_, i) => i !== index),
      },
    });
  };

  // Variable management functions
  const isValidVariableName = (name: string): boolean => {
    // Variable names must be alphanumeric + underscore, start with letter or underscore
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  };

  const addVariable = () => {
    setVarError("");

    if (!newVarName.trim()) {
      setVarError("Variable name is required");
      return;
    }

    if (!isValidVariableName(newVarName.trim())) {
      setVarError("Variable name must be alphanumeric (letters, numbers, underscore). Start with letter or underscore.");
      return;
    }

    const existingVars = formData.variables_config?.variables || [];
    if (existingVars.some(v => v.name === newVarName.trim())) {
      setVarError("A variable with this name already exists");
      return;
    }

    const newVar: VariableField = {
      id: `var_${Date.now()}`,
      name: newVarName.trim(),
      type: newVarType,
      label: newVarLabel.trim() || newVarName.trim(),
      required: true,
      placeholder: "",
    };

    onUpdate({
      variables_config: {
        ...formData.variables_config,
        enabled: true,
        variables: [...existingVars, newVar],
      },
    });

    setNewVarName("");
    setNewVarLabel("");
    setNewVarType(VariableFieldType.TEXT);
  };

  const removeVariable = (varId: string) => {
    const existingVars = formData.variables_config?.variables || [];
    const updatedVars = existingVars.filter(v => v.id !== varId);
    onUpdate({
      variables_config: {
        ...formData.variables_config,
        enabled: updatedVars.length > 0,
        variables: updatedVars,
      },
    });
  };

  const insertVariableInPrompt = (varName: string) => {
    const textarea = systemPromptRef.current;
    const placeholder = `{{${varName}}}`;
    const currentPrompt = formData.system_prompt || "";

    if (textarea && showVariableMenu) {
      // Insert at cursor position, removing the "/" that triggered the menu
      const beforeSlash = currentPrompt.slice(0, cursorPosition - 1);
      const afterCursor = currentPrompt.slice(cursorPosition + variableFilter.length);
      const newValue = beforeSlash + placeholder + afterCursor;
      onUpdate({ system_prompt: newValue });
      setShowVariableMenu(false);
      setVariableFilter("");

      // Focus textarea and set cursor after inserted variable
      setTimeout(() => {
        textarea.focus();
        const newPosition = beforeSlash.length + placeholder.length;
        textarea.setSelectionRange(newPosition, newPosition);
      }, 0);
    } else {
      // Fallback: append to end (when clicking button below)
      onUpdate({ system_prompt: currentPrompt + " " + placeholder });
    }
  };

  // Handle keydown in system prompt textarea
  const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;

    if (e.key === "/") {
      // Check if we have variables to show
      const vars = formData.variables_config?.variables || [];
      if (vars.length > 0) {
        setCursorPosition(textarea.selectionStart + 1); // +1 because "/" will be typed
        setVariableFilter("");
        setShowVariableMenu(true);
      }
    } else if (e.key === "Escape") {
      setShowVariableMenu(false);
      setVariableFilter("");
    } else if (showVariableMenu) {
      // Capture characters typed after "/" for filtering
      if (e.key === "Backspace") {
        if (variableFilter.length > 0) {
          setVariableFilter(variableFilter.slice(0, -1));
        } else {
          setShowVariableMenu(false);
        }
      } else if (e.key.length === 1 && /[a-zA-Z0-9_]/.test(e.key)) {
        setVariableFilter(variableFilter + e.key);
      }
    }
  };

  // Get filtered variables for the menu
  const getFilteredVariables = () => {
    const vars = formData.variables_config?.variables || [];
    if (!variableFilter) return vars;
    return vars.filter((v) =>
      v.name.toLowerCase().includes(variableFilter.toLowerCase())
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label
          htmlFor="system_prompt"
          className="text-gray-900 dark:text-gray-100 font-manrope"
        >
          System Prompt *
        </Label>
        <div className="relative">
          <Textarea
            ref={systemPromptRef}
            id="system_prompt"
            value={formData.system_prompt}
            onChange={(e) => {
              onUpdate({ system_prompt: e.target.value });
              // Close menu if user deletes the "/"
              if (showVariableMenu && !e.target.value.includes("/")) {
                setShowVariableMenu(false);
                setVariableFilter("");
              }
            }}
            onKeyDown={handlePromptKeyDown}
            onBlur={() => {
              // Delay to allow click on menu item
              setTimeout(() => { setShowVariableMenu(false); }, 200);
            }}
            placeholder="You are a helpful assistant..."
            rows={6}
            className={cn(
              "bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope resize-none",
              formErrors.system_prompt && "border-red-500"
            )}
          />

          {/* Variable Insertion Menu */}
          {showVariableMenu && getFilteredVariables().length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 max-h-48 overflow-y-auto">
              <div className="text-xs text-gray-500 dark:text-gray-400 px-2 pb-2 border-b border-gray-200 dark:border-gray-700 mb-2">
                Select a variable to insert
              </div>
              {getFilteredVariables().map((variable) => (
                <button
                  key={variable.id}
                  type="button"
                  onClick={() => { insertVariableInPrompt(variable.name); }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center justify-between group"
                >
                  <div>
                    <span className="font-mono text-sm text-blue-600 dark:text-blue-400">
                      {`{{${variable.name}}}`}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      {variable.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100">
                    {variable.type}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* No variables message */}
          {showVariableMenu && getFilteredVariables().length === 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {variableFilter
                  ? `No variables matching "${variableFilter}"`
                  : "No variables defined yet. Add variables below."}
              </p>
            </div>
          )}
        </div>
        {formErrors.system_prompt && (
          <p className="text-sm text-red-500 font-manrope">
            {formErrors.system_prompt}
          </p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
          Instructions that define how your chatbot behaves.{" "}
          <span className="text-blue-600 dark:text-blue-400">
            Type "/" to insert variables
          </span>{" "}
          • Use {"{{ variable_name }}"} syntax
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-gray-900 dark:text-gray-100 font-manrope">
            AI Model
          </Label>
          <div className="flex items-center gap-3 h-11 px-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg">
            <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">Secret AI</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">Privacy-preserving via TEE</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-gray-900 dark:text-gray-100 font-manrope">
            Max Tokens
          </Label>
          <Input
            type="number"
            value={formData.max_tokens}
            onChange={(e) =>
              { onUpdate({ max_tokens: parseInt(e.target.value) || 2000 }); }
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
          onValueChange={([value]) => { onUpdate({ temperature: value }); }}
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

      {/* Behavior Features */}
      <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
        <Label className="text-gray-900 dark:text-gray-100 font-manrope font-medium">
          Behavior Features
        </Label>

        {/* Citations Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="h-4 w-4 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                Citations & Attributions
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                Show knowledge base sources in responses
              </p>
            </div>
          </div>
          <Switch
            checked={formData.behavior?.enable_citations || false}
            onCheckedChange={(checked) =>
              { onUpdate({
                behavior: { ...formData.behavior, enable_citations: checked },
              }); }
            }
          />
        </div>

        {/* Follow-up Questions Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-4 w-4 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                Follow-up Questions
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                Suggest related questions after responses
              </p>
            </div>
          </div>
          <Switch
            checked={formData.behavior?.enable_follow_up_questions || false}
            onCheckedChange={(checked) =>
              { onUpdate({
                behavior: { ...formData.behavior, enable_follow_up_questions: checked },
              }); }
            }
          />
        </div>

        {/* Grounding Mode - How strictly AI uses knowledge base */}
        <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                Knowledge Base Usage
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                Control how strictly the AI uses your knowledge base
              </p>
            </div>
          </div>

          <RadioGroup
            value={formData.behavior?.grounding_mode ?? GroundingMode.STRICT}
            onValueChange={(value) => {
              onUpdate({
                behavior: { ...formData.behavior, grounding_mode: value as GroundingMode },
              });
            }}
            className="space-y-2 pl-7"
          >
            <div className="flex items-start space-x-3">
              <RadioGroupItem value={GroundingMode.STRICT} id="grounding-strict" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="grounding-strict" className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope cursor-pointer">
                  Strict (Recommended)
                </Label>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                  Only answer from knowledge base. Refuses if information not found.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <RadioGroupItem value={GroundingMode.GUIDED} id="grounding-guided" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="grounding-guided" className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope cursor-pointer">
                  Guided
                </Label>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                  Prefers knowledge base but can use general knowledge (with disclosure).
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <RadioGroupItem value={GroundingMode.FLEXIBLE} id="grounding-flexible" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="grounding-flexible" className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope cursor-pointer">
                  Flexible
                </Label>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                  Uses knowledge base to enhance responses, freely uses general knowledge.
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Conversation Openers */}
        <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                Conversation Starters
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                Suggested prompts shown to users (max 4)
              </p>
            </div>
          </div>

          {/* Existing openers */}
          {(formData.behavior?.conversation_openers || []).length > 0 && (
            <div className="space-y-2">
              {formData.behavior?.conversation_openers?.map((opener, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-manrope truncate flex-1">
                    {opener}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { removeConversationOpener(index); }}
                    className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex-shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add new opener */}
          {(formData.behavior?.conversation_openers || []).length < 4 && (
            <div className="flex gap-2">
              <Input
                value={newOpener}
                onChange={(e) => { setNewOpener(e.target.value); }}
                onKeyDown={(e) => e.key === "Enter" && addConversationOpener()}
                placeholder="e.g., What can you help me with?"
                className="h-9 bg-white dark:bg-gray-800 font-manrope text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={addConversationOpener}
                disabled={!newOpener.trim()}
                className="h-9 px-3"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
        <div className="flex items-center gap-3">
          <Check className="h-4 w-4 text-green-500" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
              Instructions
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
              Specific behaviors the AI should follow
            </p>
          </div>
        </div>

        {/* Existing instructions */}
        {(formData.instructions || []).length > 0 && (
          <div className="space-y-2">
            {formData.instructions?.map((instruction) => (
              <div
                key={instruction.id}
                className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <Switch
                  checked={instruction.enabled}
                  onCheckedChange={(checked) => {
                    const updated = formData.instructions?.map((i) =>
                      i.id === instruction.id ? { ...i, enabled: checked } : i
                    );
                    onUpdate({ instructions: updated });
                  }}
                  className="flex-shrink-0"
                />
                <span className={cn(
                  "text-sm font-manrope flex-1 truncate",
                  instruction.enabled
                    ? "text-gray-700 dark:text-gray-300"
                    : "text-gray-400 dark:text-gray-500 line-through"
                )}>
                  {instruction.content}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const updated = formData.instructions?.filter((i) => i.id !== instruction.id);
                    onUpdate({ instructions: updated });
                  }}
                  className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex-shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add new instruction */}
        <div className="flex gap-2">
          <Input
            placeholder="e.g., Always greet users warmly"
            className="h-9 bg-white dark:bg-gray-800 font-manrope text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.currentTarget.value.trim()) {
                const newInstruction = {
                  id: `inst_${Date.now()}`,
                  content: e.currentTarget.value.trim(),
                  enabled: true,
                };
                onUpdate({ instructions: [...(formData.instructions || []), newInstruction] });
                e.currentTarget.value = "";
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3"
            onClick={(e) => {
              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
              if (input?.value.trim()) {
                const newInstruction = {
                  id: `inst_${Date.now()}`,
                  content: input.value.trim(),
                  enabled: true,
                };
                onUpdate({ instructions: [...(formData.instructions || []), newInstruction] });
                input.value = "";
              }
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Restrictions */}
      <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
              Restrictions
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
              Things the AI should not do or discuss
            </p>
          </div>
        </div>

        {/* Existing restrictions */}
        {(formData.restrictions || []).length > 0 && (
          <div className="space-y-2">
            {formData.restrictions?.map((restriction) => (
              <div
                key={restriction.id}
                className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <Switch
                  checked={restriction.enabled}
                  onCheckedChange={(checked) => {
                    const updated = formData.restrictions?.map((r) =>
                      r.id === restriction.id ? { ...r, enabled: checked } : r
                    );
                    onUpdate({ restrictions: updated });
                  }}
                  className="flex-shrink-0"
                />
                <span className={cn(
                  "text-sm font-manrope flex-1 truncate",
                  restriction.enabled
                    ? "text-gray-700 dark:text-gray-300"
                    : "text-gray-400 dark:text-gray-500 line-through"
                )}>
                  {restriction.content}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const updated = formData.restrictions?.filter((r) => r.id !== restriction.id);
                    onUpdate({ restrictions: updated });
                  }}
                  className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex-shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add new restriction */}
        <div className="flex gap-2">
          <Input
            placeholder="e.g., Never discuss competitor products"
            className="h-9 bg-white dark:bg-gray-800 font-manrope text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.currentTarget.value.trim()) {
                const newRestriction = {
                  id: `rest_${Date.now()}`,
                  content: e.currentTarget.value.trim(),
                  enabled: true,
                };
                onUpdate({ restrictions: [...(formData.restrictions || []), newRestriction] });
                e.currentTarget.value = "";
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3"
            onClick={(e) => {
              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
              if (input?.value.trim()) {
                const newRestriction = {
                  id: `rest_${Date.now()}`,
                  content: input.value.trim(),
                  enabled: true,
                };
                onUpdate({ restrictions: [...(formData.restrictions || []), newRestriction] });
                input.value = "";
              }
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Variable Collection */}
      <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-4 w-4 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope">
                Variable Collection
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                Collect information from users using {"{{variable_name}}"} in your prompt
              </p>
            </div>
          </div>
          <Switch
            checked={formData.variables_config?.enabled || false}
            onCheckedChange={(checked) =>
              { onUpdate({
                variables_config: {
                  ...formData.variables_config,
                  enabled: checked,
                },
              }); }
            }
          />
        </div>

        {formData.variables_config?.enabled && (
          <div className="space-y-4 pt-3 border-t border-gray-200 dark:border-gray-600">
            {/* Existing variables */}
            {(formData.variables_config?.variables || []).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 font-manrope">
                  Defined Variables
                </p>
                {formData.variables_config?.variables?.map((variable) => (
                  <div
                    key={variable.id}
                    className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <code className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-xs font-mono">
                        {`{{${variable.name}}}`}
                      </code>
                      <span className="text-sm text-gray-600 dark:text-gray-300 font-manrope truncate">
                        {variable.label}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-manrope">
                        ({variable.type})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { insertVariableInPrompt(variable.name); }}
                        className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                      >
                        Insert
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { removeVariable(variable.id); }}
                        className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add new variable */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 font-manrope">
                Add Variable
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input
                  value={newVarName}
                  onChange={(e) => {
                    setNewVarName(e.target.value.replace(/\s/g, '_'));
                    setVarError("");
                  }}
                  placeholder="variable_name"
                  className="h-9 bg-white dark:bg-gray-800 font-mono text-sm"
                />
                <Input
                  value={newVarLabel}
                  onChange={(e) => { setNewVarLabel(e.target.value); }}
                  placeholder="Display label (optional)"
                  className="h-9 bg-white dark:bg-gray-800 font-manrope text-sm"
                />
                <div className="flex gap-2">
                  <Select
                    value={newVarType}
                    onValueChange={(value) => { setNewVarType(value as VariableFieldType); }}
                  >
                    <SelectTrigger className="h-9 bg-white dark:bg-gray-800 font-manrope text-sm flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <SelectItem value={VariableFieldType.TEXT}>Text</SelectItem>
                      <SelectItem value={VariableFieldType.EMAIL}>Email</SelectItem>
                      <SelectItem value={VariableFieldType.PHONE}>Phone</SelectItem>
                      <SelectItem value={VariableFieldType.NUMBER}>Number</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addVariable}
                    disabled={!newVarName.trim()}
                    className="h-9 px-3"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {varError && (
                <p className="text-xs text-red-500 font-manrope">{varError}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                Use variables in your system prompt with {"{{variable_name}}"} syntax. Values will be collected from users before chat.
              </p>
            </div>
          </div>
        )}
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
                    onCheckedChange={(checked) => { onToggleKB(kb.kb_id, checked); }}
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
              onClick={() => { navigate("/knowledge-bases/create"); }}
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
  const [customColor, setCustomColor] = useState(formData.appearance.primary_color || "#3b82f6");
  const [customSecondaryColor, setCustomSecondaryColor] = useState(formData.appearance.secondary_color || "#8b5cf6");
  const [colorError, setColorError] = useState("");
  const [secondaryColorError, setSecondaryColorError] = useState("");
  const [avatarError, setAvatarError] = useState("");

  const colorOptions = [
    { value: "#3b82f6", label: "Blue" },
    { value: "#8b5cf6", label: "Purple" },
    { value: "#10b981", label: "Green" },
    { value: "#f59e0b", label: "Orange" },
    { value: "#ef4444", label: "Red" },
    { value: "#6b7280", label: "Gray" },
  ];

  // Validate hex color format
  const isValidHex = (color: string): boolean => {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  };

  const handleCustomColorChange = (value: string) => {
    // Auto-add # if not present
    let color = value;
    if (value && !value.startsWith("#")) {
      color = "#" + value;
    }
    setCustomColor(color);

    if (color && !isValidHex(color)) {
      setColorError("Invalid hex color (e.g., #3b82f6)");
    } else {
      setColorError("");
      if (isValidHex(color)) {
        onUpdate({
          appearance: { ...formData.appearance, primary_color: color },
        });
      }
    }
  };

  const handleColorPresetClick = (color: string) => {
    setCustomColor(color);
    setColorError("");
    onUpdate({
      appearance: { ...formData.appearance, primary_color: color },
    });
  };

  const handleAvatarUrlChange = (url: string) => {
    setAvatarError("");
    onUpdate({
      appearance: { ...formData.appearance, avatar_url: url },
    });
  };

  // Check if current color matches a preset
  const isPresetColor = colorOptions.some(c => c.value === formData.appearance.primary_color);

  return (
    <div className="space-y-6">
      {/* Widget Display Name */}
      <div className="space-y-2">
        <Label className="text-gray-900 dark:text-gray-100 font-manrope">
          Widget Display Name
        </Label>
        <Input
          value={formData.appearance.chat_title || ""}
          onChange={(e) =>
            { onUpdate({
              appearance: { ...formData.appearance, chat_title: e.target.value },
            }); }
          }
          placeholder="My Assistant"
          className="h-11 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
          This name appears in the chat widget header (different from your internal chatbot name)
        </p>
      </div>

      {/* Avatar URL */}
      <div className="space-y-2">
        <Label className="text-gray-900 dark:text-gray-100 font-manrope">
          Avatar URL
        </Label>
        <div className="flex gap-3 items-start">
          <div className="flex-1">
            <Input
              value={formData.appearance.avatar_url || ""}
              onChange={(e) => { handleAvatarUrlChange(e.target.value); }}
              placeholder="https://example.com/avatar.png"
              className={cn(
                "h-11 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope",
                avatarError && "border-red-500"
              )}
            />
            {avatarError && (
              <p className="text-sm text-red-500 font-manrope mt-1">{avatarError}</p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope mt-1">
              Image URL for your chatbot avatar (recommended: 64x64px)
            </p>
          </div>
          {/* Avatar Preview */}
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 overflow-hidden flex items-center justify-center flex-shrink-0">
            {formData.appearance.avatar_url ? (
              <img
                src={formData.appearance.avatar_url}
                alt="Avatar preview"
                className="w-full h-full object-cover"
                onError={() => { setAvatarError("Failed to load image"); }}
                onLoad={() => { setAvatarError(""); }}
              />
            ) : (
              <Bot className="h-6 w-6 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {/* Primary Color */}
      <div className="space-y-3">
        <Label className="text-gray-900 dark:text-gray-100 font-manrope">
          Primary Color
        </Label>
        <div className="flex flex-wrap items-center gap-3">
          {colorOptions.map((color) => (
            <button
              key={color.value}
              onClick={() => { handleColorPresetClick(color.value); }}
              className={cn(
                "w-10 h-10 rounded-full border-2 transition-all",
                formData.appearance.primary_color === color.value
                  ? "ring-2 ring-offset-2 ring-blue-500"
                  : "border-gray-200 dark:border-gray-600 hover:scale-110"
              )}
              style={{ backgroundColor: color.value }}
              title={color.label}
            />
          ))}
          {/* Custom color indicator */}
          {!isPresetColor && formData.appearance.primary_color && (
            <div
              className="w-10 h-10 rounded-full border-2 ring-2 ring-offset-2 ring-blue-500"
              style={{ backgroundColor: formData.appearance.primary_color }}
              title="Custom color"
            />
          )}
        </div>
        {/* Custom Hex Input */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-[200px]">
            <Input
              value={customColor}
              onChange={(e) => { handleCustomColorChange(e.target.value); }}
              placeholder="#3b82f6"
              className={cn(
                "h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-mono text-sm pl-10",
                colorError && "border-red-500"
              )}
            />
            <div
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded border border-gray-300 dark:border-gray-500"
              style={{ backgroundColor: isValidHex(customColor) ? customColor : "#ccc" }}
            />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
            Custom hex color
          </span>
        </div>
        {colorError && (
          <p className="text-sm text-red-500 font-manrope">{colorError}</p>
        )}
      </div>

      {/* Secondary Color */}
      <div className="space-y-3">
        <Label className="text-gray-900 dark:text-gray-100 font-manrope">
          Secondary Color
        </Label>
        <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
          Used for accents, links, and buttons
        </p>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-[200px]">
            <Input
              value={customSecondaryColor}
              onChange={(e) => {
                let color = e.target.value;
                if (color && !color.startsWith("#")) {
                  color = "#" + color;
                }
                setCustomSecondaryColor(color);
                if (color && isValidHex(color)) {
                  setSecondaryColorError("");
                  onUpdate({
                    appearance: { ...formData.appearance, secondary_color: color },
                  });
                } else if (color && color.length >= 4) {
                  setSecondaryColorError("Invalid hex format");
                }
              }}
              placeholder="#8b5cf6"
              className={cn(
                "h-10 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-mono text-sm pl-10",
                secondaryColorError && "border-red-500"
              )}
            />
            <div
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded border border-gray-300 dark:border-gray-500"
              style={{ backgroundColor: isValidHex(customSecondaryColor) ? customSecondaryColor : "#ccc" }}
            />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
            Hex color
          </span>
        </div>
        {secondaryColorError && (
          <p className="text-sm text-red-500 font-manrope">{secondaryColorError}</p>
        )}
      </div>

      {/* Font Family */}
      <div className="space-y-3">
        <Label className="text-gray-900 dark:text-gray-100 font-manrope">
          Font Family
        </Label>
        <Select
          value={formData.appearance.font_family || "Inter"}
          onValueChange={(value) =>
            { onUpdate({
              appearance: { ...formData.appearance, font_family: value },
            }); }
          }
        >
          <SelectTrigger className="h-11 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-lg font-manrope">
            <SelectValue placeholder="Select font" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Inter">Inter (Recommended)</SelectItem>
            <SelectItem value="System">System Default</SelectItem>
            <SelectItem value="Mono">Monospace</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
          Font used in the chat widget
        </p>
      </div>

      {/* Bubble Style */}
      <div className="space-y-3">
        <Label className="text-gray-900 dark:text-gray-100 font-manrope">
          Bubble Style
        </Label>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() =>
              { onUpdate({
                appearance: { ...formData.appearance, bubble_style: "rounded" },
              }); }
            }
            className={cn(
              "flex-1 font-manrope",
              (formData.appearance.bubble_style || "rounded") === "rounded" &&
                "ring-2 ring-blue-500 border-blue-500"
            )}
          >
            Rounded
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              { onUpdate({
                appearance: { ...formData.appearance, bubble_style: "square" },
              }); }
            }
            className={cn(
              "flex-1 font-manrope",
              formData.appearance.bubble_style === "square" &&
                "ring-2 ring-blue-500 border-blue-500"
            )}
          >
            Square
          </Button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
          Shape of chat message bubbles
        </p>
      </div>

      {/* Widget Position */}
      <div className="space-y-3">
        <Label className="text-gray-900 dark:text-gray-100 font-manrope">
          Widget Position
        </Label>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() =>
              { onUpdate({
                appearance: { ...formData.appearance, position: "bottom-right" },
              }); }
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
              { onUpdate({
                appearance: { ...formData.appearance, position: "bottom-left" },
              }); }
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
        <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
          This controls where the widget button appears on your website. The test preview shows the chat window in a fixed position.
        </p>
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
              { onUpdate({ memory: { ...formData.memory, enabled: checked } }); }
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
                { onUpdate({ memory: { ...formData.memory, max_messages: value } }); }
              }
              min={5}
              max={50}
              step={5}
              className="w-full"
            />
          </div>
        )}
      </div>

      {/* Lead Capture Settings - Web-focused configuration */}
      <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        {/* Header with Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-gray-900 dark:text-gray-100 font-manrope flex items-center gap-2 text-base font-medium">
              <Users className="h-4 w-4" />
              Lead Capture
            </Label>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-manrope mt-1">
              Collect visitor contact information from your website
            </p>
          </div>
          <Switch
            checked={formData.lead_capture?.enabled || false}
            onCheckedChange={(checked) => {
              onUpdate({
                lead_capture: checked
                  ? { ...DEFAULT_LEAD_CAPTURE_CONFIG, enabled: true }
                  : { ...DEFAULT_LEAD_CAPTURE_CONFIG, enabled: false },
              });
            }}
          />
        </div>

        {formData.lead_capture?.enabled && (
          <div className="space-y-5 pt-2">
            {/* Timing Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                When to show form
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {/* Before Chat Card */}
                <button
                  type="button"
                  onClick={() => {
                    onUpdate({
                      lead_capture: {
                        ...DEFAULT_LEAD_CAPTURE_CONFIG,
                        ...formData.lead_capture,
                        timing: LeadCaptureTiming.BEFORE_CHAT,
                      },
                    });
                  }}
                  className={cn(
                    "p-3 rounded-lg border-2 text-left transition-all",
                    formData.lead_capture?.timing === LeadCaptureTiming.BEFORE_CHAT
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                        formData.lead_capture?.timing === LeadCaptureTiming.BEFORE_CHAT
                          ? "border-blue-500"
                          : "border-gray-400"
                      )}
                    >
                      {formData.lead_capture?.timing === LeadCaptureTiming.BEFORE_CHAT && (
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      Before Chat
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                    Form appears first, then chat begins
                  </p>
                </button>

                {/* After N Messages Card */}
                <button
                  type="button"
                  onClick={() => {
                    onUpdate({
                      lead_capture: {
                        ...DEFAULT_LEAD_CAPTURE_CONFIG,
                        ...formData.lead_capture,
                        timing: LeadCaptureTiming.AFTER_N_MESSAGES,
                      },
                    });
                  }}
                  className={cn(
                    "p-3 rounded-lg border-2 text-left transition-all",
                    formData.lead_capture?.timing === LeadCaptureTiming.AFTER_N_MESSAGES
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                        formData.lead_capture?.timing === LeadCaptureTiming.AFTER_N_MESSAGES
                          ? "border-blue-500"
                          : "border-gray-400"
                      )}
                    >
                      {formData.lead_capture?.timing === LeadCaptureTiming.AFTER_N_MESSAGES && (
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      After Conversation Starts
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                    Show after chatting begins
                  </p>
                </button>
              </div>

              {/* Messages Slider - only when "After N Messages" selected */}
              {formData.lead_capture?.timing === LeadCaptureTiming.AFTER_N_MESSAGES && (
                <div className="ml-1 space-y-2">
                  <Label className="text-xs text-gray-600 dark:text-gray-400">
                    Show form after {formData.lead_capture?.messages_before_prompt || 3} messages
                  </Label>
                  <Slider
                    value={[formData.lead_capture?.messages_before_prompt || 3]}
                    onValueChange={([value]) => {
                      onUpdate({
                        lead_capture: {
                          ...DEFAULT_LEAD_CAPTURE_CONFIG,
                          ...formData.lead_capture,
                          messages_before_prompt: value,
                        },
                      });
                    }}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>1</span>
                    <span>10</span>
                  </div>
                </div>
              )}
            </div>

            {/* Fields Section */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Fields to collect
              </Label>
              <div className="grid grid-cols-3 gap-3">
                {/* Email Field */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500 dark:text-gray-400">Email</Label>
                  <Select
                    value={formData.lead_capture?.fields?.email || FieldVisibility.REQUIRED}
                    onValueChange={(value) => {
                      onUpdate({
                        lead_capture: {
                          ...DEFAULT_LEAD_CAPTURE_CONFIG,
                          ...formData.lead_capture,
                          fields: {
                            ...DEFAULT_LEAD_CAPTURE_CONFIG.fields,
                            ...formData.lead_capture?.fields,
                            email: value as typeof FieldVisibility[keyof typeof FieldVisibility],
                          },
                        },
                      });
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FieldVisibility.REQUIRED}>Required</SelectItem>
                      <SelectItem value={FieldVisibility.OPTIONAL}>Optional</SelectItem>
                      <SelectItem value={FieldVisibility.HIDDEN}>Hidden</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Name Field */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500 dark:text-gray-400">Name</Label>
                  <Select
                    value={formData.lead_capture?.fields?.name || FieldVisibility.OPTIONAL}
                    onValueChange={(value) => {
                      onUpdate({
                        lead_capture: {
                          ...DEFAULT_LEAD_CAPTURE_CONFIG,
                          ...formData.lead_capture,
                          fields: {
                            ...DEFAULT_LEAD_CAPTURE_CONFIG.fields,
                            ...formData.lead_capture?.fields,
                            name: value as typeof FieldVisibility[keyof typeof FieldVisibility],
                          },
                        },
                      });
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FieldVisibility.REQUIRED}>Required</SelectItem>
                      <SelectItem value={FieldVisibility.OPTIONAL}>Optional</SelectItem>
                      <SelectItem value={FieldVisibility.HIDDEN}>Hidden</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Phone Field */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500 dark:text-gray-400">Phone</Label>
                  <Select
                    value={formData.lead_capture?.fields?.phone || FieldVisibility.HIDDEN}
                    onValueChange={(value) => {
                      onUpdate({
                        lead_capture: {
                          ...DEFAULT_LEAD_CAPTURE_CONFIG,
                          ...formData.lead_capture,
                          fields: {
                            ...DEFAULT_LEAD_CAPTURE_CONFIG.fields,
                            ...formData.lead_capture?.fields,
                            phone: value as typeof FieldVisibility[keyof typeof FieldVisibility],
                          },
                        },
                      });
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FieldVisibility.REQUIRED}>Required</SelectItem>
                      <SelectItem value={FieldVisibility.OPTIONAL}>Optional</SelectItem>
                      <SelectItem value={FieldVisibility.HIDDEN}>Hidden</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Validation hint */}
              {formData.lead_capture?.fields?.email === FieldVisibility.HIDDEN &&
               formData.lead_capture?.fields?.name === FieldVisibility.HIDDEN &&
               formData.lead_capture?.fields?.phone === FieldVisibility.HIDDEN && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  At least one field must be visible
                </p>
              )}
            </div>

            {/* Options Section */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Options
              </Label>
              <div className="space-y-3">
                {/* Allow Skip */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={formData.lead_capture?.allow_skip ?? true}
                    onCheckedChange={(checked) => {
                      onUpdate({
                        lead_capture: {
                          ...DEFAULT_LEAD_CAPTURE_CONFIG,
                          ...formData.lead_capture,
                          allow_skip: checked === true,
                        },
                      });
                    }}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Allow visitors to skip the form
                  </span>
                </label>

                {/* Require Consent */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={formData.lead_capture?.privacy?.require_consent ?? false}
                    onCheckedChange={(checked) => {
                      onUpdate({
                        lead_capture: {
                          ...DEFAULT_LEAD_CAPTURE_CONFIG,
                          ...formData.lead_capture,
                          privacy: {
                            ...DEFAULT_LEAD_CAPTURE_CONFIG.privacy,
                            ...formData.lead_capture?.privacy,
                            require_consent: checked === true,
                          },
                        },
                      });
                    }}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Require consent checkbox (GDPR compliance)
                  </span>
                </label>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>Auto-captured:</strong> IP address, location, browser info, referrer URL
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Custom fields and additional platforms (Telegram, Discord, WhatsApp) can be configured after deployment.
                  </p>
                </div>
              </div>
            </div>
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
  testMessages: {
    role: string;
    content: string;
    sources?: Array<{
      content?: string;
      score?: number;
      document_title?: string;
      document_url?: string;
    }>;
  }[];
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
      setTimeout(() => { setCopiedApiKey(false); }, 2000);
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
    setTimeout(() => { setCopiedEmbed(false); }, 2000);
  };

  // Simplified channel options - other channels can be added in detail page after deployment
  const channelOptions = [
    { type: DeploymentChannel.WEBSITE, icon: Globe, description: "Website widget" },
    { type: DeploymentChannel.API, icon: Settings, description: "REST API access" },
    { type: DeploymentChannel.SECRETVM, icon: Link2, description: "Public chat URL" },
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
        {/* Visibility Toggle */}
        <div className="space-y-3">
          <Label className="text-gray-900 dark:text-gray-100 font-manrope">
            Visibility
          </Label>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => { onUpdate({ is_public: true }); }}
              className={cn(
                "flex-1 font-manrope justify-start gap-3",
                formData.is_public && "ring-2 ring-green-500 border-green-500 bg-green-50 dark:bg-green-950/30"
              )}
            >
              <Unlock className={cn("h-4 w-4", formData.is_public ? "text-green-600" : "text-gray-400")} />
              <div className="text-left">
                <p className="font-medium">Public</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">Anyone can access</p>
              </div>
            </Button>
            <Button
              variant="outline"
              onClick={() => { onUpdate({ is_public: false }); }}
              className={cn(
                "flex-1 font-manrope justify-start gap-3",
                !formData.is_public && "ring-2 ring-amber-500 border-amber-500 bg-amber-50 dark:bg-amber-950/30"
              )}
            >
              <Lock className={cn("h-4 w-4", !formData.is_public ? "text-amber-600" : "text-gray-400")} />
              <div className="text-left">
                <p className="font-medium">Private</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">Requires API key</p>
              </div>
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-gray-900 dark:text-gray-100 font-manrope">
            Deployment Channels
          </Label>
          <div className="space-y-2">
            {channelOptions.map((channel) => {
              const Icon = channel.icon;
              const enabled = isChannelEnabled(channel.type);
              return (
                <div key={channel.type} className="space-y-2">
                  <div
                    onClick={() => { toggleChannel(channel.type); }}
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
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope mt-2">
            Add Discord, Telegram, or WhatsApp channels after deployment in the chatbot settings.
          </p>
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
        <div className="h-[400px] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 flex flex-col overflow-hidden shadow-lg">
          {/* Chat Header - Reflects Appearance Settings */}
          <div
            className="px-4 py-3 flex items-center gap-3 border-b"
            style={{ backgroundColor: formData.appearance.primary_color || "#3b82f6" }}
          >
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center overflow-hidden flex-shrink-0">
              {formData.appearance.avatar_url ? (
                <img
                  src={formData.appearance.avatar_url}
                  alt="Bot avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Bot className="h-5 w-5 text-white" />
              )}
            </div>
            <div>
              <p className="font-medium text-white font-manrope text-sm">
                {formData.appearance.chat_title || formData.name || "Assistant"}
              </p>
              <p className="text-xs text-white/70 font-manrope">Online</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-700/50">
            {/* Greeting message if set */}
            {testMessages.length === 0 && formData.messages.greeting && (
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                  style={{ backgroundColor: formData.appearance.primary_color || "#3b82f6" }}>
                  {formData.appearance.avatar_url ? (
                    <img src={formData.appearance.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Bot className="h-4 w-4 text-white" />
                  )}
                </div>
                <div className="max-w-[80%] p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
                  <p className="text-sm font-manrope text-gray-700 dark:text-gray-200">
                    {formData.messages.greeting}
                  </p>
                </div>
              </div>
            )}
            {testMessages.length === 0 && !formData.messages.greeting && (
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
                  "flex items-start gap-2",
                  msg.role === "user" && "flex-row-reverse"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                    style={{ backgroundColor: formData.appearance.primary_color || "#3b82f6" }}>
                    {formData.appearance.avatar_url ? (
                      <img src={formData.appearance.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Bot className="h-4 w-4 text-white" />
                    )}
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg shadow-sm",
                    msg.role === "user"
                      ? "text-white p-3"
                      : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600"
                  )}
                  style={msg.role === "user" ? { backgroundColor: formData.appearance.primary_color || "#3b82f6" } : {}}
                >
                  {msg.role === "user" ? (
                    <p className="text-sm font-manrope p-3">{msg.content}</p>
                  ) : (
                    <div className="text-sm font-manrope p-3 prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2 prose-headings:font-semibold prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-900 dark:prose-p:text-gray-100 prose-li:text-gray-900 dark:prose-li:text-gray-100 prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-pre:bg-gray-100 dark:prose-pre:bg-gray-700 prose-pre:text-gray-900 dark:prose-pre:text-gray-100 prose-code:bg-gray-100 dark:prose-code:bg-gray-700 prose-code:text-gray-900 dark:prose-code:text-gray-100 prose-code:px-1 prose-code:rounded prose-pre:whitespace-pre-wrap prose-pre:break-words">
                      <ReactMarkdown>{msg.content.replace(/^[ \t]+/gm, '')}</ReactMarkdown>
                    </div>
                  )}
                  {/* Display sources/citations for assistant messages */}
                  {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && formData.behavior?.enable_citations && (
                    <div className="px-3 pb-3 pt-1 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 font-manrope">Sources:</p>
                      <div className="space-y-1">
                        {msg.sources.slice(0, 3).map((source, idx) => (
                          <div key={idx} className="text-xs text-gray-500 dark:text-gray-400 font-manrope flex items-start gap-1">
                            <span className="text-gray-400">[{idx + 1}]</span>
                            <span className="truncate">{source.document_title || source.content?.slice(0, 50) + "..."}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isTestLoading && (
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                  style={{ backgroundColor: formData.appearance.primary_color || "#3b82f6" }}>
                  {formData.appearance.avatar_url ? (
                    <img src={formData.appearance.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Bot className="h-4 w-4 text-white" />
                  )}
                </div>
                <div className="max-w-[80%] p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
            <div className="flex gap-2">
              <Input
                value={testInput}
                onChange={(e) => { setTestInput(e.target.value); }}
                onKeyDown={(e) => e.key === "Enter" && handleSendTest()}
                placeholder="Type a message..."
                className="flex-1 h-10 bg-gray-50 dark:bg-gray-700 font-manrope"
                disabled={isTestLoading}
              />
              <Button
                onClick={handleSendTest}
                disabled={!testInput.trim() || isTestLoading}
                className="h-10 px-4 text-white"
                style={{ backgroundColor: formData.appearance.primary_color || "#3b82f6" }}
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
      return () => { clearTimeout(timeout); };
    }
  }, [isDraftDirty, currentDraft, saveDraft]);

  const handleStepClick = (step: number) => {
    // Validate current step before moving
    if (step > currentStep) {
      if (!validateStep(currentStep)) {
        return;
      }
      setCompletedSteps((prev) => new Set([...prev, currentStep]));
    }
    setStep(step as ChatbotCreationStep);
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
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
                onClick={() => { navigate("/chatbots"); }}
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
              onClick={() => { setShowExitDialog(false); }}
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
