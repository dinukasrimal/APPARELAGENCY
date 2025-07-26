
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Key } from 'lucide-react';

interface APIKeyInputProps {
  onAPIKeySet: (apiKey: string) => void;
  currentApiKey?: string;
}

const APIKeyInput = ({ onAPIKeySet, currentApiKey }: APIKeyInputProps) => {
  const [apiKey, setApiKey] = useState(currentApiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      onAPIKeySet(apiKey.trim());
      // Store in localStorage for demo purposes
      localStorage.setItem('google_vision_api_key', apiKey.trim());
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Google Vision API Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="api-key">Google Vision API Key</Label>
            <div className="relative mt-2">
              <Input
                id="api-key"
                type={showApiKey ? 'text' : 'password'}
                placeholder="Enter your Google Vision API key"
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
            <p className="text-xs text-gray-600 mt-1">
              Your API key is stored locally and never sent to our servers.
            </p>
          </div>
          <Button type="submit" disabled={!apiKey.trim()}>
            Set API Key
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default APIKeyInput;
