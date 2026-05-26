const { escapeXml } = require("../shared/escapeXml");
const { renderBrandedFrame } = require("../shared/brandedFrame");

const CONTENT_TOP = 200;
const STAGE_W = 280;
const STAGE_H = 320;

function renderStageCard(brand, stage, x, y, { highlight = false } = {}) {
  const { colors, typography, spacing } = brand;
  const stroke = highlight ? colors.stageStroke : colors.accentBorder;
  const strokeW = highlight ? 4 : 2;
  const fill = highlight ? colors.accentLight : colors.stageFill;
  const num = stage.number;
  const title = escapeXml(stage.title);
  const summary = escapeXml(stage.summary);
  const term = stage.examTerm ? escapeXml(stage.examTerm) : "";

  return `
  <g id="stage-${escapeXml(stage.id)}" data-stage-number="${num}">
    <rect x="${x}" y="${y}" width="${STAGE_W}" height="${STAGE_H}" rx="16" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>
    <circle cx="${x + 36}" cy="${y + 36}" r="22" fill="${colors.accent}" />
    <text x="${x + 36}" y="${y + 44}" text-anchor="middle" font-family="${typography.fontFamily}" font-size="${typography.stageNumberSize}" font-weight="800" fill="#FFFFFF">${num}</text>
    <text x="${x + spacing.stagePadding}" y="${y + 88}" font-family="${typography.fontFamily}" font-size="${typography.stageTitleSize}" font-weight="700" fill="${colors.ink}">${title}</text>
    ${renderSummaryLines(brand, summary, x + spacing.stagePadding, y + 128)}
    ${term ? `<text x="${x + spacing.stagePadding}" y="${y + STAGE_H - 28}" font-family="${typography.fontFamily}" font-size="16" font-weight="700" fill="${colors.accent}">Exam: ${term}</text>` : ""}
  </g>`;
}

function wrapLines(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function renderSummaryLines(brand, summary, x, startY) {
  const { typography, colors } = brand;
  return wrapLines(summary, 28)
    .map(
      (ln, i) =>
        `<text x="${x}" y="${startY + i * 26}" font-family="${typography.fontFamily}" font-size="${typography.stageBodySize}" fill="${colors.inkMuted}">${escapeXml(ln)}</text>`
    )
    .join("\n");
}

function renderArrow(brand, x1, y1, x2, y2) {
  const { colors } = brand;
  const midY = y1;
  return `
  <g aria-hidden="true">
    <line x1="${x1}" y1="${midY}" x2="${x2 - 12}" y2="${midY}" stroke="${colors.arrow}" stroke-width="4" stroke-linecap="round"/>
    <polygon points="${x2 - 12},${midY - 10} ${x2},${midY} ${x2 - 12},${midY + 10}" fill="${colors.arrow}"/>
  </g>`;
}

/**
 * Overview: all stages in a horizontal linear flow.
 */
function renderProcessOverview(brand, processData) {
  const stages = processData.stages || [];
  const margin = brand.spacing.margin;
  const startX = margin + 40;
  const y = CONTENT_TOP + 40;
  const gap = brand.spacing.stageGap;
  const totalW = stages.length * STAGE_W + (stages.length - 1) * gap;
  const offsetX = Math.max(startX, (brand.canvas.width - totalW) / 2);

  let body = "";
  stages.forEach((stage, i) => {
    const x = offsetX + i * (STAGE_W + gap);
    if (i > 0) {
      const prevX = offsetX + (i - 1) * (STAGE_W + gap) + STAGE_W;
      body += renderArrow(brand, prevX + 8, y + STAGE_H / 2, x - 8, y + STAGE_H / 2);
    }
    body += renderStageCard(brand, stage, x, y, { highlight: false });
  });

  return renderBrandedFrame(brand, {
    title: processData.title,
    subtitle: processData.subtitle,
    examBoardLabel: processData.examBoardLabel,
    bodyContent: body,
  });
}

/**
 * Single-step focus view for interactiveSequence assets.
 */
function renderProcessStep(brand, processData, stageId) {
  const stage = (processData.stages || []).find((s) => s.id === stageId);
  if (!stage) throw new Error(`Unknown stage: ${stageId}`);

  const x = (brand.canvas.width - STAGE_W) / 2;
  const y = CONTENT_TOP + 48;
  const body = renderStageCard(brand, stage, x, y, { highlight: true });

  return renderBrandedFrame(brand, {
    title: `${processData.title} — Step ${stage.number}`,
    subtitle: stage.title,
    examBoardLabel: processData.examBoardLabel,
    bodyContent: body,
  });
}

/**
 * Normalized hotspot anchors for overview (centre of each stage card).
 */
function buildOverviewHotspots(brand, processData) {
  const stages = processData.stages || [];
  const margin = brand.spacing.margin;
  const gap = brand.spacing.stageGap;
  const totalW = stages.length * STAGE_W + (stages.length - 1) * gap;
  const offsetX = Math.max(margin + 40, (brand.canvas.width - totalW) / 2);
  const y = CONTENT_TOP + 40;
  const w = brand.canvas.width;
  const h = brand.canvas.height;

  return stages.map((stage, i) => {
    const x = offsetX + i * (STAGE_W + gap) + STAGE_W / 2;
    const cy = y + STAGE_H / 2;
    return {
      id: `hotspot-${stage.id}`,
      stageId: stage.id,
      stageNumber: stage.number,
      label: stage.title,
      description: stage.summary,
      x: Number((x / w).toFixed(4)),
      y: Number((cy / h).toFixed(4)),
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
  renderProcessOverview,
  renderProcessStep,
  buildOverviewHotspots,
  buildStepManifest,
  STAGE_W,
  STAGE_H,
};
