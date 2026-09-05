#!/usr/bin/env node
/**
 * Block 28 Phase 2 — read-only dry-run CLI.
 * NO DATABASE WRITES. Local artefacts only (.tmp-phase2-*).
 *
 * Usage:
 *   node backend/scripts/block28Phase2DryRun.js [--sample-proposals=5] [--no-enforce-census]
 */
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1", ...dns.getServers()]);

const fs = require("fs");
const path = require("path");
const { runPhase2DryRun } = require("../services/block28Phase2");
const { connectReadOnlyMongo } = require("../services/block28Phase2/readOnlyDb");

function loadMongoUri() {
  const candidates = [
    path.join(__dirname, "..", ".env"),
    path.join(__dirname, "..", "..", "backend", ".env"),
    path.join("C:", "Users", "ask4s", "Desktop", "dev", "letsrevise-new", "backend", ".env"),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^MONGO(?:DB)?_URI=(.+)$/);
      if (m) return m[1].trim();
    }
  }
  return process.env.MONGODB_URI || process.env.MONGO_URI || null;
}

function parseArgs(argv) {
  const opts = {
    proposalSampleLimit: 0,
    enforceExpectedCensus: true,
    dbName: null,
  };
  for (const arg of argv) {
    if (arg.startsWith("--sample-proposals=")) {
      opts.proposalSampleLimit = parseInt(arg.split("=")[1], 10) || 0;
    }
    if (arg === "--no-enforce-census") opts.enforceExpectedCensus = false;
    if (arg.startsWith("--db=")) opts.dbName = arg.split("=")[1];
  }
  return opts;
}

function dbNameFromUri(uri) {
  try {
    const path = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "http://")).pathname;
    const name = path.replace(/^\//, "").split("?")[0];
    return name || null;
  } catch {
    return null;
  }
}

async function optionalLiveProposalGenerator() {
  try {
    const { callOpenAiJson } = require("../services/lessonAssetLlm");
    const { PROPOSAL_SYSTEM } = require("../services/block28Phase2/proposalRunner");
    return async ({ system, user }) =>
      callOpenAiJson({ system: system || PROPOSAL_SYSTEM, user, temperature: 0.2 });
  } catch {
    return null;
  }
}

(async () => {
  const cliOpts = parseArgs(process.argv.slice(2));
  const uri = loadMongoUri();
  if (!uri) {
    console.error("No MONGODB_URI found. Set env or backend/.env");
    process.exit(1);
  }

  const dbName = cliOpts.dbName || dbNameFromUri(uri) || "letsrevise-b6-sandbox";
  const session = await connectReadOnlyMongo(uri, {
    dbName,
    serverSelectionTimeoutMS: 30000,
  });

  const generateProposal =
    cliOpts.proposalSampleLimit > 0 ? await optionalLiveProposalGenerator() : null;

  if (cliOpts.proposalSampleLimit > 0 && !generateProposal) {
    console.warn("Live AI unavailable — running manifest/classification only.");
    cliOpts.proposalSampleLimit = 0;
  }

  let result;
  try {
    result = await runPhase2DryRun({
      ...session.adapters,
      generateProposal: generateProposal || undefined,
      proposalSampleLimit: cliOpts.proposalSampleLimit,
      enforceExpectedCensus: cliOpts.enforceExpectedCensus,
      artefactDir: path.join(__dirname, "..", ".."),
      writeArtefacts: true,
    });
  } finally {
    await session.disconnect();
  }

  console.log(
    JSON.stringify(
      {
        databaseWritesPerformed: 0,
        census: result.manifest.census,
        censusDrift: result.manifest.censusDrift,
        finalized: result.manifest.finalized,
        classificationCounts: result.dryRunReport.totals.classificationCounts,
        artefacts: result.artefacts,
        mutationPracticeCount: result.mutationGolden?.practiceCount ?? null,
      },
      null,
      2
    )
  );

  if (result.manifest.censusDrift) {
    console.error("CENSUS DRIFT — manifest not finalized against expected baseline.");
    process.exit(2);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
