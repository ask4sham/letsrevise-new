require("dotenv").config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

(async () => {
  try {
    const res = await fetch(
      `${url}/rest/v1/lessons?select=id&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      }
    );

    console.log("HTTP STATUS:", res.status);
    const text = await res.text();
    console.log("RESPONSE:", text);
  } catch (err) {
    console.error("❌ Fetch error:", err.message);
  }
})();
