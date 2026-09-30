import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildTracks, CHAPTERS } from './steps.js';
import { useDetailActions } from '../view/Supplement.jsx';

// How long a step waits for its target to appear (a modal mounting, a panel
// sliding in) before giving up and showing its card in the middle.
const TARGET_WAIT_MS = 1500;
const PAD = 6;       // spotlight breathing room around the target
const MARGIN = 12;   // closest the card gets to the window edge
const GAP = 14;      // between the spotlight and the card
const EASE_MS = 90;  // time constant of the spotlight's glide to a new target

/**
 * The guided tour: dims the app, cuts a spotlight around each step's target,
 * and puts the step's card beside it. Steps drive the app through `api.apply`
 * (see steps.js). Everything the tour opened is closed again when it ends.
 *
 * Whatever is inside the spotlight stays live, so the reader can do what a
 * step describes; only the dimmed part is blocked.
 *
 * `ctx` is { demo, hasWarnings }, `api.apply(ui, focus, moveCamera)` sets the app up.
 * `startAt` is where to resume (see storage.js); `onPosition` hears every move.
 */
export default function Tour({ ctx, api, startAt, onPosition, onEnd }) {
  const { openMos, closeDetail } = useDetailActions();
  const tracks = useMemo(() => buildTracks(ctx), [ctx]);
  const [pos, setPos] = useState(() => resolveStart(tracks, startAt));
  // Picked up part way through: the first card says so, with a way to restart.
  const [resumed, setResumed] = useState(() => {
    const p = resolveStart(tracks, startAt);
    return p.track !== 'overview' || p.index > 0;
  });
  const steps = tracks[pos.track];
  const step = steps[pos.index];

  useEffect(() => {
    onPosition({ track: pos.track, stepId: step.id, index: pos.index });
  }, [pos]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- navigation --------------------------------------------------------

  const end = () => {
    api.apply({ panel: false }, focusRef.current, false);
    closeDetail();
    onEnd();
  };
  const move = (p) => { setResumed(false); setPos(p); };
  const next = () => {
    if (pos.index < steps.length - 1) move({ ...pos, index: pos.index + 1 });
    else end();
  };
  const back = () => {
    if (pos.index > 0) { move({ ...pos, index: pos.index - 1 }); return; }
    // Off the front of a track: chapters return to the picker, everything
    // else to the overview's closing choice.
    if (pos.track.startsWith('ch:')) move({ track: 'menu', index: 0 });
    else if (pos.track !== 'overview') move({ track: 'overview', index: tracks.overview.length - 1 });
  };
  const go = (track) => move({ track, index: 0 });

  // --- set the app up for the step ----------------------------------------

  const focusRef = useRef(undefined);
  const stepStart = useRef(0);
  // Once the reader has clicked, scrolled or pressed a key in the app, the
  // camera can't be trusted to still be where the tour left it.
  const cameraLoose = useRef(false);
  // Bumped by "Show me again", to set the step up afresh.
  const [redo, setRedo] = useState(0);
  useEffect(() => {
    const ui = step.ui || {};
    const moveCamera = ui.focus !== undefined && (ui.focus !== focusRef.current || cameraLoose.current);
    cameraLoose.current = false;
    if (ui.focus !== undefined) focusRef.current = ui.focus;
    api.apply(ui, focusRef.current, moveCamera);
    if (ui.mos && ctx.demo.mos) openMos(ctx.demo.mos);
    else closeDetail();
    stepStart.current = performance.now();
    // Leave the keyboard with the app, so its shortcuts work during the tour.
    if (document.activeElement?.closest?.('.tour-card')) document.activeElement.blur();
  }, [step, redo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loosen = (e) => {
      if (!(e.target instanceof Element && e.target.closest('.tour-card'))) cameraLoose.current = true;
    };
    window.addEventListener('pointerdown', loosen, true);
    window.addEventListener('wheel', loosen, true);
    return () => {
      window.removeEventListener('pointerdown', loosen, true);
      window.removeEventListener('wheel', loosen, true);
    };
  }, []);

  // --- follow the target ---------------------------------------------------

  // The target is re-measured every frame: camera flights, panels sliding in
  // and modals resizing between tabs all move it without telling anyone.
  const [geo, setGeo] = useState({ rect: null, ready: false, vw: window.innerWidth, vh: window.innerHeight });
  const cardRef = useRef(null);
  const [card, setCard] = useState({ w: 352, h: 200 });
  // The spotlight is drawn straight into the DOM each frame, easing from
  // where it is towards the target, so it glides between steps and keeps up
  // with a target that is itself moving.
  const shadeRef = useRef(null);
  const ringRef = useRef(null);
  const shown = useRef(null);
  const lastFrame = useRef(0);
  const reduceMotion = useMemo(() => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
  useEffect(() => {
    const selector = typeof step.target === 'function' ? step.target(ctx) : step.target;
    let raf = 0;
    let scrolled = false;
    const tick = (now) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const el = selector ? document.querySelector(selector) : null;
      let rect = null;
      if (el) {
        if (step.scroll && !scrolled) {
          scrolled = true;
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        rect = clampRect(el.getBoundingClientRect(), vw, vh);
      }
      const waited = performance.now() - stepStart.current > TARGET_WAIT_MS;
      const ready = !selector || !!rect || waited;
      setGeo((prev) => (
        prev.ready === ready && prev.vw === vw && prev.vh === vh && sameRect(prev.rect, rect)
          ? prev
          : { rect, ready, vw, vh }
      ));

      // Hold still while the target is still on its way; with no target at
      // all, close the hole down to nothing in the middle of the screen.
      const from = shown.current || rect || { left: vw / 2, top: vh / 2, width: 0, height: 0 };
      const goal = rect || (ready ? { left: vw / 2, top: vh / 2, width: 0, height: 0 } : from);
      const dt = Math.min(64, now - (lastFrame.current || now));
      lastFrame.current = now;
      const k = reduceMotion ? 1 : 1 - Math.exp(-dt / EASE_MS);
      const cur = {
        left: from.left + (goal.left - from.left) * k,
        top: from.top + (goal.top - from.top) * k,
        width: from.width + (goal.width - from.width) * k,
        height: from.height + (goal.height - from.height) * k,
      };
      shown.current = cur;
      shadeRef.current?.setAttribute('d', shadePath(cur, vw, vh));
      const ring = ringRef.current;
      if (ring) {
        ring.style.transform = `translate(${cur.left}px, ${cur.top}px)`;
        ring.style.width = `${cur.width}px`;
        ring.style.height = `${cur.height}px`;
        ring.style.opacity = rect ? '1' : '0';
        const c = cornerRadii(cur, vw, vh);
        ring.style.borderRadius = `${c.tl}px ${c.tr}px ${c.br}px ${c.bl}px`;
      }
      const c = cardRef.current;
      if (c) {
        const w = c.offsetWidth;
        const h = c.offsetHeight;
        setCard((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, ctx, reduceMotion]);

  // --- keyboard -----------------------------------------------------------

  // Only the arrow keys and Enter belong to the tour, and only while nothing
  // else wants them: typing in a field and pressing a focused button are left
  // alone. Every other key (Esc, F, + and -) goes on to the app as usual.
  const keyRef = useRef(null);
  keyRef.current = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target instanceof Element ? e.target : null;
    // A field keeps its keys, except arrows while it's empty: the search box
    // takes focus as it opens, and would otherwise stop the tour's stepping.
    const field = t?.closest('input, textarea, select, [contenteditable="true"]');
    if (field && !(e.key.startsWith('Arrow') && field.value === '')) return;
    if (e.key === 'ArrowRight' && !step.kind) { e.preventDefault(); e.stopImmediatePropagation(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); back(); }
    else if (e.key === 'Enter' && !step.kind && !t?.closest('button, a')) {
      e.preventDefault(); e.stopImmediatePropagation(); next();
    } else cameraLoose.current = true;
  };
  useEffect(() => {
    const onKey = (e) => keyRef.current(e);
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // --- layout -------------------------------------------------------------

  const { rect, ready, vw, vh } = geo;
  // The target was pointed at but is gone: most likely the reader's own
  // doing (closed the panel, flew somewhere else).
  const lost = ready && !rect && !!step.target;
  const place = placeCard(rect, card, vw, vh, step.placement);

  const chapterIndex = pos.track.startsWith('ch:')
    ? CHAPTERS.findIndex((c) => `ch:${c.id}` === pos.track)
    : -1;
  // Counted within the step's own section, so running every chapter back to
  // back reads "2 of 5" per chapter, with a bar for the run as a whole.
  const sectionSteps = steps.filter((s) => !s.kind && s.section === step.section);
  const sectionIndex = sectionSteps.indexOf(step);
  const countable = step.kind ? 0 : sectionSteps.length;
  const overall = pos.track === 'all' ? (pos.index + 1) / steps.length : null;

  return createPortal(
    <>
      <svg className="tour-shade" aria-hidden="true">
        <path ref={shadeRef} fillRule="evenodd" />
      </svg>
      <div ref={ringRef} className="tour-ring" aria-hidden="true" />
      <section
        ref={cardRef}
        className={`tour-card card shadow-lg${ready ? '' : ' is-waiting'}`}
        style={{ left: place.left, top: place.top }}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
      >
        {overall !== null && (
          <div className="tour-progress" aria-hidden="true"><i style={{ width: `${overall * 100}%` }} /></div>
        )}
        <div className="card-body">
          <div className="tour-card-head">
            <span className="tour-section">
              {step.kind ? 'Tutorial' : step.section}
              {countable > 1 && (
                <span className="tour-count"> · {sectionIndex + 1} of {countable}</span>
              )}
            </span>
            <button type="button" className="btn-close btn-sm" aria-label="End tutorial" onClick={end} />
          </div>
          {resumed && (
            <p className="tour-resumed">
              Picking up where you left off.{' '}
              <button
                type="button"
                className="btn btn-link btn-sm p-0 align-baseline"
                onClick={() => move({ track: 'overview', index: 0 })}
              >
                Start over
              </button>
            </p>
          )}
          <h2 id="tour-title" className="h6 mb-1">{step.title}</h2>

          {!step.kind && (
            <>
              <p id="tour-body" className="tour-body mb-3">{step.body}</p>
              {lost && (
                <p className="tour-lost">
                  <i className="bi bi-eye-slash" aria-hidden="true" />
                  <span>
                    What this step points at has moved or closed.{' '}
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 align-baseline"
                      onClick={() => { cameraLoose.current = true; setRedo((n) => n + 1); }}
                    >
                      Show me again
                    </button>
                  </span>
                </p>
              )}
              {step.tryIt && (
                <p className="tour-try">
                  <i className="bi bi-hand-index-thumb" aria-hidden="true" />
                  <span><strong>Try it:</strong> {step.tryIt}</span>
                </p>
              )}
              {countable > 1 && (
                <div className="tour-dots" aria-hidden="true">
                  {sectionSteps.map((s, i) => (
                    <i key={s.id} className={i === sectionIndex ? 'is-on' : i < sectionIndex ? 'is-done' : ''} />
                  ))}
                </div>
              )}
              <div className="d-flex align-items-center gap-2">
                <button type="button" className="btn btn-link btn-sm px-0 me-auto text-body-secondary" onClick={end}>
                  End tutorial
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={back}
                  disabled={pos.track === 'overview' && pos.index === 0}
                >
                  Back
                </button>
                <button type="button" className="btn btn-info btn-sm" onClick={next}>
                  {pos.index === steps.length - 1 ? 'Finish' : 'Next'}
                </button>
              </div>
            </>
          )}

          {step.kind === 'choice' && (
            <>
              <p id="tour-body" className="tour-body mb-3">
                You’ve seen every part of the viewer. Stop here, or keep going for a closer look at how each part works.
              </p>
              <div className="d-grid gap-2">
                <button type="button" className="btn btn-info btn-sm tour-option" onClick={() => go('all')}>
                  <i className="bi bi-collection-play" aria-hidden="true" />
                  <span><strong>Learn everything in depth</strong><small>Every section, one after another</small></span>
                </button>
                <button type="button" className="btn btn-outline-info btn-sm tour-option" onClick={() => go('menu')}>
                  <i className="bi bi-list-ul" aria-hidden="true" />
                  <span><strong>Pick a section</strong><small>Learn about one part</small></span>
                </button>
                <button type="button" className="btn btn-outline-secondary btn-sm tour-option" onClick={end}>
                  <i className="bi bi-check2" aria-hidden="true" />
                  <span><strong>End the tutorial</strong><small>Tutorial picks up from here</small></span>
                </button>
              </div>
              <button type="button" className="btn btn-link btn-sm px-0 mt-2 text-body-secondary" onClick={back}>
                <i className="bi bi-arrow-left me-1" aria-hidden="true" />Back
              </button>
            </>
          )}

          {step.kind === 'menu' && (
            <>
              <p id="tour-body" className="tour-body mb-2">
                Feel free to close the tutorial at any point to test out a feature.
                You can resume the tutorial by clicking the <span className="text-info">Tutorial</span> button at the top of the site.
              </p>
              <div className="tour-menu">
                {CHAPTERS.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`tour-menu-item${i === chapterIndex ? ' is-current' : ''}`}
                    onClick={() => go(`ch:${c.id}`)}
                  >
                    <i className={`bi ${c.icon}`} aria-hidden="true" />
                    <span><strong>{c.title}</strong><small>{c.blurb}</small></span>
                  </button>
                ))}
              </div>
              <div className="d-flex align-items-center gap-2 mt-3">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={back}>Back</button>
                <button type="button" className="btn btn-info btn-sm ms-auto" onClick={end}>Finish</button>
              </div>
            </>
          )}

          {step.kind === 'done' && (
            <>
              <p id="tour-body" className="tour-body mb-3">
                That’s every part of FMSViewer. Tutorial in the top bar brings this back whenever you need it.
              </p>
              <div className="d-flex align-items-center gap-2">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={back}>Back</button>
                <button type="button" className="btn btn-outline-info btn-sm ms-auto" onClick={() => go('menu')}>Pick a section</button>
                <button type="button" className="btn btn-info btn-sm" onClick={end}>Finish</button>
              </div>
            </>
          )}
        </div>
      </section>
    </>,
    document.body,
  );
}

/**
 * Where a saved position lands on this structure's tracks. Found by step id,
 * since steps that don't apply to a structure are left out of its tracks; a
 * finished run reopens on the section picker rather than on "all set".
 */
function resolveStart(tracks, saved) {
  const track = saved && tracks[saved.track];
  if (!track) return { track: 'overview', index: 0 };
  let index = track.findIndex((s) => s.id === saved.stepId);
  if (index < 0) index = Math.min(Math.max(0, saved.index | 0), track.length - 1);
  if (track[index].kind === 'done') return { track: 'menu', index: 0 };
  return { track: saved.track, index };
}

/** The target's box plus padding, cut down to what's inside the window. */
function clampRect(r, vw, vh) {
  const left = Math.max(0, r.left - PAD);
  const top = Math.max(0, r.top - PAD);
  const right = Math.min(vw, r.right + PAD);
  const bottom = Math.min(vh, r.bottom + PAD);
  if (right - left < 4 || bottom - top < 4) return null;
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * Corner radii of the spotlight: rounded, except square wherever it meets the
 * window's edge, so an edge-to-edge target like the top bar or the status bar
 * isn't left with dimmed slivers in its corners.
 */
function cornerRadii(r, vw, vh) {
  const rad = Math.round(Math.min(10, r.width / 2, r.height / 2) * 10) / 10;
  const top = r.top <= 0.5;
  const left = r.left <= 0.5;
  const right = r.left + r.width >= vw - 0.5;
  const bottom = r.top + r.height >= vh - 0.5;
  return {
    tl: top || left ? 0 : rad,
    tr: top || right ? 0 : rad,
    br: bottom || right ? 0 : rad,
    bl: bottom || left ? 0 : rad,
  };
}

/** The whole window, with a hole cut where the spotlight is. */
function shadePath(r, vw, vh) {
  const outer = `M0 0H${vw}V${vh}H0Z`;
  if (r.width < 1 || r.height < 1) return outer;
  const f = (n) => Math.round(n * 10) / 10;
  const x = f(r.left);
  const y = f(r.top);
  const x2 = f(r.left + r.width);
  const y2 = f(r.top + r.height);
  const { tl, tr, br, bl } = cornerRadii(r, vw, vh);
  const corner = (rad, cx, cy) => (rad ? `A${rad} ${rad} 0 0 1 ${cx} ${cy}` : `L${cx} ${cy}`);
  return `${outer}M${x + tl} ${y}H${x2 - tr}${corner(tr, x2, y + tr)}V${y2 - br}${corner(br, x2 - br, y2)}`
    + `H${x + bl}${corner(bl, x, y2 - bl)}V${y + tl}${corner(tl, x + tl, y)}Z`;
}

function sameRect(a, b) {
  if (!a || !b) return a === b;
  return Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5
    && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}

/**
 * Beside the spotlight on the preferred side if the card fits there, else on
 * whichever side it does fit, else over the bottom of the target (a target as
 * big as the map or a large modal leaves no side free). Always on screen.
 */
function placeCard(rect, card, vw, vh, preferred) {
  const clamp = (left, top) => ({
    left: Math.round(Math.min(Math.max(MARGIN, left), vw - card.w - MARGIN)),
    top: Math.round(Math.min(Math.max(MARGIN, top), vh - card.h - MARGIN)),
  });
  if (!rect) return clamp((vw - card.w) / 2, (vh - card.h) / 2);

  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  const cx = rect.left + rect.width / 2 - card.w / 2;
  const cy = rect.top + rect.height / 2 - card.h / 2;
  const sides = {
    bottom: { fits: vh - bottom >= card.h + GAP + MARGIN, at: [cx, bottom + GAP] },
    top: { fits: rect.top >= card.h + GAP + MARGIN, at: [cx, rect.top - GAP - card.h] },
    right: { fits: vw - right >= card.w + GAP + MARGIN, at: [right + GAP, cy] },
    left: { fits: rect.left >= card.w + GAP + MARGIN, at: [rect.left - GAP - card.w, cy] },
  };
  const side = [preferred, 'bottom', 'right', 'left', 'top'].find((s) => s && sides[s].fits);
  if (side) return clamp(...sides[side].at);
  return clamp(cx, Math.min(bottom, vh) - card.h - MARGIN * 2);
}
