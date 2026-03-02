// Explicit proxy so /api/* is forwarded to the backend (avoids 404 from default proxy behavior).
const { createProxyMiddleware } = require("http-proxy-middleware");

// Coverage and other heavy reads: allow backend time to respond (avoid 504 from proxy timeout).
const PROXY_TIMEOUT_MS = 90000;

module.exports = function (app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://localhost:5000",
      changeOrigin: true,
      proxyTimeout: PROXY_TIMEOUT_MS,
      // path is preserved: /api/worksheets -> http://localhost:5000/api/worksheets
    })
  );
};
