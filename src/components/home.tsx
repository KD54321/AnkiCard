// src/components/home.tsx
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { FileText, Eye, Settings as SettingsIcon, History, Download } from 'lucide-react';
import PDFUploader from './PDFUploader';
import ContentPreview from './ContentPreview';
import CardFormatOptions from './CardFormatOptions';
import Settings from './Settings';
import { FlashCard } from '../services/aiService';

interface ExtractedContent {
  text: string;
  pageCount: number;
  title?: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('upload');
  const [extractedContent, setExtractedContent] = useState<ExtractedContent | null>(null);
  const [flashcards, setFlashcards] = useState<FlashCard[]>([]);
  const [cardFormat, setCardFormat] = useState<'basic' | 'cloze' | 'image'>('basic');
  const [processingHistory, setProcessingHistory] = useState<Array<{
    id: string;
    title: string;
    date: string;
    cardCount: number;
  }>>([]);

  const handleFileProcessed = (content: ExtractedContent) => {
    setExtractedContent(content);
    setActiveTab('preview');

    const historyItem = {
      id: Date.now().toString(),
      title: content.title || 'Untitled Document',
      date: new Date().toLocaleDateString(),
      cardCount: 0
    };
    setProcessingHistory(prev => [historyItem, ...prev.slice(0, 9)]); // Keep last 10
  };

  const handleContentProcessed = (cards: FlashCard[]) => {
    setFlashcards(cards);

    setProcessingHistory(prev => 
      prev.map((item, index) => 
        index === 0 ? { ...item, cardCount: cards.length } : item
      )
    );
  };

  const handleFormatChange = (format: 'basic' | 'cloze' | 'image') => {
    setCardFormat(format);
  };

  const getTabStatus = (tab: string) => {
    switch (tab) {
      case 'upload':
        return extractedContent ? 'completed' : 'current';
      case 'preview':
        return !extractedContent ? 'disabled' : flashcards.length > 0 ? 'completed' : 'current';
      case 'format':
        return extractedContent ? 'current' : 'disabled';
      case 'history':
      case 'settings':
        return 'available';
      default:
        return 'disabled';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="ml-2 bg-green-500 text-white">✓</Badge>;
      case 'current':
        return null; // Don't show badge for current tab
      case 'disabled':
        return null; // Don't show badge for disabled tabs
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            PDF Notes to Anki Flashcards
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Transform your optometry lecture slides into study-ready flashcards with AI
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8 max-w-3xl mx-auto">
          <div className="flex justify-center items-center space-x-4 text-sm">
            <div className={`flex items-center ${getTabStatus('upload') === 'completed' ? 'text-green-600' : 'text-blue-600'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${
                getTabStatus('upload') === 'completed' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
              }`}>
                1
              </div>
              Upload
            </div>
            <div className="w-12 h-px bg-gray-300"></div>
            <div className={`flex items-center ${
              getTabStatus('preview') === 'completed' ? 'text-green-600' : 
              getTabStatus('preview') === 'current' ? 'text-blue-600' : 'text-gray-400'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${
                getTabStatus('preview') === 'completed' ? 'bg-green-500 text-white' :
                getTabStatus('preview') === 'current' ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-500'
              }`}>
                2
              </div>
              Review
            </div>
            <div className="w-12 h-px bg-gray-300"></div>
            <div className={`flex items-center ${
              getTabStatus('format') === 'current' ? 'text-blue-600' : 'text-gray-400'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${
                getTabStatus('format') === 'current' ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-500'
              }`}>
                3
              </div>
              Export
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 max-w-3xl mx-auto mb-8">
            <TabsTrigger value="upload" className="flex items-center gap-1" disabled={false}>
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Upload</span>
              {getStatusBadge(getTabStatus('upload'))}
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-1" disabled={getTabStatus('preview') === 'disabled'}>
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Preview</span>
              {getStatusBadge(getTabStatus('preview'))}
            </TabsTrigger>
            <TabsTrigger value="format" className="flex items-center gap-1" disabled={getTabStatus('format') === 'disabled'}>
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
              {getStatusBadge(getTabStatus('format'))}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1">
              <SettingsIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <PDFUploader onFileProcessed={handleFileProcessed} isProcessing={false} />
          </TabsContent>

          <TabsContent value="preview">
            <ContentPreview
              extractedContent={extractedContent}
              onContentProcessed={handleContentProcessed}
              cardFormat={cardFormat}
            />
          </TabsContent>

          <TabsContent value="format">
            <CardFormatOptions
              selectedFormat={cardFormat}
              onFormatChange={handleFormatChange}
              flashcards={flashcards}
              deckName={extractedContent?.title || 'Generated Deck'}
              extractedText={extractedContent?.text || ''}
            />
          </TabsContent>

          <TabsContent value="history">
            <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Processing History</h2>
              {processingHistory.length === 0 ? (
                <Card className="border-dashed border-2 border-gray-300">
                  <CardContent className="p-12 text-center">
                    <History className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No history yet</h3>
                    <p className="text-gray-500">Your processed documents will appear here</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {processingHistory.map((item) => (
                    <Card key={item.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex justify-between items-center">
                        <div>
                          <h3 className="font-medium text-gray-900">{item.title}</h3>
                          <p className="text-sm text-gray-500">Processed on {item.date}</p>
                        </div>
                        <Badge className="bg-blue-500">{item.cardCount} cards</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <Settings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}