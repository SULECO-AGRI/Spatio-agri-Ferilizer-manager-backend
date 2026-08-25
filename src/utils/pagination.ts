import { PaginationMeta } from "../types/farmer.types";

/**
 * Keyset / Cursor Pagination Payload Definition
 */
export interface CursorPayload {
  id: number;
  createdAt: Date | string;
}

/**
 * Standard PageInfo for Keyset/Cursor-paginated APIs
 */
export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
  count: number;
}

/**
 * Encodes an opaque, URL-safe Base64 cursor string
 */
export function encodeCursor(payload: { id: number; createdAt: Date | string }): string {
  const isoDate =
    payload.createdAt instanceof Date
      ? payload.createdAt.toISOString()
      : new Date(payload.createdAt).toISOString();

  const raw = JSON.stringify({
    id: payload.id,
    createdAt: isoDate,
  });

  return Buffer.from(raw, "utf8").toString("base64url");
}

/**
 * Decodes an opaque Base64 cursor string back to id and Date
 */
export function decodeCursor(cursorStr?: string | null): { id: number; createdAt: Date } | null {
  if (!cursorStr || typeof cursorStr !== "string" || cursorStr.trim() === "") {
    return null;
  }

  try {
    const raw = Buffer.from(cursorStr.trim(), "base64url").toString("utf8");
    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed.id === "number" && parsed.createdAt) {
      const date = new Date(parsed.createdAt);
      if (!isNaN(date.getTime())) {
        return {
          id: parsed.id,
          createdAt: date,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Builds standard PageInfo from fetched items and limit
 */
export function buildPageInfo<T extends { requestId: number; createdAt: Date }>(
  items: T[],
  limit: number,
  hasExtraRow: boolean,
  hasPrev = false
): { paginatedItems: T[]; pageInfo: PageInfo } {
  // If we fetched limit + 1 items, the extra row signifies hasNextPage
  const paginatedItems = hasExtraRow ? items.slice(0, limit) : items;

  const startCursor =
    paginatedItems.length > 0
      ? encodeCursor({
          id: paginatedItems[0].requestId,
          createdAt: paginatedItems[0].createdAt,
        })
      : null;

  const endCursor =
    paginatedItems.length > 0
      ? encodeCursor({
          id: paginatedItems[paginatedItems.length - 1].requestId,
          createdAt: paginatedItems[paginatedItems.length - 1].createdAt,
        })
      : null;

  return {
    paginatedItems,
    pageInfo: {
      hasNextPage: hasExtraRow,
      hasPreviousPage: hasPrev,
      startCursor,
      endCursor,
      count: paginatedItems.length,
    },
  };
}

/**
 * Parses and computes skip/take offsets for Prisma queries
 */
export function getPaginationOffsets(
  pageInput?: number | string,
  limitInput?: number | string,
  defaultLimit: number = 10,
  maxLimit: number = 100
): { page: number; limit: number; skip: number; take: number } {
  const page = Math.max(1, Number(pageInput) || 1);
  const limit = Math.max(1, Math.min(maxLimit, Number(limitInput) || defaultLimit));
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
    take: limit,
  };
}

/**
 * Builds standard PaginationMeta object
 */
export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
