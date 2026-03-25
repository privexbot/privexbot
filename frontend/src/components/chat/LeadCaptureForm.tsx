/**
 * LeadCaptureForm - Configurable lead capture form for public chat page
 *
 * Features:
 * - Dynamic fields based on configuration (new multi-platform format)
 * - Consent checkbox with customizable message
 * - Skip option (configurable by owner)
 * - Client-side validation
 * - Auto-captures browser metadata
 */

import { useState, useMemo } from 'react';
import { Loader2, User, Mail, Phone, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  LeadCaptureConfig,
  LeadCaptureCustomField,
  StandardFieldsConfig,
} from '@/types/chatbot';
import { FieldVisibility } from '@/types/chatbot';

// Form field interface for rendering
export interface LeadCaptureField {
  name: string;
  type: 'text' | 'email' | 'phone' | 'select';
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

// Lead data for submission
export interface LeadData {
  email: string;
  name?: string;
  phone?: string;
  custom_fields?: Record<string, string>;
  consent_given: boolean;
}

// Re-export config type for backward compatibility
export type { LeadCaptureConfig };

interface LeadCaptureFormProps {
  config: LeadCaptureConfig;
  primaryColor?: string;
  onSubmit: (data: LeadData) => Promise<void>;
  onSkip?: () => void;
  title?: string;
  subtitle?: string;
}

/**
 * Transform new LeadCaptureConfig format into form fields
 *
 * Converts:
 * - StandardFieldsConfig (email/name/phone with visibility) to LeadCaptureField[]
 * - Custom fields to LeadCaptureField[]
 */
function buildFormFields(config: LeadCaptureConfig): LeadCaptureField[] {
  const fields: LeadCaptureField[] = [];

  // Add standard fields based on visibility
  const standardFields = config.fields as StandardFieldsConfig;

  if (standardFields?.email !== FieldVisibility.HIDDEN) {
    fields.push({
      name: 'email',
      type: 'email',
      label: 'Email',
      required: standardFields?.email === FieldVisibility.REQUIRED,
      placeholder: 'Enter your email',
    });
  }

  if (standardFields?.name !== FieldVisibility.HIDDEN) {
    fields.push({
      name: 'name',
      type: 'text',
      label: 'Name',
      required: standardFields?.name === FieldVisibility.REQUIRED,
      placeholder: 'Enter your name',
    });
  }

  if (standardFields?.phone !== FieldVisibility.HIDDEN) {
    fields.push({
      name: 'phone',
      type: 'phone',
      label: 'Phone',
      required: standardFields?.phone === FieldVisibility.REQUIRED,
      placeholder: 'Enter your phone number',
    });
  }

  // Add custom fields
  const customFields = config.custom_fields as LeadCaptureCustomField[] | undefined;
  if (customFields && customFields.length > 0) {
    for (const cf of customFields) {
      fields.push({
        name: cf.name,
        type: cf.type as 'text' | 'email' | 'phone' | 'select',
        label: cf.label,
        required: cf.required,
        placeholder: cf.placeholder,
        options: cf.options,
      });
    }
  }

  // Fallback: If no fields at all, default to required email
  if (fields.length === 0) {
    fields.push({
      name: 'email',
      type: 'email',
      label: 'Email',
      required: true,
      placeholder: 'Enter your email',
    });
  }

  return fields;
}

/**
 * Check if config is in old format (array of fields) or new format (StandardFieldsConfig)
 */
function isOldConfigFormat(fields: unknown): fields is LeadCaptureField[] {
  return Array.isArray(fields);
}

export function LeadCaptureForm({
  config,
  primaryColor = '#3b82f6',
  onSubmit,
  onSkip,
  title = "Before we start...",
  subtitle = "Please share your details so we can assist you better."
}: LeadCaptureFormProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  // Default to true - checkbox is pre-checked or implicit consent when no checkbox shown
  const [consentGiven, setConsentGiven] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Transform config to form fields (memoized)
  const fields = useMemo(() => {
    // Handle old config format (array of fields) for backward compatibility
    if (isOldConfigFormat(config.fields)) {
      return config.fields.length > 0
        ? config.fields
        : [{ name: 'email', type: 'email' as const, label: 'Email', required: true }];
    }
    // New format: StandardFieldsConfig
    return buildFormFields(config);
  }, [config]);

  // Get consent settings from config (handle both old and new format)
  const requireConsent = config.privacy?.require_consent ?? false;
  const consentMessage = config.privacy?.consent_message || 'I agree to the collection and processing of my data.';

  const validateField = (field: LeadCaptureField, value: string): string | null => {
    if (field.required && !value?.trim()) {
      return `${field.label} is required`;
    }

    if (field.type === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Please enter a valid email address';
      }
    }

    if (field.type === 'phone' && value) {
      const phoneRegex = /^[+]?[\d\s()-]{10,}$/;
      if (!phoneRegex.test(value)) {
        return 'Please enter a valid phone number';
      }
    }

    return null;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    for (const field of fields) {
      const error = validateField(field, formData[field.name] || '');
      if (error) {
        newErrors[field.name] = error;
      }
    }

    if (requireConsent && !consentGiven) {
      newErrors.consent = 'You must agree to continue';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const leadData: LeadData = {
        email: formData.email || '',
        name: formData.name,
        phone: formData.phone,
        // Only use consentGiven if checkbox was shown, otherwise false
        consent_given: requireConsent ? consentGiven : false,
      };

      // Add custom fields (non-standard fields)
      const standardFields = ['email', 'name', 'phone'];
      const customFields: Record<string, string> = {};
      for (const [key, value] of Object.entries(formData)) {
        if (!standardFields.includes(key) && value) {
          customFields[key] = value;
        }
      }
      if (Object.keys(customFields).length > 0) {
        leadData.custom_fields = customFields;
      }

      await onSubmit(leadData);
      setSubmitted(true);
    } catch (error) {
      console.error('Failed to submit lead:', error);
      setErrors({ form: 'Failed to submit. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
  };

  const getFieldIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-5 w-5 text-gray-400" />;
      case 'phone':
        return <Phone className="h-5 w-5 text-gray-400" />;
      default:
        return <User className="h-5 w-5 text-gray-400" />;
    }
  };

  // Success state
  if (submitted) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md mx-auto text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: `${primaryColor}20` }}
        >
          <CheckCircle className="h-8 w-8" style={{ color: primaryColor }} />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Thank you!</h2>
        <p className="text-gray-600">Your information has been saved. Let's start chatting!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">{title}</h2>
        <p className="text-gray-600 text-sm">{subtitle}</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Dynamic Fields */}
        {fields.map((field) => (
          <div key={field.name}>
            <label
              htmlFor={field.name}
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {field.type === 'select' && field.options ? (
              <select
                id={field.name}
                value={formData[field.name] || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                className={cn(
                  "w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent",
                  errors[field.name] ? "border-red-300" : "border-gray-300"
                )}
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
              >
                <option value="">Select {field.label.toLowerCase()}</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2">
                  {getFieldIcon(field.type)}
                </span>
                <input
                  id={field.name}
                  type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                  value={formData[field.name] || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  placeholder={field.placeholder || `Enter your ${field.label.toLowerCase()}`}
                  className={cn(
                    "w-full pl-10 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent",
                    errors[field.name] ? "border-red-300" : "border-gray-300"
                  )}
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                />
              </div>
            )}

            {errors[field.name] && (
              <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>
            )}
          </div>
        ))}

        {/* Consent Checkbox */}
        {requireConsent && (
          <div className="pt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 focus:ring-2"
                style={{ accentColor: primaryColor }}
              />
              <span className="text-sm text-gray-600">
                {consentMessage}
              </span>
            </label>
            {errors.consent && (
              <p className="mt-1 text-sm text-red-600">{errors.consent}</p>
            )}
          </div>
        )}

        {/* Form Error */}
        {errors.form && (
          <p className="text-sm text-red-600 text-center">{errors.form}</p>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 rounded-xl text-white font-medium disabled:opacity-50 transition-colors"
            style={{ backgroundColor: primaryColor }}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Submitting...
              </span>
            ) : (
              'Continue to Chat'
            )}
          </button>

          {config.allow_skip && onSkip && (
            <button
              type="button"
              onClick={handleSkip}
              className="w-full py-3 px-4 rounded-xl text-gray-600 font-medium hover:bg-gray-100 transition-colors"
            >
              Skip for now
            </button>
          )}
        </div>
      </form>

      {/* Privacy note */}
      <p className="mt-4 text-xs text-center text-gray-400">
        Your information is secure and will never be shared with third parties.
      </p>
    </div>
  );
}

export default LeadCaptureForm;
