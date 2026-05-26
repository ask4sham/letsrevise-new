const { escapeXml } = require("./escapeXml");

/**
 * LetsRevise branded SVG chrome: outer canvas, header band, logo mark, exam board label.
 * @param {object} opts
 * @param {import('../../tokens/letsrevise-brand.json')} brand
 * @param {string} opts.title
 * @param {string} [opts.subtitle]
 * @param {string} [opts.examBoardLabel]
 * @param {string} [opts.bodyContent] - inner SVG markup (coordinates relative to full canvas)
 */
function renderBrandedFrame(brand, opts) {
  const { canvas, colors, typography, spacing, brand: brandText } = brand;
  const w = canvas.width;
  const h = canvas.height;
  const title = escapeXml(opts.title || "");
  const subtitle = escapeXml(opts.subtitle || "");
  const board = escapeXml(opts.examBoardLabel || "");
  const body = opts.bodyContent || "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}" height="${h}" viewBox="${canvas.viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}">
  <rect width="${w}" height="${h}" rx="${canvas.borderRadius}" fill="${canvas.outerBackground}"/>
  <rect x="${spacing.margin}" y="${spacing.margin}" width="${w - spacing.margin * 2}" height="${h - spacing.margin * 2}" rx="${canvas.borderRadius}" fill="${canvas.background}" stroke="${colors.border}" stroke-width="6"/>

  <rect x="${spacing.margin + 8}" y="${spacing.margin + 8}" width="320" height="52" rx="12" fill="${colors.headerBand}" stroke="${colors.accentBorder}" stroke-width="2"/>
  <text x="${spacing.margin + 28}" y="${spacing.margin + 40}" font-family="${typography.fontFamily}" font-size="${typography.brandMarkSize}" font-weight="800" fill="${colors.accent}">${escapeXml(brandText.markText)}</text>
  <text x="${spacing.margin + 200}" y="${spacing.margin + 40}" font-family="${typography.fontFamily}" font-size="14" font-weight="600" fill="${colors.inkMuted}">${escapeXml(brandText.markSubtext)}</text>

  <text x="${spacing.margin + 24}" y="${spacing.margin + 72}" font-family="${typography.fontFamily}" font-size="${typography.titleSize}" font-weight="700" fill="${colors.ink}">${title}</text>
  ${subtitle ? `<text x="${spacing.margin + 24}" y="${spacing.margin + 112}" font-family="${typography.fontFamily}" font-size="${typography.subtitleSize}" fill="${colors.inkMuted}">${subtitle}</text>` : ""}
  ${board ? `<text x="${w - spacing.margin - 24}" y="${spacing.margin + 40}" text-anchor="end" font-family="${typography.fontFamily}" font-size="${typography.boardLabelSize}" font-weight="700" fill="${colors.accent}">${board}</text>` : ""}

  ${body}
</svg>`;
}

module.exports = { renderBrandedFrame };
