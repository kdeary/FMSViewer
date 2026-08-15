import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FileDrop from './ui/FileDrop.jsx';
import ProgressPanel from './ui/ProgressPanel.jsx';
import TopBar from './ui/TopBar.jsx';
import SidePanel from './ui/SidePanel.jsx';
import Legend from './ui/Legend.jsx';
import MapCanvas from './view/MapCanvas.jsx';
import SettingsModal from './ui/SettingsModal.jsx';
import { MosPaletteProvider } from './view/MosPalette.jsx';
import { useViewport } from './view/useViewport.js';
import { zoomToOpen, DEFAULT_DETAIL_PCT, DETAIL_PCT_RANGE } from './view/lod.js';

const SETTINGS_KEY = 'fmsviewer.settings';

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    const pct = Number(saved?.detailPct);
    if (pct >= DETAIL_PCT_RANGE[0] && pct <= DETAIL_PCT_RANGE[1]) return { detailPct: pct };
  } catch { /* fall through to the default */ }
  return { detailPct: DEFAULT_DETAIL_PCT };
}
import { hydrate, parseModelFile, toBlob, suggestedFileName } from './model/modelFile.js';

export default function App() {
  const [stage, setStage] = useState('idle'); // idle | parsing | ready
  const [model, setModel] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage disabled */ }
  }, [settings]);

  const workerRef = useRef(null);
  const pendingFit = useRef(false);
  const { surfaceRef, cam, size, flying, flyTo, zoomBy } = useViewport();

  // --- loading -------------------------------------------------------------

  const parseSheet = useCallback((file) => {
    setError('');
    setFileName(file.name);
    setStage('parsing');
    setProgress({ pct: 0, label: 'Starting…', phase: 'read' });

    workerRef.current?.terminate();
    const worker = new Worker(new URL('./workers/parseWorker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'progress') setProgress(msg);
      else if (msg.type === 'done') {
        const m = hydrate(msg.model);
        pendingFit.current = true;
        setModel(m);
        setFocusId(m.rootId);
        setSelectedId(null);
        setStage('ready');
        worker.terminate();
        workerRef.current = null;
      } else if (msg.type === 'error') {
        setError(msg.message);
        setStage('idle');
        worker.terminate();
        workerRef.current = null;
      }
    };
    worker.onerror = (e) => {
      setError(e.message || 'The parser crashed while reading that file.');
      setStage('idle');
    };
    worker.postMessage({ file });
  }, []);

  const loadModelFile = useCallback(async (file) => {
    setError('');
    try {
      const m = parseModelFile(await file.text());
      pendingFit.current = true;
      setModel(m);
      setFileName(file.name);
      setFocusId(m.rootId);
      setSelectedId(null);
      setStage('ready');
    } catch (err) {
      setError(err.message);
      setStage('idle');
    }
  }, []);

  const exportModel = useCallback(() => {
    if (!model) return;
    const url = URL.createObjectURL(toBlob(model));
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedFileName(model);
    a.click();
    URL.revokeObjectURL(url);
  }, [model]);

  const reset = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setModel(null); setStage('idle'); setError(''); setProgress(null);
    setSelectedId(null); setFocusId(null);
  }, []);

  useEffect(() => () => workerRef.current?.terminate(), []);

  // --- camera --------------------------------------------------------------

  const goTo = useCallback((id, opts = {}) => {
    if (!model) return;
    const node = model.byId.get(id);
    if (!node) return;
    setFocusId(id);
    setSelectedId(id);
    flyTo(node.rect, {
      margin: node.childIds.length ? 0.92 : 0.6,
      // Clicking a unit anywhere is a request to see inside it, so never stop
      // short of the zoom that opens its level -- fitting it to the screen
      // isn't always enough, and the threshold is the user's to set.
      minK: node.childIds.length ? zoomToOpen(model.levels, node.depth, size.w, settings.detailPct) : 0,
      ...opts,
    });
  }, [model, flyTo, size.w, settings.detailPct]);

  // Frame the whole structure as soon as the surface has a size.
  useEffect(() => {
    if (!model || !pendingFit.current || !size.w) return;
    pendingFit.current = false;
    flyTo(model.byId.get(model.rootId).rect, { instant: true });
  }, [model, size, flyTo]);

  const fitAll = useCallback(() => {
    if (!model) return;
    setFocusId(model.rootId);
    setSelectedId(null);
    flyTo(model.byId.get(model.rootId).rect);
  }, [model, flyTo]);

  const goUp = useCallback(() => {
    if (!model || !focusId) return;
    const node = model.byId.get(focusId);
    if (node?.parentId && model.byId.has(node.parentId)) goTo(node.parentId);
    else fitAll();
  }, [model, focusId, goTo, fitAll]);

  useEffect(() => {
    const onKey = (e) => {
      // The target is only an element when something is focused -- a bare
      // keypress on the document would otherwise blow up on .matches().
      if (e.target instanceof Element && e.target.matches('input, textarea, button')) return;
      if (settingsOpen) return; // the modal owns the keyboard while it's up
      if (e.key === 'Escape') goUp();
      else if (e.key === 'f' || e.key === 'F') fitAll();
      else if (e.key === '+' || e.key === '=') zoomBy(1.4, size.w / 2, size.h / 2);
      else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.4, size.w / 2, size.h / 2);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goUp, fitAll, zoomBy, size, settingsOpen]);

  // Root -> focused node, for the breadcrumb trail.
  const path = useMemo(() => {
    if (!model || !focusId) return [];
    const chain = [];
    let id = focusId;
    while (id && model.byId.has(id)) {
      const n = model.byId.get(id);
      chain.unshift(n);
      id = n.parentId;
    }
    return chain;
  }, [model, focusId]);

  const selected = selectedId ? model?.byId.get(selectedId) : null;

  // --- render --------------------------------------------------------------

  if (stage === 'idle') {
    return (
      <div className="app-shell app-centered">
        <FileDrop onSheet={parseSheet} onModel={loadModelFile} error={error} />
      </div>
    );
  }

  if (stage === 'parsing') {
    return (
      <div className="app-shell app-centered">
        <ProgressPanel progress={progress} fileName={fileName} />
      </div>
    );
  }

  return (
    <MosPaletteProvider model={model}>
      <div className="app-shell">
        <TopBar
          model={model}
          path={path}
          onGo={goTo}
          onExport={exportModel}
          onLoadModel={loadModelFile}
          onReset={reset}
          onZoomIn={() => zoomBy(1.4, size.w / 2, size.h / 2)}
          onZoomOut={() => zoomBy(1 / 1.4, size.w / 2, size.h / 2)}
          onFit={fitAll}
          legendOpen={legendOpen}
          onToggleLegend={() => setLegendOpen((v) => !v)}
          warnings={model.meta.warnings}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <div className="app-body">
          <MapCanvas
            containerRef={surfaceRef}
            model={model}
            cam={cam}
            size={size}
            selectedId={selectedId}
            focusId={focusId}
            flying={flying}
            onSelect={goTo}
            detailPct={settings.detailPct}
          />
          {legendOpen && <Legend model={model} onClose={() => setLegendOpen(false)} />}
          {selected && (
            <SidePanel node={selected} model={model} onGo={goTo} onClose={() => setSelectedId(null)} />
          )}
        </div>

        <div className="statusbar text-body-secondary small">
          <span>{model.meta.nodeCount} nodes</span>
          <span>{model.meta.rowCount} rows</span>
          <span>parsed in {model.meta.parseMs ?? 0} ms</span>
          <span className="ms-auto">zoom {cam.k.toFixed(2)}×</span>
          <span>Esc = up · F = fit · scroll = zoom · drag = pan</span>
        </div>

        <SettingsModal
          open={settingsOpen}
          settings={settings}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
        />
      </div>
    </MosPaletteProvider>
  );
}
