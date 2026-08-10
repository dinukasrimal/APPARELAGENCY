// Sri Lanka geographic bounds (with a small margin). Used to reject GPS fixes
// that fall outside the country and to hide bad points on maps.
export const SRI_LANKA_BOUNDS = {
  latMin: 5.5,
  latMax: 10.0,
  lngMin: 79.4,
  lngMax: 82.0,
};

export function isWithinSriLanka(latitude?: number | null, longitude?: number | null): boolean {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return false;
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return false;
  if (latitude === 0 && longitude === 0) return false; // null island
  return (
    latitude >= SRI_LANKA_BOUNDS.latMin &&
    latitude <= SRI_LANKA_BOUNDS.latMax &&
    longitude >= SRI_LANKA_BOUNDS.lngMin &&
    longitude <= SRI_LANKA_BOUNDS.lngMax
  );
}

// Throwing guard for GPS capture — blocks activity until a valid fix is obtained.
export function assertWithinSriLanka(latitude: number, longitude: number): void {
  if (!isWithinSriLanka(latitude, longitude)) {
    throw new Error(
      'Your location appears to be outside Sri Lanka. Please move to get an accurate GPS fix and try again.'
    );
  }
}
