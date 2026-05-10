// Cosmic Engines · entry shim
// The lab is split across ES modules under /assets/js/cosmic-engines-lab/.
// This file exists so the lab matches the standard /assets/js/<slug>-lab.js
// path. The actual entry point is loaded via a `<script type="module">`
// in /work/cosmic-engines-lab/index.html. This shim re-exports it for any
// caller that imports from this path directly.
export * from './cosmic-engines-lab/main.js';
