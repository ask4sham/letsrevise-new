require("dotenv").config();
const { supabaseAdmin } = require("../routes/supabaseAdmin");

const BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "lesson-media";
const NEEDLE = (process.argv[2] || "nervous|newrvious|reflex|neurone").split("|");

function matches(name) {
  const n = (name || "").toLowerCase();
  return NEEDLE.some((k) => n.includes(k.toLowerCase()));
}

async function walk(prefix = "", depth = 0) {
  if (depth > 6) return;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) {
    console.error("list error", prefix, error.message);
    return;
  }
  for (const item of data || []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id == null) {
      await walk(path, depth + 1);
      continue;
    }
    if (matches(item.name) || matches(path)) {
      const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
      console.log(JSON.stringify({ path, publicUrl: pub?.publicUrl }));
    }
  }
}

async function main() {
  await walk("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
