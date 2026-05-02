/**
 * Rasterise mitosis sequence SVGs to 800×800 PNGs (LetsRevise public assets).
 * Requires: npm install sharp --save-dev
 */
const fs = require("fs");
const path = require("path");

async function main() {
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    console.error("Install sharp: cd frontend && npm install sharp --save-dev");
    process.exit(1);
  }

  const dir = path.join(__dirname, "../public/visuals/biology/mitosis");
  const svgFiles = [
    "step1-dna-replication.svg",
    "step2-prophase.svg",
    "step3-metaphase.svg",
    "step4-anaphase.svg",
    "step5-telophase.svg",
    "step6-cytokinesis.svg",
  ];

  for (const svgName of svgFiles) {
    const svgPath = path.join(dir, svgName);
    if (!fs.existsSync(svgPath)) {
      console.warn("Missing:", svgPath);
      continue;
    }
    const buf = fs.readFileSync(svgPath);
    const pngName = svgName.replace(/\.svg$/i, ".png");
    const outPath = path.join(dir, pngName);
    await sharp(buf).resize(800, 800).png().toFile(outPath);
    console.log("Wrote", path.relative(process.cwd(), outPath));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
