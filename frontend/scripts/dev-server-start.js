/**
 * Avoid CRA's interactive "port in use" prompt (often invisible / stuck in VS Code terminal).
 * Picks a free port from PORT or 3000, sets env, then runs react-scripts start.
 *
 * Port 3001 is never used here: it is reserved for LetsRevise Lesson Generator (Next.js, `npm run dev` / `-p 3001`).
 * This app targets http://localhost:3000/ (hash routes use # as usual).
 */
"use strict";

const path = require("path");
const { spawn } = require("child_process");

const appRoot = path.join(__dirname, "..");
const detect = require("detect-port-alt");

/** LetsRevise Lesson Generator — always 3001 in that repo; never steal it from here. */
const SKIP_PORTS = new Set([3001]);

const host = process.env.HOST || "0.0.0.0";
const rawEnvPort = process.env.PORT;
const defaultPort = 3000;
let want =
  rawEnvPort !== undefined && String(rawEnvPort).trim() !== ""
    ? parseInt(String(rawEnvPort), 10)
    : defaultPort;
if (!Number.isFinite(want)) {
  want = defaultPort;
}
while (SKIP_PORTS.has(want)) {
  want++;
}

/**
 * When `preferred` is busy, detect-port-alt returns the next free port (often 3001).
 * Skip 3001 and continue until we find a port that is both free and allowed.
 */
async function pickUsablePort(startPort, maxPort) {
  let p = startPort;
  while (p < maxPort) {
    if (SKIP_PORTS.has(p)) {
      p++;
      continue;
    }
    const d = await detect(p, host);
    if (d === p) {
      return p;
    }
    p = d;
  }
  throw new Error(
    `No free dev server port found below ${maxPort}. Free port 3000 or set PORT=3002 (3001 is reserved for Lesson Generator).`
  );
}

pickUsablePort(want, 3100)
  .then((available) => {
    if (available !== want) {
      // eslint-disable-next-line no-console
      console.log(
        `\n\x1b[36mNote:\x1b[0m Port ${want} is in use; starting on \x1b[1m${available}\x1b[0m instead (3001 reserved for Lesson Generator).\n`
      );
    }
    const env = { ...process.env, PORT: String(available) };
    const startScript = require.resolve("react-scripts/scripts/start.js", { paths: [appRoot] });
    const child = spawn(process.execPath, [startScript], {
      cwd: appRoot,
      env,
      stdio: "inherit",
    });
    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exit(code === null ? 1 : code);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
