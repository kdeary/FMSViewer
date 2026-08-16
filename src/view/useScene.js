import { useEffect, useRef, useState } from 'react';
import { stepScene, levelViews } from './lod.js';

// Rolling frame statistics, written in place so collecting them costs no
// allocation and no extra render. `frame` is the wall-clock gap between frames,
// which is the number that matters: it includes the browser's own style,
// layout, paint and raster work, none of which is visible from JS.
const WINDOW = 30;

function newStats() {
  return { frame: 0, scene: 0, boxes: 0, worst: 0, n: 0, last: 0 };
}

function sample(st, now, sceneMs, boxes) {
  if (st.last) {
    const dt = now - st.last;
    // A gap of a quarter second is a tab switch or a stall outside our control.
    if (dt < 250) {
      const w = Math.min(st.n + 1, WINDOW);
      st.frame += (dt - st.frame) / w;
      st.scene += (sceneMs - st.scene) / w;
      st.worst = st.n % (WINDOW * 4) === 0 ? dt : Math.max(st.worst, dt);
      st.n++;
    }
  }
  st.last = now;
  st.boxes = boxes;
}

/**
 * Drives the scene from a frame loop rather than straight off the camera, so
 * view transitions keep playing after the camera has come to rest.
 *
 * The loop reads the newest camera out of a ref instead of closing over one.
 * An earlier version re-created the loop on every camera change, which meant a
 * fly -- sixty camera updates a second -- could cancel each pending frame
 * before it ran and leave the map rendering a stale zoom. Here a camera change
 * only ever *starts* the loop; nothing cancels it but going idle.
 */
export function useScene(model, cam, size, detailPct) {
  const [scene, setScene] = useState({ list: [], views: [] });
  const store = useRef(new Map());
  const views = useRef([]);
  const levelState = useRef([]);
  const raf = useRef(0);
  const last = useRef(0);
  const stats = useRef(newStats());

  // Whatever the loop should be looking at, as of this render.
  const latest = useRef();
  latest.current = { model, cam, size, detailPct };

  // A new model means the old animation states are meaningless.
  useEffect(() => { store.current.clear(); views.current = []; levelState.current = []; }, [model]);

  useEffect(() => {
    if (!model || !size.w) {
      if (raf.current) { cancelAnimationFrame(raf.current); raf.current = 0; }
      stats.current.last = 0;
      setScene({ list: [], views: [] });
      return;
    }
    if (raf.current) return; // already running -- it will pick the change up

    const step = (now) => {
      const cur = latest.current;
      if (!cur.model || !cur.size.w) { raf.current = 0; return; }

      // First frame of a burst gets a nominal delta; long gaps (background tab)
      // are capped so nothing jumps.
      const dt = last.current ? Math.min(now - last.current, 64) : 16;
      last.current = now;

      const t0 = performance.now();
      views.current = levelViews(cur.model.levels, cur.cam.k, cur.size.w, cur.detailPct);
      const { list, animating } = stepScene(
        cur.model, cur.cam, cur.size, store.current, dt, cur.detailPct,
      );
      sample(stats.current, now, performance.now() - t0, list.length);
      setScene({ list, views: views.current });

      // Keep going while something is still moving -- either a transition, or a
      // camera that has changed since the frame we just drew. Compared field by
      // field: `latest` is a fresh object every render, including renders the
      // scene doesn't care about.
      const now2 = latest.current;
      const stale = now2.cam !== cur.cam || now2.size !== cur.size
        || now2.detailPct !== cur.detailPct || now2.model !== cur.model;
      raf.current = (animating || stale) ? requestAnimationFrame(step) : 0;
      if (!raf.current) { last.current = 0; stats.current.last = 0; }
    };

    raf.current = requestAnimationFrame(step);
  }, [model, cam, size, detailPct]);

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  return { ...scene, stats: stats.current };
}
