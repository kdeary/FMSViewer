import { useEffect, useMemo, useState } from 'react';
import { loadMosSpec, peekMosSpec } from '../model/mosSpecs.js';

const peekAll = (codes) => new Map(codes.map((c) => [c, peekMosSpec(c) || null]));

/**
 * The DA PAM 611-21 entry for an MOS, or null when there isn't one (officer and
 * warrant codes aren't in the enlisted chapter).
 *
 * `undefined` while the series file is still loading, so callers can tell
 * "nothing to show" apart from "not known yet" and avoid a flash of empty
 * space on a series that is already cached.
 */
export function useMosSpec(mos) {
  const [spec, setSpec] = useState(() => peekMosSpec(mos));

  useEffect(() => {
    const known = peekMosSpec(mos);
    setSpec(known);
    if (known !== undefined) return undefined;

    let live = true;
    loadMosSpec(mos).then((s) => { if (live) setSpec(s); });
    return () => { live = false; };
  }, [mos]);

  return spec;
}

/**
 * Specs for a whole set of codes at once, as a Map of code -> spec | null.
 *
 * A structure's MOS list spans several series, so this pulls in several files.
 * Entries appear as null until their series arrives; callers show their
 * fallback in the meantime rather than an empty row.
 */
export function useMosSpecs(codes) {
  const key = codes.join(',');
  const [specs, setSpecs] = useState(() => peekAll(codes));

  useEffect(() => {
    const list = key ? key.split(',') : [];
    setSpecs(peekAll(list));

    let live = true;
    Promise.all(list.map(loadMosSpec)).then((found) => {
      if (live) setSpecs(new Map(list.map((c, i) => [c, found[i]])));
    });
    return () => { live = false; };
  }, [key]);

  return useMemo(() => (mos) => specs.get(mos) || null, [specs]);
}
