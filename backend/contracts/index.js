// AI Generation Jobs contracts bundle:
// Exports pure data contracts only (no runtime logic), including:
// - Job contract shape and versioning
// - Policy and lifecycle rules
// - Per-type specs for inputs/outputs
// - Canonical error codes and descriptions

const aiGenerationJobContract = require("./aiGenerationJobContract");
const aiGenerationJobPolicy = require("./aiGenerationJobPolicy");
const aiGenerationJobTypeSpecs = require("./aiGenerationJobTypeSpecs");
const aiGenerationJobErrors = require("./aiGenerationJobErrors");

module.exports = {
  aiGenerationJobContract,
  aiGenerationJobPolicy,
  aiGenerationJobTypeSpecs,
  aiGenerationJobErrors,
};


