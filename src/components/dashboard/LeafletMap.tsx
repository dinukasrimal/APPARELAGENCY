import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LocationData {
  id: string;
  type: 'customer' | 'non_productive' | 'sales_order' | 'invoice' | 'collection' | 'clock_in' | 'clock_out';
  name: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  details?: string;
  agencyName?: string;
}

interface RoutePath {
  id: string;
  points: Array<{
    latitude: number;
    longitude: number;
    recordedAt?: Date;
  }>;
  color?: string;
  label?: string;
}

interface LeafletMapProps {
  locations: LocationData[];
  height?: string;
  routes?: RoutePath[];
}

const LeafletMap = ({ locations, height = '400px', routes = [] }: LeafletMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeLayersRef = useRef<L.Polyline[]>([]);

  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'customer': return '#EAB308';
      case 'non_productive': return '#EF4444';
      case 'sales_order': return '#000000';
      case 'invoice': return '#22C55E';
      case 'collection': return '#8B5CF6'; // Purple color for collections
      case 'clock_in': return '#10B981';
      case 'clock_out': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const createCustomIcon = (color: string) => {
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: ${color};
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  };

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map with a default view (Sri Lanka)
    const map = L.map(mapRef.current).setView([7.8731, 80.7718], 8);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapInstanceRef.current?.removeLayer(marker);
    });
    markersRef.current = [];

    routeLayersRef.current.forEach((polyline) => {
      mapInstanceRef.current?.removeLayer(polyline);
    });
    routeLayersRef.current = [];

    if (locations.length === 0 && routes.length === 0) {
      // If no locations, just center on Sri Lanka
      mapInstanceRef.current.setView([7.8731, 80.7718], 8);
      return;
    }

    // Add new markers
    const bounds = L.latLngBounds([]);
    let hasBounds = false;
    
    locations.forEach((location) => {
      const marker = L.marker([location.latitude, location.longitude], {
        icon: createCustomIcon(getMarkerColor(location.type))
      });

      const popupContent = `
        <div style="padding: 8px; max-width: 200px;">
          <h3 style="font-weight: 600; margin: 0 0 4px 0; font-size: 14px;">${location.name}</h3>
          ${location.details ? `<p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">${location.details}</p>` : ''}
          ${location.agencyName ? `<p style="margin: 0 0 4px 0; font-size: 11px; color: #888;">Agency: ${location.agencyName}</p>` : ''}
          <p style="margin: 0 0 4px 0; font-size: 11px; color: #888;">${location.timestamp.toLocaleString()}</p>
          <p style="margin: 0; font-size: 10px; color: #aaa;">${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}</p>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.addTo(mapInstanceRef.current!);
      
      bounds.extend([location.latitude, location.longitude]);
      hasBounds = true;
      markersRef.current.push(marker);
    });

    routes.forEach((route, index) => {
      if (!route.points || route.points.length < 2) return;

      const latLngs = route.points.map((point) => [point.latitude, point.longitude] as [number, number]);
      latLngs.forEach((coords) => {
        bounds.extend(coords);
        hasBounds = true;
      });

      const polyline = L.polyline(latLngs, {
        color: route.color || ['#2563EB', '#059669', '#D97706', '#7C3AED', '#EC4899'][index % 5],
        weight: 4,
        opacity: 0.6,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(mapInstanceRef.current!);

      if (route.label) {
        polyline.bindPopup(route.label);
      }

      routeLayersRef.current.push(polyline);
    });

    // Fit map to markers
    if (hasBounds && bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [20, 20] });
      if (locations.length === 1 && routes.length === 0) {
        mapInstanceRef.current.setZoom(15);
      }
    }
  }, [locations, routes]);

  return (
    <div className="w-full">
      <div className="mb-2 text-sm text-green-600">
        ✓ Interactive Leaflet Map (OpenStreetMap - No API key required!)
      </div>
      <div 
        ref={mapRef} 
        className="w-full rounded-lg border border-gray-300"
        style={{ height }}
      />
      <div className="mt-2 text-sm text-gray-600">
        {locations.length > 0 ? (
          `Displaying ${locations.length} location${locations.length !== 1 ? 's' : ''} on the interactive map`
        ) : (
          'No locations to display - add customers with GPS coordinates to see them on the map'
        )}
      </div>
    </div>
  );
};

export default LeafletMap;
