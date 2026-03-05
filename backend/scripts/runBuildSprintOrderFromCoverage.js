/**
 * PR-011: Wrapper for buildSprintOrderFromCoverage.js.
 * Reads npm_config_speckey / specKey and forwards args.
 * In APPLY mode, the inner script prompts for "APPLY <SPEC_KEY>" before writing snapshots.
 */
const { spawnSync } = require("child_process");
const path = require("path");

const args = process.argv.slice(2);
const apply = args.includes("--apply");

function getSpecKey() {
  const idx = args.indexOf("--specKey");
  if (idx !== -1 && args[idx + 1]) return String(args[idx + 1]).trim();
  return process.env.npm_config_speckey || process.env.npm_config_specKey || null;
}
const specKey = getSpecKey();

function parseOpt(flag) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return null;
}

const childArgs = ["--specKey", String(specKey || "").trim()];
if (apply) childArgs.push("--apply");
const windowDays = parseOpt("--windowDays");
if (windowDays) childArgs.push("--windowDays", windowDays);
const useSnapshots = parseOpt("--useSnapshots");
if (useSnapshots) childArgs.push("--useSnapshots", useSnapshots);
const top = parseOpt("--top");
if (top) childArgs.push("--top", top);
const minEnquiries = parseOpt("--minEnquiries");
if (minEnquiries) childArgs.push("--minEnquiries", minEnquiries);
const weights = parseOpt("--weights");
if (weights) childArgs.push("--weights", weights);

if (!specKey || !String(specKey).trim()) {
  console.error("specKey is required. Use: npm run maintenance:sprint-order --specKey=aqa-gcse-biology");
  process.exit(2);
}

const scriptPath = path.join(__dirname, "buildSprintOrderFromCoverage.js");
const result = spawnSync("node", [scriptPath, ...childArgs], {
  stdio: "inherit",
  cwd: path.resolve(__dirname, ".."),
});

process.exit(result.status !== null ? result.status : 1);
