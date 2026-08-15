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

    // A tooltip whose element is re-rendered away while it is open would be
    // left hanging, so any camera movement closes it.
    let shown = null;
    const onShow = (e) => { shown = e.target; };
    const dismiss = () => {
      if (shown) bs.Tooltip.getInstance(shown)?.hide();
      shown = null;
    };

    document.body.addEventListener('show.bs.tooltip', onShow);
    window.addEventListener('wheel', dismiss, { passive: true });
    window.addEventListener('pointerdown', dismiss, true);

    return () => {
      document.body.removeEventListener('show.bs.tooltip', onShow);
      window.removeEventListener('wheel', dismiss);
      window.removeEventListener('pointerdown', dismiss, true);
      dismiss();
      root.dispose();
    };
  }, []);
}
