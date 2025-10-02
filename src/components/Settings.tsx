import { useState, useEffect } from 'react';
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
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [keySource, setKeySource] = useState<'none' | 'env' | 'custom'>('none');

  useEffect(() => {
    updateKeySource();
  }, []);

  const updateKeySource = () => {
    const customKey = sessionStorage.getItem('openai_api_key');
    const envKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    if (customKey) {
      setKeySource('custom');
      setSavedKey(customKey.substring(0, 8) + '...' + customKey.slice(-4));
    } else if (envKey) {
      setKeySource('env');
      setSavedKey('(using default key)');
    } else {
      setKeySource('none');
      setSavedKey('');
    }
  };

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

    // Store in sessionStorage for this session
    sessionStorage.setItem('openai_api_key', apiKey);
    setApiKey('');
    setStatus('success');
    setStatusMessage('Your custom API key is now active and will be used instead of the default key.');
    updateKeySource();
  };

  const handleClearKey = () => {
    sessionStorage.removeItem('openai_api_key');
    setApiKey('');
    setStatus('success');
    setStatusMessage(import.meta.env.VITE_OPENAI_API_KEY 
      ? 'Custom key removed. Now using default API key from environment.'
      : 'API key cleared. No API key available.');
    updateKeySource();
  };

  const handleTestConnection = async () => {
    setStatus('testing');
    setStatusMessage('Testing OpenAI connection...');

    try {
      const result = await AIService.testConnection();
      
      if (result.success) {
        setStatus('success');
        setStatusMessage(result.message);
      } else {
        setStatus('error');
        setStatusMessage(result.message);
      }
    } catch (error) {
      setStatus('error');
      setStatusMessage('Connection test failed. Check your internet connection.');
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Settings</h2>
        <p className="text-gray-600">Configure OpenAI API for flashcard generation</p>
      </div>

      {/* Current Key Status */}
      <Card className={
        keySource === 'custom' ? 'border-blue-200 bg-blue-50' :
        keySource === 'env' ? 'border-green-200 bg-green-50' :
        'border-yellow-200 bg-yellow-50'
      }>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {keySource === 'custom' ? (
              <>
                <Key className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">Using Your Custom API Key</p>
                  <p className="text-sm text-blue-700">{savedKey}</p>
                </div>
              </>
            ) : keySource === 'env' ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">Using Default API Key</p>
                  <p className="text-sm text-green-700">Configured from environment variables</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-900">No API Key Available</p>
                  <p className="text-sm text-yellow-700">Add a key below or configure VITE_OPENAI_API_KEY</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* API Key Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Custom OpenAI API Key (Optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">Your API Key</Label>
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
              {import.meta.env.VITE_OPENAI_API_KEY 
                ? 'Optional: Add your own key to override the default. Stored only in this browser session.'
                : 'Required: Add your OpenAI API key to enable AI-powered flashcard generation.'
              }
              {' '}Get a key at{' '}
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

          {status !== 'idle' && status !== 'testing' && statusMessage && (
            <Alert className={status === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              {status === 'success' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={status === 'success' ? 'text-green-700' : 'text-red-700'}>
                {statusMessage}
              </AlertDescription>
            </Alert>
          )}

          {status === 'testing' && (
            <Alert className="border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600 animate-pulse" />
              <AlertDescription className="text-blue-700">
                Testing connection to OpenAI...
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSaveKey} className="flex-1">
              Save Custom Key
            </Button>
            <Button onClick={handleTestConnection} variant="outline" className="flex-1" disabled={status === 'testing'}>
              {status === 'testing' ? 'Testing...' : 'Test Connection'}
            </Button>
            {keySource === 'custom' && (
              <Button onClick={handleClearKey} variant="outline">
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            How API Keys Work
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <div>
            <p className="font-medium text-gray-900 mb-1">Priority Order:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li><strong>Your Custom Key</strong> - Takes precedence if you add one here</li>
              <li><strong>Default Key</strong> - From environment variables (VITE_OPENAI_API_KEY)</li>
              <li><strong>No Key</strong> - Falls back to pattern-based extraction</li>
            </ol>
          </div>
          
          <div className="pt-2 border-t">
            <p className="font-medium text-gray-900 mb-1">Storage:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Custom keys are stored in <strong>sessionStorage</strong> (cleared when you close browser)</li>
              <li>Default key is stored in <strong>.env file</strong> (server-side, never exposed)</li>
              <li>Your key is <strong>never sent to any server</strong> except OpenAI's API</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* AI Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Features
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside ml-2">
            <li>Intelligent extraction of key concepts</li>
            <li>Context-aware flashcard generation</li>
            <li>Proper handling of medical/technical terminology</li>
            <li>Automatic difficulty assessment</li>
            <li>Smart tagging by topic area</li>
            <li>Questions that test understanding, not just memorization</li>
          </ul>
          
          <div className="pt-2 border-t">
            <p className="text-xs text-gray-500">
              <strong>Model:</strong> GPT-4o-mini · 
              <strong>Cost:</strong> ~$0.001-0.005 per PDF · 
              <strong>Speed:</strong> 3-10 seconds
            </p>
          </div>
        </CardContent>
      </Card>

      {/* AnkiConnect Info */}
      <Card>
        <CardHeader>
          <CardTitle>AnkiConnect Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            To export cards to Anki Desktop:
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
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}