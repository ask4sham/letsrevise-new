/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CONTENT_ROOT = path.join(ROOT, "static-site", "content");

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function readDirDirsOnly(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

function safeReadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeFileIfMissing(filePath, content) {
  if (exists(filePath)) return false;
  fs.writeFileSync(filePath, content, "utf8");
  return true;
}

function toTitle(name) {
  // keep original casing but make it nicer for display
  return String(name).replace(/[-_]/g, " ").trim();
}

function htmlShell(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body{font-family:Segoe UI,Tahoma,Arial,sans-serif;margin:0;background:#f5f7fa;color:#111}
    .wrap{max-width:1100px;margin:0 auto;padding:24px}
    .top{background:linear-gradient(90deg,#2c3e50,#3498db);color:#fff;border-radius:16px;padding:22px 18px}
    .top h1{margin:0;font-size:28px}
    .top p{margin:8px 0 0;opacity:.9}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:18px}
    a.card{display:block;text-decoration:none;color:inherit;background:#fff;border-radius:14px;padding:16px;box-shadow:0 10px 25px rgba(0,0,0,.07);transition:.2s}
    a.card:hover{transform:translateY(-3px)}
    .badge{display:inline-block;font-size:12px;padding:4px 10px;border-radius:999px;background:#eef6ff;color:#246}
    .muted{color:#566; font-size:14px}
    .back{display:inline-block;margin-top:14px;color:#fff;background:rgba(255,255,255,.18);padding:8px 12px;border-radius:999px;text-decoration:none}
    .lesson{background:#fff;border-radius:16px;padding:18px;margin-top:18px;box-shadow:0 10px 25px rgba(0,0,0,.07)}
    .lesson h2{margin:0 0 12px}
    .md{line-height:1.65}
    .md img{max-width:100%}
    .footer{margin:22px 0 0;color:#667;font-size:13px}
    code, pre{background:#f3f5f7;border-radius:10px}
    pre{padding:12px;overflow:auto}
  </style>
</head>
<body>
  <div class="wrap">
    ${body}
    <div class="footer">LetsRevise • Auto-generated navigation</div>
  </div>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// --- Templates ---

function navIndexHtml(title, subtitle, items, backHref) {
  const cards = items
    .map(
      (it) => `<a class="card" href="${it.href}">
  <div class="badge">${escapeHtml(it.badge || "Open")}</div>
  <h3 style="margin:10px 0 6px">${escapeHtml(it.title)}</h3>
  <div class="muted">${escapeHtml(it.desc || "")}</div>
</a>`
    )
    .join("\n");

  const body = `
<div class="top">
  <h1>${escapeHtml(title)}</h1>
  ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
  ${backHref ? `<a class="back" href="${backHref}">← Back</a>` : ""}
</div>
<div class="grid">${cards || `<div class="muted">No items found yet.</div>`}</div>
`;

  return htmlShell(title, body);
}

// Topic page: renders revision_notes.md in-browser (no build step)
function topicLessonHtml(title) {
  const body = `
<div class="top">
  <h1>${escapeHtml(title)}</h1>
  <p>Lesson notes (rendered from revision_notes.md)</p>
  <a class="back" href="../">← Back</a>
</div>

<div class="lesson">
  <h2>Revision Notes</h2>
  <div id="out" class="md">Loading…</div>
</div>

<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script>
(async function () {
  const out = document.getElementById("out");
  const candidates = ["revision_notes.md", "revision_notes.MD"];
  for (const f of candidates) {
    try {
      const res = await fetch(f, { cache: "no-store" });
      if (!res.ok) continue;
      const md = await res.text();
      out.innerHTML = marked.parse(md);
      return;
    } catch (e) {}
  }
  out.innerHTML = "<p><b>Missing:</b> revision_notes.md</p>";
})();
</script>
`;
  return htmlShell(title, body);
}

// topics.json list page
function topicsListHtml(title, topics, backHref) {
  const items = topics.map((t) => ({
    title: t,
    href: `${encodeURIComponent(t)}/`,
    badge: "Topic",
    desc: "Open lesson",
  }));
  return navIndexHtml(title, "Choose a topic", items, backHref);
}

// --- Walker / generator ---

function walk(dir) {
  const entries = readDirDirsOnly(dir);
  const indexPath = path.join(dir, "index.html");

  const hasRevisionMd = exists(path.join(dir, "revision_notes.md")) || exists(path.join(dir, "revision_notes.MD"));
  const topicsJsonPath = path.join(dir, "topics.json");
  const hasTopicsJson = exists(topicsJsonPath);

  // 1) Topic lesson folder (revision_notes.md) => create index.html (lesson renderer)
  if (hasRevisionMd) {
    const title = toTitle(path.basename(dir));
    const created = writeFileIfMissing(indexPath, topicLessonHtml(title));
    if (created) console.log("✅ Created lesson index:", indexPath);
  }

  // 2) topics.json folder => create index.html listing topics
  if (hasTopicsJson) {
    const json = safeReadJson(topicsJsonPath);
    let topics = [];

    // support common shapes:
    // - ["Cell structure", "Photosynthesis"]
    // - { "topics": ["x","y"] }
    // - { "items": [{ "title": "x"}] }
    if (Array.isArray(json)) topics = json.map(String);
    else if (json && Array.isArray(json.topics)) topics = json.topics.map(String);
    else if (json && Array.isArray(json.items)) topics = json.items.map((x) => String(x.title || x.name || x.topic || "")).filter(Boolean);

    // fallback: if json shape unknown, list subfolders instead
    if (!topics.length) {
      topics = entries;
    }

    const title = `${toTitle(path.basename(dir))} – Topics`;
    const created = writeFileIfMissing(indexPath, topicsListHtml(title, topics, "../"));
    if (created) console.log("✅ Created topics index:", indexPath);
  }

  // 3) Navigation folder (has subfolders) and no index.html => create navigation index
  if (!exists(indexPath) && entries.length) {
    const title = toTitle(path.basename(dir));
    const items = entries.map((name) => ({
      title: toTitle(name),
      href: `${encodeURIComponent(name)}/`,
      badge: "Open",
      desc: "Browse",
    }));

    // back link: best effort (parent exists)
    const backHref = "../";
    const created = writeFileIfMissing(indexPath, navIndexHtml(title, "Choose an option", items, backHref));
    if (created) console.log("✅ Created nav index:", indexPath);
  }

  // recurse
  for (const child of entries) {
    walk(path.join(dir, child));
  }
}

function main() {
  if (!exists(CONTENT_ROOT)) {
    console.error("❌ Content root not found:", CONTENT_ROOT);
    process.exit(1);
  }
  console.log("🔎 Generating indexes under:", CONTENT_ROOT);
  walk(CONTENT_ROOT);
  console.log("✅ Done.");
}

main();
