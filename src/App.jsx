import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FileDrop from './ui/FileDrop.jsx';
import ProgressPanel from './ui/ProgressPanel.jsx';
import TopBar from './ui/TopBar.jsx';
import SidePanel from './ui/SidePanel.jsx';
import Legend from './ui/Legend.jsx';
import MapCanvas from './view/MapCanvas.jsx';
import SettingsModal from './ui/SettingsModal.jsx';
import StatsModal from './ui/StatsModal.jsx';
import ExportModal from './ui/ExportModal.jsx';
import WarningsModal from './ui/WarningsModal.jsx';
import TreeModal from './ui/TreeModal.jsx';
import AlternateFormatModal from './ui/AlternateFormatModal.jsx';
import DetailModals from './ui/DetailModals.jsx';
import UpdateToast from './ui/UpdateToast.jsx';
import BusyToast from './ui/BusyToast.jsx';
import { withBusyToast } from './view/busy.js';
import { onUpdateAvailable, applyUpdate } from './pwa/register.js';
import { HOME, VIEW, currentRoute, navigate, onRouteChange } from './routing.js';
import SearchPanel from './ui/SearchPanel.jsx';
import Tour from './tutorial/Tour.jsx';
import TutorialOffer from './tutorial/TutorialOffer.jsx';
import { tutorialSeen, markTutorialSeen, loadTourPos, saveTourPos } from './tutorial/storage.js';
import { MosPaletteProvider } from './view/MosPalette.jsx';
import { SettingsProvider } from './view/SettingsContext.jsx';
import { SupplementProvider } from './view/Supplement.jsx';
import { useViewport, overlayOffset } from './view/useViewport.js';
import { useIsMobile, isMobile } from './view/useIsMobile.js';
import { useTooltips } from './view/useTooltips.js';
import { zoomToOpen, zoomToReveal, DEFAULT_MIN_TEXT_PX, MIN_TEXT_PX_RANGE } from './view/lod.js';
import { truncate } from './model/taxonomy.js';

const SETTINGS_KEY = 'fmsviewer.settings';
const NO_ROWS = [];

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    const px = Number(saved?.minTextPx ?? saved?.detailPct);
    const perf = !!saved?.perf;
    // Off unless a prior session turned it on: the symbol is a guess from the
    // title text alone, so a reader who never opted in should never see one
    // silently appear in place of the placeholder icon.
    const unitSymbols = !!saved?.unitSymbols;
    const censor = !!saved?.censor;
    if (px >= MIN_TEXT_PX_RANGE[0] && px <= MIN_TEXT_PX_RANGE[1]) return { minTextPx: px, perf, unitSymbols, censor };
    return { minTextPx: DEFAULT_MIN_TEXT_PX, perf, unitSymbols, censor };
  } catch { /* fall through to the default */ }
  return { minTextPx: DEFAULT_MIN_TEXT_PX, perf: false, unitSymbols: false, censor: false };
}
import { hydrate, parseModelFile, toBlob, suggestedFileName } from './model/modelFile.js';
import { censorModel } from './model/censor.js';

export default function App() {
  const [stage, setStage] = useState('idle'); // idle | parsing | ready
  const [model, setModel] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  // Phones only: the side panel covers the whole map there, so selecting
  // something doesn't open it -- the Details button in the corner does.
  // On a wider screen the panel simply follows the selection.
  const [panelOpen, setPanelOpen] = useState(false);
  const mobile = useIsMobile();
  const [focusId, setFocusId] = useState(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  // Tab the stats modal should open on; null keeps the one it remembers.
  const [statsTab, setStatsTab] = useState(null);
  const [treeOpen, setTreeOpen] = useState(false);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // The search scope is pinned rather than following the focus, so working
  // through a list of results doesn't narrow the search out from under you.
  // Null means the whole structure.
  const [searchScopeId, setSearchScopeId] = useState(null);
  const [searchPicking, setSearchPicking] = useState(false);
  // What's typed in the search box, so a phone can close the panel to show a
  // result and reopen it on the same query.
  const searchDraft = useRef('');
  const [settings, setSettings] = useState(loadSettings);
  // The Supplement Table (see model/supplement.js). It belongs to the loaded
  // structure: saved into and restored from the model file.
  const [supplementRows, setSupplementRows] = useState([]);
  // A structure from the alternate export, parsed but held on the home page
  // until the user accepts that its hierarchy is a reconstruction.
  const [pendingAlt, setPendingAlt] = useState(null); // { model, rows, fileName }
  const [howToSignal, setHowToSignal] = useState(0);
  // A newer build is downloaded and waiting (see pwa/register.js).
  const [updateReady, setUpdateReady] = useState(false);
  const [updateDeferred, setUpdateDeferred] = useState(false);
  // The guided tour, and its first-run offer (see tutorial/).
  const [tourOpen, setTourOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  // Where the tour was left, so Tutorial picks it back up there.
  const tourPos = useRef(loadTourPos());

  const displayModel = useMemo(() => {
    if (!model) return null;
    return settings.censor ? censorModel(model) : model;
  }, [model, settings.censor]);

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

  const showModel = useCallback((m, rows, name) => {
    pendingFit.current = true;
    setModel(m);
    setSupplementRows(rows);
    setFileName(name);
    setFocusId(m.rootId);
    setSelectedId(null); setPanelOpen(false);
    setSearchScopeId(null); setSearchPicking(false);
    // Nothing about where the last structure was being viewed means anything
    // for the next one, and a camera left deep inside the old world would show
    // empty space until something re-framed it.
    setCam({ x: 0, y: 0, k: 1 });
    setStage('ready');
    navigate(VIEW);
  }, [setCam]);

  // Alternate-format structures wait on the home page for the user to decide.
  const openModel = useCallback((m, rows, name) => {
    if (m.meta?.format === 'alternate') {
      setPendingAlt({ model: m, rows, fileName: name });
      setStage('idle');
    } else {
      showModel(m, rows, name);
    }
  }, [showModel]);

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
        openModel(hydrate(msg.model), [], file.name);
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
  }, [openModel]);

  const loadModelFile = useCallback(async (file) => {
    setError('');
    try {
      const { model: m, supplementRows: rows } = parseModelFile(await file.text());
      openModel(m, rows, file.name);
    } catch (err) {
      setError(err.message);
      setStage('idle');
    }
  }, [openModel]);

  const download = useCallback((blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportModel = useCallback(() => {
    if (!displayModel) return;
    // A censored export leaves the table out: its codes are the real ones.
    withBusyToast('Preparing the model file…', () => {
      download(toBlob(displayModel, settings.censor ? [] : supplementRows), suggestedFileName(displayModel));
    });
  }, [displayModel, download, settings.censor, supplementRows]);

  // --- routing (see routing.js) ---------------------------------------------

  // Leaving the viewer for the home page keeps the structure, selection and
  // camera: Back is one swipe away on a phone, and Forward (or Return on the
  // home page) should land where the user was. Only loading another file
  // replaces it. What was floating over the map is closed.
  const leaveView = useCallback(() => {
    setStage('idle'); setError(''); setProgress(null);
    setStatsOpen(false); setTreeOpen(false); setWarningsOpen(false);
    setSettingsOpen(false); setExportOpen(false);
    setSearchPicking(false);
    setTourOpen(false); setOfferOpen(false);
  }, []);

  const goHome = useCallback(() => { navigate(HOME); leaveView(); }, [leaveView]);
  const returnToView = useCallback(() => { setStage('ready'); navigate(VIEW); }, []);

  // Read by the Back/Forward handler, which is subscribed once.
  const routeState = useRef({});
  routeState.current = { model, stage };

  useEffect(() => {
    // Nothing is loaded when the page opens, so /view has nothing to show.
    if (currentRoute() === VIEW) navigate(HOME, { replace: true });
    return onRouteChange((route) => {
      const { model: m, stage: st } = routeState.current;
      if (route === VIEW) {
        if (m && st !== 'parsing') setStage('ready');
        else navigate(HOME, { replace: true });
      } else if (st === 'ready') {
        leaveView();
      }
    });
  }, [leaveView]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  useEffect(() => onUpdateAvailable(() => setUpdateReady(true)), []);
  // On the home page with nothing loaded there is nothing to lose, so a new
  // build is applied straight away; with a structure open, or kept to return
  // to, the user is asked (UpdateToast).
  useEffect(() => {
    if (updateReady && stage === 'idle' && !pendingAlt && !model) applyUpdate();
  }, [updateReady, stage, pendingAlt, model]);

  // --- camera --------------------------------------------------------------

  const goTo = useCallback((id, opts = {}) => {
    if (!displayModel) return;
    const node = displayModel.byId.get(id);
    if (!node) return;
    const hasKids = node.childIds.length > 0;

    // Panels that sit beside the map narrow the space a unit is framed in. On a
    // phone they cover the map instead, and frame nothing (see overlayOffset).
    const offsetLeft = overlayOffset(document.querySelector('.search-panel'), size.w);
    const rightPanel = document.querySelector('.side-panel');
    const offsetRight = rightPanel
      ? overlayOffset(rightPanel, size.w)
      : isMobile() ? 0 : Math.min(352, size.w * 0.4); // the panel about to open

    const availW = Math.max(1, size.w - offsetLeft - offsetRight);

    let minK = zoomToReveal(node, displayModel.byId, availW, settings.minTextPx);
    if (hasKids) {
      minK = Math.max(minK, zoomToOpen(node, availW, settings.minTextPx, displayModel.byId));
    } else {
      minK = Math.max(minK, camRef.current.k);
    }

    setFocusId(id);
    setSelectedId(id);
    // On a phone, going somewhere means seeing it: close whatever covers the map.
    if (isMobile()) setPanelOpen(false);
    flyTo(node.rect, { margin: hasKids ? 0.92 : 0.6, minK, offsetLeft, offsetRight, ...opts });
  }, [displayModel, flyTo, size.w, settings.minTextPx]);

  // Clicks on the map. Identical to `goTo` except while the search panel is
  // waiting to be told what to search -- only a click out here sets that, never
  // a click on a result.
  const selectOnMap = useCallback((id) => {
    if (searchPicking && displayModel?.byId.has(id)) {
      setSearchScopeId(id);
      setSearchPicking(false);
    }
    goTo(id);
  }, [goTo, displayModel, searchPicking]);

  // Frame the whole structure as soon as the surface has a size.
  //
  // The flag is only cleared once the fit has actually happened. On a re-import
  // the map remounts and this can run against a surface that has no layout yet;
  // clearing up front left that attempt as the only one, and the camera stayed
  // wherever the previous structure had left it -- pointing, in general, at
  // nothing in the new one.
  useEffect(() => {
    if (!displayModel || !pendingFit.current || !size.w) return;
    if (flyTo(displayModel.byId.get(displayModel.rootId).rect, { instant: true })) {
      pendingFit.current = false;
    }
  }, [displayModel, size, flyTo]);

  const fitAll = useCallback(() => {
    if (!displayModel) return;
    setFocusId(displayModel.rootId);
    setSelectedId(null);
    flyTo(displayModel.byId.get(displayModel.rootId).rect);
  }, [displayModel, flyTo]);

  const goUp = useCallback(() => {
    if (!displayModel || !focusId) return;
    const node = displayModel.byId.get(focusId);
    if (node?.parentId && displayModel.byId.has(node.parentId)) goTo(node.parentId);
    else fitAll();
  }, [displayModel, focusId, goTo, fitAll]);

  useEffect(() => {
    const onKey = (e) => {
      // The target is only an element when something is focused -- a bare
      // keypress on the document would otherwise blow up on .matches().
      if (e.target instanceof Element && e.target.matches('input, textarea, button')) return;
      if (settingsOpen || exportOpen || treeOpen || statsOpen || warningsOpen) return; // a modal owns the keyboard while it's up
      if (e.key === 'Escape') goUp();
      else if (e.key === 'f' || e.key === 'F') fitAll();
      else if (e.key === '+' || e.key === '=') zoomBy(1.4, size.w / 2, size.h / 2);
      else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.4, size.w / 2, size.h / 2);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goUp, fitAll, zoomBy, size, settingsOpen, exportOpen, treeOpen, statsOpen, warningsOpen]);

  // Root -> focused node, for the breadcrumb trail.
  const path = useMemo(() => {
    if (!displayModel || !focusId) return [];
    const chain = [];
    let id = focusId;
    while (id && displayModel.byId.has(id)) {
      const n = displayModel.byId.get(id);
      chain.unshift(n);
      id = n.parentId;
    }
    return chain;
  }, [displayModel, focusId]);

  const selected = selectedId ? displayModel?.byId.get(selectedId) : null;

  // Hand a query to the search panel, closing whatever modal asked for it.
  // `scopeId` narrows the search to that unit; without it the scope is kept.
  const openSearch = useCallback((query, scopeId) => {
    if (scopeId) setSearchScopeId(scopeId);
    setSearchQuery(query);
    setSearchOpen(true);
    setSearchPicking(false);
    setStatsOpen(false);
  }, []);

  // --- tutorial ------------------------------------------------------------

  // Offered once per browser, the first time a structure is on screen.
  useEffect(() => {
    if (stage === 'ready' && !tutorialSeen()) setOfferOpen(true);
  }, [stage]);

  const startTour = useCallback(() => {
    markTutorialSeen();
    setOfferOpen(false);
    setTourOpen(true);
  }, []);

  const dismissOffer = useCallback(() => {
    markTutorialSeen();
    setOfferOpen(false);
  }, []);

  // What the tour shows off: a unit one level under the top (one with units
  // or billets inside, so it has something to open onto), and the first
  // soldier with an MOS inside that.
  const tourCtx = useMemo(() => {
    if (!displayModel) return null;
    const { byId, rootId } = displayModel;
    const root = byId.get(rootId);
    const kids = root.childIds.map((id) => byId.get(id));
    const unit = kids.find((n) => n.kind === 'UN' && n.childIds.length > 0 && n.roll.billets > 0)
      || kids.find((n) => n.childIds.length > 0)
      || root;
    let billet = null;
    for (const queue = [unit.id]; queue.length && !billet;) {
      const n = byId.get(queue.shift());
      if (n.kind === 'BL' && n.mos) billet = n;
      else queue.push(...n.childIds);
    }
    return {
      demo: {
        unitId: unit.id,
        billetId: billet?.id ?? null,
        mos: billet?.mos ?? root.topMos[0]?.mos ?? null,
        unitHasMos: unit.topMos.length > 0,
        unitHasEq: unit.equipment.length > 0 || (unit.childIds.length > 0 && unit.allEq.length > 0),
      },
      hasWarnings: displayModel.meta.warnings?.length > 0,
    };
  }, [displayModel]);

  // Puts the app in the state a tour step asks for (see tutorial/steps.js):
  // everything a step doesn't list is closed.
  const tourApi = useMemo(() => ({
    apply(ui, focus, moveCamera) {
      if (!tourCtx) return;
      const { demo } = tourCtx;
      setSearchPicking(false);
      if (ui.search) {
        const q = ui.search === 'demo-mos' ? (demo.mos ? `MOS:${demo.mos}` : '') : '';
        setSearchScopeId(null);
        setSearchQuery(q);
        setSearchOpen(true);
      } else {
        setSearchOpen(false);
        setSearchQuery('');
      }
      setStatsTab(ui.stats || null);
      setStatsOpen(!!ui.stats);
      setTreeOpen(!!ui.tree);
      setLegendOpen(!!ui.legend);
      setSettingsOpen(!!ui.settings);
      setExportOpen(!!ui.exportOpen);
      setWarningsOpen(false);

      const id = focus === 'unit' ? demo.unitId : focus === 'billet' ? demo.billetId : null;
      if (moveCamera) {
        if (id) goTo(id);
        else fitAll();
      }
      // The side panel only shows on steps about a unit or soldier.
      setSelectedId(ui.focus && ui.panel !== false ? id : null);
      setPanelOpen(!!ui.focus && ui.panel !== false);
    },
  }), [tourCtx, goTo, fitAll]);

  // --- render --------------------------------------------------------------

  if (stage === 'idle') {
    return (
      <div className="app-shell app-centered">
        <FileDrop
          onSheet={parseSheet}
          onModel={loadModelFile}
          error={error}
          howToSignal={howToSignal}
          resume={model ? { title: model.byId.get(model.rootId)?.title || model.meta.uic, fileName, onResume: returnToView } : null}
        />
        <AlternateFormatModal
          open={!!pendingAlt}
          fileName={pendingAlt?.fileName}
          onShowHowTo={() => { setPendingAlt(null); setHowToSignal((n) => n + 1); }}
          onCancel={() => setPendingAlt(null)}
          onContinue={() => {
            const { model: m, rows, fileName: name } = pendingAlt;
            setPendingAlt(null);
            showModel(m, rows, name);
          }}
        />
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
    <SettingsProvider settings={settings}>
    {/* Censor mode hides the table: it is keyed by, and would show, the real codes. */}
    <SupplementProvider rows={settings.censor ? NO_ROWS : supplementRows} onChange={setSupplementRows}>
    <MosPaletteProvider model={displayModel}>
      <div className="app-shell">
        <TopBar
          model={displayModel}
          path={path}
          onGo={goTo}
          onExport={() => setExportOpen(true)}
          onReset={goHome}
          legendOpen={legendOpen}
          onToggleLegend={() => setLegendOpen((v) => !v)}
          warnings={displayModel.meta.warnings}
          onOpenSettings={() => setSettingsOpen(true)}
          searchOpen={searchOpen}
          onToggleSearch={() => { setSearchOpen((v) => !v); setSearchPicking(false); }}
          treeOpen={treeOpen}
          onOpenTree={() => setTreeOpen(true)}
          onOpenStats={() => setStatsOpen(true)}
          onOpenWarnings={() => setWarningsOpen(true)}
          onOpenTutorial={startTour}
        />

        <div className="app-body">
          <MapCanvas
            containerRef={surfaceRef}
            model={displayModel}
            cam={cam}
            size={size}
            selectedId={selectedId}
            focusId={focusId}
            flying={flying}
            onSelect={selectOnMap}
            minTextPx={settings.minTextPx}
            perf={settings.perf}
          />
          {searchOpen && (
            <SearchPanel
              model={displayModel}
              scopeNode={displayModel.byId.get(searchScopeId) || displayModel.byId.get(displayModel.rootId)}
              picking={searchPicking}
              hidden={mobile && searchPicking}
              onPick={() => setSearchPicking((v) => !v)}
              onGo={(id) => {
                goTo(id);
                // A phone's search panel covers the map: step aside to show
                // the result, keeping the query for when it's reopened.
                if (mobile) { setSearchQuery(searchDraft.current); setSearchOpen(false); }
              }}
              onQueryChange={(q) => { searchDraft.current = q; }}
              onClose={() => { setSearchOpen(false); setSearchPicking(false); setSearchQuery(''); }}
              initialQuery={searchQuery}
            />
          )}
          {mobile && searchOpen && searchPicking && (
            <div className="pick-banner card shadow">
              <span>Tap a unit to search within it</span>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSearchPicking(false)}>
                Cancel
              </button>
            </div>
          )}
          {legendOpen && <Legend model={displayModel} onClose={() => setLegendOpen(false)} />}
          {selected && (!mobile || panelOpen) && (
            <SidePanel
              node={selected}
              model={displayModel}
              onGo={goTo}
              onSearch={openSearch}
              onClose={() => (mobile ? setPanelOpen(false) : setSelectedId(null))}
            />
          )}
          {mobile && selected && !panelOpen && !(searchOpen && !searchPicking) && (
            <button
              type="button"
              className="details-fab btn btn-info shadow"
              onClick={() => setPanelOpen(true)}
              aria-label={`Show details for ${selected.title}`}
            >
              <i className="bi bi-layout-sidebar-reverse" aria-hidden="true" />
              <span>{truncate(selected.title, 28)}</span>
            </button>
          )}
        </div>

        {/* On a phone only the UIC, file name and version stay (.status-extra). */}
        <div className="statusbar text-body-secondary small" data-tour="statusbar">
          <div className="status-file">
            <span className="fw-semibold text-body">{displayModel.meta.uic || '—'}</span>
            <span title={displayModel.meta.sourceFile}>{displayModel.meta.sourceFile}</span>
            {displayModel.meta.runDate && <span className="status-extra">run {displayModel.meta.runDate}</span>}
          </div>
          <div className="vr status-extra" />
          <span className="status-extra">{displayModel.meta.nodeCount} nodes</span>
          <span className="status-extra">{displayModel.meta.rowCount} rows</span>
          <span className="status-extra">parsed in {displayModel.meta.parseMs ?? 0} ms</span>
          <div className="vr ms-auto" />
          <span className="status-extra">zoom {cam.k.toFixed(2)}×</span>
          <div className="vr status-extra" />
          <span className="d-none d-xl-inline">Esc = up | F = fit | scroll = zoom | drag = pan</span>
          <div className="vr status-extra" />
          <span className="d-none d-lg-inline">Developed by 2LT Korbin Deary</span>
          <div className="vr status-extra" />
          <span className="status-version" title={`Built ${__BUILD_TIME__}`}>v{__APP_VERSION__}</span>
        </div>

        <SettingsModal
          open={settingsOpen}
          settings={settings}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
        />

        <StatsModal
          open={statsOpen}
          initialTab={statsTab}
          model={displayModel}
          censored={settings.censor}
          onClose={() => { setStatsOpen(false); setStatsTab(null); }}
          onSearch={openSearch}
        />

        <WarningsModal
          open={warningsOpen}
          warnings={displayModel.meta.warnings}
          onClose={() => setWarningsOpen(false)}
        />

        <ExportModal
          open={exportOpen}
          model={displayModel}
          supplementCount={settings.censor ? 0 : supplementRows.length}
          censored={settings.censor}
          onExportModel={exportModel}
          onClose={() => setExportOpen(false)}
        />

        <TreeModal
          open={treeOpen}
          model={displayModel}
          onGo={goTo}
          onClose={() => setTreeOpen(false)}
        />

        <DetailModals model={displayModel} onSearch={openSearch} />

        <BusyToast />

        <TutorialOffer open={offerOpen && !tourOpen} onStart={startTour} onDismiss={dismissOffer} />
        {tourOpen && tourCtx && (
          <Tour
            ctx={tourCtx}
            api={tourApi}
            startAt={tourPos.current}
            onPosition={(p) => { tourPos.current = p; saveTourPos(p); }}
            onEnd={() => setTourOpen(false)}
          />
        )}

        <UpdateToast
          open={updateReady && !updateDeferred}
          onReload={applyUpdate}
          onLater={() => setUpdateDeferred(true)}
        />
      </div>
    </MosPaletteProvider>
    </SupplementProvider>
    </SettingsProvider>
  );
}
