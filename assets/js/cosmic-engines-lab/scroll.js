// ─── Cosmic Engines · scroll helpers ────────────────────────────────

// Returns a function that, given a target element, returns scroll
// progress 0..1 mapped to the element's vertical span.
export function makeScrollProgress(el) {
  return function progress() {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    // 0 when the top of `el` reaches the top of the viewport (or below).
    // 1 when the bottom of `el` leaves the bottom of the viewport.
    const total = rect.height - vh;
    if (total <= 0) return 0;
    const offset = -rect.top;
    return Math.min(1, Math.max(0, offset / total));
  };
}

export function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
