import React from 'react';
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
}

export default function CardFormatOptions({ 
  selectedFormat = 'basic',
  onFormatChange = () => {},
  flashcards = [],
  deckName = 'Generated Deck'
}: CardFormatOptionsProps) {
  const [cardCount, setCardCount] = React.useState([10]);
  const [includeTags, setIncludeTags] = React.useState(true);
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = async () => {
    if (flashcards.length === 0) {
      alert('No flashcards to export. Please upload and process a PDF first.');
      return;
    }

    setIsExporting(true);
    try {
      const blob = await AnkiService.generateAnkiPackage(flashcards, deckName);
      const filename = `${deckName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.apkg`;
      AnkiService.downloadFile(blob, filename);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export Anki package. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Card Format Options</h2>
        <p className="text-gray-600">
          Choose how you want your flashcards formatted
        </p>
      </div>

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
                <Label htmlFor="basic" className="font-medium cursor-pointer">
                  Basic Cards
                </Label>
                <p className="text-sm text-gray-600 mt-1">
                  Traditional front/back flashcards with questions and answers
                </p>
                <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                  <strong>Front:</strong> What is photosynthesis?<br />
                  <strong>Back:</strong> The process by which plants convert light energy into chemical energy
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50">
              <RadioGroupItem value="cloze" id="cloze" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="cloze" className="font-medium cursor-pointer">
                  Cloze Deletion
                </Label>
                <p className="text-sm text-gray-600 mt-1">
                  Fill-in-the-blank style cards that hide key terms
                </p>
                <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                  <strong>Card:</strong> Plants use {'{'}{'{'} c1::photosynthesis {'}'}{'}'}  to convert light into energy
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50">
              <RadioGroupItem value="image" id="image" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="image" className="font-medium cursor-pointer">
                  Image-based Cards
                </Label>
                <p className="text-sm text-gray-600 mt-1">
                  Cards that include visual elements and diagrams
                </p>
                <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                  <strong>Note:</strong> Currently generates text-based cards with image placeholders
                </div>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Card Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-sm font-medium">
              Maximum Cards: {cardCount[0]}
            </Label>
            <Slider
              value={cardCount}
              onValueChange={setCardCount}
              max={50}
              min={5}
              step={5}
              className="mt-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Limit the number of flashcards generated
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="include-tags" className="text-sm font-medium">
                Include Tags
              </Label>
              <p className="text-xs text-gray-500">
                Add topic tags to organize your cards
              </p>
            </div>
            <Switch
              id="include-tags"
              checked={includeTags}
              onCheckedChange={setIncludeTags}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export to Anki
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Ready to Export</h4>
              <p className="text-sm text-blue-700">
                {flashcards.length > 0 
                  ? `${flashcards.length} flashcards ready for export`
                  : 'Upload and process a PDF to generate flashcards'
                }
              </p>
            </div>

            <Button 
              onClick={handleExport}
              disabled={flashcards.length === 0 || isExporting}
              className="w-full"
              size="lg"
            >
              {isExporting ? (
                <>
                  <FileDown className="mr-2 h-4 w-4 animate-pulse" />
                  Generating Package...
                </>
              ) : (
                <>
                  <FileDown className="mr-2 h-4 w-4" />
                  Download Anki Package (.apkg)
                </>
              )}
            </Button>

            <p className="text-xs text-gray-500 text-center">
              The downloaded file can be imported directly into Anki
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}