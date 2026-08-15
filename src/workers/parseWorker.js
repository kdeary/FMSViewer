// Spreadsheet -> model, off the main thread so the progress bar keeps animating.

import * as XLSX from 'xlsx';
import { parseRows, ParseError } from '../model/parseSheet.js';
import { buildTree } from '../model/buildTree.js';
import { computeRollups } from '../model/rollups.js';
import { layoutTree, WORLD } from '../layout/layoutTree.js';
import { computeLevels } from '../model/levels.js';
import { serializeNodes, MODEL_VERSION } from '../model/modelFile.js';

// Weights add to 100 and are set from measured cost, so the bar tracks real
// work instead of jumping. Decoding the workbook dominates everything else:
// on a 33k-row sheet it is 2.34s of a 2.43s parse.
const PHASES = [
  ['read', 'Reading file', 5],
  ['decode', 'Decoding spreadsheet', 65],
  ['index', 'Indexing rows', 10],
  ['tree', 'Building unit tree', 3],
  ['rollups', 'Aggregating strength', 7],
  ['layout', 'Laying out the map', 10],
];

let lastPost = 0;

function makeReporter() {
  let base = 0;
  return {
    /** Report progress within the named phase; `frac` is 0..1 inside it. */
    at(name, frac, force = false) {
      const idx = PHASES.findIndex((p) => p[0] === name);
      const before = PHASES.slice(0, idx).reduce((s, p) => s + p[2], 0);
      const pct = before + PHASES[idx][2] * Math.min(Math.max(frac, 0), 1);
      base = Math.max(base, pct);
      const now = performance.now();
      if (force || now - lastPost > 16) {
        lastPost = now;
        // `end` lets the UI ease towards the end of a phase it cannot subdivide
        // (XLSX.read is one synchronous call with no progress hook).
        self.postMessage({
          type: 'progress',
          phase: name,
          label: PHASES[idx][1],
          pct: base,
          end: before + PHASES[idx][2],
        });
      }
    },
  };
}

self.onmessage = async (e) => {
  const { file } = e.data || {};
  const t0 = performance.now();
  const report = makeReporter();

  try {
    report.at('read', 0, true);
    const buf = await file.arrayBuffer();
    report.at('read', 1, true);

    // Sheet name is a generated key (e.g. "1612922388STRUCGBU7206..."), never fixed.
    report.at('decode', 0.02, true);
    const wb = XLSX.read(buf, { dense: true, cellDates: false, cellStyles: false });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new ParseError('Workbook contains no sheets.');
    report.at('decode', 0.6, true);

    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1, raw: true, defval: '', blankrows: false,
    });
    report.at('decode', 1, true);

    const { nodes, meta } = parseRows(rows, (f) => report.at('index', f));

    const { rootId, warnings: treeWarnings } = buildTree(nodes, meta);
    report.at('tree', 1, true);

    const { warnings: rollWarnings, order } = computeRollups(nodes, rootId, (f) => report.at('rollups', f));

    layoutTree(nodes, rootId, (f) => report.at('layout', f));

    const root = nodes.get(rootId);
    const model = {
      version: MODEL_VERSION,
      rootId,
      world: WORLD,
      levels: computeLevels(nodes, rootId),
      meta: {
        sourceFile: file.name,
        sheetName,
        uic: root.uic || meta.uic,
        rootTitle: root.title,
        runDate: meta.runDate,
        rowCount: meta.rowCount,
        skippedRows: meta.skipped,
        nodeCount: nodes.size,
        generatedAt: new Date().toISOString(),
        parseMs: Math.round(performance.now() - t0),
        warnings: [...treeWarnings, ...rollWarnings],
      },
      nodes: serializeNodes(nodes, order),
    };

    report.at('layout', 1, true);
    self.postMessage({ type: 'done', model });
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof ParseError ? err.message : `Could not read that file: ${err.message}`,
    });
  }
};
