import React, { createContext, useContext, useMemo } from 'react';
import { buildMosPalette, fallbackEntry } from '../model/taxonomy.js';
import { useMosSpecs } from './useMosSpec.js';

// Colours are assigned across the whole loaded structure rather than derived
// from the code itself, so the MOS codes actually present get the furthest-apart
// colours available. That makes the palette model-scoped, hence the context.
//
// The official MOS titles ride along with it. The root's MOS list is every code
// in the structure, so loading them once here saves every box, chip and legend
// row from doing its own asynchronous lookup.
const MosPaletteContext = createContext(null);

export function MosPaletteProvider({ model, children }) {
  const topMos = model ? model.byId.get(model.rootId).topMos : [];
  const palette = useMemo(() => buildMosPalette(topMos), [model]);
  const codes = useMemo(() => topMos.map((m) => m.mos), [model]);
  const spec = useMosSpecs(codes);
  const value = useMemo(() => ({ palette, spec }), [palette, spec]);

  return <MosPaletteContext.Provider value={value}>{children}</MosPaletteContext.Provider>;
}

/**
 * @returns (mos) => { mos, label, title, hue, color, dim }
 *
 * `title` is the MOS's own name ("Wheeled Vehicle Mechanic"); `label` is the
 * branch it sits in ("Maintenance"), which is all there is for the officer and
 * warrant codes that the enlisted chapter doesn't cover.
 */
export function useMosInfo() {
  const ctx = useContext(MosPaletteContext);
  return useMemo(() => (mos) => {
    const key = String(mos || '').toUpperCase();
    const entry = (ctx && ctx.palette && ctx.palette.get(key)) || fallbackEntry(key);
    const found = ctx && ctx.spec ? ctx.spec(key) : null;
    return found ? { ...entry, title: found.title } : entry;
  }, [ctx]);
}
