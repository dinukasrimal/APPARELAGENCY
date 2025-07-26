
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, MapPin, RotateCcw, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface GoogleMapsAPIInputProps {
  onAPIKeySet: (apiKey: string) => void;
  currentApiKey?: string;
}

const GoogleMapsAPIInput = ({ onAPIKeySet, currentApiKey }: GoogleMapsAPIInputProps) => {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasValidKey, setHasValidKey] = useState(false);

  // Load existing API key from localStorage on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('google_maps_api_key');
    if (savedApiKey && !currentApiKey) {
      setApiKey(savedApiKey);
      setHasValidKey(true);
      onAPIKeySet(savedApiKey);
    } else if (currentApiKey) {
      setApiKey(currentApiKey);
      setHasValidKey(true);
    }
  }, [currentApiKey, onAPIKeySet]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      const trimmedKey = apiKey.trim();
      onAPIKeySet(trimmedKey);
      localStorage.setItem('google_maps_api_key', trimmedKey);
      setHasValidKey(true);
      console.log('API key set:', trimmedKey.substring(0, 10) + '...');
    }
  };

  const handleReset = () => {
    setApiKey('');
    localStorage.removeItem('google_maps_api_key');
    onAPIKeySet('');
    setShowApiKey(false);
    setHasValidKey(false);
    console.log('API key cleared');
  };

  const validateApiKeyFormat = (key: string) => {
    // Basic validation - Google API keys are typically 39 characters and start with 'AIza'
    return key.length >= 30 && key.startsWith('AIza');
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Google Maps API Configuration
          {hasValidKey && <CheckCircle className="h-4 w-4 text-green-500" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasValidKey ? (
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Google Maps API key is configured and ready to use.
              </AlertDescription>
            </Alert>
            
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Label htmlFor="current-api-key">Current API Key</Label>
                <Input
                  id="current-api-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            
            <Button type="button" variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Change API Key
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Alert>
              <AlertDescription>
                <div>
                  <p className="font-medium mb-2">To get a Google Maps API key:</p>
                  <ol className="list-decimal list-inside text-sm space-y-1">
                    <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a></li>
                    <li>Create a new project or select an existing one</li>
                    <li>Enable the "Maps JavaScript API"</li>
                    <li>Go to "Credentials" and create an API key</li>
                    <li>Copy and paste the API key below</li>
                  </ol>
                </div>
              </AlertDescription>
            </Alert>
            
            <div>
              <Label htmlFor="maps-api-key">Google Maps API Key</Label>
              <div className="relative mt-2">
                <Input
                  id="maps-api-key"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="Enter your Google Maps API key (starts with AIza...)"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {apiKey && !validateApiKeyFormat(apiKey) && (
                <p className="text-sm text-orange-600 mt-1">
                  ⚠ This doesn't look like a valid Google Maps API key format
                </p>
              )}
              <p className="text-xs text-gray-600 mt-1">
                Your API key is stored locally and used only for map display.
              </p>
            </div>
            
            <Button type="submit" disabled={!apiKey.trim()}>
              Set API Key
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default GoogleMapsAPIInput;
