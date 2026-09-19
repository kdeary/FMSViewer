import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  TYPES, amendRows, buildPrompt, makeRow, normCode, parseSupplementCsv, toCsv, uniqueLins, uniqueMos,
} from '../model/supplement.js';
import { useSupplement } from '../view/Supplement.jsx';
import { useMosInfo } from '../view/MosPalette.jsx';
import { TAGS, guessTag } from '../model/equipmentTags.js';
import { useStreamed, afterPaint } from '../view/useStreamed.js';

function downloadText(text, name, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Stats modal tab for the Supplement Table: a copyable prompt listing every
 * LIN and MOS in the unit, which any LLM turns into a TYPE,CODE,NAME,DESCRIPTION
 * CSV; the import for that CSV (amending or replacing the table); and the
 * table itself, every cell editable, exportable back to CSV.
 */
export default function SupplementTab({ root, censored, onProgress, active = true, closing = false, onDrained }) {
  const sup = useSupplement();
  const mosInfo = useMosInfo();
  const [missingOnly, setMissingOnly] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState('amend'); // 'amend' | 'replace'
  const [status, setStatus] = useState(null); // { kind: 'success' | 'danger', text }
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  // An import in progress: { label, pct } while reading, parsing and applying.
  const [busy, setBusy] = useState(null);
  // Set once an import is applied, while its rows stream in; that streaming is
  // the second half (50-100%) of the import's progress.
  const [importing, setImporting] = useState(false);
  const promptRef = useRef(null);

  const lins = useMemo(() => uniqueLins(root), [root]);
  const fmsNames = useMemo(() => new Map(lins.map((l) => [l.code, l.name])), [lins]);
  const mos = useMemo(() => uniqueMos(root, (m) => mosInfo(m).officialTitle), [root, mosInfo]);
  const linsCovered = lins.filter((l) => sup.lin.has(l.code)).length;
  const mosCovered = mos.filter((m) => sup.mos.has(m.code)).length;
  const promptLins = missingOnly ? lins.filter((l) => !sup.lin.has(l.code)) : lins;
  const promptMos = missingOnly ? mos.filter((m) => !sup.mos.has(m.code)) : mos;
  const prompt = useMemo(() => buildPrompt(promptLins, promptMos), [lins, mos, missingOnly, sup.lin, sup.mos]);
  const missing = lins.length - linsCovered + mos.length - mosCovered;
  const hasTable = sup.rows.length > 0;

  const shownRows = useMemo(() => {
    const terms = filter.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return sup.rows.filter((r) => {
      if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
      const hay = `${r.code} ${r.name} ${r.tag} ${r.description}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [sup.rows, filter, typeFilter]);

  // A few hundred rows of inputs is thousands of elements; stream them in
  // rather than freezing the tab while they all mount. The list starts over on
  // a new filter or a replaced table (whose rows all have new ids), and keeps
  // what it has shown when rows are only edited or appended.
  //
  // While the tab is hidden it holds no rows at all. The stats modal keeps
  // this tab mounted so an import can finish in the background, and a fully
  // loaded table left in the hidden DOM had to be laid out all at once the
  // moment the tab was shown again -- seconds of freeze for a big table. Now
  // showing the tab starts the stream over, with its progress on screen.
  const streamKey = `${active}|${filter}|${typeFilter}|${sup.rows[0]?.id || ''}`;
  const { shown: streamedRows, done: allShown, progress: rowFraction } = useStreamed(
    active ? shownRows : NO_ROWS,
    streamKey,
  );

  useEffect(() => { if (allShown) setImporting(false); }, [allShown]);

  // Closing the modal with a big table showing: tearing down a thousand rows
  // in one go froze the page for a moment, so the table is hidden at once and
  // its rows removed a chunk at a time behind "Closing…" progress; the modal
  // closes after.
  const [drain, setDrain] = useState(null); // { from, left } while closing
  const onDrainedRef = useRef(onDrained);
  onDrainedRef.current = onDrained;
  useEffect(() => {
    if (!closing) { setDrain(null); return; }
    const n = streamedRows.length;
    if (n <= DRAIN_STEP) onDrainedRef.current?.(); // small enough to just close
    else setDrain({ from: n, left: n });
  }, [closing]); // only on the change: the row count is read once, when closing starts
  useEffect(() => {
    if (!drain) return undefined;
    if (drain.left <= 0) { onDrainedRef.current?.(); return undefined; }
    const id = setTimeout(() => setDrain((d) => d && { ...d, left: Math.max(0, d.left - DRAIN_STEP) }), 0);
    return () => clearTimeout(id);
  }, [drain]);
  const visibleRows = drain ? streamedRows.slice(0, drain.left) : streamedRows;

  // Reported to the stats modal, which shows it on this tab and above the page.
  let progress = null;
  if (censored) progress = null;
  else if (drain) progress = { label: 'Closing…', pct: (1 - drain.left / drain.from) * 100 };
  else if (busy) progress = busy;
  else if (!allShown) {
    progress = {
      label: `Loading rows… ${streamedRows.length} of ${shownRows.length}`,
      pct: importing ? 50 + rowFraction * 50 : rowFraction * 100,
    };
  }
  const progressLabel = progress?.label;
  const progressPct = progress ? Math.round(progress.pct) : null;
  useEffect(() => {
    onProgress?.(progressLabel == null ? null : { label: progressLabel, pct: progressPct });
  }, [onProgress, progressLabel, progressPct]);
  useEffect(() => () => onProgress?.(null), [onProgress]);

  const { setRows } = sup;
  // Stable, so memoized rows only re-render when their own row changes.
  const update = useCallback((id, field, value) => {
    const v = field === 'code' || field === 'type' ? normCode(value) : value;
    setRows((cur) => cur.map((r) => {
      if (r.id !== id || r[field] === v) return r;
      // MOS rows have no tag.
      return field === 'type' && v === 'MOS' ? { ...r, type: v, tag: '' } : { ...r, [field]: v };
    }));
  }, [setRows]);
  const remove = useCallback((id) => setRows((cur) => cur.filter((r) => r.id !== id)), [setRows]);

  if (censored) {
    return (
      <p className="text-body-secondary small mb-0">
        The Supplement Table is hidden while censor mode is on, since it lists the real LINs and MOSs.
        Turn censor mode off in Settings to view or edit it.
      </p>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      promptRef.current?.select();
      document.execCommand('copy');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStatus(null);
    try {
      // Each step waits for a paint first, so its label is on screen while the
      // (synchronous) step runs rather than the page just going still.
      setBusy({ label: `Reading ${file.name}…`, pct: 5 });
      await afterPaint();
      const text = await file.text();
      setBusy({ label: 'Parsing CSV…', pct: 20 });
      await afterPaint();
      const { rows, skipped } = parseSupplementCsv(text);
      const replacing = mode === 'replace' || !hasTable;
      setBusy({ label: `Updating the table and map with ${rows.length} rows…`, pct: 40 });
      await afterPaint();
      sup.setRows((cur) => (replacing ? rows : amendRows(cur, rows)));
      setImporting(true);
      setBusy(null);
      const nLin = rows.filter((r) => r.type === 'LIN').length;
      const nMos = rows.length - nLin;
      setStatus({
        kind: 'success',
        text: `${replacing ? 'Loaded' : 'Amended the table with'} ${rows.length} row${rows.length === 1 ? '' : 's'} (${nLin} LIN, ${nMos} MOS)`
          + `${skipped ? ` · ${skipped} unusable row${skipped === 1 ? '' : 's'} skipped` : ''}.`,
      });
    } catch (err) {
      setBusy(null);
      setStatus({ kind: 'danger', text: err.message || 'That file could not be read.' });
    }
  };

  const addRow = () => {
    setFilter('');
    sup.setRows((cur) => [...cur, makeRow({ type: typeFilter === 'MOS' ? 'MOS' : 'LIN' })]);
  };
  const clear = () => {
    if (!window.confirm('Delete every row of the Supplement Table?')) return;
    sup.setRows([]);
    setStatus(null);
  };

  return (
    <div>
      <div className="p-2 mb-3 border rounded bg-body-tertiary small d-flex flex-wrap align-items-center gap-3">
        <span>
          <strong className="text-body">{linsCovered}</strong>
          <span className="text-body-secondary"> of </span>
          <strong className="text-body">{lins.length}</strong>
          <span className="text-body-secondary"> LINs</span>
        </span>
        <span>
          <strong className="text-body">{mosCovered}</strong>
          <span className="text-body-secondary"> of </span>
          <strong className="text-body">{mos.length}</strong>
          <span className="text-body-secondary"> MOSs</span>
        </span>
        <span className="text-body-secondary">in this unit are in the Supplement Table ({sup.rows.length} rows)</span>
      </div>

      <h3 className="h6 fw-semibold mb-1">1. Copy this prompt into any AI chat</h3>
      <p className="small text-body-secondary mb-2">
        It lists every LIN and MOS in the unit and asks for a CSV with <code>TYPE</code>, <code>CODE</code>,{' '}
        <code>NAME</code>, <code>TAG</code> and <code>DESCRIPTION</code> columns. For large units, an AI may stop partway — ask it to
        continue, or import what you get and re-copy with “only codes not in the table”.
      </p>
      <textarea
        ref={promptRef}
        className="form-control eq-prompt mb-2"
        readOnly
        value={prompt}
        aria-label="AI prompt"
        onFocus={(e) => e.target.select()}
      />
      <div className="d-flex flex-wrap align-items-center gap-2 mb-4">
        <button type="button" className="btn btn-primary btn-sm" onClick={copy}>
          <i className={`bi ${copied ? 'bi-check2' : 'bi-clipboard'} me-1`} />{copied ? 'Copied' : 'Copy prompt'}
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => downloadText(prompt, 'supplement-table-prompt.txt', 'text/plain')}
        >
          <i className="bi bi-download me-1" />Download .txt
        </button>
        <div className="form-check form-check-inline small ms-sm-2 mb-0">
          <input
            id="sup-missing-only"
            className="form-check-input"
            type="checkbox"
            checked={missingOnly}
            onChange={(e) => setMissingOnly(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="sup-missing-only">
            Only codes not in the table ({missing})
          </label>
        </div>
      </div>

      <h3 className="h6 fw-semibold mb-1">2. Import the CSV the AI returns</h3>
      <p className="small text-body-secondary mb-2">
        Save the AI's answer as a <code>.csv</code> file and choose it below. The table is saved inside the
        .fmsmodel.json when you export the model.
      </p>
      {hasTable && (
        <div className="d-flex flex-wrap gap-3 small mb-2" role="radiogroup" aria-label="Import mode">
          <div className="form-check mb-0">
            <input
              id="sup-mode-amend"
              className="form-check-input"
              type="radio"
              name="sup-mode"
              checked={mode === 'amend'}
              onChange={() => setMode('amend')}
            />
            <label className="form-check-label" htmlFor="sup-mode-amend">
              Amend current table <span className="text-body-secondary">(adds new codes, overwrites matching ones)</span>
            </label>
          </div>
          <div className="form-check mb-0">
            <input
              id="sup-mode-replace"
              className="form-check-input"
              type="radio"
              name="sup-mode"
              checked={mode === 'replace'}
              onChange={() => setMode('replace')}
            />
            <label className="form-check-label" htmlFor="sup-mode-replace">
              Replace current table
            </label>
          </div>
        </div>
      )}
      <input
        type="file"
        className="form-control form-control-sm"
        accept=".csv,text/csv,.txt,text/plain"
        aria-label="Import Supplement Table CSV"
        onChange={onFile}
        disabled={!!busy}
      />
      {status && (
        <div className={`alert alert-${status.kind} small py-2 mt-2 mb-0`} role="status">
          {status.text}
        </div>
      )}

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-4 mb-2">
        <h3 className="h6 fw-semibold mb-0">3. Supplement Table</h3>
        <div className="d-flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={addRow}>
            <i className="bi bi-plus-lg me-1" />Add row
          </button>
          <button
            type="button"
            className="btn btn-outline-info btn-sm"
            disabled={!hasTable}
            onClick={() => downloadText(toCsv(sup.rows), 'supplement-table.csv', 'text/csv')}
          >
            <i className="bi bi-filetype-csv me-1" />Export CSV
          </button>
          <button type="button" className="btn btn-outline-danger btn-sm" disabled={!hasTable} onClick={clear}>
            <i className="bi bi-trash me-1" />Clear
          </button>
        </div>
      </div>

      {hasTable ? (
        <>
          <div className="input-group input-group-sm mb-2">
            <select
              className="form-select flex-grow-0 sup-type-filter"
              aria-label="Filter by type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All</option>
              <option value="LIN">LIN</option>
              <option value="MOS">MOS</option>
            </select>
            <span className="input-group-text"><i className="bi bi-search" /></span>
            <input
              type="search"
              className="form-control"
              placeholder="Filter by code, name or description…"
              aria-label="Filter Supplement Table"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          {/* Hidden while closing: rows removed from a table still on screen
              made the browser re-lay out all the rest after every chunk. */}
          <div className="table-responsive stats-table-container sup-table" hidden={!!drain}>
            <table className="table table-sm table-dark table-borderless align-middle mb-0">
              <thead className="sticky-top border-bottom">
                <tr>
                  <th scope="col" style={{ width: '96px' }}>Type</th>
                  <th scope="col" style={{ width: '104px' }}>Code</th>
                  <th scope="col" style={{ width: '24%' }}>Name</th>
                  <th scope="col" style={{ width: '168px' }}>Tag</th>
                  <th scope="col">Description</th>
                  <th scope="col" style={{ width: '36px' }}><span className="visually-hidden">Delete</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <SupRow key={r.id} row={r} fmsName={fmsNames.get(r.code)} onUpdate={update} onRemove={remove} />
                ))}
                {!allShown && !drain && (
                  <tr>
                    <td colSpan={6} className="text-center text-body-secondary small py-2">
                      <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                      Loading rows… {streamedRows.length} of {shownRows.length}
                    </td>
                  </tr>
                )}
                {!shownRows.length && (
                  <tr>
                    <td colSpan={6} className="text-center text-body-secondary py-4">No rows match the filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="small text-body-secondary mb-0">
          The table is empty. Import a CSV above, or add rows by hand.
        </p>
      )}
    </div>
  );
}

const NO_ROWS = [];
const DRAIN_STEP = 150;

/**
 * One editable row. Memoized: editing a cell replaces only that row object,
 * so only that row re-renders, not the few hundred around it.
 *
 * Cells are uncontrolled and commit on blur, so typing doesn't redraw the
 * whole map on every keystroke. Keying a cell on its value remounts it when
 * the row changes from elsewhere (an amend import), so it never shows stale text.
 */
const SupRow = memo(function SupRow({ row: r, fmsName, onUpdate, onRemove }) {
  const cellKey = (field) => `${r.id}-${field}-${r[field]}`;
  const cell = (field, props) => ({
    defaultValue: r[field],
    onBlur: (e) => onUpdate(r.id, field, e.target.value),
    'aria-label': `${field} for ${r.code || 'new row'}`,
    ...props,
  });
  const onPick = (field) => ({ onChange: (e) => onUpdate(r.id, field, e.target.value) });

  return (
    <tr>
      <td>
        <select key={cellKey('type')} className="form-select form-select-sm sup-cell" {...cell('type', onPick('type'))}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td><input key={cellKey('code')} className="form-control form-control-sm sup-cell font-monospace" {...cell('code')} /></td>
      <td><input key={cellKey('name')} className="form-control form-control-sm sup-cell" {...cell('name')} /></td>
      <td>
        {r.type === 'LIN' ? (
          <select key={cellKey('tag')} className="form-select form-select-sm sup-cell" {...cell('tag', onPick('tag'))}>
            {/* Blank means "use the keyword guess", which is shown so it can be kept or overridden. */}
            <option value="">Auto: {guessTag(fmsName, r.name)}</option>
            {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        ) : <span className="text-body-secondary small ps-2">—</span>}
      </td>
      <td><textarea key={cellKey('description')} rows={2} className="form-control form-control-sm sup-cell" {...cell('description')} /></td>
      <td className="text-end">
        <button
          type="button"
          className="btn btn-link btn-sm text-body-secondary p-0"
          title="Delete row"
          aria-label={`Delete ${r.code || 'row'}`}
          onClick={() => onRemove(r.id)}
        >
          <i className="bi bi-x-lg" />
        </button>
      </td>
    </tr>
  );
});
