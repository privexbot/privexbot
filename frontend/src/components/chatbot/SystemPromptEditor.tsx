/**
 * SystemPromptEditor - Rich text editor for system prompts
 *
 * WHY:
 * - Enhanced prompt editing experience
 * - Variable suggestions
 * - Template library
 * - Syntax highlighting
 *
 * HOW:
 * - Monaco Editor for code-like experience
 * - Template selection
 * - Variable insertion
 */

import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Lightbulb, Copy, Check } from 'lucide-react';

interface SystemPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

const PROMPT_TEMPLATES = [
  {
    name: 'Customer Support',
    value: `You are a helpful customer support assistant for {company_name}.

Your role:
- Answer questions about our products and services
- Help troubleshoot common issues
- Be polite, professional, and empathetic
- If you don't know something, admit it and offer to escalate

Guidelines:
- Keep responses concise and actionable
- Use bullet points for step-by-step instructions
- Always confirm understanding before proceeding`,
  },
  {
    name: 'Sales Assistant',
    value: `You are a friendly sales assistant for {company_name}.

Your role:
- Understand customer needs
- Recommend relevant products/services
- Highlight key features and benefits
- Address objections professionally

Guidelines:
- Ask clarifying questions
- Be consultative, not pushy
- Focus on value, not just features
- Offer personalized recommendations`,
  },
  {
    name: 'Technical Support',
    value: `You are a technical support specialist for {product_name}.

Your role:
- Diagnose technical issues
- Provide step-by-step solutions
- Explain technical concepts clearly
- Escalate when necessary

Guidelines:
- Ask diagnostic questions first
- Provide clear, numbered steps
- Use simple language, avoid jargon
- Verify solution worked before closing`,
  },
  {
    name: 'Lead Qualifier',
    value: `You are a lead qualification bot for {company_name}.

Your role:
- Engage prospects warmly
- Ask qualifying questions
- Assess fit and interest level
- Capture contact information

Questions to ask:
- What challenges are you facing?
- What's your timeline?
- What's your budget range?
- Who else is involved in decisions?

Always be respectful of their time.`,
  },
  {
    name: 'FAQ Assistant',
    value: `You are an FAQ assistant for {company_name}.

Your role:
- Answer common questions accurately
- Refer to knowledge base when needed
- Keep answers brief and clear
- Provide links for more details

If question is outside your knowledge:
- Acknowledge the question
- Offer to connect them with a human
- Ask if there's anything else you can help with`,
  },
];

const VARIABLES = [
  { name: '{user_name}', description: 'User\'s name' },
  { name: '{company_name}', description: 'Your company name' },
  { name: '{product_name}', description: 'Product name' },
  { name: '{current_date}', description: 'Current date' },
  { name: '{conversation_history}', description: 'Previous messages' },
];

export default function SystemPromptEditor({
  value,
  onChange,
  error,
}: SystemPromptEditorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [copied, setCopied] = useState<string | null>(null);

  const applyTemplate = (templateValue: string) => {
    if (templateValue) {
      const template = PROMPT_TEMPLATES.find((t) => t.name === templateValue);
      if (template) {
        onChange(template.value);
      }
    }
  };

  const insertVariable = (variable: string) => {
    const newValue = value + ' ' + variable;
    onChange(newValue);
    setCopied(variable);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>System Prompt *</Label>
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-yellow-500" />
          <span className="text-sm text-muted-foreground">Use templates to get started</span>
        </div>
      </div>

      {/* Template Selection */}
      <div className="flex items-center gap-2">
        <Select value={selectedTemplate} onValueChange={(val) => { setSelectedTemplate(val); applyTemplate(val); }}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Choose a template..." />
          </SelectTrigger>
          <SelectContent>
            {PROMPT_TEMPLATES.map((template) => (
              <SelectItem key={template.name} value={template.name}>
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Editor */}
      <div className="border rounded-lg overflow-hidden">
        <Editor
          height="300px"
          defaultLanguage="markdown"
          value={value}
          onChange={(val) => onChange(val || '')}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            lineNumbers: 'on',
            wordWrap: 'on',
            fontSize: 13,
            padding: { top: 16, bottom: 16 },
          }}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Variable Shortcuts */}
      <div className="border rounded-lg p-4">
        <h4 className="text-sm font-medium mb-3">Available Variables</h4>
        <div className="grid grid-cols-2 gap-2">
          {VARIABLES.map((variable) => (
            <button
              key={variable.name}
              onClick={() => insertVariable(variable.name)}
              className="flex items-center justify-between p-2 text-sm border rounded hover:bg-accent transition"
            >
              <div className="text-left">
                <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">
                  {variable.name}
                </code>
                <p className="text-xs text-muted-foreground mt-0.5">{variable.description}</p>
              </div>
              {copied === variable.name ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3 text-muted-foreground" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>💡 <strong>Tips:</strong></p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Be specific about the bot's role and responsibilities</li>
          <li>Include guidelines for tone and style</li>
          <li>Specify what to do when uncertain</li>
          <li>Use variables to personalize responses</li>
        </ul>
      </div>
    </div>
  );
}
