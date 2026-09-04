/**
 * ==============================================================================
 * SPATIO-AGRI PRECISION FERTILIZER MANAGEMENT SYSTEM
 * Centralized Date & Time Utility Functions
 * ==============================================================================
 */

/**
 * Returns the start (00:00:00.000) and end (23:59:59.999) timestamps for today
 */
export function getTodayBounds(): { startOfDay: Date; endOfDay: Date } {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return { startOfDay, endOfDay };
}

/**
 * Returns key date range boundaries for analytics (today, this month, last month)
 */
export function getDateRanges(): {
  startOfToday: Date;
  startOfThisMonth: Date;
  startOfLastMonth: Date;
  endOfLastMonth: Date;
} {
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  return {
    startOfToday,
    startOfThisMonth,
    startOfLastMonth,
    endOfLastMonth,
  };
}
