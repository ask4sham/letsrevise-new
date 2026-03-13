/**
 * Step 10: Return the manual Manim render command.
 * Does NOT run Manim. No child_process. Safe manual step only.
 */

const path = require("path");

const OUTPUTS_DIR = path.join(__dirname, "outputs");

/**
 * Get the manual Manim render command for a render package.
 * @param {Object} renderPackage - output of renderManim()
 * @returns {{ ok: boolean, pythonFilePath: string, command: string }}
 */
function getManimRenderCommand(renderPackage) {
  const spec = renderPackage?.renderSpec || {};
  const basename = spec.outputBasename || "lesson-video";
  const filename = `${basename}.py`;
  const pythonFilePath = path.join(OUTPUTS_DIR, filename);
  const command = `manim -pqh "${pythonFilePath}" LessonScene`;
  return { ok: true, pythonFilePath, command };
}

module.exports = getManimRenderCommand;
