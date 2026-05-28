/**
 * CORS configuration — single source of truth for backend.
 * Used by app.js (runs first for all requests).
 *
 * Production: ONLY uses CORS_ORIGIN or FRONTEND_URL from env. No localhost.
 * Production detection: NODE_ENV=production OR RENDER=true (Render sets this).
 * Development: allows localhost + production origins.
 */
const cors = require("cors");

const LOCALHOST_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:4173",
];

// Fallback when CORS_ORIGIN/FRONTEND_URL not set. Use CORS_FALLBACK_ORIGIN env for custom domain.
const PRODUCTION_FRONTEND =
  process.env.CORS_FALLBACK_ORIGIN || "https://letsrevise.com";

// Netlify preview/production URLs — allow so uploads work when frontend hits Render directly
const NETLIFY_ORIGINS = [
  "https://profound-gumdrop-4c8d83.netlify.app",
  "https://letsrevise.netlify.app",
];

function isProduction() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.RENDER === "true"
  );
}

function getAllowedOrigins() {
  const prod = isProduction();
  const fromEnv = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  if (prod) {
    // Production: env vars + Netlify URLs + fallback. No localhost.
    const origins = [
      PRODUCTION_FRONTEND,
      ...NETLIFY_ORIGINS,
      ...fromEnv,
    ].filter(Boolean);
    return [...new Set(origins)];
  }

  // Development: localhost + production origins
  const origins = [...LOCALHOST_ORIGINS, PRODUCTION_FRONTEND, ...fromEnv];
  return [...new Set(origins)];
}

function getCorsOptions() {
  const allowedOrigins = getAllowedOrigins();
  const prod = isProduction();

  if (prod && allowedOrigins.length === 0) {
    console.error("[CORS] Production: CORS_ORIGIN or FRONTEND_URL must be set on Render.");
  }

  const originCallback = (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, origin);
    // Dev: CRA may use 3002+ when 3000 is busy; allow any local port if API_BASE points at :5000
    if (
      !prod &&
      (/^http:\/\/localhost:\d+$/i.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/i.test(origin))
    ) {
      return callback(null, origin);
    }
    console.log("❌ CORS blocked origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  };

  return {
    origin: originCallback,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Auth-Token", "Accept", "Accept-Language"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };
}

function logCorsConfigAtStartup() {
  const origins = getAllowedOrigins();
  const prod = isProduction();

  console.log("[CORS] Resolved config at startup:");
  console.log("  isProduction:", prod);
  console.log("  allowedOrigins:", origins.join(", ") || "(none)");
  console.log("  CORS_ORIGIN:", process.env.CORS_ORIGIN || "(not set)");
  console.log("  FRONTEND_URL:", process.env.FRONTEND_URL || "(not set)");
}

// Compute options per request to avoid any caching of env vars
function corsMiddleware(req, res, next) {
  return cors(getCorsOptions())(req, res, next);
}

module.exports = {
  getCorsOptions,
  cors,
  corsMiddleware,
  logCorsConfigAtStartup,
};
