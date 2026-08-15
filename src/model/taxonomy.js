// MOS -> branch label + colour.
//
// The two-digit prefix names the branch, but it must NOT pick the colour: an
// FSC is overwhelmingly 91-series, and colouring by branch would paint eleven
// genuinely different jobs -- 91A Abrams mechanic, 91B wheeled mechanic, 91M
// bradley mechanic -- in one indistinguishable block. Every MOS gets its own
// colour instead, assigned by how common it is so the codes you actually read
// most are the furthest apart.

const BRANCH = {
  11: ['Infantry', 140],
  12: ['Engineer', 25],
  13: ['Field Artillery', 12],
  14: ['Air Defense', 200],
  15: ['Aviation', 210],
  17: ['Cyber', 280],
  18: ['Special Forces', 100],
  19: ['Armor', 45],
  25: ['Signal', 190],
  27: ['Legal', 260],
  31: ['Military Police', 220],
  35: ['Military Intelligence', 270],
  36: ['Financial Management', 160],
  38: ['Civil Affairs', 300],
  42: ['Adjutant General', 320],
  46: ['Public Affairs', 330],
  56: ['Chaplain', 285],
  68: ['Medical', 350],
  74: ['CBRN', 90],
  79: ['Recruiting', 240],
  88: ['Transportation', 205],
  89: ['Ammunition', 15],
  90: ['Logistics (Officer)', 175],
  91: ['Maintenance', 35],
  92: ['Quartermaster', 130],
  94: ['Electronic Maintenance', 60],
};

/** Branch name from the two-digit prefix. Labels stay by branch; colours don't. */
export function branchLabel(mos) {
  const branch = BRANCH[parseInt(String(mos || '').slice(0, 2), 10)];
  return branch ? branch[0] : 'Other';
}

// Sixteen hues chosen by farthest-point selection in CIELAB, not by stepping
// round the HSL wheel -- HSL hue is badly non-uniform perceptually, and an even
// step there puts violets on top of each other while spreading the greens too
// thin. Solved values: no two of these are closer than dE 17.5.
//
// The order is a greedy chain, so consecutive entries are dE 57+ apart. Codes
// are assigned most-common-first, which keeps the largest neighbouring slices
// of a MOS bar as far apart as the palette allows.
const HUES = [205, 314, 45, 167, 230, 330, 218, 0, 120, 188, 294, 23, 144, 262, 345, 76];

// Only once all 16 hues are spent does a hue repeat, at a clearly different
// lightness -- shades are the fallback, not the scheme. Each tier is at least
// dE 17 from every colour in the tiers above it.
const TIERS = [
  { s: 65, l: 62, dim: 42 },
  { s: 78, l: 82, dim: 58 },
  { s: 55, l: 40, dim: 28 },
];

function hashIndex(mos) {
  let h = 0;
  for (let i = 0; i < mos.length; i++) h = (h * 31 + mos.charCodeAt(i)) & 0xffff;
  return h;
}

export function paletteEntry(mos, index) {
  const cycle = Math.floor(index / HUES.length);
  const tier = TIERS[cycle % TIERS.length];
  // Past 48 codes every tier is spent, so nudge the hue to keep later cycles
  // from landing exactly on an earlier colour.
  const hue = (HUES[index % HUES.length] + Math.floor(cycle / TIERS.length) * 9) % 360;
  return {
    mos,
    label: branchLabel(mos),
    hue,
    color: `hsl(${hue} ${tier.s}% ${tier.l}%)`,
    dim: `hsl(${hue} ${Math.round(tier.s * 0.7)}% ${tier.dim}%)`,
  };
}

/**
 * Assigns a colour to every MOS in the loaded structure.
 * @param topMos [{ mos, n }] already sorted most-common first
 */
export function buildMosPalette(topMos) {
  const palette = new Map();
  (topMos || []).forEach(({ mos }, i) => palette.set(mos, paletteEntry(mos, i)));
  return palette;
}

/** Fallback for a code the palette doesn't know (or before one is built). */
export function fallbackEntry(mos) {
  const key = String(mos || '?').toUpperCase();
  return paletteEntry(key, hashIndex(key));
}

/** Fill colour for a node box, by org type. Tuned against the Slate palette. */
export const KIND_STYLE = {
  UN: { label: 'Unit', accent: '#7ea6c4' },
  CR: { label: 'Crew / Vehicle', accent: '#c9a227' },
  BL: { label: 'Soldier', accent: '#8fb573' },
};

// "Company Headquarters", "Distribution Platoon Headquarters", and the
// HHC/HHD/HHB family. These get pinned to the top-left corner of their parent
// so the command element is always in the same place on every unit.
const HQ_RE = /\bheadquarters\b|\bhq\b|\bhh[cdbt]\b/i;

export function isHeadquarters(node) {
  return (node.kind === 'UN' || node.kind === 'CR') && HQ_RE.test(node.title || '');
}

/** Plain truncation, for anywhere there's room to read words. */
export function truncate(title, max = 30) {
  const t = String(title || '').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Initialism for boxes too small for words: "1st Armored Company/Distribution
 * Section" -> "1ACDS". Only worth it when nothing else fits -- use `truncate`
 * wherever a few words will do.
 */
export function abbreviate(title, max = 18) {
  const t = String(title || '').trim();
  if (t.length <= max) return t;
  const words = t.replace(/[()]/g, '').split(/[\s/]+/).filter(Boolean);
  if (words.length > 2) {
    const initials = words
      .map((w) => (/^\d/.test(w) ? w.replace(/\D+$/, '') : w[0].toUpperCase()))
      .join('');
    if (initials.length <= max) return initials;
  }
  return `${t.slice(0, max - 1)}…`;
}
