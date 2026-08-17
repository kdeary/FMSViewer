import React, { createContext, useContext } from 'react';

/**
 * App settings, for the few places too deep in the tree to take them as a prop
 * without threading them through components that have no other use for them --
 * `ImagePlaceholder` renders inside the map (via SummaryFace/DetailFace) and
 * independently inside SidePanel, so a prop would mean plumbing settings
 * through both paths. Same shape as MosPaletteProvider, for the same reason.
 */
const SettingsContext = createContext({ unitSymbols: false });

export function SettingsProvider({ settings, children }) {
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
