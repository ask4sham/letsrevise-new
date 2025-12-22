/**
 * Fix empty lesson_notes in Supabase lessons table
 * Run: node scripts/fix-supabase-lesson-notes.js
 */

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function buildNotesFromTitle(title) {
  const t = String(title || "").toLowerCase();

  if (t.includes("algebra") || t.includes("linear")) {
    return `# Algebra Foundations (Linear Equations)

## What you will learn
- What variables mean
- How to solve linear equations step-by-step

## Worked example
Solve: **2x + 3 = 11**

1) Subtract 3 from both sides  
→ **2x = 8**

2) Divide both sides by 2  
→ **x = 4**

## Practice
1) x + 5 = 12  
2) 3x = 21  
3) 4x - 7 = 9  
`;
  }

  if (t.includes("photosynthesis")) {
    return `# Photosynthesis (GCSE Biology)

## Key idea
Plants use **light energy** to convert **carbon dioxide + water** into **glucose + oxygen**.

## Word equation
**carbon dioxide + water → glucose + oxygen**

## Balanced symbol equation
**6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂**

## Quick check
- Where does the carbon in glucose come from?
- What is chlorophyll used for?
`;
  }

  return `# Lesson Notes

Content coming soon.
`;
}

async function main() {
  console.log("🔧 Fixing empty lesson_notes in Supabase...");

  // Get latest lessons (keep it safe and small)
  const { data: lessons, error: fetchErr } = await supabase
    .from("lessons")
    .select("id,title,lesson_notes")
    .order("created_at", { ascending: false })
    .limit(50);

  if (fetchErr) {
    console.error("❌ Fetch failed:", fetchErr.message);
    process.exit(1);
  }

  const empty = (lessons || []).filter((l) => !String(l.lesson_notes || "").trim());

  if (empty.length === 0) {
    console.log("✅ No lessons with empty lesson_notes found. Nothing to update.");
    process.exit(0);
  }

  console.log(`🧾 Found ${empty.length} lesson(s) with empty lesson_notes. Updating...`);

  for (const l of empty) {
    const notes = buildNotesFromTitle(l.title);

    const { error: updateErr } = await supabase
      .from("lessons")
      .update({ lesson_notes: notes })
      .eq("id", l.id);

    if (updateErr) {
      console.error(`❌ Update failed for ${l.id}:`, updateErr.message);
      process.exit(1);
    }

    console.log(`✅ Updated lesson_notes for: ${l.title || "Untitled"} (${l.id})`);
  }

  console.log("🎉 Done. Refresh the lesson page in the browser.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Script crashed:", err.message);
  process.exit(1);
});
