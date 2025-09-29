import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { FileText, Eye, Settings, History } from 'lucide-react';
import PDFUploader from './PDFUploader';
import ContentPreview from './ContentPreview';
import CardFormatOptions from './CardFormatOptions';
import { FlashCard } from '../services/parserService';

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
        return 'available';
      default:
        return 'disabled';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="ml-2 bg-green-500">✓</Badge>;
      case 'current':
        return <Badge className="ml-2 bg-gray-200 text-gray-700">Current</Badge>;
      case 'disabled':
        return <Badge className="ml-2 opacity-50 border border-gray-300">Locked</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            PDF Notes to Anki Cards Converter
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Transform your class notes into study-ready flashcards
          </p>
        </div>

        <div className="mb-8">
          <div className="flex justify-center items-center space-x-4 text-sm">
            <div className={`flex items-center ${getTabStatus('upload') === 'completed' ? 'text-green-600' : 'text-blue-600'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${
                getTabStatus('upload') === 'completed' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
              }`}>
                1
              </div>
              Upload PDF
            </div>
            <div className="w-8 h-px bg-gray-300"></div>
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
              Review Content
            </div>
            <div className="w-8 h-px bg-gray-300"></div>
            <div className={`flex items-center ${
              getTabStatus('format') === 'current' ? 'text-blue-600' : 'text-gray-400'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${
                getTabStatus('format') === 'current' ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-500'
              }`}>
                3
              </div>
              Export Cards
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl mx-auto mb-8">
            <TabsTrigger value="upload" className="flex items-center" disabled={false}>
              <FileText className="w-4 h-4 mr-2" /> Upload
              {getStatusBadge(getTabStatus('upload'))}
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center" disabled={getTabStatus('preview') === 'disabled'}>
              <Eye className="w-4 h-4 mr-2" /> Preview
              {getStatusBadge(getTabStatus('preview'))}
            </TabsTrigger>
            <TabsTrigger value="format" className="flex items-center" disabled={getTabStatus('format') === 'disabled'}>
              <Settings className="w-4 h-4 mr-2" /> Format
              {getStatusBadge(getTabStatus('format'))}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center">
              <History className="w-4 h-4 mr-2" /> History
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
            <div className="w-full max-w-4xl mx-auto p-6 bg-white">
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
                        <Badge>{item.cardCount} cards</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
