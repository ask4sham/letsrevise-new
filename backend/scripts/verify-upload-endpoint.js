#!/usr/bin/env node
/**
 * Verify which upload backend is running.
 * Run: node backend/scripts/verify-upload-endpoint.js
 *
 * If you see version: "upload-fix-v2" → NEW code (video supported)
 * If you get 404 or different response → old/different backend
 */
const http = require("http");

const BASE = process.env.API_BASE || "http://localhost:5000";

function get(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const req = http.request(url, { method: "GET" }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
    req.end();
  });
}

async function main() {
  console.log("Checking backend at", BASE, "\n");

  try {
    const v = await get("/api/uploads/version");
    console.log("GET /api/uploads/version:", v.status, JSON.stringify(v.body, null, 2));
    if (v.body?.version === "upload-fix-v2") {
      console.log("\n✅ NEW backend is running. Video uploads should work.");
    } else {
      console.log("\n⚠️  Unexpected response. You may be hitting an old backend.");
    }
  } catch (e) {
    console.error("❌ Request failed:", e.message);
    console.log("\nIs the backend running? Try: cd backend && npm start");
  }
}

main();
