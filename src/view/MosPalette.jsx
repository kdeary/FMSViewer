import React, { createContext, useContext, useMemo } from 'react';
import { buildMosPalette, fallbackEntry } from '../model/taxonomy.js';
import { useSupplement } from './Supplement.jsx';

// Colours are assigned across the whole loaded structure rather than derived
// from the code itself, so the MOS codes actually present get the furthest-apart
// colours available. That makes the palette model-scoped, hence the context.
const MosPaletteContext = createContext(null);

export function MosPaletteProvider({ model, children }) {
  const topMos = model ? model.byId.get(model.rootId).topMos : [];
  const palette = useMemo(() => buildMosPalette(topMos), [model]);
  const value = useMemo(() => ({ palette }), [palette]);

  return <MosPaletteContext.Provider value={value}>{children}</MosPaletteContext.Provider>;
}

/**
 * @returns (mos) => { mos, label, title, description, hue, color, dim }
 *
 * `title` is the MOS's own name ("Wheeled Vehicle Mechanic") from the
 * Supplement Table, when it has one; `label` is the branch it sits in
 * ("Maintenance"). `description` is the supplement's.
 */
export function useMosInfo() {
  const ctx = useContext(MosPaletteContext);
  const { getMos } = useSupplement();
  return useMemo(() => (mos) => {
    const key = String(mos || '').toUpperCase();
    const entry = (ctx && ctx.palette && ctx.palette.get(key)) || fallbackEntry(key);
    const sup = getMos(key);
    return {
      ...entry,
      ...(sup?.name ? { title: sup.name } : null),
      description: sup?.description || '',
    };
  }, [ctx, getMos]);
}
