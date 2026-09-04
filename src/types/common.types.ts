/**
 * ==============================================================================
 * SPATIO-AGRI PRECISION FERTILIZER MANAGEMENT SYSTEM
 * Centralized Common Types & Data Transfer Objects (DTOs)
 * ==============================================================================
 */

/**
 * Standard pagination metadata for offset-paginated API responses
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Standard wrapper for offset-paginated dataset results
 */
export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

/**
 * Standard PageInfo for keyset/cursor-paginated API responses
 */
export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
  count: number;
}
