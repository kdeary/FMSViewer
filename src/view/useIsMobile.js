import { useEffect, useState } from 'react';

// The same breakpoint the stylesheet uses for its phone layout (app.css).
export const MOBILE_QUERY = '(max-width: 720px)';

export function isMobile() {
  return !!window.matchMedia?.(MOBILE_QUERY).matches;
}

/** True while the window is phone-sized; follows rotation and resizing. */
export function useIsMobile() {
  const [mobile, setMobile] = useState(isMobile);
  useEffect(() => {
    const mq = window.matchMedia?.(MOBILE_QUERY);
    if (!mq) return undefined;
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
}
