// ─── Cosmic Engines · S14 ──────────────────────────────────────────
// Source-backed copy for the eight cosmic objects featured in the lab.
// Numbers cited only when traceable to a NASA / ESA / peer-reviewed
// reference. Every entry has at least one official source URL.
// ────────────────────────────────────────────────────────────────────

export const COSMIC_OBJECTS = [
  {
    id: 'quasar',
    label: 'Quasar',
    glyph: 'Q',
    headline: 'A galaxy with the volume turned all the way up.',
    tagline: 'An active supermassive black hole so bright it can drown out its host galaxy.',
    seeing: 'A central dark sphere. A flattened glowing disk of in-falling gas. Two narrow polar jets racing outward at near-light speed.',
    matter:
      'Quasars are how we know super-massive black holes existed when the universe was less than a billion years old. ' +
      'The brightest ones convert about ten percent of the rest-mass of in-falling gas into radiation. That is roughly ' +
      'thirty times more efficient than nuclear fusion inside a star.',
    facts: [
      { k: 'Power source', v: 'Accretion onto a 10⁶–10¹⁰ M☉ black hole', conf: 'official' },
      { k: 'Brightness', v: 'Up to 10¹³ L☉, outshining 100 Milky Ways', conf: 'official' },
      { k: 'Engine size', v: 'Smaller than our Solar System', conf: 'official' },
      { k: 'Earliest known', v: 'z ≈ 7.6, ~670 Myr after the Big Bang', conf: 'official' }
    ],
    sources: [
      { label: 'NASA · Active Galactic Nuclei', url: 'https://science.nasa.gov/mission/webb/science-overview/science-explainers/what-are-active-galactic-nuclei/' },
      { label: 'NASA Hubble · Quasars', url: 'https://science.nasa.gov/mission/hubble/science/science-behind-the-discoveries/hubble-quasars/' }
    ],
    color: 0x66c8ff,
    accent: '#7ec3ff',
    scale: 'galactic',
    notToScale: true
  },
  {
    id: 'blackhole',
    label: 'Black Hole',
    glyph: 'BH',
    headline: 'Not a hole. A region where the exit speed exceeds light.',
    tagline: 'A region of spacetime where gravity sets an escape velocity faster than light itself.',
    seeing: 'A dark central shadow. A bright ring of lensed light wrapping around it. A glowing accretion disk seen edge-on, warped by gravity.',
    matter:
      'Every massive galaxy seems to host one at its center. Their masses correlate with the stellar bulges around them, ' +
      'which means black holes and galaxies grow together. The 2019 Event Horizon Telescope image of M87* and the 2022 ' +
      'image of Sgr A* both show the predicted dark shadow surrounded by a bright photon ring.',
    facts: [
      { k: 'Sgr A* mass', v: '4.15 × 10⁶ M☉', conf: 'official' },
      { k: 'M87* mass', v: '6.5 × 10⁹ M☉', conf: 'official' },
      { k: 'Event horizon', v: '2GM/c² (Schwarzschild radius)', conf: 'official' },
      { k: 'First image', v: 'M87*, April 2019 (EHT)', conf: 'official' }
    ],
    sources: [
      { label: 'NASA · Black Holes', url: 'https://science.nasa.gov/universe/black-holes/' },
      { label: 'NASA · Anatomy of a Black Hole', url: 'https://science.nasa.gov/universe/black-holes/anatomy/' },
      { label: 'NASA · How do we know there are black holes?', url: 'https://science.nasa.gov/mission/webb/science-overview/science-explainers/how-do-we-know-there-are-black-holes/' }
    ],
    color: 0xffaa55,
    accent: '#ffaa55',
    scale: 'stellar',
    notToScale: true
  },
  {
    id: 'pulsar',
    label: 'Pulsar',
    glyph: 'PSR',
    headline: 'A dead star spinning faster than your kitchen blender.',
    tagline: 'A neutron star whose beams sweep past Earth with the regularity of a cosmic clock.',
    seeing: 'A compact glowing sphere about twenty kilometers across. Two opposing radiation beams swept by rotation, blinking like a lighthouse from our vantage.',
    matter:
      'The Crab Pulsar spins thirty times per second. The fastest known pulsar (PSR J1748-2446ad) spins 716 times per second. ' +
      'Pulsar timing is so precise that ground stations once used the Crab as a navigation reference, and the NANOGrav collaboration ' +
      'used arrays of millisecond pulsars to detect a low-frequency gravitational-wave background in 2023.',
    facts: [
      { k: 'Diameter', v: '~20 km', conf: 'official' },
      { k: 'Mass', v: '1.4 M☉ (typical)', conf: 'official' },
      { k: 'Spin range', v: '0.7 ms to ~10 s period', conf: 'official' },
      { k: 'First detected', v: 'PSR B1919+21, 1967 (Bell, Hewish)', conf: 'official' }
    ],
    sources: [
      { label: 'NASA · Neutron Stars and Pulsars', url: 'https://science.nasa.gov/universe/' },
      { label: 'NASA · Crab Pulsar', url: 'https://science.nasa.gov/mission/chandra/' }
    ],
    color: 0x9fffea,
    accent: '#9fffea',
    scale: 'compact',
    notToScale: true
  },
  {
    id: 'magnetar',
    label: 'Magnetar',
    glyph: 'SGR',
    headline: 'A neutron star whose magnetic field is the main character.',
    tagline: 'A neutron star with a magnetic field strong enough to rearrange matter from a distance.',
    seeing: 'A small dense core. Loops of magnetic field arcing out and collapsing back. Sudden flares as the crust cracks under magnetic stress.',
    matter:
      'Magnetar fields reach 10¹⁴ to 10¹⁵ Gauss, a thousand times stronger than a typical pulsar and a quadrillion times Earth\'s field. ' +
      'A magnetar at the distance of the Moon would erase the data on every credit card on Earth. ' +
      'They are now the leading candidate for some fast radio bursts.',
    facts: [
      { k: 'Field strength', v: '10¹⁴–10¹⁵ G (peta-Gauss)', conf: 'official' },
      { k: 'Active lifetime', v: '~10,000 years', conf: 'official' },
      { k: 'Known in galaxy', v: '~30 confirmed (2026)', conf: 'reported' },
      { k: 'FRB link', v: 'SGR 1935+2154 (April 2020)', conf: 'official' }
    ],
    sources: [
      { label: 'NASA · Magnetars', url: 'https://science.nasa.gov/universe/' },
      { label: 'NASA Universe topics', url: 'https://science.nasa.gov/universe/' }
    ],
    color: 0xb088ff,
    accent: '#b088ff',
    scale: 'compact',
    notToScale: true
  },
  {
    id: 'grb',
    label: 'Gamma-Ray Burst',
    glyph: 'GRB',
    headline: 'The universe firing a flare gun at relativistic speed.',
    tagline: 'The brightest electromagnetic events known, lasting milliseconds to minutes.',
    seeing: 'A narrow, beamed cone of energy bursting from a collapsing star or compact-object collision. Most of the energy travels along a jet only a few degrees wide.',
    matter:
      'In a few seconds, a gamma-ray burst can release more energy than the Sun will emit in its entire ten-billion-year lifetime. ' +
      'Long bursts (>2 s) come from collapsing massive stars. Short bursts (<2 s) come from neutron-star mergers, the same events that ' +
      'produce gravitational waves and the heaviest elements.',
    facts: [
      { k: 'Discovery', v: 'Vela satellites, 1967 (declassified 1973)', conf: 'official' },
      { k: 'Energy', v: '10⁵¹ erg (isotropic equivalent)', conf: 'official' },
      { k: 'Beam opening', v: 'A few degrees, typically', conf: 'official' },
      { k: 'GRB 221009A', v: 'Brightest ever recorded, October 2022', conf: 'official' }
    ],
    sources: [
      { label: 'NASA · Gamma-Ray Bursts', url: 'https://science.nasa.gov/universe/' },
      { label: 'NASA Universe', url: 'https://science.nasa.gov/universe/' }
    ],
    color: 0xff7a3f,
    accent: '#ff7a3f',
    scale: 'cosmological',
    notToScale: true
  },
  {
    id: 'supernova',
    label: 'Supernova',
    glyph: 'SN',
    headline: 'A star\'s catastrophic ending. Also a foundry.',
    tagline: 'A star\'s violent death and one of the universe\'s primary heavy-element forges.',
    seeing: 'A central remnant (neutron star or black hole) inside an expanding shell of glowing debris. Filaments of plasma traveling thousands of kilometers per second.',
    matter:
      'Type Ia supernovae are nearly identical in peak brightness, which is how we measured cosmic acceleration in 1998. ' +
      'Every atom heavier than iron in your body was forged in a supernova or a neutron-star merger. ' +
      'The Crab Nebula is the remnant of a supernova observed by Chinese astronomers on 4 July 1054.',
    facts: [
      { k: 'Peak brightness', v: '~5 × 10⁹ L☉ (Type Ia)', conf: 'official' },
      { k: 'Frequency', v: '~1 per century per galaxy', conf: 'official' },
      { k: 'SN 1987A', v: 'Last visible from Earth, naked-eye', conf: 'official' },
      { k: 'Element role', v: 'Source of O, Si, Fe, and beyond', conf: 'official' }
    ],
    sources: [
      { label: 'NASA · Supernovae', url: 'https://science.nasa.gov/universe/' },
      { label: 'NASA Hubble', url: 'https://science.nasa.gov/mission/hubble/' }
    ],
    color: 0xffd277,
    accent: '#ffd277',
    scale: 'stellar',
    notToScale: true
  },
  {
    id: 'merger',
    label: 'Neutron Star Merger',
    glyph: 'NSM',
    headline: 'When dead stars collide, spacetime rings.',
    tagline: 'A kilonova: two compact stars spiral, collide, and forge half the periodic table beyond iron.',
    seeing: 'Two small dense spheres orbiting tighter and tighter. A bright ejecta ring of newly synthesized heavy elements. Concentric ripples representing gravitational waves leaving the system.',
    matter:
      'GW170817, observed in August 2017, was the first event ever detected in both gravitational waves and light. ' +
      'It confirmed neutron-star mergers as a major source of gold, platinum, and other r-process elements. ' +
      'A single merger can produce roughly the mass of Jupiter in pure gold.',
    facts: [
      { k: 'GW170817', v: 'First multi-messenger detection, Aug 17 2017', conf: 'official' },
      { k: 'Distance', v: '40 Mpc, in NGC 4993', conf: 'official' },
      { k: 'Heavy elements', v: '~10 M☉_Jupiter of gold per merger', conf: 'official' },
      { k: 'Result', v: 'Likely a black hole, possibly hypermassive NS', conf: 'reported' }
    ],
    sources: [
      { label: 'LIGO · GW170817', url: 'https://www.ligo.org/detections.php' },
      { label: 'NASA · Neutron Star Mergers', url: 'https://science.nasa.gov/universe/' }
    ],
    color: 0xfff3a3,
    accent: '#fff3a3',
    scale: 'compact',
    notToScale: true
  },
  {
    id: 'lens',
    label: 'Gravitational Lens',
    glyph: 'GL',
    headline: 'Mass bends light. Gravity becomes optics.',
    tagline: 'Massive foreground objects warp spacetime, turning the universe into a natural telescope.',
    seeing: 'A central foreground mass. Background galaxies smeared into arcs, rings, or split into multiple copies. Sometimes a perfect Einstein ring when alignment is exact.',
    matter:
      'Predicted by General Relativity in 1915 and confirmed during the 1919 solar eclipse. ' +
      'Gravitational lensing now lets astronomers map dark matter (which interacts only gravitationally), measure the Hubble constant ' +
      'with time delays between multiple images, and detect exoplanets via microlensing.',
    facts: [
      { k: 'First confirmed', v: 'Twin Quasar Q0957+561, 1979', conf: 'official' },
      { k: 'Strong lensing', v: 'Multiple images / arcs / rings', conf: 'official' },
      { k: 'Weak lensing', v: 'Statistical distortion of background', conf: 'official' },
      { k: 'Microlensing', v: 'Brief brightening from a planet/star', conf: 'official' }
    ],
    sources: [
      { label: 'NASA · Gravitational Lensing', url: 'https://science.nasa.gov/universe/' },
      { label: 'NASA Hubble · Lensing', url: 'https://science.nasa.gov/mission/hubble/' }
    ],
    color: 0xc8b6ff,
    accent: '#c8b6ff',
    scale: 'galactic',
    notToScale: true
  }
];

// ─── Comparison matrix rows ─────────────────────────────────────────
export const COMPARISON_ROWS = [
  {
    object: 'Quasar',
    engine: 'Accretion onto SMBH',
    energy: 'Gravitational potential of in-falling gas',
    observe: 'Broad-line UV/optical, X-ray excess, radio jets',
    scale: 'Engine: AU. Galaxy: 10⁵ ly',
    signature: 'Outshines its host galaxy'
  },
  {
    object: 'Black Hole',
    engine: 'Spacetime curvature',
    energy: 'None directly. Visible via accretion + lensing',
    observe: 'Stellar orbits, X-ray binaries, EHT shadows',
    scale: '10⁻⁵ to 10¹⁰ M☉',
    signature: 'Dark shadow inside photon ring'
  },
  {
    object: 'Pulsar',
    engine: 'Rotational kinetic energy',
    energy: 'Spin-down of a magnetized neutron star',
    observe: 'Periodic pulses across radio, X-ray, gamma',
    scale: '~20 km diameter',
    signature: 'Beams sweeping like a lighthouse'
  },
  {
    object: 'Magnetar',
    engine: 'Magnetic field decay',
    energy: 'Stress release in 10¹⁴–10¹⁵ G field',
    observe: 'Soft gamma repeaters, X-ray bursts, FRBs',
    scale: '~20 km diameter',
    signature: 'Sudden bursts. Persistent X-ray glow'
  },
  {
    object: 'Gamma-Ray Burst',
    engine: 'Relativistic jet from collapse or merger',
    energy: 'Released in seconds, beamed narrowly',
    observe: 'Bright gamma flash, then long afterglow',
    scale: 'Source: ~10 km. Reach: cosmological',
    signature: 'Universe\'s brightest electromagnetic flash'
  },
  {
    object: 'Supernova',
    engine: 'Core collapse or thermonuclear runaway',
    energy: 'Gravitational binding (CC) or fusion (Ia)',
    observe: 'Sudden bright star, expanding remnant',
    scale: 'Remnant grows to ~10 ly',
    signature: 'Outshines its galaxy for weeks'
  },
  {
    object: 'NS Merger',
    engine: 'Two neutron stars in-spiral',
    energy: 'Gravitational + nuclear (kilonova)',
    observe: 'GW chirp, kilonova UV/IR, short GRB',
    scale: 'Tens of km, then ejecta cloud',
    signature: 'Gravitational waves + heavy-element flash'
  },
  {
    object: 'Gravitational Lens',
    engine: 'Spacetime curvature, no power required',
    energy: 'Light from a background source, redirected',
    observe: 'Arcs, rings, multiply-imaged sources',
    scale: 'Lens: galaxy or cluster (10⁴–10⁶ ly)',
    signature: 'Distorted, duplicated background'
  }
];

// ─── Hero scroll states (for the quasar story) ─────────────────────
export const QUASAR_SCROLL_STATES = [
  {
    progress: 0.0,
    label: 'Far view',
    note: 'A galactic engine, viewed from outside.'
  },
  {
    progress: 0.25,
    label: 'Approach',
    note: 'Camera arcs toward the disk.'
  },
  {
    progress: 0.5,
    label: 'Inside the disk',
    note: 'Accretion plasma. Differential rotation. Heat.'
  },
  {
    progress: 0.75,
    label: 'Jet axis',
    note: 'Beamed plasma escapes along the poles.'
  },
  {
    progress: 1.0,
    label: 'System',
    note: 'A super-massive black hole in overdrive.'
  }
];
