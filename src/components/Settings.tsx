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
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const handleSaveKey = () => {
    if (!apiKey.trim()) {
      setStatusMessage('Please enter an API key');
      setTestStatus('error');
      return;
    }

    if (!apiKey.startsWith('hf_')) {
      setStatusMessage('Invalid API key format. Hugging Face tokens start with "hf_"');
      setTestStatus('error');
      return;
    }

    AIService.setApiKey(apiKey);
    setSavedKey(apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4));
    setApiKey('');
    setTestStatus('success');
    setStatusMessage('API key saved successfully! You can now use AI-powered extraction.');
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setStatusMessage('Testing connection to Hugging Face... This may take 20-30 seconds on first run.');

    try {
      const result = await AIService.testConnection();
      
      if (result.success) {
        setTestStatus('success');
        setStatusMessage(result.message);
      } else {
        setTestStatus('error');
        setStatusMessage(result.message);
      }
    } catch (error) {
      setTestStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Connection test failed');
    }
  };

  const handleClearKey = () => {
    setApiKey('');
    setSavedKey('');
    setTestStatus('idle');
    setStatusMessage('');
    AIService.setApiKey('');
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Settings</h2>
        <p className="text-gray-600">Configure Hugging Face AI for intelligent flashcard generation</p>
      </div>

      {/* API Key Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Hugging Face API Token
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">API Token</Label>
            <div className="flex gap-2">
              <Input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="hf_..."
                className="flex-1 font-mono text-sm"
              />
              <Button
                variant="outline"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? 'Hide' : 'Show'}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Get your free API token from{' '}
              <a
                href="https://huggingface.co/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                huggingface.co/settings/tokens
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          {savedKey && testStatus !== 'error' && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                API token saved: {savedKey}
              </AlertDescription>
            </Alert>
          )}

          {testStatus === 'error' && statusMessage && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                {statusMessage}
              </AlertDescription>
            </Alert>
          )}

          {testStatus === 'success' && statusMessage && !savedKey && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                {statusMessage}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSaveKey} className="flex-1">
              Save API Token
            </Button>
            {savedKey && (
              <>
                <Button
                  onClick={handleTestConnection}
                  variant="outline"
                  disabled={testStatus === 'testing'}
                  className="flex-1"
                >
                  {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                </Button>
                <Button
                  onClick={handleClearKey}
                  variant="outline"
                >
                  Clear
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* How to Get Token */}
      <Card>
        <CardHeader>
          <CardTitle>How to Get Your Free Token</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>
              Create a free account at{' '}
              <a 
                href="https://huggingface.co/join" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                huggingface.co
              </a>
            </li>
            <li>
              Go to Settings → Access Tokens
            </li>
            <li>
              Click "New token"
            </li>
            <li>
              Give it a name (e.g., "Anki Flashcards")
            </li>
            <li>
              Select "Read" access (default)
            </li>
            <li>
              Click "Generate token"
            </li>
            <li>
              Copy the token (starts with <code className="bg-gray-100 px-1">hf_</code>) and paste it above
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Features
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h4 className="font-medium text-sm mb-1 text-green-700">✓ With Hugging Face API (FREE)</h4>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside ml-2">
              <li>Intelligent extraction of medical concepts</li>
              <li>Context-aware flashcard generation</li>
              <li>Proper handling of clinical terminology</li>
              <li>Automatic difficulty assessment</li>
              <li>Smart tagging by topic area</li>
              <li>Completely FREE (rate limited)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-sm mb-1 text-gray-700">⚠ Without API (Basic Mode)</h4>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside ml-2">
              <li>Pattern-based text extraction</li>
              <li>Works offline with no setup</li>
              <li>Simple term-definition matching</li>
              <li>May miss complex relationships</li>
              <li>Less accurate for medical content</li>
            </ul>
          </div>
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700 text-sm">
              <strong>Note:</strong> First request may take 20-30 seconds as the AI model loads. 
              Subsequent requests will be faster.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* AnkiConnect Setup */}
      <Card>
        <CardHeader>
          <CardTitle>AnkiConnect Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            To export cards to Anki Desktop, you need:
          </p>
          <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
            <li>
              <strong>Anki Desktop</strong> installed and running
              <br />
              <a 
                href="https://apps.ankiweb.net/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-xs ml-5 inline-flex items-center gap-1"
              >
                Download from apps.ankiweb.net
                <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>
              <strong>AnkiConnect add-on</strong> installed (code: <code className="bg-gray-100 px-1">2055492159</code>)
              <br />
              <span className="text-xs text-gray-500 ml-5">
                In Anki: Tools → Add-ons → Get Add-ons → Enter code
              </span>
            </li>
            <li>
              <strong>Restart Anki</strong> after installing AnkiConnect
            </li>
            <li>
              Keep Anki running in the background when exporting
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Privacy Note */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardHeader>
          <CardTitle className="text-sm">Privacy & Data Handling</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-xs text-gray-700 space-y-1">
            <li>• Your API token is stored in browser memory only (not saved permanently)</li>
            <li>• PDF content is sent to Hugging Face for processing</li>
            <li>• Free tier has rate limits but no costs</li>
            <li>• No data is stored on our servers</li>
            <li>• All processing happens client-side</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}