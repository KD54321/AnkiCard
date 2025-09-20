import React, { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { PDFService } from '../services/pdfService';

interface PDFUploaderProps {
  onFileProcessed?: (content: { text: string; pageCount: number; title?: string }) => void;
  isProcessing?: boolean;
}

export default function PDFUploader({ 
  onFileProcessed = () => {}, 
  isProcessing = false 
}: PDFUploaderProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = async (file: File) => {
    // Validate file
    const validation = PDFService.validateFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Extract PDF content
      const extractedContent = await PDFService.extractText(file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Call the callback with extracted content
      setTimeout(() => {
        onFileProcessed(extractedContent);
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process PDF');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload PDF Notes</h2>
        <p className="text-gray-600">
          Drag and drop your PDF class notes or click to browse
        </p>
      </div>

      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <Card className={`border-2 border-dashed transition-colors ${
        isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
      }`}>
        <CardContent className="p-8">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`text-center transition-colors ${
              isDragOver ? 'text-blue-600' : 'text-gray-500'
            } ${(isUploading || isProcessing) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
          >
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileInput}
              disabled={isUploading || isProcessing}
              className="hidden"
              id="pdf-upload"
            />
            
            {isUploading ? (
              <div className="space-y-4">
                <FileText className="mx-auto h-12 w-12 text-blue-500" />
                <div>
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    Processing PDF...
                  </p>
                  <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
                  <p className="text-sm text-gray-500 mt-2">
                    {uploadProgress}% complete
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="mx-auto h-12 w-12" />
                <div>
                  <p className="text-lg font-medium text-gray-900">
                    {isDragOver ? 'Drop your PDF here' : 'Choose PDF file'}
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    Maximum file size: 10MB
                  </p>
                  <Button asChild>
                    <label htmlFor="pdf-upload" className="cursor-pointer">
                      Browse Files
                    </label>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 text-center text-sm text-gray-500">
        <p>Supported format: PDF • Maximum size: 10MB</p>
      </div>
    </div>
  );
}