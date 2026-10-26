import { Request, Response, NextFunction } from "express";
import { VraMapService } from "../services/vra-map.service";

export class VraMapController {
  static async requestVraMap(req: Request, res: Response, next: NextFunction) {
    try {
      const pilotId = Number(req.params.id || (req as any).user?.userId);
      const missionId = Number(req.params.missionId);
      const { notes } = req.body || {};

      const result = await VraMapService.requestVraMap(pilotId, missionId, notes);
      return res.status(200).json({
        status: "success",
        message: "NDVI to VRA Prescription Map requested successfully from Admin.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async uploadVraMap(req: Request, res: Response, next: NextFunction) {
    try {
      const missionId = Number(req.params.missionId);
      const adminUserId = (req as any).user?.userId;
      const { fileName, fileType, fileData, fileUrl, adminNotes } = req.body || {};

      const result = await VraMapService.uploadVraMap(
        missionId,
        { fileName, fileType, fileData, fileUrl, adminNotes },
        adminUserId
      );

      return res.status(200).json({
        status: "success",
        message: "NDVI to VRA Prescription Map uploaded and delivered to Pilot successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getVraMap(req: Request, res: Response, next: NextFunction) {
    try {
      const missionId = Number(req.params.missionId);
      const result = await VraMapService.getVraMap(missionId);
      return res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
