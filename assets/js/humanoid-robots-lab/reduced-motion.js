// Tiny helper. Respects the OS-level reduced-motion preference everywhere.
export function prefersReducedMotion() {
  if (typeof matchMedia === 'undefined') return false;
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
