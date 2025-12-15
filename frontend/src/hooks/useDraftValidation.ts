/**
 * useDraftValidation - Validation hook before deployment
 *
 * WHY:
 * - Validate draft completeness
 * - Check required fields
 * - Prevent invalid deployments
 *
 * HOW:
 * - Define validation rules
 * - Real-time validation
 * - Error messages and suggestions
 */

import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

type DraftType = 'chatbot' | 'chatflow' | 'kb';

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  suggestion?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  canDeploy: boolean;
}

interface UseDraftValidationOptions {
  draftType: DraftType;
  draftId: string;
  enabled?: boolean;
  validateOnMount?: boolean;
}

interface UseDraftValidationResult {
  validation: ValidationResult;
  isValidating: boolean;
  validate: () => Promise<ValidationResult>;
  getFieldError: (field: string) => ValidationError | undefined;
  hasErrors: boolean;
  hasWarnings: boolean;
}

// Client-side validation rules
const validateChatbotDraft = (data: any): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Required fields
  if (!data.name || data.name.trim().length === 0) {
    errors.push({
      field: 'name',
      message: 'Chatbot name is required',
      severity: 'error',
      suggestion: 'Provide a unique name for your chatbot',
    });
  }

  if (!data.system_prompt || data.system_prompt.trim().length === 0) {
    errors.push({
      field: 'system_prompt',
      message: 'System prompt is required',
      severity: 'error',
      suggestion: 'Add instructions for how your chatbot should behave',
    });
  }

  // LLM configuration
  if (!data.llm_config?.model) {
    errors.push({
      field: 'llm_config.model',
      message: 'LLM model is required',
      severity: 'error',
      suggestion: 'Select an AI model (e.g., gpt-4, claude-3)',
    });
  }

  if (!data.llm_config?.api_key && !data.llm_config?.credential_id) {
    errors.push({
      field: 'llm_config.api_key',
      message: 'API credentials are required',
      severity: 'error',
      suggestion: 'Add API key or select a credential',
    });
  }

  // Temperature validation
  if (
    data.llm_config?.temperature !== undefined &&
    (data.llm_config.temperature < 0 || data.llm_config.temperature > 2)
  ) {
    errors.push({
      field: 'llm_config.temperature',
      message: 'Temperature must be between 0 and 2',
      severity: 'error',
    });
  }

  // Max tokens validation
  if (
    data.llm_config?.max_tokens !== undefined &&
    (data.llm_config.max_tokens < 1 || data.llm_config.max_tokens > 100000)
  ) {
    errors.push({
      field: 'llm_config.max_tokens',
      message: 'Max tokens must be between 1 and 100,000',
      severity: 'error',
    });
  }

  // Warnings
  if (!data.knowledge_base_ids || data.knowledge_base_ids.length === 0) {
    errors.push({
      field: 'knowledge_base_ids',
      message: 'No knowledge base connected',
      severity: 'warning',
      suggestion: 'Connect a knowledge base for more accurate responses',
    });
  }

  if (data.system_prompt && data.system_prompt.length < 50) {
    errors.push({
      field: 'system_prompt',
      message: 'System prompt is very short',
      severity: 'warning',
      suggestion: 'Add more detailed instructions for better results',
    });
  }

  return errors;
};

const validateChatflowDraft = (data: any): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Required fields
  if (!data.name || data.name.trim().length === 0) {
    errors.push({
      field: 'name',
      message: 'Chatflow name is required',
      severity: 'error',
      suggestion: 'Provide a unique name for your chatflow',
    });
  }

  if (!data.nodes || data.nodes.length === 0) {
    errors.push({
      field: 'nodes',
      message: 'At least one node is required',
      severity: 'error',
      suggestion: 'Add nodes to build your chatflow',
    });
  }

  // Check for start node
  const hasStartNode = data.nodes?.some((node: any) => node.type === 'start');
  if (!hasStartNode && data.nodes?.length > 0) {
    errors.push({
      field: 'nodes',
      message: 'No start node found',
      severity: 'error',
      suggestion: 'Add a start node to define the entry point',
    });
  }

  // Check for response nodes
  const hasResponseNode = data.nodes?.some((node: any) => node.type === 'response');
  if (!hasResponseNode && data.nodes?.length > 0) {
    errors.push({
      field: 'nodes',
      message: 'No response node found',
      severity: 'warning',
      suggestion: 'Add at least one response node to send messages to users',
    });
  }

  // Validate node connections
  if (data.edges && data.nodes) {
    const nodeIds = new Set(data.nodes.map((n: any) => n.id));
    const invalidEdges = data.edges.filter(
      (edge: any) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target)
    );

    if (invalidEdges.length > 0) {
      errors.push({
        field: 'edges',
        message: `${invalidEdges.length} invalid connection(s) found`,
        severity: 'error',
        suggestion: 'Remove connections to deleted nodes',
      });
    }
  }

  // Check for orphaned nodes (no connections)
  if (data.nodes && data.edges && data.nodes.length > 1) {
    const connectedNodeIds = new Set([
      ...data.edges.map((e: any) => e.source),
      ...data.edges.map((e: any) => e.target),
    ]);

    const orphanedNodes = data.nodes.filter(
      (node: any) => node.type !== 'start' && !connectedNodeIds.has(node.id)
    );

    if (orphanedNodes.length > 0) {
      errors.push({
        field: 'nodes',
        message: `${orphanedNodes.length} disconnected node(s) found`,
        severity: 'warning',
        suggestion: 'Connect or remove orphaned nodes',
      });
    }
  }

  return errors;
};

const validateKBDraft = (data: any): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Required fields
  if (!data.name || data.name.trim().length === 0) {
    errors.push({
      field: 'name',
      message: 'Knowledge base name is required',
      severity: 'error',
      suggestion: 'Provide a unique name for your knowledge base',
    });
  }

  if (!data.sources || data.sources.length === 0) {
    errors.push({
      field: 'sources',
      message: 'At least one data source is required',
      severity: 'error',
      suggestion: 'Upload files, connect integrations, or paste text',
    });
  }

  // Check source status
  if (data.sources) {
    const failedSources = data.sources.filter((s: any) => s.status === 'failed');
    if (failedSources.length > 0) {
      errors.push({
        field: 'sources',
        message: `${failedSources.length} source(s) failed to process`,
        severity: 'error',
        suggestion: 'Remove or retry failed sources',
      });
    }

    const processingSources = data.sources.filter((s: any) => s.status === 'processing');
    if (processingSources.length > 0) {
      errors.push({
        field: 'sources',
        message: `${processingSources.length} source(s) still processing`,
        severity: 'warning',
        suggestion: 'Wait for all sources to finish processing',
      });
    }
  }

  // Chunking configuration
  if (!data.chunk_config?.size || data.chunk_config.size < 100) {
    errors.push({
      field: 'chunk_config.size',
      message: 'Chunk size should be at least 100 characters',
      severity: 'warning',
      suggestion: 'Increase chunk size for better context',
    });
  }

  if (
    data.chunk_config?.overlap !== undefined &&
    data.chunk_config.overlap >= data.chunk_config.size
  ) {
    errors.push({
      field: 'chunk_config.overlap',
      message: 'Chunk overlap must be less than chunk size',
      severity: 'error',
    });
  }

  return errors;
};

export function useDraftValidation({
  draftType,
  draftId,
  enabled = true,
  validateOnMount = true,
}: UseDraftValidationOptions): UseDraftValidationResult {
  // Fetch draft data
  const { data: draftData, isLoading } = useQuery({
    queryKey: [`${draftType}-draft`, draftId],
    queryFn: async () => {
      const response = await apiClient.get(`/${draftType === 'kb' ? 'kb-drafts' : `${draftType}s/drafts`}/${draftId}`);
      return response.data;
    },
    enabled: enabled && !!draftId,
  });

  // Perform client-side validation
  const validation = useMemo((): ValidationResult => {
    if (!draftData) {
      return {
        isValid: false,
        errors: [],
        warnings: [],
        canDeploy: false,
      };
    }

    let validationErrors: ValidationError[] = [];

    switch (draftType) {
      case 'chatbot':
        validationErrors = validateChatbotDraft(draftData);
        break;
      case 'chatflow':
        validationErrors = validateChatflowDraft(draftData);
        break;
      case 'kb':
        validationErrors = validateKBDraft(draftData);
        break;
    }

    const errors = validationErrors.filter((e) => e.severity === 'error');
    const warnings = validationErrors.filter((e) => e.severity === 'warning');

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      canDeploy: errors.length === 0,
    };
  }, [draftData, draftType]);

  // Server-side validation (comprehensive)
  const validate = useCallback(async (): Promise<ValidationResult> => {
    try {
      const endpoint = `/${draftType === 'kb' ? 'kb-drafts' : `${draftType}s/drafts`}/${draftId}/validate`;
      const response = await apiClient.post(endpoint);

      return {
        isValid: response.data.is_valid,
        errors: response.data.errors || [],
        warnings: response.data.warnings || [],
        canDeploy: response.data.can_deploy,
      };
    } catch (error: any) {
      // If validation endpoint fails, fall back to client-side validation
      return validation;
    }
  }, [draftType, draftId, validation]);

  const getFieldError = useCallback(
    (field: string): ValidationError | undefined => {
      return [...validation.errors, ...validation.warnings].find((e) => e.field === field);
    },
    [validation]
  );

  return {
    validation,
    isValidating: isLoading,
    validate,
    getFieldError,
    hasErrors: validation.errors.length > 0,
    hasWarnings: validation.warnings.length > 0,
  };
}
