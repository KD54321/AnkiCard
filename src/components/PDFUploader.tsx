import { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
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
  const [success, setSuccess] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    console.log('Processing file:', file.name, 'Size:', file.size);
    
    // Reset states
    setError(null);
    setSuccess(null);
    
    // Validate file
    const validation = PDFService.validateFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 80) {
            clearInterval(progressInterval);
            return 80;
          }
          return prev + 20;
        });
      }, 300);

      // Extract PDF content
      const extractedContent = await PDFService.extractText(file);
      const combinedText = extractedContent.pages
        .map(p => p.text)
        .filter(text => text && text.length > 0)
        .join('\n\n');
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (combinedText.length < 50) {
        throw new Error('PDF appears to contain very little readable text. Please try a different PDF.');
      }
      
      setSuccess(`Successfully extracted ${extractedContent.pageCount} pages from ${file.name}`);
      
      // Call the callback with extracted content
      setTimeout(() => {
        onFileProcessed({
          text: combinedText,
          pageCount: extractedContent.pageCount,
          title: extractedContent.title
        });
        setIsUploading(false);
        setUploadProgress(0);
      }, 1000);

    } catch (err) {
      console.error('PDF processing error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process PDF. Please try a different file.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset input to allow same file selection
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
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

      {success && (
        <Alert className="mb-4 border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            {success}
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
              accept=".pdf,application/pdf"
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
        <p className="mt-1">Make sure your PDF contains readable text (not just images)</p>
      </div>
    </div>
  );
}