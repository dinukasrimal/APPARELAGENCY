import { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

interface GoogleMapComponentProps {
  locations: LocationData[];
  apiKey: string;
}

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

const GoogleMapComponent = ({ locations, apiKey }: GoogleMapComponentProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'customer': return '#EAB308';
      case 'non_productive': return '#EF4444';
      case 'sales_order': return '#000000';
      case 'invoice': return '#22C55E';
      case 'collection': return '#8B5CF6'; // Purple color for collections
      default: return '#6B7280';
    }
  };

  const cleanupGoogleMaps = () => {
    // Remove existing script
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Clean up global variables
    if (window.google) {
      delete window.google;
    }
    
    setScriptLoaded(false);
  };

  const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Clean up first
      cleanupGoogleMaps();

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        console.log('Google Maps script loaded successfully');
        setScriptLoaded(true);
        // Add a small delay to ensure the API is fully ready
        setTimeout(() => {
          resolve();
        }, 500);
      };

      script.onerror = (e) => {
        console.error('Failed to load Google Maps script:', e);
        setScriptLoaded(false);
        reject(new Error('Failed to load Google Maps script. Please check your API key and internet connection.'));
      };

      document.head.appendChild(script);
    });
  };

  const initializeMap = async () => {
    if (!mapRef.current || !apiKey) {
      setError('Missing API key or map container');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log('Starting Google Maps initialization...');

      // Load Google Maps script
      await loadGoogleMapsScript(apiKey);

      // Check if Google Maps API is available
      if (!window.google?.maps) {
        throw new Error('Google Maps API not loaded properly');
      }

      console.log('Google Maps API available, creating map...');

      // Create map
      const mapInstance = new window.google.maps.Map(mapRef.current, {
        center: { lat: 7.8731, lng: 80.7718 }, // Sri Lanka center
        zoom: 8,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        streetViewControl: false,
        mapTypeControl: true,
        fullscreenControl: true,
        zoomControl: true,
      });

      // Wait for map to be ready
      window.google.maps.event.addListenerOnce(mapInstance, 'idle', () => {
        console.log('Map is ready and idle');
        setMap(mapInstance);
        setIsLoading(false);
      });

      // Add a timeout in case the map never becomes idle
      setTimeout(() => {
        if (mapInstance && !map) {
          console.log('Map timeout reached, setting map anyway');
          setMap(mapInstance);
          setIsLoading(false);
        }
      }, 3000);

    } catch (error) {
      console.error('Error initializing Google Maps:', error);
      setError(error instanceof Error ? error.message : 'Failed to initialize Google Maps');
      setIsLoading(false);
    }
  };

  const createMarkers = () => {
    if (!map || !window.google || locations.length === 0) {
      console.log('Cannot create markers:', { map: !!map, google: !!window.google, locations: locations.length });
      return;
    }

    console.log('Creating markers for', locations.length, 'locations');

    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    const newMarkers: any[] = [];
    const bounds = new window.google.maps.LatLngBounds();

    locations.forEach((location) => {
      const marker = new window.google.maps.Marker({
        position: { lat: location.latitude, lng: location.longitude },
        map: map,
        title: location.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: getMarkerColor(location.type),
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
          scale: 8,
        },
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; max-width: 200px;">
            <h3 style="font-weight: 600; margin: 0 0 4px 0; font-size: 14px;">${location.name}</h3>
            ${location.details ? `<p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">${location.details}</p>` : ''}
            ${location.agencyName ? `<p style="margin: 0 0 4px 0; font-size: 11px; color: #888;">Agency: ${location.agencyName}</p>` : ''}
            <p style="margin: 0 0 4px 0; font-size: 11px; color: #888;">${location.timestamp.toLocaleString()}</p>
            <p style="margin: 0; font-size: 10px; color: #aaa;">${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}</p>
          </div>
        `,
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });

      bounds.extend(marker.getPosition()!);
      newMarkers.push(marker);
    });

    setMarkers(newMarkers);

    if (locations.length > 0) {
      map.fitBounds(bounds);
      if (locations.length === 1) {
        map.setZoom(15);
      }
    }

    console.log('Created', newMarkers.length, 'markers');
  };

  // Initialize map when API key changes
  useEffect(() => {
    if (apiKey) {
      console.log('API key provided, initializing map...');
      initializeMap();
    }
    
    // Cleanup on unmount
    return () => {
      if (markers.length > 0) {
        markers.forEach(marker => marker.setMap(null));
      }
    };
  }, [apiKey]);

  // Create markers when map is ready and locations change
  useEffect(() => {
    if (map && locations.length >= 0) {
      console.log('Map ready and locations available, creating markers...');
      createMarkers();
    }
  }, [map, locations]);

  if (!apiKey) {
    return (
      <Alert>
        <AlertDescription>
          Google Maps API Key Required. Please provide a Google Maps API key to display the map.
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          <div>
            <p className="font-medium">Failed to load Google Maps</p>
            <p className="text-sm mt-1">{error}</p>
            <p className="text-sm mt-1">
              Please check:
            </p>
            <ul className="text-sm mt-1 list-disc list-inside">
              <li>Your API key is valid and has the Maps JavaScript API enabled</li>
              <li>Your internet connection is working</li>
              <li>The API key doesn't have overly restrictive domain limitations</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full" style={{ minHeight: '400px' }}>
        <Alert className="mb-4">
          <AlertDescription>
            Loading Google Maps... This may take a few seconds.
          </AlertDescription>
        </Alert>
        <Skeleton className="w-full h-80 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {map && (
        <div className="mb-2 text-sm text-green-600">
          ✓ Google Maps loaded successfully
        </div>
      )}
      <div 
        ref={mapRef} 
        className="w-full h-96 rounded-lg border border-gray-300"
        style={{ minHeight: '400px' }}
      />
      {locations.length > 0 && (
        <div className="mt-2 text-sm text-gray-600">
          Displaying {locations.length} location{locations.length !== 1 ? 's' : ''} on the map
        </div>
      )}
    </div>
  );
};

export default GoogleMapComponent;
