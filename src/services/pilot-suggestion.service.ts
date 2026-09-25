/**
 * ==============================================================================
 * SPATIO-AGRI PRECISION FERTILIZER MANAGEMENT SYSTEM
 * Dedicated Pilot Suggestion & Ranking Engine
 * File: src/services/pilot-suggestion.service.ts
 * ==============================================================================
 */

import prisma from "../config/prisma";
import { AppError } from "../utils/AppError";
import { JwtPayload } from "../types/auth.types";
import {
  CandidatePilotDTO,
  CandidatePilotsResponseDTO,
} from "../types/service-request.types";
import { MissionStatus, PilotStatus } from "../generated/prisma/enums";

import {
  SRI_LANKA_DISTRICT_COORDINATES,
  DEFAULT_BASE_COORDINATES,
} from "./pilot-ranking.service";

export interface ServiceAreaCoverageResult {
  isCovered: boolean;
  coverageType: "DISTRICT_MATCH" | "POLYGON_GEOFENCE" | "RADIAL_RANGE" | "ALL_ISLAND_DEFAULT";
  distanceKm: number;
}

export class PilotSuggestionService {
  /**
   * Calculate Great-Circle distance using Haversine formula (km)
   */
  public static calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
  }

  /**
   * Ray-Casting Algorithm for Point-in-Polygon Geofence Validation
   */
  public static isPointInPolygon(
    point: { lat: number; lng: number },
    polygon: Array<[number, number]>
  ): boolean {
    if (!polygon || polygon.length < 3) {
      return false;
    }

    const x = point.lng;
    const y = point.lat;
    let isInside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][1];
      const yi = polygon[i][0];
      const xj = polygon[j][1];
      const yj = polygon[j][0];

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) {
        isInside = !isInside;
      }
    }

    return isInside;
  }

  /**
   * Extract Field Coordinate Centroid (Supports GeoJSON, Polygon Arrays, Object {lat, lng})
   */
  public static extractFieldCentroid(
    locationCoordinates: any,
    fallbackDistrict?: string
  ): { lat: number; lng: number } {
    try {
      if (!locationCoordinates) {
        return this.getDistrictCentroid(fallbackDistrict);
      }

      let parsed = locationCoordinates;
      if (typeof locationCoordinates === "string") {
        parsed = JSON.parse(locationCoordinates);
      }

      // 1. Direct object format { lat, lng } or { latitude, longitude }
      if (typeof parsed === "object" && !Array.isArray(parsed)) {
        if ("lat" in parsed && "lng" in parsed) {
          return { lat: Number(parsed.lat), lng: Number(parsed.lng) };
        }
        if ("latitude" in parsed && "longitude" in parsed) {
          return { lat: Number(parsed.latitude), lng: Number(parsed.longitude) };
        }
        if (parsed.type === "Point" && Array.isArray(parsed.coordinates)) {
          return this.normalizeLatLng(parsed.coordinates[1], parsed.coordinates[0]);
        }
        if (
          (parsed.type === "Polygon" || parsed.type === "MultiPolygon") &&
          Array.isArray(parsed.coordinates)
        ) {
          const coords =
            parsed.type === "Polygon"
              ? parsed.coordinates[0]
              : parsed.coordinates[0][0];
          return this.computePolygonCentroid(coords);
        }
      }

      // 2. Coordinate Array format: [[lat, lng], ...]
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof parsed[0] === "number" && parsed.length === 2) {
          return this.normalizeLatLng(parsed[0], parsed[1]);
        }
        if (Array.isArray(parsed[0])) {
          return this.computePolygonCentroid(parsed);
        }
      }
    } catch (err) {
      console.warn("[PilotSuggestionService] Centroid extraction fallback:", err);
    }

    return this.getDistrictCentroid(fallbackDistrict);
  }

  /**
   * Evaluates if a field is covered by a pilot's registered service area
   */
  public static evaluateServiceAreaCoverage(
    fieldCentroid: { lat: number; lng: number },
    fieldDistrict: string,
    pilotServiceArea: any
  ): ServiceAreaCoverageResult {
    const normalizedDistrict = (fieldDistrict || "").toLowerCase().replace(/[^a-z]/g, "");

    // 1. If pilot service area is not configured, default to All-Island national coverage
    if (!pilotServiceArea) {
      const distanceKm = this.calculateHaversineDistance(
        fieldCentroid.lat,
        fieldCentroid.lng,
        DEFAULT_BASE_COORDINATES.lat,
        DEFAULT_BASE_COORDINATES.lng
      );
      return {
        isCovered: true,
        coverageType: "ALL_ISLAND_DEFAULT",
        distanceKm,
      };
    }

    let parsedArea = pilotServiceArea;
    if (typeof pilotServiceArea === "string") {
      try {
        parsedArea = JSON.parse(pilotServiceArea);
      } catch {
        // Plain string district name (e.g. "Nuwara Eliya")
        const areaStr = pilotServiceArea.toLowerCase().replace(/[^a-z]/g, "");
        const isCovered = areaStr === normalizedDistrict || areaStr.includes(normalizedDistrict);
        const baseCoords = this.getDistrictCentroid(pilotServiceArea);
        const distanceKm = this.calculateHaversineDistance(
          fieldCentroid.lat,
          fieldCentroid.lng,
          baseCoords.lat,
          baseCoords.lng
        );
        return {
          isCovered,
          coverageType: "DISTRICT_MATCH",
          distanceKm,
        };
      }
    }

    // 2. Array of District Names (e.g., ["Nuwara Eliya", "Kandy", "Badulla"])
    if (Array.isArray(parsedArea) && typeof parsedArea[0] === "string") {
      const districts = parsedArea.map((d: string) => d.toLowerCase().replace(/[^a-z]/g, ""));
      const isCovered = districts.includes(normalizedDistrict);
      const baseCoords = this.getDistrictCentroid(parsedArea[0]);
      const distanceKm = this.calculateHaversineDistance(
        fieldCentroid.lat,
        fieldCentroid.lng,
        baseCoords.lat,
        baseCoords.lng
      );
      return {
        isCovered,
        coverageType: "DISTRICT_MATCH",
        distanceKm,
      };
    }

    // 3. Polygon Geofence Array (e.g., [[lat, lng], [lat, lng], ...])
    if (Array.isArray(parsedArea) && Array.isArray(parsedArea[0])) {
      const polygonCoords: Array<[number, number]> = parsedArea.map((pt: any) => [
        Number(pt[0]),
        Number(pt[1]),
      ]);
      const baseCentroid = this.computePolygonCentroid(polygonCoords);
      const distanceKm = this.calculateHaversineDistance(
        fieldCentroid.lat,
        fieldCentroid.lng,
        baseCentroid.lat,
        baseCentroid.lng
      );
      const isInsideGeofence = this.isPointInPolygon(fieldCentroid, polygonCoords);

      // Covered if point is inside polygon OR within 100km operational base radius
      const isCovered = isInsideGeofence || distanceKm <= 100;
      const coverageType = isInsideGeofence ? "POLYGON_GEOFENCE" : "PROXIMITY_RADIUS";

      return {
        isCovered,
        coverageType: isCovered ? (coverageType as any) : "OUT_OF_RANGE",
        distanceKm,
      };
    }

    // 4. Object Configuration (Districts array, Radial base, or GeoJSON)
    if (typeof parsedArea === "object" && parsedArea !== null) {
      // 4a. Object containing districts list: { districts: ["Nuwara Eliya"] }
      if (Array.isArray(parsedArea.districts)) {
        const districts = parsedArea.districts.map((d: string) =>
          d.toLowerCase().replace(/[^a-z]/g, "")
        );
        const isCovered = districts.includes(normalizedDistrict);
        const baseCoords = this.getDistrictCentroid(parsedArea.districts[0]);
        const distanceKm = this.calculateHaversineDistance(
          fieldCentroid.lat,
          fieldCentroid.lng,
          baseCoords.lat,
          baseCoords.lng
        );
        return {
          isCovered,
          coverageType: "DISTRICT_MATCH",
          distanceKm,
        };
      }

      // 4b. Radial Base Coordinate: { lat: 6.94, lng: 80.78, radiusKm: 50 }
      const baseLat = parsedArea.lat || parsedArea.latitude;
      const baseLng = parsedArea.lng || parsedArea.longitude;
      if (baseLat !== undefined && baseLng !== undefined) {
        const distanceKm = this.calculateHaversineDistance(
          fieldCentroid.lat,
          fieldCentroid.lng,
          Number(baseLat),
          Number(baseLng)
        );
        const radiusKm = Number(parsedArea.radiusKm || parsedArea.radius || 100);
        const isCovered = distanceKm <= radiusKm;
        return {
          isCovered,
          coverageType: "RADIAL_RANGE",
          distanceKm,
        };
      }
    }

    // Fallback default
    const baseCoords = this.extractFieldCentroid(pilotServiceArea, fieldDistrict);
    const distanceKm = this.calculateHaversineDistance(
      fieldCentroid.lat,
      fieldCentroid.lng,
      baseCoords.lat,
      baseCoords.lng
    );

    return {
      isCovered: true,
      coverageType: "ALL_ISLAND_DEFAULT",
      distanceKm,
    };
  }

  /**
   * Main Dispatcher: Queries available pilots, filters by service area, calculates proximity, and ranks candidates
   */
  public static async suggestPilotsForRequest(
    requestId: number,
    requestUser?: JwtPayload
  ): Promise<CandidatePilotsResponseDTO> {
    if (!requestUser) {
      throw AppError.unauthorized("Authentication required.");
    }

    const userRole = requestUser.role?.toLowerCase();
    if (userRole !== "admin") {
      throw AppError.forbidden("Access denied. Pilot recommendation is restricted to Administrators.");
    }

    // 1. Retrieve Service Request & Field
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { requestId },
      include: {
        field: true,
      },
    });

    if (!serviceRequest) {
      throw AppError.notFound(`Service request with ID ${requestId} not found.`);
    }

    // 2. Extract Field Centroid Coordinates
    const fieldCentroid = this.extractFieldCentroid(
      serviceRequest.field.locationCoordinates,
      serviceRequest.field.district
    );

    // 3. Define UTC Day Window for Preferred Date
    const preferredDate = new Date(serviceRequest.preferredDate);
    const dayStart = new Date(preferredDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(preferredDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    // 4. Query Available Active Pilots (Filtering out flight schedule conflicts)
    const activePilots = await prisma.user.findMany({
      where: {
        role: { name: "Pilot" },
        pilotProfile: {
          status: PilotStatus.ACTIVE,
        },
      },
      include: {
        pilotProfile: true,
        assignedMissions: {
          where: {
            status: {
              in: [MissionStatus.SCHEDULED, MissionStatus.IN_PROGRESS],
            },
            serviceRequest: {
              preferredDate: {
                gte: dayStart,
                lte: dayEnd,
              },
            },
          },
          select: { missionId: true },
        },
      },
    });

    // 5. Filter only available pilots (no conflicting mission on that day)
    const availablePilots = activePilots.filter(
      (pilot) => !pilot.assignedMissions || pilot.assignedMissions.length === 0
    );

    // 6. Evaluate Service Area Coverage & Distance for each pilot
    const candidates: CandidatePilotDTO[] = [];

    for (const pilot of availablePilots) {
      const profile = pilot.pilotProfile!;
      const coverageEvaluation = this.evaluateServiceAreaCoverage(
        fieldCentroid,
        serviceRequest.field.district,
        profile.serviceArea
      );

      // Only include pilots whose service area covers the requested field
      if (!coverageEvaluation.isCovered) {
        continue;
      }

      const distanceKm = coverageEvaluation.distanceKm;
      const ratingNum = profile.ratings !== null && profile.ratings !== undefined ? Number(profile.ratings) : 5.0;
      const completedMissions = profile.completedMissions || 0;
      const totalFlightHours = Number(profile.totalFlightHours || 0);

      // Calculate Weighted Match Score
      const { matchScore, breakdown } = this.calculatePilotMatchScore({
        distanceKm,
        rating: ratingNum,
        completedMissions,
        totalFlightHours,
      });

      // Generate concise recommendation badge
      const recommendationBadge = this.generateRecommendationBadge({
        distanceKm,
        rating: ratingNum,
        completedMissions,
        coverageType: coverageEvaluation.coverageType,
      });

      candidates.push({
        pilotId: pilot.userId,
        fullName: `${pilot.firstName} ${pilot.lastName}`.trim(),
        email: pilot.email,
        mobile: pilot.mobile,
        licenceNumber: profile.licenceNumber ?? null,
        serviceArea: profile.serviceArea ?? null,
        status: profile.status,
        rating: ratingNum,
        distanceKm,
        completedMissions,
        totalFlightHours,
        matchScore,
        coverageType: coverageEvaluation.coverageType,
        recommendationBadge,
        scoreBreakdown: breakdown,
      });
    }

    // 7. Sort candidates by distance (closest first), secondary by matchScore
    candidates.sort((a, b) => {
      if (a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
      return b.matchScore - a.matchScore;
    });

    return {
      requestId: serviceRequest.requestId,
      requestCode: serviceRequest.requestCode,
      preferredDate: serviceRequest.preferredDate,
      field: {
        id: serviceRequest.field.id,
        fieldName: serviceRequest.field.fieldName,
        cropType: serviceRequest.field.cropType,
        area: Number(serviceRequest.field.area),
        district: serviceRequest.field.district,
        province: serviceRequest.field.province,
        city: serviceRequest.field.city,
        coordinates: fieldCentroid,
      },
      totalCandidates: candidates.length,
      candidates,
    };
  }

  /**
   * Multi-Factor Weighted Scoring Engine
   */
  public static calculatePilotMatchScore(params: {
    distanceKm: number;
    rating: number;
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

    // 1. Distance Score (45% weight): 0km = 100pts, 100km+ = 0pts
    const distanceScore = Math.max(
      0,
      Math.min(100, Number(((1 - distanceKm / 100) * 100).toFixed(2)))
    );

    // 2. Rating Score (35% weight): 5.0 rating = 100pts
    const ratingScore = Math.max(
      0,
      Math.min(100, Number(((rating / 5.0) * 100).toFixed(2)))
    );

    // 3. Experience Score (20% weight): completed missions (50 max) + flight hours (100 max)
    const missionSubscore = Math.min(50, (completedMissions / 50) * 50);
    const flightHoursSubscore = Math.min(50, (totalFlightHours / 100) * 50);
    const experienceScore = Number((missionSubscore + flightHoursSubscore).toFixed(2));

    const matchScore = Number(
      (distanceScore * 0.45 + ratingScore * 0.35 + experienceScore * 0.2).toFixed(2)
    );

    return {
      matchScore,
      breakdown: {
        distanceScore,
        ratingScore,
        experienceScore,
      },
    };
  }

  /**
   * Generates readable recommendation tag
   */
  private static generateRecommendationBadge(params: {
    distanceKm: number;
    rating: number;
    completedMissions: number;
    coverageType: string;
  }): string {
    const { distanceKm, rating, completedMissions } = params;

    if (distanceKm <= 15 && rating >= 4.8) {
      return `Top Match • ${distanceKm} km away • ⭐ ${rating.toFixed(1)}`;
    }
    if (distanceKm <= 25) {
      return `Nearby Pilot (${distanceKm} km)`;
    }
    if (completedMissions >= 30) {
      return `Veteran Pilot (${completedMissions} missions)`;
    }
    if (rating >= 4.8) {
      return `Highly Rated (⭐ ${rating.toFixed(1)})`;
    }
    return `Available (${distanceKm} km away)`;
  }

  private static getDistrictCentroid(district?: string): { lat: number; lng: number } {
    if (district) {
      const districtKey = district.toLowerCase().replace(/[^a-z]/g, "");
      if (SRI_LANKA_DISTRICT_COORDINATES[districtKey]) {
        return SRI_LANKA_DISTRICT_COORDINATES[districtKey];
      }
    }
    return DEFAULT_BASE_COORDINATES;
  }

  private static normalizeLatLng(val1: number, val2: number): { lat: number; lng: number } {
    const num1 = Number(val1);
    const num2 = Number(val2);
    if (num1 >= 70 && num2 < 20) {
      return { lat: num2, lng: num1 };
    }
    return { lat: num1, lng: num2 };
  }

  private static computePolygonCentroid(points: any[]): { lat: number; lng: number } {
    let sumLat = 0;
    let sumLng = 0;
    let validCount = 0;

    for (const pt of points) {
      if (Array.isArray(pt) && pt.length >= 2) {
        const normalized = this.normalizeLatLng(pt[0], pt[1]);
        sumLat += normalized.lat;
        sumLng += normalized.lng;
        validCount++;
      } else if (pt && typeof pt === "object") {
        const lat = pt.lat || pt.latitude;
        const lng = pt.lng || pt.longitude;
        if (lat !== undefined && lng !== undefined) {
          const normalized = this.normalizeLatLng(lat, lng);
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
}

export default PilotSuggestionService;
