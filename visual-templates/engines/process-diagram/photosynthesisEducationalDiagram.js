const { escapeXml } = require("../shared/escapeXml");
const { renderBrandedFrame } = require("../shared/brandedFrame");

const CONTENT_TOP = 200;
const BODY_LEFT = 80;
const BODY_W = 1240;
const BODY_H = 520;

/** Shared label style — large GCSE-readable captions on diagrams. */
function label(brand, x, y, text, { size = 22, anchor = "start", fill, weight = "800" } = {}) {
  const { typography, colors } = brand;
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${typography.fontFamily}" font-size="${size}" font-weight="${weight}" fill="${fill || colors.ink}">${escapeXml(text)}</text>`;
}

function arrowPath(x1, y1, x2, y2, color, width = 5) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const ax = x2 - ux * 14;
  const ay = y2 - uy * 14;
  const px = -uy * 8;
  const py = ux * 8;
  return `
  <g>
    <line x1="${x1}" y1="${y1}" x2="${ax}" y2="${ay}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>
    <polygon points="${x2},${y2} ${ax + px},${ay + py} ${ax - px},${ay - py}" fill="${color}"/>
  </g>`;
}

function sunIcon(cx, cy, r, color) {
  const rays = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    rays.push(
      `<line x1="${cx + Math.cos(a) * (r + 6)}" y1="${cy + Math.sin(a) * (r + 6)}" x2="${cx + Math.cos(a) * (r + 28)}" y2="${cy + Math.sin(a) * (r + 28)}" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`
    );
  }
  return `
  <g>
    ${rays.join("")}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#FDE047" stroke="${color}" stroke-width="3"/>
  </g>`;
}

/** Cross-section leaf with palisade layer and chloroplast hints. */
function leafCrossSection(brand, cx, cy) {
  const { colors } = brand;
  return `
  <g id="leaf-cross-section">
    <ellipse cx="${cx}" cy="${cy}" rx="220" ry="130" fill="#DCFCE7" stroke="#15803D" stroke-width="5"/>
    <path d="M ${cx - 180} ${cy} Q ${cx} ${cy - 95} ${cx + 180} ${cy}" fill="none" stroke="#166534" stroke-width="3"/>
    <rect x="${cx - 160}" y="${cy - 55}" width="320" height="70" rx="8" fill="#BBF7D0" stroke="#16A34A" stroke-width="2"/>
    ${[0, 1, 2, 3, 4].map((i) => {
      const ox = cx - 120 + i * 60;
      return `<ellipse cx="${ox}" cy="${cy - 18}" rx="18" ry="28" fill="#4ADE80" stroke="#15803D" stroke-width="2" opacity="0.9"/>`;
    }).join("")}
    <text x="${cx}" y="${cy + 78}" text-anchor="middle" font-family="${brand.typography.fontFamily}" font-size="18" font-weight="700" fill="${colors.inkMuted}">Leaf cross-section (palisade mesophyll)</text>
  </g>`;
}

function chloroplastIcon(cx, cy, scale = 1) {
  const s = scale;
  return `
  <g transform="translate(${cx},${cy}) scale(${s})">
    <ellipse cx="0" cy="0" rx="52" ry="32" fill="#86EFAC" stroke="#166534" stroke-width="3"/>
    <path d="M -30 0 Q 0 -22 30 0 Q 0 22 -30 0" fill="#22C55E" opacity="0.85"/>
    <text x="0" y="48" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="800" fill="#14532D">Chloroplast</text>
  </g>`;
}

function renderPhotosynthesisOverview(brand, processData) {
  const { colors } = brand;
  const cx = BODY_LEFT + BODY_W / 2;
  const cy = CONTENT_TOP + BODY_H / 2 - 20;

  const body = `
  ${sunIcon(BODY_LEFT + 120, CONTENT_TOP + 100, 36, "#CA8A04")}
  ${label(brand, BODY_LEFT + 120, CONTENT_TOP + 175, "SUNLIGHT", { size: 20, anchor: "middle", fill: "#A16207" })}
  ${arrowPath(BODY_LEFT + 200, CONTENT_TOP + 130, cx - 200, cy - 60, "#EAB308", 6)}

  ${label(brand, BODY_LEFT + 40, cy - 20, "CO₂", { size: 26, fill: "#1D4ED8" })}
  ${label(brand, BODY_LEFT + 40, cy + 12, "from air", { size: 18, fill: colors.inkMuted })}
  ${arrowPath(BODY_LEFT + 110, cy, cx - 230, cy, "#2563EB", 5)}

  ${label(brand, BODY_LEFT + 40, cy + 120, "H₂O", { size: 26, fill: "#0369A1" })}
  ${label(brand, BODY_LEFT + 40, cy + 152, "via xylem", { size: 18, fill: colors.inkMuted })}
  ${arrowPath(BODY_LEFT + 120, cy + 130, cx - 180, cy + 80, "#0284C7", 5)}

  ${leafCrossSection(brand, cx, cy)}

  ${label(brand, BODY_LEFT + BODY_W - 50, cy - 40, "GLUCOSE", { size: 24, anchor: "end", fill: "#7C3AED" })}
  ${label(brand, BODY_LEFT + BODY_W - 50, cy - 10, "stored / used", { size: 18, anchor: "end", fill: colors.inkMuted })}
  <rect x="${BODY_LEFT + BODY_W - 200}" y="${cy - 70}" width="120" height="70" rx="12" fill="#EDE9FE" stroke="#7C3AED" stroke-width="3"/>
  ${label(brand, BODY_LEFT + BODY_W - 140, cy - 28, "C₆H₁₂O₆", { size: 22, anchor: "middle", fill: "#5B21B6" })}
  ${arrowPath(cx + 200, cy, BODY_LEFT + BODY_W - 210, cy - 35, "#7C3AED", 5)}

  ${label(brand, BODY_LEFT + BODY_W - 50, cy + 100, "O₂", { size: 28, anchor: "end", fill: "#DC2626" })}
  ${label(brand, BODY_LEFT + BODY_W - 50, cy + 132, "released", { size: 18, anchor: "end", fill: colors.inkMuted })}
  ${arrowPath(cx + 160, cy + 70, BODY_LEFT + BODY_W - 120, cy + 90, "#EF4444", 5)}

  <rect x="${cx - 90}" y="${cy - 95}" width="180" height="44" rx="10" fill="#FEF9C3" stroke="#CA8A04" stroke-width="2"/>
  ${label(brand, cx, cy - 68, "Chlorophyll absorbs light", { size: 17, anchor: "middle", fill: "#854D0E" })}

  <rect x="${BODY_LEFT + 24}" y="${CONTENT_TOP + BODY_H - 36}" width="${BODY_W - 48}" height="32" rx="8" fill="#F5F3FF" stroke="${colors.accentBorder}" stroke-width="2"/>
  ${label(brand, cx, CONTENT_TOP + BODY_H - 14, "6CO₂ + 6H₂O  →  C₆H₁₂O₆ + 6O₂   (endothermic — energy in from light)", { size: 18, anchor: "middle", fill: colors.accent })}
  `;

  return renderBrandedFrame(brand, {
    title: processData.title,
    subtitle: processData.subtitle,
    examBoardLabel: processData.examBoardLabel,
    bodyContent: body,
  });
}

function renderStepLightAbsorption(brand) {
  const cx = BODY_LEFT + BODY_W / 2;
  const cy = CONTENT_TOP + BODY_H / 2;
  const body = `
  ${sunIcon(cx - 280, cy - 80, 48, "#CA8A04")}
  ${label(brand, cx - 280, cy + 10, "Light energy", { size: 24, anchor: "middle", fill: "#A16207" })}
  ${arrowPath(cx - 200, cy - 40, cx - 60, cy - 20, "#EAB308", 6)}
  ${chloroplastIcon(cx + 40, cy, 1.4)}
  ${label(brand, cx + 40, cy + 100, "Chlorophyll in chloroplasts absorbs light for photosynthesis.", { size: 20, anchor: "middle", fill: brand.colors.inkMuted })}
  <rect x="${BODY_LEFT + 40}" y="${CONTENT_TOP + BODY_H - 50}" width="${BODY_W - 80}" height="40" rx="8" fill="#F0FDF4" stroke="#16A34A" stroke-width="2"/>
  ${label(brand, cx, CONTENT_TOP + BODY_H - 24, "Step 1 — Light is the energy source (endothermic reaction)", { size: 18, anchor: "middle", fill: "#166534" })}
  `;
  return body;
}

function renderStepCarbonDioxideWater(brand) {
  const cx = BODY_LEFT + BODY_W / 2;
  const cy = CONTENT_TOP + BODY_H / 2;
  const body = `
  ${leafCrossSection(brand, cx - 120, cy)}
  ${label(brand, BODY_LEFT + 60, cy - 30, "CO₂", { size: 28, fill: "#1D4ED8" })}
  ${arrowPath(BODY_LEFT + 130, cy - 10, cx - 280, cy, "#2563EB", 5)}
  <ellipse cx="${cx - 300}" cy="${cy + 30}" rx="28" ry="18" fill="#DBEAFE" stroke="#2563EB" stroke-width="2"/>
  ${label(brand, cx - 300, cy + 36, "Stomata", { size: 14, anchor: "middle", fill: "#1E40AF" })}

  ${label(brand, BODY_LEFT + 60, cy + 90, "H₂O", { size: 28, fill: "#0369A1" })}
  <rect x="${BODY_LEFT + 130}" y="${cy + 60}" width="14" height="100" fill="#7DD3FC" stroke="#0284C7" stroke-width="2"/>
  ${label(brand, BODY_LEFT + 155, cy + 120, "Xylem", { size: 18, fill: "#0C4A6E" })}
  ${arrowPath(BODY_LEFT + 145, cy + 100, cx - 200, cy + 70, "#0284C7", 5)}

  ${label(brand, cx + 120, cy + 100, "Reactants enter the leaf for the reaction.", { size: 20, anchor: "middle", fill: brand.colors.inkMuted })}
  `;
  return body;
}

function renderStepGlucoseProduction(brand) {
  const cx = BODY_LEFT + BODY_W / 2;
  const cy = CONTENT_TOP + BODY_H / 2;
  const body = `
  ${chloroplastIcon(cx - 80, cy - 20, 1.6)}
  ${arrowPath(cx - 10, cy - 30, cx + 120, cy - 40, "#7C3AED", 5)}
  <rect x="${cx + 60}" y="${cy - 70}" width="140" height="90" rx="14" fill="#EDE9FE" stroke="#7C3AED" stroke-width="4"/>
  ${label(brand, cx + 130, cy - 18, "GLUCOSE", { size: 24, anchor: "middle", fill: "#5B21B6" })}
  ${label(brand, cx + 130, cy + 10, "C₆H₁₂O₆", { size: 20, anchor: "middle", fill: "#6D28D9" })}
  ${label(brand, cx + 130, cy + 55, "Chemical energy stored in glucose", { size: 18, anchor: "middle", fill: brand.colors.inkMuted })}
  ${label(brand, cx, cy + 120, "Light energy drives reactions in chloroplasts to build glucose.", { size: 20, anchor: "middle", fill: brand.colors.inkMuted })}
  `;
  return body;
}

function renderStepOxygenRelease(brand) {
  const cx = BODY_LEFT + BODY_W / 2;
  const cy = CONTENT_TOP + BODY_H / 2;
  const body = `
  ${leafCrossSection(brand, cx, cy + 20)}
  ${label(brand, cx + 200, cy - 60, "O₂", { size: 32, fill: "#DC2626" })}
  ${arrowPath(cx + 120, cy - 20, cx + 180, cy - 50, "#EF4444", 6)}
  <ellipse cx="${cx + 240}" cy="${cy - 80}" rx="32" ry="20" fill="#FEE2E2" stroke="#DC2626" stroke-width="2"/>
  ${label(brand, cx + 240, cy - 74, "Stomata", { size: 14, anchor: "middle", fill: "#991B1B" })}
  ${label(brand, cx, cy + 130, "Oxygen diffuses out through stomata as a by-product.", { size: 20, anchor: "middle", fill: brand.colors.inkMuted })}
  `;
  return body;
}

const STEP_RENDERERS = {
  "light-absorption": renderStepLightAbsorption,
  "carbon-dioxide-water": renderStepCarbonDioxideWater,
  "glucose-production": renderStepGlucoseProduction,
  "oxygen-release": renderStepOxygenRelease,
};

function renderPhotosynthesisStep(brand, processData, stageId) {
  const stage = (processData.stages || []).find((s) => s.id === stageId);
  if (!stage) throw new Error(`Unknown stage: ${stageId}`);
  const renderBody = STEP_RENDERERS[stageId];
  const body = renderBody ? renderBody(brand) : "";

  return renderBrandedFrame(brand, {
    title: `${processData.title} — Step ${stage.number}`,
    subtitle: stage.title,
    examBoardLabel: processData.examBoardLabel,
    bodyContent: body,
  });
}

/** Hotspot anchors on overview diagram (normalized 0–1). */
function buildOverviewHotspots(brand, processData) {
  const w = brand.canvas.width;
  const h = brand.canvas.height;
  const spots = [
    { id: "hotspot-light", stageId: "light-absorption", label: "Light absorption", x: 0.22, y: 0.42 },
    { id: "hotspot-co2-water", stageId: "carbon-dioxide-water", label: "CO₂ & water", x: 0.38, y: 0.55 },
    { id: "hotspot-glucose", stageId: "glucose-production", label: "Glucose production", x: 0.58, y: 0.55 },
    { id: "hotspot-oxygen", stageId: "oxygen-release", label: "Oxygen release", x: 0.76, y: 0.48 },
  ];
  return spots.map((s) => {
    const stage = (processData.stages || []).find((st) => st.id === s.stageId);
    return {
      id: s.id,
      stageId: s.stageId,
      stageNumber: stage?.number,
      label: s.label,
      description: stage?.summary || s.label,
      x: s.x,
      y: s.y,
    };
  });
}

function buildStepManifest(processData, publicBaseUrl) {
  const base = publicBaseUrl.replace(/\/$/, "");
  return {
    templateId: processData.templateId,
    processId: processData.id,
    title: processData.title,
    examBoardLabel: processData.examBoardLabel,
    overview: {
      url: `${base}/overview.svg`,
      caption: `${processData.title} — overview`,
    },
    steps: (processData.stages || []).map((s) => ({
      id: s.id,
      number: s.number,
      title: s.title,
      slug: s.slug,
      url: `${base}/steps/${s.slug}.svg`,
      caption: s.title,
      examTerm: s.examTerm || "",
    })),
  };
}

module.exports = {
  renderPhotosynthesisOverview,
  renderPhotosynthesisStep,
  buildOverviewHotspots,
  buildStepManifest,
};
