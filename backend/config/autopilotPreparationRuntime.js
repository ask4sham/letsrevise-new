/**
 * Autopilot Preparation Programme — P1.2 runtime persistence gate.
 * Narrow default-OFF semantics for durable record writes only.
 */

function readStrictEnabledEnv(name) {
  const value = process.env[name];
  if (value === "1" || value === "true") {
    return true;
  }
  return false;
}

function isPreparationRecordPersistenceEnabled() {
  return readStrictEnabledEnv("AUTOPILOT_LEARNING_PREPARATION_RECORD_PERSISTENCE_ENABLED");
}

module.exports = {
  readStrictEnabledEnv,
  isPreparationRecordPersistenceEnabled,
};
