import { Request, Response, NextFunction } from "express";

/**
 * Clean HTTP Request Logger middleware for Terminal Output
 * Displays incoming endpoint, status, latency, and Cache Status (HIT / MISS / BYPASS).
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const cacheHeader = res.getHeader("X-Cache") as string | undefined;

    let cacheTag = "";
    if (cacheHeader === "HIT") {
      cacheTag = "\x1b[32m[CACHE HIT ⚡]\x1b[0m";
    } else if (cacheHeader === "MISS") {
      cacheTag = "\x1b[33m[CACHE MISS 🗄️]\x1b[0m";
    } else if (cacheHeader === "BYPASS") {
      cacheTag = "\x1b[36m[DB DIRECT]\x1b[0m";
    }

    let statusColor = "\x1b[32m"; // Green
    if (res.statusCode >= 500) {
      statusColor = "\x1b[31m"; // Red
    } else if (res.statusCode >= 400) {
      statusColor = "\x1b[33m"; // Yellow
    } else if (res.statusCode >= 300) {
      statusColor = "\x1b[36m"; // Cyan
    }

    const methodColor = "\x1b[1m\x1b[35m"; // Bold Magenta
    const resetColor = "\x1b[0m";
    const timeColor = "\x1b[90m"; // Gray

    const timeString = new Date().toLocaleTimeString();

    console.log(
      `${timeColor}[${timeString}]${resetColor} ${methodColor}${req.method}${resetColor} ${req.originalUrl || req.url} ${statusColor}${res.statusCode}${resetColor} ${timeColor}(${duration}ms)${resetColor} ${cacheTag}`
    );
  });

  next();
}
