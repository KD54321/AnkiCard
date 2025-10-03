import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, FileText, Brain, Zap, AlertCircle, CheckCircle2 } from 'lucide-react';
import { FlashCard, AIService } from '../services/aiService';

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
  const [statusMessage, setStatusMessage] = useState<{
    type: 'info' | 'success' | 'error';
    message: string;
  } | null>(null);
  
  // New state for JSON import
  const [jsonInput, setJsonInput] = useState('');
  const [showJsonImport, setShowJsonImport] = useState(false);

  useEffect(() => {
    if (extractedContent?.text) setEditedText(extractedContent.text);
  }, [extractedContent]);

  const handleTextChange = (value: string) => setEditedText(value);

  // JSON Import Handler
  const handleImportJSON = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      
      if (!parsed.cards || !Array.isArray(parsed.cards)) {
        throw new Error('Invalid format: missing "cards" array');
      }

      // Convert to FlashCard format
      const importedCards: FlashCard[] = parsed.cards.map((card: any, index: number) => ({
        id: `imported-${Date.now()}-${index}`,
        front: card.front || '',
        back: card.back || '',
        type: cardFormat,
        tags: Array.isArray(card.tags) ? card.tags : [],
        difficulty: card.difficulty || 'medium'
      })).filter((card: FlashCard) => card.front && card.back);

      if (importedCards.length === 0) {
        throw new Error('No valid cards found in JSON');
      }

      setFlashcards(importedCards);
      onContentProcessed(importedCards);
      setStatusMessage({
        type: 'success',
        message: `✅ Imported ${importedCards.length} cards from ChatGPT! Ready to export to Anki.`
      });
      setJsonInput('');
      setShowJsonImport(false);

      console.log(`Imported ${importedCards.length} cards`);
    } catch (error) {
      setStatusMessage({
        type: 'error',
        message: `Invalid JSON: ${error instanceof Error ? error.message : 'Please paste valid JSON from ChatGPT'}`
      });
    }
  };

  const handleGenerateCards = async () => {
    if (!editedText || editedText.trim().length < 10) {
      setStatusMessage({
        type: 'error',
        message: 'Please provide more text content to generate flashcards.'
      });
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const hasApiKey = AIService.getApiKey() !== null;
      
      if (hasApiKey) {
        setStatusMessage({
          type: 'info',
          message: 'Generating flashcards with OpenAI... This may take a few seconds.'
        });
      } else {
        setStatusMessage({
          type: 'info',
          message: 'Generating flashcards with mock data (no API key found)...'
        });
      }
      
      console.log('Generating flashcards...');
      const result = await AIService.generateFlashcards(editedText, cardFormat);
      
      setFlashcards(result.cards);
      onContentProcessed(result.cards);
      
      const mode = hasApiKey ? 'OpenAI API' : 'Mock data';
      setStatusMessage({
        type: 'success',
        message: `Generated ${result.cards.length} flashcards using ${mode}. ${result.concepts.length} key concepts identified.`
      });
      
      console.log('Flashcards generated:', result.cards.length);
    } catch (error) {
      console.error('Processing error:', error);
      setStatusMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to process content'
      });
    } finally {
      setIsProcessing(false);
    }
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

  const hasApiKey = AIService.getApiKey() !== null;

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white space-y-4">
      {/* Status Message */}
      {statusMessage && (
        <Alert className={
          statusMessage.type === 'success' ? 'border-green-200 bg-green-50' :
          statusMessage.type === 'error' ? 'border-red-200 bg-red-50' :
          'border-blue-200 bg-blue-50'
        }>
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : statusMessage.type === 'error' ? (
            <AlertCircle className="h-4 w-4 text-red-600" />
          ) : (
            <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
          )}
          <AlertDescription className={
            statusMessage.type === 'success' ? 'text-green-700' :
            statusMessage.type === 'error' ? 'text-red-700' :
            'text-blue-700'
          }>
            {statusMessage.message}
          </AlertDescription>
        </Alert>
      )}

      {/* API Status Info */}
      {!hasApiKey && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-700">
            <strong>Using Mock Mode:</strong> No OpenAI API key detected. 
            Cards will be generated using sample data. 
            For AI-powered results, go to Settings to add your OpenAI API key.
          </AlertDescription>
        </Alert>
      )}

      {/* JSON Import Section - STANDALONE CARD */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" />
              <span className="text-blue-900">Import from ChatGPT</span>
            </div>
            <Button
              onClick={() => setShowJsonImport(!showJsonImport)}
              variant="outline"
              size="sm"
              className="bg-white"
            >
              {showJsonImport ? 'Hide' : 'Show'} Import
            </Button>
          </CardTitle>
        </CardHeader>
        {showJsonImport && (
          <CardContent className="space-y-3">
            <p className="text-sm text-blue-700">
              Paste the JSON response from ChatGPT below. This will replace any existing flashcards.
            </p>
            <Textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder={`Paste ChatGPT JSON here, e.g.:
{
  "cards": [
    {
      "front": "What is myopia?",
      "back": "A refractive error where distant objects appear blurry",
      "tags": ["vision", "refractive-errors"],
      "difficulty": "easy"
    }
  ],
  "concepts": ["myopia", "refraction"],
  "summary": "Overview of refractive errors"
}`}
              className="min-h-[150px] font-mono text-xs bg-white"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleImportJSON}
                disabled={!jsonInput.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Import JSON Cards
              </Button>
              <Button
                onClick={() => {
                  setJsonInput('');
                  setShowJsonImport(false);
                }}
                variant="outline"
                className="bg-white"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Extracted Content Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> 
              Extracted Content
            </div>
            <Button 
              onClick={handleGenerateCards} 
              disabled={isProcessing}
              size="lg"
            >
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</>
              ) : (
                <>{hasApiKey ? <Brain className="h-4 w-4 mr-2" /> : <Zap className="h-4 w-4 mr-2" />} Generate Flashcards</>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 text-sm text-gray-600 flex justify-between">
            <div>
              <p><strong>Pages:</strong> {extractedContent.pageCount}</p>
              <p><strong>Characters:</strong> {editedText.length.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <Badge variant={hasApiKey ? "default" : "outline"}>
                {hasApiKey ? 'AI Mode' : 'Mock Mode'}
              </Badge>
            </div>
          </div>
          <Textarea 
            value={editedText} 
            onChange={(e) => handleTextChange(e.target.value)} 
            className="min-h-[400px] font-mono text-sm"
            placeholder="Edit the extracted text here before processing..."
          />
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-900 font-medium mb-2">💡 Tips for better results:</p>
            <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
              {hasApiKey ? (
                <>
                  <li><strong>AI Mode:</strong> Intelligent extraction using OpenAI, understands context and medical terms</li>
                  <li>AI processing may take a few seconds depending on content length</li>
                </>
              ) : (
                <>
                  <li><strong>Mock Mode:</strong> Sample flashcards generated from key concepts</li>
                  <li>Add OpenAI API key in Settings for AI-powered extraction</li>
                </>
              )}
              <li>Remove headers, footers, and page numbers for cleaner output</li>
              <li>Format definitions as "Term: Definition" or use bullet points for best results</li>
              <li><strong>Or use the Chrome Extension + ChatGPT workflow above!</strong></li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Generated Flashcards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Generated Flashcards ({flashcards.length})</span>
            {flashcards.length > 0 && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Ready to export
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {flashcards.length === 0 ? (
            <div className="text-center py-12">
              <Brain className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">No flashcards generated yet</p>
              <p className="text-sm text-gray-400">
                Click "Generate Flashcards" above or import JSON from ChatGPT
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {flashcards.map((card, index) => (
                <Card key={index} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div>
                        <Badge variant="outline" className="text-xs mb-2">
                          Card {index + 1}
                        </Badge>
                        <div className="mb-2">
                          <span className="font-medium text-xs text-gray-500 uppercase">Front:</span>
                          <p className="text-sm mt-1">{card.front}</p>
                        </div>
                        <div>
                          <span className="font-medium text-xs text-gray-500 uppercase">Back:</span>
                          <p className="text-sm mt-1">{card.back}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2 border-t flex-wrap">
                        <Badge className="text-xs bg-gray-600">{cardFormat}</Badge>
                        {card.difficulty && (
                          <Badge 
                            className={`text-xs ${
                              card.difficulty === 'easy' ? 'bg-green-500' :
                              card.difficulty === 'medium' ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                          >
                            {card.difficulty}
                          </Badge>
                        )}
                        {card.tags && card.tags.length > 0 && card.tags.map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
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