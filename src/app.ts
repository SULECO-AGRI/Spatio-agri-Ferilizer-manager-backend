import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import routes from "./routes";
import { globalApiLimiter } from "./middlewares/rateLimiter";
import { requestLogger } from "./middlewares/requestLogger";
import { notFound } from "./middlewares/notFound";
import { errorHandler } from "./middlewares/errorHandler";

const app: Application = express();

// Enable trust proxy so req.ip and X-Forwarded-For headers are properly resolved behind proxies/load balancers
app.set("trust proxy", 1);

// 0. Terminal Request Logger (logs method, URL, status, duration, CACHE HIT/MISS)
app.use(requestLogger);

// 1. Response Compression (gzip / deflate)
app.use(compression());

// 2. Security Headers via Helmet
app.use(helmet());

// 3. Strict Origin-Controlled CORS
const defaultOrigins = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:4173",
];

const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : [];

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile clients, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      // Allow configured origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // In development mode, allow any localhost / 127.0.0.1 origin
      if (
        process.env.NODE_ENV !== "production" &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }

      // Deny CORS access gracefully (avoids throwing 500 internal server error)
      return callback(null, false);
    },
    credentials: true,
  })
);

// 4. Distributed Global API Rate Limiting (Redis-backed)
app.use(globalApiLimiter);

// 4. Body Parsers with payload limits
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// 5. Application Routes
app.use(routes);

// 6. 404 and Error Handling
app.use(notFound);
app.use(errorHandler);

export default app;
