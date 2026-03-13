// Explicit proxy so /api/* and /uploads/* are forwarded to the backend.
const { createProxyMiddleware } = require("http-proxy-middleware");

// Coverage and other heavy reads: allow backend time to respond (avoid 504 from proxy timeout).
const PROXY_TIMEOUT_MS = 90000;
const BACKEND = "http://localhost:5000";

module.exports = function (app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target: BACKEND,
      changeOrigin: true,
      proxyTimeout: PROXY_TIMEOUT_MS,
    })
  );
  // Uploads: backend serves at /uploads so <img src="/uploads/..." /> works in dev
  app.use(
    "/uploads",
    createProxyMiddleware({
      target: BACKEND,
      changeOrigin: true,
    })
  );
  // Visuals: backend serves at /visuals (e.g. magnification.mp4 for Microscopy hero)
  app.use(
    "/visuals",
    createProxyMiddleware({
      target: BACKEND,
      changeOrigin: true,
    })
  );
  // Content: backend serves static-site at /content
  app.use(
    "/content",
    createProxyMiddleware({
      target: BACKEND,
      changeOrigin: true,
    })
  );
};
