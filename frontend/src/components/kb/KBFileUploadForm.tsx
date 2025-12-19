/**
 * KBFileUploadForm - File upload form for KB creation
 *
 * Integrates with kb-store's addFileSource/addFileSourcesBulk actions
 * Uses Apache Tika backend for document parsing (15+ formats)
 */

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  X,
  CheckCircle,
  Loader2,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  FileType,
  FileImage,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useKBStore } from '@/store/kb-store';
import { cn } from '@/lib/utils';

interface FileComplexity {
  complexity: 'low' | 'medium' | 'high' | 'very_high';
  estimatedSeconds: number;
  warnings: string[];
  canProcess: boolean;
}

interface UploadedFileState {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'parsing' | 'success' | 'error';
  error?: string;
  progress: number;
  statusMessage?: string; // For showing parsing status
  complexity?: FileComplexity; // File complexity analysis
  result?: {
    source_id: string;
    page_count: number;
    char_count: number;
    word_count: number;
    parsing_time_ms: number;
    warnings?: string[];
  };
}

// Supported file types (matches backend Tika capabilities)
const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'text/markdown': ['.md'],
  'application/json': ['.json'],
  'text/html': ['.html'],
  'application/rtf': ['.rtf'],
  'application/epub+zip': ['.epub'],
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB (increased for larger files)
const MAX_FILES = 20;

// Analyze file complexity for user feedback
function analyzeFileComplexity(file: File): FileComplexity {
  const fileSizeMB = file.size / (1024 * 1024);
  const warnings: string[] = [];
  let complexity: 'low' | 'medium' | 'high' | 'very_high' = 'low';
  let estimatedSeconds = 5;

  // Fast parse types
  const fastTypes = ['text/plain', 'text/csv', 'text/markdown', 'application/json', 'text/html'];
  const ocrTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff'];

  const isFastType = fastTypes.some(t => file.type.includes(t));
  const isOcrType = ocrTypes.some(t => file.type.includes(t) || file.name.toLowerCase().endsWith('.pdf'));

  // Estimate processing time
  if (isFastType) {
    estimatedSeconds = Math.ceil(2 + fileSizeMB * 0.5);
    complexity = 'low';
  } else if (isOcrType) {
    estimatedSeconds = Math.ceil(10 + fileSizeMB * 8); // OCR is slow
    complexity = fileSizeMB > 5 ? 'high' : 'medium';
    if (fileSizeMB > 5) {
      warnings.push('May require OCR - expect longer processing time');
    }
  } else {
    estimatedSeconds = Math.ceil(5 + fileSizeMB * 2);
    complexity = 'medium';
  }

  // Size-based warnings
  if (fileSizeMB > 20) {
    warnings.push(`Large file (${fileSizeMB.toFixed(1)} MB)`);
    complexity = complexity === 'low' ? 'medium' : complexity === 'medium' ? 'high' : 'very_high';
  }
  if (fileSizeMB > 50) {
    warnings.push('Consider splitting into smaller documents');
    complexity = 'very_high';
  }

  const canProcess = fileSizeMB <= 100;
  if (!canProcess) {
    warnings.push('Exceeds maximum size of 100MB');
  }

  return { complexity, estimatedSeconds, warnings, canProcess };
}

// Get complexity badge color
function getComplexityColor(complexity: string): string {
  switch (complexity) {
    case 'low': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
    case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
    case 'high': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
    case 'very_high': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
    default: return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300';
  }
}

// Format estimated time
function formatEstimatedTime(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return `~${minutes} min`;
}

// Get icon based on file type
function getFileIcon(mimeType: string) {
  if (mimeType.includes('pdf')) return FileText;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheet;
  if (mimeType.includes('image')) return FileImage;
  return FileType;
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface KBFileUploadFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  onBeforeUpload?: () => Promise<unknown>; // Called to ensure draft exists
}

export function KBFileUploadForm({ onSuccess, onCancel, onBeforeUpload }: KBFileUploadFormProps) {
  const [files, setFiles] = useState<UploadedFileState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPreparingDraft, setIsPreparingDraft] = useState(false);

  const { addFileSource } = useKBStore();

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    rejectedFiles.forEach((rejected) => {
      const error = rejected.errors?.[0]?.message || 'File not accepted';
      console.warn(`File rejected: ${rejected.file.name} - ${error}`);
    });

    // Add accepted files to state with complexity analysis
    const newFiles: UploadedFileState[] = acceptedFiles.map((file) => {
      const complexity = analyzeFileComplexity(file);
      return {
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'pending' as const,
        progress: 0,
        complexity,
      };
    });

    setFiles((prev) => {
      // Prevent duplicates and limit total files
      const existing = new Set(prev.map((f) => f.name));
      const unique = newFiles.filter((f) => !existing.has(f.name));
      return [...prev, ...unique].slice(0, MAX_FILES);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES,
    disabled: isUploading,
  });

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    // Ensure draft exists before uploading
    if (onBeforeUpload) {
      setIsPreparingDraft(true);
      try {
        await onBeforeUpload();
      } catch (error) {
        console.error('Failed to prepare draft:', error);
        setIsPreparingDraft(false);
        return;
      }
      setIsPreparingDraft(false);
    }

    setIsUploading(true);

    // Upload files in PARALLEL for faster processing
    // Each file is processed independently by Tika
    const pendingFileStates = files.filter(f => f.status !== 'success');

    // Mark all files as uploading
    setFiles((prev) =>
      prev.map((f) =>
        f.status === 'pending'
          ? { ...f, status: 'uploading' as const, progress: 10, statusMessage: 'Uploading...' }
          : f
      )
    );

    // Helper function to upload a single file
    const uploadSingleFile = async (fileState: UploadedFileState): Promise<boolean> => {
      // Start progress animation for this file
      const progressInterval = setInterval(() => {
        setFiles((prev) =>
          prev.map((f) => {
            if (f.id === fileState.id && (f.status === 'uploading' || f.status === 'parsing') && f.progress < 90) {
              return { ...f, progress: f.progress + 5 };
            }
            return f;
          })
        );
      }, 3000);

      try {
        // Update to parsing status
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileState.id
              ? { ...f, status: 'parsing' as const, progress: 30, statusMessage: 'Parsing document (OCR may take a while)...' }
              : f
          )
        );

        // Call the store action (this is the slow part)
        const result = await addFileSource(fileState.file);

        clearInterval(progressInterval);

        // Update with success
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileState.id
              ? {
                  ...f,
                  status: 'success' as const,
                  progress: 100,
                  statusMessage: undefined,
                  result: {
                    source_id: result.source_id,
                    page_count: result.page_count,
                    char_count: result.char_count,
                    word_count: result.word_count,
                    parsing_time_ms: result.parsing_time_ms,
                  },
                }
              : f
          )
        );
        return true;
      } catch (error) {
        clearInterval(progressInterval);
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileState.id
              ? { ...f, status: 'error' as const, error: errorMessage, statusMessage: undefined }
              : f
          )
        );
        return false;
      }
    };

    // Upload all files in parallel
    const results = await Promise.all(
      pendingFileStates.map(fileState => uploadSingleFile(fileState))
    );

    setIsUploading(false);

    // Check if all uploads succeeded
    const allSucceeded = results.every(success => success);
    if (allSucceeded && onSuccess) {
      onSuccess();
    }
  };

  const pendingFiles = files.filter((f) => f.status === 'pending');
  const successFiles = files.filter((f) => f.status === 'success');
  const hasFilesToUpload = pendingFiles.length > 0;

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive && !isDragReject && 'border-primary bg-primary/5',
          isDragReject && 'border-destructive bg-destructive/5',
          !isDragActive && 'border-gray-300 dark:border-gray-600 hover:border-primary/50',
          isUploading && 'pointer-events-none opacity-50'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-10 w-10 mx-auto mb-4 text-gray-400" />
        {isDragActive ? (
          isDragReject ? (
            <p className="text-destructive font-medium">Some files are not supported</p>
          ) : (
            <p className="text-primary font-medium">Drop files here...</p>
          )
        ) : (
          <>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Drag & drop files here, or click to browse
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              PDF, Word, Excel, PowerPoint, Text, CSV, Markdown, JSON, HTML
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Max {MAX_FILES} files, up to {formatFileSize(MAX_FILE_SIZE)} each
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Large PDFs with scanned images may take several minutes to process
            </p>
          </>
        )}
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Files ({files.length})
            </h4>
            {successFiles.length > 0 && (
              <span className="text-xs text-green-600 dark:text-green-400">
                {successFiles.length} uploaded
              </span>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
            {files.map((fileState) => {
              const FileIcon = getFileIcon(fileState.type);
              return (
                <div
                  key={fileState.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border',
                    fileState.status === 'success' && 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
                    fileState.status === 'error' && 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
                    fileState.status === 'uploading' && 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
                    fileState.status === 'parsing' && 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
                    fileState.status === 'pending' && 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                  )}
                >
                  <FileIcon className="h-8 w-8 text-gray-400 flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">
                        {fileState.name}
                      </p>
                      {/* Complexity badge - shown for pending files */}
                      {fileState.status === 'pending' && fileState.complexity && (
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded font-medium',
                          getComplexityColor(fileState.complexity.complexity)
                        )}>
                          {fileState.complexity.complexity === 'very_high' ? 'complex' : fileState.complexity.complexity}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                      <span>{formatFileSize(fileState.size)}</span>
                      {/* Estimated time for pending files */}
                      {fileState.status === 'pending' && fileState.complexity && (
                        <>
                          <span>•</span>
                          <span title="Estimated processing time">
                            {formatEstimatedTime(fileState.complexity.estimatedSeconds)}
                          </span>
                        </>
                      )}
                      {fileState.statusMessage && (
                        <span className="text-amber-600 dark:text-amber-400">
                          {fileState.statusMessage}
                        </span>
                      )}
                      {fileState.result && (
                        <>
                          <span>•</span>
                          <span>{fileState.result.page_count} pages</span>
                          <span>•</span>
                          <span>{fileState.result.word_count.toLocaleString()} words</span>
                          <span>•</span>
                          <span>{(fileState.result.parsing_time_ms / 1000).toFixed(1)}s</span>
                        </>
                      )}
                    </div>

                    {/* Complexity warnings for high/very_high complexity files */}
                    {fileState.status === 'pending' && fileState.complexity?.warnings && fileState.complexity.warnings.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {fileState.complexity.warnings.slice(0, 2).map((warning, idx) => (
                          <span key={idx} className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {warning}
                          </span>
                        ))}
                      </div>
                    )}

                    {(fileState.status === 'uploading' || fileState.status === 'parsing') && (
                      <Progress value={fileState.progress} className="h-1 mt-2" />
                    )}

                    {fileState.status === 'error' && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1 whitespace-pre-line">
                        {fileState.error}
                      </p>
                    )}
                  </div>

                  <div className="flex-shrink-0">
                    {fileState.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(fileState.id)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    {(fileState.status === 'uploading' || fileState.status === 'parsing') && (
                      <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
                    )}
                    {fileState.status === 'success' && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {fileState.status === 'error' && (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Estimated Time Summary */}
      {pendingFiles.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <span>Total estimated time:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatEstimatedTime(
                  pendingFiles.reduce((total, f) => total + (f.complexity?.estimatedSeconds || 10), 0)
                )}
              </span>
            </div>
            {pendingFiles.some(f => f.complexity?.complexity === 'high' || f.complexity?.complexity === 'very_high') && (
              <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Complex files may take longer
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isUploading || isPreparingDraft}
          >
            Cancel
          </Button>
        )}
        <Button
          onClick={uploadFiles}
          disabled={!hasFilesToUpload || isUploading || isPreparingDraft}
        >
          {isPreparingDraft ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Preparing...
            </>
          ) : isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload {pendingFiles.length > 0 ? `(${pendingFiles.length})` : ''}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
