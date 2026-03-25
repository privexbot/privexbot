/**
 * File Upload Component
 *
 * Handles file uploads with drag & drop support and file validation
 */

import { useState, useRef } from 'react';
import { FileText, Upload, X, AlertCircle, CheckCircle, Settings, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/components/ui/use-toast';

interface KBFileUploadProps {
  onAdd: (sourceData: any) => void;
  onCancel: () => void;
}

interface FileWithPreview {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  progress: number;
  error?: string;
  preview?: string;
}

export function KBFileUpload({ onAdd, onCancel }: KBFileUploadProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [config, setConfig] = useState({
    file_type: 'auto',
    extract_tables: true,
    preserve_formatting: true,
    split_pages: false,
    ocr_enabled: true,
    language: 'auto'
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const supportedTypes = {
    'application/pdf': { ext: '.pdf', name: 'PDF Document' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: '.docx', name: 'Word Document' },
    'application/msword': { ext: '.doc', name: 'Word Document (Legacy)' },
    'text/plain': { ext: '.txt', name: 'Text File' },
    'text/csv': { ext: '.csv', name: 'CSV File' },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: '.xlsx', name: 'Excel Spreadsheet' },
    'application/vnd.ms-excel': { ext: '.xls', name: 'Excel Spreadsheet (Legacy)' },
    'text/markdown': { ext: '.md', name: 'Markdown File' },
    'application/json': { ext: '.json', name: 'JSON File' },
    'application/rtf': { ext: '.rtf', name: 'Rich Text Format' }
  };

  const maxFileSize = 50 * 1024 * 1024; // 50MB

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File too large. Maximum size is 50MB.`;
    }

    if (!Object.keys(supportedTypes).includes(file.type)) {
      return `Unsupported file type: ${file.type}`;
    }

    return null;
  };

  const generateFileId = () => Math.random().toString(36).substr(2, 9);

  const handleFileSelect = (selectedFiles: FileList | File[]) => {
    const fileArray = Array.from(selectedFiles);
    const newFiles: FileWithPreview[] = [];

    for (const file of fileArray) {
      const error = validateFile(file);
      newFiles.push({
        file,
        id: generateFileId(),
        status: error ? 'error' : 'pending',
        progress: 0,
        error: error || undefined
      });
    }

    setFiles(prev => [...prev, ...newFiles]);

    // Show errors for invalid files
    const errorFiles = newFiles.filter(f => f.error);
    if (errorFiles.length > 0) {
      toast({
        title: 'Some files could not be added',
        description: `${errorFiles.length} files had errors`,
        variant: 'destructive'
      });
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    const droppedFiles = e.dataTransfer.files;
    handleFileSelect(droppedFiles);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const simulateUpload = (fileId: string) => {
    const interval = setInterval(() => {
      setFiles(prev => prev.map(f => {
        if (f.id === fileId && f.status === 'uploading') {
          const newProgress = Math.min(f.progress + 10, 100);
          if (newProgress === 100) {
            clearInterval(interval);
            return { ...f, status: 'uploaded', progress: 100 };
          }
          return { ...f, progress: newProgress };
        }
        return f;
      }));
    }, 200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validFiles = files.filter(f => !f.error);
    if (validFiles.length === 0) {
      toast({
        title: 'No valid files',
        description: 'Please add at least one valid file',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);

    try {
      // Simulate upload process
      for (const fileObj of validFiles) {
        setFiles(prev => prev.map(f =>
          f.id === fileObj.id ? { ...f, status: 'uploading', progress: 0 } : f
        ));
        simulateUpload(fileObj.id);
      }

      // Wait for all uploads to complete
      await new Promise(resolve => {
        const checkUploads = () => {
          const uploadingFiles = files.filter(f => f.status === 'uploading');
          if (uploadingFiles.length === 0) {
            resolve(void 0);
          } else {
            setTimeout(checkUploads, 100);
          }
        };
        checkUploads();
      });

      // Process files
      for (const fileObj of validFiles) {
        onAdd({
          file: fileObj.file,
          config: {
            ...config,
            filename: fileObj.file.name,
            size: fileObj.file.size,
            type: fileObj.file.type
          }
        });
      }

      // Reset form
      setFiles([]);
      setConfig({
        file_type: 'auto',
        extract_tables: true,
        preserve_formatting: true,
        split_pages: false,
        ocr_enabled: true,
        language: 'auto'
      });

    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload files',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getFileTypeIcon = (file: File) => {
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Files
        </CardTitle>
        <CardDescription>
          Upload documents, PDFs, spreadsheets and other files
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              isDragOver
                ? 'border-primary bg-primary/5'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Drop files here or click to browse
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Support for PDF, DOCX, CSV, XLSX, TXT and more
            </p>
            <p className="text-xs text-gray-400">
              Maximum file size: 50MB each
            </p>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={Object.keys(supportedTypes).join(',')}
              onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
              className="hidden"
            />
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium">Selected Files ({files.length})</h3>
              {files.map((fileObj) => (
                <div key={fileObj.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  {getFileTypeIcon(fileObj.file)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{fileObj.file.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(fileObj.file.size)}
                    </p>

                    {fileObj.status === 'uploading' && (
                      <Progress value={fileObj.progress} className="mt-2 h-2" />
                    )}

                    {fileObj.error && (
                      <p className="text-sm text-red-500 mt-1">
                        <AlertCircle className="h-3 w-3 inline mr-1" />
                        {fileObj.error}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {fileObj.status === 'uploaded' && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {fileObj.status === 'error' && (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(fileObj.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Advanced Options */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Advanced Options
                <span className="text-xs text-muted-foreground">
                  {showAdvanced ? '▼' : '▶'}
                </span>
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>File Processing</Label>
                  <Select
                    value={config.file_type}
                    onValueChange={(value) => setConfig({ ...config, file_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="docx">Word Document</SelectItem>
                      <SelectItem value="txt">Text File</SelectItem>
                      <SelectItem value="csv">CSV/Excel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select
                    value={config.language}
                    onValueChange={(value) => setConfig({ ...config, language: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="extract-tables"
                    checked={config.extract_tables}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, extract_tables: !!checked })
                    }
                  />
                  <Label htmlFor="extract-tables" className="text-sm">
                    Extract tables and structured data
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="preserve-formatting"
                    checked={config.preserve_formatting}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, preserve_formatting: !!checked })
                    }
                  />
                  <Label htmlFor="preserve-formatting" className="text-sm">
                    Preserve document formatting
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="split-pages"
                    checked={config.split_pages}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, split_pages: !!checked })
                    }
                  />
                  <Label htmlFor="split-pages" className="text-sm">
                    Split by pages (for PDFs)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ocr-enabled"
                    checked={config.ocr_enabled}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, ocr_enabled: !!checked })
                    }
                  />
                  <Label htmlFor="ocr-enabled" className="text-sm">
                    Enable OCR for scanned documents
                  </Label>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Actions */}
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isUploading || files.filter(f => !f.error).length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              {isUploading ? 'Uploading...' : `Add ${files.filter(f => !f.error).length} Files`}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}