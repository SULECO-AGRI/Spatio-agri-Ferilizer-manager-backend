import { PaginationMeta } from "../types/farmer.types";

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
