// Official MOS titles and major duties, extracted from DA PAM 611-21 chapter 10
// section C into data/mos-<series>.json.
//
// The whole set is ~250 kB, and a given structure touches only a handful of
// series, so the files are loaded one series at a time on demand rather than
// bundled in. Each import becomes its own chunk.

const loaders = import.meta.glob('../../data/mos-*.json');

const bySeries = new Map();
for (const [path, load] of Object.entries(loaders)) {
  const m = /mos-([0-9A-Z]{2})\.json$/.exec(path);
  if (m) bySeries.set(m[1], load);
}

const pending = new Map();  // series -> Promise<Map<mos, spec>>
const ready = new Map();    // series -> Map<mos, spec>

export function seriesOf(mos) {
  return String(mos || '').toUpperCase().slice(0, 2);
}

function fetchSeries(series) {
  if (ready.has(series)) return Promise.resolve(ready.get(series));
  if (pending.has(series)) return pending.get(series);

  const load = bySeries.get(series);
  if (!load) {
    ready.set(series, null);
    return Promise.resolve(null);
  }

  const p = load().then((mod) => {
    const file = mod.default || mod;
    const specs = new Map();
    for (const [code, [title, duties]] of Object.entries(file.MOS || {})) {
      specs.set(code, { mos: code, title, duties, version: file.version });
    }
    ready.set(series, specs);
    pending.delete(series);
    return specs;
  }).catch(() => {
    // A missing or malformed series file just means no description to show.
    ready.set(series, null);
    pending.delete(series);
    return null;
  });

  pending.set(series, p);
  return p;
}

/** The spec if its series is already loaded, else undefined. */
export function peekMosSpec(mos) {
  const specs = ready.get(seriesOf(mos));
  if (specs === undefined) return undefined;
  return (specs && specs.get(String(mos).toUpperCase())) || null;
}

/** @returns Promise<{mos, title, duties, version}|null> */
export function loadMosSpec(mos) {
  const code = String(mos || '').toUpperCase();
  if (!/^[0-9]{2}[A-Z]$/.test(code)) return Promise.resolve(null);
  return fetchSeries(seriesOf(code)).then((specs) => (specs && specs.get(code)) || null);
}
