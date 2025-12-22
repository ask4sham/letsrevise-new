require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase env vars in backend/.env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function buildNotes(title = "") {
  const t = title.toLowerCase();

  if (t.includes("algebra")) {
    return `# Algebra Foundations (Linear Equations)

## Learning Objectives
- Understand variables
- Solve linear equations step by step

## Example
Solve: **2x + 3 = 11**

1. Subtract 3 from both sides  
   → 2x = 8  
2. Divide by 2  
   → x = 4

## Practice
- x + 5 = 12  
- 3x = 21  
- 4x - 7 = 9
`;
  }

  if (t.includes("photosynthesis")) {
    return `# Photosynthesis (GCSE Biology)

## Key idea
Photosynthesis is the process plants use to make food.

## Word equation
carbon dioxide + water → glucose + oxygen

## Balanced equation
6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂

## Key terms
- Chlorophyll
- Light energy
- Glucose
`;
  }

  return "# Lesson Notes\n\nContent coming soon.";
}

async function run() {
  console.log("🔧 Updating lesson_notes in Supabase...");

  const { data, error } = await supabase
    .from("lessons")
    .select("id,title,lesson_notes")
    .limit(50);

  if (error) {
    console.error("❌ Fetch error:", error.message);
    process.exit(1);
  }

  const emptyLessons = data.filter(
    (l) => !l.lesson_notes || !l.lesson_notes.trim()
  );

  if (emptyLessons.length === 0) {
    console.log("✅ No empty lessons found.");
    process.exit(0);
  }

  for (const lesson of emptyLessons) {
    const notes = buildNotes(lesson.title);

    const { error: updateError } = await supabase
      .from("lessons")
      .update({ lesson_notes: notes })
      .eq("id", lesson.id);

    if (updateError) {
      console.error("❌ Update failed:", updateError.message);
      process.exit(1);
    }

    console.log(`✅ Updated: ${lesson.title}`);
  }

  console.log("🎉 Done. Refresh the lesson page.");
  process.exit(0);
}

run();
