import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Download, FileDown, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { FlashCard } from '../services/aiService';
import { AnkiService } from '../services/ankiService';

interface CardFormatOptionsProps {
  selectedFormat?: 'basic' | 'cloze' | 'image';
  onFormatChange?: (format: 'basic' | 'cloze' | 'image') => void;
  flashcards?: FlashCard[];
  deckName?: string;
  extractedText?: string;
}

export default function CardFormatOptions({ 
  selectedFormat = 'basic',
  onFormatChange = () => {},
  flashcards = [],
  deckName = 'Generated Deck',
  extractedText = ''
}: CardFormatOptionsProps) {
  const [cardCount, setCardCount] = React.useState([20]);
  const [includeTags, setIncludeTags] = React.useState(true);
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportStatus, setExportStatus] = React.useState<{
    type: 'idle' | 'success' | 'error';
    message: string;
  }>({ type: 'idle', message: '' });

  // Update max card count when flashcards change
  React.useEffect(() => {
    if (flashcards.length > 0) {
      const maxCards = Math.min(50, flashcards.length);
      if (cardCount[0] > maxCards) {
        setCardCount([maxCards]);
      }
    }
  }, [flashcards.length]);

  const handleExportToAnki = async () => {
    setIsExporting(true);
    setExportStatus({ type: 'idle', message: '' });

    try {
      // Validate we have cards
      if (flashcards.length === 0) {
        setExportStatus({
          type: 'error',
          message: 'No flashcards to export. Please go to the Preview tab and click "Generate Flashcards" first.'
        });
        setIsExporting(false);
        return;
      }

      console.log('Creating Anki deck:', deckName);
      
      // Create deck if it doesn't exist
      await AnkiService.createDeck(deckName);

      // Prepare cards to send
      const cardsToSend = flashcards.slice(0, Math.min(cardCount[0], flashcards.length));
      
      console.log(`Sending ${cardsToSend.length} cards to Anki...`);

      // Convert our FlashCard format to AnkiService format
      const ankiCards = cardsToSend.map(card => {
        const ankiCard: any = {
          front: card.front,
          back: card.back,
        };

        // Add tags if enabled
        if (includeTags && card.tags && card.tags.length > 0) {
          // Note: tags will be handled by AnkiService
          ankiCard.tags = card.tags;
        }

        return ankiCard;
      });

      // Send flashcards to Anki
      const result = await AnkiService.addNotes(
        deckName,
        ankiCards,
        selectedFormat === 'cloze' ? 'cloze' : 'basic'
      );

      console.log('Anki export result:', result);

      setExportStatus({
        type: 'success',
        message: `Successfully exported ${cardsToSend.length} cards to Anki deck "${deckName}"! Open Anki to view them.`
      });
      
      console.log('Export successful!');
    } catch (error) {
      console.error('Export error:', error);
      
      let errorMessage = 'Failed to connect to Anki.';
      
      if (error instanceof Error) {
        if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
          errorMessage = 'Cannot connect to Anki. Make sure Anki Desktop is running with AnkiConnect installed.';
        } else if (error.message.includes('duplicate')) {
          errorMessage = 'Some cards already exist in this deck. Anki skipped duplicate cards.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setExportStatus({
        type: 'error',
        message: errorMessage
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Calculate max cards based on available flashcards
  const maxCards = Math.max(5, Math.min(50, flashcards.length || 50));

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white space-y-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Export Flashcards to Anki</h2>
        <p className="text-gray-600">Configure your flashcards and send them to Anki Desktop</p>
      </div>

      {/* Status Alert */}
      {exportStatus.type !== 'idle' && (
        <Alert className={exportStatus.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          {exportStatus.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className={exportStatus.type === 'success' ? 'text-green-700' : 'text-red-700'}>
            {exportStatus.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Card Count Info */}
      <Card className={flashcards.length > 0 ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium ${flashcards.length > 0 ? 'text-green-900' : 'text-yellow-900'}`}>
                {flashcards.length > 0 ? `${flashcards.length} flashcards ready` : 'No flashcards yet'}
              </p>
              <p className={`text-sm ${flashcards.length > 0 ? 'text-green-700' : 'text-yellow-700'}`}>
                {flashcards.length === 0 
                  ? 'Go to Preview tab and click "Generate Flashcards" to create cards'
                  : 'Ready to export to Anki Desktop'}
              </p>
            </div>
            {flashcards.length > 0 && (
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card Format Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Card Format</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup 
            value={selectedFormat} 
            onValueChange={(value) => onFormatChange(value as 'basic' | 'cloze' | 'image')}
            className="space-y-4"
          >
            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <RadioGroupItem value="basic" id="basic" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="basic" className="font-medium cursor-pointer">Basic Cards</Label>
                <p className="text-sm text-gray-600 mt-1">
                  Traditional front/back flashcards with questions and answers
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <RadioGroupItem value="cloze" id="cloze" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="cloze" className="font-medium cursor-pointer">Cloze Deletion</Label>
                <p className="text-sm text-gray-600 mt-1">
                  Fill-in-the-blank style cards that hide key terms
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer opacity-50">
              <RadioGroupItem value="image" id="image" className="mt-1" disabled />
              <div className="flex-1">
                <Label htmlFor="image" className="font-medium cursor-pointer">Image-based Cards</Label>
                <p className="text-sm text-gray-600 mt-1">
                  Coming soon - Basic cards with image support
                </p>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Card Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Export Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm font-medium">Number of Cards to Export</Label>
              <span className="text-sm font-bold text-blue-600">{cardCount[0]}</span>
            </div>
            <Slider
              value={cardCount}
              onValueChange={setCardCount}
              max={maxCards}
              min={Math.min(5, maxCards)}
              step={5}
              className="mt-2"
              disabled={flashcards.length === 0}
            />
            <p className="text-xs text-gray-500 mt-1">
              {flashcards.length > 0 
                ? `Export ${cardCount[0]} out of ${flashcards.length} available cards`
                : 'Generate cards first to adjust this setting'}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="include-tags" className="text-sm font-medium">Include Tags</Label>
              <p className="text-xs text-gray-500">Add topic tags to cards for better organization</p>
            </div>
            <Switch
              id="include-tags"
              checked={includeTags}
              onCheckedChange={setIncludeTags}
            />
          </div>

          <div className="pt-2 border-t">
            <Label className="text-sm font-medium">Deck Name</Label>
            <p className="text-sm text-gray-600 mt-1 bg-gray-50 p-2 rounded">
              {deckName}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Cards will be added to this deck in Anki
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Export Button */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export to Anki Desktop
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              onClick={handleExportToAnki}
              disabled={isExporting || flashcards.length === 0}
              className="w-full"
              size="lg"
            >
              {isExporting ? (
                <>
                  <FileDown className="mr-2 h-4 w-4 animate-pulse" />
                  Exporting to Anki...
                </>
              ) : (
                <>
                  <FileDown className="mr-2 h-4 w-4" />
                  {flashcards.length === 0 
                    ? 'Generate Flashcards First' 
                    : `Export ${Math.min(cardCount[0], flashcards.length)} Cards to Anki`}
                </>
              )}
            </Button>
            
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <p className="text-xs font-medium text-gray-700 mb-2">✓ Before exporting, make sure:</p>
              <ul className="text-xs text-gray-600 space-y-1 pl-4">
                <li>• Anki Desktop is open and running</li>
                <li>• AnkiConnect add-on is installed (code: 2055492159)</li>
                <li>• You have generated flashcards in the Preview tab</li>
                <li>• You've restarted Anki after installing AnkiConnect</li>
              </ul>
              <p className="text-xs text-gray-500 italic mt-2">
                Cards will be created in the "{deckName}" deck
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}