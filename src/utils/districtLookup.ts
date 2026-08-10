// Maps a GPS point to a Sri Lanka district using the districts GeoJSON.
// Loaded once and cached.

let featuresCache: any[] | null = null;
let loadPromise: Promise<any[]> | null = null;

export async function loadDistrictFeatures(): Promise<any[]> {
  if (featuresCache) return featuresCache;
  if (loadPromise) return loadPromise;
  loadPromise = fetch('/sri-lanka-districts.geojson')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('districts geojson not found'))))
    .then((geo) => {
      featuresCache = geo?.features || [];
      return featuresCache!;
    })
    .catch(() => {
      featuresCache = [];
      return featuresCache!;
    });
  return loadPromise;
}

export function districtNameOf(props: any): string {
  return (
    props?.shapeName || props?.name || props?.NAME || props?.DISTRICT ||
    props?.district || props?.ADM2_EN || 'Unknown'
  );
}

// Ray-casting point-in-ring. ring is [[lng,lat], ...]; point is [lng,lat].
function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// A polygon is [outerRing, hole1, hole2, ...]. Inside = in outer, not in any hole.
function pointInPolygon(x: number, y: number, polygon: number[][][]): boolean {
  if (!polygon.length || !pointInRing(x, y, polygon[0])) return false;
  for (let h = 1; h < polygon.length; h++) {
    if (pointInRing(x, y, polygon[h])) return false;
  }
  return true;
}

// Returns the district name containing (lat,lng), or null.
export function districtForPoint(lat: number, lng: number, features: any[]): string | null {
  for (const f of features) {
    const geom = f?.geometry;
    if (!geom) continue;
    if (geom.type === 'Polygon') {
      if (pointInPolygon(lng, lat, geom.coordinates)) return districtNameOf(f.properties);
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        if (pointInPolygon(lng, lat, poly)) return districtNameOf(f.properties);
      }
    }
  }
  return null;
}
