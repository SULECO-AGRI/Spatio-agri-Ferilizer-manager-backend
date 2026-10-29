import fs from "fs";
import path from "path";
import prisma from "../config/prisma";
import { AppError } from "../utils/AppError";
import { CacheInvalidator } from "../utils/cache";

export interface VraMapData {
  status: "NOT_REQUESTED" | "REQUESTED" | "UPLOADED";
  requestedAt?: string;
  uploadedAt?: string;
  uploadedBy?: number | null;
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  deliveryType?: "FILE" | "LINK";
  adminNotes?: string;
  pilotNote?: string;
}

export function parseNotesHelper(pilotNotes: string | null | undefined): {
  rawNotes?: string;
  startStatus?: string;
  vra?: VraMapData;
  [key: string]: any;
} {
  if (!pilotNotes) return {};
  try {
    const parsed = JSON.parse(pilotNotes);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
  } catch (_) {
    return { rawNotes: pilotNotes, startStatus: pilotNotes };
  }
  return { rawNotes: pilotNotes };
}

export class VraMapService {
  static async requestVraMap(pilotId: number, missionId: number, pilotNote?: string) {
    const mission = await prisma.mission.findUnique({
      where: { missionId },
      include: {
        serviceRequest: true,
      },
    });

    if (!mission) {
      throw AppError.notFound(`Mission #${missionId} not found.`);
    }

    if (mission.serviceRequest.serviceType === "DRONE_MAPPING") {
      throw AppError.badRequest(
        "NDVI to VRA Prescription Map is not required for Drone Mapping missions. It is only required for Fertilizing and Spraying operations."
      );
    }

    if (mission.pilotId && mission.pilotId !== pilotId) {
      throw AppError.forbidden("You are not the assigned pilot for this mission.");
    }

    const currentNotes = parseNotesHelper(mission.pilotNotes);
    currentNotes.vra = {
      status: "REQUESTED",
      requestedAt: new Date().toISOString(),
      pilotNote: pilotNote || "Pilot requested NDVI to VRA Prescription Map",
    };

    await prisma.mission.update({
      where: { missionId },
      data: {
        pilotNotes: JSON.stringify(currentNotes),
      },
    });

    if (mission.pilotId) {
      await CacheInvalidator.invalidatePilot(mission.pilotId);
    }
    await CacheInvalidator.invalidateServiceRequest(mission.requestId);

    return {
      missionId,
      status: "REQUESTED",
      vra: currentNotes.vra,
    };
  }

  static async uploadVraMap(
    missionId: number,
    data: {
      fileName?: string;
      fileType?: string;
      fileData?: string;
      fileUrl?: string;
      deliveryType?: "FILE" | "LINK";
      adminNotes?: string;
    },
    adminUserId?: number
  ) {
    const mission = await prisma.mission.findUnique({
      where: { missionId },
      include: {
        serviceRequest: true,
      },
    });

    if (!mission) {
      throw AppError.notFound(`Mission #${missionId} not found.`);
    }

    let resolvedFileUrl = (data.fileUrl || "").trim();
    let fileSize = 0;

    if (data.fileData && data.fileData.includes(";base64,")) {
      const parts = data.fileData.split(";base64,");
      const base64Data = parts[1];
      const buffer = Buffer.from(base64Data, "base64");
      fileSize = buffer.length;

      const uploadsDir = path.join(process.cwd(), "uploads", "vra");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const safeName = (data.fileName || "prescription_map.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
      const storageFileName = `mission_${missionId}_${Date.now()}_${safeName}`;
      const filePath = path.join(uploadsDir, storageFileName);

      fs.writeFileSync(filePath, buffer);
      resolvedFileUrl = `/uploads/vra/${storageFileName}`;
    } else if (data.fileData && !resolvedFileUrl) {
      resolvedFileUrl = data.fileData.trim();
    }

    if (!resolvedFileUrl) {
      throw AppError.badRequest("Please provide a prescription map file or a valid cloud storage link.");
    }

    // Normalize link URL if entered without protocol (e.g. drive.google.com/...)
    if (
      !resolvedFileUrl.startsWith("/") &&
      !resolvedFileUrl.startsWith("http://") &&
      !resolvedFileUrl.startsWith("https://")
    ) {
      resolvedFileUrl = `https://${resolvedFileUrl}`;
    }

    const isLink = resolvedFileUrl.startsWith("http://") || resolvedFileUrl.startsWith("https://");
    const deliveryType: "FILE" | "LINK" = data.deliveryType || (isLink ? "LINK" : "FILE");

    const currentNotes = parseNotesHelper(mission.pilotNotes);
    currentNotes.vra = {
      status: "UPLOADED",
      requestedAt: currentNotes.vra?.requestedAt || new Date().toISOString(),
      uploadedAt: new Date().toISOString(),
      uploadedBy: adminUserId || null,
      fileName:
        data.fileName?.trim() ||
        (isLink
          ? "Prescription Map Link (External Cloud)"
          : "NDVI_to_VRA_Prescription_Map.pdf"),
      fileUrl: resolvedFileUrl,
      fileSize,
      deliveryType,
      adminNotes: data.adminNotes || "Precision VRA Prescription Map generated by Admin.",
      pilotNote: currentNotes.vra?.pilotNote || "",
    };

    await prisma.mission.update({
      where: { missionId },
      data: {
        pilotNotes: JSON.stringify(currentNotes),
      },
    });

    if (mission.pilotId) {
      await CacheInvalidator.invalidatePilot(mission.pilotId);
    }
    await CacheInvalidator.invalidateServiceRequest(mission.requestId);

    return {
      missionId,
      status: "UPLOADED",
      vra: currentNotes.vra,
    };
  }

  static async getVraMap(missionId: number) {
    const mission = await prisma.mission.findUnique({
      where: { missionId },
      select: {
        missionId: true,
        requestId: true,
        pilotId: true,
        status: true,
        pilotNotes: true,
      },
    });

    if (!mission) {
      throw AppError.notFound(`Mission #${missionId} not found.`);
    }

    const parsed = parseNotesHelper(mission.pilotNotes);
    return {
      missionId,
      status: parsed.vra?.status || "NOT_REQUESTED",
      vra: parsed.vra || null,
    };
  }
}
