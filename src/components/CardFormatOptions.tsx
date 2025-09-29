import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Download, FileDown } from 'lucide-react';
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
  const [cardCount, setCardCount] = React.useState([10]);
  const [includeTags, setIncludeTags] = React.useState(true);
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExportToAnki = async () => {
    setIsExporting(true);

    try {
      // Create deck if it doesn't exist
      await AnkiService.createDeck(deckName);

      // Prepare cards to send
      let cardsToSend = flashcards.slice(0, cardCount[0]);

      // Auto-generate flashcards from extracted text if none exist
      if (cardsToSend.length === 0 && extractedText.trim().length > 0) {
        const sentences = extractedText
          .split(/[.\n]/)
          .map(s => s.trim())
          .filter(s => s.length > 0);

        cardsToSend = sentences.slice(0, cardCount[0]).map((sentence, idx) => ({
          id: idx.toString(),
          front: sentence,
          back: '', // leave blank or add simple summary
          type: selectedFormat === 'cloze' ? 'cloze' : 'basic',
          tags: includeTags ? ['PDFNotes'] : []
        }));
      }

      if (cardsToSend.length === 0) {
        alert("No flashcards to export. Please upload and process a PDF first.");
        return;
      }

      // Send flashcards to Anki
      await AnkiService.addNotes(
        deckName,
        cardsToSend,
        selectedFormat === 'image' ? 'basic' : selectedFormat
      );

      alert(`Successfully exported ${cardsToSend.length} cards to Anki deck "${deckName}"!`);
    } catch (error) {
      console.error(error);
      alert("Failed to connect to Anki. Make sure Anki Desktop is running with AnkiConnect installed.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white space-y-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Card Format Options</h2>
        <p className="text-gray-600">Choose how you want your flashcards formatted</p>
      </div>

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
            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50">
              <RadioGroupItem value="basic" id="basic" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="basic" className="font-medium cursor-pointer">Basic Cards</Label>
                <p className="text-sm text-gray-600 mt-1">
                  Traditional front/back flashcards with questions and answers
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50">
              <RadioGroupItem value="cloze" id="cloze" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="cloze" className="font-medium cursor-pointer">Cloze Deletion</Label>
                <p className="text-sm text-gray-600 mt-1">
                  Fill-in-the-blank style cards that hide key terms
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50">
              <RadioGroupItem value="image" id="image" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="image" className="font-medium cursor-pointer">Image-based Cards</Label>
                <p className="text-sm text-gray-600 mt-1">
                  Currently generates text-based cards with image placeholders
                </p>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Card Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Card Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-sm font-medium">Maximum Cards: {cardCount[0]}</Label>
            <Slider
              value={cardCount}
              onValueChange={setCardCount}
              max={50}
              min={5}
              step={5}
              className="mt-2"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="include-tags" className="text-sm font-medium">Include Tags</Label>
            </div>
            <Switch
              id="include-tags"
              checked={includeTags}
              onCheckedChange={setIncludeTags}
            />
          </div>
        </CardContent>
      </Card>

      {/* Export Button */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export to Anki
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              onClick={handleExportToAnki}
              disabled={isExporting}
              className="w-full"
            >
              {isExporting ? (
                <>
                  <FileDown className="mr-2 h-4 w-4 animate-pulse" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileDown className="mr-2 h-4 w-4" />
                  Send to Anki Desktop
                </>
              )}
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Make sure Anki Desktop is open with AnkiConnect installed
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
