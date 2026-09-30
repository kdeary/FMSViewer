// What the tutorial remembers on this browser: whether the first-run offer
// was answered, and where the tour was left so Tutorial can pick it back up.

const SEEN_KEY = 'fmsviewer.tutorial';
const POS_KEY = 'fmsviewer.tutorial.pos';

export function tutorialSeen() {
  try { return !!localStorage.getItem(SEEN_KEY); } catch { return false; }
}

export function markTutorialSeen() {
  try { localStorage.setItem(SEEN_KEY, 'seen'); } catch { /* storage disabled */ }
}

/** `{ track, stepId, index }` of the last step shown, or null. */
export function loadTourPos() {
  try {
    const pos = JSON.parse(localStorage.getItem(POS_KEY));
    return pos && typeof pos.track === 'string' ? pos : null;
  } catch { return null; }
}

export function saveTourPos(pos) {
  try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* storage disabled */ }
}
