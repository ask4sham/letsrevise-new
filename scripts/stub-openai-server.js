#!/usr/bin/env node
const http = require("http");
const port = Number(process.env.SLOTGEN_STUB_PORT || "3100");
const host = "127.0.0.1";

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const now = new Date().toISOString();
    const content = JSON.stringify({
      version: "v1",
      jobId: "J1",
      status: "COMPLETED",
      generatedAt: now,
      output: null
    });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ choices: [{ message: { content } }] }));
  });
});

server.listen(port, host, () => {
  process.stderr.write(`Stub server listening on ${host}:${port}\n`);
});
