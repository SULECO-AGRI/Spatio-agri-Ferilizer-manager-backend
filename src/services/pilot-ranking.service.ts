/**
 * ==============================================================================
 * SPATIO-AGRI PRECISION FERTILIZER MANAGEMENT SYSTEM
 * Pilot Recommendation & Ranking Engine (Geospatial & Performance Matching)
 * ==============================================================================
 */

// Sri Lanka District Coordinates (Lat/Lng Centroids for Hub/Base Resolution)
export const SRI_LANKA_DISTRICT_COORDINATES: Record<string, { lat: number; lng: number }> = {
  anuradhapura: { lat: 8.3114, lng: 80.4037 },
  polonnaruwa: { lat: 7.9403, lng: 81.0188 },
  kurunegala: { lat: 7.4863, lng: 80.3623 },
  ampara: { lat: 7.2912, lng: 81.6724 },
  batticaloa: { lat: 7.731, lng: 81.6747 },
  trincomalee: { lat: 8.5874, lng: 81.2152 },
  jaffna: { lat: 9.6615, lng: 80.0255 },
  kilinochchi: { lat: 9.3803, lng: 80.377 },
  mannar: { lat: 8.981, lng: 79.9044 },
  mullaitivu: { lat: 9.2671, lng: 80.8143 },
  vavuniya: { lat: 8.7514, lng: 80.4971 },
  puttalam: { lat: 8.0408, lng: 79.8394 },
  kandy: { lat: 7.2906, lng: 80.6337 },
  matale: { lat: 7.4675, lng: 80.6234 },
  nuwaraeliya: { lat: 6.9497, lng: 80.7891 },
  badulla: { lat: 6.9934, lng: 81.055 },
  monaragala: { lat: 6.8728, lng: 81.3507 },
  ratnapura: { lat: 6.6828, lng: 80.3992 },
  kegalle: { lat: 7.2513, lng: 80.3464 },
  colombo: { lat: 6.9271, lng: 79.8612 },
  gampaha: { lat: 7.084, lng: 79.9943 },
  kalutara: { lat: 6.5854, lng: 79.9607 },
  galle: { lat: 6.0535, lng: 80.221 },
  matara: { lat: 5.9549, lng: 80.555 },
  hambantota: { lat: 6.1429, lng: 81.1212 },
};

// Default National Drone Operations Base (Anuradhapura Agricultural Aviation Hub)
export const DEFAULT_BASE_COORDINATES = { lat: 8.3114, lng: 80.4037 };

/**
 * Calculate Great-Circle distance between two coordinates using the Haversine formula (km)
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Number(distance.toFixed(2));
}

/**
 * Robust Field Coordinate Centroid Extraction
 * Supports polygon arrays `[[lat, lng], ...]`, GeoJSON formats, and `{ lat, lng }` objects.
 */
export function extractFieldCentroid(
  locationCoordinates: any,
  fallbackDistrict?: string
): { lat: number; lng: number } {
  try {
    if (!locationCoordinates) {
      if (fallbackDistrict) {
        const districtKey = fallbackDistrict.toLowerCase().replace(/[^a-z]/g, "");
        if (SRI_LANKA_DISTRICT_COORDINATES[districtKey]) {
          return SRI_LANKA_DISTRICT_COORDINATES[districtKey];
        }
      }
      return DEFAULT_BASE_COORDINATES;
    }

    let parsed = locationCoordinates;
    if (typeof locationCoordinates === "string") {
      parsed = JSON.parse(locationCoordinates);
    }

    // Direct object { lat, lng } or { latitude, longitude }
    if (typeof parsed === "object" && !Array.isArray(parsed)) {
      if ("lat" in parsed && "lng" in parsed) {
        return { lat: Number(parsed.lat), lng: Number(parsed.lng) };
      }
      if ("latitude" in parsed && "longitude" in parsed) {
        return { lat: Number(parsed.latitude), lng: Number(parsed.longitude) };
      }
      // GeoJSON Feature or Polygon
      if (parsed.type === "Point" && Array.isArray(parsed.coordinates)) {
        return normalizeLatLng(parsed.coordinates[1], parsed.coordinates[0]);
      }
      if (
        (parsed.type === "Polygon" || parsed.type === "MultiPolygon") &&
        Array.isArray(parsed.coordinates)
      ) {
        const coords =
          parsed.type === "Polygon"
            ? parsed.coordinates[0]
            : parsed.coordinates[0][0];
        return computePolygonCentroid(coords);
      }
    }

    // Array of coordinate tuples: [[lat, lng], [lat, lng], ...]
    if (Array.isArray(parsed) && parsed.length > 0) {
      if (typeof parsed[0] === "number" && parsed.length === 2) {
        return normalizeLatLng(parsed[0], parsed[1]);
      }
      if (Array.isArray(parsed[0])) {
        return computePolygonCentroid(parsed);
      }
    }
  } catch (err) {
    console.warn("[extractFieldCentroid] Error extracting coordinates, falling back:", err);
  }

  if (fallbackDistrict) {
    const districtKey = fallbackDistrict.toLowerCase().replace(/[^a-z]/g, "");
    if (SRI_LANKA_DISTRICT_COORDINATES[districtKey]) {
      return SRI_LANKA_DISTRICT_COORDINATES[districtKey];
    }
  }

  return DEFAULT_BASE_COORDINATES;
}

/**
 * Normalizes Sri Lanka coordinate pairs to ensure Lat ~ 5.9° - 9.9° and Lng ~ 79.5° - 81.9°
 */
function normalizeLatLng(val1: number, val2: number): { lat: number; lng: number } {
  const num1 = Number(val1);
  const num2 = Number(val2);

  // If first number is in Sri Lanka longitude range (79 - 83) and second in latitude range (5 - 11)
  if (num1 >= 70 && num2 < 20) {
    return { lat: num2, lng: num1 };
  }
  return { lat: num1, lng: num2 };
}

/**
 * Computes average centroid of coordinate array
 */
function computePolygonCentroid(points: any[]): { lat: number; lng: number } {
  let sumLat = 0;
  let sumLng = 0;
  let validCount = 0;

  for (const pt of points) {
    if (Array.isArray(pt) && pt.length >= 2) {
      const normalized = normalizeLatLng(pt[0], pt[1]);
      sumLat += normalized.lat;
      sumLng += normalized.lng;
      validCount++;
    } else if (pt && typeof pt === "object") {
      const lat = pt.lat || pt.latitude;
      const lng = pt.lng || pt.longitude;
      if (lat !== undefined && lng !== undefined) {
        const normalized = normalizeLatLng(lat, lng);
        sumLat += normalized.lat;
        sumLng += normalized.lng;
        validCount++;
      }
    }
  }

  if (validCount === 0) {
    return DEFAULT_BASE_COORDINATES;
  }

  return {
    lat: Number((sumLat / validCount).toFixed(6)),
    lng: Number((sumLng / validCount).toFixed(6)),
  };
}

/**
 * Calculate Pilot Composite Match Score:
 * - Distance Weight (45%): Closer distance gets higher score (benchmarked against 100km radius)
 * - Rating Weight (35%): Normalized pilot customer rating (0.0 to 5.0)
 * - Experience Weight (20%): Normalized missions count (50 missions = max) & flight hours (100 hrs = max)
 */
export function calculatePilotMatchScore(params: {
  distanceKm: number;
  rating: number | null | undefined;
  completedMissions: number;
  totalFlightHours: number;
}): {
  matchScore: number;
  breakdown: {
    distanceScore: number;
    ratingScore: number;
    experienceScore: number;
  };
} {
  const { distanceKm, rating, completedMissions, totalFlightHours } = params;

  // 1. Distance Score (45% weight): 0km = 100pts, 100km+ = 0pts (decay gracefully)
  const maxBenchmarkRadiusKm = 100;
  const distanceScore = Math.max(
    0,
    Math.min(100, Number(((1 - distanceKm / maxBenchmarkRadiusKm) * 100).toFixed(2)))
  );

  // 2. Rating Score (35% weight): 5.0 rating = 100pts, 0.0 = 0pts (default to 5.0 for fresh active pilots)
  const effectiveRating = rating !== null && rating !== undefined ? Number(rating) : 5.0;
  const ratingScore = Math.max(
    0,
    Math.min(100, Number(((effectiveRating / 5.0) * 100).toFixed(2)))
  );

  // 3. Experience Score (20% weight): completed missions (50 max = 50pts) + flight hours (100 max = 50pts)
  const missionSubscore = Math.min(50, (completedMissions / 50) * 50);
  const flightHoursSubscore = Math.min(50, (totalFlightHours / 100) * 50);
  const experienceScore = Number((missionSubscore + flightHoursSubscore).toFixed(2));

  // 4. Weighted Composite Score
  const rawMatchScore =
    distanceScore * 0.45 + ratingScore * 0.35 + experienceScore * 0.2;
  const matchScore = Number(rawMatchScore.toFixed(2));

  return {
    matchScore,
    breakdown: {
      distanceScore,
      ratingScore,
      experienceScore,
    },
  };
}
