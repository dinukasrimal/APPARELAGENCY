import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LocationData {
  id: string;
  type: 'customer' | 'non_productive' | 'sales_order' | 'invoice' | 'collection' | 'clock_in' | 'clock_out' | 'delivery';
  name: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  details?: string;
  agencyName?: string;
  orderNumber?: number;
  color?: string;   // per-marker color override (e.g. by agency)
  label?: string;   // text to render inside the marker (e.g. an amount)
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
  selectedId?: string | null;
  myLocation?: { latitude: number; longitude: number } | null;
  // A located agent (superuser "Locate agent"), shown with its own label.
  agentLocation?: { latitude: number; longitude: number; label: string } | null;
  showDistricts?: boolean;
}

// Cache the districts GeoJSON across map instances (loaded once).
let districtsGeoJsonCache: any = null;

const LeafletMap = ({ locations, height = '400px', routes = [], selectedId = null, myLocation = null, agentLocation = null, showDistricts = false }: LeafletMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const markerByIdRef = useRef<Record<string, L.Marker>>({});
  const routeLayersRef = useRef<L.Polyline[]>([]);
  const myLocationMarkerRef = useRef<L.Marker | null>(null);
  const agentLocationMarkerRef = useRef<L.Marker | null>(null);
  const districtsLayerRef = useRef<L.GeoJSON | null>(null);

  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'customer': return '#EAB308';
      case 'non_productive': return '#EF4444';
      case 'sales_order': return '#000000';
      case 'invoice': return '#22C55E';
      case 'collection': return '#8B5CF6'; // Purple color for collections
      case 'delivery': return '#0EA5E9'; // Sky blue for deliveries
      case 'clock_in': return '#10B981';
      case 'clock_out': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const createCustomIcon = (color: string, label?: string | number, highlighted = false) => {
    const text = (label === undefined || label === null) ? '' : String(label);
    const ring = highlighted
      ? 'border: 3px solid #2563EB; box-shadow: 0 0 0 4px rgba(37,99,235,0.35), 0 2px 6px rgba(0,0,0,0.4);'
      : 'border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);';

    // Longer labels (e.g. amounts like "12.5k") render as a rounded pill sized
    // to the text; short/no labels render as the classic circular dot.
    if (text.length > 3) {
      const w = text.length * 8 + 16;
      const h = highlighted ? 26 : 22;
      return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          width:${w}px;height:${h}px;border-radius:${h / 2}px;background-color:${color};${ring}
          display:flex;align-items:center;justify-content:center;color:#fff;
          font-size:11px;font-weight:700;font-family:sans-serif;white-space:nowrap;
        ">${text}</div>`,
        iconSize: [w, h],
        iconAnchor: [w / 2, h / 2],
      });
    }

    const size = highlighted ? 30 : 24;
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background-color: ${color};
        ${ring}
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: ${highlighted ? 13 : 11}px;
        font-weight: 700;
        font-family: sans-serif;
      ">${text}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
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
    markerByIdRef.current = {};

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
      const iconLabel = location.label ?? (location.orderNumber !== undefined ? String(location.orderNumber) : undefined);
      const marker = L.marker([location.latitude, location.longitude], {
        icon: createCustomIcon(location.color || getMarkerColor(location.type), iconLabel)
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
      markerByIdRef.current[location.id] = marker;
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

  // Highlight the selected marker: enlarge it, pan to it, and open its popup
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const iconLabelOf = (l: LocationData) => l.label ?? (l.orderNumber !== undefined ? String(l.orderNumber) : undefined);

    // Reset all markers to their normal icon
    locations.forEach((location) => {
      const marker = markerByIdRef.current[location.id];
      if (marker) {
        marker.setIcon(createCustomIcon(location.color || getMarkerColor(location.type), iconLabelOf(location), false));
        marker.setZIndexOffset(0);
      }
    });

    if (!selectedId) return;

    const selected = locations.find(l => l.id === selectedId);
    const marker = selectedId ? markerByIdRef.current[selectedId] : null;
    if (selected && marker) {
      marker.setIcon(createCustomIcon(selected.color || getMarkerColor(selected.type), iconLabelOf(selected), true));
      marker.setZIndexOffset(1000);
      mapInstanceRef.current.panTo([selected.latitude, selected.longitude]);
      marker.openPopup();
    }
  }, [selectedId, locations]);

  // Live "my location" marker — a pulsing blue dot; pan+zoom to it when updated.
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (myLocationMarkerRef.current) {
      mapInstanceRef.current.removeLayer(myLocationMarkerRef.current);
      myLocationMarkerRef.current = null;
    }

    if (!myLocation) return;

    const icon = L.divIcon({
      className: 'my-location-marker',
      html: `<div style="position:relative;width:22px;height:22px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(37,99,235,0.3);animation:mlpulse 1.6s ease-out infinite;"></div>
        <div style="position:absolute;top:5px;left:5px;width:12px;height:12px;border-radius:50%;background:#2563EB;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>
      </div>
      <style>@keyframes mlpulse{0%{transform:scale(0.6);opacity:1}100%{transform:scale(2.2);opacity:0}}</style>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    const marker = L.marker([myLocation.latitude, myLocation.longitude], { icon, zIndexOffset: 2000 })
      .bindPopup('You are here');
    marker.addTo(mapInstanceRef.current);
    myLocationMarkerRef.current = marker;

    mapInstanceRef.current.setView([myLocation.latitude, myLocation.longitude], 16);
    marker.openPopup();
  }, [myLocation]);

  // Located agent — a red pin with their name and how fresh the fix is.
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (agentLocationMarkerRef.current) {
      mapInstanceRef.current.removeLayer(agentLocationMarkerRef.current);
      agentLocationMarkerRef.current = null;
    }

    if (!agentLocation) return;

    const icon = L.divIcon({
      className: 'agent-location-marker',
      html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#DC2626;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,0.45);"></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 26],
      popupAnchor: [0, -24],
    });

    const marker = L.marker([agentLocation.latitude, agentLocation.longitude], { icon, zIndexOffset: 2500 })
      .bindPopup(agentLocation.label);
    marker.addTo(mapInstanceRef.current);
    agentLocationMarkerRef.current = marker;

    mapInstanceRef.current.setView([agentLocation.latitude, agentLocation.longitude], 16);
    marker.openPopup();
  }, [agentLocation]);

  // Sri Lanka district boundaries — light shaded overlay with labels.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove when toggled off
    if (!showDistricts) {
      if (districtsLayerRef.current) {
        map.removeLayer(districtsLayerRef.current);
        districtsLayerRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const render = (geo: any) => {
      if (cancelled || !mapInstanceRef.current || districtsLayerRef.current) return;
      const nameOf = (props: any) =>
        props?.shapeName || props?.name || props?.NAME || props?.DISTRICT || props?.district ||
        props?.ADM2_EN || props?.DISTRICT_N || props?.DSD_N || 'District';
      const layer = L.geoJSON(geo, {
        style: () => ({
          color: '#64748b',        // slate border
          weight: 1,
          fillColor: '#3b82f6',    // light blue fill
          fillOpacity: 0.08,
        }),
        onEachFeature: (feature, lyr) => {
          const nm = nameOf(feature.properties);
          lyr.bindTooltip(nm, { sticky: true });
          (lyr as L.Path).on('mouseover', () => (lyr as L.Path).setStyle({ fillOpacity: 0.2 }));
          (lyr as L.Path).on('mouseout', () => (lyr as L.Path).setStyle({ fillOpacity: 0.08 }));
        },
      });
      // Keep districts UNDER the markers and non-blocking
      layer.addTo(mapInstanceRef.current);
      layer.bringToBack();
      districtsLayerRef.current = layer;
    };

    if (districtsGeoJsonCache) {
      render(districtsGeoJsonCache);
    } else {
      fetch('/sri-lanka-districts.geojson')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('not found'))))
        .then((geo) => { districtsGeoJsonCache = geo; render(geo); })
        .catch(() => console.warn('District boundaries file /sri-lanka-districts.geojson not found.'));
    }

    return () => { cancelled = true; };
  }, [showDistricts]);

  return (
    <div className="w-full">
      <div className="mb-2 text-sm text-green-600">
        ✓ Interactive Leaflet Map (OpenStreetMap - No API key required!)
      </div>
      {/* `relative z-0 isolate` gives the map its own stacking context. Leaflet
          puts its panes and controls at z-index 400-1000, which otherwise
          compete with the whole page and cover dropdowns (z-50) that open
          over the map. Contained, they only stack within the map. */}
      <div
        ref={mapRef}
        className="relative z-0 isolate w-full rounded-lg border border-gray-300"
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
