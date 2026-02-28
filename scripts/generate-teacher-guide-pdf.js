/**
 * Generates the teacher guide PDF from the Markdown source (no Chromium).
 * Output: frontend/public/docs/Edit_Lesson_Activities_and_Action_Points_Explained.pdf
 */
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const repoRoot = path.resolve(__dirname, '..');
const mdPath = path.join(repoRoot, 'frontend/public/docs/EDIT_LESSON_ACTIVITIES_GUIDE.md');
const destPath = path.join(repoRoot, 'frontend/public/docs/Edit_Lesson_Activities_and_Action_Points_Explained.pdf');

// Optional: embed a font to increase PDF size (standard fonts are not embedded). Prefer Arial on Windows.
const fontPath = process.platform === 'win32'
  ? path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'arial.ttf')
  : '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

function stripMarkdown(s) {
  return s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').trim();
}

function parseTable(lines) {
  const rows = [];
  for (const line of lines) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').map((c) => stripMarkdown(c.trim())).filter(Boolean);
    if (cells.length >= 2 && !cells.every((c) => /^[-]+$/.test(c))) rows.push(cells);
  }
  return rows;
}

function main() {
  const md = fs.readFileSync(mdPath, 'utf8');
  const lines = md.split(/\r?\n/);
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const out = fs.createWriteStream(destPath);
  doc.pipe(out);

  if (fs.existsSync(fontPath)) {
    doc.registerFont('Custom', fontPath);
    doc.font('Custom');
  }

  let i = 0;
  const bodyFontSize = 10;
  const headingFontSize = 12;
  const titleFontSize = 16;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('# ')) {
      doc.fontSize(titleFontSize).font(fs.existsSync(fontPath) ? 'Custom' : 'Helvetica-Bold').text(stripMarkdown(trimmed.slice(2)), { align: 'center' });
      doc.moveDown();
      i++;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      doc.fontSize(headingFontSize).font(fs.existsSync(fontPath) ? 'Custom' : 'Helvetica-Bold').text(stripMarkdown(trimmed.slice(3)));
      doc.moveDown(0.5);
      i++;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      doc.fontSize(bodyFontSize + 1).font(fs.existsSync(fontPath) ? 'Custom' : 'Helvetica-Bold').text(stripMarkdown(trimmed.slice(4)));
      doc.moveDown(0.3);
      i++;
      continue;
    }

    if (trimmed.startsWith('|')) {
      const tableLines = [line];
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
        i++;
        tableLines.push(lines[i]);
      }
      const rows = parseTable(tableLines);
      doc.fontSize(bodyFontSize - 1).font(fs.existsSync(fontPath) ? 'Custom' : 'Helvetica');
      for (const row of rows) {
        const rowText = row.join('  —  ');
        doc.text(rowText, { width: 500, lineGap: 2 });
        doc.moveDown(0.3);
      }
      doc.moveDown(0.5);
      i++;
      continue;
    }

    if (trimmed === '---' || trimmed === '') {
      i++;
      continue;
    }

    doc.fontSize(bodyFontSize).font(fs.existsSync(fontPath) ? 'Custom' : 'Helvetica').text(stripMarkdown(trimmed), { width: 500, lineGap: 2 });
    doc.moveDown(0.3);
    i++;
  }

  out.on('finish', () => {
    const stat = fs.statSync(destPath);
    console.log('Generated:', destPath);
    console.log('Size:', (stat.size / 1024).toFixed(1), 'KB');
    if (stat.size < 1024) {
      console.warn('Warning: PDF is very small; ensure the source Markdown was processed.');
    }
  });
  doc.end();
}

main();
