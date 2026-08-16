import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FileDrop from './ui/FileDrop.jsx';
import ProgressPanel from './ui/ProgressPanel.jsx';
import TopBar from './ui/TopBar.jsx';
import SidePanel from './ui/SidePanel.jsx';
import Legend from './ui/Legend.jsx';
import MapCanvas from './view/MapCanvas.jsx';
import SettingsModal from './ui/SettingsModal.jsx';
import ExportModal from './ui/ExportModal.jsx';
import SearchPanel from './ui/SearchPanel.jsx';
import { buildSvg, svgToPng, imageFileName } from './model/exportImage.js';
import { MosPaletteProvider } from './view/MosPalette.jsx';
import { useViewport } from './view/useViewport.js';
import { useTooltips } from './view/useTooltips.js';
import { zoomToOpen, zoomToReveal, DEFAULT_MIN_TEXT_PX, MIN_TEXT_PX_RANGE } from './view/lod.js';

const SETTINGS_KEY = 'fmsviewer.settings';

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    const px = Number(saved?.minTextPx ?? saved?.detailPct);
    const perf = !!saved?.perf;
    if (px >= MIN_TEXT_PX_RANGE[0] && px <= MIN_TEXT_PX_RANGE[1]) return { minTextPx: px, detailPct: px, perf };
    return { minTextPx: DEFAULT_MIN_TEXT_PX, detailPct: DEFAULT_MIN_TEXT_PX, perf };
  } catch { /* fall through to the default */ }
  return { minTextPx: DEFAULT_MIN_TEXT_PX, detailPct: DEFAULT_MIN_TEXT_PX, perf: false };
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
  const [exportOpen, setExportOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // The search scope is pinned rather than following the focus, so working
  // through a list of results doesn't narrow the search out from under you.
  // Null means the whole structure.
  const [searchScopeId, setSearchScopeId] = useState(null);
  const [searchPicking, setSearchPicking] = useState(false);
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage disabled */ }
  }, [settings]);

  const workerRef = useRef(null);
  const pendingFit = useRef(false);
  const { surfaceRef, cam, size, flying, flyTo, zoomBy, setCam } = useViewport();
  useTooltips();
  // Read through a ref, so `goTo` doesn't get a new identity on every frame of
  // a flight and re-subscribe the key handler sixty times a second.
  const camRef = useRef(cam);
  camRef.current = cam;

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
        setSearchScopeId(null);
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
      setSearchScopeId(null);
      setStage('ready');
    } catch (err) {
      setError(err.message);
      setStage('idle');
    }
  }, []);

  const download = useCallback((blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportModel = useCallback(() => {
    if (!model) return;
    download(toBlob(model), suggestedFileName(model));
  }, [model, download]);

  // `mosColor` comes from the modal, which sits inside the palette provider:
  // an exported image and the screen it came from have to agree on colours.
  const exportImage = useCallback(async (nodeId, detail, mosColor) => {
    if (!model) return;
    const node = model.byId.get(nodeId);
    if (!node) throw new Error('That unit is no longer in the model.');
    const { svg, width, height } = buildSvg(model, nodeId, detail, { mosColor });
    download(await svgToPng(svg, width, height), imageFileName(model, node));
  }, [model, download]);

  const reset = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setModel(null); setStage('idle'); setError(''); setProgress(null);
    setSelectedId(null); setFocusId(null);
    setSearchScopeId(null); setSearchPicking(false);
    // Nothing about where the last structure was being viewed means anything
    // for the next one, and a camera left deep inside the old world would show
    // empty space until something re-framed it.
    setCam({ x: 0, y: 0, k: 1 });
  }, [setCam]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  // --- camera --------------------------------------------------------------

  const goTo = useCallback((id, opts = {}) => {
    if (!model) return;
    const node = model.byId.get(id);
    if (!node) return;
    const minTextPx = settings.minTextPx ?? settings.detailPct;
    const hasKids = node.childIds.length > 0;

    const leftPanel = document.querySelector('.search-panel');
    const offsetLeft = leftPanel ? leftPanel.offsetWidth : 0;

    const rightPanel = document.querySelector('.side-panel');
    const defaultPanelW = size.w <= 720 ? size.w : Math.min(352, size.w * 0.4);
    const offsetRight = rightPanel ? rightPanel.offsetWidth : defaultPanelW;

    const availW = Math.max(1, size.w - offsetLeft - offsetRight);

    let minK = zoomToReveal(node, model.byId, availW, minTextPx);
    if (hasKids) {
      // A unit is a request to see inside it, so open its level as well.
      minK = Math.max(minK, zoomToOpen(node, availW, minTextPx, model.byId));
    } else {
      // A soldier has nothing to open, and is the smallest thing on the map:
      // there is never a reason to pull back from one. Clicking at a closer
      // zoom than the fit just centres it.
      minK = Math.max(minK, camRef.current.k);
    }

    setFocusId(id);
    setSelectedId(id);
    flyTo(node.rect, { margin: hasKids ? 0.92 : 0.6, minK, offsetLeft, offsetRight, ...opts });
  }, [model, flyTo, size.w, settings.minTextPx, settings.detailPct]);

  // Clicks on the map. Identical to `goTo` except while the search panel is
  // waiting to be told what to search -- only a click out here sets that, never
  // a click on a result.
  const selectOnMap = useCallback((id) => {
    if (searchPicking && model?.byId.has(id)) {
      setSearchScopeId(id);
      setSearchPicking(false);
    }
    goTo(id);
  }, [goTo, model, searchPicking]);

  // Frame the whole structure as soon as the surface has a size.
  //
  // The flag is only cleared once the fit has actually happened. On a re-import
  // the map remounts and this can run against a surface that has no layout yet;
  // clearing up front left that attempt as the only one, and the camera stayed
  // wherever the previous structure had left it -- pointing, in general, at
  // nothing in the new one.
  useEffect(() => {
    if (!model || !pendingFit.current || !size.w) return;
    if (flyTo(model.byId.get(model.rootId).rect, { instant: true })) {
      pendingFit.current = false;
    }
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
      if (settingsOpen || exportOpen) return; // a modal owns the keyboard while it's up
      if (e.key === 'Escape') goUp();
      else if (e.key === 'f' || e.key === 'F') fitAll();
      else if (e.key === '+' || e.key === '=') zoomBy(1.4, size.w / 2, size.h / 2);
      else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.4, size.w / 2, size.h / 2);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goUp, fitAll, zoomBy, size, settingsOpen, exportOpen]);

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
          onExport={() => setExportOpen(true)}
          onLoadModel={loadModelFile}
          onReset={reset}
          onZoomIn={() => zoomBy(1.4, size.w / 2, size.h / 2)}
          onZoomOut={() => zoomBy(1 / 1.4, size.w / 2, size.h / 2)}
          onFit={fitAll}
          legendOpen={legendOpen}
          onToggleLegend={() => setLegendOpen((v) => !v)}
          warnings={model.meta.warnings}
          onOpenSettings={() => setSettingsOpen(true)}
          searchOpen={searchOpen}
          onToggleSearch={() => { setSearchOpen((v) => !v); setSearchPicking(false); }}
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
            onSelect={selectOnMap}
            detailPct={settings.detailPct}
            perf={settings.perf}
          />
          {searchOpen && (
            <SearchPanel
              model={model}
              scopeNode={model.byId.get(searchScopeId) || model.byId.get(model.rootId)}
              picking={searchPicking}
              onPick={() => setSearchPicking((v) => !v)}
              onGo={goTo}
              onClose={() => { setSearchOpen(false); setSearchPicking(false); }}
            />
          )}
          {legendOpen && <Legend model={model} onClose={() => setLegendOpen(false)} />}
          {selected && (
            <SidePanel node={selected} model={model} onGo={goTo} onClose={() => setSelectedId(null)} />
          )}
        </div>

        <div className="statusbar text-body-secondary small">
          <div className="status-file">
            <span className="fw-semibold text-body">{model.meta.uic || '—'}</span>
            <span title={model.meta.sourceFile}>{model.meta.sourceFile}</span>
            {model.meta.runDate && <span>run {model.meta.runDate}</span>}
          </div>
          <div className="vr" />
          <span>{model.meta.nodeCount} nodes</span>
          <span>{model.meta.rowCount} rows</span>
          <span>parsed in {model.meta.parseMs ?? 0} ms</span>
          <div className="vr ms-auto" />
          <span>zoom {cam.k.toFixed(2)}×</span>
          <div className="vr" />
          <span className="d-none d-lg-inline">Esc = up | F = fit | scroll = zoom | drag = pan</span>
          <div className="vr" />
          <span className="d-none d-lg-inline">Developed by 2LT Korbin Deary</span>
        </div>

        <SettingsModal
          open={settingsOpen}
          settings={settings}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
        />

        <ExportModal
          open={exportOpen}
          model={model}
          focusNode={focusId ? model.byId.get(focusId) : null}
          onExportModel={exportModel}
          onExportImage={exportImage}
          onClose={() => setExportOpen(false)}
        />
      </div>
    </MosPaletteProvider>
  );
}
