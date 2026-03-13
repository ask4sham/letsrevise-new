/**
 * PR-003: Run pgvector migrations in order.
 * Usage: node backend/scripts/runVectorMigrations.js
 */
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const { getVectorDbUrl } = require("../config/vectorDb");

async function run() {
  const pg = require("pg");
  const url = getVectorDbUrl();
  const client = new pg.Client({ connectionString: url });

  try {
    await client.connect();
    const migrationsDir = path.resolve(__dirname, "..", "migrations", "vector");
    if (!fs.existsSync(migrationsDir)) {
      console.log("No migrations directory found:", migrationsDir);
      return;
    }
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
    for (const f of files) {
      const filePath = path.join(migrationsDir, f);
      const sql = fs.readFileSync(filePath, "utf8");
      console.log("Running migration:", f);
      await client.query(sql);
      console.log("  OK");
    }
    console.log("All migrations complete.");
  } finally {
    await client.end();
  }
}

function formatConnectionError(err) {
  const msg = (err?.message || String(err)).toLowerCase();
  let hint = "";
  if (msg.includes("password authentication failed")) {
    hint = "Check VECTOR_DB_URL credentials (user/password).";
  } else if (msg.includes("does not exist") || (msg.includes("database") && msg.includes("exist"))) {
    hint = "Create the database or run: npm run vector:up && npm run vector:migrate";
  } else if (msg.includes("econnrefused") || msg.includes("connection refused")) {
    hint = "Start Postgres: npm run vector:up (Docker) or ensure Postgres is running.";
  } else if (msg.includes("extension") && msg.includes("vector")) {
    hint = "Use pgvector image: docker compose -f docker-compose.vector.yml up -d";
  } else if (msg.includes("pg_hba.conf") || msg.includes("no pg_hba.conf")) {
    hint = "Postgres host auth rejected. Use Docker vector DB: npm run vector:up";
  }
  if (hint) {
    return new Error(err.message + (err.message.endsWith(".") ? " " : ". ") + "Hint: " + hint);
  }
  return err;
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      const formatted = formatConnectionError(err);
      console.error(formatted.message);
      process.exit(1);
    });
}

module.exports = { run };
