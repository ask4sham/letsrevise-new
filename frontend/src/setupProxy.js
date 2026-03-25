// Explicit proxy so /api/* and /uploads/* are forwarded to the backend.
const { createProxyMiddleware } = require("http-proxy-middleware");

// AI generate-and-save (two OpenAI passes + save) and other heavy API calls — avoid proxy cutting the connection early.
const PROXY_TIMEOUT_MS = 600000;
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
