'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Check, AlertCircle } from 'lucide-react';
import { uploadScreenshots } from '@/lib/api';
import Button from './ui/Button';

interface UploadedFile {
  id: string;
  filename: string;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

interface ScreenshotUploaderProps {
  onUploadComplete?: (screenshots: any[]) => void;
  source?: string;
}

export default function ScreenshotUploader({
  onUploadComplete,
  source = 'whatsapp'
}: ScreenshotUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setUploading(true);

    // Add files to state
    const newFiles: UploadedFile[] = acceptedFiles.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      filename: file.name,
      status: 'uploading' as const,
    }));
    setFiles(prev => [...prev, ...newFiles]);

    try {
      const result = await uploadScreenshots(acceptedFiles, source);

      // Update file statuses
      setFiles(prev =>
        prev.map(f => {
          if (newFiles.find(nf => nf.id === f.id)) {
            const uploadedFile = result.screenshots?.find(
              (s: any) => s.filename === f.filename
            );
            const errorFile = result.error_details?.find(
              (e: any) => e.filename === f.filename
            );

            if (uploadedFile) {
              return { ...f, status: 'success' as const };
            } else if (errorFile) {
              return { ...f, status: 'error' as const, error: errorFile.error };
            }
          }
          return f;
        })
      );

      if (onUploadComplete && result.screenshots) {
        onUploadComplete(result.screenshots);
      }
    } catch (error) {
      setFiles(prev =>
        prev.map(f => {
          if (newFiles.find(nf => nf.id === f.id)) {
            return { ...f, status: 'error' as const, error: 'Upload failed' };
          }
          return f;
        })
      );
    } finally {
      setUploading(false);
    }
  }, [source, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    multiple: true
  });

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAll = () => {
    setFiles([]);
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
          transition-all duration-200
          ${isDragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}
          ${uploading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} />

        {uploading ? (
          <div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
            <p className="mt-4 text-gray-600">Uploading screenshots...</p>
          </div>
        ) : isDragActive ? (
          <div>
            <Upload className="h-12 w-12 text-primary-500 mx-auto" />
            <p className="mt-4 text-primary-600 text-lg font-medium">
              Drop screenshots here...
            </p>
          </div>
        ) : (
          <div>
            <Upload className="h-12 w-12 text-gray-400 mx-auto" />
            <p className="mt-4 text-lg text-gray-600">
              Drag & drop screenshots here
            </p>
            <p className="mt-2 text-sm text-gray-500">
              or click to select files
            </p>
            <p className="mt-4 text-xs text-gray-400">
              Supports PNG, JPG, JPEG, GIF, WebP
            </p>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">
              Uploaded Files ({files.length})
            </h3>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear all
            </Button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {files.map(file => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {file.status === 'uploading' && (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600" />
                  )}
                  {file.status === 'success' && (
                    <Check className="h-5 w-5 text-green-500" />
                  )}
                  {file.status === 'error' && (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className="text-sm text-gray-700 truncate max-w-xs">
                    {file.filename}
                  </span>
                  {file.error && (
                    <span className="text-xs text-red-500">{file.error}</span>
                  )}
                </div>
                <button
                  onClick={() => removeFile(file.id)}
                  className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
