import React, { createContext, useContext, useMemo } from 'react';
import { buildMosPalette, fallbackEntry } from '../model/taxonomy.js';

// Colours are assigned across the whole loaded structure rather than derived
// from the code itself, so the MOS codes actually present get the furthest-apart
// colours available. That makes the palette model-scoped, hence the context.
const MosPaletteContext = createContext(null);

export function MosPaletteProvider({ model, children }) {
  const palette = useMemo(
    () => buildMosPalette(model ? model.byId.get(model.rootId).topMos : []),
    [model],
  );
  return <MosPaletteContext.Provider value={palette}>{children}</MosPaletteContext.Provider>;
}

/** @returns (mos) => { mos, label, hue, color, dim } */
export function useMosInfo() {
  const palette = useContext(MosPaletteContext);
  return useMemo(() => (mos) => {
    const key = String(mos || '').toUpperCase();
    return (palette && palette.get(key)) || fallbackEntry(key);
  }, [palette]);
}
