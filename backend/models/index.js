// Models loader:
// - Ensures all core Mongoose models are registered exactly once for the process.
// - Includes the AI Generation Jobs model as structural groundwork only; its
//   registration does not imply any routes, business logic, or execution exists yet.
// Model loader: ensure models are registered once.
require("./Curriculum");
require("./AiGenerationJob");

