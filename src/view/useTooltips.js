import { useEffect } from 'react';

/**
 * One delegated Bootstrap tooltip for the whole app.
 *
 * Delegation rather than an instance per element: the map rebuilds its boxes
 * constantly, and anything holding a handle to a box would have to be created
 * and disposed on every scene change. A single instance bound to the body with
 * a `selector` picks up whatever is on screen at the moment you hover it, so
 * boxes stay disposable.
 *
 * `container: 'body'` matters here -- a tooltip left inside the map would be
 * scaled by the camera transform along with everything else in it.
 */
export function useTooltips() {
  useEffect(() => {
    const bs = window.bootstrap;
    // The CDN bundle is a blocking script, so it has run by the time React
    // mounts. If it failed to load, the `title` attributes still work.
    if (!bs || !bs.Tooltip) return undefined;

    const root = new bs.Tooltip(document.body, {
      selector: '[data-bs-toggle="tooltip"]',
      container: 'body',
      trigger: 'hover',
      placement: 'top',
      // Long enough not to strobe while the pointer crosses a row of segments.
      delay: { show: 300, hide: 40 },
    });

    const shown = new Set();
    const onShow = (e) => { shown.add(e.target); };
    const onHidden = (e) => { shown.delete(e.target); };

    const dismiss = () => {
      for (const el of shown) bs.Tooltip.getInstance(el)?.hide();
      shown.clear();
    };

    // A tooltip only closes on its element's mouseleave. When React removes
    // that element while the tooltip is up -- the map changes level of detail,
    // the side panel switches unit, a modal closes, the tree collapses -- the
    // mouseleave never comes and the tooltip is left stuck on screen. Sweep
    // for those: an instance whose element has left the page is disposed, and
    // any tooltip no element points at any more is removed outright.
    const sweep = () => {
      for (const el of shown) {
        if (el.isConnected) continue;
        bs.Tooltip.getInstance(el)?.dispose();
        shown.delete(el);
      }
      for (const tip of document.querySelectorAll('body > .tooltip')) {
        if (!document.querySelector(`[aria-describedby="${tip.id}"]`)) tip.remove();
      }
    };
    const timer = setInterval(sweep, 400);

    document.body.addEventListener('show.bs.tooltip', onShow);
    document.body.addEventListener('hidden.bs.tooltip', onHidden);
    // Anything that moves or changes the view closes tooltips straight away.
    window.addEventListener('wheel', dismiss, { passive: true });
    window.addEventListener('pointerdown', dismiss, true);
    window.addEventListener('keydown', dismiss, true);
    window.addEventListener('blur', dismiss);

    return () => {
      clearInterval(timer);
      document.body.removeEventListener('show.bs.tooltip', onShow);
      document.body.removeEventListener('hidden.bs.tooltip', onHidden);
      window.removeEventListener('wheel', dismiss);
      window.removeEventListener('pointerdown', dismiss, true);
      window.removeEventListener('keydown', dismiss, true);
      window.removeEventListener('blur', dismiss);
      dismiss();
      sweep();
      root.dispose();
    };
  }, []);
}
