import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Key, CheckCircle, AlertCircle, ExternalLink, Info, Brain } from 'lucide-react';
import { AIService } from '../services/aiService';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const handleSaveKey = () => {
    if (!apiKey.trim()) {
      setStatus('error');
      setStatusMessage('Please enter a valid API key');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      setStatus('error');
      setStatusMessage('OpenAI keys start with "sk-"');
      return;
    }

    AIService.setApiKey(apiKey);
    setSavedKey(apiKey.substring(0, 8) + '...' + apiKey.slice(-4));
    setApiKey('');
    setStatus('success');
    setStatusMessage('API key saved! It will override the default .env key for this session.');
  };

  const handleClearKey = () => {
    AIService.setApiKey(null);
    setSavedKey('');
    setApiKey('');
    setStatus('idle');
    setStatusMessage('');
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Settings</h2>
        <p className="text-gray-600">Configure OpenAI API for flashcard generation</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            OpenAI API Key
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">Optional API Key</Label>
            <div className="flex gap-2">
              <Input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="flex-1 font-mono text-sm"
              />
              <Button variant="outline" onClick={() => setShowKey(!showKey)}>
                {showKey ? 'Hide' : 'Show'}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Leave empty to use the default API key from your <code>.env</code> file.  
              Get a key at{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                platform.openai.com/api-keys
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          {status === 'success' && savedKey && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                {statusMessage} ({savedKey})
              </AlertDescription>
            </Alert>
          )}

          {status === 'error' && statusMessage && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">{statusMessage}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSaveKey} className="flex-1">
              Save Key
            </Button>
            {savedKey && (
              <Button onClick={handleClearKey} variant="outline" className="flex-1">
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Features
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside ml-2">
            <li>Intelligent extraction of medical concepts</li>
            <li>Context-aware flashcard generation</li>
            <li>Proper handling of clinical terminology</li>
            <li>Automatic difficulty assessment</li>
            <li>Smart tagging by topic area</li>
          </ul>
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700 text-sm">
              Using the default API key from <code>.env</code> if no key is provided.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
