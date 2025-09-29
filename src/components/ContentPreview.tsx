import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Loader2, FileText, Brain, Tags } from 'lucide-react';
import { FlashCard } from '../services/aiService';

interface ContentPreviewProps {
  extractedContent?: { text: string; pageCount: number; title?: string };
  onContentProcessed?: (cards: FlashCard[]) => void;
  cardFormat?: 'basic' | 'cloze' | 'image';
}

export default function ContentPreview({
  extractedContent,
  onContentProcessed = () => {},
  cardFormat = 'basic'
}: ContentPreviewProps) {
  const [editedText, setEditedText] = useState('');
  const [flashcards, setFlashcards] = useState<FlashCard[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (extractedContent?.text) setEditedText(extractedContent.text);
  }, [extractedContent]);

  const handleTextChange = (value: string) => setEditedText(value);

  const handleReprocess = async () => {
    if (!editedText) return;
    setIsProcessing(true);
    const { AIService } = await import('../services/aiService');
    const result = await AIService.extractFlashcards(editedText, cardFormat);
    setFlashcards(result.cards);
    onContentProcessed(result.cards);
    setIsProcessing(false);
  };

  if (!extractedContent) return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white">
      <Card className="border-dashed border-2 border-gray-300">
        <CardContent className="p-12 text-center">
          <FileText className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No PDF uploaded yet</h3>
          <p className="text-gray-500">Upload a PDF file to see the extracted content here</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Extracted Content
            <Button onClick={handleReprocess} disabled={isProcessing} className="ml-auto">
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...</>
              ) : (
                <><Brain className="h-4 w-4 mr-2" /> Reprocess</>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={editedText} onChange={(e) => handleTextChange(e.target.value)} className="min-h-[400px]" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Generated Flashcards ({flashcards.length})</CardTitle></CardHeader>
        <CardContent>
          {flashcards.length === 0 ? <p className="text-gray-500">No cards yet</p> : (
            <div className="space-y-2">
              {flashcards.map(card => (
                <Card key={card.id} className="border-l-4 border-l-blue-500">
                  <CardContent>
                    <div className="space-y-1">
                      <div><span className="font-medium text-xs">Front</span><p>{card.front}</p></div>
                      <div><span className="font-medium text-xs">Back</span><p>{card.back}</p></div>
                      <div className="flex gap-2 pt-1">
                        <Badge className="text-xs">{card.type}</Badge>
                        {card.tags?.map((tag, i) => <Badge key={i} className="text-xs">{tag}</Badge>)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
