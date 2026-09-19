// The "model file": a flat, cycle-free JSON snapshot of the parsed structure,
// including precomputed layout rects. Re-importing one skips parsing entirely.

// v2: per-depth `levels` replaced the old per-node `revealW`, so level of
import { getEquipmentCategory } from './rollups.js';
import { packRows, unpackRows } from './supplement.js';

export const MODEL_VERSION = 2;
export const MODEL_EXT = '.fmsmodel.json';

export class ModelFileError extends Error {}

/** Map of nodes -> the serializable shape. Only fields the UI actually reads. */
export function serializeNodes(nodes, order) {
  const ids = order || [...nodes.keys()];
  return ids.map((id) => {
    const n = nodes.get(id);
    return {
      id: n.id,
      parentId: n.parentId,
      kind: n.kind,
      title: n.title,
      uic: n.uic,
      parno: n.parno,
      grade: n.grade,
      poscode: n.poscode,
      mos: n.mos,
      depth: n.depth,
      childIds: n.childIds,
      equipment: n.equipment,
      sheet: n.sheet,
      roll: n.roll,
      topMos: n.topMos,
      allEq: n.allEq,
      rect: n.rect,
      isHq: n.isHq || undefined,
      synthetic: n.synthetic || undefined,
    };
  });
}

/** Attach an id -> node lookup. Model objects always travel with `byId`. */
export function hydrate(model) {
  const byId = new Map();
  for (const n of model.nodes) byId.set(n.id, n);

  const rootNode = model.rootId ? byId.get(model.rootId) : null;
  let globalCatCounts = new Map();
  if (rootNode && rootNode.allEq) {
    for (const item of rootNode.allEq) {
      const cat = getEquipmentCategory(item.name);
      globalCatCounts.set(cat, (globalCatCounts.get(cat) || 0) + item.qty);
    }
  }

  for (const n of model.nodes) {
    n.globalCatCounts = globalCatCounts;
  }

  return { ...model, byId, globalCatCounts };
}

/** `supplementRows` is the Supplement Table, packed in alongside the structure. */
export function toBlob(model, supplementRows = []) {
  const { byId, supplement, ...rest } = model;
  return new Blob([JSON.stringify({ ...rest, supplement: packRows(supplementRows) })], { type: 'application/json' });
}

export function suggestedFileName(model) {
  const base = (model.meta?.sourceFile || model.meta?.uic || 'force-structure')
    .replace(/\.(xlsx|xlsm|xls|csv)$/i, '')
    .replace(/[^\w.-]+/g, '_');
  return base + MODEL_EXT;
}

export function parseModelFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ModelFileError('That file is not valid JSON.');
  }
  if (!data || typeof data !== 'object') throw new ModelFileError('Model file is empty.');
  if (data.version !== MODEL_VERSION) {
    throw new ModelFileError(
      `Model file version ${data.version ?? '(none)'} is not supported (expected ${MODEL_VERSION}).`,
    );
  }
  if (!Array.isArray(data.nodes) || !data.nodes.length) {
    throw new ModelFileError('Model file contains no nodes.');
  }
  if (!data.rootId || !data.nodes.some((n) => n.id === data.rootId)) {
    throw new ModelFileError('Model file has no valid root node.');
  }
  if (!data.nodes.every((n) => n.rect && n.roll)) {
    throw new ModelFileError('Model file is missing layout or rollup data.');
  }
  if (!Array.isArray(data.levels) || !data.levels.length) {
    throw new ModelFileError('Model file is missing level sizes.');
  }
  // The Supplement Table is optional: files saved before it existed have none.
  const { supplement, ...rest } = data;
  return { model: hydrate({ meta: {}, ...rest }), supplementRows: unpackRows(supplement) };
}
