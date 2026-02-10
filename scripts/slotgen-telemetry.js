const { spawnSync } = require("child_process");

const TELEMETRY_SCHEMA =
  "docs/curriculum/engine/slot-generation-telemetry.v1.schema.json";

function emitTelemetry(fields) {
  const payload = {
    version: "v1",
    ...fields,
  };

  const json = JSON.stringify(payload);

  // Best-effort schema validation; failures should not crash the executor.
  try {
    const res = spawnSync("node", ["scripts/validate-json.js", "-", TELEMETRY_SCHEMA], {
      input: json,
      encoding: "utf8",
    });
    if (res.status !== 0) {
      // Emit validator error but keep going.
      if (res.stderr) {
        process.stderr.write(`TELEMETRY_SCHEMA_ERROR ${res.stderr}\n`);
      }
    }
  } catch (err) {
    // Swallow validation failures; telemetry must not break main path.
    process.stderr.write(
      `TELEMETRY_RUNTIME_ERROR ${err && err.message ? err.message : String(err)}\n`
    );
  }

  // Always emit telemetry JSON as a single line to stderr.
  process.stderr.write(`${json}\n`);
}

module.exports = {
  emitTelemetry,
};

