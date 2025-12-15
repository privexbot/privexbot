/**
 * ChatbotSettingsForm - Reusable form fields for chatbot configuration
 *
 * WHY:
 * - Shared form component for create/edit
 * - Consistent validation
 * - Reusable across pages
 *
 * HOW:
 * - React Hook Form integration
 * - Zod validation
 * - Controlled components
 */

import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface ChatbotFormData {
  name: string;
  description?: string;
  system_prompt: string;
  model: string;
  temperature: number;
  max_tokens?: number;
  enable_lead_capture: boolean;
  greeting_message?: string;
}

interface ChatbotSettingsFormProps {
  register: UseFormRegister<ChatbotFormData>;
  errors: FieldErrors<ChatbotFormData>;
  watch: (name: keyof ChatbotFormData) => any;
  setValue: (name: keyof ChatbotFormData, value: any) => void;
}

export default function ChatbotSettingsForm({
  register,
  errors,
  watch,
  setValue,
}: ChatbotSettingsFormProps) {
  return (
    <div className="space-y-6">
      {/* Basic Info Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Basic Information</h3>

        <div>
          <Label htmlFor="name">Chatbot Name *</Label>
          <Input
            id="name"
            {...register('name')}
            placeholder="e.g., Customer Support Bot"
            className="mt-2"
          />
          {errors.name && (
            <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            {...register('description')}
            placeholder="Describe what this chatbot does..."
            className="mt-2"
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="greeting">Greeting Message</Label>
          <Input
            id="greeting"
            {...register('greeting_message')}
            placeholder="Hi! How can I help you today?"
            className="mt-2"
          />
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <Label htmlFor="lead-capture">Enable Lead Capture</Label>
            <p className="text-sm text-muted-foreground">
              Capture user information during conversations
            </p>
          </div>
          <Switch
            id="lead-capture"
            checked={watch('enable_lead_capture')}
            onCheckedChange={(checked) => setValue('enable_lead_capture', checked)}
          />
        </div>
      </div>

      {/* AI Configuration Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">AI Configuration</h3>

        <div>
          <Label htmlFor="model">AI Model *</Label>
          <Select
            value={watch('model')}
            onValueChange={(value) => setValue('model', value)}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4">GPT-4 (Most Capable)</SelectItem>
              <SelectItem value="gpt-4-turbo">GPT-4 Turbo (Faster)</SelectItem>
              <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Cost Effective)</SelectItem>
              <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
              <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="temperature">
            Temperature: {watch('temperature')?.toFixed(1) || '0.7'}
          </Label>
          <input
            id="temperature"
            type="range"
            min="0"
            max="2"
            step="0.1"
            {...register('temperature', { valueAsNumber: true })}
            className="w-full mt-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Focused</span>
            <span>Creative</span>
          </div>
        </div>

        <div>
          <Label htmlFor="max-tokens">Max Tokens (Optional)</Label>
          <Input
            id="max-tokens"
            type="number"
            {...register('max_tokens', { valueAsNumber: true })}
            placeholder="2000"
            className="mt-2"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Maximum length of the response
          </p>
        </div>
      </div>
    </div>
  );
}
