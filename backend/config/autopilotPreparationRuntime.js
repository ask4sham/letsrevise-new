/**
 * Autopilot Preparation Programme — P1.2/P1.3 runtime gates.
 * Narrow default-OFF semantics for durable record writes and reads.
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

function isPreparationRecordRetrievalEnabled() {
  return readStrictEnabledEnv("AUTOPILOT_LEARNING_PREPARATION_RECORD_RETRIEVAL_ENABLED");
}

module.exports = {
  readStrictEnabledEnv,
  isPreparationRecordPersistenceEnabled,
  isPreparationRecordRetrievalEnabled,
};
