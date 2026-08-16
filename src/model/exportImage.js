// Map -> PNG.
//
// The picture is rebuilt as SVG from the model rather than captured from the
// live DOM. Screen-scraping the map would need a third-party rasteriser, would
// only ever capture what happens to be on screen at the time, and would inherit
// the viewport culling that keeps the map fast. Redrawing from the same `rect`
// values the map uses gives the whole subtree at any depth, at any size, with
// no dependency at all.

import { KIND_STYLE } from './taxonomy.js';
import { headerHeight } from '../layout/layoutTree.js';

/** How many levels below the exported node each detail step draws. */
export const DETAIL_LEVELS = [
  { depth: 1, label: 'Outline', note: 'The chosen unit and what sits directly inside it.' },
  { depth: 2, label: 'Sections', note: 'Two levels down -- platoons and their sections.' },
  { depth: 3, label: 'Teams', note: 'Three levels down, to squads and crews.' },
  { depth: 4, label: 'Soldiers', note: 'Far enough to reach individual billets in most structures.' },
  { depth: 99, label: 'Everything', note: 'The entire subtree, however deep it runs.' },
];

export const DEFAULT_DETAIL = 3;   // 1-based index into DETAIL_LEVELS
const OUT_W = 2400;                // px on the long edge; not user-facing
const FONT = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/**
 * Boxes to draw, as a flat list in painting order (parents first, so children
 * land on top exactly as they do on the map).
 */
function collect(model, rootId, maxDepth) {
  const out = [];
  const root = model.byId.get(rootId);
  if (!root) return out;

  const walk = (node, depth) => {
    out.push({ node, depth });
    if (depth >= maxDepth) return;
    for (const id of node.childIds) {
      const child = model.byId.get(id);
      if (child) walk(child, depth + 1);
    }
  };
  walk(root, 0);
  return out;
}

/**
 * @param opts.mosColor (mos) => css colour, so the image uses the same palette
 *   the map does rather than inventing a second one.
 */
export function buildSvg(model, rootId, detail, opts = {}) {
  const root = model.byId.get(rootId);
  if (!root) throw new Error('Nothing to export.');

  const levels = DETAIL_LEVELS[Math.min(Math.max(detail, 1), DETAIL_LEVELS.length) - 1];
  const boxes = collect(model, rootId, levels.depth);
  const r = root.rect;
  const mosColor = opts.mosColor || (() => '#8fb573');

  // World units are the SVG's own coordinate space; the viewBox does the
  // scaling, so nothing here has to know the output size.
  const scale = OUT_W / r.w;
  const outH = Math.round(r.h * scale);
  const unit = 1 / scale;      // one output pixel, in world units

  const parts = [];
  parts.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#272b30"/>`);

  for (const { node } of boxes) {
    const b = node.rect;
    const fill = node.kind === 'UN' ? '#343b42' : node.kind === 'CR' ? '#413b30' : '#333c33';
    // Eight-digit hex throughout rather than a mix of that and rgba(): both
    // parse, but one notation is easier to check than two.
    const stroke = node.isHq ? '#7ea6c480' : '#0000008c';
    const hh = headerHeight(b);
    const accent = node.kind === 'BL' && node.mos ? mosColor(node.mos) : KIND_STYLE[node.kind].accent;

    parts.push(
      `<g><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${unit * 4}"`
      + ` fill="${fill}" stroke="${stroke}" stroke-width="${unit}"/>`,
    );
    // Header strip, with the kind/MOS colour as a left edge so the picture
    // stays readable in greyscale as well as in colour.
    parts.push(
      `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${hh}" fill="#0000002e"/>`
      + `<rect x="${b.x}" y="${b.y}" width="${unit * 3}" height="${hh}" fill="${accent}"/>`,
    );

    // Type is sized to the header and clipped to the box, the same bargain the
    // map makes: a box too small for its name simply shows less of it.
    const fs = Math.min(hh * 0.5, b.w * 0.055);
    if (fs * scale >= 5) {
      const pad = hh * 0.28;
      const count = node.roll.mil > 0 ? String(node.roll.mil) : '';
      const room = b.w - pad * 2 - (count ? fs * count.length * 0.62 : 0);
      const chars = Math.max(0, Math.floor(room / (fs * 0.52)));
      const title = node.title.length > chars ? `${node.title.slice(0, Math.max(1, chars - 1))}…` : node.title;
      parts.push(
        `<text x="${b.x + pad}" y="${b.y + hh * 0.72}" font-family='${FONT}' font-size="${fs}"`
        + ` font-weight="600" fill="#dee2e6">${esc(title)}</text>`,
      );
      if (count) {
        parts.push(
          `<text x="${b.x + b.w - pad}" y="${b.y + hh * 0.72}" font-family='${FONT}' font-size="${fs}"`
          + ` fill="#adb5bd" text-anchor="end">${esc(count)}</text>`,
        );
      }
    }
    parts.push('</g>');
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${outH}"`
    + ` viewBox="${r.x} ${r.y} ${r.w} ${r.h}">${parts.join('')}</svg>`;
  return { svg, width: OUT_W, height: outH, boxes: boxes.length };
}

/** Rasterises an SVG string. The data URL keeps the canvas untainted. */
export function svgToPng(svg, width, height) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image.'))), 'image/png');
    };
    img.onerror = () => reject(new Error('Could not draw the map.'));
    img.src = url;
  });
}

export function imageFileName(model, node) {
  const base = (node.title || model.meta?.uic || 'force-structure')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 60);
  return `${base}.png`;
}
