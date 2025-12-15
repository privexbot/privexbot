/**
 * FileUploader - Drag & drop file upload with temp storage
 *
 * WHY:
 * - User-friendly file upload
 * - Multiple file support
 * - Visual feedback
 *
 * HOW:
 * - react-dropzone integration
 * - FormData upload
 * - Progress tracking
 */

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import { Upload, File, X, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import apiClient, { handleApiError } from '@/lib/api-client';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'success' | 'error';
  error?: string;
  progress?: number;
}

interface FileUploaderProps {
  draftId: string;
  onFilesUploaded?: (files: UploadedFile[]) => void;
}

export default function FileUploader({ draftId, onFilesUploaded }: FileUploaderProps) {
  const { toast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post(
        `/kb-drafts/${draftId}/documents/upload`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
      return response.data;
    },
  });

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
        id: Math.random().toString(36).substring(7),
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'uploading' as const,
        progress: 0,
      }));

      setUploadedFiles((prev) => [...prev, ...newFiles]);

      // Upload each file
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        const fileId = newFiles[i].id;

        try {
          await uploadMutation.mutateAsync(file);

          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === fileId ? { ...f, status: 'success' as const, progress: 100 } : f
            )
          );
        } catch (error) {
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? {
                    ...f,
                    status: 'error' as const,
                    error: handleApiError(error),
                  }
                : f
            )
          );

          toast({
            title: 'Upload failed',
            description: `${file.name}: ${handleApiError(error)}`,
            variant: 'destructive',
          });
        }
      }

      if (onFilesUploaded) {
        const successFiles = uploadedFiles.filter((f) => f.status === 'success');
        onFilesUploaded(successFiles);
      }
    },
    [draftId, uploadMutation, onFilesUploaded, toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'text/csv': ['.csv'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-primary bg-primary/10'
            : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="w-8 h-8 text-primary" />
          </div>

          {isDragActive ? (
            <p className="text-lg font-medium">Drop files here...</p>
          ) : (
            <>
              <p className="text-lg font-medium">Drag & drop files here</p>
              <p className="text-sm text-muted-foreground">or click to browse</p>
            </>
          )}

          <div className="text-xs text-muted-foreground space-y-1">
            <p>Supported formats: PDF, DOCX, TXT, MD, CSV</p>
            <p>Maximum file size: 10 MB</p>
          </div>
        </div>
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">
            Uploaded Files ({uploadedFiles.filter((f) => f.status === 'success').length}/
            {uploadedFiles.length})
          </h4>

          <div className="space-y-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 border rounded-lg bg-card"
              >
                <div className="flex-shrink-0">
                  {file.status === 'uploading' && (
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  )}
                  {file.status === 'success' && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  {file.status === 'error' && (
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <span className="text-xs text-muted-foreground ml-2">
                      {formatFileSize(file.size)}
                    </span>
                  </div>

                  {file.status === 'uploading' && file.progress !== undefined && (
                    <Progress value={file.progress} className="h-1" />
                  )}

                  {file.status === 'error' && file.error && (
                    <p className="text-xs text-destructive">{file.error}</p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(file.id)}
                  disabled={file.status === 'uploading'}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
