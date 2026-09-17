/**
 * Dev-only contrast watchdog.
 *
 * The CSS contrast contract (top of styles/app.css) is what keeps foreground
 * and background paired. This is the check that the contract is holding: it
 * walks every element that actually paints text, composites the real
 * background behind it (walking ancestors through transparency), and reports
 * anything under the WCAG AA threshold.
 *
 * Never shipped -- main.jsx only imports it under import.meta.env.DEV, so the
 * whole module is dropped from production builds.
 *
 * Console:
 *   __contrastAudit()      re-run now, returns the grouped failures
 *   __contrastAudit(3)     only report worse than 3:1
 */

const AA_NORMAL = 4.5;
const PAGE_FALLBACK = { r: 39, g: 43, b: 48, a: 1 };

let swatch = null;

/** Rasterises anything the browser can parse -- oklch(), color-mix(), hsl(). */
function rasterise(value) {
  if (!swatch) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    swatch = canvas.getContext('2d', { willReadFrequently: true });
  }
  swatch.clearRect(0, 0, 1, 1);
  // An unparseable value leaves fillStyle at whatever it already was, so the
  // sentinel is how we tell "could not read this" from "it really is black".
  const sentinel = '#010203';
  swatch.fillStyle = sentinel;
  swatch.fillStyle = value;
  if (swatch.fillStyle === sentinel) return null;
  swatch.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = swatch.getImageData(0, 0, 1, 1).data;
  return { r, g, b, a: a / 255 };
}

function parseColor(value) {
  const match = String(value).match(/rgba?\(([^)]+)\)/);
  if (match) {
    const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (parts.length >= 3 && !parts.some(Number.isNaN)) {
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    }
  }
  // Computed styles hand back oklch()/color-mix() untouched, and skipping those
  // would quietly exempt exactly the rules the contract computes.
  if (!value || value === 'none' || value === 'transparent') return null;
  try { return rasterise(value); } catch { return null; }
}

function composite(fg, bg) {
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  };
}

function luminance({ r, g, b }) {
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The colour actually behind `el`, composited down through transparent ancestors. */
function backdrop(el) {
  const layers = [];
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    const style = getComputedStyle(node);
    const bg = parseColor(style.backgroundColor);
    if (bg && bg.a > 0) layers.push(bg);
    // A gradient or image is unknowable; assume it is close to the panel fill
    // rather than skipping the element, so a regression still surfaces.
    if (style.backgroundImage && style.backgroundImage !== 'none') {
      layers.push({ r: 58, g: 65, b: 72, a: 0.4 });
    }
  }
  layers.push(PAGE_FALLBACK);
  let out = layers[layers.length - 1];
  for (let i = layers.length - 2; i >= 0; i--) out = composite(layers[i], out);
  return out;
}

function ownText(el) {
  let text = '';
  for (const node of el.childNodes) {
    if (node.nodeType === 3) text += node.textContent;
  }
  return text.trim();
}

export function auditContrast(threshold = AA_NORMAL) {
  const groups = new Map();

  for (const el of document.querySelectorAll('*')) {
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') continue;

    // WCAG 1.4.3 exempts disabled controls, and dimming one is the point.
    if (el.closest('[disabled], [aria-disabled="true"], fieldset:disabled')) continue;

    const opacity = Number(style.opacity || 1);
    if (opacity < 0.05) continue;

    const text = ownText(el);
    const isGlyph = el.tagName === 'I' && /\bbi-/.test(el.className || '');
    if (!text && !isGlyph) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;

    const raw = parseColor(style.color);
    if (!raw) continue;

    const bg = backdrop(el);
    const fg = composite({ ...raw, a: raw.a * opacity }, bg);
    const ratio = contrast(fg, bg);
    if (ratio >= threshold) continue;

    const classes = (typeof el.className === 'string' ? el.className : '').trim();
    const key = `${el.tagName}|${classes}|${style.color}|${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)}`;
    const hit = groups.get(key) || {
      ratio: Math.round(ratio * 100) / 100,
      selector: el.tagName.toLowerCase() + (classes ? `.${classes.trim().split(/\s+/).join('.')}` : ''),
      color: style.color,
      background: `rgb(${[bg.r, bg.g, bg.b].map(Math.round).join(', ')})`,
      sample: (text || '[icon]').slice(0, 40),
      count: 0,
      node: el,
    };
    hit.count += 1;
    groups.set(key, hit);
  }

  return [...groups.values()].sort((a, b) => a.ratio - b.ratio);
}

/** Re-checks shortly after the DOM settles, so a newly opened panel is covered. */
export function installContrastAudit() {
  if (typeof window === 'undefined') return;

  window.__contrastAudit = (threshold) => {
    const failures = auditContrast(threshold);
    if (failures.length) console.table(failures.map(({ node, ...row }) => row));
    else console.info('[contrast] no failures');
    return failures;
  };

  let timer = 0;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const failures = auditContrast();
      if (!failures.length) return;
      const worst = failures.filter((f) => f.ratio < 3);
      const log = worst.length ? console.error : console.warn;
      log(
        `[contrast] ${failures.length} pairing(s) under ${AA_NORMAL}:1` +
          (worst.length ? `, ${worst.length} under 3:1` : '') +
          ' -- see the contrast contract in styles/app.css. __contrastAudit() for detail.',
      );
      console.table(failures.map(({ node, ...row }) => row));
    }, 600);
  };

  new MutationObserver(schedule).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'style'],
  });
  schedule();
}
