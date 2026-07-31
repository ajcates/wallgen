import { Style } from '../core/Style.js';
import { mapRange, randomRange } from '../utils/math.js';
import * as canvasUtils from '../utils/canvas.js';
import { createCanvas } from '@napi-rs/canvas';

/**
 * BeveledCircuitsStyle: A premium generative style that renders beveled,
 * embossed, and grooved circuit board lines of different thickness and colors,
 * interwoven with soft drop shadows and 45-degree turns/splits.
 *
 * Architecture:
 * - init()    — theme selection, component+trace layout generation, background caching
 * - render()  — Z-layer trace compositing, component drawing, grain overlay
 *
 * Bevel Technique:
 * To apply edge highlights without clipping paths, we draw the shape offset by
 * BEVEL_SHADOW_OFFSET (a large constant) and then apply a canvas shadow in the
 * opposite direction so only the shadow (the bevel highlight/shadow) is visible
 * within the shape boundary, using 'source-atop' compositing.
 */

/** @const {number} Large offset used in the bevel shadow technique. Must exceed canvas dimensions. */
const BEVEL_SHADOW_OFFSET = 10000;

/** @const {number} PCB grid spacing in pixels — all component and trace positions snap to this. */
const GRID_SPACING = 60;

/** @const {number} Minimum direction-change angle (radians) to place a corner junction pad. */
const CORNER_PAD_ANGLE_THRESHOLD = Math.PI / 4;

/** @const {number} Gradient bounding-box padding in pixels for trace color gradients. */
const GRADIENT_BBOX_PADDING = 20;

/**
 * Deliberately different art directions for the same physical circuit language.
 * `--variant auto` picks one from the current telemetry; every named value is
 * deterministic and useful when a particular wallpaper mood is wanted.
 */
const FUTURE_DIRECTIONS = {
  'neon-noir': {
    label: 'NEON NOIR', bg: { h: 226, s: 44, l: 5 },
    traces: [{ h: 190, s: 100, l: 55 }, { h: 322, s: 100, l: 60 }, { h: 266, s: 96, l: 65 }, { h: 52, s: 100, l: 62 }],
    glow: 0.24, core: 'rgba(225, 255, 255, 0.6)', surface: 'grid'
  },
  'holographic-chrome': {
    label: 'HOLOGRAPHIC CHROME', bg: { h: 247, s: 31, l: 8 },
    traces: [{ h: 183, s: 88, l: 63 }, { h: 286, s: 80, l: 70 }, { h: 42, s: 85, l: 72 }, { h: 326, s: 80, l: 67 }],
    glow: 0.18, core: 'rgba(255, 244, 255, 0.62)', surface: 'prism'
  },
  'biolume-lattice': {
    label: 'BIOLUME LATTICE', bg: { h: 169, s: 48, l: 5 },
    traces: [{ h: 154, s: 95, l: 52 }, { h: 92, s: 95, l: 57 }, { h: 191, s: 90, l: 56 }, { h: 48, s: 92, l: 58 }],
    glow: 0.17, core: 'rgba(232, 255, 225, 0.55)', surface: 'cells'
  },
  'solar-forge': {
    label: 'SOLAR FORGE', bg: { h: 16, s: 38, l: 5 },
    traces: [{ h: 36, s: 100, l: 56 }, { h: 15, s: 94, l: 51 }, { h: 51, s: 96, l: 66 }, { h: 196, s: 76, l: 57 }],
    glow: 0.16, core: 'rgba(255, 246, 210, 0.58)', surface: 'forge'
  },
  'quantum-ice': {
    label: 'QUANTUM ICE', bg: { h: 212, s: 52, l: 6 },
    traces: [{ h: 193, s: 100, l: 68 }, { h: 218, s: 93, l: 68 }, { h: 267, s: 82, l: 72 }, { h: 176, s: 94, l: 59 }],
    glow: 0.2, core: 'rgba(242, 255, 255, 0.68)', surface: 'crystal'
  }
};

const FUTURE_DIRECTION_NAMES = Object.keys(FUTURE_DIRECTIONS);

export class BeveledCircuitsStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.traces = [];
    this.components = [];
    this.theme = null;
    this.bgCacheCanvas = null;
    this.offCanvas = null;
    this.offCtx = null;
    this.artDirection = null;
  }

  async init(data) {
    await super.init(data);
    const latest = (data && data.length > 0)
      ? data[data.length - 1]
      : { hh: 12, mm: 0, bp: 100, fm: 50, pt: 45 };

    // Select theme dynamically based on time of day
    this._initTheme(latest);
    this._initArtDirection(latest);

    // Generate circuit board layout of chips, capacitors, and traces
    this._generateLayout(data && data.length > 0 ? data : [latest]);

    // Pre-render static board layers onto a cached background canvas
    this.bgCacheCanvas = createCanvas(this.width, this.height);
    const bgCacheCtx = this.bgCacheCanvas.getContext('2d');
    this._drawPCB(bgCacheCtx, this.width, this.height);
    this._drawGroundPlanes(bgCacheCtx, this.width, this.height);
    this._drawSilkscreen(bgCacheCtx);

    // Pre-allocate persistent offscreen canvas for trace/component drawing
    // to avoid garbage collection thrashing during render()
    this.offCanvas = createCanvas(this.width, this.height);
    this.offCtx = this.offCanvas.getContext('2d');
  }

  /**
   * Selects a color theme based on the time-of-day from the most recent log entry.
   * Morning => emerald/copper, Afternoon => gold/copper, Evening => cyberpunk/sapphire, Night => sapphire/cyberpunk.
   * @param {Object} entry - The latest data entry with an `hh` (hour) field
   */

  _initTheme(entry) {
    const THEMES = {
      cyberpunk: {
        bg: { h: 285, s: 35, l: 6 }, // Dark violet board
        traces: [
          { h: 325, s: 95, l: 55 }, // Hot pink
          { h: 185, s: 95, l: 50 }, // Neon cyan
          { h: 265, s: 90, l: 60 }, // Electric purple
          { h: 55,  s: 95, l: 55 }  // Neon yellow
        ]
      },
      emerald: {
        bg: { h: 155, s: 25, l: 5 }, // Dark forest green board
        traces: [
          { h: 145, s: 85, l: 45 }, // Emerald green
          { h: 110, s: 80, l: 55 }, // Lime green
          { h: 170, s: 85, l: 42 }, // Mint / Teal
          { h: 42,  s: 90, l: 50 }  // Gold / Brass
        ]
      },
      sapphire: {
        bg: { h: 220, s: 35, l: 6 }, // Deep midnight blue board
        traces: [
          { h: 195, s: 90, l: 48 }, // Electric cyan
          { h: 220, s: 85, l: 52 }, // Sapphire blue
          { h: 255, s: 80, l: 58 }, // Indigo
          { h: 175, s: 95, l: 42 }  // Turquoise
        ]
      },
      gold: {
        bg: { h: 30, s: 10, l: 5 }, // Obsidian black-gold board
        traces: [
          { h: 45,  s: 85, l: 48 }, // Gold
          { h: 32,  s: 90, l: 42 }, // Amber / Bronze
          { h: 20,  s: 80, l: 38 }, // Copper
          { h: 55,  s: 70, l: 60 }  // Pale yellow gold
        ]
      },
      copper: {
        bg: { h: 210, s: 12, l: 7 }, // Gunmetal slate gray board
        traces: [
          { h: 18,  s: 85, l: 44 }, // Bright copper
          { h: 32,  s: 80, l: 48 }, // Bronze
          { h: 12,  s: 75, l: 32 }, // Dark copper
          { h: 185, s: 60, l: 52 }  // Silver / Nickel
        ]
      }
    };

    const hour = entry.hh;
    let themeName;
    if (hour >= 6 && hour < 12) {
      themeName = Math.random() > 0.5 ? 'emerald' : 'copper';
    } else if (hour >= 12 && hour < 17) {
      themeName = Math.random() > 0.5 ? 'gold' : 'copper';
    } else if (hour >= 17 && hour < 22) {
      themeName = Math.random() > 0.5 ? 'cyberpunk' : 'sapphire';
    } else {
      themeName = Math.random() > 0.5 ? 'sapphire' : 'cyberpunk';
    }
    
    this.theme = THEMES[themeName];
  }

  _initArtDirection(entry) {
    const requested = String(this.config.variant || this.config.artDirection || 'auto').toLowerCase();
    const directionName = FUTURE_DIRECTIONS[requested]
      ? requested
      : FUTURE_DIRECTION_NAMES[Math.abs((entry.hh || 0) + (entry.mm || 0) + (entry.bp || 0)) % FUTURE_DIRECTION_NAMES.length];

    this.artDirection = { name: directionName, ...FUTURE_DIRECTIONS[directionName] };
    // The direction owns the palette so variants are visibly separate, rather
    // than merely adding a colored overlay to the original five PCB themes.
    this.theme = {
      bg: { ...this.artDirection.bg },
      traces: this.artDirection.traces.map(color => ({ ...color }))
    };
  }

  _generateLayout(data) {
    const latest = data[data.length - 1];
    const gridSpacing = 60;
    const cols = Math.ceil(this.width / gridSpacing);
    const rows = Math.ceil(this.height / gridSpacing);

    this.traces = [];
    this.components = [];

    const availablePinCoords = [];

    // 1. Generate Chips / ICs (Components)
    const numChips = Math.floor(mapRange(latest.bp, 0, 100, 2, 5));
    
    for (let i = 0; i < numChips; i++) {
      const gridX = Math.floor(randomRange(2, cols - 3));
      const gridY = Math.floor(randomRange(3, rows - 5));
      const x = gridX * gridSpacing;
      const y = gridY * gridSpacing;
      
      const isLarge = Math.random() > 0.6;
      const w = isLarge ? 1.5 * gridSpacing : 1 * gridSpacing;
      const h = isLarge ? 2.5 * gridSpacing : 1.5 * gridSpacing;
      const rotation = Math.random() > 0.5 ? 0 : Math.PI / 2;

      // Create pins for the chip
      const pins = [];
      const numPinsPerSide = isLarge ? 4 : 2;
      const pinGap = h / (numPinsPerSide + 1);

      for (let p = 0; p < numPinsPerSide; p++) {
        const pinY = -h/2 + pinGap * (p + 1);
        const pinW = 8;
        const pinH = 5;
        
        // Left-side pin local coordinates
        pins.push({ x: -w/2 - pinW + 2, y: pinY - pinH/2, w: pinW, h: pinH });
        // Right-side pin local coordinates
        pins.push({ x: w/2 - 2, y: pinY - pinH/2, w: pinW, h: pinH });

        // Calculate global coordinates of pins so traces can route to them
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        
        const lGlobalX = x + (-w/2 - pinW) * cos - pinY * sin;
        const lGlobalY = y + (-w/2 - pinW) * sin + pinY * cos;
        availablePinCoords.push({ x: lGlobalX, y: lGlobalY });

        const rGlobalX = x + (w/2 + pinW) * cos - pinY * sin;
        const rGlobalY = y + (w/2 + pinW) * sin + pinY * cos;
        availablePinCoords.push({ x: rGlobalX, y: rGlobalY });
      }

      this.components.push({
        type: 'chip',
        x,
        y,
        w,
        h,
        rotation,
        pins,
        label: `GWF-${latest.pt || 45}C\nREV ${latest.hh}.${latest.mm}`,
        colorIndex: Math.floor(Math.random() * this.theme.traces.length),
        shadowBlur: 2,
        shadowOffsetX: 2.5,
        shadowOffsetY: 4
      });
    }

    // Add cylindrical capacitors
    const numCaps = Math.floor(mapRange(latest.fm, 0, 100, 3, 7));
    for (let i = 0; i < numCaps; i++) {
      const gridX = Math.floor(randomRange(1, cols - 1));
      const gridY = Math.floor(randomRange(2, rows - 2));
      const x = gridX * gridSpacing;
      const y = gridY * gridSpacing;
      const r = randomRange(12, 22);

      this.components.push({
        type: 'capacitor',
        x,
        y,
        r,
        label: `${latest.bp}uF`,
        colorIndex: Math.floor(Math.random() * this.theme.traces.length),
        shadowBlur: 2,
        shadowOffsetX: 1.5,
        shadowOffsetY: 3
      });
    }

    // Add thermal heat sinks based on processor temperature
    const pt = latest.pt || 45;
    if (pt > 30) {
      const numSinks = Math.min(3, Math.floor(mapRange(pt, 30, 100, 1, 3)));
      for (let i = 0; i < numSinks; i++) {
        const gridX = Math.floor(randomRange(2, cols - 3));
        const gridY = Math.floor(randomRange(3, rows - 5));
        const x = gridX * gridSpacing;
        const y = gridY * gridSpacing;

        const w = Math.floor(mapRange(pt, 30, 100, 2, 4)) * gridSpacing;
        const h = Math.floor(mapRange(pt, 30, 100, 2, 4)) * gridSpacing;

        this.components.push({
          type: 'heatsink',
          x,
          y,
          w,
          h,
          pt,
          colorIndex: 3, // Usually accent/neutral tone
          shadowBlur: 2,
          shadowOffsetX: 1,
          shadowOffsetY: 2
        });
      }
    }

    // Add status LEDs based on battery level
    const bp = latest.bp || 100;
    const gridXLed = Math.floor(randomRange(2, cols - 3));
    const gridYLed = Math.floor(randomRange(2, rows - 3));
    const startLedX = gridXLed * gridSpacing;
    const ledY = gridYLed * gridSpacing;
    
    for (let l = 0; l < 3; l++) {
      const ledX = startLedX + l * 20;
      let ledColor;
      if (bp >= 70) {
        ledColor = l === 0 ? 'green' : 'dim';
      } else if (bp >= 30) {
        ledColor = l === 1 ? 'amber' : 'dim';
      } else {
        ledColor = l === 2 ? 'red' : 'dim';
      }

      this.components.push({
        type: 'led',
        x: ledX,
        y: ledY,
        r: 4.5,
        ledColor,
        bp,
        colorIndex: 0,
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0
      });
    }

    // Add SMD resistors and SOT-23 transistors
    const numSMDs = Math.floor(randomRange(8, 15));
    const smdLabels = ['103', '472', '102', '000', '104', '473'];
    const transistorLabels = ['1AM', '2A', 'L4', 'A7', 'Y1'];

    for (let i = 0; i < numSMDs; i++) {
      const gridX = Math.floor(randomRange(1, cols - 1));
      const gridY = Math.floor(randomRange(2, rows - 2));
      const x = gridX * gridSpacing + randomRange(-15, 15);
      const y = gridY * gridSpacing + randomRange(-15, 15);

      let tooClose = false;
      for (const comp of this.components) {
        const dist = Math.hypot(comp.x - x, comp.y - y);
        const minSpace = (comp.w || comp.r * 2 || 40) / 2 + 20;
        if (dist < minSpace) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        const isTransistor = Math.random() > 0.55;
        this.components.push({
          type: isTransistor ? 'smd_transistor' : 'smd_resistor',
          x,
          y,
          rotation: (Math.floor(Math.random() * 4) * Math.PI) / 2,
          label: isTransistor 
            ? transistorLabels[Math.floor(Math.random() * transistorLabels.length)]
            : smdLabels[Math.floor(Math.random() * smdLabels.length)],
          colorIndex: 0,
          shadowBlur: 1,
          shadowOffsetX: 0.6,
          shadowOffsetY: 1.1
        });
      }
    }

    // 2. Generate Traces
    const bevelStyles = ['raised', 'sunken', 'ridge', 'groove'];

    // a) Power Rails (Thick traces, Z-Layer 3)
    const numPowerRails = Math.floor(mapRange(latest.fm, 0, 100, 1, 3)) + 1;
    for (let i = 0; i < numPowerRails; i++) {
      const isVertical = Math.random() > 0.4;
      let startX, startY, initDir;
      if (isVertical) {
        startX = Math.floor(randomRange(2, cols - 2)) * gridSpacing;
        startY = gridSpacing;
        initDir = 2; // Down
      } else {
        startX = gridSpacing;
        startY = Math.floor(randomRange(4, rows - 4)) * gridSpacing;
        initDir = 0; // Right
      }
      
      const segmentCount = Math.floor(randomRange(4, 8));
      const points = this._generateGridPath(startX, startY, initDir, segmentCount, gridSpacing);
      const width = randomRange(16, 26);
      const colorIndex = Math.floor(Math.random() * this.theme.traces.length);
      const bevelStyle = Math.random() > 0.4 ? 'raised' : 'ridge';
      
      const railTrace = this._createTraceObject(points, width, colorIndex, bevelStyle, 3);
      this.traces.push(railTrace);
    }

    // b) Parallel Busses (Standard, Z-Layer 2)
    const numBusses = Math.floor(mapRange(latest.bp, 0, 100, 4, 9));
    for (let i = 0; i < numBusses; i++) {
      let startX, startY;
      if (availablePinCoords.length > 0 && Math.random() > 0.5) {
        const pin = availablePinCoords.pop();
        startX = Math.round(pin.x / gridSpacing) * gridSpacing;
        startY = Math.round(pin.y / gridSpacing) * gridSpacing;
      } else {
        startX = Math.floor(randomRange(2, cols - 2)) * gridSpacing;
        startY = Math.floor(randomRange(3, rows - 3)) * gridSpacing;
      }

      const initDir = Math.floor(Math.random() * 8);
      const segmentCount = Math.floor(randomRange(4, 7));
      const corePoints = this._generateGridPath(startX, startY, initDir, segmentCount, gridSpacing);

      const numLinesInBus = Math.random() > 0.6 ? 3 : 2;
      const busSpacing = randomRange(12, 18);
      const colorIndex = Math.floor(Math.random() * this.theme.traces.length);
      const bevelStyle = bevelStyles[Math.floor(Math.random() * bevelStyles.length)];
      
      for (let j = 0; j < numLinesInBus; j++) {
        const offsetDist = (j - (numLinesInBus - 1) / 2) * busSpacing;
        const offsetPoints = this._offsetPath(corePoints, offsetDist);
        const width = randomRange(5, 9);
        const layer = Math.random() > 0.85 ? 3 : 2; 
        
        const trace = this._createTraceObject(offsetPoints, width, colorIndex, bevelStyle, layer);
        this.traces.push(trace);
      }
    }

    // c) Wandering Signal Traces (Z-Layer 1 & 2, interwoven splits)
    const numWandering = Math.floor(mapRange(latest.bp, 0, 100, 12, 28));
    for (let i = 0; i < numWandering; i++) {
      let startX, startY;
      if (availablePinCoords.length > 0 && Math.random() > 0.6) {
        const pin = availablePinCoords.pop();
        startX = Math.round(pin.x / gridSpacing) * gridSpacing;
        startY = Math.round(pin.y / gridSpacing) * gridSpacing;
      } else {
        startX = Math.floor(randomRange(1, cols - 1)) * gridSpacing;
        startY = Math.floor(randomRange(2, rows - 2)) * gridSpacing;
      }

      const initDir = Math.floor(Math.random() * 8);
      const segmentCount = Math.floor(randomRange(3, 7));
      const points = this._generateGridPath(startX, startY, initDir, segmentCount, gridSpacing);
      const width = Math.random() > 0.8 ? randomRange(8, 12) : randomRange(3.5, 6);
      const colorIndex = Math.floor(Math.random() * this.theme.traces.length);
      const bevelStyle = bevelStyles[Math.floor(Math.random() * bevelStyles.length)];
      
      const layer = Math.random() > 0.65 ? 1 : 2; 
      
      const trace = this._createTraceObject(points, width, colorIndex, bevelStyle, layer);
      this.traces.push(trace);

      // Split / branching logic
      if (Math.random() < 0.4 && points.length > 3) {
        const splitIdx = Math.floor(randomRange(1, points.length - 2));
        const splitPt = points[splitIdx];
        const prevPt = points[splitIdx - 1];
        
        const dx = splitPt.x - prevPt.x;
        const dy = splitPt.y - prevPt.y;
        const angle = Math.atan2(dy, dx);
        let baseDirIndex = Math.round((angle / (Math.PI / 4)) + 8) % 8;
        
        const splitDirIndex = (baseDirIndex + (Math.random() > 0.5 ? 1 : -1) + 8) % 8;
        const splitSegCount = Math.floor(randomRange(2, 5));
        
        const splitPoints = this._generateGridPath(splitPt.x, splitPt.y, splitDirIndex, splitSegCount, gridSpacing);
        const splitWidth = Math.max(3, width - 1.5);
        const splitBevel = bevelStyles[Math.floor(Math.random() * bevelStyles.length)];
        
        const splitTrace = this._createTraceObject(splitPoints, splitWidth, colorIndex, splitBevel, layer);
        this.traces.push(splitTrace);
      }
    }

    // d) Intertwined pairs and triplets (Thin traces, Z-Layer 1, 2 & 3)
    const numIntertwined = Math.floor(mapRange(latest.bp, 0, 100, 3, 6));
    for (let i = 0; i < numIntertwined; i++) {
      let startX, startY;
      if (availablePinCoords.length > 0 && Math.random() > 0.5) {
        const pin = availablePinCoords.pop();
        startX = Math.round(pin.x / gridSpacing) * gridSpacing;
        startY = Math.round(pin.y / gridSpacing) * gridSpacing;
      } else {
        startX = Math.floor(randomRange(2, cols - 2)) * gridSpacing;
        startY = Math.floor(randomRange(3, rows - 3)) * gridSpacing;
      }

      const initDir = Math.floor(Math.random() * 8);
      const segmentCount = Math.floor(randomRange(5, 9));
      const corePoints = this._generateGridPath(startX, startY, initDir, segmentCount, gridSpacing);

      const isTriplet = Math.random() > 0.5;
      const traceWidth = randomRange(2.5, 4.0);
      const spacing = randomRange(10, 14);
      const colorIndex0 = Math.floor(Math.random() * this.theme.traces.length);
      const colorIndex1 = (colorIndex0 + 1) % this.theme.traces.length;
      const bevelStyle = bevelStyles[Math.floor(Math.random() * bevelStyles.length)];

      if (isTriplet) {
        const colorIndex2 = (colorIndex0 + 2) % this.theme.traces.length;
        let p = [0, 1, 2];
        let stepsSinceLastSwap = 0;
        const trackOffsets = [-spacing, 0, spacing];
        const offsets0 = [];
        const offsets1 = [];
        const offsets2 = [];

        for (let k = 0; k < corePoints.length; k++) {
          const isCorner = k > 0 && k < corePoints.length - 1 &&
            (corePoints[k].x - corePoints[k-1].x !== corePoints[k+1].x - corePoints[k].x ||
             corePoints[k].y - corePoints[k-1].y !== corePoints[k+1].y - corePoints[k].y);

          if (k > 0 && !isCorner && stepsSinceLastSwap >= 2 && Math.random() < 0.4) {
            if (Math.random() > 0.5) {
              const tmp = p[0]; p[0] = p[1]; p[1] = tmp;
            } else {
              const tmp = p[1]; p[1] = p[2]; p[2] = tmp;
            }
            stepsSinceLastSwap = 0;
          } else {
            stepsSinceLastSwap++;
          }
          offsets0.push(trackOffsets[p[0]]);
          offsets1.push(trackOffsets[p[1]]);
          offsets2.push(trackOffsets[p[2]]);
        }

        const pts0 = this._offsetPathVarying(corePoints, offsets0);
        const pts1 = this._offsetPathVarying(corePoints, offsets1);
        const pts2 = this._offsetPathVarying(corePoints, offsets2);

        this.traces.push(this._createTraceObject(pts0, traceWidth, colorIndex0, bevelStyle, 1));
        this.traces.push(this._createTraceObject(pts1, traceWidth, colorIndex1, bevelStyle, 2));
        this.traces.push(this._createTraceObject(pts2, traceWidth, colorIndex2, bevelStyle, 3));
      } else {
        let currentSide = 1;
        let stepsSinceLastSwap = 0;
        const offsets0 = [];
        const offsets1 = [];

        for (let k = 0; k < corePoints.length; k++) {
          const isCorner = k > 0 && k < corePoints.length - 1 &&
            (corePoints[k].x - corePoints[k-1].x !== corePoints[k+1].x - corePoints[k].x ||
             corePoints[k].y - corePoints[k-1].y !== corePoints[k+1].y - corePoints[k].y);

          if (k > 0 && !isCorner && stepsSinceLastSwap >= 2 && Math.random() < 0.45) {
            currentSide = -currentSide;
            stepsSinceLastSwap = 0;
          } else {
            stepsSinceLastSwap++;
          }
          offsets0.push(-spacing * currentSide);
          offsets1.push(spacing * currentSide);
        }

        const pts0 = this._offsetPathVarying(corePoints, offsets0);
        const pts1 = this._offsetPathVarying(corePoints, offsets1);

        this.traces.push(this._createTraceObject(pts0, traceWidth, colorIndex0, bevelStyle, 1));
        this.traces.push(this._createTraceObject(pts1, traceWidth, colorIndex1, bevelStyle, 2));
      }
    }
  }

  _generateGridPath(startX, startY, initDir, segmentCount, gridSpacing) {
    const points = [{ x: startX, y: startY }];
    let curX = startX;
    let curY = startY;
    let d = initDir;

    const DIRECTIONS = [
      [1, 0],   // 0: Right
      [1, 1],   // 1: Down-Right
      [0, 1],   // 2: Down
      [-1, 1],  // 3: Down-Left
      [-1, 0],  // 4: Left
      [-1, -1], // 5: Up-Left
      [0, -1],  // 6: Up
      [1, -1]   // 7: Up-Right
    ];

    for (let i = 0; i < segmentCount; i++) {
      const length = Math.floor(randomRange(2, 6));
      const stepX = DIRECTIONS[d][0] * length * gridSpacing;
      const stepY = DIRECTIONS[d][1] * length * gridSpacing;

      let nextX = curX + stepX;
      let nextY = curY + stepY;

      // Keep it within borders with margin
      const margin = gridSpacing;
      if (nextX < margin || nextX > this.width - margin || nextY < margin || nextY > this.height - margin) {
        // Steer back towards center of screen
        const dxToCenter = this.width / 2 - curX;
        const dyToCenter = this.height / 2 - curY;
        let bestDir = d;
        let minDot = -Infinity;
        
        for (let testD = 0; testD < 8; testD++) {
          const testVx = DIRECTIONS[testD][0];
          const testVy = DIRECTIONS[testD][1];
          const diff = Math.abs(testD - d);
          if (diff > 2 && diff < 6) continue; // Prevent direct U-turns
          
          const dot = testVx * dxToCenter + testVy * dyToCenter;
          if (dot > minDot) {
            minDot = dot;
            bestDir = testD;
          }
        }
        d = bestDir;
        nextX = curX + DIRECTIONS[d][0] * length * gridSpacing;
        nextY = curY + DIRECTIONS[d][1] * length * gridSpacing;
      }

      points.push({ x: nextX, y: nextY });
      curX = nextX;
      curY = nextY;

      // Select next direction index
      const rand = Math.random();
      if (rand < 0.55) {
        // Go straight
      } else if (rand < 0.85) {
        // Turn 45 degrees
        d = (d + (Math.random() > 0.5 ? 1 : -1) + 8) % 8;
      } else {
        // Turn 90 degrees
        d = (d + (Math.random() > 0.5 ? 2 : -2) + 8) % 8;
      }
    }
    return points;
  }

  _offsetPath(points, d) {
    if (points.length < 2) return points.map(p => ({ ...p }));
    const offsetPoints = [];
    const n = points.length;
    for (let i = 0; i < n; i++) {
      let nx, ny;
      if (i === 0) {
        const dx = points[1].x - points[0].x;
        const dy = points[1].y - points[0].y;
        const len = Math.hypot(dx, dy) || 1;
        nx = -dy / len;
        ny = dx / len;
      } else if (i === n - 1) {
        const dx = points[n-1].x - points[n-2].x;
        const dy = points[n-1].y - points[n-2].y;
        const len = Math.hypot(dx, dy) || 1;
        nx = -dy / len;
        ny = dx / len;
      } else {
        const dx1 = points[i].x - points[i-1].x;
        const dy1 = points[i].y - points[i-1].y;
        const len1 = Math.hypot(dx1, dy1) || 1;
        const n1x = -dy1 / len1;
        const n1y = dx1 / len1;

        const dx2 = points[i+1].x - points[i].x;
        const dy2 = points[i+1].y - points[i].y;
        const len2 = Math.hypot(dx2, dy2) || 1;
        const n2x = -dy2 / len2;
        const n2y = dx2 / len2;

        nx = (n1x + n2x) / 2;
        ny = (n1y + n2y) / 2;
        const len = Math.hypot(nx, ny);
        if (len > 0.001) {
          nx /= len;
          ny /= len;
          const dotVal = n1x * n2x + n1y * n2y;
          const cosHalf = Math.sqrt(Math.max(0.1, (1 + dotVal) / 2));
          nx /= cosHalf;
          ny /= cosHalf;
        }
      }
      offsetPoints.push({
        x: points[i].x + nx * d,
        y: points[i].y + ny * d
      });
    }
    return offsetPoints;
  }

  _offsetPathVarying(points, offsets) {
    if (points.length < 2) return points.map(p => ({ ...p }));
    const offsetPoints = [];
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const d = offsets[i] !== undefined ? offsets[i] : 0;
      let nx, ny;
      if (i === 0) {
        const dx = points[1].x - points[0].x;
        const dy = points[1].y - points[0].y;
        const len = Math.hypot(dx, dy) || 1;
        nx = -dy / len;
        ny = dx / len;
      } else if (i === n - 1) {
        const dx = points[n-1].x - points[n-2].x;
        const dy = points[n-1].y - points[n-2].y;
        const len = Math.hypot(dx, dy) || 1;
        nx = -dy / len;
        ny = dx / len;
      } else {
        const dx1 = points[i].x - points[i-1].x;
        const dy1 = points[i].y - points[i-1].y;
        const len1 = Math.hypot(dx1, dy1) || 1;
        const n1x = -dy1 / len1;
        const n1y = dx1 / len1;

        const dx2 = points[i+1].x - points[i].x;
        const dy2 = points[i+1].y - points[i].y;
        const len2 = Math.hypot(dx2, dy2) || 1;
        const n2x = -dy2 / len2;
        const n2y = dx2 / len2;

        nx = (n1x + n2x) / 2;
        ny = (n1y + n2y) / 2;
        const len = Math.hypot(nx, ny);
        if (len > 0.001) {
          nx /= len;
          ny /= len;
          const dotVal = n1x * n2x + n1y * n2y;
          const cosHalf = Math.sqrt(Math.max(0.1, (1 + dotVal) / 2));
          nx /= cosHalf;
          ny /= cosHalf;
        }
      }

      if (i > 0 && offsets[i] !== offsets[i - 1]) {
        const dPrev = offsets[i - 1];
        offsetPoints.push({
          x: points[i].x + nx * dPrev,
          y: points[i].y + ny * dPrev
        });
      }

      offsetPoints.push({
        x: points[i].x + nx * d,
        y: points[i].y + ny * d
      });
    }
    return offsetPoints;
  }

  _createTraceObject(points, width, colorIndex, bevelStyle, layer) {
    const isPowerRail = width >= 15;
    const isThin = width < 6;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
    if (minX === Infinity) {
      minX = 0; minY = 0; maxX = 100; maxY = 100;
    }
    const bbox = { minX, minY, maxX, maxY };
    
    let bevelWidth = 2;
    let bevelBlur = 1.5;
    if (isThin) {
      bevelWidth = 1.2;
      bevelBlur = 1.0;
    } else if (isPowerRail) {
      bevelWidth = randomRange(3.5, 5.0);
      bevelBlur = randomRange(2.5, 4.0);
    } else {
      bevelWidth = randomRange(2.0, 3.0);
      bevelBlur = randomRange(1.5, 2.5);
    }

    const shadowBlur = 0;
    const shadowOffsetX = (width * 0.35 + 1) * 0.5;
    const shadowOffsetY = (width * 0.45 + 1.5) * 0.5;
    const shadowOpacity = (isPowerRail ? 0.55 : (isThin ? 0.35 : 0.45)) * 0.5;

    const isTunnel = !isPowerRail && points.length >= 5 && Math.random() < 0.25;
    let tunnelStartIdx = -1;
    let tunnelEndIdx = -1;

    const pads = [];

    const addPad = (pt, type) => {
      const r = Math.max(width * 1.6, type === 'via' ? 7 : 9);
      pads.push({
        x: pt.x,
        y: pt.y,
        r,
        type, // 'via', 'testpoint', 'smd'
        colorIndex,
        bevelStyle: Math.random() > 0.35 ? 'raised' : 'sunken',
        bevelWidth: Math.max(1, bevelWidth * 0.75),
        bevelBlur: Math.max(1, bevelBlur * 0.75)
      });
    };

    if (isTunnel) {
      tunnelStartIdx = Math.floor(points.length / 3);
      tunnelEndIdx = Math.floor(2 * points.length / 3);

      addPad(points[tunnelStartIdx], 'via');
      addPad(points[tunnelEndIdx], 'via');

      if (Math.random() > 0.2) addPad(points[0], 'testpoint');
      if (Math.random() > 0.2) addPad(points[points.length - 1], 'testpoint');
    } else {
      if (points.length > 0) {
        if (Math.random() > 0.2) {
          addPad(points[0], Math.random() > 0.75 ? 'smd' : 'testpoint');
        }
        if (Math.random() > 0.2) {
          addPad(points[points.length - 1], Math.random() > 0.75 ? 'smd' : 'testpoint');
        }
        for (let i = 1; i < points.length - 1; i++) {
          if (Math.random() > 0.88) {
            addPad(points[i], 'via');
          }
        }
      }
    }

    const hasPulse = false;
    const pulseStartIdx = hasPulse ? Math.floor(randomRange(0, points.length - 3)) : -1;

    return {
      points,
      width,
      colorIndex,
      bevelStyle,
      bevelWidth,
      bevelBlur,
      shadowBlur,
      shadowOffsetX,
      shadowOffsetY,
      shadowOpacity,
      layer,
      pads,
      isTunnel,
      tunnelStartIdx,
      tunnelEndIdx,
      hasPulse,
      pulseStartIdx,
      bbox
    };
  }

  async render(ctx, width, height) {
    // 1. Draw the pre-rendered static background composite (PCB, ground planes, silkscreen)
    ctx.drawImage(this.bgCacheCanvas, 0, 0);

    // 2. Render traces in Z-index layer order (interweaving depths)
    const layers = [1, 2, 3];
    layers.forEach(layerNum => {
      const layerTraces = this.traces.filter(t => t.layer === layerNum);
      layerTraces.forEach(trace => this._drawTrace(ctx, this.offCtx, this.offCanvas, trace));
    });

    // 3. Render components on top
    this.components.forEach(comp => this._drawComponent(ctx, this.offCtx, this.offCanvas, comp));

    // A restrained finishing pass makes each direction read as an intentional
    // object/world, while the traces and components retain visual priority.
    this._drawArtDirectionFinish(ctx, width, height);

    // 4. Draw grain overlay
    await canvasUtils.drawGrain(ctx, width, height, 1200, 0.05);
  }

  _drawGroundPlanes(ctx, width, height) {
    const bg = this.theme.bg;
    const tempCanvas = createCanvas(width, height);
    const tempCtx = tempCanvas.getContext('2d');

    // Fill the ground plane copper zone (with 20px margins from screen border)
    tempCtx.fillStyle = `hsla(${bg.h}, ${bg.s}%, ${bg.l + 3.5}%, 0.24)`;
    tempCtx.fillRect(20, 20, width - 40, height - 40);

    // Set composite operation to clear the isolation spacing around active features
    tempCtx.globalCompositeOperation = 'destination-out';
    tempCtx.lineCap = 'round';
    tempCtx.lineJoin = 'round';

    // A) Clear space around traces and their pads
    this.traces.forEach(trace => {
      if (trace.points.length < 2) return;
      tempCtx.lineWidth = trace.width + 12; // trace thickness + 12px clearance spacing
      tempCtx.beginPath();
      tempCtx.moveTo(trace.points[0].x, trace.points[0].y);
      for (let i = 1; i < trace.points.length; i++) {
        tempCtx.lineTo(trace.points[i].x, trace.points[i].y);
      }
      tempCtx.stroke();

      // Clear space around pads
      trace.pads.forEach(pad => {
        tempCtx.beginPath();
        tempCtx.arc(pad.x, pad.y, pad.r + 6, 0, Math.PI * 2);
        tempCtx.fill();
      });
    });

    // B) Clear space around components
    this.components.forEach(comp => {
      if (comp.type === 'chip') {
        tempCtx.save();
        tempCtx.translate(comp.x, comp.y);
        tempCtx.rotate(comp.rotation);
        tempCtx.beginPath();
        // Clear box around chip body and pins
        tempCtx.rect(-comp.w / 2 - 10, -comp.h / 2 - 10, comp.w + 20, comp.h + 20);
        tempCtx.fill();
        tempCtx.restore();
      } else if (comp.type === 'capacitor') {
        tempCtx.beginPath();
        tempCtx.arc(comp.x, comp.y, comp.r + 8, 0, Math.PI * 2);
        tempCtx.fill();
      } else if (comp.type === 'heatsink') {
        tempCtx.beginPath();
        tempCtx.rect(comp.x - comp.w / 2 - 10, comp.y - comp.h / 2 - 10, comp.w + 20, comp.h + 20);
        tempCtx.fill();
      } else if (comp.type === 'led') {
        tempCtx.beginPath();
        tempCtx.arc(comp.x, comp.y, comp.r + 8, 0, Math.PI * 2);
        tempCtx.fill();
      } else if (comp.type === 'smd_resistor' || comp.type === 'smd_transistor') {
        tempCtx.save();
        tempCtx.translate(comp.x, comp.y);
        tempCtx.rotate(comp.rotation);
        tempCtx.beginPath();
        tempCtx.rect(-14, -10, 28, 20);
        tempCtx.fill();
        tempCtx.restore();
      }
    });

    // Draw the masked copper ground plane onto the main context
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();
  }

  _drawPCB(ctx, width, height) {
    const bg = this.theme.bg;
    const bgHsl = `hsl(${bg.h}, ${bg.s}%, ${bg.l}%)`;
    ctx.fillStyle = bgHsl;
    ctx.fillRect(0, 0, width, height);

    // Woven fiberglass texture (FR4 substrate weave)
    ctx.save();
    const fiberSpacing = 8;
    for (let x = 0; x < width; x += fiberSpacing) {
      const alpha = 0.03 + 0.02 * Math.sin(x * 0.5);
      ctx.fillStyle = `hsla(${bg.h}, ${bg.s}%, 100%, ${alpha})`;
      ctx.fillRect(x, 0, fiberSpacing - 1, height);
      
      const darkAlpha = 0.02 + 0.01 * Math.cos(x * 0.5);
      ctx.fillStyle = `hsla(${bg.h}, ${bg.s}%, 0%, ${darkAlpha})`;
      ctx.fillRect(x + fiberSpacing - 1, 0, 1, height);
    }
    for (let y = 0; y < height; y += fiberSpacing) {
      const alpha = 0.03 + 0.02 * Math.sin(y * 0.5);
      ctx.fillStyle = `hsla(${bg.h}, ${bg.s}%, 100%, ${alpha})`;
      ctx.fillRect(0, y, width, fiberSpacing - 1);
      
      const darkAlpha = 0.02 + 0.01 * Math.cos(y * 0.5);
      ctx.fillStyle = `hsla(${bg.h}, ${bg.s}%, 0%, ${darkAlpha})`;
      ctx.fillRect(0, y + fiberSpacing - 1, width, 1);
    }
    ctx.restore();

    this._drawArtDirectionSurface(ctx, width, height);


  }

  _drawArtDirectionSurface(ctx, width, height) {
    const { surface } = this.artDirection;
    ctx.save();

    if (surface === 'grid') {
      // Neon Noir: a recessed, perspective-like HUD grid beneath the board.
      ctx.strokeStyle = 'rgba(80, 222, 255, 0.075)';
      ctx.lineWidth = 1;
      for (let x = -height; x < width + height; x += 72) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + height * 0.28, height); ctx.stroke();
      }
      for (let y = 30; y < height; y += 72) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }
    } else if (surface === 'prism') {
      // Holographic Chrome: broad translucent interference bands.
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 5; i++) {
        const x = ((i + 0.5) * width) / 5;
        const grad = ctx.createLinearGradient(x - width * 0.18, 0, x + width * 0.18, height);
        grad.addColorStop(0, 'rgba(90, 255, 255, 0)');
        grad.addColorStop(0.5, i % 2 ? 'rgba(255, 156, 245, 0.07)' : 'rgba(130, 205, 255, 0.08)');
        grad.addColorStop(1, 'rgba(255, 230, 130, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x - width * 0.2, 0, width * 0.4, height);
      }
    } else if (surface === 'cells') {
      // Biolume Lattice: sparse, soft cells make the circuit feel cultivated.
      ctx.globalCompositeOperation = 'screen';
      for (let y = 45; y < height; y += 110) {
        for (let x = 35 + ((Math.floor(y / 110) % 2) * 44); x < width; x += 88) {
          ctx.strokeStyle = 'rgba(110, 255, 180, 0.055)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x, y, 28, 0, Math.PI * 2); ctx.stroke();
        }
      }
    } else if (surface === 'forge') {
      // Solar Forge: heat pools, deliberately understated so it remains a wallpaper.
      ctx.globalCompositeOperation = 'screen';
      const grad = ctx.createRadialGradient(width * 0.72, height * 0.2, 0, width * 0.72, height * 0.2, Math.max(width, height) * 0.62);
      grad.addColorStop(0, 'rgba(255, 108, 22, 0.15)');
      grad.addColorStop(0.38, 'rgba(255, 182, 37, 0.04)');
      grad.addColorStop(1, 'rgba(255, 80, 0, 0)');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);
    } else if (surface === 'crystal') {
      // Quantum Ice: an angular substrate with barely-visible faceting.
      ctx.strokeStyle = 'rgba(160, 244, 255, 0.065)';
      ctx.lineWidth = 1;
      for (let x = -height; x < width + height; x += 105) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + height * 0.52, height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 42, 0); ctx.lineTo(x - height * 0.36, height); ctx.stroke();
      }
    }
    ctx.restore();
  }

  _drawArtDirectionFinish(ctx, width, height) {
    const { surface } = this.artDirection;
    ctx.save();
    if (surface === 'grid') {
      ctx.fillStyle = 'rgba(92, 220, 255, 0.035)';
      for (let y = 0; y < height; y += 5) ctx.fillRect(0, y, width, 1);
    } else if (surface === 'prism') {
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = 'rgba(255, 242, 255, 0.13)';
      ctx.lineWidth = 1;
      ctx.strokeRect(18, 18, width - 36, height - 36);
    } else if (surface === 'cells') {
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = 'rgba(196, 255, 216, 0.1)';
      ctx.setLineDash([3, 8]);
      ctx.strokeRect(22, 22, width - 44, height - 44);
    } else if (surface === 'forge') {
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = 'rgba(255, 201, 98, 0.13)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(18, 18, width - 36, height - 36);
    } else if (surface === 'crystal') {
      ctx.globalCompositeOperation = 'screen';
      const border = ctx.createLinearGradient(0, 0, width, height);
      border.addColorStop(0, 'rgba(190, 255, 255, 0.18)');
      border.addColorStop(1, 'rgba(132, 150, 255, 0.03)');
      ctx.strokeStyle = border;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(20, 20, width - 40, height - 40);
    }
    ctx.restore();
  }

  _drawSilkscreen(ctx) {
    const bg = this.theme.bg;
    ctx.save();
    
    // Background copper shielding zones removed

    // Draw silkscreen corner brackets around chips
    ctx.strokeStyle = `hsla(${bg.h}, ${bg.s}%, ${bg.l + 25}%, 0.25)`;
    ctx.lineWidth = 1.2;
    this.components.forEach(comp => {
      if (comp.type === 'chip') {
        const { x, y, w, h, rotation } = comp;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        
        const size = 8;
        const hw = w / 2 + 5;
        const hh = h / 2 + 5;
        
        // Top-Left
        ctx.beginPath();
        ctx.moveTo(-hw + size, -hh); ctx.lineTo(-hw, -hh); ctx.lineTo(-hw, -hh + size);
        ctx.stroke();

        // Top-Right
        ctx.beginPath();
        ctx.moveTo(hw - size, -hh); ctx.lineTo(hw, -hh); ctx.lineTo(hw, -hh + size);
        ctx.stroke();

        // Bottom-Left
        ctx.beginPath();
        ctx.moveTo(-hw + size, hh); ctx.lineTo(-hw, hh); ctx.lineTo(-hw, hh - size);
        ctx.stroke();

        // Bottom-Right
        ctx.beginPath();
        ctx.moveTo(hw - size, hh); ctx.lineTo(hw, hh); ctx.lineTo(hw, hh - size);
        ctx.stroke();

        ctx.restore();
      }
    });

    // Technical markings / labels (randomly rotated 45 or 90 deg)
    ctx.fillStyle = `hsla(${bg.h}, ${bg.s}%, ${bg.l + 25}%, 0.22)`;
    ctx.font = '9px monospace';
    
    const labels = [
      'GND_SHIELD_A', 'VCC_3V3_PWR', 'REV_3.5_GWF', 'TERMUX_SYS_DEV',
      'HIGH_SPEED_DATA', 'OSC_24MHZ', 'RF_ANT_TX', 'ADC_SENSE_0'
    ];
    
    labels.forEach(label => {
      const tx = randomRange(50, this.width - 150);
      const ty = randomRange(50, this.height - 50);
      
      ctx.save();
      ctx.translate(tx, ty);
      const rotChoice = Math.floor(Math.random() * 3);
      if (rotChoice === 1) ctx.rotate(Math.PI / 4);
      else if (rotChoice === 2) ctx.rotate(Math.PI / 2);
      
      ctx.fillText(label, 0, 0);
      
      ctx.strokeStyle = `hsla(${bg.h}, ${bg.s}%, ${bg.l + 25}%, 0.12)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-12, -3);
      ctx.lineTo(-4, -3);
      ctx.stroke();
      
      ctx.restore();
    });

    // Decorative alignment crosshairs
    ctx.strokeStyle = `hsla(${bg.h}, ${bg.s}%, ${bg.l + 20}%, 0.2)`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const cx = randomRange(100, this.width - 100);
      const cy = randomRange(100, this.height - 100);
      
      ctx.save();
      ctx.translate(cx, cy);
      
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
      ctx.moveTo(0, -10); ctx.lineTo(0, 10);
      ctx.stroke();
      
      ctx.restore();
    }

    ctx.restore();
  }

  _drawTrace(ctx, offCtx, offCanvas, trace) {
    if (trace.points.length < 2) return;

    const bg = this.theme.bg;
    const bbox = trace.bbox;
    const clearPad = trace.width + trace.bevelWidth + 15;
    
    // Clear only the bounding box area of the trace (with padding for highlights)
    offCtx.clearRect(bbox.minX - clearPad, bbox.minY - clearPad, (bbox.maxX - bbox.minX) + 2 * clearPad, (bbox.maxY - bbox.minY) + 2 * clearPad);

    const colorStyle = this._createStyleGradient(offCtx, trace, trace.colorIndex);

    if (trace.isTunnel) {
      // 1. Draw bottom-layer tunneling segment directly on main canvas
      ctx.save();
      ctx.strokeStyle = `hsla(${bg.h}, ${bg.s}%, ${bg.l + 10}%, 0.45)`;
      ctx.lineWidth = trace.width * 0.8;
      ctx.setLineDash([6, 6]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(trace.points[trace.tunnelStartIdx].x, trace.points[trace.tunnelStartIdx].y);
      for (let i = trace.tunnelStartIdx + 1; i <= trace.tunnelEndIdx; i++) {
        ctx.lineTo(trace.points[i].x, trace.points[i].y);
      }
      ctx.stroke();
      ctx.restore();

      // 2. Draw top-layer segments on offscreen canvas
      const ranges = [
        [0, trace.tunnelStartIdx],
        [trace.tunnelEndIdx, trace.points.length - 1]
      ];
      this._drawSingleBeveledPath(offCtx, trace.points, trace.width, colorStyle, trace.bevelStyle, trace.bevelWidth, trace.bevelBlur, ranges);

      ctx.save();
      ctx.shadowColor = `rgba(0, 0, 0, ${trace.shadowOpacity})`;
      ctx.shadowBlur = trace.shadowBlur;
      ctx.shadowOffsetX = trace.shadowOffsetX;
      ctx.shadowOffsetY = trace.shadowOffsetY;
      ctx.drawImage(offCanvas, 0, 0);
      ctx.restore();
    } else {
      this._drawSingleBeveledPath(offCtx, trace.points, trace.width, colorStyle, trace.bevelStyle, trace.bevelWidth, trace.bevelBlur);

      ctx.save();
      ctx.shadowColor = `rgba(0, 0, 0, ${trace.shadowOpacity})`;
      ctx.shadowBlur = trace.shadowBlur;
      ctx.shadowOffsetX = trace.shadowOffsetX;
      ctx.shadowOffsetY = trace.shadowOffsetY;
      ctx.drawImage(offCanvas, 0, 0);
      ctx.restore();
    }

    if (trace.hasPulse) {
      this._drawELWirePulse(ctx, trace);
    }

    this._drawTraceEnergy(ctx, trace);

    // Render pads associated with this trace
    trace.pads.forEach(pad => this._drawPad(ctx, offCtx, offCanvas, pad, trace.shadowOpacity, trace.shadowBlur, trace.shadowOffsetX, trace.shadowOffsetY));

    // Render corner junction pads at significant direction-change points
    this._drawCornerJunctionPads(ctx, offCtx, offCanvas, trace);
  }

  /**
   * Draws a multi-layer electroluminescent (EL) wire glow pulse along a trace segment.
   * Renders 3 concentric layers: wide outer bloom, mid chromatic glow, and a tight bright core.
   * Uses 'screen' composite blending for additive light mixing that simulates emissive traces.
   * @param {CanvasRenderingContext2D} ctx - The main canvas context
   * @param {Object} trace - The trace object containing pulse data and color index
   */
  _drawELWirePulse(ctx, trace) {
    const traceColor = this.theme.traces[trace.colorIndex % this.theme.traces.length];
    const { h, s, l } = traceColor;
    const pStart = trace.pulseStartIdx;
    const pEnd = Math.min(pStart + 3, trace.points.length - 1);

    // Build the pulse path (up to 3 segments)
    const drawPulsePath = () => {
      ctx.beginPath();
      ctx.moveTo(trace.points[pStart].x, trace.points[pStart].y);
      for (let i = pStart + 1; i <= pEnd; i++) {
        ctx.lineTo(trace.points[i].x, trace.points[i].y);
      }
    };

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Layer 1: Wide outer bloom (diffuse atmospheric halo)
    ctx.strokeStyle = `hsla(${h}, ${s}%, ${Math.min(90, l + 15)}%, 0.12)`;
    ctx.lineWidth = trace.width * 2.2;
    ctx.shadowColor = `hsl(${h}, ${s}%, ${l}%)`;
    ctx.shadowBlur = trace.width * 1.5;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    drawPulsePath();
    ctx.stroke();

    // Layer 2: Mid chromatic glow (saturated EL tube color)
    ctx.strokeStyle = `hsla(${h}, ${Math.min(100, s + 10)}%, ${Math.min(80, l + 20)}%, 0.35)`;
    ctx.lineWidth = trace.width * 1.0;
    ctx.shadowColor = `hsl(${h}, ${s}%, ${l}%)`;
    ctx.shadowBlur = trace.width * 0.9;
    drawPulsePath();
    ctx.stroke();

    // Layer 3: Bright white-hot core with color fringe
    ctx.strokeStyle = `hsla(${h}, 20%, 98%, 0.85)`;
    ctx.lineWidth = trace.width * 0.3;
    ctx.shadowColor = `hsl(${(h + 20) % 360}, ${s}%, ${Math.min(85, l + 10)}%)`;
    ctx.shadowBlur = trace.width * 0.4;
    drawPulsePath();
    ctx.stroke();

    ctx.restore();
  }

  _drawTraceEnergy(ctx, trace) {
    // Unlike the old all-or-nothing pulse, this is a quiet emissive coating on
    // selected conductors. It keeps the bevel legible while making the board
    // feel powered, optical, and considerably less like a static PCB diagram.
    const color = this.theme.traces[trace.colorIndex % this.theme.traces.length];
    const energetic = trace.width >= 8 || (trace.layer === 3 && trace.points.length > 4);
    if (!energetic) return;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = `hsla(${color.h}, ${color.s}%, ${Math.min(90, color.l + 24)}%, ${this.artDirection.glow})`;
    ctx.lineWidth = Math.max(1.2, trace.width * 0.19);
    ctx.shadowColor = `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
    ctx.shadowBlur = Math.max(3, trace.width * 0.55);
    ctx.beginPath();
    ctx.moveTo(trace.points[0].x, trace.points[0].y);
    for (let i = 1; i < trace.points.length; i++) ctx.lineTo(trace.points[i].x, trace.points[i].y);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draws small beveled pads at interior trace corners where direction changes by ≥45°.
   * Simulates real PCB solder pads at routing elbows, adding anatomical detail and depth.
   * @param {CanvasRenderingContext2D} ctx - Main canvas context
   * @param {CanvasRenderingContext2D} offCtx - Offscreen canvas context
   * @param {HTMLCanvasElement} offCanvas - Offscreen canvas element
   * @param {Object} trace - The trace object
   */
  _drawCornerJunctionPads(ctx, offCtx, offCanvas, trace) {
    const pts = trace.points;
    if (pts.length < 3) return;

    const junctionR = Math.max(trace.width * 0.8, 4.5);
    const colorStyle = this._getColorByIndex(trace.colorIndex);
    const MIN_ANGLE_CHANGE = Math.PI / 4; // 45 degrees

    for (let i = 1; i < pts.length - 1; i++) {
      const dx1 = pts[i].x - pts[i - 1].x;
      const dy1 = pts[i].y - pts[i - 1].y;
      const dx2 = pts[i + 1].x - pts[i].x;
      const dy2 = pts[i + 1].y - pts[i].y;

      const len1 = Math.hypot(dx1, dy1);
      const len2 = Math.hypot(dx2, dy2);
      if (len1 < 0.1 || len2 < 0.1) continue;

      // Dot product of normalized direction vectors to detect angle change
      const dot = (dx1 * dx2 + dy1 * dy2) / (len1 * len2);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

      if (angle >= MIN_ANGLE_CHANGE) {
        const clearR = junctionR + trace.bevelWidth + 6;
        offCtx.clearRect(pts[i].x - clearR, pts[i].y - clearR, clearR * 2, clearR * 2);

        this._drawSingleBeveledCircle(
          offCtx, pts[i].x, pts[i].y, junctionR, colorStyle,
          trace.bevelStyle === 'sunken' ? 'sunken' : 'raised',
          Math.max(1, trace.bevelWidth * 0.8),
          Math.max(1, trace.bevelBlur * 0.8),
          false
        );

        ctx.save();
        ctx.shadowColor = `rgba(0, 0, 0, ${trace.shadowOpacity * 0.8})`;
        ctx.shadowBlur = trace.shadowBlur * 0.7;
        ctx.shadowOffsetX = trace.shadowOffsetX * 0.6;
        ctx.shadowOffsetY = trace.shadowOffsetY * 0.6;
        ctx.drawImage(offCanvas, 0, 0);
        ctx.restore();
      }
    }
  }

  _drawPad(ctx, offCtx, offCanvas, pad, shadowOpacity, shadowBlur, shadowOffsetX, shadowOffsetY) {

    const clearPad = pad.r + pad.bevelWidth + 10;
    offCtx.clearRect(pad.x - clearPad, pad.y - clearPad, clearPad * 2, clearPad * 2);
    
    const colorStyle = this._getColorByIndex(pad.colorIndex);

    if (pad.type === 'smd') {
      this._drawSingleBeveledRect(offCtx, pad.x, pad.y, pad.r * 2, pad.r * 2, 0, colorStyle, pad.bevelStyle, pad.bevelWidth, pad.bevelBlur);
    } else {
      this._drawSingleBeveledCircle(offCtx, pad.x, pad.y, pad.r, colorStyle, pad.bevelStyle, pad.bevelWidth, pad.bevelBlur, false);
    }

    ctx.save();
    ctx.shadowColor = `rgba(0, 0, 0, ${shadowOpacity})`;
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetX = shadowOffsetX;
    ctx.shadowOffsetY = shadowOffsetY;
    ctx.drawImage(offCanvas, 0, 0);
    ctx.restore();
  }

  _drawComponent(ctx, offCtx, offCanvas, comp) {
    const clearPad = Math.max(comp.w || 0, comp.h || 0, (comp.r || 0) * 2) + 20;
    offCtx.clearRect(comp.x - clearPad, comp.y - clearPad, clearPad * 2, clearPad * 2);
    
    const colorStyle = this._getColorByIndex(comp.colorIndex);
    
    if (comp.type === 'chip') {
      this._drawChipComponent(offCtx, comp, colorStyle);
    } else if (comp.type === 'capacitor') {
      this._drawCapacitorComponent(offCtx, comp, colorStyle);
    } else if (comp.type === 'heatsink') {
      this._drawHeatSinkComponent(offCtx, comp, colorStyle);
    } else if (comp.type === 'led') {
      this._drawLEDComponent(offCtx, comp);
    } else if (comp.type === 'smd_resistor') {
      this._drawSMDResistor(offCtx, comp);
    } else if (comp.type === 'smd_transistor') {
      this._drawSMDTransistor(offCtx, comp);
    }

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = (comp.shadowBlur || 15) * 0.5;
    ctx.shadowOffsetX = (comp.shadowOffsetX || 5) * 0.5;
    ctx.shadowOffsetY = (comp.shadowOffsetY || 9) * 0.5;
    ctx.drawImage(offCanvas, 0, 0);
    ctx.restore();

    // Active LEDs environmental bloom disabled
  }

  /**
   * Draws a large-radius environmental light bloom from active LED components
   * onto the main canvas using screen blending, simulating how LEDs illuminate
   * their surrounding PCB substrate, traces, and nearby components.
   * @param {CanvasRenderingContext2D} ctx - Main canvas context (direct draw, not offscreen)
   * @param {Object} comp - The LED component object
   */
  _drawLEDEnvironmentalBloom(ctx, comp) {
    const { x, y, r, ledColor } = comp;

    let bloomR, bloomG, bloomB;
    if (ledColor === 'green') {
      bloomR = 0; bloomG = 255; bloomB = 60;
    } else if (ledColor === 'amber') {
      bloomR = 255; bloomG = 180; bloomB = 0;
    } else {
      bloomR = 255; bloomG = 30; bloomB = 30;
    }

    // Layer 1: Wide diffuse environmental bloom (large radius, very low opacity)
    const bloomRadius = r * 10;
    const boardGrad = ctx.createRadialGradient(x, y, r * 1.5, x, y, bloomRadius);
    boardGrad.addColorStop(0, `rgba(${bloomR}, ${bloomG}, ${bloomB}, 0.06)`);
    boardGrad.addColorStop(0.4, `rgba(${bloomR}, ${bloomG}, ${bloomB}, 0.02)`);
    boardGrad.addColorStop(1, `rgba(${bloomR}, ${bloomG}, ${bloomB}, 0)`);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = boardGrad;
    ctx.beginPath();
    ctx.arc(x, y, bloomRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Layer 2: Focused near-field illumination (strong but tight)
    const nearGrad = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 4);
    nearGrad.addColorStop(0, `rgba(${bloomR}, ${bloomG}, ${bloomB}, 0.12)`);
    nearGrad.addColorStop(0.5, `rgba(${bloomR}, ${bloomG}, ${bloomB}, 0.03)`);
    nearGrad.addColorStop(1, `rgba(${bloomR}, ${bloomG}, ${bloomB}, 0)`);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = nearGrad;
    ctx.beginPath();
    ctx.arc(x, y, r * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }



  _drawSMDResistor(offCtx, comp) {
    const { x, y, rotation, label } = comp;
    offCtx.save();
    offCtx.translate(x, y);
    offCtx.rotate(rotation);

    const w = 18;
    const h = 10;
    const capW = 3.5;

    // 1. Draw metal end caps (silver/gray)
    offCtx.fillStyle = '#c0c0c0';
    offCtx.fillRect(-w/2, -h/2, capW, h);
    offCtx.fillRect(w/2 - capW, -h/2, capW, h);

    // Light highlight on caps
    offCtx.fillStyle = '#e8e8e8';
    offCtx.fillRect(-w/2, -h/2, 1, h);
    offCtx.fillRect(w/2 - capW, -h/2, 1, h);

    // 2. Draw resistor body (dark gray/black)
    offCtx.fillStyle = '#2c2c2c';
    offCtx.fillRect(-w/2 + capW, -h/2, w - 2 * capW, h);

    // 3. Draw text label ("103", "472", etc.)
    offCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    offCtx.font = 'bold 5px sans-serif';
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.fillText(label, 0, 0);

    offCtx.restore();
  }

  _drawSMDTransistor(offCtx, comp) {
    const { x, y, rotation, label } = comp;
    offCtx.save();
    offCtx.translate(x, y);
    offCtx.rotate(rotation);

    const w = 20;
    const h = 12;
    
    // 1. Draw three legs (silver/gray)
    offCtx.fillStyle = '#b0b0b0';
    // Two legs on left (-w/2)
    offCtx.fillRect(-w/2 - 4, -h/2 + 2, 4, 2.5);
    offCtx.fillRect(-w/2 - 4, h/2 - 4.5, 4, 2.5);
    // One leg on right (w/2)
    offCtx.fillRect(w/2, -1.25, 4, 2.5);

    // Highlights on leg tips
    offCtx.fillStyle = '#e8e8e8';
    offCtx.fillRect(-w/2 - 4, -h/2 + 2, 1.5, 2.5);
    offCtx.fillRect(-w/2 - 4, h/2 - 4.5, 1.5, 2.5);
    offCtx.fillRect(w/2 + 2.5, -1.25, 1.5, 2.5);

    // 2. Draw transistor body (black beveled rect)
    offCtx.fillStyle = '#1e1e1e';
    offCtx.fillRect(-w/2, -h/2, w, h);

    // Small bevel edge highlights
    offCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    offCtx.lineWidth = 0.8;
    offCtx.strokeRect(-w/2, -h/2, w, h);

    // 3. Draw text label ("1AM", "2A", etc.)
    offCtx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    offCtx.font = 'bold 5px sans-serif';
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.fillText(label, 0, 0);

    offCtx.restore();
  }

  _drawChipComponent(offCtx, comp, colorStyle) {
    const { x, y, w, h, rotation, pins, label } = comp;
    
    offCtx.save();
    offCtx.translate(x, y);
    offCtx.rotate(rotation);

    // 1. Draw metal pins (underneath body)
    offCtx.fillStyle = '#b0b0b0';
    pins.forEach(pin => {
      offCtx.fillRect(pin.x, pin.y, pin.w, pin.h);
      
      offCtx.fillStyle = '#e8e8e8';
      offCtx.fillRect(pin.x + (pin.x < 0 ? 0 : pin.w - 2.5), pin.y, 2.5, pin.h);
      offCtx.fillStyle = '#b0b0b0';
    });

    offCtx.restore();

    // 2. Draw chip body (using beveled rectangle)
    this._drawSingleBeveledRect(offCtx, x, y, w, h, rotation, colorStyle, 'raised', 3.5, 2.5);

    // 3. Draw Polarity mark and silkscreen text
    offCtx.save();
    offCtx.translate(x, y);
    offCtx.rotate(rotation);

    // Polarity notch
    offCtx.fillStyle = 'rgba(10, 10, 10, 0.5)';
    offCtx.beginPath();
    offCtx.arc(-w/2 + 8, 0, 4, 0, Math.PI * 2);
    offCtx.fill();
    offCtx.strokeStyle = 'rgba(255,255,255,0.15)';
    offCtx.stroke();

    // Print text
    offCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    offCtx.font = 'bold 9px monospace';
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    
    // Draw multiline label
    const lines = label.split('\n');
    if (lines.length > 1) {
      offCtx.fillText(lines[0], 0, -6);
      offCtx.fillText(lines[1], 0, 6);
    } else {
      offCtx.fillText(label, 0, 0);
    }

    offCtx.restore();
  }

  _drawCapacitorComponent(offCtx, comp, colorStyle) {
    const { x, y, r, label } = comp;
    
    // Cylindrical capacitor body (beveled circle)
    this._drawSingleBeveledCircle(offCtx, x, y, r, colorStyle, 'raised', 3, 2, false);

    offCtx.save();
    offCtx.translate(x, y);
    
    // Negative terminal stripe
    offCtx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    offCtx.beginPath();
    offCtx.arc(0, 0, r, -Math.PI / 4, Math.PI / 4);
    offCtx.lineTo(0, 0);
    offCtx.closePath();
    offCtx.fill();

    // '-' marking inside stripe
    offCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    offCtx.font = 'bold 8px monospace';
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.fillText('-', r * 0.7, 0);

    // Value text
    offCtx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    offCtx.font = 'bold 7px monospace';
    offCtx.fillText(label, -r * 0.25, 0);

    offCtx.restore();
  }

  _drawSingleBeveledPath(offCtx, points, W, colorStyle, bevelStyle, bevelWidth, bevelBlur, ranges = null) {
    offCtx.save();
    
    const activeRanges = ranges || [[0, points.length - 1]];

    const drawPath = (ctx, dx = 0, dy = 0) => {
      ctx.beginPath();
      activeRanges.forEach(([start, end]) => {
        if (start >= end || end >= points.length) return;
        ctx.moveTo(points[start].x + dx, points[start].y + dy);
        for (let i = start + 1; i <= end; i++) {
          ctx.lineTo(points[i].x + dx, points[i].y + dy);
        }
      });
      ctx.stroke();
    };

    // 1. Draw base path
    offCtx.globalCompositeOperation = 'source-over';
    offCtx.strokeStyle = colorStyle;
    offCtx.lineWidth = W;
    offCtx.lineCap = 'round';
    offCtx.lineJoin = 'round';
    drawPath(offCtx);

    // Helper to apply highlight offsets using source-atop
    const applyHighlights = (lineWidth, shift, lightColor, darkColor) => {
      // Light highlight (top-left)
      offCtx.save();
      offCtx.globalCompositeOperation = 'source-atop';
      offCtx.shadowColor = lightColor;
      offCtx.shadowBlur = bevelBlur;
      offCtx.shadowOffsetX = 10000 - shift;
      offCtx.shadowOffsetY = 10000 - shift;
      drawPath(offCtx, -10000, -10000);
      offCtx.restore();

      // Dark shadow (bottom-right)
      offCtx.save();
      offCtx.globalCompositeOperation = 'source-atop';
      offCtx.shadowColor = darkColor;
      offCtx.shadowBlur = bevelBlur;
      offCtx.shadowOffsetX = 10000 + shift;
      offCtx.shadowOffsetY = 10000 + shift;
      drawPath(offCtx, -10000, -10000);
      offCtx.restore();
    };

    if (bevelStyle === 'raised') {
      applyHighlights(W, bevelWidth, 'rgba(255, 255, 255, 0.7)', 'rgba(0, 0, 0, 0.6)');
    } else if (bevelStyle === 'sunken') {
      applyHighlights(W, bevelWidth, 'rgba(0, 0, 0, 0.6)', 'rgba(255, 255, 255, 0.7)');
    } else if (bevelStyle === 'ridge') {
      // Outer raised bevel
      applyHighlights(W, bevelWidth, 'rgba(255, 255, 255, 0.7)', 'rgba(0, 0, 0, 0.6)');
      
      // Center raised stripe
      offCtx.globalCompositeOperation = 'source-over';
      offCtx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      offCtx.lineWidth = W / 3.2;
      offCtx.beginPath();
      offCtx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        offCtx.lineTo(points[i].x, points[i].y);
      }
      offCtx.stroke();
    } else if (bevelStyle === 'groove') {
      // Outer raised bevel
      applyHighlights(W, bevelWidth, 'rgba(255, 255, 255, 0.6)', 'rgba(0, 0, 0, 0.5)');
      
      // Center sunken groove
      offCtx.globalCompositeOperation = 'source-over';
      offCtx.strokeStyle = 'rgba(0, 0, 0, 0.38)';
      offCtx.lineWidth = W / 3.2;
      offCtx.beginPath();
      offCtx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        offCtx.lineTo(points[i].x, points[i].y);
      }
      offCtx.stroke();
    }

    // Hairline specular conductor: this is intentionally present across every
    // direction, binding the old physical bevel technique to the new optical
    // language without flattening the individual ridge/groove treatments.
    if (W >= 5 && this.artDirection) {
      offCtx.globalCompositeOperation = 'screen';
      offCtx.strokeStyle = this.artDirection.core;
      offCtx.lineWidth = Math.max(0.75, W * 0.075);
      drawPath(offCtx);
    }

    offCtx.restore();
  }

  _drawSingleBeveledCircle(offCtx, cx, cy, R, colorStyle, bevelStyle, bevelWidth, bevelBlur, isVia = false) {
    offCtx.save();

    // 1. Base circle
    offCtx.globalCompositeOperation = 'source-over';
    offCtx.fillStyle = colorStyle;
    offCtx.beginPath();
    offCtx.arc(cx, cy, R, 0, Math.PI * 2);
    offCtx.fill();

    // Helper to apply highlight offsets
    const applyCircleHighlights = (lightColor, darkColor) => {
      // Light
      offCtx.save();
      offCtx.globalCompositeOperation = 'source-atop';
      offCtx.shadowColor = lightColor;
      offCtx.shadowBlur = bevelBlur;
      offCtx.shadowOffsetX = 10000 - bevelWidth;
      offCtx.shadowOffsetY = 10000 - bevelWidth;
      offCtx.fillStyle = 'black';
      offCtx.beginPath();
      offCtx.arc(cx - 10000, cy - 10000, R, 0, Math.PI * 2);
      offCtx.fill();
      offCtx.restore();

      // Dark
      offCtx.save();
      offCtx.globalCompositeOperation = 'source-atop';
      offCtx.shadowColor = darkColor;
      offCtx.shadowBlur = bevelBlur;
      offCtx.shadowOffsetX = 10000 + bevelWidth;
      offCtx.shadowOffsetY = 10000 + bevelWidth;
      offCtx.fillStyle = 'black';
      offCtx.beginPath();
      offCtx.arc(cx - 10000, cy - 10000, R, 0, Math.PI * 2);
      offCtx.fill();
      offCtx.restore();
    };

    if (bevelStyle === 'raised') {
      applyCircleHighlights('rgba(255, 255, 255, 0.75)', 'rgba(0, 0, 0, 0.65)');
    } else if (bevelStyle === 'sunken') {
      applyCircleHighlights('rgba(0, 0, 0, 0.65)', 'rgba(255, 255, 255, 0.75)');
    }

    if (isVia) {
      // === Layer-Stack Via Depth Tunnel ===
      // Simulates looking down through: copper annular ring → FR4 epoxy → copper barrel → drill void

      // Layer 1: Copper annular ring (slightly inset from outer pad)
      offCtx.globalCompositeOperation = 'source-over';
      offCtx.fillStyle = 'rgba(180, 120, 50, 0.35)'; // Warm copper tone
      offCtx.beginPath();
      offCtx.arc(cx, cy, R * 0.52, 0, Math.PI * 2);
      offCtx.fill();

      // Layer 2: FR4 substrate ring (visible epoxy ring inside copper annular)
      const fr4Grad = offCtx.createRadialGradient(cx, cy, R * 0.28, cx, cy, R * 0.52);
      fr4Grad.addColorStop(0, 'rgba(30, 40, 25, 0.6)');
      fr4Grad.addColorStop(0.7, 'rgba(20, 30, 15, 0.45)');
      fr4Grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      offCtx.fillStyle = fr4Grad;
      offCtx.beginPath();
      offCtx.arc(cx, cy, R * 0.52, 0, Math.PI * 2);
      offCtx.fill();

      // Layer 3: Copper barrel plating (bright ring at the drill wall)
      offCtx.strokeStyle = 'rgba(200, 140, 60, 0.55)';
      offCtx.lineWidth = R * 0.08;
      offCtx.beginPath();
      offCtx.arc(cx, cy, R * 0.37, 0, Math.PI * 2);
      offCtx.stroke();

      // Layer 4: Deep drill void (near-black with subtle reflected light at the bottom)
      const voidGrad = offCtx.createRadialGradient(cx - R * 0.08, cy - R * 0.08, 0, cx, cy, R * 0.33);
      voidGrad.addColorStop(0, 'rgba(30, 25, 20, 0.9)');   // Slight warm reflection
      voidGrad.addColorStop(0.6, 'rgba(8, 6, 5, 0.95)');
      voidGrad.addColorStop(1, 'rgba(0, 0, 0, 1)');
      offCtx.fillStyle = voidGrad;
      offCtx.beginPath();
      offCtx.arc(cx, cy, R * 0.33, 0, Math.PI * 2);
      offCtx.fill();

      // Specular highlight at drill edge (top-left light source)
      offCtx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      offCtx.lineWidth = 0.8;
      offCtx.beginPath();
      offCtx.arc(cx, cy, R * 0.33, -Math.PI * 0.85, -Math.PI * 0.15);
      offCtx.stroke();
    }


    offCtx.restore();
  }

  _drawSingleBeveledRect(offCtx, cx, cy, w, h, rotation, colorStyle, bevelStyle, bevelWidth, bevelBlur) {
    offCtx.save();
    offCtx.translate(cx, cy);
    offCtx.rotate(rotation);

    // 1. Base rectangle
    offCtx.globalCompositeOperation = 'source-over';
    offCtx.fillStyle = colorStyle;
    offCtx.fillRect(-w/2, -h/2, w, h);

    // Helper to apply highlight offsets
    const applyRectHighlights = (lightColor, darkColor) => {
      // Light
      offCtx.save();
      offCtx.globalCompositeOperation = 'source-atop';
      offCtx.shadowColor = lightColor;
      offCtx.shadowBlur = bevelBlur;
      offCtx.shadowOffsetX = 10000 - bevelWidth;
      offCtx.shadowOffsetY = 10000 - bevelWidth;
      offCtx.fillStyle = 'black';
      offCtx.fillRect(-w/2 - 10000, -h/2 - 10000, w, h);
      offCtx.restore();

      // Dark
      offCtx.save();
      offCtx.globalCompositeOperation = 'source-atop';
      offCtx.shadowColor = darkColor;
      offCtx.shadowBlur = bevelBlur;
      offCtx.shadowOffsetX = 10000 + bevelWidth;
      offCtx.shadowOffsetY = 10000 + bevelWidth;
      offCtx.fillStyle = 'black';
      offCtx.fillRect(-w/2 - 10000, -h/2 - 10000, w, h);
      offCtx.restore();
    };

    if (bevelStyle === 'raised') {
      applyRectHighlights('rgba(255, 255, 255, 0.75)', 'rgba(0, 0, 0, 0.65)');
    } else if (bevelStyle === 'sunken') {
      applyRectHighlights('rgba(0, 0, 0, 0.65)', 'rgba(255, 255, 255, 0.75)');
    }

    offCtx.restore();
  }

  _getColorByIndex(idx) {
    const traceColor = this.theme.traces[idx % this.theme.traces.length];
    return `hsl(${traceColor.h}, ${traceColor.s}%, ${traceColor.l}%)`;
  }

  _createStyleGradient(ctx, trace, idx) {
    const { minX, minY, maxX, maxY } = trace.bbox;

    const padding = 20;
    const x1 = Math.max(0, minX - padding);
    const y1 = Math.max(0, minY - padding);
    const x2 = maxX + padding;
    const y2 = maxY + padding;

    const traceColor = this.theme.traces[idx % this.theme.traces.length];
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    
    const h = traceColor.h;
    const s = traceColor.s;
    const l = traceColor.l;

    grad.addColorStop(0, `hsl(${h}, ${s}%, ${l}%)`);
    grad.addColorStop(0.5, `hsl(${(h + 15) % 360}, ${Math.max(30, s - 10)}%, ${Math.min(90, l + 12)}%)`);
    grad.addColorStop(1, `hsl(${(h - 15 + 360) % 360}, ${s}%, ${Math.max(10, l - 12)}%)`);

    return grad;
  }

  _drawHeatSinkComponent(offCtx, comp, colorStyle) {
    const { x, y, w, h, pt } = comp;

    // Draw the main copper heat plate (sunken look)
    this._drawSingleBeveledRect(offCtx, x, y, w, h, 0, colorStyle, 'sunken', 2, 1.5);

    // Draw a series of solid vertical cooling fins/stripes instead of a grid of holes
    offCtx.save();
    offCtx.fillStyle = 'rgba(10, 10, 10, 0.45)';
    
    const finWidth = 5;
    const finSpacing = 10;
    const padding = 8;
    const startX = x - w/2 + padding;
    const endX = x + w/2 - padding;
    const startY = y - h/2 + padding;
    const endY = y + h/2 - padding;

    for (let fx = startX; fx <= endX; fx += finSpacing) {
      offCtx.fillRect(fx - finWidth/2, startY, finWidth, endY - startY);
    }

    // Technical text labels
    offCtx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    offCtx.font = 'bold 7px monospace';
    offCtx.textAlign = 'center';
    offCtx.fillText(`THERMAL ZONE: ${pt}°C`, x, y + h/2 - 4);
    
    offCtx.restore();
  }

  _drawLEDComponent(offCtx, comp) {
    const { x, y, r, ledColor } = comp;

    // LED package (small beveled circle base)
    this._drawSingleBeveledCircle(offCtx, x, y, r + 2.5, '#404040', 'raised', 1.2, 1, false);

    // Glow colors
    let coreColor, glowColor;
    if (ledColor === 'green') {
      coreColor = '#80ff80';
      glowColor = 'rgba(0, 255, 0, 0.2)';
    } else if (ledColor === 'amber') {
      coreColor = '#ffbf00';
      glowColor = 'rgba(255, 191, 0, 0.2)';
    } else if (ledColor === 'red') {
      coreColor = '#ff8080';
      glowColor = 'rgba(255, 0, 0, 0.2)';
    } else {
      coreColor = '#303030';
      glowColor = 'rgba(0,0,0,0)';
    }

    // Draw emissive light bloom underneath (disabled)

    // Draw active glowing inner dome
    offCtx.save();
    offCtx.globalCompositeOperation = 'source-over';
    offCtx.fillStyle = coreColor;
    offCtx.beginPath();
    offCtx.arc(x, y, r, 0, Math.PI * 2);
    offCtx.fill();

    // Highlight reflection on LED plastic dome
    offCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    offCtx.lineWidth = 0.8;
    offCtx.beginPath();
    offCtx.arc(x - r * 0.3, y - r * 0.3, r * 0.5, -Math.PI / 2, 0);
    offCtx.stroke();

    offCtx.restore();
  }
}
