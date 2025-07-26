import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import GoogleMapsAPIInput from './GoogleMapsAPIInput';
import GoogleMapComponent from './GoogleMapComponent';

interface LocationData {
  id: string;
  type: 'customer' | 'non_productive' | 'sales_order' | 'invoice' | 'collection';
  name: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  details?: string;
  agencyName?: string;
}

// Sample locations for demonstration
const DEMO_LOCATIONS: LocationData[] = [
  {
    id: '1',
    type: 'customer',
    name: 'Example Customer',
    latitude: 7.8731,
    longitude: 80.7718,
    timestamp: new Date(),
    details: 'This is an example customer location',
    agencyName: 'Demo Agency'
  },
  {
    id: '2',
    type: 'sales_order',
    name: 'Example Sales Order',
    latitude: 7.9731,
    longitude: 80.6718,
    timestamp: new Date(),
    details: 'This is an example sales order location',
    agencyName: 'Demo Agency'
  },
  {
    id: '3',
    type: 'invoice',
    name: 'Example Invoice',
    latitude: 7.7731,
    longitude: 80.8718,
    timestamp: new Date(),
    details: 'This is an example invoice location',
    agencyName: 'Demo Agency'
  },
  {
    id: '4',
    type: 'collection',
    name: 'Example Collection',
    latitude: 7.8731,
    longitude: 80.8718,
    timestamp: new Date(),
    details: 'Collection: LKR 25,000 (Cash)',
    agencyName: 'Demo Agency'
  }
];

const GoogleMapsGuide = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [showMap, setShowMap] = useState<boolean>(false);
  
  // Load API key from localStorage on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('google_maps_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
      setShowMap(true);
    }
  }, []);

  const handleAPIKeySet = (newApiKey: string) => {
    setApiKey(newApiKey);
    setShowMap(true);
  };

  const handleReset = () => {
    localStorage.removeItem('google_maps_api_key');
    setApiKey('');
    setShowMap(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        Google Maps Integration Guide
      </h1>
      
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Tutorial</AlertTitle>
        <AlertDescription>
          This guide will help you implement Google Maps in your application. 
          First, enter your Google Maps API key below, and we'll display a demo map.
        </AlertDescription>
      </Alert>
      
      {/* Step 1: API Key Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Step 1: Set Your Google Maps API Key
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Enter your Google Maps API key below. This key will be stored locally in your browser.
          </p>
          
          <div className="space-y-4">
            <GoogleMapsAPIInput onAPIKeySet={handleAPIKeySet} currentApiKey={apiKey} />
            
            {apiKey && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 text-sm font-medium">API Key Set!</p>
                <p className="text-green-600 text-xs mt-1">
                  Your Google Maps API key has been set and saved to localStorage.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2" 
                  onClick={handleReset}
                >
                  Reset API Key
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Step 2: Display Map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Step 2: Displaying the Map
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Once your API key is set, the map will automatically load with sample locations.
          </p>
          
          {showMap ? (
            <div className="space-y-4">
              <GoogleMapComponent locations={DEMO_LOCATIONS} apiKey={apiKey} />
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm font-medium">Map Implementation Details</p>
                <p className="text-blue-600 text-xs mt-1">
                  The map is implemented using the GoogleMapComponent. It takes an array of locations and your API key as props.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 text-sm font-medium">API Key Required</p>
              <p className="text-yellow-600 text-xs mt-1">
                Please set your Google Maps API key in Step 1 to see the map.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Step 3: Usage in Your App */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Step 3: Using Google Maps in Your Application
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            To use Google Maps in your own components, follow these steps:
          </p>
          
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-800 text-sm font-medium">1. Import the Components</p>
              <pre className="text-xs bg-gray-100 p-3 rounded mt-2 overflow-x-auto">
                {`import GoogleMapsAPIInput from '@/components/dashboard/GoogleMapsAPIInput';
import GoogleMapComponent from '@/components/dashboard/GoogleMapComponent';`}
              </pre>
            </div>
            
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-800 text-sm font-medium">2. Add State for API Key</p>
              <pre className="text-xs bg-gray-100 p-3 rounded mt-2 overflow-x-auto">
                {`const [apiKey, setApiKey] = useState('');

// Load from localStorage on mount
useEffect(() => {
  const savedApiKey = localStorage.getItem('google_maps_api_key');
  if (savedApiKey) {
    setApiKey(savedApiKey);
  }
}, []);`}
              </pre>
            </div>
            
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-800 text-sm font-medium">3. Add Components to Your JSX</p>
              <pre className="text-xs bg-gray-100 p-3 rounded mt-2 overflow-x-auto">
                {`{/* API Key Input */}
<GoogleMapsAPIInput onAPIKeySet={setApiKey} currentApiKey={apiKey} />

{/* Map Component */}
{apiKey && (
  <GoogleMapComponent 
    locations={yourLocationsArray} 
    apiKey={apiKey}
  />
)}`}
              </pre>
            </div>
            
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-800 text-sm font-medium">4. LocationData Type</p>
              <pre className="text-xs bg-gray-100 p-3 rounded mt-2 overflow-x-auto">
                {`interface LocationData {
  id: string;
  type: 'customer' | 'non_productive' | 'sales_order' | 'invoice' | 'collection';
  name: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  details?: string;
  agencyName?: string;
}`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle>Troubleshooting</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm font-medium">
                Map Doesn't Load
              </p>
              <ul className="list-disc list-inside text-red-600 text-xs mt-1 space-y-1">
                <li>Make sure your Google Maps API key is valid</li>
                <li>Verify that you have enabled the Maps JavaScript API for your API key</li>
                <li>Check the browser console for any error messages</li>
                <li>Make sure your API key doesn't have overly restrictive domain limitations</li>
              </ul>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm font-medium">
                For Development vs Production
              </p>
              <p className="text-red-600 text-xs mt-1">
                Consider creating separate API keys for development and production environments
                with appropriate domain restrictions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleMapsGuide;