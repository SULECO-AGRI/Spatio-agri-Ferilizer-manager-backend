import prisma from "../config/prisma";

export interface LogActivityParams {
  userId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  details: string;
}

/**
 * Enterprise Audit Trail Logger
 * Asynchronously writes persistent audit log entries to the database.
 * Never throws or blocks main workflow execution if logging fails.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ? String(params.entityId) : null,
        details: params.details,
      },
    });
  } catch (error) {
    // Non-blocking catch to ensure core operational mutations are never interrupted
    console.error("⚠️ Failed to write activity audit log:", error);
  }
}
