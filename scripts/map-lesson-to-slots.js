#!/usr/bin/env node
/**
 * map-lesson-to-slots.js
 * Maps lesson structure (assembled output) to content slots.
 * Reads lesson from stdin or --lesson path; reads slots from --slots path.
 * Outputs JSON mapping (slotId → matched content) to stdout.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.dirname(__dirname);

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--lesson" && args[i + 1]) { out.lesson = args[i + 1]; i++; }
    else if (args[i] === "--slots" && args[i + 1]) { out.slots = args[i + 1]; i++; }
  }
  return out;
}

function resolvePath(raw) {
  if (!raw) return null;
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function loadJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function main() {
  const opts = parseArgs();
  const slotsPath = resolvePath(opts.slots) || path.join(ROOT, "docs", "curriculum", "engine", "content-slots.contract.json");

  let lesson;
  if (opts.lesson) {
    lesson = loadJson(resolvePath(opts.lesson));
    if (!lesson) {
      console.error("Error: Missing or invalid lesson file: " + opts.lesson);
      process.exit(1);
    }
  } else {
    try {
      const raw = fs.readFileSync(0, "utf8");
      lesson = JSON.parse(raw);
    } catch (e) {
      console.error("Error: Failed to read or parse lesson JSON from stdin.");
      process.exit(1);
    }
  }

  const slotsDoc = loadJson(slotsPath);
  if (!slotsDoc) {
    console.error("Error: Missing or invalid slots file: " + slotsPath);
    process.exit(1);
  }

  const slots = slotsDoc.slots || [];
  const mapping = [];

  for (const slot of slots) {
    const { slotId, kind, sources } = slot;
    let content = null;

    if (kind === "statutory") {
      for (const page of lesson.pages || []) {
        for (const block of page.blocks || []) {
          const blockSources = block.sources || [];
          if (sources.some((s) => blockSources.includes(s))) {
            content = block.content;
            break;
          }
        }
        if (content != null) break;
      }
    } else if (kind === "examBoard") {
      for (const a of lesson.assessments || []) {
        const aSources = a.sources || [];
        if (sources.some((s) => aSources.includes(s))) {
          content = a.prompt;
          break;
        }
      }
    }

    mapping.push({ slotId, kind, content });
  }

  console.log(JSON.stringify(mapping, null, 2));
  process.exit(0);
}

main();
