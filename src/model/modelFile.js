// The "model file": a flat, cycle-free JSON snapshot of the parsed structure,
// including precomputed layout rects. Re-importing one skips parsing entirely.

// v2: per-depth `levels` replaced the old per-node `revealW`, so level of
// detail is decided per tree level instead of per box.
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
  return { ...model, byId };
}

export function toBlob(model) {
  const { byId, ...rest } = model;
  return new Blob([JSON.stringify(rest)], { type: 'application/json' });
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
  return hydrate({ meta: {}, ...data });
}
