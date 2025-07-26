import { useEffect, useRef } from 'react';

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

interface SimpleMapProps {
  locations: LocationData[];
  height?: string;
}

const SimpleMap = ({ locations, height = '400px' }: SimpleMapProps) => {
  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'customer': return '#EAB308';
      case 'non_productive': return '#EF4444';
      case 'sales_order': return '#000000';
      case 'invoice': return '#22C55E';
      case 'collection': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  const centerLat = locations.length > 0 
    ? locations.reduce((sum, loc) => sum + loc.latitude, 0) / locations.length 
    : 7.8731;
  const centerLng = locations.length > 0 
    ? locations.reduce((sum, loc) => sum + loc.longitude, 0) / locations.length 
    : 80.7718;

  return (
    <div className="w-full">
      <div className="mb-2 text-sm text-green-600">
        ✓ Simple Map View (No dependencies required!)
      </div>
      <div 
        className="w-full rounded-lg border border-gray-300 bg-blue-50 relative overflow-hidden"
        style={{ height }}
      >
        {/* Simple coordinate system visualization */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center p-4">
            <h3 className="font-semibold text-gray-700 mb-2">Location Overview</h3>
            <p className="text-sm text-gray-600 mb-4">
              Center: {centerLat.toFixed(4)}, {centerLng.toFixed(4)}
            </p>
            
            {locations.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {locations.map((location, index) => (
                  <div 
                    key={location.id}
                    className="bg-white rounded-lg p-3 shadow-sm border"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getMarkerColor(location.type) }}
                      />
                      <span className="font-medium text-sm">{location.name}</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                    </div>
                    {location.details && (
                      <div className="text-xs text-gray-500 mt-1">{location.details}</div>
                    )}
                    {location.agencyName && (
                      <div className="text-xs text-gray-400">Agency: {location.agencyName}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No locations to display</p>
            )}
          </div>
        </div>
      </div>
      {locations.length > 0 && (
        <div className="mt-2 text-sm text-gray-600">
          Displaying {locations.length} location{locations.length !== 1 ? 's' : ''} in list view
        </div>
      )}
    </div>
  );
};

export default SimpleMap;
