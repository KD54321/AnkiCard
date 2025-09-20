import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Loader2, FileText, Brain, Tags } from 'lucide-react';
import { AIService, FlashCard } from '../services/aiService';

interface ContentPreviewProps {
  extractedContent?: {
    text: string;
    pageCount: number;
    title?: string;
  };
  onContentProcessed?: (cards: FlashCard[]) => void;
  cardFormat?: 'basic' | 'cloze' | 'image';
}

export default function ContentPreview({ 
  extractedContent,
  onContentProcessed = () => {},
  cardFormat = 'basic'
}: ContentPreviewProps) {
  const [editedText, setEditedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<{
    cards: FlashCard[];
    concepts: string[];
    summary: string;
  } | null>(null);

  useEffect(() => {
    if (extractedContent?.text) {
      setEditedText(extractedContent.text);
      // Auto-process with AI when content is loaded
      processWithAI(extractedContent.text);
    }
  }, [extractedContent, cardFormat]);

  const processWithAI = async (text: string) => {
    if (!text.trim()) return;
    
    setIsProcessing(true);
    try {
      const result = await AIService.extractFlashcards(text, cardFormat);
      setAiResult(result);
      onContentProcessed(result.cards);
    } catch (error) {
      console.error('AI processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextChange = (value: string) => {
    setEditedText(value);
  };

  const handleReprocess = () => {
    processWithAI(editedText);
  };

  if (!extractedContent) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 bg-white">
        <Card className="border-dashed border-2 border-gray-300">
          <CardContent className="p-12 text-center">
            <FileText className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No PDF uploaded yet
            </h3>
            <p className="text-gray-500">
              Upload a PDF file to see the extracted content here
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Content Preview</h2>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>📄 {extractedContent.title}</span>
          <span>📊 {extractedContent.pageCount} pages</span>
          <span>📝 {editedText.length} characters</span>
        </div>
      </div>

      <Tabs defaultValue="extracted" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="extracted">Extracted Text</TabsTrigger>
          <TabsTrigger value="concepts">Key Concepts</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="cards">Generated Cards</TabsTrigger>
        </TabsList>

        <TabsContent value="extracted" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Extracted Content
                <Button 
                  onClick={handleReprocess}
                  disabled={isProcessing}
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Reprocess with AI
                    </>
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={editedText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Extracted text will appear here..."
                className="min-h-[400px] font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-2">
                You can edit the extracted text before generating flashcards
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="concepts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tags className="h-5 w-5" />
                Key Concepts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isProcessing ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Analyzing content...</span>
                </div>
              ) : aiResult?.concepts ? (
                <div className="flex flex-wrap gap-2">
                  {aiResult.concepts.map((concept, index) => (
                    <Badge key={index} variant="secondary" className="text-sm">
                      {concept}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No concepts extracted yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Content Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {isProcessing ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Generating summary...</span>
                </div>
              ) : aiResult?.summary ? (
                <p className="text-gray-700 leading-relaxed">{aiResult.summary}</p>
              ) : (
                <p className="text-gray-500">No summary available yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cards" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generated Flashcards ({cardFormat})</CardTitle>
            </CardHeader>
            <CardContent>
              {isProcessing ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Generating flashcards...</span>
                </div>
              ) : aiResult?.cards && aiResult.cards.length > 0 ? (
                <div className="space-y-4">
                  {aiResult.cards.map((card, index) => (
                    <Card key={card.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                              Front
                            </span>
                            <p className="text-sm mt-1">{card.front}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                              Back
                            </span>
                            <p className="text-sm mt-1">{card.back}</p>
                          </div>
                          <div className="flex items-center gap-2 pt-2">
                            <Badge variant="outline" className="text-xs">
                              {card.type}
                            </Badge>
                            {card.tags?.map((tag, tagIndex) => (
                              <Badge key={tagIndex} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No flashcards generated yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}