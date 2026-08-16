import { useEffect, useRef, useState } from 'react';
import { stepScene } from './lod.js';

const WINDOW = 30;

function newStats() {
  return { frame: 0, scene: 0, boxes: 0, worst: 0, n: 0, last: 0 };
}

function sample(st, now, sceneMs, boxes) {
  if (st.last) {
    const dt = now - st.last;
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
 * Drives the scene from a frame loop so view transitions keep playing after the
 * camera has come to rest. The loop reads the newest camera out of a ref instead
 * of closing over one, so a fly animation doesn't cancel pending frames.
 */
export function useScene(model, cam, size, minTextPx) {
  const [scene, setScene] = useState({ list: [] });
  const store = useRef(new Map());
  const raf = useRef(0);
  const last = useRef(0);
  const stats = useRef(newStats());

  const latest = useRef();
  latest.current = { model, cam, size, minTextPx };

  useEffect(() => { store.current.clear(); }, [model]);

  useEffect(() => {
    if (!model || !size.w) {
      if (raf.current) { cancelAnimationFrame(raf.current); raf.current = 0; }
      stats.current.last = 0;
      setScene({ list: [] });
      return;
    }
    if (raf.current) return;

    const step = (now) => {
      const cur = latest.current;
      if (!cur.model || !cur.size.w) { raf.current = 0; return; }

      const dt = last.current ? Math.min(now - last.current, 64) : 16;
      last.current = now;

      const t0 = performance.now();
      const { list, animating } = stepScene(
        cur.model, cur.cam, cur.size, store.current, dt, cur.minTextPx,
      );
      sample(stats.current, now, performance.now() - t0, list.length);
      setScene({ list });

      const now2 = latest.current;
      const stale = now2.cam !== cur.cam || now2.size !== cur.size
        || now2.minTextPx !== cur.minTextPx || now2.model !== cur.model;
      raf.current = (animating || stale) ? requestAnimationFrame(step) : 0;
      if (!raf.current) { last.current = 0; stats.current.last = 0; }
    };

    raf.current = requestAnimationFrame(step);
  }, [model, cam, size, minTextPx]);

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  return { ...scene, stats: stats.current };
}
