const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

let supabaseAdmin = null;
if (supabaseUrl && serviceKey) {
  supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
} else {
  console.warn(
    "⚠️ Supabase not configured — missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
}

module.exports = { supabaseAdmin };
