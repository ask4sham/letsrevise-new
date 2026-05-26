const { escapeXml } = require("../shared/escapeXml");
const { renderBrandedFrame } = require("../shared/brandedFrame");

const CONTENT_TOP = 200;
const PANEL_TOP = CONTENT_TOP + 16;
const PANEL_H = 520;
const DIVIDER_X = 700;
const LEFT_X = 56;
const RIGHT_X = DIVIDER_X + 40;
const INK = "#111827";
const BLUE = "#2563EB";
const RED = "#DC2626";
const GREEN = "#15803D";
const LIGHT_BLUE = "#DBEAFE";
const LIGHT_RED = "#FEE2E2";

function label(x, y, text, { size = 20, anchor = "start", fill = INK, weight = "800" } = {}) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(text)}</text>`;
}

function arrow(x1, y1, x2, y2, color = RED, width = 5) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const ax = x2 - ux * 14;
  const ay = y2 - uy * 14;
  const px = -uy * 8;
  const py = ux * 8;
  return `<g>
    <line x1="${x1}" y1="${y1}" x2="${ax}" y2="${ay}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>
    <polygon points="${x2},${y2} ${ax + px},${ay + py} ${ax - px},${ay - py}" fill="${color}"/>
  </g>`;
}

/** Simplified torso + organs — exam line art, no exercise context. */
function organismSetup() {
  const cx = 340;
  const cy = PANEL_TOP + 260;
  return `
  <g id="organism-left">
    <rect x="${LEFT_X}" y="${PANEL_TOP}" width="${DIVIDER_X - LEFT_X - 24}" height="${PANEL_H}" rx="16" fill="#FFFFFF" stroke="${INK}" stroke-width="4"/>
    ${label(LEFT_X + 24, PANEL_TOP + 36, "BODY SYSTEMS", { size: 24 })}

    <ellipse cx="${cx}" cy="${cy + 40}" rx="95" ry="150" fill="#FFFFFF" stroke="${INK}" stroke-width="5"/>
    <circle cx="${cx}" cy="${cy - 130}" r="42" fill="#FFFFFF" stroke="${INK}" stroke-width="5"/>

    <ellipse cx="${cx - 28}" cy="${cy - 95}" rx="38" ry="52" fill="${LIGHT_BLUE}" stroke="${BLUE}" stroke-width="4"/>
    <ellipse cx="${cx + 28}" cy="${cy - 95}" rx="38" ry="52" fill="${LIGHT_BLUE}" stroke="${BLUE}" stroke-width="4"/>
    ${label(cx, cy - 155, "LUNGS", { size: 18, anchor: "middle", fill: BLUE })}
    ${label(cx - 70, cy - 175, "EXTRA O₂", { size: 16, fill: RED })}
    ${arrow(cx - 70, cy - 160, cx - 35, cy - 110, RED, 4)}

    <path d="M ${cx - 22} ${cy - 20} Q ${cx} ${cy + 10} ${cx + 22} ${cy - 20} Q ${cx} ${cy + 45} ${cx - 22} ${cy - 20} Z" fill="${LIGHT_RED}" stroke="${RED}" stroke-width="4"/>
    ${label(cx, cy + 5, "HEART", { size: 16, anchor: "middle", fill: RED })}

    <rect x="${cx - 55}" y="${cy + 55}" width="110" height="70" rx="12" fill="#FEF3C7" stroke="${INK}" stroke-width="4"/>
    ${label(cx, cy + 88, "LIVER", { size: 18, anchor: "middle" })}

    <rect x="${cx + 75}" y="${cy + 30}" width="70" height="100" rx="10" fill="#E5E7EB" stroke="${INK}" stroke-width="3"/>
    ${label(cx + 110, cy + 45, "MUSCLE", { size: 14, anchor: "middle" })}
    ${label(cx + 110, cy + 68, "TISSUE", { size: 14, anchor: "middle" })}

    ${arrow(cx + 110, cy + 85, cx + 45, cy + 75, BLUE, 4)}
    ${label(cx + 78, cy + 118, "LACTIC ACID", { size: 13, fill: BLUE, anchor: "middle" })}
    ${label(cx + 78, cy + 134, "IN BLOOD", { size: 13, fill: BLUE, anchor: "middle" })}

    ${arrow(cx, cy + 30, cx, cy + 52, RED, 5)}
    ${arrow(cx, cy + 125, cx, cy + 52, BLUE, 4)}

    <rect x="${LEFT_X + 28}" y="${PANEL_TOP + PANEL_H - 72}" width="${DIVIDER_X - LEFT_X - 80}" height="52" rx="10" fill="#F3F4F6" stroke="${INK}" stroke-width="3"/>
    ${label(LEFT_X + 40, PANEL_TOP + PANEL_H - 40, "OXYGEN DEBT", { size: 18 })}
    ${label(LEFT_X + 40, PANEL_TOP + PANEL_H - 18, "= EXTRA O₂ REQUIRED", { size: 16, fill: RED })}
  </g>`;
}

/** Close-up: oxidation of lactic acid in the liver. */
function liverCloseUp() {
  const cx = RIGHT_X + 300;
  const cy = PANEL_TOP + 280;
  return `
  <g id="process-right">
    <rect x="${RIGHT_X}" y="${PANEL_TOP}" width="${1344 - RIGHT_X}" height="${PANEL_H}" rx="16" fill="#FFFFFF" stroke="${INK}" stroke-width="4"/>
    ${label(RIGHT_X + 24, PANEL_TOP + 36, "CLOSE-UP: OXIDATION", { size: 24 })}

    <rect x="${RIGHT_X + 40}" y="${PANEL_TOP + 70}" width="520" height="360" rx="14" fill="${LIGHT_BLUE}" stroke="${BLUE}" stroke-width="4"/>
    ${label(cx, PANEL_TOP + 110, "LIVER CELLS", { size: 22, anchor: "middle", fill: BLUE })}

    <rect x="${cx - 200}" y="${cy - 40}" width="160" height="72" rx="10" fill="#FFFFFF" stroke="${INK}" stroke-width="4"/>
    ${label(cx - 120, cy - 8, "LACTIC ACID", { size: 18, anchor: "middle" })}

    <rect x="${cx - 30}" y="${cy - 55}" width="90" height="50" rx="8" fill="${LIGHT_RED}" stroke="${RED}" stroke-width="3"/>
    ${label(cx + 15, cy - 22, "O₂", { size: 22, anchor: "middle", fill: RED })}
    ${arrow(cx - 38, cy - 18, cx - 32, cy - 18, RED, 4)}

    <rect x="${cx + 50}" y="${cy - 40}" width="160" height="72" rx="10" fill="#FFFFFF" stroke="${INK}" stroke-width="4"/>
    ${label(cx + 130, cy - 8, "CO₂ + H₂O", { size: 18, anchor: "middle" })}

    ${arrow(cx - 38, cy, cx + 45, cy, RED, 6)}
    ${arrow(cx + 15, cy, cx + 45, cy, RED, 5)}

    ${label(cx, cy + 55, "LACTIC ACID + O₂", { size: 20, anchor: "middle", fill: INK })}
    ${label(cx, cy + 82, "→ OXIDISED", { size: 20, anchor: "middle", fill: INK })}

    <rect x="${RIGHT_X + 60}" y="${PANEL_TOP + PANEL_H - 100}" width="480" height="72" rx="12" fill="#FFFFFF" stroke="${RED}" stroke-width="4"/>
    ${label(RIGHT_X + 80, PANEL_TOP + PANEL_H - 62, "KEY IDEA", { size: 16, fill: RED })}
    ${label(RIGHT_X + 80, PANEL_TOP + PANEL_H - 36, "EXTRA O₂ NEEDED TO OXIDISE LACTIC ACID", { size: 17 })}
    ${label(RIGHT_X + 80, PANEL_TOP + PANEL_H - 14, "AFTER ANAEROBIC RESPIRATION IN CELLS", { size: 15, fill: INK })}
  </g>`;
}

function renderOxygenDebtExamDiagram(brand) {
  const body = `
  <rect x="48" y="${CONTENT_TOP - 8}" width="1304" height="${PANEL_H + 32}" rx="20" fill="#FFFFFF" stroke="${INK}" stroke-width="3"/>
  <line x1="${DIVIDER_X}" y1="${PANEL_TOP}" x2="${DIVIDER_X}" y2="${PANEL_TOP + PANEL_H}" stroke="${INK}" stroke-width="3" stroke-dasharray="12 8"/>
  ${organismSetup()}
  ${liverCloseUp()}
  `;

  return renderBrandedFrame(brand, {
    title: "OXYGEN DEBT",
    subtitle: "Extra oxygen to oxidise lactic acid",
    examBoardLabel: "GCSE AQA HIGHER TIER BIOLOGY",
    bodyContent: body,
  });
}

module.exports = { renderOxygenDebtExamDiagram };
