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
    stirAmount: 0.30,
    maskStart: 0.39,
    maskEnd: 0.60,
    contourScale: 1,
    microScale: 1,
    filamentFactor: 1
  },
  rise: {
    name: 'rise',
    stirAmount: 0.22,
    maskStart: 0.34,
    maskEnd: 0.56,
    contourScale: 0.78,
    microScale: 0.84,
    filamentFactor: 0.82
  },
  islands: {
    name: 'islands',
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
    this.contourWarps = [];
    this.contourDrift = null;
    this.contourLayers = [];
    this.blobs = [];
    this.filaments = [];
    this.palette = [];
    this.colorway = 'ultraviolet';
    this.lavaDirection = LAVA_DIRECTIONS.drift;
    this.paletteRgb = [];
    this.paletteBandOffset = 0;
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

    const random = new SeededRandom(this.seed);
    this._generateVortices(random);
    this._generateBlobs(random);
    this._generateDistortionTwirls(new SeededRandom(this.seed ^ 0x27d4eb2d));
    this._generateContourWarps(new SeededRandom(this.seed ^ 0x9e3779b9));
    this._generateContourLayers(new SeededRandom(this.seed ^ 0x85ebca6b));
    this._generateFilaments(random);
  }

  async process() {
    // Plasmo is a frozen fluid state. Its motion is baked into the advected
    // coordinate field, keeping a seed repeatable across CLI and gallery runs.
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

  _makeBlob(random, overrides = {}) {
    return {
      x: random.range(0.04, 0.96),
      y: random.range(0.04, 0.96),
      radius: random.range(0.055, 0.145),
      stretch: random.range(0.82, 2.15),
      weight: random.range(0.78, 1.12),
      rotation: random.range(-Math.PI, Math.PI),
      phase: random.range(0, TAU),
      lobes: Math.floor(random.range(2, 6)),
      wobble: random.range(0.045, 0.17),
      ...overrides
    };
  }

  _blobInfluence(u, v, aspect, warped = null) {
    const stirAmount = this.lavaDirection.stirAmount;
    const x = warped
      ? (warped.massX ?? lerp(u, warped.x, stirAmount))
      : u;
    const y = warped
      ? (warped.massY ?? lerp(v * aspect, warped.y, stirAmount))
      : v * aspect;
    let influence = 0;

    for (const blob of this.blobs) {
      const offsetX = x - blob.x;
      const offsetY = y - blob.y;
      const cosine = Math.cos(blob.rotation);
      const sine = Math.sin(blob.rotation);
      const localX = offsetX * cosine + offsetY * sine;
      const localY = -offsetX * sine + offsetY * cosine;
      const angle = Math.atan2(localY / blob.stretch, localX);
      const organicRadius = 1
        + Math.sin(angle * blob.lobes + blob.phase) * blob.wobble
        + Math.sin(angle * (blob.lobes + 2) - blob.phase * 0.63) * blob.wobble * 0.42;
      const dx = localX / (blob.radius * organicRadius);
      const dy = localY / (blob.radius * blob.stretch * organicRadius);
      const distanceSquared = dx * dx + dy * dy;
      influence += Math.exp(-distanceSquared * 1.35) * blob.weight;
    }
    return influence;
  }

  _insideLavaMass(x, y) {
    const aspect = this.height / Math.max(1, this.width);
    const threshold = (this.lavaDirection.maskStart + this.lavaDirection.maskEnd) * 0.5;
    return this._blobInfluence(x, y, aspect) > threshold;
  }

  _generateFilaments(random) {
    const area = this.width * this.height;
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
            ? this._insideChromaticMass(x, y)
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

  _warpPoint(u, v, aspect) {
    let x = u;
    let y = v * aspect;

    for (const vortex of this.vortices) {
      const dx = x - vortex.x;
      const dy = y - vortex.y;
      const radiusSquared = vortex.radius * vortex.radius;
      const distanceSquared = dx * dx + dy * dy;
      const influence = Math.exp(-distanceSquared / Math.max(0.0001, radiusSquared * 1.75));
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
      const axisCosine = Math.cos(warp.rotation);
      const axisSine = Math.sin(warp.rotation);
      const localX = offsetX * axisCosine + offsetY * axisSine;
      const localY = (-offsetX * axisSine + offsetY * axisCosine) / warp.stretch;
      const distanceSquared = (localX * localX + localY * localY)
        / Math.max(0.0001, warp.radius * warp.radius);
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

    // Local distortion fields can turn as far as one full revolution in
    // either direction. Their twist rate begins at a seeded point on a sine
    // wave, then oscillates radially before fading continuously at the edge.
    for (const twirl of this.distortionTwirls) {
      const offsetX = x - twirl.x;
      const offsetY = y - twirl.y;
      const distanceSquared = offsetX * offsetX + offsetY * offsetY;
      const radiusSquared = twirl.radius * twirl.radius;
      if (distanceSquared >= radiusSquared) continue;

      const radialPosition = Math.sqrt(distanceSquared / radiusSquared);
      const envelope = 1 - smoothstep(0.38, 1, radialPosition);
      const sineRate = 0.5 + 0.5 * Math.sin(
        twirl.ratePhase + radialPosition * TAU * twirl.rateCycles
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
            twirl.ratePhase + massRadialPosition * TAU * twirl.rateCycles
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

    return { x, y, massX, massY, broad, curl };
  }

  _contourCharacter(u, v, warped) {
    const drift = this.contourDrift;
    const directionX = Math.cos(drift.angle);
    const directionY = Math.sin(drift.angle);
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

    return {
      thickness: clamp(
        0.55 + thicknessNoise * 0.88 + meander * 0.13,
        0.48,
        1.52
      ),
      value: clamp(
        0.68 + valueNoise * 0.48 + crossCurrent * 0.08,
        0.66,
        1.18
      ),
      spacing: clamp(
        0.87 + valueNoise * 0.19 + meander * 0.055,
        0.82,
        1.12
      ),
      phase: (thicknessNoise - 0.5) * 0.040
        + crossCurrent * 0.009
    };
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
    contour
  ) {
    let totalStrength = 0;
    let maximumStrength = 0;
    let weightedRed = 0;
    let weightedGreen = 0;
    let weightedBlue = 0;
    let activeCount = 0;
    let maximumDivergence = 0;

    for (let index = 0; index < this.contourLayers.length; index++) {
      const layer = this.contourLayers[index];
      const directionX = Math.cos(layer.angle);
      const directionY = Math.sin(layer.angle);
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
      const layerColor = this._samplePalette(
        palettePosition
        + layer.paletteShift
        + Math.sin(along * TAU * 0.43 + layer.secondaryPhase) * 0.018
      );
      weightedRed += layerColor.r * valueDrift * lineStrength;
      weightedGreen += layerColor.g * valueDrift * lineStrength;
      weightedBlue += layerColor.b * valueDrift * lineStrength;
      totalStrength += lineStrength;
      maximumStrength = Math.max(maximumStrength, lineStrength);
    }

    const strength = clamp(maximumStrength * 0.82 + totalStrength * 0.34, 0, 1);
    const colorWeight = Math.max(0.0001, totalStrength);
    return {
      strength,
      coverage: clamp(totalStrength * 0.74, 0, 1),
      color: {
        r: weightedRed / colorWeight,
        g: weightedGreen / colorWeight,
        b: weightedBlue / colorWeight
      },
      activeCount,
      maximumDivergence
    };
  }

  _flowAt(u, v, aspect, phase = 0) {
    const x = u;
    const y = v * aspect;
    let vx = this.mode.baseFlow.x;
    let vy = this.mode.baseFlow.y;

    for (const vortex of this.vortices) {
      const dx = x - vortex.x;
      const dy = y - vortex.y;
      const distance = Math.hypot(dx, dy) || 0.0001;
      const influence = Math.exp(-(distance * distance) / Math.max(0.0001, vortex.radius * vortex.radius * 2.2));
      const tangent = vortex.strength * influence;
      vx += (-dy / distance) * tangent;
      vy += (dx / distance) * tangent;
    }

    vx += Math.sin(y * 3.1 + phase) * 0.14;
    vy += Math.cos(x * 4.3 - phase * 0.7) * 0.11;
    const magnitude = Math.hypot(vx, vy) || 1;
    return { x: vx / magnitude, y: (vy / magnitude) / aspect };
  }

  _samplePalette(position) {
    const scaled = fract(position) * this.paletteRgb.length;
    const index = Math.floor(scaled);
    const next = (index + 1) % this.paletteRgb.length;
    const amount = smoothstep(0.28, 0.72, scaled - index);
    const first = this.paletteRgb[index];
    const second = this.paletteRgb[next];
    return {
      r: lerp(first.r, second.r, amount),
      g: lerp(first.g, second.g, amount),
      b: lerp(first.b, second.b, amount)
    };
  }

  _lineStrength(value, frequency, width) {
    const position = fract(value * frequency);
    const distance = Math.min(position, 1 - position);
    return 1 - smoothstep(width, width * 2.4, distance);
  }

  _antialiasHighContrastEdges(image, width, height) {
    const source = new Uint8ClampedArray(image.data);
    const luminanceAt = (offset) => (
      source[offset] * 54
      + source[offset + 1] * 183
      + source[offset + 2] * 19
    ) / 256;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const center = (y * width + x) * 4;
        const left = center - 4;
        const right = center + 4;
        const top = center - width * 4;
        const bottom = center + width * 4;
        const topLeft = top - 4;
        const topRight = top + 4;
        const bottomLeft = bottom - 4;
        const bottomRight = bottom + 4;
        const centerLuminance = luminanceAt(center);
        const leftLuminance = luminanceAt(left);
        const rightLuminance = luminanceAt(right);
        const topLuminance = luminanceAt(top);
        const bottomLuminance = luminanceAt(bottom);
        const topLeftLuminance = luminanceAt(topLeft);
        const topRightLuminance = luminanceAt(topRight);
        const bottomLeftLuminance = luminanceAt(bottomLeft);
        const bottomRightLuminance = luminanceAt(bottomRight);
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
        if (maximumLuminance - minimumLuminance < 34) continue;

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

  _lavaFieldValue(u, v, warped, aspect) {
    const influence = this._blobInfluence(u, v, aspect, warped);
    const stir = (warped.broad - 0.5) * 0.12 + (warped.curl - 0.5) * 0.075;
    return influence + stir;
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

    for (let y = 0; y < fieldHeight; y++) {
      const v = y / Math.max(1, fieldHeight - 1);
      for (let x = 0; x < fieldWidth; x++) {
        const u = x / Math.max(1, fieldWidth - 1);
        const index = y * fieldWidth + x;
        const warped = this._warpPoint(u, v, aspect);
        const contour = this._contourCharacter(u, v, warped);
        const secondary = this.noise.fbm(
          warped.x * 5.6 + warped.broad * 1.8,
          warped.y * 5.1 - warped.curl * 1.5,
          2
        );

        scalar[index] = (
          warped.x * 0.83
          + warped.y * 0.17
          + warped.broad * 0.74
          + warped.curl * 0.27
          + secondary * 0.12
        ) * this.mode.bandScale;
        texture[index] = clamp(
          0.60
          + (warped.broad - 0.5) * 0.30
          + (secondary - 0.5) * 0.24,
          0.40,
          0.96
        );
        contourThickness[index] = contour.thickness;
        contourValue[index] = contour.value;
        contourSpacing[index] = contour.spacing;
        contourPhase[index] = contour.phase;
        if (this.mode.name === 'chromatic-wave') {
          mask[index] = this._chromaticMask(u, v, warped);
          softMask[index] = mask[index];
        } else if (this.mode.name === 'amoled-lava') {
          const lavaValue = this._lavaFieldValue(u, v, warped, aspect);
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
      contourPhase
    };
  }

  _renderRaster(ctx, width, height) {
    const field = this._buildPaintField(width, height);
    const raster = createCanvas(field.width, field.height);
    const rasterCtx = raster.getContext('2d');
    const image = rasterCtx.createImageData(field.width, field.height);

    for (let y = 0; y < field.height; y++) {
      const v = y / Math.max(1, field.height - 1);
      for (let x = 0; x < field.width; x++) {
        const u = x / Math.max(1, field.width - 1);
        const index = y * field.width + x;
        const output = index * 4;
        const value = field.scalar[index];
        const mask = field.mask[index];
        const contourScale = this.mode.name === 'amoled-lava'
          ? this.lavaDirection.contourScale
          : 1;
        const microScale = this.mode.name === 'amoled-lava'
          ? this.lavaDirection.microScale
          : 1;
        const naturalCadence = 0.5
          + 0.5 * Math.sin((u * 2.7 + v * 1.9 + field.texture[index] * 1.35) * TAU);
        const spacingVariation = (0.88 + naturalCadence * 0.22)
          * field.contourSpacing[index];
        const widthVariation = (0.76 + field.texture[index] * 0.38)
          * field.contourThickness[index];
        const lineDrift = (field.texture[index] - 0.66) * 0.018
          + Math.sin((u * 1.7 - v * 2.3) * TAU) * 0.004
          + field.contourPhase[index];
        const contourFrequency = this.mode.contourFrequency
          * contourScale
          * spacingVariation;
        const seamValue = value + lineDrift * 0.45;
        const contourCoordinate = seamValue * contourFrequency;
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
          Math.floor(contourCoordinate)
          + this.paletteBandOffset
          + fillProgress
        ) / this.paletteRgb.length;
        const contourBundle = this._contourBundle(
          u,
          v,
          value + 0.017,
          contourFrequency,
          this.mode.primaryWidth,
          widthVariation,
          lineDrift,
          palettePosition,
          {
            thickness: field.contourThickness[index],
            value: field.contourValue[index],
            spacing: field.contourSpacing[index],
            phase: field.contourPhase[index]
          }
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
        const color = this._samplePalette(palettePosition);
        color.r = lerp(color.r, contourBundle.color.r, contourBundle.coverage * 0.72);
        color.g = lerp(color.g, contourBundle.color.g, contourBundle.coverage * 0.72);
        color.b = lerp(color.b, contourBundle.color.b, contourBundle.coverage * 0.72);
        let contourLight = 1;

        if (this.mode.name === 'chromatic-wave') {
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
          const fadeWave = 0.5 + 0.5 * Math.sin(
            (u * 0.68 + v * 0.43) * TAU
            + (this.seed % 997) * 0.017
          );
          const fadeRegion = smoothstep(
            0.56,
            0.84,
            fadeWave * 0.68 + field.texture[index] * 0.32
          );
          const visibleMask = lerp(mask, field.softMask[index], fadeRegion * 0.82);
          if (visibleMask < 0.006) {
            color.r = 0;
            color.g = 0;
            color.b = 0;
          } else {
            const leftMask = field.mask[y * field.width + Math.max(0, x - 1)];
            const rightMask = field.mask[y * field.width + Math.min(field.width - 1, x + 1)];
            const topMask = field.mask[Math.max(0, y - 1) * field.width + x];
            const bottomMask = field.mask[Math.min(field.height - 1, y + 1) * field.width + x];
            const normalX = leftMask - rightMask;
            const normalY = topMask - bottomMask;
            const normalLength = Math.hypot(normalX, normalY) || 1;
            const directionalLight = clamp(
              0.5 + (normalX * -0.58 + normalY * -0.82) / normalLength * 0.5,
              0,
              1
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
            const fadingBodyMask = smoothstep(0.008, 0.58, visibleMask);
            const bodyMask = lerp(crispBodyMask, fadingBodyMask, fadeRegion);
            color.r *= seamShade * bodyMask;
            color.g *= seamShade * bodyMask;
            color.b *= seamShade * bodyMask;

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

            const edgeShade = edgeBand * (1 - directionalLight) * 0.32;
            color.r *= 1 - edgeShade;
            color.g *= 1 - edgeShade;
            color.b *= 1 - edgeShade;

            const bevelHighlight = edgeBand
              * smoothstep(0.48, 0.94, directionalLight)
              * (0.30 + field.texture[index] * 0.12);
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

          const edgeGlow = Math.exp(-(1 - u) * 9.2);
          const edgeHue = v < 0.55 ? { r: 255, g: 0, b: 168 } : { r: 18, g: 46, b: 255 };
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

        const valueDrift = (field.contourValue[index] - 0.66) / 0.52;
        const naturalValue = this.mode.name === 'ultraviolet-current'
          ? (contourLight < 0.12
            ? lerp(0.62, 0.82, valueDrift)
            : lerp(1.08, 1.55, valueDrift))
          : field.contourValue[index];
        color.r *= naturalValue;
        color.g *= naturalValue;
        color.b *= naturalValue;
        image.data[output] = Math.round(clamp(color.r, 0, 255));
        image.data[output + 1] = Math.round(clamp(color.g, 0, 255));
        image.data[output + 2] = Math.round(clamp(color.b, 0, 255));
        image.data[output + 3] = 255;
      }
    }

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

    for (const filament of this.filaments) {
      let u = filament.x;
      let v = filament.y;
      let drawn = 0;
      ctx.beginPath();
      ctx.moveTo(u * width, v * height);

      for (let step = 0; step < filament.steps; step++) {
        const flow = this._flowAt(u, v, aspect, filament.wobble + step * 0.04);
        const bendWave = Math.sin(step * 0.43 + filament.wobble) * filament.bend;
        const directionX = flow.x - flow.y * aspect * bendWave;
        const directionY = flow.y + (flow.x / aspect) * bendWave;
        u += directionX * filament.step * filament.direction;
        v += directionY * filament.step * filament.direction;
        if (u < -0.08 || u > 1.08 || v < -0.04 || v > 1.04) break;
        if (this.mode.name === 'chromatic-wave' && !this._insideChromaticMass(u, v)) break;
        if (this.mode.name === 'amoled-lava') {
          const warped = this._warpPoint(u, v, aspect);
          if (this._lavaMask(u, v, warped, aspect) < 0.08) break;
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

  async render(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    this._renderRaster(ctx, width, height);
    this._renderFilaments(ctx, width, height);
    ctx.restore();
  }
}
