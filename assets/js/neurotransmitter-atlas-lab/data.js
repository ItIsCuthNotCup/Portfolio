export const STRUCTURES = [
  {
    id: 'dendrites',
    label: 'Dendrites',
    mode: 'full',
    summary: 'Branching inputs. Most incoming signals arrive here before they are integrated by the cell body.',
    source: 'NINDS'
  },
  {
    id: 'soma',
    label: 'Soma',
    mode: 'isolate',
    summary: 'The cell body collects incoming voltage changes and keeps the neuron alive.',
    source: 'NINDS'
  },
  {
    id: 'axon',
    label: 'Axon',
    mode: 'full',
    summary: 'A long output cable. When the neuron fires, the action potential travels away from the soma.',
    source: 'NINDS'
  },
  {
    id: 'myelin',
    label: 'Myelin',
    mode: 'full',
    summary: 'Insulating wraps that help electrical signals travel faster along the axon.',
    source: 'NINDS'
  },
  {
    id: 'terminal',
    label: 'Axon terminal',
    mode: 'synapse',
    summary: 'The release site where an electrical spike becomes a chemical message.',
    source: 'BrainFacts'
  },
  {
    id: 'vesicles',
    label: 'Synaptic vesicles',
    mode: 'synapse',
    summary: 'Tiny packages loaded with neurotransmitter molecules before release.',
    source: 'NCBI Bookshelf'
  },
  {
    id: 'receptors',
    label: 'Receptors',
    mode: 'synapse',
    summary: 'Molecular locks on the receiving cell. Different receptors can make the same transmitter act differently.',
    source: 'PDB-101'
  }
];

export const CHAPTER_OBJECTIVES = [
  {
    label: 'Trace the route',
    text: 'Follow a signal from dendrite input to axon terminal release.'
  },
  {
    label: 'Separate speed from meaning',
    text: 'Compare fast ion channels with slower modulatory receptors.'
  },
  {
    label: 'Read the brain map carefully',
    text: 'Treat highlighted regions as representative circuits, not single-purpose locations.'
  },
  {
    label: 'Use the right vocabulary',
    text: 'Explain vesicles, receptors, reuptake, and synaptic cleft without hand-waving.'
  }
];

export const CORE_RULES = [
  {
    label: 'Input',
    title: 'Dendrites do not decide alone',
    body: 'A neuron receives many small excitatory and inhibitory inputs. The soma and axon initial segment matter because the firing decision is a sum across time and space.',
    cue: 'Look for clustered dendrites, then watch whether the axon pulse appears.'
  },
  {
    label: 'Conversion',
    title: 'The terminal changes voltage into chemistry',
    body: 'An action potential is electrical inside the sending neuron. At the terminal, calcium entry triggers vesicle fusion so molecules can cross the synaptic cleft.',
    cue: 'Use Synapse mode and press Release pulse.'
  },
  {
    label: 'Receptor',
    title: 'The receiver defines the effect',
    body: 'The same transmitter can act quickly through ion channels or more slowly through signaling cascades. Receptor subtype is why one molecule can have several circuit meanings.',
    cue: 'Compare the receptor table before memorizing transmitter labels.'
  },
  {
    label: 'Circuit',
    title: 'Brain regions are network clues',
    body: 'A highlighted region is not a button for a behavior. It is a representative circuit where that transmitter system is especially useful to study.',
    cue: 'Switch to Brain mode after selecting a transmitter.'
  }
];

export const SIGNAL_STEPS = [
  {
    id: 'inputs',
    label: 'Inputs',
    shortLabel: 'Dendrites',
    mode: 'full',
    title: 'Dendrites collect local voltage changes',
    body: 'Most incoming synapses land on dendrites. A single input is usually not the whole decision. The soma integrates many excitatory and inhibitory nudges before the axon initial segment fires.',
    visual: 'Watch the soma and dendrite field. The important idea is summation, not one magic trigger.',
    source: 'NINDS neuron basics'
  },
  {
    id: 'spike',
    label: 'Spike',
    shortLabel: 'Axon',
    mode: 'full',
    title: 'An action potential travels down the axon',
    body: 'If threshold is crossed, the neuron sends a regenerative electrical spike along the axon. Myelin helps the signal move faster by insulating segments and concentrating exchange at the nodes.',
    visual: 'The bright pulse follows the axon toward the terminal.',
    source: 'BrainFacts action potential'
  },
  {
    id: 'calcium',
    label: 'Calcium',
    shortLabel: 'Gate',
    mode: 'synapse',
    title: 'Voltage opens calcium channels at the terminal',
    body: 'When the spike reaches the axon terminal, voltage-gated calcium channels open. Calcium entry is the trigger that tells vesicles to fuse with the presynaptic membrane.',
    visual: 'Blue calcium particles gather near the release site.',
    source: 'BrainFacts synapses'
  },
  {
    id: 'release',
    label: 'Release',
    shortLabel: 'Vesicles',
    mode: 'synapse',
    title: 'Vesicles fuse and release transmitter',
    body: 'Synaptic vesicles are small packages loaded with neurotransmitter molecules. Fusion empties the cargo into the synaptic cleft, the narrow gap between the two cells.',
    visual: 'Transmitter particles cross the cleft after the release pulse.',
    source: 'NCBI neurotransmitter cycle'
  },
  {
    id: 'receptors',
    label: 'Receptors',
    shortLabel: 'Binding',
    mode: 'synapse',
    title: 'Receptors translate chemistry back into voltage or state',
    body: 'Ionotropic receptors can open channels quickly. Metabotropic receptors act through biochemical cascades. The same transmitter can mean different things because receptor subtype and circuit context matter.',
    visual: 'The postsynaptic side brightens where receptors receive the signal.',
    source: 'PDB-101 AMPA receptor'
  },
  {
    id: 'cleanup',
    label: 'Cleanup',
    shortLabel: 'Off switch',
    mode: 'synapse',
    title: 'The message must be cleared',
    body: 'Transmitter molecules do not stay bound forever. They detach, are broken down, diffuse away, or are taken back up by cells. Without cleanup, the signal would keep activating receptors.',
    visual: 'The particle cloud fades, leaving the synapse ready for another message.',
    source: 'BrainFacts reuptake'
  }
];

export const TRANSMITTERS = [
  {
    id: 'glutamate',
    label: 'Glutamate',
    type: 'Amino acid transmitter',
    color: '#e45b47',
    primaryAction: 'Primary excitatory signal',
    readerFrame: 'Use glutamate as the atlas baseline for fast excitation. It is the transmitter most likely to move the receiving neuron toward threshold.',
    commonTrap: 'Do not read glutamate as generic energy. It is a synaptic signal, and excess extracellular glutamate can become harmful.',
    selfCheck: 'If AMPA receptors open after glutamate release, does the receiving cell usually move closer to firing or farther away?',
    brainRegions: [
      { id: 'cortex', label: 'Cortex', note: 'Fast excitation for perception and planning.' },
      { id: 'hippocampus', label: 'Hippocampus', note: 'Plasticity circuits used in learning and memory.' },
      { id: 'thalamus', label: 'Thalamus', note: 'Relay loops that keep sensory traffic moving.' }
    ],
    synapseMechanism: 'Released from vesicles, it binds AMPA and NMDA-type receptors. AMPA opens fast ion channels. NMDA is slower and important when repeated signals arrive.',
    effectSummary: 'Glutamate usually pushes the receiving neuron closer to firing. It is the main accelerator in the atlas, but too much extracellular glutamate can be damaging.',
    limits: 'Glutamate is common across the central nervous system. This page highlights representative regions rather than drawing every glutamatergic pathway.',
    sources: [
      { label: 'BrainFacts · Synapses and neurotransmission', url: 'https://www.brainfacts.org/brain-anatomy-and-function/cells-and-circuits/2022/synapses-and-neurotransmission-113022' },
      { label: 'PDB-101 · AMPA receptor', url: 'https://pdb101.rcsb.org/motm/235' }
    ]
  },
  {
    id: 'gaba',
    label: 'GABA',
    type: 'Amino acid transmitter',
    color: '#5e7fc9',
    primaryAction: 'Primary inhibitory signal',
    readerFrame: 'Use GABA as the counterweight to glutamate. It makes circuits selective by lowering firing probability or sharpening timing.',
    commonTrap: 'Inhibition is not brain shutdown. It can make a network more precise, not merely less active.',
    selfCheck: 'Why can stronger inhibition improve signal quality instead of simply reducing behavior?',
    brainRegions: [
      { id: 'cortex', label: 'Cortex', note: 'Local inhibitory interneurons keep firing patterns precise.' },
      { id: 'basal-ganglia', label: 'Basal ganglia', note: 'Inhibitory loops help gate movement and action selection.' },
      { id: 'cerebellum', label: 'Cerebellum', note: 'Timing circuits use inhibition to tune motor output.' }
    ],
    synapseMechanism: 'GABA receptors can let chloride ions enter or potassium ions leave. Either route tends to push voltage downward and reduce firing probability.',
    effectSummary: 'GABA is the main brake. It does not shut the brain off. It sculpts timing, prevents runaway excitation, and lets circuits stay selective.',
    limits: 'GABA action depends on receptor subtype and cell state. The atlas shows the common inhibitory pattern.',
    sources: [
      { label: 'BrainFacts · GABA and glutamate', url: 'https://www.brainfacts.org/brain-anatomy-and-function/cells-and-circuits/2022/synapses-and-neurotransmission-113022' },
      { label: 'NCBI Bookshelf · Major neurotransmitters', url: 'https://www.ncbi.nlm.nih.gov/books/NBK613069/table/ch9nsa.T.major_neurotransmitters/' }
    ]
  },
  {
    id: 'dopamine',
    label: 'Dopamine',
    type: 'Biogenic amine',
    color: '#d5942f',
    primaryAction: 'Modulation for reward, movement, and learning',
    readerFrame: 'Read dopamine as a teaching and control signal. It often changes how strongly a circuit learns from outcomes or initiates action.',
    commonTrap: 'Dopamine is not the pleasure molecule. It participates in reward learning, movement, salience, motivation, and attention depending on pathway.',
    selfCheck: 'What changes when dopamine acts through a metabotropic receptor instead of opening a fast ion channel?',
    brainRegions: [
      { id: 'substantia-nigra', label: 'Substantia nigra', note: 'Movement-related dopamine projections to the striatum.' },
      { id: 'basal-ganglia', label: 'Basal ganglia', note: 'Action selection and fine movement loops.' },
      { id: 'prefrontal', label: 'Prefrontal cortex', note: 'Working memory, attention, and executive control.' }
    ],
    synapseMechanism: 'Dopamine often works through metabotropic receptors. Instead of opening a channel directly, it changes how responsive the receiving cell becomes.',
    effectSummary: 'Dopamine is a context setter. It helps circuits learn from outcomes, initiate movement, and allocate attention.',
    limits: 'Dopamine is not simply pleasure. Region, receptor subtype, timing, and circuit state decide what the signal means.',
    sources: [
      { label: 'NCBI Bookshelf · Physiology, Neurotransmitters', url: 'https://www.ncbi.nlm.nih.gov/books/NBK539894/' },
      { label: 'NINDS · Life and death of a neuron', url: 'https://www.ninds.nih.gov/health-information/public-education/brain-basics/brain-basics-life-and-death-neuron' }
    ]
  },
  {
    id: 'serotonin',
    label: 'Serotonin',
    type: 'Biogenic amine',
    color: '#b86ebd',
    primaryAction: 'Mood, sleep, pain, and state regulation',
    readerFrame: 'Read serotonin as a state regulator with many receptor families. It can tune mood, sleep, pain, appetite, and behavioral flexibility.',
    commonTrap: 'Serotonin does not equal happiness. A serotonin signal changes meaning across receptor subtype, region, and behavioral state.',
    selfCheck: 'Why would the same serotonin molecule have different effects in the brain stem, hypothalamus, and limbic circuits?',
    brainRegions: [
      { id: 'brainstem', label: 'Brain stem', note: 'Raphe nuclei send broad serotonin projections.' },
      { id: 'hypothalamus', label: 'Hypothalamus', note: 'State, appetite, sleep, and autonomic regulation.' },
      { id: 'limbic', label: 'Limbic system', note: 'Emotion and threat-related circuits.' }
    ],
    synapseMechanism: 'Serotonin uses many receptor families. Most are metabotropic, so effects can be slower and state-dependent.',
    effectSummary: 'Serotonin changes the gain on many systems. It can shape mood, sleep, pain signaling, and behavioral flexibility.',
    limits: 'Serotonin does not equal happiness. The same transmitter can have different effects depending on receptor and region.',
    sources: [
      { label: 'NCBI Bookshelf · Major neurotransmitters', url: 'https://www.ncbi.nlm.nih.gov/books/NBK613069/table/ch9nsa.T.major_neurotransmitters/' },
      { label: 'PDB-101 · Cellular signaling', url: 'https://pdb101.rcsb.org/browse/cellular-signaling' }
    ]
  },
  {
    id: 'acetylcholine',
    label: 'Acetylcholine',
    type: 'Small molecule transmitter',
    color: '#2f9d84',
    primaryAction: 'Attention, learning, autonomic signaling, and muscle control',
    readerFrame: 'Read acetylcholine as a selection and readiness signal. In the brain it supports attention, arousal, and encoding; at the neuromuscular junction it drives muscle contraction.',
    commonTrap: 'Do not collapse central and peripheral roles. Brain cholinergic systems and neuromuscular signaling share a molecule but serve different contexts.',
    selfCheck: 'Why does acetylcholinesterase matter immediately after acetylcholine reaches a receptor?',
    brainRegions: [
      { id: 'basal-forebrain', label: 'Basal forebrain', note: 'Attention and cortical arousal projections.' },
      { id: 'hippocampus', label: 'Hippocampus', note: 'Memory encoding and plasticity support.' },
      { id: 'brainstem', label: 'Brain stem', note: 'Arousal and sleep-wake state circuits.' }
    ],
    synapseMechanism: 'Acetylcholine can bind fast nicotinic receptors or slower muscarinic receptors. Acetylcholinesterase helps stop the message.',
    effectSummary: 'Acetylcholine helps the brain select, attend, encode, and coordinate. At the neuromuscular junction it also drives muscle contraction.',
    limits: 'The atlas focuses on brain signaling, not the full peripheral nervous system role.',
    sources: [
      { label: 'BrainFacts · Classical neurotransmitters', url: 'https://www.brainfacts.org/brain-anatomy-and-function/cells-and-circuits/2012/classical-neurotransmitters-brain-communicators' },
      { label: 'PDB-101 · Acetylcholine receptor listing', url: 'https://pdb101.rcsb.org/browse/cellular-signaling' }
    ]
  },
  {
    id: 'norepinephrine',
    label: 'Norepinephrine',
    type: 'Biogenic amine',
    color: '#c85e75',
    primaryAction: 'Arousal, vigilance, and stress-state tuning',
    readerFrame: 'Read norepinephrine as a vigilance and priority signal. It helps circuits respond differently when the body needs alertness.',
    commonTrap: 'Arousal is not a single volume knob. Norepinephrine works with other transmitters, hormones, and circuit state.',
    selfCheck: 'Why would a broad projection system be useful for shifting the brain into a more alert state?',
    brainRegions: [
      { id: 'locus-coeruleus', label: 'Locus coeruleus', note: 'Major source of broad norepinephrine projections.' },
      { id: 'prefrontal', label: 'Prefrontal cortex', note: 'Attention and task-state control.' },
      { id: 'hypothalamus', label: 'Hypothalamus', note: 'Autonomic and stress-related regulation.' }
    ],
    synapseMechanism: 'Norepinephrine often binds adrenergic metabotropic receptors, changing circuit responsiveness during alert states.',
    effectSummary: 'Norepinephrine raises the system toward vigilance. It helps the brain prioritize signals when the body needs readiness.',
    limits: 'Arousal is not one thing. Norepinephrine works alongside acetylcholine, serotonin, dopamine, histamine, hormones, and circuit context.',
    sources: [
      { label: 'BrainFacts · Classical neurotransmitters', url: 'https://www.brainfacts.org/brain-anatomy-and-function/cells-and-circuits/2012/classical-neurotransmitters-brain-communicators' },
      { label: 'NCBI Bookshelf · Major neurotransmitters', url: 'https://www.ncbi.nlm.nih.gov/books/NBK613069/table/ch9nsa.T.major_neurotransmitters/' }
    ]
  }
];

export const REGION_POSITIONS = {
  cortex: { label: 'Cortex', position: [-0.04, 0.58, 0.7] },
  prefrontal: { label: 'Prefrontal cortex', position: [-0.84, 0.32, 0.72] },
  hippocampus: { label: 'Hippocampus', position: [-0.18, -0.2, 0.78] },
  thalamus: { label: 'Thalamus', position: [0.08, 0.02, 0.78] },
  hypothalamus: { label: 'Hypothalamus', position: [0.03, -0.42, 0.78] },
  limbic: { label: 'Limbic system', position: [-0.38, 0.06, 0.82] },
  'basal-ganglia': { label: 'Basal ganglia', position: [0.18, -0.08, 0.78] },
  cerebellum: { label: 'Cerebellum', position: [0.62, -0.46, 0.64] },
  brainstem: { label: 'Brain stem', position: [0.23, -0.82, 0.62] },
  'basal-forebrain': { label: 'Basal forebrain', position: [-0.36, -0.3, 0.78] },
  'substantia-nigra': { label: 'Substantia nigra', position: [0.22, -0.56, 0.72] },
  'locus-coeruleus': { label: 'Locus coeruleus', position: [0.31, -0.72, 0.68] }
};

export const METHOD_SOURCES = [
  {
    label: 'NIH 3D · EyeWire neuron reconstructions',
    url: 'https://3d.nih.gov/collections/2'
  },
  {
    label: 'NIH 3D · 3D model of the Brain',
    url: 'https://3d.nih.gov/entries/3765'
  },
  {
    label: 'NCBI Bookshelf · Neurotransmitters',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK10795/'
  },
  {
    label: 'NCBI Bookshelf · Physiology, Neurotransmitters',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK539894/'
  },
  {
    label: 'NINDS · Brain Basics: Life and death of a neuron',
    url: 'https://www.ninds.nih.gov/health-information/public-education/brain-basics/brain-basics-life-and-death-neuron'
  },
  {
    label: 'BrainFacts · Classical neurotransmitters',
    url: 'https://www.brainfacts.org/brain-anatomy-and-function/cells-and-circuits/2012/classical-neurotransmitters-brain-communicators'
  },
  {
    label: 'BrainFacts · Synapses and neurotransmission',
    url: 'https://www.brainfacts.org/brain-anatomy-and-function/cells-and-circuits/2022/synapses-and-neurotransmission-113022'
  },
  {
    label: 'PDB-101 · AMPA receptor',
    url: 'https://pdb101.rcsb.org/motm/235'
  },
  {
    label: 'Meshy API · offline 3D asset pipeline',
    url: 'https://docs.meshy.ai/en/api/quick-start'
  },
  {
    label: 'OpenAI · gpt-image-2 image generation',
    url: 'https://developers.openai.com/api/docs/guides/image-generation'
  }
];

export const RECEPTOR_COMPARISON = [
  {
    axis: 'Ionotropic',
    tempo: 'Milliseconds',
    mechanism: 'Transmitter binds directly to a ligand-gated ion channel.',
    example: 'AMPA receptor for glutamate',
    takeaway: 'Best for fast excitation or inhibition.'
  },
  {
    axis: 'Metabotropic',
    tempo: 'Hundreds of milliseconds to seconds',
    mechanism: 'Transmitter binds a receptor that triggers intracellular signaling.',
    example: 'Many dopamine, serotonin, and norepinephrine receptors',
    takeaway: 'Best for changing the gain or state of a circuit.'
  },
  {
    axis: 'Removal',
    tempo: 'After release',
    mechanism: 'Transporters, enzymes, diffusion, and glial uptake end the signal.',
    example: 'Acetylcholinesterase at cholinergic synapses',
    takeaway: 'The off-switch is part of the computation.'
  }
];

export const GLOSSARY = [
  ['Action potential', 'A brief electrical spike that travels along the axon.'],
  ['Axon terminal', 'The presynaptic ending where vesicles release transmitter.'],
  ['Axon initial segment', 'The trigger zone near the soma where summed inputs can initiate an action potential.'],
  ['Calcium channel', 'A voltage-sensitive terminal channel whose calcium entry helps trigger vesicle fusion.'],
  ['Dendrite', 'A branched input surface that receives many synaptic contacts.'],
  ['EPSP', 'An excitatory postsynaptic potential. It nudges the receiving neuron closer to firing.'],
  ['IPSP', 'An inhibitory postsynaptic potential. It nudges the receiving neuron away from firing or makes firing less likely.'],
  ['Ionotropic receptor', 'A receptor that is part of an ion channel and can act quickly.'],
  ['Metabotropic receptor', 'A receptor that changes cell state through signaling cascades.'],
  ['Myelin', 'Insulating wraps that speed axonal signaling.'],
  ['Neuromodulator', 'A chemical signal that often changes the responsiveness or state of a circuit rather than carrying one fast message.'],
  ['Neurotransmitter', 'A chemical released by a neuron that binds receptors on another cell to change its activity.'],
  ['Postsynaptic density', 'A receptor-rich zone on the receiving side of a synapse.'],
  ['Reuptake', 'Reabsorption of transmitter into cells after release.'],
  ['Summation', 'The way many small inputs combine across dendrites, soma, and time before a firing decision.'],
  ['Synaptic cleft', 'The small gap transmitter molecules cross between neurons.'],
  ['Vesicle', 'A membrane package that stores transmitter before release.']
];

export const MISCONCEPTIONS = [
  {
    myth: 'Dopamine is pleasure.',
    correction: 'Dopamine is better understood as a modulatory signal for learning, movement, motivation, and salience. Pleasure is not a single molecule.'
  },
  {
    myth: 'Excitatory always means good and inhibitory always means bad.',
    correction: 'Excitation and inhibition are circuit operations. A stable brain needs both, precisely timed.'
  },
  {
    myth: 'One brain point controls one behavior.',
    correction: 'Brain regions participate in networks. The atlas highlights representative regions so the map stays readable.'
  },
  {
    myth: 'A neurotransmitter has one effect everywhere.',
    correction: 'Effect depends on receptor subtype, cell type, timing, concentration, and the local circuit state.'
  },
  {
    myth: 'A brain map label is an exact treatment target.',
    correction: 'This atlas is educational. Region markers are representative anatomy notes, not diagnosis, prescription, or stimulation guidance.'
  },
  {
    myth: 'The important part is only the release event.',
    correction: 'A complete synapse includes synthesis, vesicle storage, release, receptor binding, and removal. The reset phase shapes the next signal.'
  }
];

export const CHECK_YOURSELF = [
  {
    prompt: 'Why does the synaptic cleft force neurons to use chemistry?',
    answer: 'The cleft separates cells. An electrical spike cannot directly push the next membrane across that gap, so transmitter molecules carry the message.'
  },
  {
    prompt: 'What event tells vesicles to release neurotransmitter?',
    answer: 'Calcium entry at the axon terminal. The arriving action potential opens voltage-gated calcium channels.'
  },
  {
    prompt: 'Why is cleanup necessary after release?',
    answer: 'If transmitter stayed active, receptors would keep responding. Removal resets the synapse and protects timing.'
  },
  {
    prompt: 'Why is serotonin not simply a happiness molecule?',
    answer: 'Serotonin acts through many receptor families across many circuits. Its effect depends on receptor, region, and state.'
  },
  {
    prompt: 'What is the difference between a transmitter and its receptor?',
    answer: 'The transmitter is the released molecule. The receptor is the receiving protein that decides whether the molecule opens a channel, triggers a cascade, or changes cell state.'
  },
  {
    prompt: 'Why are dopamine and norepinephrine shown as broad systems instead of single synapse-only effects?',
    answer: 'They often act as modulators. Their projections can shift responsiveness across circuits, so pathway and timing matter as much as the molecule.'
  }
];
