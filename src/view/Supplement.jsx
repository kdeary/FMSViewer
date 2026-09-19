import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { indexSupplement, normCode } from '../model/supplement.js';
import { guessTag } from '../model/equipmentTags.js';

// The Supplement Table (LIN and MOS details imported from an AI, then edited
// by hand), indexed by code and shared by everything that draws a LIN or MOS,
// plus which detail modal (equipment or MOS) is open -- ui/DetailModals.jsx
// draws them. App owns the rows, since they are saved into the model file.
//
// Three contexts rather than one, because of who reads them. Every map box
// reads the table (through its MOS colours and equipment chips), so the table
// context must only change when the rows do. The open/close functions never
// change at all. Only the modals themselves read which one is open -- when that
// lived in the shared value, opening or closing a modal re-rendered the map.
const DataContext = createContext(null);
const ActionsContext = createContext(null);
const DetailContext = createContext(null);

export function SupplementProvider({ rows, onChange, children }) {
  const [detail, setDetail] = useState(null); // { kind: 'eq', item } | { kind: 'mos', mos }

  const data = useMemo(() => {
    const index = indexSupplement(rows);
    const lin = (code) => index.lin.get(normCode(code)) || null;
    const mos = (code) => index.mos.get(normCode(code)) || null;
    // Guesses are cached per name: tagging runs a dozen regexes, and lists ask
    // for every item on each render.
    const guesses = new Map();
    return {
      ...index,
      setRows: onChange,
      /** Supplement row for a LIN / MOS, or null. */
      getLin: lin,
      getMos: mos,
      /** The supplement nomenclature when there is one, otherwise the FMS name. */
      displayName: (item) => lin(item?.lin)?.name || item?.name || '',
      /** General category: the supplement's tag, else a keyword guess from the names. */
      tagOf: (item) => {
        const row = lin(item?.lin);
        if (row?.tag) return row.tag;
        const key = `${item?.name || ''}|${row?.name || ''}`;
        let tag = guesses.get(key);
        if (!tag) { tag = guessTag(item?.name, row?.name); guesses.set(key, tag); }
        return tag;
      },
    };
  }, [rows, onChange]);

  const closeDetail = useCallback(() => setDetail(null), []);
  const actions = useMemo(() => ({
    open: (item) => setDetail({ kind: 'eq', item }),
    openMos: (code) => setDetail({ kind: 'mos', mos: normCode(code) }),
    closeDetail,
  }), [closeDetail]);

  const detailValue = useMemo(() => ({ detail, detailOpen: !!detail }), [detail]);

  return (
    <DataContext.Provider value={data}>
      <ActionsContext.Provider value={actions}>
        <DetailContext.Provider value={detailValue}>{children}</DetailContext.Provider>
      </ActionsContext.Provider>
    </DataContext.Provider>
  );
}

const EMPTY_DATA = {
  ...indexSupplement([]),
  setRows: () => {},
  getLin: () => null,
  getMos: () => null,
  displayName: (item) => item?.name || '',
  tagOf: (item) => guessTag(item?.name),
};
const NO_ACTIONS = { open: () => {}, openMos: () => {}, closeDetail: () => {} };
const NO_DETAIL = { detail: null, detailOpen: false };

/**
 * The table and its lookups, plus the functions that open the detail modals.
 * Changes only when the rows do.
 */
export function useSupplement() {
  const data = useContext(DataContext) || EMPTY_DATA;
  const actions = useContext(ActionsContext) || NO_ACTIONS;
  return useMemo(() => ({ ...data, ...actions }), [data, actions]);
}

/** Just the functions that open and close the detail modals; never changes. */
export function useDetailActions() {
  return useContext(ActionsContext) || NO_ACTIONS;
}

/** Which detail modal is open. For the modals themselves and whatever sits under them. */
export function useDetail() {
  return useContext(DetailContext) || NO_DETAIL;
}
