import { createCanvas } from '@napi-rs/canvas';
import { Style } from '../core/Style.js';

const TAU = Math.PI * 2;
let automaticSeedSequence = 0;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const fract = (value) => value - Math.floor(value);
const lerp = (a, b, amount) => a + (b - a) * amount;
const smoothstep = (edge0, edge1, value) => {
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
};

// Deterministic per-cell hash used by the bubble field: cheap enough to call
// a handful of times per pixel without a lookup table, distinct from
// SmoothNoise's hash so bubble placement doesn't correlate with the warp
// noise it sits on top of.
const bubbleCellHash = (ix, iy, salt, seedSalt) => {
  let value = Math.imul(ix, 0x27d4eb2d)
    ^ Math.imul(iy, 0x85ebca6b)
    ^ Math.imul(salt, 0x9e3779b9)
    ^ seedSalt;
  value = Math.imul(value ^ (value >>> 15), 0x2c1b3c6d);
  value = Math.imul(value ^ (value >>> 12), 0x297a2d39);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967295;
};

const createAutomaticSeed = () => {
  automaticSeedSequence = (automaticSeedSequence + 0x9e3779b9) >>> 0;
  const timestamp = Date.now() >>> 0;
  const fineTime = Math.floor((globalThis.performance?.now?.() || 0) * 1000) >>> 0;
  const randomBits = Math.floor(Math.random() * 0x100000000) >>> 0;
  const seed = timestamp ^ fineTime ^ randomBits ^ automaticSeedSequence;
  return seed >>> 0 || automaticSeedSequence || 1;
};

class SeededRandom {
  constructor(seed) {
    this.state = (Number(seed) || 1) >>> 0;
  }

  next() {
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + (max - min) * this.next();
  }
}

class SmoothNoise {
  constructor(seed) {
    this.seed = seed | 0;
  }

  _hash(x, y) {
    let value = Math.imul(x, 0x1f123bb5) ^ Math.imul(y, 0x5f356495) ^ this.seed;
    value = Math.imul(value ^ (value >>> 15), 0x2c1b3c6d);
    value = Math.imul(value ^ (value >>> 12), 0x297a2d39);
    return ((value ^ (value >>> 15)) >>> 0) / 4294967295;
  }

  sample(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = x - x0;
    const ty = y - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const top = lerp(this._hash(x0, y0), this._hash(x0 + 1, y0), sx);
    const bottom = lerp(this._hash(x0, y0 + 1), this._hash(x0 + 1, y0 + 1), sx);
    return lerp(top, bottom, sy);
  }

  fbm(x, y, octaves = 3) {
    let value = 0;
    let amplitude = 0.58;
    let frequency = 1;
    let total = 0;
    for (let octave = 0; octave < octaves; octave++) {
      value += this.sample(x * frequency, y * frequency) * amplitude;
      total += amplitude;
      frequency *= 2.07;
      amplitude *= 0.48;
    }
    return value / total;
  }
}

const MODES = {
  'chromatic-wave': {
    name: 'chromatic-wave',
    aliases: ['colorful', 'molten-wave', 'acid-sunset', 'cosmic-candy'],
    renderScale: 1.12,
    vortexCount: 16,
    randomVortexRadius: [0.045, 0.20],
    randomVortexStrength: [0.9, 2.5],
    warpNoise: 0.095,
    bandScale: 2.72,
    contourFrequency: 16,
    microFrequency: 37,
    primaryWidth: 0.070,
    microWidth: 0.045,
    seamWidth: 0.022,
    baseFlow: { x: 0.78, y: -0.12 },
    boundaryBubbles: {
      cell: 0.050, occupancy: 0.60, radius: [0.008, 0.036],
      strength: [0.20, 0.65], fringe: 0.12
    },
    filamentDensity: 1 / 850,
    filamentRange: [320, 2200],
    filamentWidth: [0.22, 1.45],
    filamentAlpha: [0.12, 0.48],
    filamentSteps: [8, 27],
    filamentStep: [0.0018, 0.0042],
    palette: [
      { h: 347, s: 100, l: 35 },
      { h: 350, s: 100, l: 55 },
      { h: 333, s: 100, l: 62 },
      { h: 319, s: 100, l: 61 },
      { h: 302, s: 100, l: 59 },
      { h: 283, s: 100, l: 56 },
      { h: 336, s: 100, l: 69 },
      { h: 352, s: 100, l: 64 },
      { h: 218, s: 100, l: 53 },
      { h: 190, s: 100, l: 56 },
      { h: 24, s: 100, l: 61 },
      { h: 42, s: 100, l: 73 }
    ]
  },
  'ultraviolet-current': {
    name: 'ultraviolet-current',
    aliases: [
      'ultraviolet',
      'violet-vortices',
      'ultraviolet-bloom',
      'ultraviolet-marble',
      'ultraviolet-void',
      'electric-tide'
    ],
    renderScale: 1.12,
    vortexCount: 18,
    randomVortexRadius: [0.055, 0.19],
    randomVortexStrength: [0.7, 2.2],
    warpNoise: 0.055,
    bandScale: 3.65,
    contourFrequency: 16,
    microFrequency: 42,
    primaryWidth: 0.056,
    microWidth: 0.030,
    seamWidth: 0.016,
    baseFlow: { x: 0.22, y: 0.04 },
    boundaryBubbles: {
      cell: 0.044, occupancy: 0.66, radius: [0.006, 0.028],
      strength: [0.18, 0.62], fringe: 0.14
    },
    filamentDensity: 1 / 1800,
    filamentRange: [220, 1400],
    filamentWidth: [0.20, 0.72],
    filamentAlpha: [0.10, 0.34],
    filamentSteps: [8, 22],
    filamentStep: [0.0015, 0.0035],
    palette: [
      { h: 249, s: 100, l: 12 },
      { h: 258, s: 100, l: 23 },
      { h: 270, s: 100, l: 37 },
      { h: 286, s: 100, l: 47 },
      { h: 305, s: 100, l: 55 },
      { h: 323, s: 100, l: 55 },
      { h: 341, s: 100, l: 48 },
      { h: 230, s: 100, l: 48 },
      { h: 212, s: 100, l: 54 }
    ]
  },
  'amoled-lava': {
    name: 'amoled-lava',
    aliases: [
      'lava',
      'lava-lamp',
      'lava-blobs',
      'blob',
      'stirred-lava',
      'amoled-lava-drift',
      'amoled-lava-rise',
      'amoled-lava-islands'
    ],
    renderScale: 1.12,
    vortexCount: 7,
    randomVortexRadius: [0.08, 0.24],
    randomVortexStrength: [0.24, 0.72],
    warpNoise: 0.038,
    bandScale: 1.82,
    contourFrequency: 9,
    microFrequency: 23,
    primaryWidth: 0.072,
    microWidth: 0.040,
    seamWidth: 0.018,
    baseFlow: { x: 0.16, y: -0.035 },
    boundaryBubbles: {
      cell: 0.060, occupancy: 0.52, radius: [0.009, 0.040],
      strength: [0.24, 0.70], fringe: 0.10
    },
    filamentDensity: 1 / 2300,
    filamentRange: [150, 950],
    filamentWidth: [0.25, 1.05],
    filamentAlpha: [0.12, 0.38],
    filamentSteps: [7, 20],
    filamentStep: [0.0014, 0.0036],
    palette: [
      { h: 252, s: 100, l: 38 },
      { h: 270, s: 100, l: 54 },
      { h: 290, s: 100, l: 60 },
      { h: 313, s: 100, l: 61 },
      { h: 335, s: 100, l: 58 },
      { h: 190, s: 100, l: 52 },
      { h: 218, s: 100, l: 58 }
    ]
  }
};

const COLORWAYS = {
  chromatic: MODES['chromatic-wave'].palette,
  ultraviolet: MODES['ultraviolet-current'].palette,
  inferno: [
    { h: 350, s: 100, l: 34 },
    { h: 358, s: 100, l: 53 },
    { h: 9, s: 100, l: 58 },
    { h: 22, s: 100, l: 57 },
    { h: 39, s: 100, l: 62 },
    { h: 54, s: 100, l: 70 },
    { h: 326, s: 100, l: 58 }
  ],
  toxic: [
    { h: 260, s: 100, l: 35 },
    { h: 282, s: 100, l: 55 },
    { h: 307, s: 100, l: 59 },
    { h: 102, s: 100, l: 53 },
    { h: 127, s: 100, l: 48 },
    { h: 162, s: 100, l: 48 },
    { h: 187, s: 100, l: 55 }
  ],
  oceanic: [
    { h: 229, s: 100, l: 31 },
    { h: 240, s: 100, l: 47 },
    { h: 257, s: 100, l: 57 },
    { h: 205, s: 100, l: 53 },
    { h: 188, s: 100, l: 51 },
    { h: 174, s: 100, l: 47 },
    { h: 307, s: 100, l: 60 }
  ],
  aurora: [
    { h: 241, s: 100, l: 36 },
    { h: 278, s: 100, l: 56 },
    { h: 315, s: 100, l: 60 },
    { h: 171, s: 100, l: 48 },
    { h: 190, s: 100, l: 53 },
    { h: 112, s: 100, l: 55 },
    { h: 65, s: 100, l: 61 }
  ],
  'rose-gold': [
    { h: 334, s: 100, l: 35 },
    { h: 344, s: 100, l: 57 },
    { h: 355, s: 100, l: 68 },
    { h: 14, s: 100, l: 67 },
    { h: 31, s: 100, l: 72 },
    { h: 287, s: 100, l: 57 },
    { h: 316, s: 100, l: 63 }
  ],
  prism: [
    { h: 350, s: 100, l: 56 },
    { h: 25, s: 100, l: 58 },
    { h: 55, s: 100, l: 61 },
    { h: 120, s: 100, l: 50 },
    { h: 181, s: 100, l: 50 },
    { h: 219, s: 100, l: 57 },
    { h: 272, s: 100, l: 58 },
    { h: 315, s: 100, l: 59 }
  ]
};

const MODE_COLORWAYS = {
  'chromatic-wave': ['chromatic', 'inferno', 'rose-gold', 'prism', 'aurora'],
  'ultraviolet-current': ['ultraviolet', 'oceanic', 'toxic', 'aurora', 'rose-gold'],
  'amoled-lava': ['ultraviolet', 'inferno', 'toxic', 'oceanic', 'aurora', 'rose-gold', 'prism']
};

const PROCEDURAL_SCHEMES = [
  { name: 'analogous', anchors: [-62, -34, -8, 18, 44, 70] },
  { name: 'split-complementary', anchors: [0, 28, 142, 178, 216, 332, 360] },
  { name: 'triadic', anchors: [0, 34, 112, 148, 232, 272, 360] },
  { name: 'tetradic', anchors: [0, 26, 88, 120, 178, 212, 270, 306, 360] },
  { name: 'wide-spectrum', anchors: [0, 48, 104, 164, 222, 278, 326, 360] }
];

const PSYCHEDELIC_HUE_NODES = [
  [0.06, 0.44, 0.78],
  [0.14, 0.57, 0.91],
  [0.05, 0.34, 0.68, 0.87]
];
const PSYCHEDELIC_REPEAT = [0, 1, 0, 2, 1, 0, 2, 0, 1, 2, 0, 1, 3, 0];

const proceduralPalette = (seed, modeName) => {
  const random = new SeededRandom(seed ^ 0xc2b2ae35);
  const scheme = PROCEDURAL_SCHEMES[
    Math.floor(random.range(0, PROCEDURAL_SCHEMES.length))
  ];
  const baseHue = random.range(0, 360);
  const countRange = modeName === 'chromatic-wave'
    ? [10, 14]
    : modeName === 'ultraviolet-current'
      ? [8, 11]
      : [7, 11];
  const count = Math.floor(random.range(...countRange));
  const lightPhase = random.range(0, TAU);
  const hueNodes = PSYCHEDELIC_HUE_NODES[
    Math.floor(random.range(0, PSYCHEDELIC_HUE_NODES.length))
  ];
  const nodeShift = Math.floor(random.range(0, hueNodes.length));
  const nodeDrift = random.range(-0.055, 0.055);
  const palette = [];

  for (let index = 0; index < count; index++) {
    const repeatedNode = PSYCHEDELIC_REPEAT[index % PSYCHEDELIC_REPEAT.length]
      % hueNodes.length;
    const nodeIndex = (repeatedNode + nodeShift) % hueNodes.length;
    const position = clamp(
      hueNodes[nodeIndex] + nodeDrift + random.range(-0.022, 0.022),
      0,
      1
    );
    const anchorPosition = position * (scheme.anchors.length - 1);
    const anchorIndex = Math.min(
      scheme.anchors.length - 2,
      Math.floor(anchorPosition)
    );
    const anchorMix = anchorPosition - anchorIndex;
    const hueOffset = lerp(
      scheme.anchors[anchorIndex],
      scheme.anchors[anchorIndex + 1],
      anchorMix
    );
    const echoIndex = index >= 4 && index % 4 === 0 ? index - 3 : -1;
    const echoHue = echoIndex >= 0 ? palette[echoIndex].h - baseHue : null;
    const hueJitter = random.range(-10, 10);
    const hue = (baseHue + hueOffset + hueJitter + 720) % 360;
    const orderedHue = echoHue === null
      ? hue
      : (baseHue + echoHue + random.range(-7, 7) + 720) % 360;
    const lightWave = 0.5
      + 0.5 * Math.sin(position * TAU * 1.5 + lightPhase + index * 1.17);
    const lightness = modeName === 'ultraviolet-current'
      ? 25 + lightWave * 34 + random.range(-3, 3)
      : modeName === 'chromatic-wave'
        ? 45 + lightWave * 27 + random.range(-3, 3)
        : 38 + lightWave * 28 + random.range(-3, 3);

    palette.push({
      h: Math.round(orderedHue * 10) / 10,
      s: Math.round(clamp(random.range(88, 101), 88, 100)),
      l: Math.round(clamp(lightness, 20, 76))
    });
  }

  return {
    name: `generated-${scheme.name}-${Math.round(baseHue)}`,
    palette
  };
};

const LAVA_DIRECTIONS = {
  drift: {
    name: 'drift',
    accent: 'shear-ribbons',
    stirAmount: 0.30,
    maskStart: 0.39,
    maskEnd: 0.60,
    contourScale: 1,
    microScale: 1,
    filamentFactor: 1
  },
  rise: {
    name: 'rise',
    accent: 'bubble-columns',
    stirAmount: 0.22,
    maskStart: 0.34,
    maskEnd: 0.56,
    contourScale: 0.78,
    microScale: 0.84,
    filamentFactor: 0.82
  },
  islands: {
    name: 'islands',
    accent: 'topographic-shores',
    stirAmount: 0.38,
    maskStart: 0.43,
    maskEnd: 0.64,
    contourScale: 1.28,
    microScale: 1.36,
    filamentFactor: 1.18
  }
};

const LAVA_VARIANT_DIRECTIONS = {
  'amoled-lava-drift': 'drift',
  'amoled-lava-rise': 'rise',
  'amoled-lava-islands': 'islands'
};

const TRANCE_PROFILES = {
  'spiral-iris': {
    name: 'spiral-iris',
    aliases: ['spiral', 'iris', 'trance-spiral', 'plasmo-spiral'],
    symmetry: 7,
    twist: 3.8,
    ringFrequency: 6.4,
    ringStrength: 0.145,
    radialWarp: 0.044,
    accent: 'spiral-arms'
  },
  'kaleido-lotus': {
    name: 'kaleido-lotus',
    aliases: ['lotus', 'kaleidoscope', 'trance-lotus', 'plasmo-lotus'],
    symmetry: 10,
    twist: 0.72,
    ringFrequency: 9.2,
    ringStrength: 0.115,
    radialWarp: 0.032,
    accent: 'lotus-petals'
  },
  'orbital-tunnel': {
    name: 'orbital-tunnel',
    aliases: ['portal', 'tunnel', 'trance-portal', 'plasmo-portal'],
    symmetry: 6,
    twist: -2.25,
    ringFrequency: 12.6,
    ringStrength: 0.17,
    radialWarp: 0.058,
    accent: 'orbital-rings'
  }
};

const TRANCE_PROFILE_LOOKUP = new Map();
for (const profile of Object.values(TRANCE_PROFILES)) {
  TRANCE_PROFILE_LOOKUP.set(profile.name, profile);
  for (const alias of profile.aliases) {
    TRANCE_PROFILE_LOOKUP.set(alias, profile);
  }
}

const MODE_LOOKUP = new Map();
for (const mode of Object.values(MODES)) {
  MODE_LOOKUP.set(mode.name, mode);
  for (const alias of mode.aliases) {
    MODE_LOOKUP.set(alias, mode);
  }
}

const hslToRgb = ({ h, s, l }) => {
  const hue = fract(h / 360);
  const saturation = s / 100;
  const lightness = l / 100;
  if (saturation === 0) {
    const grey = Math.round(lightness * 255);
    return { r: grey, g: grey, b: grey };
  }

  const q = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const channel = (offset) => {
    let position = hue + offset;
    if (position < 0) position += 1;
    if (position > 1) position -= 1;
    if (position < 1 / 6) return p + (q - p) * 6 * position;
    if (position < 1 / 2) return q;
    if (position < 2 / 3) return p + (q - p) * (2 / 3 - position) * 6;
    return p;
  };

  return {
    r: Math.round(channel(1 / 3) * 255),
    g: Math.round(channel(0) * 255),
    b: Math.round(channel(-1 / 3) * 255)
  };
};

const rotateHue = (r, g, b, angle) => {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  return {
    r: (0.213 + cosA * 0.787 - sinA * 0.213) * r
      + (0.715 - cosA * 0.715 - sinA * 0.715) * g
      + (0.072 - cosA * 0.072 + sinA * 0.928) * b,
    g: (0.213 - cosA * 0.213 + sinA * 0.143) * r
      + (0.715 + cosA * 0.285 + sinA * 0.140) * g
      + (0.072 - cosA * 0.072 - sinA * 0.283) * b,
    b: (0.213 - cosA * 0.213 - sinA * 0.787) * r
      + (0.715 - cosA * 0.715 + sinA * 0.715) * g
      + (0.072 + cosA * 0.928 + sinA * 0.072) * b
  };
};

/**
 * Plasmo renders three related forms of fluid paint:
 * - chromatic-wave: an irregular impasto mass suspended over AMOLED black.
 * - ultraviolet-current: a dark, full-frame field of nested turbulent eddies.
 * - amoled-lava: gently stirred, merging lava-lamp blobs in black space.
 *
 * Both are built from the same advected scalar field and flow-following pigment
 * filaments. There are no geometric cells or pre-authored ribbon lanes.
 */
export class PlasmoStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.seed = 1;
    this.mode = MODES['amoled-lava'];
    this.noise = null;
    this.vortices = [];
    this.distortionTwirls = [];
    this.radialTwists = [];
    this.radialTwistsOpposed = false;
    this.contourWarps = [];
    this.contourDrift = null;
    this.contourLayers = [];
    this.blobs = [];
    this.blobHoles = [];
    this.filaments = [];
    this.palette = [];
    this.colorway = 'ultraviolet';
    this.lavaDirection = LAVA_DIRECTIONS.drift;
    this.paletteRgb = [];
    this.paletteBandOffset = 0;
    this.gradientStopRgb = new Map();
    this.gradientCrossDirection = { x: 0, y: 1 };
    this.gradientCrossPhase = 0;
    this.tranceProfile = TRANCE_PROFILES['spiral-iris'];
    this.tranceCenter = { x: 0.5, y: 0.5 };
    this.tranceAccentsEnabled = false;
    this._macroHueOffsetA = 0;
    this._macroHueOffsetB = 0;
    this._macroHueAmplitude = 0;
    this._smudgeOffsetA = 0;
    this._smudgeOffsetB = 0;
    this._bubbleCellSize = 0.026;
    this._bubbleOccupancy = 0.5;
    this._bubbleStrength = 0.38;
    this._bubbleRimStrength = 0.13;
    this._bubbleSeedSalt = 0;
    this._bubbleDeformProbability = 0.3;
    this._bubbleMacroScale = 4.6;
    this._bubbleMacroOccupancy = 0.22;
    this._bubbleMacroStrength = 0.78;
    this._bubbleMacroRimStrength = 0.17;
    this._bubbleMacroSeedSalt = 0;
    this._bubbleTrailFreqAlong = 1.4;
    this._bubbleTrailFreqAcross = 3.8;
    this._bubbleTrailOffsetA = 0;
    this._bubbleTrailOffsetB = 0;
    this._bubbleFlowDirX = 1;
    this._bubbleFlowDirY = 0;
    this._bubbleScratch = { dx: 0, dy: 0, rim: 0 };
    this._boundaryBubbleSalt = 0;
  }

  async init(data) {
    await super.init(data);
    const configuredSeed = Number(this.config.seed);
    this.seed = Number.isFinite(configuredSeed)
      ? configuredSeed >>> 0
      : createAutomaticSeed();

    const requestedMode = String(this.config.mode || this.config.variant || '').toLowerCase();
    if (requestedMode === 'auto') {
      const automaticModes = [
        MODES['amoled-lava'],
        MODES['chromatic-wave'],
        MODES['ultraviolet-current']
      ];
      this.mode = automaticModes[this.seed % automaticModes.length];
    } else {
      this.mode = MODE_LOOKUP.get(requestedMode) || MODES['amoled-lava'];
    }

    this.noise = new SmoothNoise(this.seed);
    if (this.mode.name === 'amoled-lava') {
      const directionNames = Object.keys(LAVA_DIRECTIONS);
      const requestedDirection = String(this.config.direction || '').toLowerCase();
      const explicitDirection = LAVA_VARIANT_DIRECTIONS[requestedMode]
        || (LAVA_DIRECTIONS[requestedDirection] ? requestedDirection : null);
      const automaticDirection = directionNames[(this.seed >>> 1) % directionNames.length];
      this.lavaDirection = LAVA_DIRECTIONS[explicitDirection || automaticDirection];
    }

    const profileNames = Object.keys(TRANCE_PROFILES);
    const requestedTrance = String(
      this.config.trance || this.config.mandala || requestedMode
    ).toLowerCase();
    this.tranceAccentsEnabled = Boolean(this.config.trance || this.config.mandala);
    const explicitProfile = TRANCE_PROFILE_LOOKUP.get(requestedTrance);
    const automaticProfile = this.mode.name === 'chromatic-wave'
      ? TRANCE_PROFILES['kaleido-lotus']
      : this.mode.name === 'ultraviolet-current'
        ? TRANCE_PROFILES['orbital-tunnel']
        : TRANCE_PROFILES[profileNames[(this.seed >>> 3) % profileNames.length]];
    this.tranceProfile = explicitProfile || automaticProfile;
    const compositionRandom = new SeededRandom(this.seed ^ 0x51ed270b);
    this.tranceCenter = {
      x: compositionRandom.range(0.39, 0.61),
      y: compositionRandom.range(0.43, 0.57)
    };

    const availableColorways = MODE_COLORWAYS[this.mode.name];
    const requestedColorway = String(this.config.colorway || this.config.colors || '').toLowerCase();
    if (availableColorways.includes(requestedColorway)) {
      this.colorway = requestedColorway;
      this.palette = COLORWAYS[this.colorway];
    } else {
      const generated = proceduralPalette(this.seed, this.mode.name);
      this.colorway = generated.name;
      this.palette = generated.palette;
    }
    this.paletteRgb = this.palette.map(hslToRgb);
    this.paletteBandOffset = (this.seed >>> 16) % this.paletteRgb.length;
    this.gradientStopRgb.clear();

    const bubbleRandom = new SeededRandom(this.seed ^ 0x2545f491);
    this._bubbleCellSize = bubbleRandom.range(0.020, 0.032);
    this._bubbleOccupancy = bubbleRandom.range(0.40, 0.58);
    this._bubbleStrength = bubbleRandom.range(0.34, 0.50);
    this._bubbleRimStrength = bubbleRandom.range(0.10, 0.17);
    this._bubbleSeedSalt = (this.seed ^ 0x94d049bb) >>> 0;
    this._bubbleDeformProbability = bubbleRandom.range(0.22, 0.38);

    // Sparser, larger "trail" bubbles layered on top of the fine fizz above:
    // their placement is gated by a flow-aligned noise field (streaks run
    // along the mode's base flow, narrow across it) so they cluster into
    // percolating trails instead of scattering uniformly, and most of them
    // are stretched ellipses rather than circles.
    this._bubbleMacroScale = bubbleRandom.range(3.6, 6.4);
    this._bubbleMacroOccupancy = bubbleRandom.range(0.16, 0.30);
    this._bubbleMacroStrength = bubbleRandom.range(0.64, 0.98);
    this._bubbleMacroRimStrength = bubbleRandom.range(0.14, 0.22);
    this._bubbleMacroSeedSalt = (this.seed ^ 0x3b6a27d1) >>> 0;
    this._bubbleTrailFreqAlong = bubbleRandom.range(1.1, 1.8);
    this._bubbleTrailFreqAcross = bubbleRandom.range(3.0, 4.8);
    this._bubbleTrailOffsetA = bubbleRandom.range(0, 1000);
    this._bubbleTrailOffsetB = bubbleRandom.range(0, 1000);
    this._boundaryBubbleSalt = (this.seed ^ 0x6d2b79f5) >>> 0;

    const random = new SeededRandom(this.seed);
    this._generateVortices(random);
    this._generateBlobs(random);
    this._generateBlobHoles(new SeededRandom(this.seed ^ 0xa54ff53a));
    this._generateRadialTwists(new SeededRandom(this.seed ^ 0x3c6ef372));
    if (this.tranceAccentsEnabled) {
      this._generateTranceAnchors(new SeededRandom(this.seed ^ 0x7f4a7c15));
    }
    this._generateDistortionTwirls(new SeededRandom(this.seed ^ 0x27d4eb2d));
    this._generateContourWarps(new SeededRandom(this.seed ^ 0x9e3779b9));
    this._generateContourLayers(new SeededRandom(this.seed ^ 0x85ebca6b));
    this._generateFilaments(random);

    const hueRandom = new SeededRandom(this.seed ^ 0x16f9e2d1);
    this._macroHueOffsetA = hueRandom.range(0, 1000);
    this._macroHueOffsetB = hueRandom.range(0, 1000);
    this._macroHueAmplitude = (17 * Math.PI) / 180;
    const smudgeRandom = new SeededRandom(this.seed ^ 0x6a09e667);
    this._smudgeOffsetA = smudgeRandom.range(0, 1000);
    this._smudgeOffsetB = smudgeRandom.range(0, 1000);

    this._prepareRenderConstants();
  }

  async process() {
    // Plasmo is a frozen fluid state. Its motion is baked into the advected
    // coordinate field, keeping a seed repeatable across CLI and gallery runs.
  }

  _prepareRenderConstants() {
    const flowLength = Math.hypot(this.mode.baseFlow.x, this.mode.baseFlow.y) || 1;
    this.gradientCrossDirection.x = -this.mode.baseFlow.y / flowLength;
    this.gradientCrossDirection.y = this.mode.baseFlow.x / flowLength;
    this.gradientCrossPhase = (this.seed % 4093) * 0.0031;
    this._bubbleFlowDirX = this.mode.baseFlow.x / flowLength;
    this._bubbleFlowDirY = this.mode.baseFlow.y / flowLength;

    for (const vortex of this.vortices) {
      const radiusSquared = vortex.radius * vortex.radius;
      Object.defineProperties(vortex, {
        _warpRadius: {
          value: Math.max(0.0001, radiusSquared * 1.75),
          configurable: true
        },
        _flowRadius: {
          value: Math.max(0.0001, radiusSquared * 2.2),
          configurable: true
        }
      });
    }

    for (const warp of this.contourWarps) {
      Object.defineProperties(warp, {
        _axisCosine: { value: Math.cos(warp.rotation), configurable: true },
        _axisSine: { value: Math.sin(warp.rotation), configurable: true },
        _radiusSquared: {
          value: Math.max(0.0001, warp.radius * warp.radius),
          configurable: true
        }
      });
    }

    for (const twirl of this.distortionTwirls) {
      Object.defineProperties(twirl, {
        _radiusSquared: {
          value: twirl.radius * twirl.radius,
          configurable: true
        },
        _rateFrequency: {
          value: TAU * twirl.rateCycles,
          configurable: true
        }
      });
    }

    for (const twist of this.radialTwists) {
      Object.defineProperty(twist, '_radiusSquared', {
        value: twist.radius * twist.radius,
        configurable: true
      });
    }

    for (const blob of this.blobs) {
      Object.defineProperties(blob, {
        _cosine: { value: Math.cos(blob.rotation), configurable: true },
        _sine: { value: Math.sin(blob.rotation), configurable: true }
      });
    }

    Object.defineProperties(this.contourDrift, {
      _directionX: {
        value: Math.cos(this.contourDrift.angle),
        configurable: true
      },
      _directionY: {
        value: Math.sin(this.contourDrift.angle),
        configurable: true
      }
    });

    for (const layer of this.contourLayers) {
      Object.defineProperties(layer, {
        _directionX: { value: Math.cos(layer.angle), configurable: true },
        _directionY: { value: Math.sin(layer.angle), configurable: true }
      });
    }
  }

  _generateVortices(random) {
    const aspect = this.height / Math.max(1, this.width);
    this.vortices = [];

    if (this.mode.name === 'chromatic-wave') {
      this.vortices.push(
        { x: 0.59, y: aspect * 0.49, radius: 0.40, strength: 2.45 },
        { x: 0.22, y: aspect * 0.67, radius: 0.31, strength: -2.05 },
        { x: 0.82, y: aspect * 0.76, radius: 0.34, strength: 1.75 }
      );
    } else if (this.mode.name === 'ultraviolet-current') {
      this.vortices.push(
        { x: 0.25, y: aspect * 0.32, radius: 0.24, strength: 1.65 },
        { x: 0.69, y: aspect * 0.58, radius: 0.28, strength: -1.75 },
        { x: 0.44, y: aspect * 0.78, radius: 0.21, strength: 1.45 }
      );
    } else {
      this.vortices.push(
        { x: 0.34, y: aspect * 0.40, radius: 0.29, strength: 0.58 },
        { x: 0.72, y: aspect * 0.67, radius: 0.32, strength: -0.52 }
      );
    }

    while (this.vortices.length < this.mode.vortexCount) {
      const sign = random.next() > 0.5 ? 1 : -1;
      this.vortices.push({
        x: random.range(-0.05, 1.05),
        y: random.range(aspect * 0.18, aspect * 1.02),
        radius: random.range(...this.mode.randomVortexRadius),
        strength: random.range(...this.mode.randomVortexStrength) * sign
      });
    }
  }

  _generateRadialTwists(random) {
    const aspect = this.height / Math.max(1, this.width);
    const count = 2 + (this.seed & 1);
    const firstDirection = random.next() < 0.5 ? -1 : 1;
    this.radialTwistsOpposed = ((this.seed >>> 2) & 1) === 1;
    this.radialTwists = [];

    for (let index = 0; index < count; index++) {
      let x = random.range(0.14, 0.86);
      let y = random.range(aspect * 0.12, aspect * 0.88);
      for (let attempt = 0; attempt < 8; attempt++) {
        const separated = this.radialTwists.every(twist => (
          Math.hypot(x - twist.x, y - twist.y) > 0.22
        ));
        if (separated) break;
        x = random.range(0.14, 0.86);
        y = random.range(aspect * 0.12, aspect * 0.88);
      }

      const direction = this.radialTwistsOpposed && index % 2 === 1
        ? -firstDirection
        : firstDirection;
      this.radialTwists.push({
        x,
        y,
        radius: random.range(0.20, 0.38),
        strength: random.range(0.58, 1.28) * direction,
        phase: random.range(0, TAU)
      });
    }
  }

  _generateDistortionTwirls(random) {
    const aspect = this.height / Math.max(1, this.width);
    const count = 6 + (this.seed % 7);
    this.distortionTwirls = [];

    for (let index = 0; index < count; index++) {
      const radius = random.range(0.055, 0.31);
      const anchorToLava = this.mode.name === 'amoled-lava'
        && this.blobs.length > 0
        && index < Math.ceil(count * 0.66);
      const anchor = anchorToLava
        ? this.blobs[Math.floor(random.range(0, this.blobs.length))]
        : null;
      const contourPoint = anchor
        ? this._findLavaContourPoint(anchor, random.range(0, TAU), aspect)
        : null;
      const effectiveRadius = contourPoint
        ? Math.min(0.35, radius * 1.10)
        : radius;
      this.distortionTwirls.push({
        x: contourPoint
          ? contourPoint.x
          : random.range(-0.06, 1.06),
        y: contourPoint
          ? contourPoint.y
          : random.range(-0.03, aspect * 1.03),
        radius: effectiveRadius,
        angle: random.range(-TAU, TAU),
        ratePhase: random.range(0, TAU),
        rateCycles: random.range(0.38, 1.65),
        rateFloor: random.range(0.12, 0.34),
        anchored: Boolean(contourPoint),
        contourInfluence: contourPoint?.influence ?? null
      });
    }
  }

  _findLavaContourPoint(blob, angle, aspect) {
    const threshold = (this.lavaDirection.maskStart + this.lavaDirection.maskEnd) * 0.5;
    const cosine = Math.cos(blob.rotation);
    const sine = Math.sin(blob.rotation);
    const localX = Math.cos(angle);
    const localY = Math.sin(angle) * blob.stretch;
    const worldX = localX * cosine - localY * sine;
    const worldY = localX * sine + localY * cosine;
    const magnitude = Math.hypot(worldX, worldY) || 1;
    const directionX = worldX / magnitude;
    const directionY = worldY / magnitude;
    const maximumDistance = Math.hypot(1, aspect) * 1.1;
    const steps = 72;
    let previous = {
      x: blob.x,
      y: blob.y,
      influence: this._blobInfluence(blob.x, blob.y / aspect, aspect)
    };

    for (let step = 1; step <= steps; step++) {
      const distance = maximumDistance * step / steps;
      const point = {
        x: blob.x + directionX * distance,
        y: blob.y + directionY * distance
      };
      point.influence = this._blobInfluence(point.x, point.y / aspect, aspect);
      if (previous.influence >= threshold && point.influence < threshold) {
        let inside = previous;
        let outside = point;
        for (let refinement = 0; refinement < 9; refinement++) {
          const midpoint = {
            x: (inside.x + outside.x) * 0.5,
            y: (inside.y + outside.y) * 0.5
          };
          midpoint.influence = this._blobInfluence(
            midpoint.x,
            midpoint.y / aspect,
            aspect
          );
          if (midpoint.influence >= threshold) inside = midpoint;
          else outside = midpoint;
        }
        return Math.abs(inside.influence - threshold)
          < Math.abs(outside.influence - threshold)
          ? inside
          : outside;
      }
      previous = point;
    }

    return previous;
  }

  _generateContourWarps(random) {
    const aspect = this.height / Math.max(1, this.width);
    const count = 5 + (this.seed % 4);
    this.contourWarps = [];

    for (let index = 0; index < count; index++) {
      const pinch = random.next() < 0.46;
      this.contourWarps.push({
        x: random.range(-0.08, 1.08),
        y: random.range(-0.04, aspect * 1.04),
        radius: random.range(0.13, 0.38),
        stretch: random.range(0.62, 1.65),
        rotation: random.range(-Math.PI, Math.PI),
        arcPhase: random.range(-Math.PI, Math.PI),
        radial: random.range(pinch ? -0.24 : 0.10, pinch ? -0.09 : 0.29),
        twist: random.range(-0.72, 0.72)
      });
    }

    this.contourDrift = {
      angle: random.range(-Math.PI, Math.PI),
      phase: random.range(0, TAU),
      secondaryPhase: random.range(0, TAU),
      scale: random.range(0.72, 1.18)
    };
  }

  _generateContourLayers(random) {
    const offsets = [0, -0.058, 0.060, -0.126, 0.132];
    this.contourLayers = offsets.map((offset, index) => ({
      offset,
      widthScale: random.range(0.72, 1.28),
      valueScale: random.range(0.72, 1.24),
      paletteShift: random.range(-0.075, 0.075),
      gapScale: random.range(0.76, 1.30),
      angle: random.range(-Math.PI, Math.PI),
      phase: random.range(0, TAU),
      secondaryPhase: random.range(0, TAU),
      branchDirection: random.next() < 0.5 ? -1 : 1,
      branchStrength: random.range(0.11, 0.31),
      presenceThreshold: index < 2 ? 0 : [0, 0, 0.39, 0.56, 0.70][index]
    }));
  }

  _generateBlobs(random) {
    this.blobs = [];
    if (this.mode.name !== 'amoled-lava') return;

    const aspect = this.height / Math.max(1, this.width);
    if (this.lavaDirection.name === 'rise') {
      const levels = [0.07, 0.20, 0.34, 0.49, 0.64, 0.79, 0.93];
      levels.forEach((level, index) => {
        this.blobs.push(this._makeBlob(random, {
          x: 0.50 + Math.sin(index * 1.36 + this.seed * 0.01) * 0.13,
          y: aspect * level,
          radius: random.range(0.085, 0.15),
          stretch: random.range(1.55, 2.65),
          weight: random.range(0.96, 1.13),
          rotation: random.range(-0.38, 0.38)
        }));
      });
      while (this.blobs.length < 12) {
        const side = random.next() > 0.5 ? 1 : -1;
        this.blobs.push(this._makeBlob(random, {
          x: 0.50 + side * random.range(0.20, 0.39),
          y: random.range(aspect * 0.10, aspect * 0.92),
          radius: random.range(0.035, 0.075),
          stretch: random.range(0.85, 1.55),
          weight: random.range(0.72, 0.94)
        }));
      }
      return;
    }

    if (this.lavaDirection.name === 'islands') {
      const routePhase = random.range(0, TAU);
      const primaryIslands = [];
      for (let index = 0; index < 4; index++) {
        const level = 0.13 + index * 0.245 + random.range(-0.025, 0.025);
        const primary = this._makeBlob(random, {
          x: 0.50 + Math.sin(routePhase + index * 1.48) * random.range(0.16, 0.29),
          y: aspect * level,
          radius: index === 1
            ? random.range(0.145, 0.19)
            : random.range(0.105, 0.16),
          stretch: random.range(1.18, 2.08),
          weight: random.range(0.98, 1.16),
          rotation: random.range(-1.08, 1.08),
          lobes: Math.floor(random.range(3, 6)),
          wobble: random.range(0.075, 0.145)
        });
        primaryIslands.push(primary);
        this.blobs.push(primary);
      }

      const blobCount = 10 + (this.seed % 3);
      while (this.blobs.length < blobCount) {
        const anchor = primaryIslands[Math.floor(random.range(0, primaryIslands.length))];
        const angle = random.range(0, TAU);
        const distance = anchor.radius * random.range(1.55, 2.85);
        this.blobs.push(this._makeBlob(random, {
          x: clamp(anchor.x + Math.cos(angle) * distance, 0.04, 0.96),
          y: clamp(anchor.y + Math.sin(angle) * distance, aspect * 0.035, aspect * 0.965),
          radius: random.range(0.035, 0.075),
          stretch: random.range(0.82, 1.55),
          weight: random.range(0.68, 0.88),
          wobble: random.range(0.055, 0.13)
        }));
      }
      return;
    }

    this.blobs.push(
      this._makeBlob(random, {
        x: 0.28, y: aspect * 0.23, radius: 0.145, stretch: 1.70,
        weight: 1.03, rotation: -0.31, phase: 0.7, lobes: 3, wobble: 0.13
      }),
      this._makeBlob(random, {
        x: 0.68, y: aspect * 0.39, radius: 0.19, stretch: 1.18,
        weight: 1.10, rotation: 0.48, phase: 2.1, lobes: 4, wobble: 0.10
      }),
      this._makeBlob(random, {
        x: 0.34, y: aspect * 0.63, radius: 0.21, stretch: 1.42,
        weight: 1.12, rotation: -0.62, phase: 4.3, lobes: 2, wobble: 0.15
      }),
      this._makeBlob(random, {
        x: 0.73, y: aspect * 0.82, radius: 0.17, stretch: 1.78,
        weight: 1.04, rotation: 0.24, phase: 5.4, lobes: 5, wobble: 0.09
      })
    );

    const blobCount = 10 + (this.seed % 5);
    while (this.blobs.length < blobCount) {
      this.blobs.push(this._makeBlob(random, {
        x: random.range(0.04, 0.96),
        y: random.range(aspect * 0.04, aspect * 0.98),
        radius: random.range(0.055, 0.145),
        stretch: random.range(0.82, 2.15),
        weight: random.range(0.78, 1.12)
      }));
    }
  }

  _generateTranceAnchors(random) {
    if (this.mode.name !== 'amoled-lava') return;

    const aspect = this.height / Math.max(1, this.width);
    const centerX = this.tranceCenter.x;
    const centerY = aspect * this.tranceCenter.y;
    const profile = this.tranceProfile;
    const sector = TAU / profile.symmetry;
    const radii = profile.name === 'orbital-tunnel'
      ? [0, 0.105, 0.205, 0.315, 0.425]
      : profile.name === 'kaleido-lotus'
        ? [0, 0.14, 0.27, 0.405]
        : [0, 0.115, 0.225, 0.335, 0.445];
    const anchors = radii.map((radius, index) => {
      const progress = index / Math.max(1, radii.length - 1);
      const angle = profile.name === 'spiral-iris'
        ? sector * 0.08 + progress * 2.18 + random.range(-0.22, 0.22)
        : sector * 0.18 + index * 2.07 + random.range(-0.28, 0.28);
      const baseRadius = index === 0
        ? 0.095
        : profile.name === 'kaleido-lotus'
          ? lerp(0.092, 0.060, progress)
          : lerp(0.085, 0.052, progress);

      return this._makeBlob(random, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        radius: baseRadius,
        stretch: index === 0
          ? 1
          : profile.name === 'kaleido-lotus'
            ? random.range(1.55, 2.05)
            : random.range(1.05, 1.58),
        weight: index === 0 ? 1.16 : random.range(0.90, 1.08),
        rotation: index === 0 ? 0 : angle + Math.PI * 0.5,
        lobes: index === 0 ? 3 + (this.seed % 3) : 3 + (index % 3),
        wobble: index === 0 ? 0.105 : random.range(0.055, 0.105),
        phase: index * 1.37 + this.seed * 0.003
      });
    });

    this.blobs.unshift(...anchors);
  }

  _generateBlobHoles(random) {
    this.blobHoles = [];
    if (this.mode.name !== 'amoled-lava') return;

    const largeBlobs = this.blobs.filter(blob => blob.radius >= 0.12);
    for (let blobIndex = 0; blobIndex < largeBlobs.length; blobIndex++) {
      const blob = largeBlobs[blobIndex];
      const holeCount = 1 + (random.next() < 0.34 ? 1 : 0);
      for (let holeIndex = 0; holeIndex < holeCount; holeIndex++) {
        const angle = random.range(0, TAU);
        const distance = blob.radius * random.range(0.20, 0.56);
        const localX = Math.cos(angle) * distance;
        const localY = Math.sin(angle) * distance * blob.stretch;
        const cosine = Math.cos(blob.rotation);
        const sine = Math.sin(blob.rotation);
        this.blobHoles.push({
          x: blob.x + localX * cosine - localY * sine,
          y: blob.y + localX * sine + localY * cosine,
          radius: blob.radius * random.range(0.075, 0.16),
          strength: random.range(0.82, 1.28),
          flow: random.range(0.16, 0.28),
          blobIndex,
          phase: random.range(0, TAU)
        });
      }
    }
  }

  _makeBlob(random, overrides = {}) {
    const blob = {
      x: random.range(0.04, 0.96),
      y: random.range(0.04, 0.96),
      radius: random.range(0.055, 0.145),
      stretch: random.range(0.82, 2.15),
      weight: random.range(0.78, 1.12),
      rotation: random.range(-Math.PI, Math.PI),
      phase: random.range(0, TAU),
      lobes: Math.floor(random.range(2, 6)),
      wobble: random.range(0.045, 0.17),
      saturation: random.range(0.93, 1.08),
      saturationPhase: random.range(0, TAU),
      ...overrides
    };
    const directionWave = Math.sin(blob.phase * 1.93 + blob.saturationPhase);
    blob.lightAngle = fract(
      (blob.phase * 1.31 + blob.saturationPhase * 0.73) / TAU
    ) * TAU;
    blob.gradientTwist = (directionWave >= 0 ? 1 : -1)
      * (3.8 + Math.abs(directionWave) * 1.9);
    blob.shadowStrength = 0.31
      + (0.5 + 0.5 * Math.sin(blob.phase * 2.17)) * 0.26;
    blob.highlightStrength = 0.22
      + (0.5 + 0.5 * Math.cos(blob.saturationPhase * 1.43)) * 0.22;
    return blob;
  }

  _blobInfluence(u, v, aspect, warped = null, pigment = null) {
    const stirAmount = this.lavaDirection.stirAmount;
    const x = warped
      ? (warped.massX ?? lerp(u, warped.x, stirAmount))
      : u;
    const y = warped
      ? (warped.massY ?? lerp(v * aspect, warped.y, stirAmount))
      : v * aspect;
    let influence = 0;
    let saturationTotal = 0;
    let saturationWeight = 0;
    let formTotal = 0;
    let holeFlow = 0;
    let shadowTotal = 0;
    let highlightTotal = 0;
    let gapTwistTotal = 0;

    for (const blob of this.blobs) {
      const offsetX = x - blob.x;
      const offsetY = y - blob.y;
      const cosine = blob._cosine ?? Math.cos(blob.rotation);
      const sine = blob._sine ?? Math.sin(blob.rotation);
      const localX = offsetX * cosine + offsetY * sine;
      const localY = -offsetX * sine + offsetY * cosine;
      const angle = Math.atan2(localY / blob.stretch, localX);
      const organicRadius = 1
        + Math.sin(angle * blob.lobes + blob.phase) * blob.wobble
        + Math.sin(angle * (blob.lobes + 2) - blob.phase * 0.63) * blob.wobble * 0.42;
      const dx = localX / (blob.radius * organicRadius);
      const dy = localY / (blob.radius * blob.stretch * organicRadius);
      const distanceSquared = dx * dx + dy * dy;
      const normalizedDistance = Math.sqrt(distanceSquared);
      const contribution = Math.exp(-distanceSquared * 1.35) * blob.weight;
      influence += contribution;
      const gradientOffset = Math.sin(blob.phase * 1.71 + blob.saturationPhase) * 0.10;
      const gradientTwist = Math.sin(
        angle * 2
        + normalizedDistance * blob.gradientTwist
        + blob.phase
      ) * 0.075 + Math.sin(
        angle * 3
        - normalizedDistance * blob.gradientTwist * 0.63
        + blob.saturationPhase
      ) * 0.032;
      formTotal += (
        normalizedDistance + gradientOffset + gradientTwist
      ) * contribution;
      const localSaturation = blob.saturation
        + Math.sin(angle * 2 + blob.saturationPhase) * 0.018;
      saturationTotal += localSaturation * contribution;
      const lightDirectionX = Math.cos(blob.lightAngle);
      const lightDirectionY = Math.sin(blob.lightAngle);
      const directionalPosition = clamp(
        dx * lightDirectionX + dy * lightDirectionY,
        -1,
        1
      );
      const softLight = smoothstep(-0.48, 0.58, directionalPosition);
      shadowTotal += (1 - softLight) * blob.shadowStrength * contribution;
      highlightTotal += softLight * blob.highlightStrength * contribution;
      gapTwistTotal += (
        0.5 + 0.5 * Math.sin(
          angle * 2
          + normalizedDistance * blob.gradientTwist * 1.18
          + blob.saturationPhase
        )
      ) * contribution;
      saturationWeight += contribution;
    }

    for (const hole of this.blobHoles) {
      const offsetX = x - hole.x;
      const offsetY = y - hole.y;
      const distanceSquared = (
        offsetX * offsetX + offsetY * offsetY
      ) / Math.max(0.000001, hole.radius * hole.radius);
      if (distanceSquared > 12) continue;
      const distance = Math.sqrt(distanceSquared);
      influence -= Math.exp(-distanceSquared * 1.75) * hole.strength;
      holeFlow += Math.exp(-distanceSquared * 0.46)
        * distance
        * hole.flow
        * (0.88 + Math.sin(distance * 2.4 + hole.phase) * 0.12);
    }
    if (pigment) {
      pigment.saturation = saturationWeight > 0.0001
        ? clamp(saturationTotal / saturationWeight, 0.90, 1.10)
        : 1;
      pigment.form = saturationWeight > 0.0001
        ? clamp(formTotal / saturationWeight, 0, 1.6)
        : 1.6;
      pigment.holeFlow = holeFlow;
      pigment.shadow = saturationWeight > 0.0001
        ? shadowTotal / saturationWeight
        : 0;
      pigment.highlight = saturationWeight > 0.0001
        ? highlightTotal / saturationWeight
        : 0;
      pigment.gapTwist = saturationWeight > 0.0001
        ? gapTwistTotal / saturationWeight
        : 0.5;
    }
    return influence;
  }

  _insideLavaMass(x, y) {
    const aspect = this.height / Math.max(1, this.width);
    const domain = this._mapTranceDomain(x, y, aspect);
    const warped = this._warpPoint(domain.u, domain.v, aspect);
    return this._lavaMask(domain.u, domain.v, warped, aspect) > 0.5;
  }

  _generateFilaments(random) {
    const area = this.width * this.height;
    const aspect = this.height / Math.max(1, this.width);
    const domain = {};
    const filamentFactor = this.mode.name === 'amoled-lava'
      ? this.lavaDirection.filamentFactor
      : 1;
    const desiredCount = Math.round(area * this.mode.filamentDensity * filamentFactor);
    const count = clamp(desiredCount, this.mode.filamentRange[0], this.mode.filamentRange[1]);
    this.filaments = [];

    for (let index = 0; index < count; index++) {
      let x = random.range(-0.03, 1.03);
      let y = random.range(0.03, 1.02);
      const isMaskedMode = this.mode.name === 'chromatic-wave' || this.mode.name === 'amoled-lava';
      if (isMaskedMode) {
        for (let attempt = 0; attempt < 8; attempt++) {
          const insideMass = this.mode.name === 'chromatic-wave'
            ? this._insideChromaticMass(
                this._mapTranceDomain(x, y, aspect, domain).u,
                domain.v
              )
            : this._insideLavaMass(x, y);
          if (insideMass) break;
          x = random.range(-0.03, 1.03);
          y = random.range(this.mode.name === 'chromatic-wave' ? 0.22 : 0.02, 1.02);
        }
      }

      const thickStroke = this.mode.name !== 'ultraviolet-current' && random.next() < 0.055;
      this.filaments.push({
        x,
        y,
        phase: random.next(),
        alpha: random.range(...this.mode.filamentAlpha) * (thickStroke ? 0.72 : 1),
        width: random.range(...this.mode.filamentWidth) * (thickStroke ? random.range(1.8, 3.6) : 1),
        steps: Math.round(random.range(...this.mode.filamentSteps)),
        step: random.range(...this.mode.filamentStep),
        direction: random.next() > 0.48 ? 1 : -1,
        wobble: random.range(0, TAU),
        bend: random.range(-0.24, 0.24),
        widthPulse: random.range(0.72, 1.32),
        toneShift: random.range(-9, 14)
      });
    }
  }

  _insideChromaticMass(x, y) {
    const boundary = 0.285 + Math.sin(x * TAU * 0.82 + 0.7) * 0.042;
    const bottomMass = y > boundary;
    const lobeX = (x - 0.54) / 0.70;
    const lobeY = (y - 0.42) / 0.215;
    const upperLobe = lobeX * lobeX + lobeY * lobeY < 1;
    const cavityX = (x - 0.10) / 0.27;
    const cavityY = (y - 0.57) / 0.115;
    const cavity = cavityX * cavityX + cavityY * cavityY < 1;
    return (bottomMass || upperLobe) && !cavity;
  }

  /**
   * One lens-shaped dimple's contribution to the running (dx, dy, rim)
   * accumulators. `angle`/`deformAmount` let a bubble's footprint be an
   * ellipse (stretched along `angle` by `deformAmount`) instead of a circle,
   * which is what makes a subset of bubbles read as deformed rather than
   * perfectly round; the outward push itself stays along the straight line
   * from the bubble's own center, which is simple and still looks right on
   * an ellipse.
   */
  _accumulateBubbleLens(x, y, centerX, centerY, radius, strength, rimStrength, angle, deformAmount, accum) {
    const offsetX = x - centerX;
    const offsetY = y - centerY;
    let localX = offsetX;
    let localY = offsetY;
    if (angle !== null) {
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      localX = offsetX * cosine + offsetY * sine;
      localY = (-offsetX * sine + offsetY * cosine) / deformAmount;
    }
    const radiusSquared = radius * radius;
    const distanceSquared = (localX * localX + localY * localY) / radiusSquared;
    if (distanceSquared >= 1) return;

    const normalized = Math.sqrt(distanceSquared);
    const lensShape = 4 * normalized * (1 - normalized);
    const displacement = lensShape * strength * radius;
    const worldDistance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    const inverseDistance = worldDistance > 0.00001 ? 1 / worldDistance : 0;
    accum.dx += offsetX * inverseDistance * displacement;
    accum.dy += offsetY * inverseDistance * displacement;

    const highlightRing = smoothstep(0.58, 0.82, normalized)
      * (1 - smoothstep(0.86, 0.99, normalized));
    const shadowCore = 1 - smoothstep(0, 0.42, normalized);
    accum.rim += highlightRing * rimStrength - shadowCore * rimStrength * 0.38;
  }

  /**
   * Two layered hashed grids of lens-like dimples that bend and relight the
   * pixels near them, like bubbles seen through the paint:
   *
   * - A fine, dense grid ("fizz") of small, mostly-circular dimples spread
   *   evenly everywhere, giving the surface a constant faint foam texture.
   * - A coarser, sparser grid of bigger "trail" bubbles, most of them
   *   stretched into ellipses aligned with the mode's base flow direction.
   *   Their placement is additionally gated by a flow-aligned noise field
   *   (fine-grained across the flow, broad along it), so instead of
   *   scattering uniformly they cluster into streaks that read as bubbles
   *   percolating along the current rather than sitting on a regular grid.
   *
   * Both grids tile the entire coordinate plane, but since background
   * pixels are discarded before any of this is visible, bubbles only ever
   * read as sitting inside the painted color masses.
   */
  _sampleBubbleField(x, y, result = null) {
    const accum = { dx: 0, dy: 0, rim: 0 };

    const fineCell = this._bubbleCellSize;
    const fineCellX = Math.floor(x / fineCell);
    const fineCellY = Math.floor(y / fineCell);
    for (let gy = -1; gy <= 1; gy++) {
      for (let gx = -1; gx <= 1; gx++) {
        const ix = fineCellX + gx;
        const iy = fineCellY + gy;
        const occupancy = bubbleCellHash(ix, iy, 0, this._bubbleSeedSalt);
        if (occupancy > this._bubbleOccupancy) continue;

        const jitterX = bubbleCellHash(ix, iy, 1, this._bubbleSeedSalt);
        const jitterY = bubbleCellHash(ix, iy, 2, this._bubbleSeedSalt);
        const sizeJitter = bubbleCellHash(ix, iy, 3, this._bubbleSeedSalt);
        const centerX = (ix + 0.5 + (jitterX - 0.5) * 0.7) * fineCell;
        const centerY = (iy + 0.5 + (jitterY - 0.5) * 0.7) * fineCell;
        const radius = fineCell * lerp(0.15, 0.32, sizeJitter);

        const deformRoll = bubbleCellHash(ix, iy, 4, this._bubbleSeedSalt);
        const deformed = deformRoll < this._bubbleDeformProbability;
        const angle = deformed
          ? bubbleCellHash(ix, iy, 5, this._bubbleSeedSalt) * TAU
          : null;
        const deformAmount = deformed
          ? lerp(1.25, 2.1, bubbleCellHash(ix, iy, 6, this._bubbleSeedSalt))
          : 1;

        this._accumulateBubbleLens(
          x, y, centerX, centerY, radius,
          this._bubbleStrength, this._bubbleRimStrength,
          angle, deformAmount, accum
        );
      }
    }

    const alongCoord = x * this._bubbleFlowDirX + y * this._bubbleFlowDirY;
    const acrossCoord = -x * this._bubbleFlowDirY + y * this._bubbleFlowDirX;
    const trailField = this.noise.fbm(
      alongCoord * this._bubbleTrailFreqAlong + this._bubbleTrailOffsetA,
      acrossCoord * this._bubbleTrailFreqAcross + this._bubbleTrailOffsetB,
      2
    );
    const trailDensity = smoothstep(0.40, 0.62, trailField);

    if (trailDensity > 0) {
      const macroCell = fineCell * this._bubbleMacroScale;
      const macroCellX = Math.floor(x / macroCell);
      const macroCellY = Math.floor(y / macroCell);
      const flowAngle = Math.atan2(this._bubbleFlowDirY, this._bubbleFlowDirX);

      for (let gy = -1; gy <= 1; gy++) {
        for (let gx = -1; gx <= 1; gx++) {
          const ix = macroCellX + gx;
          const iy = macroCellY + gy;
          const occupancy = bubbleCellHash(ix, iy, 0, this._bubbleMacroSeedSalt);
          if (occupancy > this._bubbleMacroOccupancy * trailDensity) continue;

          const jitterX = bubbleCellHash(ix, iy, 1, this._bubbleMacroSeedSalt);
          const jitterY = bubbleCellHash(ix, iy, 2, this._bubbleMacroSeedSalt);
          const sizeJitter = bubbleCellHash(ix, iy, 3, this._bubbleMacroSeedSalt);
          const bigRoll = bubbleCellHash(ix, iy, 4, this._bubbleMacroSeedSalt);
          const bigAmount = bigRoll < 0.22
            ? lerp(1.4, 2.2, bubbleCellHash(ix, iy, 5, this._bubbleMacroSeedSalt))
            : 1;
          const centerX = (ix + 0.5 + (jitterX - 0.5) * 0.7) * macroCell;
          const centerY = (iy + 0.5 + (jitterY - 0.5) * 0.7) * macroCell;
          const radius = macroCell * lerp(0.20, 0.46, sizeJitter) * bigAmount;

          const angleJitter = bubbleCellHash(ix, iy, 6, this._bubbleMacroSeedSalt);
          const angle = flowAngle + (angleJitter - 0.5) * 1.1;
          const deformAmount = lerp(
            1.15, 2.4, bubbleCellHash(ix, iy, 7, this._bubbleMacroSeedSalt)
          );

          this._accumulateBubbleLens(
            x, y, centerX, centerY, radius,
            this._bubbleMacroStrength, this._bubbleMacroRimStrength,
            angle, deformAmount, accum
          );
        }
      }
    }

    const output = result || {};
    output.dx = accum.dx;
    output.dy = accum.dy;
    output.rim = clamp(accum.rim, -0.6, 0.6);
    return output;
  }

  _warpPoint(u, v, aspect, result = null) {
    let x = u;
    let y = v * aspect;

    for (const vortex of this.vortices) {
      const dx = x - vortex.x;
      const dy = y - vortex.y;
      const distanceSquared = dx * dx + dy * dy;
      const warpRadius = vortex._warpRadius
        ?? Math.max(0.0001, vortex.radius * vortex.radius * 1.75);
      const influence = Math.exp(-distanceSquared / warpRadius);
      const angle = vortex.strength * influence;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      x = vortex.x + dx * cosine - dy * sine;
      y = vortex.y + dx * sine + dy * cosine;
    }

    // Broad asymmetric deformations keep the contour field from reading as
    // concentric rings. Each influence only strongly affects one side of its
    // ellipse, producing incomplete swirl arcs with local bulges and pinches.
    for (const warp of this.contourWarps) {
      const offsetX = x - warp.x;
      const offsetY = y - warp.y;
      const axisCosine = warp._axisCosine ?? Math.cos(warp.rotation);
      const axisSine = warp._axisSine ?? Math.sin(warp.rotation);
      const localX = offsetX * axisCosine + offsetY * axisSine;
      const localY = (-offsetX * axisSine + offsetY * axisCosine) / warp.stretch;
      const radiusSquared = warp._radiusSquared
        ?? Math.max(0.0001, warp.radius * warp.radius);
      const distanceSquared = (localX * localX + localY * localY)
        / radiusSquared;
      const influence = Math.exp(-distanceSquared * 1.45);
      const angle = Math.atan2(localY, localX);
      const arc = smoothstep(-0.46, 0.72, Math.cos(angle - warp.arcPhase));
      const shapedInfluence = influence * (0.24 + arc * 0.76);
      const radialScale = 1 + warp.radial * shapedInfluence;
      const turn = warp.twist * shapedInfluence;
      const turnCosine = Math.cos(turn);
      const turnSine = Math.sin(turn);
      const turnedX = (offsetX * turnCosine - offsetY * turnSine) * radialScale;
      const turnedY = (offsetX * turnSine + offsetY * turnCosine) * radialScale;
      x = warp.x + turnedX;
      y = warp.y + turnedY;
    }

    const broad = this.noise.fbm(x * 1.55 + 13.2, y * 1.55 - 7.1, 3);
    const curl = this.noise.fbm((x + broad * 0.44) * 4.2, (y - broad * 0.36) * 3.9, 2);
    x += (broad - 0.5) * this.mode.warpNoise + Math.sin(y * 2.4 + curl * 3.1) * this.mode.warpNoise * 0.28;
    y += (curl - 0.5) * this.mode.warpNoise + Math.sin(x * 2.8 - broad * 2.2) * this.mode.warpNoise * 0.22;
    let massX = this.mode.name === 'amoled-lava'
      ? lerp(u, x, this.lavaDirection.stirAmount)
      : x;
    let massY = this.mode.name === 'amoled-lava'
      ? lerp(v * aspect, y, this.lavaDirection.stirAmount)
      : y;

    const bubble = this._sampleBubbleField(x, y, this._bubbleScratch);
    x += bubble.dx;
    y += bubble.dy;
    if (this.mode.name === 'amoled-lava') {
      massX += bubble.dx;
      massY += bubble.dy;
    }

    // Local distortion fields can turn as far as one full revolution in
    // either direction. Their twist rate begins at a seeded point on a sine
    // wave, then oscillates radially before fading continuously at the edge.
    for (const twirl of this.distortionTwirls) {
      const offsetX = x - twirl.x;
      const offsetY = y - twirl.y;
      const distanceSquared = offsetX * offsetX + offsetY * offsetY;
      const radiusSquared = twirl._radiusSquared ?? twirl.radius * twirl.radius;
      if (distanceSquared >= radiusSquared) continue;

      const radialPosition = Math.sqrt(distanceSquared / radiusSquared);
      const envelope = 1 - smoothstep(0.38, 1, radialPosition);
      const sineRate = 0.5 + 0.5 * Math.sin(
        twirl.ratePhase
          + radialPosition * (twirl._rateFrequency ?? TAU * twirl.rateCycles)
      );
      const turn = twirl.angle
        * envelope
        * lerp(twirl.rateFloor, 1, sineRate);
      const turnCosine = Math.cos(turn);
      const turnSine = Math.sin(turn);
      x = twirl.x + offsetX * turnCosine - offsetY * turnSine;
      y = twirl.y + offsetX * turnSine + offsetY * turnCosine;

      if (this.mode.name === 'amoled-lava') {
        const massOffsetX = massX - twirl.x;
        const massOffsetY = massY - twirl.y;
        const massDistanceSquared = massOffsetX * massOffsetX + massOffsetY * massOffsetY;
        if (massDistanceSquared < radiusSquared) {
          const massRadialPosition = Math.sqrt(massDistanceSquared / radiusSquared);
          const massEnvelope = 1 - smoothstep(0.38, 1, massRadialPosition);
          const massSineRate = 0.5 + 0.5 * Math.sin(
            twirl.ratePhase
              + massRadialPosition * (twirl._rateFrequency ?? TAU * twirl.rateCycles)
          );
          const massTurn = twirl.angle
            * 0.54
            * massEnvelope
            * lerp(twirl.rateFloor, 1, massSineRate);
          const massTurnCosine = Math.cos(massTurn);
          const massTurnSine = Math.sin(massTurn);
          massX = twirl.x
            + massOffsetX * massTurnCosine
            - massOffsetY * massTurnSine;
          massY = twirl.y
            + massOffsetX * massTurnSine
            + massOffsetY * massTurnCosine;
        }
      }
    }

    if (this.mode.name === 'amoled-lava') {
      const contourFollow = this.lavaDirection.name === 'islands' ? 0.22 : 0.16;
      massX = lerp(massX, x, contourFollow);
      massY = lerp(massY, y, contourFollow);
    }

    const output = result || {};
    output.x = x;
    output.y = y;
    output.massX = massX;
    output.massY = massY;
    output.broad = broad;
    output.curl = curl;
    output.bubbleRim = bubble.rim;
    return output;
  }

  _contourCharacter(u, v, warped, result = null) {
    const drift = this.contourDrift;
    const directionX = drift._directionX ?? Math.cos(drift.angle);
    const directionY = drift._directionY ?? Math.sin(drift.angle);
    const along = (u * directionX + v * directionY) * drift.scale;
    const across = (-u * directionY + v * directionX) * drift.scale;
    const thicknessNoise = this.noise.fbm(
      along * 1.18 + 31.7,
      across * 0.92 - 18.4,
      3
    );
    const valueNoise = this.noise.fbm(
      along * 0.73 - warped.broad * 0.28 + 7.6,
      across * 1.04 + warped.curl * 0.22 + 24.1,
      3
    );
    const meander = Math.sin(
      (along * 1.34 + across * 0.39) * TAU
      + drift.phase
      + (thicknessNoise - 0.5) * 2.7
    );
    const crossCurrent = Math.sin(
      (along * 0.41 - across * 0.88) * TAU
      + drift.secondaryPhase
      + (valueNoise - 0.5) * 2.2
    );

    const output = result || {};
    output.thickness = clamp(
      0.55 + thicknessNoise * 0.88 + meander * 0.13,
      0.48,
      1.52
    );
    output.value = clamp(
      0.68 + valueNoise * 0.48 + crossCurrent * 0.08,
      0.66,
      1.18
    );
    output.spacing = clamp(
      0.87 + valueNoise * 0.19 + meander * 0.055,
      0.82,
      1.12
    );
    output.phase = (thicknessNoise - 0.5) * 0.040
      + crossCurrent * 0.009;
    return output;
  }

  _contourBundle(
    u,
    v,
    value,
    frequency,
    baseWidth,
    widthVariation,
    lineDrift,
    palettePosition,
    contour,
    result = null
  ) {
    let totalStrength = 0;
    let maximumStrength = 0;
    let weightedRed = 0;
    let weightedGreen = 0;
    let weightedBlue = 0;
    let activeCount = 0;
    let maximumDivergence = 0;
    const layerColor = {};

    for (let index = 0; index < this.contourLayers.length; index++) {
      const layer = this.contourLayers[index];
      const directionX = layer._directionX ?? Math.cos(layer.angle);
      const directionY = layer._directionY ?? Math.sin(layer.angle);
      const along = u * directionX + v * directionY;
      const across = -u * directionY + v * directionX;
      const slowPhase = contour.phase * (18 + index * 2.3);
      const presenceSignal = 0.5
        + Math.sin(along * TAU * 0.72 + layer.phase + slowPhase) * 0.27
        + Math.sin(across * TAU * 1.07 + layer.secondaryPhase - slowPhase * 0.37) * 0.23;
      const activity = index < 2
        ? 1
        : smoothstep(
          layer.presenceThreshold,
          layer.presenceThreshold + 0.18,
          presenceSignal
        );
      if (activity > 0.35) activeCount++;

      const branchWave = 0.5
        + Math.sin(along * TAU * 0.83 + layer.secondaryPhase + contour.phase * 11) * 0.27
        + Math.sin(across * TAU * 0.61 - layer.phase + contour.value * 1.7) * 0.23;
      const branchGate = smoothstep(0.70, 0.91, branchWave) * activity;
      const alternatePath = layer.branchDirection
        * layer.branchStrength
        * branchGate
        * (0.72 + 0.28 * Math.sin(across * TAU * 0.48 + layer.phase));
      maximumDivergence = Math.max(maximumDivergence, Math.abs(alternatePath));

      const gapDrift = 0.84
        + contour.spacing * 0.16
        + Math.sin(along * TAU * 0.57 + layer.phase) * 0.13;
      const laneOffset = layer.offset * layer.gapScale * gapDrift + alternatePath;
      const thicknessDrift = 0.76
        + Math.sin(along * TAU * 0.91 + layer.secondaryPhase + contour.phase * 9) * 0.20
        + contour.thickness * 0.16;
      const lineStrength = this._lineStrength(
        value + lineDrift + laneOffset / frequency,
        frequency,
        baseWidth * widthVariation * layer.widthScale * thicknessDrift * 0.34
      ) * activity;
      if (lineStrength <= 0.0001) continue;

      const valueDrift = clamp(
        layer.valueScale
          * (0.78 + contour.value * 0.20)
          * (0.88 + Math.sin(across * TAU * 0.69 + layer.phase) * 0.12),
        0.56,
        1.34
      );
      this._samplePalette(
        palettePosition
        + layer.paletteShift
        + Math.sin(along * TAU * 0.43 + layer.secondaryPhase) * 0.018,
        layerColor
      );
      weightedRed += layerColor.r * valueDrift * lineStrength;
      weightedGreen += layerColor.g * valueDrift * lineStrength;
      weightedBlue += layerColor.b * valueDrift * lineStrength;
      totalStrength += lineStrength;
      maximumStrength = Math.max(maximumStrength, lineStrength);
    }

    const strength = clamp(maximumStrength * 0.82 + totalStrength * 0.34, 0, 1);
    const colorWeight = Math.max(0.0001, totalStrength);
    const output = result || {};
    output.color ||= {};
    output.strength = strength;
    output.coverage = clamp(totalStrength * 0.74, 0, 1);
    output.color.r = weightedRed / colorWeight;
    output.color.g = weightedGreen / colorWeight;
    output.color.b = weightedBlue / colorWeight;
    output.activeCount = activeCount;
    output.maximumDivergence = maximumDivergence;
    return output;
  }

  _flowAt(u, v, aspect, phase = 0, result = null) {
    const x = u;
    const y = v * aspect;
    let vx = this.mode.baseFlow.x;
    let vy = this.mode.baseFlow.y;

    for (const vortex of this.vortices) {
      const dx = x - vortex.x;
      const dy = y - vortex.y;
      const distance = Math.hypot(dx, dy) || 0.0001;
      const flowRadius = vortex._flowRadius
        ?? Math.max(0.0001, vortex.radius * vortex.radius * 2.2);
      const influence = Math.exp(-(distance * distance) / flowRadius);
      const tangent = vortex.strength * influence;
      vx += (-dy / distance) * tangent;
      vy += (dx / distance) * tangent;
    }

    vx += Math.sin(y * 3.1 + phase) * 0.14;
    vy += Math.cos(x * 4.3 - phase * 0.7) * 0.11;
    const magnitude = Math.hypot(vx, vy) || 1;
    const output = result || {};
    output.x = vx / magnitude;
    output.y = (vy / magnitude) / aspect;
    return output;
  }

  _samplePalette(position, result = null) {
    const scaled = position * this.paletteRgb.length;
    const stopIndex = Math.floor(scaled);
    const amount = smoothstep(0.28, 0.72, scaled - stopIndex);
    const first = this._gradientStopColor(stopIndex);
    const second = this._gradientStopColor(stopIndex + 1);
    const output = result || {};
    output.r = lerp(first.r, second.r, amount);
    output.g = lerp(first.g, second.g, amount);
    output.b = lerp(first.b, second.b, amount);
    return output;
  }

  _gradientStopColor(stopIndex) {
    const cached = this.gradientStopRgb.get(stopIndex);
    if (cached) return cached;

    const paletteIndex = ((stopIndex % this.palette.length) + this.palette.length)
      % this.palette.length;
    const base = this.palette[paletteIndex];
    const seedPhase = (this.seed % 8191) * 0.00137;
    const hueShift = Math.sin(stopIndex * 1.731 + seedPhase) * 4.2
      + Math.sin(stopIndex * 0.619 - seedPhase * 1.7) * 1.3;
    const valueShift = Math.sin(stopIndex * 1.113 - seedPhase * 0.8) * 3.1
      + Math.sin(stopIndex * 0.397 + seedPhase * 2.1) * 1.1;
    const color = hslToRgb({
      h: (base.h + hueShift + 360) % 360,
      s: base.s,
      l: clamp(base.l + valueShift, 16, 82)
    });
    this.gradientStopRgb.set(stopIndex, color);
    return color;
  }

  _crossGradientDrift(u, v, result = null) {
    const across = u * this.gradientCrossDirection.x
      + v * this.gradientCrossDirection.y;
    const phase = this.gradientCrossPhase;
    const output = result || {};
    output.palette = Math.sin(across * TAU * 0.73 + phase) * 0.009
      + Math.sin(across * TAU * 1.61 - phase * 0.57) * 0.0035;
    output.value = 1
      + Math.sin(across * TAU * 0.47 - phase * 0.81) * 0.028
      + Math.sin(across * TAU * 1.19 + phase * 0.43) * 0.010;
    return output;
  }

  _lineStrength(value, frequency, width) {
    const position = fract(value * frequency);
    const distance = Math.min(position, 1 - position);
    return 1 - smoothstep(width, width * 2.4, distance);
  }

  _gradientSplitOpacity(bandIndex, progress) {
    if (this.mode.name === 'ultraviolet-current') return 1;

    let hash = Math.imul((bandIndex | 0) ^ this.seed, 0x45d9f3b);
    hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
    hash ^= hash >>> 16;

    // Only a minority of bands receive a cut, keeping the effect irregular
    // and preserving broad, uninterrupted gradients elsewhere.
    if ((hash & 7) !== 0) return 1;

    const center = 0.30 + ((hash >>> 3) & 3) * 0.12;
    const width = 0.018 + ((hash >>> 5) & 3) * 0.004;
    const split = 1 - smoothstep(
      width,
      width * 2.4,
      Math.abs(progress - center)
    );
    const transparency = 0.055 + ((hash >>> 7) & 7) / 140;
    return 1 - split * transparency;
  }

  /**
   * Smears color along the local flow direction inside elongated, streak-
   * shaped patches, so pigments bleed into their neighbors the way thick
   * paint drags when pulled across a surface. The patch mask itself is
   * sampled in flow-aligned coordinates (slow along the current, fast
   * across it), so the smudged regions are visibly stretched along the
   * same advection field that drives the filaments, rather than reading
   * as an isotropic blur.
   */
  _applyLiquidSmudge(image, field) {
    const w = field.width;
    const h = field.height;
    const total = w * h;
    const aspect = h / Math.max(1, w);
    const channels = new Float32Array(total * 3);
    for (let i = 0, p = 0; i < total; i++, p += 4) {
      channels[i * 3] = image.data[p];
      channels[i * 3 + 1] = image.data[p + 1];
      channels[i * 3 + 2] = image.data[p + 2];
    }

    const dirX = new Float32Array(total);
    const dirY = new Float32Array(total);
    const amount = new Float32Array(total);
    const flow = {};
    let anyActive = false;

    for (let y = 0; y < h; y++) {
      const v = y / Math.max(1, h - 1);
      for (let x = 0; x < w; x++) {
        const u = x / Math.max(1, w - 1);
        const index = y * w + x;
        if (field.mask[index] < 0.22) continue;

        this._flowAt(u, v, aspect, 0, flow);
        const rawX = flow.x * w;
        const rawY = flow.y * w;
        const magnitude = Math.hypot(rawX, rawY) || 1;
        const unitX = rawX / magnitude;
        const unitY = rawY / magnitude;

        // Patch noise is sampled in flow-aligned coordinates: slow along the
        // current, fast across it. That stretches the mask into streaks that
        // run with the flow instead of blobby isotropic islands, so the
        // smudged regions visibly carry a direction.
        const along = u * unitX + v * aspect * unitY;
        const across = -u * unitY + v * aspect * unitX;
        const patch = this.noise.fbm(
          along * 1.05 + this._smudgeOffsetA,
          across * 3.6 - this._smudgeOffsetB,
          2
        );
        const patchMask = smoothstep(0.52, 0.78, patch);
        if (patchMask <= 0.001) continue;

        dirX[index] = unitX;
        dirY[index] = unitY;
        amount[index] = patchMask * smoothstep(0.22, 0.55, field.mask[index]);
        anyActive = true;
      }
    }

    if (!anyActive) return;

    const stepPixels = clamp(w / 160, 1.2, 9.5);
    const iterations = 4;
    const blendFactor = 0.24;
    let current = channels;

    for (let iter = 0; iter < iterations; iter++) {
      const next = new Float32Array(total * 3);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const index = y * w + x;
          const base = index * 3;
          const amt = amount[index];
          if (amt <= 0.001) {
            next[base] = current[base];
            next[base + 1] = current[base + 1];
            next[base + 2] = current[base + 2];
            continue;
          }

          const sampleX = clamp(x + dirX[index] * stepPixels, 0, w - 1);
          const sampleY = clamp(y + dirY[index] * stepPixels, 0, h - 1);
          const x0 = Math.floor(sampleX);
          const y0 = Math.floor(sampleY);
          const x1 = Math.min(w - 1, x0 + 1);
          const y1 = Math.min(h - 1, y0 + 1);
          const tx = sampleX - x0;
          const ty = sampleY - y0;
          const i00 = (y0 * w + x0) * 3;
          const i10 = (y0 * w + x1) * 3;
          const i01 = (y1 * w + x0) * 3;
          const i11 = (y1 * w + x1) * 3;

          for (let channel = 0; channel < 3; channel++) {
            const top = lerp(current[i00 + channel], current[i10 + channel], tx);
            const bottom = lerp(current[i01 + channel], current[i11 + channel], tx);
            const sampled = lerp(top, bottom, ty);
            next[base + channel] = lerp(
              current[base + channel],
              sampled,
              amt * blendFactor
            );
          }
        }
      }
      current = next;
    }

    for (let i = 0, p = 0; i < total; i++, p += 4) {
      image.data[p] = Math.round(clamp(current[i * 3], 0, 255));
      image.data[p + 1] = Math.round(clamp(current[i * 3 + 1], 0, 255));
      image.data[p + 2] = Math.round(clamp(current[i * 3 + 2], 0, 255));
    }
  }

  /**
   * Lens bubbles seated on the rendered color boundaries. Runs on the
   * finished raster so "boundary" means whatever edge actually reads as one
   * (contour seams, band changes, mass silhouettes) in every mode. Each
   * cell of a coarse grid nominates its strongest edge pixel; a seeded roll
   * then decides whether a bubble forms there, how big it is (a wide,
   * skewed-small spread), how hard it refracts, and whether it straddles the
   * seam, hugs one side or buds off it. Bubble outlines are wobbly, the
   * refraction magnifies the paint beneath, and each color channel is
   * sampled with a slightly different magnification near the rim for a
   * chromatic fringe.
   */
  _applyBoundaryBubbles(image, field) {
    const cfg = this.mode.boundaryBubbles;
    if (!cfg || this.config.boundaryBubbles === false) return;

    const w = field.width;
    const h = field.height;
    if (w < 24 || h < 24) return;
    const salt = this._boundaryBubbleSalt;
    const source = new Uint8ClampedArray(image.data);
    const output = image.data;
    const edge = new Float32Array(w * h);
    const gradX = new Float32Array(w * h);
    const gradY = new Float32Array(w * h);

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const index = y * w + x;
        if (field.mask[index] < 0.3) continue;
        const o = index * 4;
        let magnitude = 0;
        let best = 0;
        let bx = 0;
        let by = 0;
        for (let c = 0; c < 3; c++) {
          const gx = source[o + 4 + c] - source[o - 4 + c];
          const gy = source[o + w * 4 + c] - source[o - w * 4 + c];
          const m = gx * gx + gy * gy;
          magnitude += m;
          if (m > best) { best = m; bx = gx; by = gy; }
        }
        edge[index] = Math.sqrt(magnitude);
        const length = Math.hypot(bx, by) || 1;
        gradX[index] = bx / length;
        gradY[index] = by / length;
      }
    }

    const sampleChannel = (x, y, c) => {
      const sx = clamp(x, 0, w - 1);
      const sy = clamp(y, 0, h - 1);
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(w - 1, x0 + 1);
      const y1 = Math.min(h - 1, y0 + 1);
      const tx = sx - x0;
      const ty = sy - y0;
      return lerp(
        lerp(source[(y0 * w + x0) * 4 + c], source[(y0 * w + x1) * 4 + c], tx),
        lerp(source[(y1 * w + x0) * 4 + c], source[(y1 * w + x1) * 4 + c], tx),
        ty
      );
    };

    const cell = Math.max(8, Math.round(w * cfg.cell));
    for (let cy = 0; cy * cell < h; cy++) {
      for (let cx = 0; cx * cell < w; cx++) {
        let peak = 0;
        let peakIndex = -1;
        const yEnd = Math.min(h - 1, (cy + 1) * cell);
        const xEnd = Math.min(w - 1, (cx + 1) * cell);
        for (let y = Math.max(1, cy * cell); y < yEnd; y++) {
          for (let x = Math.max(1, cx * cell); x < xEnd; x++) {
            const value = edge[y * w + x];
            if (value > peak) { peak = value; peakIndex = y * w + x; }
          }
        }
        if (peakIndex < 0) continue;

        const edgeWeight = smoothstep(60, 220, peak);
        if (bubbleCellHash(cx, cy, 20, salt) > cfg.occupancy * edgeWeight) continue;

        const sizeRoll = bubbleCellHash(cx, cy, 21, salt);
        const radius = w * lerp(cfg.radius[0], cfg.radius[1], Math.pow(sizeRoll, 2.2));
        const strength = lerp(cfg.strength[0], cfg.strength[1], bubbleCellHash(cx, cy, 22, salt));
        const placement = Math.floor(bubbleCellHash(cx, cy, 23, salt) * 3);
        const side = bubbleCellHash(cx, cy, 24, salt) < 0.5 ? -1 : 1;
        const offset = placement === 0 ? 0 : placement === 1 ? 0.45 : 0.95;

        const px = peakIndex % w;
        const py = (peakIndex - px) / w;
        const centerX = px + gradX[peakIndex] * radius * offset * side
          + (bubbleCellHash(cx, cy, 25, salt) - 0.5) * radius * 0.3;
        const centerY = py + gradY[peakIndex] * radius * offset * side
          + (bubbleCellHash(cx, cy, 26, salt) - 0.5) * radius * 0.3;
        const cxi = Math.round(centerX);
        const cyi = Math.round(centerY);
        if (cxi < 0 || cyi < 0 || cxi >= w || cyi >= h) continue;
        if (field.mask[cyi * w + cxi] < 0.3) continue;

        const wobbleA = 0.06 + bubbleCellHash(cx, cy, 27, salt) * 0.10;
        const wobbleB = 0.03 + bubbleCellHash(cx, cy, 28, salt) * 0.06;
        const lobesA = 2 + Math.floor(bubbleCellHash(cx, cy, 29, salt) * 3);
        const phaseA = bubbleCellHash(cx, cy, 30, salt) * TAU;
        const phaseB = bubbleCellHash(cx, cy, 31, salt) * TAU;
        const tilt = bubbleCellHash(cx, cy, 32, salt) * TAU;
        const stretch = 1 + bubbleCellHash(cx, cy, 33, salt) * 0.32;
        const tiltCos = Math.cos(tilt);
        const tiltSin = Math.sin(tilt);
        const reach = Math.ceil(radius * (1 + wobbleA + wobbleB) * stretch) + 1;

        for (let y = Math.max(0, cyi - reach); y <= Math.min(h - 1, cyi + reach); y++) {
          for (let x = Math.max(0, cxi - reach); x <= Math.min(w - 1, cxi + reach); x++) {
            const dx = x - centerX;
            const dy = y - centerY;
            const localX = dx * tiltCos + dy * tiltSin;
            const localY = (-dx * tiltSin + dy * tiltCos) / stretch;
            const angle = Math.atan2(localY, localX);
            const outline = radius * (
              1
              + Math.sin(angle * lobesA + phaseA) * wobbleA
              + Math.sin(angle * (lobesA + 2) + phaseB) * wobbleB
            );
            const d = Math.hypot(localX, localY) / outline;
            if (d >= 1 || field.mask[y * w + x] < 0.3) continue;

            const magnify = 1 - strength * (1 - d * d);
            const fringe = cfg.fringe * strength
              * smoothstep(0.35, 0.85, d) * (1 - smoothstep(0.85, 1, d));
            const o = (y * w + x) * 4;
            output[o] = Math.round(sampleChannel(
              centerX + dx * magnify * (1 - fringe),
              centerY + dy * magnify * (1 - fringe), 0
            ));
            output[o + 1] = Math.round(sampleChannel(
              centerX + dx * magnify, centerY + dy * magnify, 1
            ));
            output[o + 2] = Math.round(sampleChannel(
              centerX + dx * magnify * (1 + fringe),
              centerY + dy * magnify * (1 + fringe), 2
            ));
          }
        }
      }
    }
  }

  _antialiasHighContrastEdges(image, width, height) {
    const source = new Uint8ClampedArray(image.data);
    const luminance = new Uint16Array(width * height);
    for (let index = 0, offset = 0; index < luminance.length; index++, offset += 4) {
      luminance[index] = source[offset] * 54
        + source[offset + 1] * 183
        + source[offset + 2] * 19;
    }

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const pixel = y * width + x;
        const center = pixel * 4;
        const left = center - 4;
        const right = center + 4;
        const top = center - width * 4;
        const bottom = center + width * 4;
        const topLeft = top - 4;
        const topRight = top + 4;
        const bottomLeft = bottom - 4;
        const bottomRight = bottom + 4;
        const centerLuminance = luminance[pixel];
        const leftLuminance = luminance[pixel - 1];
        const rightLuminance = luminance[pixel + 1];
        const topLuminance = luminance[pixel - width];
        const bottomLuminance = luminance[pixel + width];
        const topLeftLuminance = luminance[pixel - width - 1];
        const topRightLuminance = luminance[pixel - width + 1];
        const bottomLeftLuminance = luminance[pixel + width - 1];
        const bottomRightLuminance = luminance[pixel + width + 1];
        const minimumLuminance = Math.min(
          centerLuminance,
          leftLuminance,
          rightLuminance,
          topLuminance,
          bottomLuminance,
          topLeftLuminance,
          topRightLuminance,
          bottomLeftLuminance,
          bottomRightLuminance
        );
        const maximumLuminance = Math.max(
          centerLuminance,
          leftLuminance,
          rightLuminance,
          topLuminance,
          bottomLuminance,
          topLeftLuminance,
          topRightLuminance,
          bottomLeftLuminance,
          bottomRightLuminance
        );
        if (maximumLuminance - minimumLuminance < 34 * 256) continue;

        for (let channel = 0; channel < 3; channel++) {
          image.data[center + channel] = Math.round(
            source[center + channel] * 0.76
            + (
              source[left + channel]
              + source[right + channel]
              + source[top + channel]
              + source[bottom + channel]
            ) * 0.045
            + (
              source[topLeft + channel]
              + source[topRight + channel]
              + source[bottomLeft + channel]
              + source[bottomRight + channel]
            ) * 0.015
          );
        }
      }
    }
  }

  _chromaticMask(u, v, warped) {
    const boundaryNoise = this.noise.sample(u * 2.1 + 9.3, 4.7) - 0.5;
    const boundary = 0.285
      + Math.sin(u * TAU * 0.82 + 0.7) * 0.042
      + boundaryNoise * 0.065;
    const bottomMass = smoothstep(boundary - 0.018, boundary + 0.035, v);

    const lobeX = (u - 0.54) / 0.70;
    const lobeY = (v - 0.42) / 0.215;
    const lobeRuffle = this.noise.fbm(u * 6.2 + 17.1, v * 7.1 - 5.8, 2) - 0.5;
    const lobeDistance = Math.hypot(lobeX, lobeY)
      + (warped.broad - 0.5) * 0.21
      + lobeRuffle * 0.34;
    const upperLobe = 1 - smoothstep(0.88, 1.08, lobeDistance);

    const cavityX = (u - 0.10) / 0.27;
    const cavityY = (v - 0.57) / 0.115;
    const cavityRuffle = this.noise.fbm(u * 8.7 - 3.2, v * 7.9 + 11.6, 2) - 0.5;
    const cavityDistance = Math.hypot(cavityX, cavityY)
      + (warped.curl - 0.5) * 0.28
      + cavityRuffle * 0.42;
    const cavity = 1 - smoothstep(0.80, 1.08, cavityDistance);
    return clamp(Math.max(bottomMass, upperLobe) * (1 - cavity), 0, 1);
  }

  _lavaMask(u, v, warped, aspect) {
    const influence = this._lavaFieldValue(u, v, warped, aspect);
    return smoothstep(
      this.lavaDirection.maskStart,
      this.lavaDirection.maskEnd,
      influence
    );
  }

  _lavaFieldValue(u, v, warped, aspect, pigment = null) {
    const influence = this._blobInfluence(u, v, aspect, warped, pigment);
    const stir = (warped.broad - 0.5) * 0.12 + (warped.curl - 0.5) * 0.075;
    return influence * 1.12 + stir;
  }

  _applyRadialTwists(u, v, aspect, result = null) {
    let x = u;
    let y = v * aspect;
    let totalTurn = 0;

    for (const twist of this.radialTwists) {
      const offsetX = x - twist.x;
      const offsetY = y - twist.y;
      const distanceSquared = offsetX * offsetX + offsetY * offsetY;
      const radiusSquared = twist._radiusSquared ?? twist.radius * twist.radius;
      if (distanceSquared >= radiusSquared) continue;

      const radialPosition = Math.sqrt(distanceSquared / radiusSquared);
      const envelope = 1 - smoothstep(0.12, 1, radialPosition);
      const turn = twist.strength
        * envelope ** 1.45
        * (0.86 + Math.sin(radialPosition * Math.PI + twist.phase) * 0.14);
      const cosine = Math.cos(turn);
      const sine = Math.sin(turn);
      x = twist.x + offsetX * cosine - offsetY * sine;
      y = twist.y + offsetX * sine + offsetY * cosine;
      totalTurn += turn;
    }

    const output = result || {};
    output.x = x;
    output.y = y;
    output.turn = totalTurn;
    return output;
  }

  _mapTranceDomain(u, v, aspect, result = null) {
    const profile = this.tranceProfile;
    const centerX = this.tranceCenter.x;
    const centerY = aspect * this.tranceCenter.y;
    const output = result || {};
    let localX = u;
    let localY = v * aspect;
    let localTurn = 0;
    if (!this.tranceAccentsEnabled) {
      this._applyRadialTwists(u, v, aspect, output);
      localX = output.x;
      localY = output.y;
      localTurn = output.turn;
    }
    const offsetX = localX - centerX;
    const offsetY = localY - centerY;
    const radius = Math.hypot(offsetX, offsetY);
    const rotation = (this.seed % 4096) / 4096 * TAU;
    const rawAngle = Math.atan2(offsetY, offsetX) + rotation;
    const twistedAngle = this.tranceAccentsEnabled
      ? rawAngle + radius * profile.twist
      : rawAngle;
    const symmetryPhase = twistedAngle * profile.symmetry;
    const angularEcho = this.tranceAccentsEnabled
      ? Math.cos(symmetryPhase)
      : Math.sin(rawAngle * 2 + rotation * 0.37) * 0.64
        + Math.cos(rawAngle * 3 - radius * 4.8) * 0.36;
    const ring = this.tranceAccentsEnabled
      ? Math.sin(
          radius * profile.ringFrequency * TAU
          + angularEcho * 0.72
          + rotation * 1.7
        )
      : Math.sin(
          (localX * 0.73 + localY * 0.41) * profile.ringFrequency * TAU
          + angularEcho * 0.46
          + localTurn * 1.8
          + rotation * 1.7
        );
    const radialEnvelope = smoothstep(0.025, 0.24, radius)
      * (1 - smoothstep(0.46, 0.72, radius));
    const sampleRadius = Math.max(
      0,
      radius + ring * profile.radialWarp * radialEnvelope
    );
    const petalMeander = Math.sin(
      radius * TAU * (profile.ringFrequency * 0.46)
      + rotation
    ) * (TAU / profile.symmetry) * 0.055;
    const asymmetricDrift = (
      Math.sin(rawAngle * 2 + rotation * 0.61) * 0.085
      + Math.cos(rawAngle - radius * 8.2) * 0.045
    ) * radialEnvelope;
    const sampleAngle = twistedAngle + petalMeander + asymmetricDrift;
    if (this.mode.name === 'chromatic-wave') {
      output.u = u;
      output.v = v;
    } else if (!this.tranceAccentsEnabled) {
      output.u = localX;
      output.v = localY / aspect;
    } else {
      output.u = centerX + Math.cos(sampleAngle) * sampleRadius;
      output.v = (centerY + Math.sin(sampleAngle) * sampleRadius) / aspect;
    }
    output.radius = radius;
    output.angularEcho = angularEcho;
    output.ring = ring;
    return output;
  }

  _buildPaintField(width, height) {
    const configuredScale = Number(this.config.renderScale);
    const scale = clamp(
      Number.isFinite(configuredScale) ? configuredScale : this.mode.renderScale,
      0.3,
      1.35
    );
    const fieldWidth = Math.max(128, Math.round(width * scale));
    const fieldHeight = Math.max(192, Math.round(height * scale));
    const aspect = height / Math.max(1, width);
    const count = fieldWidth * fieldHeight;
    const scalar = new Float32Array(count);
    const texture = new Float32Array(count);
    const mask = new Float32Array(count);
    const softMask = new Float32Array(count);
    const contourThickness = new Float32Array(count);
    const contourValue = new Float32Array(count);
    const contourSpacing = new Float32Array(count);
    const contourPhase = new Float32Array(count);
    const tranceRadius = new Float32Array(count);
    const tranceAngular = new Float32Array(count);
    const tranceRing = new Float32Array(count);
    const blobSaturation = new Float32Array(count);
    const blobShadow = new Float32Array(count);
    const blobHighlight = new Float32Array(count);
    const blobGapTwist = new Float32Array(count);
    const bubbleRim = new Float32Array(count);
    const warped = {};
    const contour = {};
    const domain = {};
    const pigment = {};

    for (let y = 0; y < fieldHeight; y++) {
      const v = y / Math.max(1, fieldHeight - 1);
      for (let x = 0; x < fieldWidth; x++) {
        const u = x / Math.max(1, fieldWidth - 1);
        const index = y * fieldWidth + x;
        this._mapTranceDomain(u, v, aspect, domain);
        this._warpPoint(domain.u, domain.v, aspect, warped);
        bubbleRim[index] = warped.bubbleRim;
        this._contourCharacter(domain.u, domain.v, warped, contour);
        const secondary = this.noise.fbm(
          warped.x * 5.6 + warped.broad * 1.8,
          warped.y * 5.1 - warped.curl * 1.5,
          2
        );
        let lavaValue = 0;
        if (this.mode.name === 'amoled-lava') {
          lavaValue = this._lavaFieldValue(
            domain.u,
            domain.v,
            warped,
            aspect,
            pigment
          );
          blobSaturation[index] = pigment.saturation;
          blobShadow[index] = pigment.shadow;
          blobHighlight[index] = pigment.highlight;
          blobGapTwist[index] = pigment.gapTwist;
        }

        const flowScalar = (
          warped.x * 0.83
          + warped.y * 0.17
          + warped.broad * 0.74
          + warped.curl * 0.27
          + secondary * 0.12
          + domain.ring * this.tranceProfile.ringStrength
            * (this.tranceAccentsEnabled ? 1 : 0.24)
        ) * this.mode.bandScale;
        scalar[index] = this.mode.name === 'amoled-lava'
          && !this.tranceAccentsEnabled
          ? (
              pigment.form * 0.86
              + pigment.holeFlow
              + (warped.broad - 0.5) * 0.11
              + (warped.curl - 0.5) * 0.055
              + (secondary - 0.5) * 0.035
            ) * this.mode.bandScale
          : flowScalar;
        texture[index] = clamp(
          0.60
          + (warped.broad - 0.5) * 0.30
          + (secondary - 0.5) * 0.24
          + domain.angularEcho * 0.035,
          0.40,
          0.96
        );
        tranceRadius[index] = domain.radius;
        tranceAngular[index] = domain.angularEcho;
        tranceRing[index] = domain.ring;
        contourThickness[index] = contour.thickness;
        contourValue[index] = clamp(
          contour.value
          + domain.ring * 0.055
          + domain.angularEcho * 0.025,
          0.62,
          1.22
        );
        contourSpacing[index] = contour.spacing;
        contourPhase[index] = contour.phase;
        if (this.mode.name === 'chromatic-wave') {
          mask[index] = this._chromaticMask(domain.u, domain.v, warped);
          softMask[index] = mask[index];
        } else if (this.mode.name === 'amoled-lava') {
          mask[index] = smoothstep(
            this.lavaDirection.maskStart,
            this.lavaDirection.maskEnd,
            lavaValue
          );
          softMask[index] = smoothstep(
            this.lavaDirection.maskStart - 0.16,
            this.lavaDirection.maskEnd + 0.015,
            lavaValue
          );
        } else {
          mask[index] = 1;
          softMask[index] = 1;
        }
      }
    }

    return {
      width: fieldWidth,
      height: fieldHeight,
      scalar,
      texture,
      mask,
      softMask,
      contourThickness,
      contourValue,
      contourSpacing,
      contourPhase,
      tranceRadius,
      tranceAngular,
      tranceRing,
      blobSaturation,
      blobShadow,
      blobHighlight,
      blobGapTwist,
      bubbleRim
    };
  }

  _renderRaster(ctx, width, height) {
    const field = this._buildPaintField(width, height);
    const raster = createCanvas(field.width, field.height);
    const rasterCtx = raster.getContext('2d');
    const image = rasterCtx.createImageData(field.width, field.height);
    const contour = {};
    const contourBundle = { color: {} };
    const color = {};
    const crossGradient = {};
    const isLava = this.mode.name === 'amoled-lava';
    const isChromatic = this.mode.name === 'chromatic-wave';
    const contourScale = isLava ? this.lavaDirection.contourScale : 1;
    const microScale = isLava ? this.lavaDirection.microScale : 1;

    for (let y = 0; y < field.height; y++) {
      const v = y / Math.max(1, field.height - 1);
      for (let x = 0; x < field.width; x++) {
        const u = x / Math.max(1, field.width - 1);
        const index = y * field.width + x;
        const output = index * 4;
        const value = field.scalar[index];
        const mask = field.mask[index];
        let fadeRegion = 0;
        let visibleMask = mask;

        if (isLava) {
          const fadeWave = 0.5 + 0.5 * Math.sin(
            (
              field.tranceRadius[index] * 1.35
              + field.tranceAngular[index] * 0.08
            ) * TAU
            + (this.seed % 997) * 0.017
          );
          fadeRegion = smoothstep(
            0.56,
            0.84,
            fadeWave * 0.68 + field.texture[index] * 0.32
          );
          visibleMask = lerp(mask, field.softMask[index], fadeRegion * 0.82);
          if (visibleMask < 0.006) {
            image.data[output] = 0;
            image.data[output + 1] = 0;
            image.data[output + 2] = 0;
            image.data[output + 3] = 255;
            continue;
          }
        } else if (isChromatic && mask < 0.006) {
          image.data[output] = 0;
          image.data[output + 1] = 0;
          image.data[output + 2] = 0;
          image.data[output + 3] = 255;
          continue;
        }

        const naturalCadence = 0.5 + 0.5 * Math.sin((
          field.tranceRadius[index] * this.tranceProfile.ringFrequency * 0.72
          + field.tranceAngular[index] * 0.16
          + field.texture[index] * 1.35
        ) * TAU);
        const spacingVariation = (0.88 + naturalCadence * 0.22)
          * field.contourSpacing[index];
        const widthVariation = (0.76 + field.texture[index] * 0.38)
          * field.contourThickness[index];
        const lineDrift = (field.texture[index] - 0.66) * 0.018
          + Math.sin((
            field.tranceRadius[index] * this.tranceProfile.ringFrequency * 0.54
            - field.tranceAngular[index] * 0.24
          ) * TAU) * 0.004
          + (isLava ? (field.blobGapTwist[index] - 0.5) * 0.016 : 0)
          + field.contourPhase[index];
        const contourFrequency = this.mode.contourFrequency
          * contourScale
          * spacingVariation;
        const seamValue = value + lineDrift * 0.45;
        const contourCoordinate = seamValue * contourFrequency;
        const bandIndex = Math.floor(contourCoordinate);
        const contourProgress = fract(contourCoordinate);
        const fillWarp = (field.texture[index] - 0.66)
          * 0.22
          * Math.sin(contourProgress * Math.PI);
        const fillProgress = smoothstep(
          0.04,
          0.96,
          clamp(contourProgress + fillWarp, 0, 1)
        );
        const palettePosition = (
          bandIndex
          + this.paletteBandOffset
          + fillProgress
        ) / this.paletteRgb.length;
        this._crossGradientDrift(u, v, crossGradient);
        const shiftedPalettePosition = palettePosition + crossGradient.palette;
        contour.thickness = field.contourThickness[index];
        contour.value = field.contourValue[index];
        contour.spacing = field.contourSpacing[index];
        contour.phase = field.contourPhase[index];
        this._contourBundle(
          u,
          v,
          value + 0.017,
          contourFrequency,
          this.mode.primaryWidth,
          widthVariation,
          lineDrift,
          shiftedPalettePosition,
          contour,
          contourBundle
        );
        const primaryLine = contourBundle.strength;
        const microLine = this._lineStrength(
          value - 0.031 - lineDrift * 0.7,
          this.mode.microFrequency * microScale * (1.08 - naturalCadence * 0.13),
          this.mode.microWidth * (0.94 + field.contourThickness[index] * 0.20)
        );
        const darkSeam = this._lineStrength(
          seamValue,
          contourFrequency,
          this.mode.seamWidth * (0.82 + naturalCadence * 0.31)
        );
        this._samplePalette(shiftedPalettePosition, color);
        color.r = lerp(color.r, contourBundle.color.r, contourBundle.coverage * 0.72);
        color.g = lerp(color.g, contourBundle.color.g, contourBundle.coverage * 0.72);
        color.b = lerp(color.b, contourBundle.color.b, contourBundle.coverage * 0.72);
        color.r *= crossGradient.value;
        color.g *= crossGradient.value;
        color.b *= crossGradient.value;
        if (isLava) {
          const luminance = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
          const saturation = field.blobSaturation[index] || 1;
          color.r = luminance + (color.r - luminance) * saturation;
          color.g = luminance + (color.g - luminance) * saturation;
          color.b = luminance + (color.b - luminance) * saturation;
        }
        let contourLight = 1;

        if (this.mode.name === 'chromatic-wave') {
          const chromaticLuminance = color.r * 0.2126
            + color.g * 0.7152
            + color.b * 0.0722;
          color.r = chromaticLuminance + (color.r - chromaticLuminance) * 1.06;
          color.g = chromaticLuminance + (color.g - chromaticLuminance) * 1.06;
          color.b = chromaticLuminance + (color.b - chromaticLuminance) * 1.06;
          const fiberWave = 0.5 + 0.5 * Math.sin((value * 30 + field.texture[index] * 1.8) * TAU);
          const fiberHighlight = smoothstep(0.78, 0.98, fiberWave);
          const highlight = clamp(
            primaryLine * 0.67 + microLine * 0.28 + fiberHighlight * 0.20,
            0,
            0.90
          );
          const impasto = (0.76 + field.texture[index] * 0.32 + microLine * 0.07)
            * (0.82 + fiberWave * 0.23);
          const creamBias = smoothstep(0.70, 0.98, primaryLine) * (0.45 + 0.30 * Math.sin(value * 1.7));
          color.r = lerp(color.r, 255, highlight * (0.46 + creamBias * 0.36));
          color.g = lerp(color.g, 205, highlight * (0.28 + creamBias * 0.52));
          color.b = lerp(color.b, 220, highlight * 0.22);
          const seamShade = 1 - darkSeam * 0.38;
          color.r *= impasto * seamShade * mask;
          color.g *= impasto * seamShade * mask;
          color.b *= impasto * seamShade * mask;

          const edgeLight = mask > 0.05 && mask < 0.62 ? (1 - Math.abs(mask - 0.34) / 0.29) : 0;
          color.r += edgeLight * 112;
          color.g += edgeLight * 27;
          color.b += edgeLight * 42;
        } else if (this.mode.name === 'amoled-lava') {
          {
            const leftMask = field.mask[y * field.width + Math.max(0, x - 1)];
            const rightMask = field.mask[y * field.width + Math.min(field.width - 1, x + 1)];
            const topMask = field.mask[Math.max(0, y - 1) * field.width + x];
            const bottomMask = field.mask[Math.min(field.height - 1, y + 1) * field.width + x];
            const normalX = leftMask - rightMask;
            const normalY = topMask - bottomMask;
            const normalLength = Math.hypot(normalX, normalY) || 1;
            const edgeDirectionalLight = clamp(
              0.5 + (normalX * -0.58 + normalY * -0.82) / normalLength * 0.5,
              0,
              1
            );
            const blobDirectionalLight = clamp(
              field.blobHighlight[index] / 0.34,
              0,
              1
            );
            const directionalLight = lerp(
              edgeDirectionalLight,
              blobDirectionalLight,
              0.62
            );
            const edgeBand = smoothstep(0.035, 0.38, mask)
              * (1 - smoothstep(0.52, 0.93, mask));
            const lavaPulse = 0.5 + 0.5 * Math.sin((value * 4.4 + field.texture[index] * 0.9) * TAU);
            const internalGlow = clamp(primaryLine * 0.44 + microLine * 0.17, 0, 0.56);
            const bodyLight = 0.68 + field.texture[index] * 0.30 + lavaPulse * 0.10;
            color.r *= bodyLight;
            color.g *= bodyLight;
            color.b *= bodyLight;
            color.r = lerp(color.r, 255, internalGlow * 0.34);
            color.g = lerp(color.g, 246, internalGlow * 0.24);
            color.b = lerp(color.b, 255, internalGlow * 0.29);

            const seamShade = 1 - darkSeam * 0.56;
            const crispBodyMask = smoothstep(0.04, 0.30, mask);
            const fadingBodyMask = smoothstep(0.004, 0.64, visibleMask);
            let bodyMask = lerp(crispBodyMask, fadingBodyMask, fadeRegion);
            const edgeInterior = smoothstep(0.08, 0.70, mask);
            const twistedGap = field.blobGapTwist[index];
            const edgeContour = clamp(
              primaryLine * (0.52 + twistedGap * 0.22)
              + microLine * (0.11 + (1 - twistedGap) * 0.12),
              0,
              1
            );
            const interContourFade = lerp(
              0.48 + twistedGap * 0.13,
              1,
              clamp(edgeInterior + edgeContour, 0, 1)
            );
            bodyMask *= interContourFade;
            color.r *= seamShade * bodyMask;
            color.g *= seamShade * bodyMask;
            color.b *= seamShade * bodyMask;

            const broadShadow = field.blobShadow[index] * bodyMask;
            const shadowScale = 1 - broadShadow * 0.82;
            color.r *= shadowScale;
            color.g *= shadowScale;
            color.b *= shadowScale;

            const intensityHighlight = field.blobHighlight[index] * bodyMask;
            const highlightLuminance = color.r * 0.2126
              + color.g * 0.7152
              + color.b * 0.0722;
            const highlightSaturation = 1 + intensityHighlight * 1.64;
            const highlightLift = 1 + intensityHighlight * 1.44;
            color.r = (
              highlightLuminance
              + (color.r - highlightLuminance) * highlightSaturation
            ) * highlightLift;
            color.g = (
              highlightLuminance
              + (color.g - highlightLuminance) * highlightSaturation
            ) * highlightLift;
            color.b = (
              highlightLuminance
              + (color.b - highlightLuminance) * highlightSaturation
            ) * highlightLift;

            const bandHighlight = this._lineStrength(
              seamValue - 0.23 / contourFrequency,
              contourFrequency,
              0.052 * (0.90 + field.contourThickness[index] * 0.16)
            );
            const bandShadow = this._lineStrength(
              seamValue - 0.73 / contourFrequency,
              contourFrequency,
              0.070 * (0.92 + field.contourThickness[index] * 0.18)
            );
            const rippleFrequency = this.mode.microFrequency
              * microScale
              * (1.08 - naturalCadence * 0.13);
            const rippleValue = value - 0.031 - lineDrift * 0.7;
            const rippleHighlight = this._lineStrength(
              rippleValue - 0.20 / rippleFrequency,
              rippleFrequency,
              0.032
            );
            const rippleShadow = this._lineStrength(
              rippleValue - 0.68 / rippleFrequency,
              rippleFrequency,
              0.041
            );
            const reliefMask = bodyMask * smoothstep(0.16, 0.72, visibleMask);
            const reliefShadow = clamp(
              bandShadow * 0.16
              + rippleShadow * 0.048
              + darkSeam * 0.032,
              0,
              0.23
            ) * reliefMask;
            color.r *= 1 - reliefShadow;
            color.g *= 1 - reliefShadow;
            color.b *= 1 - reliefShadow;

            const reliefHighlight = clamp(
              bandHighlight * (0.13 + directionalLight * 0.075)
              + rippleHighlight * 0.055
              + primaryLine * 0.035,
              0,
              0.24
            ) * reliefMask;
            const pigmentLift = 1 + reliefHighlight * 0.88;
            color.r *= pigmentLift;
            color.g *= pigmentLift;
            color.b *= pigmentLift;
            color.r = lerp(color.r, 255, reliefHighlight * 0.20);
            color.g = lerp(color.g, 250, reliefHighlight * 0.16);
            color.b = lerp(color.b, 255, reliefHighlight * 0.18);

            const edgeShade = edgeBand * (1 - directionalLight) * 0.46;
            color.r *= 1 - edgeShade;
            color.g *= 1 - edgeShade;
            color.b *= 1 - edgeShade;

            const bevelHighlight = edgeBand
              * smoothstep(0.48, 0.94, directionalLight)
              * (0.36 + field.texture[index] * 0.14);
            color.r = lerp(color.r, 255, bevelHighlight);
            color.g = lerp(color.g, 252, bevelHighlight * 0.92);
            color.b = lerp(color.b, 255, bevelHighlight * 0.96);

            const coreGlow = smoothstep(0.70, 0.98, mask)
              * (0.025 + lavaPulse * 0.035);
            color.r = lerp(color.r, 255, coreGlow);
            color.g = lerp(color.g, 255, coreGlow);
            color.b = lerp(color.b, 255, coreGlow);
          }
        } else {
          const eddyLight = clamp(primaryLine * 0.68 + microLine * 0.34, 0, 0.88);
          contourLight = eddyLight;
          const darkPocket = smoothstep(0.48, 0.83, field.texture[index]);
          const baseLight = 0.10 + darkPocket * 0.25;
          color.r *= baseLight;
          color.g *= baseLight;
          color.b *= baseLight;
          color.r = lerp(color.r, 255, eddyLight * 0.78);
          color.g = lerp(color.g, 20, eddyLight * 0.56);
          color.b = lerp(color.b, 232, eddyLight * 0.86);

          const edgeGlow = Math.exp(
            -Math.abs(field.tranceRadius[index] - 0.43) * 16
          );
          const edgeHue = field.tranceAngular[index] > 0
            ? { r: 255, g: 0, b: 168 }
            : { r: 18, g: 46, b: 255 };
          color.r += edgeHue.r * edgeGlow * 0.72;
          color.g += edgeHue.g * edgeGlow * 0.72;
          color.b += edgeHue.b * edgeGlow * 0.72;
          const seamShade = 1 - darkSeam * 0.68;
          color.r *= seamShade;
          color.g *= seamShade;
          color.b *= seamShade;

          if (eddyLight < 0.045 && field.texture[index] < 0.56 && edgeGlow < 0.08) {
            color.r *= 0.12;
            color.g *= 0.08;
            color.b *= 0.16;
          }
        }

        if (this._macroHueAmplitude > 0) {
          const macroHueNoise = this.noise.fbm(
            u * 0.80 + this._macroHueOffsetA,
            v * 0.80 - this._macroHueOffsetB,
            2
          );
          const macroHueAngle = (macroHueNoise - 0.5) * this._macroHueAmplitude;
          const rotated = rotateHue(color.r, color.g, color.b, macroHueAngle);
          color.r = rotated.r;
          color.g = rotated.g;
          color.b = rotated.b;
        }

        const valueDrift = (field.contourValue[index] - 0.66) / 0.52;
        const naturalValue = this.mode.name === 'ultraviolet-current'
          ? (contourLight < 0.12
            ? lerp(0.62, 0.82, valueDrift)
            : lerp(1.08, 1.55, valueDrift))
          : field.contourValue[index];
        color.r *= naturalValue;
        color.g *= naturalValue;
        color.b *= naturalValue;

        const bubbleRim = field.bubbleRim[index];
        if (bubbleRim !== 0) {
          const rimGate = smoothstep(0.08, 0.32, visibleMask);
          const rimEffect = bubbleRim * rimGate;
          if (rimEffect > 0) {
            color.r = lerp(color.r, 255, rimEffect);
            color.g = lerp(color.g, 255, rimEffect);
            color.b = lerp(color.b, 255, rimEffect);
          } else if (rimEffect < 0) {
            const shade = 1 + rimEffect;
            color.r *= shade;
            color.g *= shade;
            color.b *= shade;
          }
        }

        image.data[output] = Math.round(clamp(color.r, 0, 255));
        image.data[output + 1] = Math.round(clamp(color.g, 0, 255));
        image.data[output + 2] = Math.round(clamp(color.b, 0, 255));
        image.data[output + 3] = Math.round(
          255 * this._gradientSplitOpacity(bandIndex, fillProgress)
        );
      }
    }

    this._applyLiquidSmudge(image, field);
    this._applyBoundaryBubbles(image, field);
    if (this.mode.name === 'amoled-lava') {
      this._antialiasHighContrastEdges(image, field.width, field.height);
    }
    rasterCtx.putImageData(image, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(raster, 0, 0, width, height);
    ctx.restore();
  }

  _renderFilaments(ctx, width, height) {
    const aspect = height / Math.max(1, width);
    const lineScale = Math.max(0.75, width / 540);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = this.mode.name === 'ultraviolet-current' ? 'screen' : 'source-over';
    const flow = {};
    const domain = {};
    const warped = {};

    for (const filament of this.filaments) {
      let u = filament.x;
      let v = filament.y;
      let drawn = 0;
      ctx.beginPath();
      ctx.moveTo(u * width, v * height);

      for (let step = 0; step < filament.steps; step++) {
        this._flowAt(u, v, aspect, filament.wobble + step * 0.04, flow);
        const bendWave = Math.sin(step * 0.43 + filament.wobble) * filament.bend;
        const directionX = flow.x - flow.y * aspect * bendWave;
        const directionY = flow.y + (flow.x / aspect) * bendWave;
        u += directionX * filament.step * filament.direction;
        v += directionY * filament.step * filament.direction;
        if (u < -0.08 || u > 1.08 || v < -0.04 || v > 1.04) break;
        if (this.mode.name === 'chromatic-wave') {
          this._mapTranceDomain(u, v, aspect, domain);
          if (!this._insideChromaticMass(domain.u, domain.v)) break;
        }
        if (this.mode.name === 'amoled-lava') {
          this._mapTranceDomain(u, v, aspect, domain);
          this._warpPoint(domain.u, domain.v, aspect, warped);
          if (this._lavaMask(domain.u, domain.v, warped, aspect) < 0.08) break;
        }
        ctx.lineTo(u * width, v * height);
        drawn++;
      }

      if (drawn < 3) continue;
      const paletteIndex = Math.floor(filament.phase * this.palette.length) % this.palette.length;
      const color = this.palette[paletteIndex];
      const lightness = clamp(color.l + 12 + filament.toneShift, 22, 88);
      ctx.strokeStyle = `hsla(${color.h}, ${color.s}%, ${lightness}%, ${filament.alpha})`;
      ctx.lineWidth = filament.width * filament.widthPulse * lineScale;
      ctx.stroke();
    }
    ctx.restore();
  }

  _renderLavaLensAccents(ctx, width, height) {
    const aspect = height / Math.max(1, width);
    const lineScale = Math.max(0.75, width / 540);
    const candidates = this.blobs
      .map((blob, index) => ({ blob, index }))
      .filter(({ blob }) => blob.radius >= 0.085)
      .sort((first, second) => second.blob.radius - first.blob.radius)
      .slice(0, 6);
    let markCount = 0;

    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.75;
    ctx.filter = `blur(${clamp(lineScale * 0.72, 0.45, 1.35).toFixed(2)}px)`;

    for (const { blob, index } of candidates) {
      const centerX = blob.x * width;
      const centerY = (blob.y / aspect) * height;
      const radiusX = blob.radius * width * 0.52;
      const radiusY = radiusX * blob.stretch;
      const paletteIndex = (
        this.paletteBandOffset + index * 3 + 1
      ) % this.palette.length;
      const color = this.palette[paletteIndex];

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(blob.rotation);

      const lens = ctx.createRadialGradient(
        -radiusX * 0.27,
        -radiusY * 0.31,
        0,
        0,
        0,
        Math.max(radiusX, radiusY)
      );
      lens.addColorStop(0, `hsla(${(color.h + 34) % 360}, 78%, 82%, 0.42)`);
      lens.addColorStop(0.34, `hsla(${color.h}, 72%, 58%, 0.18)`);
      lens.addColorStop(0.76, `hsla(${(color.h + 185) % 360}, 70%, 34%, 0.11)`);
      lens.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = lens;
      ctx.beginPath();
      ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, TAU);
      ctx.fill();
      markCount++;

      ctx.strokeStyle = `hsla(${(color.h + 24) % 360}, 70%, 88%, 0.20)`;
      ctx.lineWidth = (0.68 + blob.radius * 2.4) * lineScale;
      ctx.beginPath();
      ctx.ellipse(
        -radiusX * 0.04,
        -radiusY * 0.03,
        radiusX * 0.78,
        radiusY * 0.78,
        0,
        Math.PI * 1.08,
        Math.PI * 1.72
      );
      ctx.stroke();
      markCount++;

      ctx.strokeStyle = `hsla(${(color.h + 188) % 360}, ${Math.min(color.s, 84)}%, ${clamp(color.l + 5, 38, 72)}%, 0.12)`;
      ctx.lineWidth = (0.46 + blob.radius * 1.5) * lineScale;
      ctx.beginPath();
      ctx.ellipse(
        radiusX * 0.03,
        radiusY * 0.04,
        radiusX * 0.64,
        radiusY * 0.64,
        0,
        Math.PI * 0.10,
        Math.PI * 0.73
      );
      ctx.stroke();
      markCount++;
      ctx.restore();
    }

    ctx.restore();
    return markCount;
  }

  _renderChromaticRakeAccents(ctx, width, height) {
    const random = new SeededRandom(this.seed ^ 0x51ed270b);
    const lineScale = Math.max(0.75, width / 540);
    const gestureCount = 4 + (this.seed % 3);
    let markCount = 0;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'overlay';
    ctx.filter = `blur(${clamp(lineScale * 0.58, 0.4, 1.1).toFixed(2)}px)`;

    for (let gesture = 0; gesture < gestureCount; gesture++) {
      const startX = random.range(-0.10, 0.72) * width;
      const startY = random.range(0.34, 0.96) * height;
      const endX = startX + random.range(0.34, 0.78) * width;
      const endY = startY + random.range(-0.20, 0.17) * height;
      const lift = random.range(-0.26, 0.24) * height;
      const controlOneX = lerp(startX, endX, 0.31);
      const controlOneY = startY + lift;
      const controlTwoX = lerp(startX, endX, 0.72);
      const controlTwoY = endY - lift * 0.62;
      const paletteIndex = (
        this.paletteBandOffset + gesture * 2 + Math.floor(random.range(0, 3))
      ) % this.palette.length;
      const color = this.palette[paletteIndex];
      const strandCount = 3 + (gesture % 2);
      const spacing = random.range(2.1, 4.4) * lineScale;
      const spectralThread = ctx.createLinearGradient(startX, startY, endX, endY);
      spectralThread.addColorStop(0, `hsla(${color.h}, ${Math.min(color.s, 86)}%, ${clamp(color.l + 18, 54, 84)}%, 0.26)`);
      spectralThread.addColorStop(0.48, `hsla(${(color.h + 52) % 360}, ${Math.min(color.s, 90)}%, ${clamp(color.l + 11, 48, 78)}%, 0.22)`);
      spectralThread.addColorStop(1, `hsla(${(color.h + 348) % 360}, ${Math.min(color.s, 88)}%, ${clamp(color.l + 20, 56, 86)}%, 0.25)`);

      for (let strand = 0; strand < strandCount; strand++) {
        const offset = (strand - (strandCount - 1) * 0.5) * spacing;

        ctx.strokeStyle = 'rgba(4, 0, 18, 0.28)';
        ctx.lineWidth = random.range(2.4, 4.8) * lineScale;
        ctx.beginPath();
        ctx.moveTo(startX, startY + offset + lineScale);
        ctx.bezierCurveTo(
          controlOneX,
          controlOneY + offset,
          controlTwoX,
          controlTwoY + offset,
          endX,
          endY + offset
        );
        ctx.stroke();

        ctx.strokeStyle = spectralThread;
        ctx.lineWidth = random.range(0.65, 1.25) * lineScale;
        ctx.beginPath();
        ctx.moveTo(startX, startY + offset);
        ctx.bezierCurveTo(
          controlOneX,
          controlOneY + offset,
          controlTwoX,
          controlTwoY + offset,
          endX,
          endY + offset
        );
        ctx.stroke();
        markCount += 2;
      }
    }

    ctx.restore();
    return markCount;
  }

  _renderUltravioletVortexCoronas(ctx, width, height) {
    const aspect = height / Math.max(1, width);
    const lineScale = Math.max(0.75, width / 540);
    const focalVortices = this.vortices
      .map((vortex, index) => ({ vortex, index }))
      .filter(({ vortex }) => (
        vortex.x > -0.12
        && vortex.x < 1.12
        && vortex.y > -aspect * 0.08
        && vortex.y < aspect * 1.08
      ))
      .sort((first, second) => second.vortex.radius - first.vortex.radius)
      .slice(0, 6);
    let markCount = 0;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'screen';
    ctx.filter = `blur(${clamp(lineScale * 0.86, 0.55, 1.5).toFixed(2)}px)`;

    for (const { vortex, index } of focalVortices) {
      const centerX = vortex.x * width;
      const centerY = (vortex.y / aspect) * height;
      const radius = vortex.radius * width;
      const paletteIndex = (
        this.paletteBandOffset + index * 2
      ) % this.palette.length;
      const color = this.palette[paletteIndex];
      const direction = vortex.strength < 0 ? -1 : 1;
      const phase = fract(
        Math.abs(vortex.strength) * 0.173 + index * 0.271 + this.seed * 0.00031
      ) * TAU;

      for (let shell = 0; shell < 3; shell++) {
        const shellRadius = radius * (0.44 + shell * 0.24);
        const arcLength = Math.PI * (0.72 + shell * 0.18);
        const start = phase + shell * direction * 0.74;
        ctx.setLineDash([
          (4.2 + shell * 1.8) * lineScale,
          (5.4 + shell * 2.1) * lineScale
        ]);
        ctx.lineDashOffset = -phase * radius * 0.11;
        ctx.strokeStyle = `hsla(${(color.h + shell * 18) % 360}, ${Math.min(color.s, 92)}%, ${clamp(color.l + 14, 45, 76)}%, ${0.22 - shell * 0.032})`;
        ctx.lineWidth = (0.86 + shell * 0.22) * lineScale;
        ctx.beginPath();
        ctx.ellipse(
          centerX,
          centerY,
          shellRadius,
          shellRadius * (0.72 + shell * 0.08),
          vortex.strength * 0.18,
          start,
          start + arcLength,
          direction < 0
        );
        ctx.stroke();
        markCount++;
      }

      ctx.setLineDash([]);
      for (let needle = 0; needle < 4; needle++) {
        const angle = phase
          + needle * TAU / 4
          + direction * (0.16 + needle * 0.09);
        const innerRadius = radius * (0.10 + needle * 0.018);
        const outerRadius = radius * (0.27 + (needle % 2) * 0.055);
        ctx.strokeStyle = `hsla(${(color.h + 28 + needle * 11) % 360}, 100%, ${clamp(color.l + 20, 56, 84)}%, 0.14)`;
        ctx.lineWidth = (0.58 + (needle % 2) * 0.18) * lineScale;
        ctx.beginPath();
        ctx.moveTo(
          centerX + Math.cos(angle) * innerRadius,
          centerY + Math.sin(angle) * innerRadius
        );
        ctx.quadraticCurveTo(
          centerX + Math.cos(angle + direction * 0.18) * outerRadius * 0.72,
          centerY + Math.sin(angle + direction * 0.18) * outerRadius * 0.72,
          centerX + Math.cos(angle + direction * 0.31) * outerRadius,
          centerY + Math.sin(angle + direction * 0.31) * outerRadius
        );
        ctx.stroke();
        markCount++;
      }

      const eye = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius * 0.34
      );
      eye.addColorStop(0, `hsla(${color.h}, 100%, 72%, 0.22)`);
      eye.addColorStop(0.34, `hsla(${(color.h + 42) % 360}, 100%, 52%, 0.11)`);
      eye.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = eye;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.34, 0, TAU);
      ctx.fill();
      markCount++;
    }

    ctx.restore();
    return markCount;
  }

  _renderModeAccents(ctx, width, height) {
    if (this.mode.name === 'amoled-lava') {
      return {
        kind: 'lens-blooms',
        detail: 'refracted-crescents',
        marks: this._renderLavaLensAccents(ctx, width, height)
      };
    }
    if (this.mode.name === 'chromatic-wave') {
      return {
        kind: 'pearl-rakes',
        detail: 'spectral-threading',
        marks: this._renderChromaticRakeAccents(ctx, width, height)
      };
    }
    return {
      kind: 'vortex-coronas',
      detail: 'flux-needles',
      marks: this._renderUltravioletVortexCoronas(ctx, width, height)
    };
  }

  _renderTranceMandalaAccents(ctx, width, height) {
    const profile = this.tranceProfile;
    const centerX = width * this.tranceCenter.x;
    const centerY = height * this.tranceCenter.y;
    const outerRadius = width * 0.46;
    const lineScale = Math.max(0.72, width / 540);
    const rotation = (this.seed % 4096) / 4096 * TAU;
    let markCount = 0;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'overlay';
    ctx.filter = `blur(${clamp(lineScale * 0.52, 0.38, 1.15).toFixed(2)}px)`;

    if (profile.name === 'spiral-iris') {
      const steps = 84;
      for (let direction = -1; direction <= 1; direction += 2) {
        for (let arm = 0; arm < profile.symmetry; arm++) {
          const armReach = 0.76
            + 0.24 * (0.5 + 0.5 * Math.sin(arm * 2.17 + rotation * 3.1));
          const color = this.palette[
            (this.paletteBandOffset + arm * 2 + (direction > 0 ? 1 : 0))
            % this.palette.length
          ];
          ctx.beginPath();
          for (let step = 0; step <= steps; step++) {
            const progress = step / steps;
            const radius = outerRadius * (0.075 + progress * 0.91 * armReach);
            const angle = rotation
              + arm * TAU / profile.symmetry
              + direction * (0.22 + progress ** 1.34 * 2.15)
              + Math.sin(progress * TAU * 2 + arm) * 0.025;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            if (step === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `hsla(${color.h}, ${Math.min(color.s, 90)}%, ${clamp(color.l + 10, 42, 78)}%, 0.13)`;
          ctx.lineWidth = (direction < 0 ? 0.72 : 1.05) * lineScale;
          ctx.stroke();
          markCount++;
        }
      }
    } else if (profile.name === 'kaleido-lotus') {
      const ringCount = 4;
      for (let ring = 0; ring < ringCount; ring++) {
        const innerRadius = outerRadius * (0.08 + ring * 0.18);
        const petalLength = outerRadius * (0.19 + ring * 0.025);
        const petalWidth = outerRadius * (0.055 + ring * 0.008);
        const ringRotation = rotation + ring * Math.PI / profile.symmetry;
        const color = this.palette[
          (this.paletteBandOffset + ring * 2) % this.palette.length
        ];

        for (let petal = 0; petal < profile.symmetry; petal++) {
          const angle = ringRotation + petal * TAU / profile.symmetry;
          const petalReach = 0.78
            + 0.22 * (0.5 + 0.5 * Math.sin(petal * 1.91 + ring * 1.37 + rotation));
          const cosine = Math.cos(angle);
          const sine = Math.sin(angle);
          const sideX = -sine * petalWidth;
          const sideY = cosine * petalWidth;
          const rootX = centerX + cosine * innerRadius;
          const rootY = centerY + sine * innerRadius;
          const tipX = centerX + cosine * (innerRadius + petalLength * petalReach);
          const tipY = centerY + sine * (innerRadius + petalLength * petalReach);

          ctx.beginPath();
          ctx.moveTo(rootX, rootY);
          ctx.bezierCurveTo(
            rootX + sideX,
            rootY + sideY,
            tipX + sideX * 0.62,
            tipY + sideY * 0.62,
            tipX,
            tipY
          );
          ctx.bezierCurveTo(
            tipX - sideX * 0.62,
            tipY - sideY * 0.62,
            rootX - sideX,
            rootY - sideY,
            rootX,
            rootY
          );
          ctx.closePath();
          ctx.fillStyle = `hsla(${(color.h + petal * 5) % 360}, ${Math.min(color.s, 88)}%, ${clamp(color.l + 8, 38, 76)}%, 0.045)`;
          ctx.strokeStyle = `hsla(${(color.h + 24) % 360}, 82%, ${clamp(color.l + 16, 50, 82)}%, 0.12)`;
          ctx.lineWidth = (0.68 + ring * 0.11) * lineScale;
          ctx.fill();
          ctx.stroke();
          markCount += 2;
        }
      }
    } else {
      const ringCount = 15;
      ctx.setLineDash([4.4 * lineScale, 5.8 * lineScale]);
      for (let ring = 0; ring < ringCount; ring++) {
        const progress = ring / Math.max(1, ringCount - 1);
        const radius = outerRadius * (0.075 + progress * 0.91);
        const orbit = rotation + ring * 0.52;
        const offsetX = outerRadius * 0.11 * Math.sin(ring * 1.7 + rotation);
        const offsetY = outerRadius * 0.075 * Math.cos(ring * 1.13 - rotation * 0.7);
        const color = this.palette[
          (this.paletteBandOffset + ring * 2) % this.palette.length
        ];
        ctx.lineDashOffset = -ring * 2.3 * lineScale;
        ctx.strokeStyle = `hsla(${(color.h + ring * 7) % 360}, ${Math.min(color.s, 92)}%, ${clamp(color.l + 12, 44, 80)}%, ${0.16 - progress * 0.055})`;
        ctx.lineWidth = (0.72 + (ring % 3) * 0.23) * lineScale;
        ctx.beginPath();
        ctx.ellipse(
          centerX + offsetX,
          centerY + offsetY,
          radius,
          radius * (0.82 + Math.sin(ring * 0.91) * 0.06),
          orbit * 0.28,
          0,
          TAU
        );
        ctx.stroke();
        markCount++;
      }
      ctx.setLineDash([]);
    }

    const coreColor = this.palette[
      (this.paletteBandOffset + 2) % this.palette.length
    ];
    const core = ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      outerRadius * 0.18
    );
    core.addColorStop(0, `hsla(${coreColor.h}, 88%, 82%, 0.18)`);
    core.addColorStop(0.32, `hsla(${(coreColor.h + 48) % 360}, 90%, 58%, 0.095)`);
    core.addColorStop(0.68, 'rgba(0, 0, 0, 0.035)');
    core.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius * 0.18, 0, TAU);
    ctx.fill();
    markCount++;

    ctx.restore();
    return {
      kind: profile.accent,
      symmetry: profile.symmetry,
      marks: markCount
    };
  }

  _renderBlobDripContours(ctx, width, height) {
    if (this.mode.name !== 'amoled-lava' || this.blobs.length === 0) return 0;

    const aspect = height / Math.max(1, width);
    const lineScale = Math.max(0.8, width / 540);
    const blurRadius = clamp(1.15 * lineScale, 0.9, 2.2);
    const blobLimit = Math.min(this.blobs.length, 8);
    const contourCanvas = createCanvas(width, height);
    const contourCtx = contourCanvas.getContext('2d');
    const maskThreshold = (
      this.lavaDirection.maskStart + this.lavaDirection.maskEnd
    ) * 0.5;
    let strokeCount = 0;

    contourCtx.lineCap = 'round';
    contourCtx.lineJoin = 'round';
    contourCtx.filter = `blur(${blurRadius.toFixed(2)}px)`;

    const traceBlobPath = (blob, expansion, dripDepth = 0) => {
      const cosine = blob._cosine ?? Math.cos(blob.rotation);
      const sine = blob._sine ?? Math.sin(blob.rotation);
      const centerX = blob.x * width;
      const centerY = (blob.y / aspect) * height;
      const pointCount = 72;

      contourCtx.beginPath();
      for (let point = 0; point <= pointCount; point++) {
        const angle = point / pointCount * TAU;
        const angleCosine = Math.cos(angle);
        const angleSine = Math.sin(angle);
        const organicRadius = 1
          + Math.sin(angle * blob.lobes + blob.phase) * blob.wobble
          + Math.sin(
            angle * (blob.lobes + 2) - blob.phase * 0.63
          ) * blob.wobble * 0.42;
        const localX = angleCosine
          * blob.radius
          * organicRadius
          * expansion;
        const localY = angleSine
          * blob.radius
          * blob.stretch
          * organicRadius
          * expansion;
        const lowerArc = Math.max(0, angleSine);
        const dripRhythm = 0.72
          + Math.cos(angle * (blob.lobes + 1) + blob.phase) * 0.28;
        const drip = blob.radius
          * dripDepth
          * lowerArc ** 5
          * dripRhythm;
        const worldX = centerX + (localX * cosine - localY * sine) * width;
        const worldY = centerY
          + (localX * sine + localY * cosine + drip) * width;

        if (point === 0) contourCtx.moveTo(worldX, worldY);
        else contourCtx.lineTo(worldX, worldY);
      }
      contourCtx.closePath();
    };

    for (let blobIndex = 0; blobIndex < blobLimit; blobIndex++) {
      const blob = this.blobs[blobIndex];
      const shellCount = 2 + ((this.seed + blobIndex) % 3);
      const isolatedBoundary = Math.sqrt(Math.max(
        0.01,
        -Math.log(clamp(maskThreshold / blob.weight, 0.01, 0.98)) / 1.35
      ));
      const boundaryExpansion = clamp(isolatedBoundary, 0.58, 0.88);

      contourCtx.save();
      traceBlobPath(blob, boundaryExpansion);
      contourCtx.clip();

      for (let shell = 0; shell < shellCount; shell++) {
        const expansion = boundaryExpansion * (0.86 - shell * 0.16);
        const paletteIndex = (
          this.paletteBandOffset
          + blobIndex * 3
          + shell * 2
        ) % this.palette.length;
        const color = this.palette[paletteIndex];
        const alpha = 0.13 - shell * 0.022;

        traceBlobPath(blob, expansion, 0.055 + shell * 0.018);
        contourCtx.strokeStyle = `hsla(${color.h}, ${Math.min(color.s, 82)}%, ${clamp(color.l, 28, 72)}%, ${alpha})`;
        contourCtx.lineWidth = (0.72 + (shellCount - shell) * 0.20) * lineScale;
        contourCtx.stroke();
        strokeCount++;
      }

      contourCtx.restore();
    }

    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.globalCompositeOperation = 'overlay';
    ctx.drawImage(contourCanvas, 0, 0);
    ctx.restore();
    return strokeCount;
  }

  _renderLavaDirectionAccents(ctx, width, height) {
    if (this.mode.name !== 'amoled-lava' || this.blobs.length === 0) {
      return { kind: 'none', marks: 0 };
    }

    const aspect = height / Math.max(1, width);
    const lineScale = Math.max(0.75, width / 540);
    const candidates = this.blobs
      .map((blob, index) => ({ blob, index }))
      .filter(({ blob }) => (
        blob.radius >= (this.lavaDirection.name === 'rise' ? 0.12 : 0.075)
      ))
      .sort((first, second) => second.blob.radius - first.blob.radius)
      .slice(0, this.lavaDirection.name === 'rise' ? 7 : 6);
    let markCount = 0;

    const traceOrganicPath = (target, blob, scale = 0.82) => {
      const pointCount = 52;
      target.beginPath();
      for (let point = 0; point <= pointCount; point++) {
        const angle = point / pointCount * TAU;
        const organicRadius = 1
          + Math.sin(angle * blob.lobes + blob.phase) * blob.wobble
          + Math.sin(angle * (blob.lobes + 2) - blob.phase * 0.63)
            * blob.wobble * 0.42;
        const x = Math.cos(angle) * blob.radius * organicRadius * scale * width;
        const y = Math.sin(angle) * blob.radius * blob.stretch
          * organicRadius * scale * width;
        if (point === 0) target.moveTo(x, y);
        else target.lineTo(x, y);
      }
      target.closePath();
    };

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'overlay';

    for (const { blob, index } of candidates) {
      const radiusX = blob.radius * width;
      const radiusY = radiusX * blob.stretch;
      const color = this.palette[
        (this.paletteBandOffset + index * 3 + 2) % this.palette.length
      ];

      ctx.save();
      ctx.translate(blob.x * width, (blob.y / aspect) * height);
      ctx.rotate(blob.rotation);
      const clipScale = this.lavaDirection.name === 'rise'
        ? 0.68
        : this.lavaDirection.name === 'drift'
          ? 0.72
          : 0.74;
      traceOrganicPath(ctx, blob, clipScale);
      const cosine = blob._cosine ?? Math.cos(blob.rotation);
      const sine = blob._sine ?? Math.sin(blob.rotation);
      for (const hole of this.blobHoles) {
        const worldX = (hole.x - blob.x) * width;
        const worldY = (hole.y - blob.y) * width;
        const localX = worldX * cosine + worldY * sine;
        const localY = -worldX * sine + worldY * cosine;
        const normalizedDistance = Math.hypot(
          localX / Math.max(1, radiusX),
          localY / Math.max(1, radiusY)
        );
        if (normalizedDistance > clipScale) continue;
        const holeRadius = hole.radius * width * 2.4;
        ctx.moveTo(localX + holeRadius, localY);
        ctx.ellipse(localX, localY, holeRadius, holeRadius, 0, 0, TAU);
      }
      ctx.clip('evenodd');

      if (this.lavaDirection.name === 'drift') {
        ctx.filter = `blur(${clamp(lineScale * 0.42, 0.28, 0.85).toFixed(2)}px)`;
        for (let ribbon = -2; ribbon <= 2; ribbon++) {
          const offset = ribbon * radiusY * 0.19;
          const bend = Math.sin(blob.phase + ribbon * 1.7) * radiusY * 0.24;
          ctx.strokeStyle = `hsla(${(color.h + ribbon * 5 + 360) % 360}, ${Math.min(color.s, 88)}%, ${clamp(color.l + 15, 48, 82)}%, 0.16)`;
          ctx.lineWidth = (0.72 + (2 - Math.abs(ribbon)) * 0.19) * lineScale;
          ctx.beginPath();
          ctx.moveTo(-radiusX, offset - bend * 0.24);
          ctx.bezierCurveTo(
            -radiusX * 0.42,
            offset + bend,
            radiusX * 0.34,
            offset - bend,
            radiusX,
            offset + bend * 0.28
          );
          ctx.stroke();
          markCount++;
        }
      } else if (this.lavaDirection.name === 'rise') {
        ctx.globalCompositeOperation = 'screen';
        ctx.filter = `blur(${clamp(lineScale * 0.34, 0.24, 0.72).toFixed(2)}px)`;
        const pearlCount = 4 + (index % 3);
        for (let pearl = 0; pearl < pearlCount; pearl++) {
          const progress = pearl / Math.max(1, pearlCount - 1);
          const y = lerp(radiusY * 0.56, -radiusY * 0.58, progress);
          const x = Math.sin(blob.phase + pearl * 1.43) * radiusX * 0.22;
          const size = radiusX * (0.055 + progress * 0.035);
          ctx.strokeStyle = `hsla(${(color.h + pearl * 7) % 360}, ${Math.min(color.s, 84)}%, ${clamp(color.l + 20, 58, 88)}%, ${0.11 + progress * 0.045})`;
          ctx.lineWidth = (0.62 + progress * 0.28) * lineScale;
          ctx.beginPath();
          ctx.ellipse(x, y, size, size * 0.72, 0, 0, TAU);
          ctx.stroke();
          markCount++;
        }
      } else {
        ctx.filter = `blur(${clamp(lineScale * 0.30, 0.20, 0.66).toFixed(2)}px)`;
        for (let shore = 0; shore < 4; shore++) {
          const scale = 0.72 - shore * 0.125;
          ctx.setLineDash([
            (4.5 + shore * 1.4) * lineScale,
            (2.8 + (3 - shore) * 1.2) * lineScale
          ]);
          ctx.lineDashOffset = (blob.phase + shore * 2.3) * lineScale;
          ctx.strokeStyle = `hsla(${(color.h + shore * 9) % 360}, ${Math.min(color.s, 86)}%, ${clamp(color.l + 10 - shore * 3, 38, 76)}%, ${0.17 - shore * 0.018})`;
          ctx.lineWidth = (0.70 + shore * 0.12) * lineScale;
          traceOrganicPath(ctx, blob, scale);
          ctx.stroke();
          markCount++;
        }
        ctx.setLineDash([]);
      }

      ctx.restore();
    }

    ctx.restore();
    return { kind: this.lavaDirection.accent, marks: markCount };
  }

  async render(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    this._renderRaster(ctx, width, height);
    this._renderModeAccents(ctx, width, height);
    if (this.tranceAccentsEnabled) {
      this._renderTranceMandalaAccents(ctx, width, height);
    }
    this._renderLavaDirectionAccents(ctx, width, height);
    this._renderBlobDripContours(ctx, width, height);
    this._renderFilaments(ctx, width, height);
    ctx.restore();
  }
}
