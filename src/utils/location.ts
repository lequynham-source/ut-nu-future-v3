/**
 * Calculates the distance between two points in meters using the Haversine formula.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Finds the nearest agency within a given threshold (default 500m).
 */
export function findNearestAgency(location: { lat: number; lng: number }, agencies: any[], threshold: number = 500) {
  if (!location || !agencies || agencies.length === 0) return null;

  let nearest = null;
  let minDistance = Infinity;

  for (const agency of agencies) {
    if (agency.lat && agency.lng) {
      const distance = calculateDistance(location.lat, location.lng, agency.lat, agency.lng);
      if (distance < minDistance && distance <= threshold) {
        minDistance = distance;
        nearest = agency;
      }
    }
  }

  return nearest;
}
