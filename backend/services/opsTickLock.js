// backend/services/opsTickLock.js — Phase 11 hardening: single-flight across cluster
const OpsTickLock = require("../models/OpsTickLock");
const os = require("os");

const LOCK_ID = "ops-tick-lock";
const DEFAULT_TTL_MS = 5 * 60 * 1000;

let bootUuid = null;
function getBootUuid() {
  if (!bootUuid) bootUuid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return bootUuid;
}

/**
 * Unique, actionable owner string: hostname + pid (or container id) + boot uuid for logs.
 */
function getLockOwner() {
  const host = process.env.HOSTNAME || os.hostname() || "unknown";
  const pid = process.pid;
  const container = process.env.CONTAINER_ID || process.env.KUBERNETES_POD_NAME;
  const id = container ? `${container}` : `pid-${pid}`;
  return `${host}:${id}:${getBootUuid()}`;
}

/**
 * Try to acquire the tick lock. Returns true if we got it, false if another node holds it (or TTL not expired).
 */
async function acquireLock(ttlMs = DEFAULT_TTL_MS) {
  const now = new Date();
  const expiresAt = new Date(Date.now() + ttlMs);
  const owner = process.env.OPS_LOCK_OWNER || getLockOwner();
  const result = await OpsTickLock.findOneAndUpdate(
    {
      _id: LOCK_ID,
      $or: [{ expiresAt: { $lt: now } }, { expiresAt: { $exists: false } }],
    },
    { $set: { owner, expiresAt } },
    { new: true, upsert: true }
  ).lean();
  return result != null && result.owner === owner;
}

/**
 * Release lock early (optional). Lock also expires by TTL.
 */
async function releaseLock() {
  const owner = process.env.OPS_LOCK_OWNER || getLockOwner();
  await OpsTickLock.deleteOne({ _id: LOCK_ID, owner });
}

module.exports = { acquireLock, releaseLock, getLockOwner, LOCK_ID, DEFAULT_TTL_MS };
