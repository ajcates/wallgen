import { Style } from '../core/Style.js';
import { mapRange, randomRange, getCubicBezier, getQuadraticBezier } from '../utils/math.js';
import * as canvasUtils from '../utils/canvas.js';
import { Path2D, createCanvas } from '@napi-rs/canvas';
import { getEMA } from '../utils/data.js';

/**
 * TrillStyle: A postmodern abstract arrangement of shapes with gradients, 
 * borders, drop shadows, and data-driven micro-compositions.
 */
export class TrillStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.shapes = [];
    this.connections = [];
    this.energyCurves = [];
    this.miniChains = [];
    this.stripeGroups = [];
    this.orbitSystems = [];
    this.accentMarks = [];
    this.prismShards = [];
    this.sparkField = [];
    this.contourEchoes = [];
    this.interlocks = [];
    this.structuralPlanes = [];
    this.decalClusters = [];
    this.trillSignature = null;
    this.palette = [];
    this.glyphCache = [];
    this.glyphInstances = [];
    this.shapeLayers = { background: [], foreground: [] };
    this.hubs = [];
    this.focalShape = null;
    this.compositionAxis = null;
    this.gazeRoute = [];
    this.shapeBuffer = null;
    this.patternCache = new Map();
    this.shapeTypeDeck = [];
    this.shapeTypeDeckKey = '';
    // Keep the silhouette library in one place so generation and validation
    // cannot drift apart as Trill gains new visual actors.
    this.shapeTypes = [
      'rect', 'circle', 'polygon', 'trapezoid', 'spike', 'donut', 'sphere', 'cube',
      'sliced-rect', 'sliced-circle', 'wobble-circle', 'wobble-rect', 'tetromino',
      'capsule', 'arch', 'crescent', 'starburst', 'clover', 'lightning-bolt'
    ];
    this.compositionModes = ['diagonal-relay', 'orbital-counterweight', 'horizon-tension', 'totem-stack', 'corner-cascade'];
    this.compositionMode = this.compositionModes.includes(config.trillComposition)
      ? config.trillComposition
      : this.compositionModes[Math.floor(Math.random() * this.compositionModes.length)];
    this.finishModes = ['prismatic-lacquer', 'risograph-noir', 'signal-neon'];
    this.finishMode = this.finishModes.includes(config.trillFinish)
      ? config.trillFinish
      : this.finishModes[Math.floor(Math.random() * this.finishModes.length)];
    this.lightAngle = randomRange(0, Math.PI * 2);
    this.paletteType = ['analogous', 'complementary', 'triadic', 'monochromatic', 'split', 'tetradic'][Math.floor(Math.random() * 6)];
    this.dofEnabled = config.dofEnabled !== undefined ? (config.dofEnabled === 'true' || config.dofEnabled === true) : true;
    this.dofBlurAmt = config.dofBlurAmt !== undefined ? Number(config.dofBlurAmt) : 2.25;
  }

  // --- 1. SETUP STAGE ---

  async init(data) {
    await super.init(data);
    this.allData = data && data.length > 0 ? data : [];
    this.latest = (this.allData.length > 0) 
      ? this.allData[this.allData.length - 1] 
      : { hh: 12, mm: 0, bp: 100, fm: 50 };

    this.latest.bpSmoothed = this.allData.length > 0 ? getEMA(this.allData, 'bp', 0.35) : (this.latest.bp || 100);
    this.latest.fmSmoothed = this.allData.length > 0 ? getEMA(this.allData, 'fm', 0.3) : (this.latest.fm || 50);
    this.latest.ptSmoothed = this.allData.length > 0 ? getEMA(this.allData, 'pt', 0.4) : (this.latest.pt || 50);

    this.isSymmetrical = (this.latest.bpSmoothed) > 70 || Math.random() > 0.7;
    
    // Parallax snapshot based on time
    this.parallaxX = mapRange(this.latest.mm || 0, 0, 60, -30, 30);
    this.parallaxY = mapRange(this.latest.hh || 12, 0, 24, -30, 30);

    this._initPalette(this.latest);
    this._generateComposition(this.latest);
    this._generateGlyphs(this.latest);
    this._preRenderPatterns();
    this._createPaperTexture();
  }

  _generateGlyphs(entry) {
    this.glyphCache = [];
    this.glyphInstances = [];
    const up = entry.up || 3600;
    const complexity = Math.floor(mapRange(up % 86400, 0, 86400, 3, 7));
    for (let i = 0; i < 8; i++) {
      this.glyphCache.push(this._buildGlyphPath(complexity));
    }
    for (let i = 0; i < 8; i++) {
      this.glyphInstances.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        path: this.glyphCache[Math.floor(Math.random() * this.glyphCache.length)],
        rotation: Math.floor(Math.random() * 4) * Math.PI / 2,
        scale: randomRange(1.2, 3),
        filled: Math.random() > 0.85
      });
    }
  }

  _buildGlyphPath(complexity) {
    const p = new Path2D(), size = 40, cell = size / 3;
    for (let i = 0; i < complexity; i++) {
      const cx = Math.floor(Math.random() * 3), cy = Math.floor(Math.random() * 3);
      const x = cx * cell - size / 2, y = cy * cell - size / 2;
      const type = Math.floor(Math.random() * 4);
      if (type === 0) { p.moveTo(x, y); p.lineTo(x + cell, y + cell); }
      else if (type === 1) { p.moveTo(x + cell, y); p.lineTo(x, y + cell); }
      else if (type === 2) { p.rect(x + 2, y + 2, cell - 4, cell - 4); }
      else { p.moveTo(x + cell / 2, y); p.arc(x + cell / 2, y + cell / 2, cell / 2, -Math.PI / 2, Math.PI / 2); }
    }
    return p;
  }

  _initPalette(entry) {
    const bp = entry.bpSmoothed !== undefined ? entry.bpSmoothed : (entry.bp || 100);
    const saturation = mapRange(bp, 0, 100, 60, 95);
    this.palette = [];
    const addColor = (h, s, l) => this.palette.push({ h: (h + 360) % 360, s, l });

    const THEMES = [
      { name: 'Midnight', hues: [220, 260, 280, 200], sat: [80, 70, 60], light: [50, 40, 30] },
      { name: 'CyberNeon', hues: [300, 180, 190, 320], sat: [100, 90, 95], light: [60, 55, 50] },
      { name: 'Clay & Ochre', hues: [20, 35, 45, 10], sat: [70, 60, 50], light: [65, 55, 45] },
      { name: 'Nordic Forest', hues: [160, 140, 180, 200], sat: [40, 30, 35], light: [45, 35, 25] },
      { name: 'Swiss Clean', hues: [0, 210, 0, 210], sat: [0, 80, 0, 90], light: [90, 60, 40, 50] },
      { name: 'Vaporwave', hues: [330, 270, 190, 200], sat: [90, 85, 80], light: [70, 65, 60] },
      { name: 'Deep Sea', hues: [210, 190, 230, 170], sat: [90, 80, 70], light: [40, 30, 20] },
      { name: 'Royal Gold', hues: [45, 280, 40, 260], sat: [80, 60, 70], light: [60, 40, 50] },
      { name: 'Electric Lime', hues: [70, 200, 80, 220], sat: [100, 80, 90], light: [65, 55, 45] },
      { name: 'Post-Digital', hues: [10, 190, 200, 350], sat: [20, 30, 15], light: [80, 70, 60] }
    ];

    if (Math.random() > 0.4) {
      // Use Designer Theme
      const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
      theme.hues.forEach((h, i) => {
        const s = theme.sat[i % theme.sat.length];
        const l = theme.light[i % theme.light.length];
        addColor(h, s, l);
      });
    } else {
      // Use Generative Logic (Improved)
      const baseHue = Math.random() * 360;
      if (this.paletteType === 'analogous') {
        addColor(baseHue, saturation, 65);
        addColor(baseHue + 25, saturation - 10, 55);
        addColor(baseHue - 25, saturation - 10, 55);
        addColor(baseHue + 45, saturation - 5, 45);
      } else if (this.paletteType === 'split') {
        addColor(baseHue, saturation, 65);
        addColor(baseHue + 150, saturation - 5, 60);
        addColor(baseHue + 210, saturation - 5, 60);
        addColor(baseHue + 180, saturation - 15, 35);
      } else if (this.paletteType === 'tetradic') {
        addColor(baseHue, saturation, 65);
        addColor(baseHue + 60, saturation - 10, 60);
        addColor(baseHue + 180, saturation, 55);
        addColor(baseHue + 240, saturation - 10, 50);
      } else if (this.paletteType === 'triadic') {
        addColor(baseHue, saturation, 65);
        addColor(baseHue + 120, saturation - 5, 60);
        addColor(baseHue + 240, saturation - 5, 60);
        addColor(baseHue, saturation - 20, 35);
      } else if (this.paletteType === 'monochromatic') {
        for(let i=0; i<4; i++) {
          addColor(baseHue, saturation - (i * 20), 85 - (i * 20));
        }
      } else {
        addColor(baseHue, saturation, 65);
        addColor(baseHue + 180, saturation, 60);
        addColor(baseHue + 180, saturation - 20, 35);
        addColor(baseHue, saturation - 20, 35);
      }
    }
    this.palette.push({ h: 0, s: 0, l: 100 });
  }

  _createPaperTexture() {
    const size = 256;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 20;
      const val = Math.max(0, Math.min(255, 245 + noise));
      data[i] = val;
      data[i+1] = val;
      data[i+2] = val;
      data[i+3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * size, y = Math.random() * size;
      if (Math.random() > 0.3) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)';
        ctx.beginPath(); ctx.arc(x, y, Math.random() * 1.5, 0, Math.PI * 2); ctx.fill();
      } else {
        const len = Math.random() * 20 + 5, ang = Math.random() * Math.PI * 2;
        ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.08)';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); ctx.stroke();
      }
    }
    this.paperTexture = canvas;
  }

  _preRenderPatterns() {
    this.patternCache.clear();
    const types = ['dots', 'lines', 'grid', 'halftone', 'pixel-grid'];
    types.forEach(type => {
      const spacing = type === 'halftone' ? 12 : 10;
      const tile = createCanvas(spacing, spacing);
      const pctx = tile.getContext('2d');
      pctx.strokeStyle = 'rgba(255,255,255,0.4)';
      pctx.lineWidth = 0.5;
      if (type === 'dots') {
        pctx.fillStyle = 'rgba(255,255,255,0.6)';
        pctx.beginPath(); pctx.arc(spacing/2, spacing/2, 1, 0, Math.PI*2); pctx.fill();
      } else if (type === 'grid') {
        pctx.strokeRect(0, 0, spacing, spacing);
      } else if (type === 'pixel-grid') {
        pctx.fillStyle = 'rgba(255,255,255,0.3)';
        pctx.fillRect(1, 1, 3, 3); pctx.fillRect(6, 6, 2, 2);
      } else if (type === 'halftone') {
        pctx.fillStyle = 'rgba(255,255,255,0.8)';
        const r = 1.5;
        pctx.beginPath(); pctx.arc(0, 0, r, 0, Math.PI*2); pctx.arc(spacing, 0, r, 0, Math.PI*2);
        pctx.arc(0, spacing, r, 0, Math.PI*2); pctx.arc(spacing, spacing, r, 0, Math.PI*2);
        pctx.arc(spacing/2, spacing/2, r * 1.5, 0, Math.PI*2); pctx.fill();
      } else {
        pctx.beginPath(); pctx.moveTo(0, 0); pctx.lineTo(spacing, spacing); pctx.stroke();
      }
      this.patternCache.set(type, tile);
    });
  }

  // --- 2. COMPOSITION STAGE ---

  _generateComposition(entry) {
    this.shapes = []; this.connections = []; this.energyCurves = []; this.miniChains = []; this.stripeGroups = []; this.orbitSystems = []; this.accentMarks = []; this.prismShards = []; this.sparkField = []; this.contourEchoes = []; this.interlocks = []; this.structuralPlanes = []; this.decalClusters = []; this.trillSignature = null;
    this.shapeTypeDeck = [];
    this.shapeTypeDeckKey = '';
    const fm = entry.fmSmoothed !== undefined ? entry.fmSmoothed : (entry.fm || 50);
    const numClusters = mapRange(fm, 0, 100, 1, 4);
    this._generateClusters(numClusters, entry);
    this._generateShapes(Math.floor(randomRange(4, 8)), entry);
    this._promoteDepthActors();
    this._establishFocalHierarchy(entry);
    this._applyCompositionMode();
    this._applyOpticalBalance();
    this._generateStructuralPlanes();
    this._generatePrintRegistration();
    this._generateConnections();
    this._generateGazeRoute();
    this._balanceConnectionStripes();
    this._generateTrillSignature(entry);
    this._generateDecalClusters();
    this._generateInterlocks();
    this._generateEnergyCurves();
    this._generateMiniChains();
    this._generateStripeGroups();
    this._generateOrbitSystems(entry);
    this._generateAccentMarks(entry);
    this._generatePrismShards();
    this._generateSparkField(entry);
    this._generateContourEchoes();
    this._indexComposition();
  }

  // Composition system 1: make one large form an intentional focal anchor.
  // Its off-centre golden-ratio placement preserves tension without making the
  // frame feel accidental. Neighbouring satellites move only part way so the
  // original clustered language remains intact.
  _establishFocalHierarchy(entry) {
    const candidates = this.shapes.filter(shape => shape.isHub);
    if (!candidates.length) return;

    const focal = [...candidates].sort((a, b) => b.size - a.size)[0];
    const onRight = (entry.mm || 0) >= 30;
    const target = {
      x: this.width * (onRight ? 0.62 : 0.38),
      y: this.height * 0.43
    };
    const dx = target.x - focal.x;
    const dy = target.y - focal.y;
    focal.x = target.x;
    focal.y = target.y;
    focal.layer = 'foreground';
    focal.depth = Math.max(focal.depth, 36);
    focal.isFocal = true;
    focal.hasGhost = true;
    focal.ghostCount = Math.max(focal.ghostCount, 6);

    const focalIndex = this.shapes.indexOf(focal);
    for (const connection of this.connections) {
      if (connection.from !== focalIndex && connection.to !== focalIndex) continue;
      const satellite = this.shapes[connection.from === focalIndex ? connection.to : connection.from];
      if (!satellite || satellite.isHub) continue;
      satellite.x += dx * 0.42;
      satellite.y += dy * 0.42;
    }
    this.focalShape = focal;
  }

  _promoteDepthActors() {
    const candidates = [...this.shapes].sort((a, b) => b.size - a.size);
    const actors = candidates.filter(shape => shape.layer === 'foreground').slice(0, 2);
    const primary = actors[0] || candidates[0];
    if (!primary) return;
    primary.layer = 'foreground';
    primary.isNearCamera = true;
    primary.popDepth = Math.max(primary.popDepth || 0, primary.size * 0.3);
    primary.depth = Math.max(primary.depth, 52);

    // Tetrominoes appear in most, but not every, generation. They are kept to
    // one supporting actor so the scene still has breathing room.
    if (!this.shapes.some(shape => shape.shapeType === 'tetromino') && Math.random() > 0.28) {
      const tetromino = actors[1] || candidates[1];
      if (tetromino) {
        tetromino.shapeType = 'tetromino';
        tetromino.tetrominoBlocks = this._createTetrominoBlocks(tetromino.size);
        tetromino.path = this._buildPath('tetromino', tetromino.size, tetromino.tetrominoBlocks, tetromino.shapeVariation);
        tetromino.rotation = [Math.PI / 6, Math.PI / 4, -Math.PI / 6, -Math.PI / 4][Math.floor(Math.random() * 4)];
      }
    }
  }

  // Five separate arrangement grammars keep Trill's output varied at the
  // compositional level. They share the same palette/material system, but each
  // routes mass and negative space differently around the focal actor.
  _applyCompositionMode() {
    if (!this.focalShape) return;
    const focal = this.focalShape;
    const supporting = this.shapes.filter(shape => shape !== focal);
    const clamp = (shape) => {
      const margin = shape.size * 0.32;
      shape.x = Math.max(margin, Math.min(this.width - margin, shape.x));
      shape.y = Math.max(margin, Math.min(this.height - margin, shape.y));
    };

    if (this.compositionMode === 'diagonal-relay') {
      const direction = focal.x < this.width / 2 ? 1 : -1;
      supporting.forEach((shape, i) => {
        const t = supporting.length < 2 ? 0.5 : i / (supporting.length - 1);
        const targetX = this.width * (direction > 0 ? 0.13 + t * 0.72 : 0.87 - t * 0.72);
        const targetY = this.height * (0.18 + t * 0.62);
        shape.x += (targetX - shape.x) * 0.34;
        shape.y += (targetY - shape.y) * 0.34;
        shape.rotation += direction * (t - 0.5) * 0.28;
        clamp(shape);
      });
    } else if (this.compositionMode === 'orbital-counterweight') {
      const direction = focal.x < this.width / 2 ? 1 : -1;
      supporting.forEach((shape, i) => {
        const angle = Math.PI * (0.55 + (i / Math.max(1, supporting.length - 1)) * 0.9) * direction;
        const radius = focal.size * (0.72 + (i % 3) * 0.19);
        const targetX = focal.x + Math.cos(angle) * radius;
        const targetY = focal.y + Math.sin(angle) * radius * 0.68;
        shape.x += (targetX - shape.x) * 0.3;
        shape.y += (targetY - shape.y) * 0.3;
        clamp(shape);
      });
    } else if (this.compositionMode === 'horizon-tension') {
      supporting.forEach((shape, i) => {
        const t = supporting.length < 2 ? 0.5 : i / (supporting.length - 1);
        const targetX = this.width * (0.12 + t * 0.76);
        const targetY = focal.y + (i % 2 ? -1 : 1) * this.height * (0.1 + (i % 3) * 0.025);
        shape.x += (targetX - shape.x) * 0.32;
        shape.y += (targetY - shape.y) * 0.24;
        shape.rotation = (i % 2 ? -1 : 1) * randomRange(Math.PI / 20, Math.PI / 9);
        clamp(shape);
      });
    } else if (this.compositionMode === 'totem-stack') {
      const side = focal.x < this.width / 2 ? 1 : -1;
      supporting.forEach((shape, i) => {
        const t = supporting.length < 2 ? 0.5 : i / (supporting.length - 1);
        const targetX = focal.x + side * this.width * (0.09 + (i % 2) * 0.075);
        const targetY = this.height * (0.16 + t * 0.68);
        shape.x += (targetX - shape.x) * 0.28;
        shape.y += (targetY - shape.y) * 0.4;
        shape.rotation = (i % 2 ? -1 : 1) * randomRange(Math.PI / 18, Math.PI / 12);
        clamp(shape);
      });
    } else if (this.compositionMode === 'corner-cascade') {
      const fromRight = focal.x < this.width / 2;
      supporting.forEach((shape, i) => {
        const t = supporting.length < 2 ? 0.5 : i / (supporting.length - 1);
        const targetX = this.width * (fromRight ? 0.88 - t * 0.56 : 0.12 + t * 0.56);
        const targetY = this.height * (0.12 + t * 0.7);
        shape.x += (targetX - shape.x) * 0.36;
        shape.y += (targetY - shape.y) * 0.36;
        shape.rotation += (fromRight ? -1 : 1) * 0.18;
        clamp(shape);
      });
    }
  }

  // Composition system 2: counterweight the focal mass with the remaining
  // shapes. This is optical, not mirrored, balance: the focal anchor stays
  // dominant while smaller forms quietly pull the centre of mass back in.
  _applyOpticalBalance() {
    if (!this.focalShape) return;
    const supporting = this.shapes.filter(shape => shape !== this.focalShape);
    const totalWeight = supporting.reduce((sum, shape) => sum + shape.size * shape.size, 0);
    if (!totalWeight) return;

    const centroid = supporting.reduce((point, shape) => {
      const weight = shape.size * shape.size;
      point.x += shape.x * weight;
      point.y += shape.y * weight;
      return point;
    }, { x: 0, y: 0 });
    centroid.x /= totalWeight;
    centroid.y /= totalWeight;

    const focalWeight = this.focalShape.size * this.focalShape.size * 1.3;
    const desiredCentroid = {
      x: (this.width * 0.5 * (totalWeight + focalWeight) - this.focalShape.x * focalWeight) / totalWeight,
      y: (this.height * 0.47 * (totalWeight + focalWeight) - this.focalShape.y * focalWeight) / totalWeight
    };
    const correctionX = Math.max(-this.width * 0.13, Math.min(this.width * 0.13, desiredCentroid.x - centroid.x));
    const correctionY = Math.max(-this.height * 0.1, Math.min(this.height * 0.1, desiredCentroid.y - centroid.y));
    for (const shape of supporting) {
      const influence = Math.max(0.35, Math.min(1, shape.size / (this.focalShape.size * 0.65)));
      const margin = shape.size * 0.28;
      shape.x = Math.max(margin, Math.min(this.width - margin, shape.x + correctionX * influence));
      shape.y = Math.max(margin, Math.min(this.height - margin, shape.y + correctionY * influence));
    }
    this.compositionAxis = { x: this.focalShape.x - this.width * 0.5, y: this.focalShape.y - this.height * 0.47 };
  }

  // Composition system 3: a deliberate three-stop route gives the eye an
  // entry point, a focal destination, and an exit point instead of leaving all
  // connections to chance.
  _generateGazeRoute() {
    if (!this.focalShape) return;
    const focal = this.focalShape;
    const selectNearest = (x, y) => [...this.shapes]
      .filter(shape => shape !== focal)
      .sort((a, b) => ((a.x - x) ** 2 + (a.y - y) ** 2) - ((b.x - x) ** 2 + (b.y - y) ** 2))[0];
    const entering = selectNearest(focal.x < this.width / 2 ? this.width * 0.16 : this.width * 0.84, this.height * 0.25);
    const exiting = selectNearest(focal.x < this.width / 2 ? this.width * 0.78 : this.width * 0.22, this.height * 0.72);
    const route = [entering, focal, exiting].filter(Boolean);
    this.gazeRoute = route;

    for (let i = 0; i < route.length - 1; i++) {
      const from = route[i], to = route[i + 1];
      if (from === to) continue;
      const dx = to.x - from.x, dy = to.y - from.y;
      const distance = Math.hypot(dx, dy) || 1;
      const bend = Math.min(this.width * 0.1, distance * 0.22) * (i === 0 ? -1 : 1);
      this.connections.push({
        from: this.shapes.indexOf(from), to: this.shapes.indexOf(to), color: focal.color,
        width: 5.2, stripeType: 'triple', layer: 'midground', gazeGuide: true,
        controlPoint: { x: (from.x + to.x) / 2 - (dy / distance) * bend, y: (from.y + to.y) / 2 + (dx / distance) * bend }
      });
    }
  }

  // Trill's recognisable mark: a deliberately off-register aperture around
  // the focal form, plus a small modular beat sequence that travels the gaze
  // route. It makes the visual language feel authored rather than merely busy.
  _generateTrillSignature(entry) {
    if (!this.focalShape) return;
    const focal = this.focalShape;
    const route = this.gazeRoute.length > 1 ? this.gazeRoute : [focal];
    const paletteSize = Math.max(1, this.palette.length - 1);
    const frames = [0.98, 1.18, 1.42].map((scale, index) => ({
      scale,
      rotation: focal.rotation + (index - 1) * randomRange(0.045, 0.12),
      offsetX: (index - 1) * focal.size * 0.045,
      offsetY: (1 - index) * focal.size * 0.035,
      color: this.palette[(index + Math.floor((entry.ptSmoothed ?? entry.pt ?? 0) / 25)) % paletteSize],
      corner: index % 2 === 0 ? 'open-ne' : 'open-sw'
    }));
    const beats = [];
    for (let segment = 0; segment < route.length - 1; segment++) {
      const from = route[segment], to = route[segment + 1];
      for (const t of [0.22, 0.52, 0.79]) {
        beats.push({
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t,
          rotation: Math.atan2(to.y - from.y, to.x - from.x),
          size: Math.max(7, focal.size * (0.065 - t * 0.02)),
          kind: (segment + Math.round(t * 10)) % 3,
          color: this.palette[(segment * 2 + Math.round(t * 10)) % paletteSize]
        });
      }
    }
    this.trillSignature = {
      focal,
      frames,
      beats,
      apertureRadius: focal.size * 1.12,
      apertureHue: this.palette[(this.palette.indexOf(focal.color) + 1 + paletteSize) % paletteSize].h
    };
  }

  // A few chunky bridges let neighbouring forms physically overlap and read as
  // one assembled object. Keeping the count low makes those moments feel like
  // depth events rather than a blanket visual effect.
  _generateInterlocks() {
    const candidates = this.shapes
      .filter(shape => shape.layer === 'foreground' && shape !== this.focalShape)
      .sort((a, b) => b.size - a.size)
      .slice(0, 5);
    const anchors = this.focalShape ? [this.focalShape, ...candidates] : candidates;
    const count = Math.min(2, Math.max(1, Math.floor(anchors.length / 3)));
    for (let i = 0; i < count; i++) {
      const from = anchors[i];
      const to = anchors.slice(i + 1).sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
      if (!from || !to) continue;
      const dx = to.x - from.x, dy = to.y - from.y, distance = Math.hypot(dx, dy) || 1;
      const reach = Math.min(distance * 0.48, (from.size + to.size) * 0.34);
      this.interlocks.push({
        from, to, width: Math.min(from.size, to.size) * randomRange(0.16, 0.27),
        bend: Math.min(this.width * 0.08, distance * 0.16) * (i % 2 ? 1 : -1),
        reach, color: i === 0 ? from.color : to.color
      });
    }
  }

  // Trill system 1: tilted translucent slabs make the scene read like a
  // constructed poster or architectural collage instead of loose objects.
  _generateStructuralPlanes() {
    const focal = this.focalShape;
    if (!focal) return;
    for (let i = 0; i < 2; i++) {
      const opposite = i === 0 ? -1 : 1;
      this.structuralPlanes.push({
        x: focal.x + opposite * this.width * randomRange(0.14, 0.26),
        y: focal.y + (i === 0 ? -1 : 1) * this.height * randomRange(0.09, 0.18),
        w: this.width * randomRange(0.2, 0.34), h: this.height * randomRange(0.11, 0.19),
        rotation: (i === 0 ? -1 : 1) * randomRange(Math.PI / 18, Math.PI / 8),
        color: this.palette[(i + 1) % (this.palette.length - 1)]
      });
    }
  }

  // Trill system 2: a deliberately imperfect screen-print registration is
  // assigned to only a couple of forms, keeping the misalignment expressive.
  _generatePrintRegistration() {
    const candidates = this.shapes.filter(shape => shape.layer === 'foreground' && !shape.isFocal);
    for (const shape of candidates.sort(() => Math.random() - 0.5).slice(0, 2)) {
      shape.registration = {
        x: randomRange(-7, 7), y: randomRange(-7, 7),
        color: this.palette[Math.floor(Math.random() * (this.palette.length - 1))]
      };
    }
  }

  // Trill system 3: small, repeated decals give negative space a playful
  // editorial rhythm while echoing the larger geometry.
  _generateDecalClusters() {
    const anchors = this.gazeRoute.length ? this.gazeRoute : this.shapes.filter(shape => shape.isHub);
    for (const anchor of anchors.slice(0, 3)) {
      const count = Math.floor(randomRange(3, 7));
      const tiles = [];
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + randomRange(-0.3, 0.3);
        const radius = anchor.size * randomRange(0.55, 0.84);
        tiles.push({ x: anchor.x + Math.cos(angle) * radius, y: anchor.y + Math.sin(angle) * radius, size: randomRange(5, 13), rotation: angle, triangle: Math.random() > 0.45 });
      }
      this.decalClusters.push({ tiles, color: anchor.color });
    }
  }

  _generatePrismShards() {
    for (const hub of this.shapes.filter(shape => shape.isHub).slice(0, 3)) {
      const count = Math.floor(randomRange(2, 5));
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = hub.size * randomRange(0.34, 0.68);
        this.prismShards.push({
          x: hub.x + Math.cos(angle) * distance,
          y: hub.y + Math.sin(angle) * distance,
          size: hub.size * randomRange(0.1, 0.24),
          rotation: angle + randomRange(-0.7, 0.7),
          color: this.palette[Math.floor(Math.random() * (this.palette.length - 1))]
        });
      }
    }
  }

  _generateSparkField(entry) {
    const count = Math.round(mapRange(entry.ptSmoothed ?? entry.pt ?? 50, 0, 200, 18, 52));
    for (let i = 0; i < count; i++) {
      const color = this.palette[i % (this.palette.length - 1)];
      this.sparkField.push({
        x: randomRange(0, this.width), y: randomRange(0, this.height),
        radius: randomRange(0.7, 2.1), alpha: randomRange(0.12, 0.48),
        cross: Math.random() > 0.72, color
      });
    }
  }

  _generateContourEchoes() {
    const candidates = this.shapes.filter(shape => shape.layer === 'foreground' && shape.size > this.width * 0.12);
    for (const shape of candidates.slice(0, 3)) {
      this.contourEchoes.push({
        shape,
        scale: randomRange(1.12, 1.26),
        rotation: randomRange(-0.08, 0.08),
        color: this.palette[(this.palette.indexOf(shape.color) + 1) % (this.palette.length - 1)] || this.palette[0]
      });
    }
  }

  _indexComposition() {
    // Keep generation order intact: connections store shape indices, so sorting
    // this.shapes here would silently reconnect lines to the wrong geometry.
    this.shapeLayers = {
      background: this.shapes.filter(shape => shape.layer === 'background'),
      foreground: this.shapes.filter(shape => shape.layer === 'foreground')
    };
    this.hubs = this.shapes.filter(shape => shape.isHub);
  }

  // --- Five finishing systems: backdrop, focal orbits, material rims,
  // junction nodes, and print-registration accents. ---

  _generateOrbitSystems(entry) {
    const hubs = this.shapes.filter(shape => shape.isHub);
    const activity = entry.ptSmoothed !== undefined ? entry.ptSmoothed : (entry.pt || 50);
    for (const hub of hubs.slice(0, 3)) {
      this.orbitSystems.push({
        x: hub.x,
        y: hub.y,
        radius: hub.size * randomRange(0.58, 0.78),
        rotation: ((entry.hh || 12) / 24) * Math.PI * 2 + randomRange(-0.4, 0.4),
        segments: Math.max(2, Math.min(5, Math.round(mapRange(activity, 0, 200, 2, 5)))),
        color: hub.color,
        layer: hub.layer === 'foreground' ? 'foreground' : 'midground'
      });
    }
  }

  _generateAccentMarks(entry) {
    const count = Math.max(3, Math.min(8, Math.round(mapRange(entry.fmSmoothed ?? entry.fm ?? 50, 0, 100, 3, 8))));
    for (let i = 0; i < count; i++) {
      const color = this.palette[i % (this.palette.length - 1)];
      this.accentMarks.push({
        x: randomRange(this.width * 0.08, this.width * 0.92),
        y: randomRange(this.height * 0.1, this.height * 0.9),
        length: randomRange(18, 52),
        angle: Math.floor(randomRange(0, 4)) * Math.PI / 2,
        color
      });
    }
  }

  _generateClusters(count, entry) {
    const skewAngles = [randomRange(-0.25, -0.1), randomRange(0.1, 0.25)];
    const ghostAngle = mapRange(entry.hh || 12, 0, 24, 0, Math.PI * 2);
    for (let c = 0; c < count; c++) {
      const hx = randomRange(this.width * 0.15, this.width * 0.85);
      const hy = randomRange(this.height * 0.15, this.height * 0.85);
      const hubColor = this.palette[Math.floor(Math.random() * (this.palette.length - 1))];
      const hubSize = randomRange(this.width * 0.2, this.width * 0.35);
      const hub = this._createShape(hx, hy, c * 10, ghostAngle, skewAngles[0], Math.random() > 0.7, hubColor, hubSize);
      hub.isHub = true; this.shapes.push(hub);
      const numSatellites = Math.floor(randomRange(2, 5));
      for (let s = 0; s < numSatellites; s++) {
        const dist = randomRange(hubSize * 0.4, hubSize * 0.8), ang = Math.random() * Math.PI * 2;
        const sx = hx + Math.cos(ang) * dist, sy = hy + Math.sin(ang) * dist;
        const sColor = Math.random() > 0.3 ? hubColor : this.palette[Math.floor(Math.random() * (this.palette.length - 1))];
        const sSize = hubSize * randomRange(0.2, 0.5);
        const sat = this._createShape(sx, sy, c * 10 + s + 1, ghostAngle, skewAngles[1], false, sColor, sSize);
        sat.layer = 'foreground'; this.shapes.push(sat);
        this.connections.push({ from: this.shapes.indexOf(hub), to: this.shapes.indexOf(sat), color: hubColor, width: randomRange(2, 5), stripeType: 'single', layer: 'midground' });
      }
    }
  }

  _generateShapes(count, entry) {
    const centerX = this.width / 2, centerY = this.height * 0.45;
    const skewAngles = [randomRange(-0.25, -0.1), randomRange(0.1, 0.25)];
    const useGrid = Math.random() > 0.3, gridCols = 3, gridRows = 5;
    const cellW = this.width / (gridCols + 1), cellH = this.height / (gridRows + 1);
    const ghostAngle = mapRange(entry.hh || 12, 0, 24, 0, Math.PI * 2);
    const ghostIndices = [];
    while(ghostIndices.length < Math.min(Math.floor(randomRange(1, 3)), count)) {
      const idx = Math.floor(Math.random() * count);
      if(!ghostIndices.includes(idx)) ghostIndices.push(idx);
    }
    for (let i = 0; i < count; i++) {
      let x, y, color, size, validPosition = false, attempts = 0;
      while (!validPosition && attempts < 15) {
        attempts++;
        if (useGrid && Math.random() > 0.4) {
          x = cellW * (Math.floor(randomRange(0, gridCols)) + 1) + randomRange(-30, 30);
          y = cellH * (Math.floor(randomRange(0, gridRows)) + 1) + randomRange(-30, 30);
        } else {
          const angle = Math.random() * Math.PI * 2, dist = randomRange(0, Math.min(this.width, this.height) * 0.4);
          x = centerX + Math.cos(angle) * dist; y = centerY + Math.sin(angle) * dist;
        }
        color = this.palette[Math.floor(Math.random() * (this.palette.length - 1))];
        size = Math.random() > 0.7 ? randomRange(this.width * 0.35, this.width * 0.5) : randomRange(this.width * 0.05, this.width * 0.2);
        validPosition = true;
        for (const other of this.shapes) {
          if (other.color.h === color.h && other.color.l === color.l) {
            if (Math.sqrt((x - other.x) ** 2 + (y - other.y) ** 2) < (size + other.size) * 0.4) { validPosition = false; break; }
          }
        }
      }
      const skew = skewAngles[Math.floor(Math.random() * skewAngles.length)];
      const hasGhost = ghostIndices.includes(i);
      const s = this._createShape(x, y, i, ghostAngle, skew, hasGhost, color, size);
      if (s.layer === 'foreground' && this.allData.length > 0) s.snippet = this.allData[Math.floor(Math.random() * this.allData.length)].raw;
      this.shapes.push(s);
      if (this.isSymmetrical && Math.random() > 0.4 && x !== centerX) {
        const ms = { ...s }; ms.x = this.width - s.x + randomRange(-15, 15); ms.y = s.y + randomRange(-15, 15);
        ms.shapeVariation = this._createShapeVariation();
        if (ms.tetrominoBlocks) {
          ms.tetrominoBlocks = ms.tetrominoBlocks.map(block => ({
            ...block,
            x: block.x + randomRange(-block.w * 0.035, block.w * 0.035),
            y: block.y + randomRange(-block.h * 0.035, block.h * 0.035),
            w: block.w * randomRange(0.97, 1.03),
            h: block.h * randomRange(0.97, 1.03)
          }));
        }
        ms.path = this._buildPath(ms.shapeType, ms.size, ms.tetrominoBlocks, ms.shapeVariation);
        ms.rotation = -s.rotation; ms.skew = -s.skew; this.shapes.push(ms);
      }
    }
  }

  _generateConnections() {
    for (let i = 0; i < this.shapes.length; i++) {
      for (let j = i + 1; j < this.shapes.length; j++) {
        const s1 = this.shapes[i], s2 = this.shapes[j], d = Math.sqrt((s1.x - s2.x) ** 2 + (s1.y - s2.y) ** 2);
        if (d < this.width * 0.4 && Math.random() > 0.8) {
          const midX = (s1.x + s2.x) / 2, midY = (s1.y + s2.y) / 2, angle = Math.atan2(s2.y - s1.y, s2.x - s1.x), dist = d * 0.2;
          let layer = (s1.layer === 'background' && s2.layer === 'background') ? (Math.random() > 0.5 ? 'background' : 'midground') : (Math.random() > 0.8 ? 'background' : 'midground');
          this.connections.push({
            from: i, to: j, color: s1.color, width: randomRange(2, 5), stripeType: 'single', layer,
            controlPoint: Math.random() > 0.5 ? { x: midX + Math.cos(angle + Math.PI/2) * dist * (Math.random() > 0.5 ? 1 : -1), y: midY + Math.sin(angle + Math.PI/2) * dist * (Math.random() > 0.5 ? 1 : -1) } : null
          });
        }
      }
    }
  }

  _getConnectionMidpoint(connection) {
    const from = this.shapes[connection.from];
    const to = this.shapes[connection.to];
    if (!from || !to) return null;
    return connection.controlPoint
      ? getQuadraticBezier(0.5, from, connection.controlPoint, to)
      : { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  }

  _balanceConnectionStripes() {
    const ordinary = this.connections.filter(connection => !connection.gazeGuide);
    ordinary.forEach(connection => { connection.stripeType = 'single'; });

    // Double-line connectors are punctuation, not the default network texture.
    // Pick at most two isolated locations and require substantial screen-space
    // separation so the hairlines cannot collapse into one busy cluster.
    const targetCount = Math.min(2, Math.floor((ordinary.length + 2) / 5));
    if (targetCount === 0) return;

    const candidates = ordinary
      .map(connection => ({ connection, point: this._getConnectionMidpoint(connection) }))
      .filter(candidate => candidate.point);
    if (!candidates.length) return;

    const pointDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const isolation = candidate => {
      const others = candidates.filter(other => other !== candidate);
      return others.length
        ? Math.min(...others.map(other => pointDistance(candidate.point, other.point)))
        : Math.min(this.width, this.height);
    };
    const selected = [[...candidates].sort((a, b) => isolation(b) - isolation(a))[0]];
    const minSpacing = Math.min(this.width, this.height) * 0.28;

    while (selected.length < targetCount) {
      const remaining = candidates.filter(candidate => !selected.includes(candidate));
      if (!remaining.length) break;
      const next = [...remaining].sort((a, b) => {
        const aDistance = Math.min(...selected.map(chosen => pointDistance(a.point, chosen.point)));
        const bDistance = Math.min(...selected.map(chosen => pointDistance(b.point, chosen.point)));
        return bDistance - aDistance;
      })[0];
      const nearestSelected = Math.min(...selected.map(chosen => pointDistance(next.point, chosen.point)));
      if (nearestSelected < minSpacing) break;
      selected.push(next);
    }

    selected.forEach(({ connection }) => { connection.stripeType = 'double'; });
  }

  _generateEnergyCurves() {
    const minCurveDist = this.width * 0.18; // minimum spacing between curves
    const targetCount = Math.floor(randomRange(1, 3));
    for (let i = 0; i < targetCount; i++) {
      let bestCandidate = null;
      let bestMinDist = -1;
      // Try multiple candidates and pick the one with the most spacing from existing curves
      const attempts = 12;
      for (let a = 0; a < attempts; a++) {
        const candidate = [
          { x: Math.random() * this.width, y: -100 },
          { x: Math.random() * this.width, y: this.height * 0.33 },
          { x: Math.random() * this.width, y: this.height * 0.66 },
          { x: Math.random() * this.width, y: this.height + 100 }
        ];
        // Measure minimum distance to all existing curves at several sample points
        let closestDist = Infinity;
        for (const existing of this.energyCurves) {
          for (let t = 0.1; t <= 0.9; t += 0.2) {
            const ep = getCubicBezier(t, existing.points);
            const cp = getCubicBezier(t, candidate);
            const d = Math.sqrt((ep.x - cp.x) ** 2 + (ep.y - cp.y) ** 2);
            closestDist = Math.min(closestDist, d);
          }
        }
        if (closestDist > bestMinDist) {
          bestMinDist = closestDist;
          bestCandidate = candidate;
        }
        // Early exit if we already found a well-spaced candidate
        if (bestMinDist >= minCurveDist) break;
      }
      this.energyCurves.push({
        points: bestCandidate,
        segments: this._createCurveSegments(bestCandidate),
        color: this.palette[Math.floor(Math.random() * (this.palette.length - 1))], width: randomRange(4, 8), layer: Math.random() > 0.7 ? 'midground' : 'background'
      });
    }
  }

  _createCurveSegments(points, steps = 48) {
    const segments = [];
    let previous = getCubicBezier(0, points);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const current = getCubicBezier(t, points);
      segments.push({ from: previous, to: current, t0: (i - 1) / steps });
      previous = current;
    }
    return segments;
  }

  _generateMiniChains() {
    for (let i = 0; i < Math.floor(randomRange(1, 2)); i++) {
      this.miniChains.push({
        p: [{ x: Math.random() * this.width, y: -50 }, { x: Math.random() * this.width, y: this.height * 0.33 }, { x: Math.random() * this.width, y: this.height * 0.66 }, { x: Math.random() * this.width, y: this.height + 50 }],
        color: this.palette[Math.floor(Math.random() * (this.palette.length - 1))], size: randomRange(2, 5), spacing: randomRange(20, 35), type: Math.random() > 0.5 ? 'circle' : 'rect', layer: Math.random() > 0.5 ? 'foreground' : 'background'
      });
    }
  }

  _generateStripeGroups() {
    for (let i = 0; i < Math.floor(randomRange(1, 2)); i++) {
      this.stripeGroups.push({
        x: randomRange(this.width * 0.1, this.width * 0.9), y: randomRange(this.height * 0.1, this.height * 0.9),
        skew: randomRange(-0.3, 0.3), rotation: Math.random() * Math.PI,
        color: this.palette[Math.floor(Math.random() * (this.palette.length - 1))], spacing: randomRange(14, 20), layer: Math.random() > 0.8 ? 'midground' : 'background',
        lines: Array.from({ length: Math.floor(randomRange(2, 5)) }, () => ({ staggerStart: randomRange(-100, 100), staggerEnd: randomRange(-100, 100), length: randomRange(300, 600), width: randomRange(1.5, 4) }))
      });
    }
  }

  _nextShapeType() {
    const deckKey = this.shapeTypes.join('|');
    if (!this.shapeTypeDeck.length || this.shapeTypeDeckKey !== deckKey) {
      this.shapeTypeDeck = [...this.shapeTypes];
      for (let i = this.shapeTypeDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.shapeTypeDeck[i], this.shapeTypeDeck[j]] = [this.shapeTypeDeck[j], this.shapeTypeDeck[i]];
      }
      this.shapeTypeDeckKey = deckKey;
    }
    return this.shapeTypeDeck.pop();
  }

  _createShapeVariation() {
    return {
      aspectX: randomRange(0.92, 1.08),
      aspectY: randomRange(0.92, 1.08),
      asymmetry: randomRange(-0.055, 0.055),
      cornerCut: randomRange(0.015, 0.085),
      innerRatio: randomRange(0.43, 0.56),
      sliceRatio: randomRange(0.12, 0.19),
      wobbleLobes: Math.floor(randomRange(5, 8)),
      wobbleAmount: randomRange(0.055, 0.095),
      phase: randomRange(-0.18, 0.18),
      polygonSides: Math.floor(randomRange(3, 7)),
      starPoints: Math.floor(randomRange(8, 12)),
      starInnerRatio: randomRange(0.38, 0.48),
      archOffset: randomRange(-0.13, 0.02),
      petalOffset: randomRange(0.34, 0.42),
      capsuleRoundness: randomRange(0.48, 0.58),
      taper: randomRange(0.54, 0.68)
    };
  }

  _createShape(x, y, index, ghostAngle, skew, hasGhost, color, size) {
    const shapeType = this._nextShapeType();
    const layer = Math.random() > 0.4 ? 'foreground' : 'background';
    const isNearCamera = layer === 'foreground' && Math.random() > 0.9;
    const shapeVariation = this._createShapeVariation();
    const tetrominoBlocks = shapeType === 'tetromino' ? this._createTetrominoBlocks(size) : null;
    const rotation = shapeType === 'tetromino' && Math.random() > 0.32
      ? [Math.PI / 6, Math.PI / 4, -Math.PI / 6, -Math.PI / 4][Math.floor(Math.random() * 4)]
      : Math.random() * Math.PI * 2;
    // 25% chance of being out-of-focus close foreground element
    const dofBlur = (layer === 'foreground' && Math.random() > 0.84) ? randomRange(0.6, 1.6) : 0;
    return {
      x, y, shapeType, size, skew, rotation, color, shapeVariation,
      path: this._buildPath(shapeType, size, tetrominoBlocks, shapeVariation), layer,
      tetrominoBlocks, isNearCamera, popDepth: isNearCamera ? randomRange(size * 0.22, size * 0.42) : 0,
      is25D: isNearCamera || Math.random() > 0.5, depth: isNearCamera ? randomRange(42, 72) : randomRange(15, 40), borderWidth: randomRange(0.6, 1.2), hasGhost, ghostCount: hasGhost ? Math.floor(randomRange(4, 10)) : 0, ghostAngle, ghostDist: randomRange(25, 60),
      hasPattern: Math.random() > 0.6, patternType: ['dots', 'lines', 'grid', 'halftone', 'pixel-grid'][Math.floor(Math.random() * 5)],
      hasNestedGeometry: Math.random() > 0.5, nestedType: ['rings', 'stripes', 'inset', 'grid'][Math.floor(Math.random() * 4)],
      glitchOffset: Math.random() > 0.85 ? randomRange(10, 25) : 0, glitchFactor: mapRange(this.latest.bpSmoothed !== undefined ? this.latest.bpSmoothed : (this.latest.bp || 100), 0, 100, 1.5, 0.2) * (Math.random() > 0.8 ? 2 : 1),
      hasPixelBlur: Math.random() > 0.88, pixelBlurAngle: ghostAngle + Math.PI, pixelBlurDist: randomRange(18, 48), pixelBlurSize: randomRange(6, 10),
      isCutout: Math.random() > 0.85, blendMode: ['source-over', 'source-over', 'source-over', 'difference', 'exclusion', 'screen'][Math.floor(Math.random() * 6)],
      dofBlur
    };
  }

  _createTetrominoBlocks(size) {
    const layouts = [
      [[0, 0], [1, 0], [2, 0], [1, 1]], [[0, 0], [0, 1], [1, 1], [2, 1]],
      [[0, 0], [1, 0], [1, 1], [2, 1]], [[0, 0], [1, 0], [0, 1], [0, 2]]
    ];
    const layout = layouts[Math.floor(Math.random() * layouts.length)];
    const unit = size / 3.15;
    return layout.map(([col, row]) => ({
      x: (col - 1) * unit + randomRange(-unit * 0.07, unit * 0.07),
      y: (row - 0.65) * unit + randomRange(-unit * 0.07, unit * 0.07),
      w: unit * randomRange(0.78, 1.18), h: unit * randomRange(0.72, 1.15)
    }));
  }

  _buildPath(type, size, tetrominoBlocks = null, variation = {}) {
    const p = new Path2D(), r = size / 2;
    const v = {
      aspectX: 1,
      aspectY: 1,
      asymmetry: 0,
      cornerCut: 0.05,
      innerRatio: 0.5,
      sliceRatio: 0.15,
      wobbleLobes: 6,
      wobbleAmount: 0.08,
      phase: 0,
      polygonSides: 5,
      starPoints: 10,
      starInnerRatio: 0.42,
      archOffset: -0.08,
      petalOffset: 0.38,
      capsuleRoundness: 0.53,
      taper: 0.6,
      ...variation
    };
    const rx = r * v.aspectX;
    const ry = r * v.aspectY;
    const biasX = r * v.asymmetry;
    if (type === 'tetromino') {
      for (const block of tetrominoBlocks || []) p.rect(block.x - block.w / 2, block.y - block.h / 2, block.w, block.h);
    } else if (type === 'rect') {
      const cut = Math.min(rx, ry) * v.cornerCut;
      p.moveTo(-rx + cut + biasX * 0.2, -ry);
      p.lineTo(rx - cut, -ry + cut * 0.2);
      p.lineTo(rx + biasX * 0.25, ry - cut);
      p.lineTo(rx - cut, ry);
      p.lineTo(-rx + cut, ry - cut * 0.15);
      p.lineTo(-rx + biasX * 0.2, -ry + cut);
      p.closePath();
    } else if (type === 'circle' || type === 'sphere') {
      p.ellipse(biasX * 0.22, 0, rx, ry, v.phase * 0.35, 0, Math.PI * 2);
    } else if (type === 'cube') {
      p.rect(-rx, -ry, rx * 2, ry * 2);
    } else if (type === 'donut') {
      p.ellipse(biasX * 0.2, 0, rx, ry, v.phase * 0.25, 0, Math.PI * 2);
      p.moveTo(biasX + rx * v.innerRatio, 0);
      p.ellipse(biasX, 0, rx * v.innerRatio, ry * v.innerRatio, v.phase * 0.25, 0, Math.PI * 2, true);
    }
    else if (type === 'sliced-rect') {
      const shift = size * v.sliceRatio;
      p.moveTo(-rx + biasX, -ry);
      p.lineTo(rx, -ry);
      p.lineTo(-rx + shift, ry);
      p.closePath();
      const dx = shift * 0.5, dy = shift * 0.5;
      p.moveTo(rx + dx, -ry + dy);
      p.lineTo(rx + dx + biasX * 0.35, ry + dy);
      p.lineTo(-rx + shift + dx, ry + dy);
      p.closePath();
    } else if (type === 'sliced-circle') {
      const dx = size * v.sliceRatio * 0.55, dy = size * v.sliceRatio * 0.55;
      p.ellipse(-dx, -dy, rx, ry, v.phase * 0.2, Math.PI * 0.75, Math.PI * 1.75);
      p.closePath();
      p.moveTo(dx, dy);
      p.ellipse(dx + biasX, dy, rx, ry, v.phase * 0.2, Math.PI * 1.75, Math.PI * 0.75);
      p.closePath();
    } else if (type === 'wobble-circle') {
      const steps = 32;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const w = 1 + Math.sin(a * v.wobbleLobes + v.phase) * v.wobbleAmount + Math.cos(a * (v.wobbleLobes * 2 + 1) - v.phase) * 0.025;
        const x = Math.cos(a) * rx * w + biasX * Math.sin(a), y = Math.sin(a) * ry * w;
        if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
      }
      p.closePath();
    } else if (type === 'wobble-rect') {
      const corners = [{ x: -rx + biasX, y: -ry }, { x: rx, y: -ry }, { x: rx + biasX * 0.25, y: ry }, { x: -rx, y: ry }];
      for (let i = 0; i < 4; i++) {
        const c1 = corners[i], c2 = corners[(i + 1) % 4];
        const steps = 8;
        for (let s = 0; s < steps; s++) {
          const t = s / steps;
          const x = c1.x + (c2.x - c1.x) * t;
          const y = c1.y + (c2.y - c1.y) * t;
          const edgeLength = Math.hypot(c2.x - c1.x, c2.y - c1.y) || size;
          const perpX = -(c2.y - c1.y) / edgeLength, perpY = (c2.x - c1.x) / edgeLength;
          const noise = Math.sin(t * Math.PI) * Math.sin((i + 1) * 3.7 + t * 5.3 + v.phase) * (size * v.wobbleAmount * 0.45);
          const px = x + perpX * noise, py = y + perpY * noise;
          if (i === 0 && s === 0) p.moveTo(px, py); else p.lineTo(px, py);
        }
      }
      p.closePath();
    } else if (type === 'capsule') {
      const capRadius = rx * v.capsuleRoundness;
      const halfStraight = rx - capRadius;
      p.moveTo(-halfStraight, -ry);
      p.lineTo(halfStraight + biasX, -ry);
      p.ellipse(halfStraight + biasX, 0, capRadius, ry, 0, -Math.PI / 2, Math.PI / 2);
      p.lineTo(-halfStraight, ry);
      p.ellipse(-halfStraight, 0, capRadius, ry, 0, Math.PI / 2, -Math.PI / 2);
      p.closePath();
    } else if (type === 'arch') {
      // A strong architectural D-form gives the softer circular family a
      // deliberately grounded counterpoint.
      const shoulderY = ry * v.archOffset;
      p.moveTo(-rx, ry);
      p.lineTo(-rx, shoulderY);
      p.ellipse(biasX * 0.3, shoulderY, rx, ry, v.phase * 0.12, Math.PI, 0);
      p.lineTo(rx + biasX * 0.3, ry);
      p.closePath();
    } else if (type === 'crescent') {
      // Opposite winding preserves the inner cutout in regular fills as well
      // as the even-odd passes used by the material renderer.
      const innerScale = 0.78 + (v.innerRatio - 0.43) * 0.75;
      const innerX = rx * (0.3 + v.asymmetry);
      p.ellipse(0, 0, rx, ry, v.phase * 0.15, 0, Math.PI * 2);
      p.moveTo(innerX + rx * innerScale, 0);
      p.ellipse(innerX, 0, rx * innerScale, ry * innerScale, v.phase * 0.15, 0, Math.PI * 2, true);
    } else if (type === 'starburst') {
      const points = v.starPoints;
      for (let i = 0; i < points * 2; i++) {
        const angle = -Math.PI / 2 + v.phase + (i / (points * 2)) * Math.PI * 2;
        const radius = i % 2 === 0 ? 1 + Math.sin(i * 2.17) * 0.035 : v.starInnerRatio;
        const x = Math.cos(angle) * rx * radius + biasX * 0.25, y = Math.sin(angle) * ry * radius;
        if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
      }
      p.closePath();
    } else if (type === 'clover') {
      const petalRx = rx * (0.58 + v.asymmetry), petalRy = ry * (0.58 - v.asymmetry);
      const offsetX = rx * v.petalOffset, offsetY = ry * v.petalOffset;
      p.ellipse(-offsetX, 0, petalRx, petalRy, v.phase, 0, Math.PI * 2);
      p.ellipse(offsetX, 0, petalRx, petalRy, -v.phase, 0, Math.PI * 2);
      p.ellipse(biasX, -offsetY, petalRx, petalRy, v.phase, 0, Math.PI * 2);
      p.ellipse(biasX, offsetY, petalRx, petalRy, -v.phase, 0, Math.PI * 2);
    } else if (type === 'lightning-bolt') {
      p.moveTo(-rx * 0.08 + biasX, -ry * 1.12);
      p.lineTo(rx * (0.7 + v.asymmetry), -ry * 0.18);
      p.lineTo(rx * 0.2, -ry * 0.11);
      p.lineTo(rx * (0.54 - v.asymmetry), ry * 1.08);
      p.lineTo(-rx * (0.7 - v.asymmetry), ry * 0.12);
      p.lineTo(-rx * 0.2, ry * 0.08);
      p.closePath();
    } else if (type === 'polygon') {
      const sides = v.polygonSides;
      for (let i = 0; i < sides; i++) {
        const a = v.phase + (i / sides) * Math.PI * 2;
        const radialShift = 1 + Math.sin((i + 1) * 4.13 + v.phase) * 0.045;
        const x = Math.cos(a) * rx * radialShift + biasX * 0.2;
        const y = Math.sin(a) * ry * radialShift;
        if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
      }
      p.closePath();
    } else if (type === 'trapezoid') {
      const topHalf = rx * v.taper, topShift = biasX * 1.5;
      p.moveTo(-topHalf + topShift, -ry);
      p.lineTo(topHalf + topShift, -ry);
      p.lineTo(rx, ry);
      p.lineTo(-rx, ry);
      p.closePath();
    } else {
      p.moveTo(biasX, -ry * 1.45);
      p.lineTo(rx * (0.28 + v.asymmetry), ry);
      p.lineTo(-rx * (0.28 - v.asymmetry), ry);
      p.closePath();
    }
    return p;
  }

  // --- 3. RENDERING STAGE (PIPELINE) ---

  async render(ctx, width, height) {
    this._renderStageEnvironment(ctx);
    this._renderStageMidground(ctx);
    this._renderStageForeground(ctx);
    this._renderStagePost(ctx);
    this._renderGlobalGlitch(ctx);
    await canvasUtils.drawGrain(ctx, width, height, 0, 0.12);
  }

  _renderStageEnvironment(ctx) {
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, this.width, this.height);
    this._renderDuotoneBackdrop(ctx);
    this._renderFluidBackground(ctx);
    
    ctx.save();
    if (this.dofEnabled) {
      ctx.filter = `blur(${Math.min(this.dofBlurAmt, 2.5)}px)`;
    }
    
    this._renderGlyphLayer(ctx);
    ctx.save(); ctx.globalAlpha = 0.035; ctx.fillStyle = ctx.createPattern(this.paperTexture, 'repeat'); ctx.fillRect(0, 0, this.width, this.height); ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.055; ctx.fillStyle = ctx.createPattern(this.patternCache.get('grid'), 'repeat'); ctx.fillRect(0, 0, this.width, this.height); ctx.restore();
    this._renderPerspectiveGrid(ctx);
    this._renderLightShafts(ctx);
    this._renderStructuralPlanes(ctx);
    this._renderFlowRibbons(ctx, 'background');
    this._renderMiniChains(ctx, 'background');
    this._renderStripes(ctx, 'background');
    this._renderStripeGroups(ctx, 'background');
    this._renderDataPulses(ctx, 'background');
    this._renderBackgroundNumerals(ctx);
    this._renderSparkField(ctx);
    this._renderPrismShards(ctx);
    this._renderAccentMarks(ctx);
    this._renderShapeGroup(ctx, this.shapeLayers.background);
    
    ctx.restore();
    
    this._renderMidgroundHaze(ctx);
  }

  _renderGlyphLayer(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (const glyph of this.glyphInstances) {
      ctx.save();
      ctx.translate(glyph.x, glyph.y);
      ctx.rotate(glyph.rotation);
      ctx.scale(glyph.scale, glyph.scale);
      ctx.stroke(glyph.path);
      if (glyph.filled) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fill(glyph.path);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  _renderStageMidground(ctx) {
    this._renderTrillAperture(ctx);
    this._renderDecalClusters(ctx);
    this._renderStripeGroups(ctx, 'midground');
    this._renderStripes(ctx, 'midground');
    this._renderInterlocks(ctx);
    this._renderFlowRibbons(ctx, 'midground');
    this._renderProcessingArcs(ctx);
    this._renderDataPulses(ctx, 'midground');
    this._renderOrbitSystems(ctx, 'midground');
    this._renderConnectionJunctions(ctx, 'midground');
    this._renderHalftoneScreen(ctx);
  }

  _renderStageForeground(ctx) {
    this._renderShapeGroup(ctx, this.shapeLayers.foreground);
    this._renderTrillSignature(ctx);
    this._renderContourEchoes(ctx);
    this._renderMiniChains(ctx, 'foreground');
    this._renderOrbitSystems(ctx, 'foreground');
    this._renderConnectionJunctions(ctx, 'foreground');
    this._renderTypoGrid(ctx);
  }

  _renderStagePost(ctx) {
    this._renderFinishPass(ctx);
    this._renderBloom(ctx);
    const v = ctx.createRadialGradient(this.width / 2, this.height / 2, this.width * 0.5, this.width / 2, this.height / 2, this.width * 1.3);
    v.addColorStop(0, 'transparent'); v.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, this.width, this.height);
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.18; ctx.fillStyle = ctx.createPattern(this.paperTexture, 'repeat'); ctx.fillRect(0, 0, this.width, this.height); ctx.restore();
    this._renderRegistrationMarks(ctx);
  }

  _renderTrillAperture(ctx) {
    const signature = this.trillSignature;
    if (!signature) return;
    const { focal, apertureRadius, apertureHue } = signature;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const halo = ctx.createRadialGradient(focal.x, focal.y, apertureRadius * 0.28, focal.x, focal.y, apertureRadius);
    halo.addColorStop(0, `hsla(${apertureHue}, 90%, 62%, 0.14)`);
    halo.addColorStop(0.56, `hsla(${apertureHue}, 82%, 48%, 0.035)`);
    halo.addColorStop(1, 'transparent');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(focal.x, focal.y, apertureRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _renderTrillSignature(ctx) {
    const signature = this.trillSignature;
    if (!signature) return;
    const { focal, frames, beats } = signature;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const frame of frames) {
      const w = focal.size * frame.scale;
      const h = focal.size * frame.scale * 0.78;
      const arm = Math.min(w, h) * 0.25;
      ctx.save();
      ctx.translate(focal.x + frame.offsetX, focal.y + frame.offsetY);
      ctx.rotate(frame.rotation);
      ctx.strokeStyle = `hsla(${frame.color.h}, ${Math.max(45, frame.color.s)}%, 78%, 0.42)`;
      ctx.lineWidth = frame.scale < 1.1 ? 1.8 : 1;
      ctx.beginPath();
      // Four deliberately incomplete corners: the gaps are part of the Trill rhythm.
      const corners = [[-w / 2, -h / 2, 1, 1], [w / 2, -h / 2, -1, 1], [w / 2, h / 2, -1, -1], [-w / 2, h / 2, 1, -1]];
      for (const [x, y, sx, sy] of corners) {
        if ((frame.corner === 'open-ne' && x > 0 && y < 0) || (frame.corner === 'open-sw' && x < 0 && y > 0)) continue;
        ctx.moveTo(x, y + sy * arm);
        ctx.lineTo(x, y);
        ctx.lineTo(x + sx * arm, y);
      }
      ctx.stroke();
      ctx.restore();
    }
    for (const beat of beats) {
      ctx.save();
      ctx.translate(beat.x, beat.y);
      ctx.rotate(beat.rotation);
      ctx.fillStyle = `hsla(${beat.color.h}, ${beat.color.s}%, 76%, 0.72)`;
      ctx.strokeStyle = `hsla(${beat.color.h}, 100%, 88%, 0.82)`;
      ctx.lineWidth = 0.8;
      if (beat.kind === 0) {
        ctx.fillRect(-beat.size, -beat.size * 0.44, beat.size * 2, beat.size * 0.88);
      } else if (beat.kind === 1) {
        ctx.beginPath(); ctx.arc(0, 0, beat.size * 0.72, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.moveTo(beat.size, 0); ctx.lineTo(-beat.size * 0.72, beat.size * 0.72); ctx.lineTo(-beat.size * 0.72, -beat.size * 0.72); ctx.closePath(); ctx.fill();
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // Three deliberately separate finishing directions. Each remains selective
  // (focal shapes and the gaze route) so Trill keeps its clean negative space
  // and does not accumulate another blanket of blur or glow.
  _renderFinishPass(ctx) {
    if (this.finishMode === 'prismatic-lacquer') this._renderPrismaticLacquer(ctx);
    else if (this.finishMode === 'risograph-noir') this._renderRisographNoir(ctx);
    else if (this.finishMode === 'signal-neon') this._renderSignalNeon(ctx);
  }

  _withShapeTransform(ctx, shape, draw) {
    const parallax = shape.layer === 'foreground' ? 1 : 0.3;
    ctx.save();
    ctx.translate(shape.x + this.parallaxX * parallax, shape.y + this.parallaxY * parallax);
    ctx.rotate(shape.rotation);
    if (shape.shapeType !== 'sphere') ctx.transform(1, shape.skew, 0, 1, 0, 0);
    draw();
    ctx.restore();
  }

  // 1. Glassy, angular refraction gives the focal mass a premium faceted
  // surface without changing the underlying silhouette or adding soft haze.
  _renderPrismaticLacquer(ctx) {
    const subjects = [this.focalShape, ...this.gazeRoute.filter(shape => shape !== this.focalShape)].filter(Boolean).slice(0, 3);
    for (const shape of subjects) {
      this._withShapeTransform(ctx, shape, () => {
        const r = shape.size / 2;
        ctx.save();
        ctx.clip(shape.path, 'evenodd');
        ctx.globalCompositeOperation = 'screen';
        const band = ctx.createLinearGradient(-r, -r, r, r);
        band.addColorStop(0, 'rgba(120,240,255,0)');
        band.addColorStop(0.38, 'rgba(120,240,255,0.17)');
        band.addColorStop(0.5, 'rgba(255,255,255,0.32)');
        band.addColorStop(0.62, 'rgba(255,105,220,0.16)');
        band.addColorStop(1, 'rgba(255,105,220,0)');
        ctx.fillStyle = band;
        ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = Math.max(0.7, shape.borderWidth);
        ctx.beginPath(); ctx.moveTo(-r, r * 0.28); ctx.lineTo(r, -r * 0.3); ctx.stroke();
        ctx.restore();
      });
    }
  }

  // 2. A restrained, high-contrast print registration pass leans into Trill's
  // poster roots: offset inks, visible trapping, and no added luminosity.
  _renderRisographNoir(ctx) {
    const inks = [this.palette[1] || this.palette[0], this.palette[3] || this.palette[0]];
    const subjects = [this.focalShape, ...this.gazeRoute].filter(Boolean).filter((shape, i, all) => all.indexOf(shape) === i).slice(0, 3);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const [index, shape] of subjects.entries()) {
      this._withShapeTransform(ctx, shape, () => {
        const ink = inks[index % inks.length];
        ctx.save();
        ctx.translate(index % 2 ? 5 : -5, index % 2 ? -3 : 3);
        ctx.strokeStyle = `hsla(${ink.h}, ${Math.max(50, ink.s)}%, 70%, 0.42)`;
        ctx.lineWidth = Math.max(1, shape.borderWidth * 2.4);
        ctx.setLineDash([2.5, 4]);
        ctx.stroke(shape.path);
        ctx.restore();
      });
    }
    ctx.restore();
  }

  // 3. Fine, bright route tracers make the existing gaze path legible as a
  // piece of luminous circuitry rather than filling the whole scene with neon.
  _renderSignalNeon(ctx) {
    if (this.gazeRoute.length < 2) return;
    const color = this.focalShape?.color || this.palette[0];
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = `hsla(${color.h}, 100%, 72%, 0.56)`;
    ctx.shadowColor = `hsl(${color.h}, 100%, 65%)`;
    ctx.shadowBlur = 3;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 16]);
    for (let i = 0; i < this.gazeRoute.length - 1; i++) {
      const from = this.gazeRoute[i], to = this.gazeRoute[i + 1];
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo((from.x + to.x) / 2, (from.y + to.y) / 2 - this.height * 0.05 * (i ? -1 : 1), to.x, to.y);
      ctx.stroke();
    }
    if (this.focalShape) {
      ctx.setLineDash([]);
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(this.focalShape.x, this.focalShape.y, this.focalShape.size * 0.68, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  // --- 4. DRAWING HELPERS ---

  _renderProcessingArcs(ctx) {
    ctx.save();
    ctx.lineCap = 'butt';
    const bp = this.latest.bpSmoothed !== undefined ? this.latest.bpSmoothed : (this.latest.bp || 100);
    const pt = this.latest.ptSmoothed !== undefined ? this.latest.ptSmoothed : (this.latest.pt || 50);
    const hubs = this.hubs;

    for (const hub of hubs) {
      const x = hub.x, y = hub.y, baseR = hub.size * 0.6;
      const numArcs = Math.floor(mapRange(pt, 0, 200, 1, 3));
      
      for (let i = 0; i < numArcs; i++) {
        const r = baseR + (i * 12);
        const color = `hsla(${hub.color.h}, 100%, 70%, 0.2)`;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        
        // Arc segments
        const startAng = Math.random() * Math.PI * 2;
        const sweep = mapRange(bp, 0, 100, 0.1, Math.PI * 1.2);
        
        ctx.save();
        ctx.setLineDash([5, 20]);
        ctx.beginPath();
        ctx.arc(x, y, r, startAng, startAng + sweep);
        ctx.stroke();
        
        // Outer "bracket" or indicator
        if (Math.random() > 0.6) {
          ctx.setLineDash([]);
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.arc(x, y, r + 4, startAng - 0.1, startAng + sweep + 0.1);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }

  _renderFluidBackground(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const fm = this.latest.fm || 50, hr = this.latest.hh || 12;
    for (let i = 0; i < 3; i++) {
      const color = this.palette[i % (this.palette.length - 1)];
      const x = mapRange(hr, 0, 24, this.width * 0.2, this.width * 0.8) + (Math.sin(i + hr) * 200);
      const y = mapRange(fm, 0, 100, this.height * 0.8, this.height * 0.2) + (Math.cos(i + fm) * 200);
      const g = ctx.createRadialGradient(x, y, 0, x, y, randomRange(this.width * 0.4, this.width * 0.7));
      g.addColorStop(0, `hsla(${color.h}, ${color.s}%, 10%, 0.09)`); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.width, this.height);
    }
    ctx.restore();
  }

  // 1. A quiet, palette-led backdrop gives every theme a cohesive base instead
  // of relying on the same flat near-black field.
  _renderDuotoneBackdrop(ctx) {
    const primary = this.palette[0];
    const secondary = this.palette[2] || primary;
    const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
    gradient.addColorStop(0, `hsl(${primary.h}, ${Math.min(primary.s, 42)}%, 1.8%)`);
    gradient.addColorStop(0.5, '#000000');
    gradient.addColorStop(1, `hsl(${secondary.h}, ${Math.min(secondary.s, 38)}%, 1.5%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  // 2. Dashed orbital frames make hub shapes read as deliberate focal points.
  _renderOrbitSystems(ctx, layer) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const orbit of this.orbitSystems) {
      if (orbit.layer !== layer) continue;
      ctx.save();
      ctx.translate(orbit.x, orbit.y);
      ctx.rotate(orbit.rotation);
      ctx.strokeStyle = `hsla(${orbit.color.h}, ${orbit.color.s}%, 78%, 0.3)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([orbit.radius * 0.14, orbit.radius * 0.09]);
      ctx.beginPath(); ctx.arc(0, 0, orbit.radius, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < orbit.segments; i++) {
        const angle = (i / orbit.segments) * Math.PI * 2;
        const x = Math.cos(angle) * orbit.radius, y = Math.sin(angle) * orbit.radius;
        ctx.fillStyle = `hsl(${orbit.color.h}, 100%, 78%)`;
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // 4. Small illuminated nodes clarify where data paths meet shapes.
  _renderConnectionJunctions(ctx, layer) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const connection of this.connections) {
      if (connection.layer !== layer) continue;
      const from = this.shapes[connection.from], to = this.shapes[connection.to];
      if (!from || !to) continue;
      for (const point of [from, to]) {
        ctx.save();
        const radius = Math.max(2.5, connection.width * 0.9);
        const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 4);
        glow.addColorStop(0, 'rgba(255,255,255,0.75)');
        glow.addColorStop(0.28, `hsla(${connection.color.h}, 100%, 72%, 0.5)`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(point.x, point.y, radius * 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // 5. Sparse marks provide an editorial, screen-printed rhythm without text.
  _renderAccentMarks(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const mark of this.accentMarks) {
      ctx.save(); ctx.translate(mark.x, mark.y); ctx.rotate(mark.angle);
      ctx.strokeStyle = `hsla(${mark.color.h}, ${mark.color.s}%, 76%, 0.35)`;
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-mark.length / 2, 0); ctx.lineTo(mark.length / 2, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // 1. Translucent prisms add sharp, gallery-poster depth around focal hubs.
  _renderPrismShards(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const shard of this.prismShards) {
      const r = shard.size;
      ctx.save(); ctx.translate(shard.x, shard.y); ctx.rotate(shard.rotation);
      const gradient = ctx.createLinearGradient(-r, -r, r, r);
      gradient.addColorStop(0, `hsla(${shard.color.h}, ${shard.color.s}%, 82%, 0.36)`);
      gradient.addColorStop(0.55, `hsla(${shard.color.h}, ${shard.color.s}%, 55%, 0.1)`);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.9, r); ctx.lineTo(-r * 0.7, r * 0.58); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `hsla(${shard.color.h}, 100%, 86%, 0.36)`; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // 2. Fine stars use network activity to make otherwise empty regions feel alive.
  _renderSparkField(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const spark of this.sparkField) {
      ctx.strokeStyle = `hsla(${spark.color.h}, ${spark.color.s}%, 88%, ${spark.alpha})`;
      ctx.fillStyle = `hsla(${spark.color.h}, ${spark.color.s}%, 92%, ${spark.alpha})`;
      ctx.beginPath(); ctx.arc(spark.x, spark.y, spark.radius, 0, Math.PI * 2); ctx.fill();
      if (spark.cross) {
        const arm = spark.radius * 3.5;
        ctx.lineWidth = 0.55; ctx.beginPath(); ctx.moveTo(spark.x - arm, spark.y); ctx.lineTo(spark.x + arm, spark.y); ctx.moveTo(spark.x, spark.y - arm); ctx.lineTo(spark.x, spark.y + arm); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 3. Offset contour lines lend selected forms a printmaking-style afterimage.
  _renderContourEchoes(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const echo of this.contourEchoes) {
      const shape = echo.shape;
      ctx.save();
      const parallax = this.parallaxX * 0.18;
      ctx.translate(shape.x + parallax, shape.y + this.parallaxY * 0.18);
      ctx.rotate(shape.rotation + echo.rotation);
      if (shape.shapeType !== 'sphere') ctx.transform(1, shape.skew, 0, 1, 0, 0);
      ctx.scale(echo.scale, echo.scale);
      ctx.setLineDash([5, 7]);
      ctx.strokeStyle = `hsla(${echo.color.h}, ${echo.color.s}%, 80%, 0.34)`;
      ctx.lineWidth = 1; ctx.stroke(shape.path);
      ctx.restore();
    }
    ctx.restore();
  }

  _renderLightShafts(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const angle = this.lightAngle;
    const length = Math.max(this.width, this.height) * 1.5;
    const hubs = this.hubs;
    const hh = this.latest.hh !== undefined ? this.latest.hh : 12;

    // Define colors based on time of day (hh: 0-23)
    let beamColor;
    let beamColorMid;
    if (hh >= 21 || hh < 5) {
      // Night: Violet / Deep Blue
      beamColor = 'rgba(138, 43, 226, 0.028)';
      beamColorMid = 'rgba(75, 0, 130, 0.012)';
    } else if ((hh >= 5 && hh < 8) || (hh >= 18 && hh < 21)) {
      // Golden Hour (Sunset/Sunrise): Warm Amber / Orange
      beamColor = 'rgba(255, 140, 0, 0.032)';
      beamColorMid = 'rgba(255, 69, 0, 0.012)';
    } else {
      // Midday: Crisp white/blueish
      beamColor = 'rgba(224, 243, 255, 0.025)';
      beamColorMid = 'rgba(255, 255, 255, 0.008)';
    }

    const maxBeams = hubs.length > 0 ? Math.min(hubs.length, 2) : 2;
    for (let i = 0; i < maxBeams; i++) {
      let startX, startY;
      if (hubs.length > 0) {
        // Pass through a hub center
        const hub = hubs[i % hubs.length];
        // Offset starting point backwards along the light angle direction so the beam passes over the hub
        startX = hub.x - Math.cos(angle) * length * 0.35;
        startY = hub.y - Math.sin(angle) * length * 0.35;
      } else {
        startX = Math.random() * this.width;
        startY = Math.random() * this.height;
      }

      const beamWidth = randomRange(this.width * 0.045, this.width * 0.1);
      const grad = ctx.createLinearGradient(startX, startY, startX + Math.cos(angle) * length, startY + Math.sin(angle) * length);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.35, beamColor);
      grad.addColorStop(0.7, beamColorMid);
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(startX - beamWidth / 2, startY);
      ctx.lineTo(startX + beamWidth / 2, startY);
      ctx.lineTo(startX + Math.cos(angle) * length + beamWidth, startY + Math.sin(angle) * length);
      ctx.lineTo(startX + Math.cos(angle) * length - beamWidth, startY + Math.sin(angle) * length);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  _renderShapeGroup(ctx, shapes) {
    // Sort by depth ascending so deeper (further) shapes are drawn first
    const sorted = [...shapes].sort((a, b) => (b.depth || 0) - (a.depth || 0));
    const needsPerShapeBlur = this.dofEnabled && sorted.some(shape => shape.dofBlur > 0);
    if (!needsPerShapeBlur) {
      for (let i = 0; i < sorted.length; i++) {
        this._renderCastShadows(ctx, sorted, i);
        this._drawShape(ctx, sorted[i]);
      }
      return;
    }

    if (!this.shapeBuffer || this.shapeBuffer.width !== this.width || this.shapeBuffer.height !== this.height) {
      this.shapeBuffer = createCanvas(this.width, this.height);
    }
    const off = this.shapeBuffer;
    const octx = off.getContext('2d');
    octx.clearRect(0, 0, this.width, this.height);
    // Draw each shape, then cast its shadow onto shapes below it
    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i];
      // Before drawing this shape, render shadows cast by shapes above it (drawn later / higher depth)
      if (this.dofEnabled && s.dofBlur > 0) {
        octx.save();
        octx.filter = `blur(${s.dofBlur}px)`;
        this._renderCastShadows(octx, sorted, i);
        this._drawShape(octx, s);
        octx.restore();
      } else {
        this._renderCastShadows(octx, sorted, i);
        this._drawShape(octx, s);
      }
    }
    ctx.drawImage(off, 0, 0);
  }

  /**
   * For shape at index `targetIdx` in the sorted array, render soft shadows
   * cast by shapes that sit above it (later in the draw order / shallower depth).
   * Shadow offset is derived from the light source angle and the depth difference.
   */
  _renderCastShadows(ctx, sorted, targetIdx) {
    const target = sorted[targetIdx];
    const targetDepth = target.depth || 20;
    // Light direction (shadows fall opposite to where light comes from)
    const shadowAngle = this.lightAngle + Math.PI;
    const lcos = Math.cos(shadowAngle);
    const lsin = Math.sin(shadowAngle);

    for (let j = targetIdx + 1; j < sorted.length; j++) {
      const caster = sorted[j];
      const casterDepth = caster.depth || 20;
      // Only shapes that are shallower (closer to viewer) cast shadows down
      if (casterDepth >= targetDepth) continue;

      const depthDiff = targetDepth - casterDepth;
      // Proximity check: shadow only lands if shapes overlap when projected
      const dx = target.x - caster.x;
      const dy = target.y - caster.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxReach = (caster.size + target.size) * 0.8 + depthDiff * 3;
      if (dist > maxReach) continue;

      // Shadow offset scales with depth difference
      const offsetScale = depthDiff * 0.4;
      const shadowOffX = lcos * offsetScale;
      const shadowOffY = lsin * offsetScale;
      // Blur and opacity scale with depth difference
      const shadowBlur = Math.min(depthDiff * 0.35, 12);
      const shadowAlpha = mapRange(depthDiff, 0, 40, 0.05, 0.35);
      // Attenuate by distance between shapes
      const distAtten = Math.max(0, 1 - (dist / maxReach) * 0.7);
      const finalAlpha = shadowAlpha * distAtten;

      if (finalAlpha < 0.02) continue;

      ctx.save();
      // Clip to the target shape so the shadow only appears on it
      const pM = target.layer === 'foreground' ? 1.0 : 0.3;
      ctx.translate(target.x + this.parallaxX * pM, target.y + this.parallaxY * pM);
      ctx.rotate(target.rotation);
      if (target.shapeType !== 'sphere') ctx.transform(1, target.skew, 0, 1, 0, 0);
      ctx.clip(target.path);
      // Undo target transform to get back to world space for the caster
      if (target.shapeType !== 'sphere') {
        // Inverse of (1, skew, 0, 1) is (1, -skew, 0, 1)
        ctx.transform(1, -target.skew, 0, 1, 0, 0);
      }
      ctx.rotate(-target.rotation);
      ctx.translate(-(target.x + this.parallaxX * pM), -(target.y + this.parallaxY * pM));

      // Now draw the caster shape as a soft dark shadow at the projected offset
      const cpM = caster.layer === 'foreground' ? 1.0 : 0.3;
      ctx.translate(caster.x + this.parallaxX * cpM + shadowOffX, caster.y + this.parallaxY * cpM + shadowOffY);
      ctx.rotate(caster.rotation);
      if (caster.shapeType !== 'sphere') ctx.transform(1, caster.skew, 0, 1, 0, 0);

      ctx.globalAlpha = finalAlpha;
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = `rgba(0,0,0,${finalAlpha})`;
      ctx.fill(caster.path);

      ctx.restore();
    }
  }

  _drawShape(ctx, s) {
    const gx = s.glitchOffset > 0 ? (Math.random() - 0.5) * s.glitchOffset : 0;
    const pM = s.layer === 'foreground' ? 1.0 : 0.3;
    ctx.save();
    if (s.isCutout) ctx.globalCompositeOperation = 'destination-out'; else ctx.globalCompositeOperation = s.blendMode || 'source-over';
    ctx.translate(s.x + gx + this.parallaxX * pM, s.y + this.parallaxY * pM); ctx.rotate(s.rotation);

    if (s.shapeType !== 'sphere') ctx.transform(1, s.skew, 0, 1, 0, 0);
    this._renderGhostTrails(ctx, s); this._renderPixelBlur(ctx, s);
    this._renderMainFill(ctx, s); this._renderPatterns(ctx, s);
    this._renderNestedGeometry(ctx, s);
    this._renderSilhouetteDetails(ctx, s);
    this._renderMaterialRim(ctx, s);
    this._renderPrintRegistration(ctx, s);
    if (s.snippet) this._renderDataStamps(ctx, s);
    // Keep digital breakup as a rare accent. At normal battery values the old
    // threshold activated it across most foreground shapes, flattening the
    // hierarchy into a field of horizontal noise.
    if (s.glitchOffset > 0 && s.glitchFactor > 0.8) this._renderGlitch(ctx, s);
    this._renderBorders(ctx, s);
    if (s.isHub) this._drawHUDDecorations(ctx, s);
    ctx.restore();
  }

  _renderMainFill(ctx, s) {
    ctx.save(); const shadowOffset = Math.min(18, 3 + s.depth * 0.18); ctx.shadowColor = 'rgba(0,0,0,0.48)'; ctx.shadowBlur = Math.min(26, 3 + s.depth * 0.32); ctx.shadowOffsetX = shadowOffset; ctx.shadowOffsetY = shadowOffset; ctx.fill(s.path); ctx.restore();
    if (Math.random() > 0.85) { ctx.save(); ctx.shadowColor = `hsla(${s.color.h}, 80%, 45%, 0.2)`; ctx.shadowBlur = 4; ctx.stroke(s.path); ctx.restore(); }
    if (s.layer === 'foreground' && (s.isFocal || s.isNearCamera) && Math.random() > 0.74) this._renderChromaticAberration(ctx, s); else this._renderStandardFill(ctx, s);
  }

  _renderStandardFill(ctx, s) {
    if (s.popDepth > 0) this._renderPopExtrusion(ctx, s);
    if (s.shapeType === 'tetromino') {
      this._renderTetrominoFaces(ctx, s);
      return;
    }
    if (s.is25D && !s.popDepth && !['sphere', 'cube'].includes(s.shapeType)) {
      const steps = 12, dx = Math.cos(this.lightAngle + Math.PI) * s.depth, dy = Math.sin(this.lightAngle + Math.PI) * s.depth;
      for (let i = steps; i > 0; i--) { const r = i / steps; ctx.save(); ctx.translate(dx * r, dy * r); ctx.fillStyle = `hsl(${s.color.h}, ${s.color.s}%, ${s.color.l * (0.4 + r * 0.3)}%)`; ctx.fill(s.path); ctx.restore(); }
    }
    if (s.shapeType === 'sphere') {
      const hx = Math.cos(this.lightAngle) * (s.size * 0.3), hy = Math.sin(this.lightAngle) * (s.size * 0.3);
      const g = ctx.createRadialGradient(hx, hy, s.size * 0.02, 0, 0, s.size * 0.75);
      g.addColorStop(0, `hsl(${s.color.h}, 90%, 82%)`); g.addColorStop(0.2, `hsl(${s.color.h}, 85%, 60%)`); g.addColorStop(0.6, `hsl(${s.color.h}, 80%, 35%)`); g.addColorStop(1, `hsl(${s.color.h}, 100%, 5%)`);
      ctx.fillStyle = g; ctx.fill(s.path);
      ctx.save(); ctx.globalCompositeOperation = 'screen'; const specG = ctx.createRadialGradient(hx, hy, 0, hx, hy, s.size * 0.12); specG.addColorStop(0, 'rgba(255,255,255,0.45)'); specG.addColorStop(1, 'transparent'); ctx.fillStyle = specG; ctx.beginPath(); ctx.arc(hx, hy, s.size * 0.12, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    } else if (s.shapeType === 'cube') {
      const halfW = s.size * 0.5 * (s.shapeVariation?.aspectX || 1);
      const halfH = s.size * 0.5 * (s.shapeVariation?.aspectY || 1);
      const d = s.depth * 0.8, lx = Math.cos(this.lightAngle), ly = Math.sin(this.lightAngle);
      ctx.fillStyle = `hsl(${s.color.h}, 85%, 50%)`; ctx.fillRect(-halfW, -halfH, halfW * 2, halfH * 2);
      ctx.fillStyle = `hsl(${s.color.h}, 75%, ${mapRange(ly, -1, 1, 72, 32)}%)`; ctx.beginPath(); ctx.moveTo(-halfW, -halfH); ctx.lineTo(-halfW + d, -halfH - d); ctx.lineTo(halfW + d, -halfH - d); ctx.lineTo(halfW, -halfH); ctx.fill();
      ctx.fillStyle = `hsl(${s.color.h}, 75%, ${mapRange(lx, -1, 1, 72, 32)}%)`; ctx.beginPath(); ctx.moveTo(halfW, -halfH); ctx.lineTo(halfW + d, -halfH - d); ctx.lineTo(halfW + d, halfH - d); ctx.lineTo(halfW, halfH); ctx.fill();
    } else {
      const lx = Math.cos(this.lightAngle) * s.size, ly = Math.sin(this.lightAngle) * s.size;
      const g = ctx.createLinearGradient(-lx, -ly, lx, ly); g.addColorStop(0, `hsl(${s.color.h}, 85%, 72%)`); g.addColorStop(0.5, `hsl(${s.color.h}, 85%, 50%)`); g.addColorStop(1, `hsl(${s.color.h}, 80%, 15%)`);
      ctx.fillStyle = g; ctx.fill(s.path, 'evenodd');
      ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5; ctx.stroke(s.path); ctx.restore();
    }
  }

  _renderPopExtrusion(ctx, s) {
    const angle = this.lightAngle + Math.PI;
    const steps = Math.max(5, Math.round(s.popDepth / 5));
    for (let i = steps; i > 0; i--) {
      const amount = (i / steps) * s.popDepth;
      ctx.save();
      ctx.translate(Math.cos(angle) * amount, Math.sin(angle) * amount);
      ctx.fillStyle = `hsla(${s.color.h}, ${s.color.s}%, ${Math.max(9, s.color.l * (0.25 + i / steps * 0.28))}%, 0.96)`;
      ctx.fill(s.path, 'evenodd');
      ctx.restore();
    }
  }

  // A few shape-specific marks make the new silhouettes read as distinct
  // objects rather than generic polygons wearing different outlines.
  _renderSilhouetteDetails(ctx, s) {
    if (!['capsule', 'arch', 'crescent', 'starburst', 'clover', 'lightning-bolt'].includes(s.shapeType)) return;
    const r = s.size / 2;
    ctx.save();
    ctx.clip(s.path, 'evenodd');
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = `hsla(${s.color.h}, 100%, 92%, 0.42)`;
    ctx.fillStyle = `hsla(${s.color.h}, 100%, 86%, 0.16)`;
    ctx.lineWidth = Math.max(1, s.borderWidth * 1.5);

    if (s.shapeType === 'capsule') {
      ctx.beginPath(); ctx.moveTo(-r * 0.34, -r * 0.78); ctx.lineTo(-r * 0.34, r * 0.78); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.34, -r * 0.78); ctx.lineTo(r * 0.34, r * 0.78); ctx.stroke();
    } else if (s.shapeType === 'arch') {
      ctx.beginPath(); ctx.arc(0, -r * 0.08, r * 0.62, Math.PI, 0); ctx.stroke();
      ctx.fillRect(-r * 0.72, r * 0.62, r * 1.44, r * 0.08);
    } else if (s.shapeType === 'crescent') {
      ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.12, r * 0.26, Math.PI * 0.65, Math.PI * 1.75); ctx.stroke();
    } else if (s.shapeType === 'starburst') {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2); ctx.stroke();
    } else if (s.shapeType === 'clover') {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.21, 0, Math.PI * 2); ctx.fill();
    } else if (s.shapeType === 'lightning-bolt') {
      ctx.beginPath(); ctx.moveTo(-r * 0.02, -r * 0.78); ctx.lineTo(-r * 0.18, r * 0.03); ctx.lineTo(r * 0.17, r * 0.68); ctx.stroke();
    }
    ctx.restore();
  }

  _renderStructuralPlanes(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const plane of this.structuralPlanes) {
      ctx.save(); ctx.translate(plane.x, plane.y); ctx.rotate(plane.rotation);
      const g = ctx.createLinearGradient(-plane.w / 2, -plane.h / 2, plane.w / 2, plane.h / 2);
      g.addColorStop(0, `hsla(${plane.color.h}, ${plane.color.s}%, 62%, 0.2)`);
      g.addColorStop(0.52, `hsla(${plane.color.h}, ${plane.color.s}%, 34%, 0.08)`);
      g.addColorStop(1, 'rgba(0,0,0,0.02)');
      ctx.fillStyle = g; ctx.fillRect(-plane.w / 2, -plane.h / 2, plane.w, plane.h);
      ctx.strokeStyle = `hsla(${plane.color.h}, 100%, 82%, 0.4)`; ctx.lineWidth = 1.1; ctx.strokeRect(-plane.w / 2, -plane.h / 2, plane.w, plane.h);
      ctx.setLineDash([8, 7]); ctx.strokeStyle = `hsla(${plane.color.h}, 85%, 76%, 0.26)`; ctx.beginPath(); ctx.moveTo(-plane.w / 2, 0); ctx.lineTo(plane.w / 2, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  _renderPrintRegistration(ctx, s) {
    if (!s.registration || s.isCutout) return;
    const { x, y, color } = s.registration;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = `hsla(${color.h}, ${color.s}%, 76%, 0.55)`;
    ctx.lineWidth = Math.max(1, s.borderWidth * 1.7);
    ctx.setLineDash([3, 4]);
    ctx.stroke(s.path);
    ctx.restore();
  }

  _renderDecalClusters(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const cluster of this.decalClusters) {
      ctx.fillStyle = `hsla(${cluster.color.h}, ${cluster.color.s}%, 82%, 0.48)`;
      ctx.strokeStyle = `hsla(${cluster.color.h}, 100%, 92%, 0.6)`;
      for (const tile of cluster.tiles) {
        ctx.save(); ctx.translate(tile.x, tile.y); ctx.rotate(tile.rotation);
        if (tile.triangle) {
          ctx.beginPath(); ctx.moveTo(0, -tile.size); ctx.lineTo(tile.size * 0.8, tile.size); ctx.lineTo(-tile.size * 0.8, tile.size); ctx.closePath(); ctx.fill(); ctx.stroke();
        } else {
          ctx.fillRect(-tile.size / 2, -tile.size / 2, tile.size, tile.size); ctx.strokeRect(-tile.size / 2, -tile.size / 2, tile.size, tile.size);
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }

  _renderTetrominoFaces(ctx, s) {
    for (const block of s.tetrominoBlocks || []) {
      const g = ctx.createLinearGradient(block.x - block.w / 2, block.y - block.h / 2, block.x + block.w / 2, block.y + block.h / 2);
      g.addColorStop(0, `hsl(${s.color.h}, 92%, 76%)`);
      g.addColorStop(0.48, `hsl(${s.color.h}, 86%, 52%)`);
      g.addColorStop(1, `hsl(${s.color.h}, 78%, 22%)`);
      ctx.fillStyle = g;
      ctx.fillRect(block.x - block.w / 2, block.y - block.h / 2, block.w, block.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(block.x - block.w / 2, block.y - block.h / 2, block.w, block.h);
    }
  }

  _renderInterlocks(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';
    for (const lock of this.interlocks) {
      const dx = lock.to.x - lock.from.x, dy = lock.to.y - lock.from.y;
      const distance = Math.hypot(dx, dy) || 1;
      const start = { x: lock.from.x + dx / distance * lock.from.size * 0.22, y: lock.from.y + dy / distance * lock.from.size * 0.22 };
      const end = { x: lock.to.x - dx / distance * lock.to.size * 0.22, y: lock.to.y - dy / distance * lock.to.size * 0.22 };
      const control = { x: (start.x + end.x) / 2 - dy / distance * lock.bend, y: (start.y + end.y) / 2 + dx / distance * lock.bend };
      ctx.save();
      ctx.shadowColor = `hsl(${lock.color.h}, 100%, 65%)`;
      ctx.shadowBlur = Math.min(12, lock.width * 0.35);
      ctx.strokeStyle = `hsla(${lock.color.h}, ${lock.color.s}%, 32%, 0.82)`;
      ctx.lineWidth = lock.width;
      ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.quadraticCurveTo(control.x, control.y, end.x, end.y); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `hsla(${lock.color.h}, 100%, 82%, 0.62)`;
      ctx.lineWidth = Math.max(1.2, lock.width * 0.14);
      ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.quadraticCurveTo(control.x, control.y, end.x, end.y); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // 3. A clipped highlight/shadow pass gives flat vector fills a more tactile,
  // lacquered surface while preserving the original shape language.
  _renderMaterialRim(ctx, s) {
    if (s.shapeType === 'sphere' || s.isCutout) return;
    const r = s.size * 0.5;
    ctx.save();
    ctx.clip(s.path);
    ctx.globalCompositeOperation = 'soft-light';
    const highlight = ctx.createLinearGradient(-r, -r, r, r);
    highlight.addColorStop(0, 'rgba(255,255,255,0.26)');
    highlight.addColorStop(0.32, 'rgba(255,255,255,0.04)');
    highlight.addColorStop(0.7, 'rgba(0,0,0,0.05)');
    highlight.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = highlight; ctx.fillRect(-r, -r, s.size, s.size);
    ctx.restore();
  }

  _renderBorders(ctx, s) {
    if (s.shapeType === 'sphere') return;
    if (Math.random() > 0.5) { ctx.save(); ctx.strokeStyle = `hsla(${s.color.h}, 80%, 70%, 0.25)`; ctx.lineWidth = s.borderWidth * 2.0; ctx.stroke(s.path); ctx.restore(); }
    ctx.save(); ctx.translate(Math.cos(this.lightAngle) * 2.0, Math.sin(this.lightAngle) * 2.0); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.6; ctx.stroke(s.path); ctx.restore();
    ctx.strokeStyle = `hsl(${s.color.h}, 85%, ${Math.min(s.color.l + 10, 85)}%)`; ctx.lineWidth = s.borderWidth; ctx.stroke(s.path);
  }

  _renderFlowRibbons(ctx, layer = 'all') {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalCompositeOperation = 'screen';
    for (const c of this.energyCurves) {
      if (layer !== 'all' && c.layer !== layer) continue;
      const color = `hsl(${c.color.h}, 100%, 65%)`;
      ctx.shadowColor = color; ctx.shadowBlur = 3;
      for (const segment of c.segments) {
        const tap = Math.sin(segment.t0 * Math.PI), w = (c.width * tap) + 1;
        ctx.strokeStyle = color; ctx.globalAlpha = 0.045 * tap; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(segment.from.x, segment.from.y); ctx.lineTo(segment.to.x, segment.to.y); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.065 * tap; ctx.lineWidth = w * 0.1; ctx.beginPath(); ctx.moveTo(segment.from.x, segment.from.y); ctx.lineTo(segment.to.x, segment.to.y); ctx.stroke();
        if (Math.random() > 0.98) { ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(segment.from.x, segment.from.y, randomRange(0.5, 2), 0, Math.PI * 2); ctx.fill(); }
      }
    }
    ctx.restore();
  }

  _getStripeOffsets(stripeType) {
    if (stripeType === 'triple') return [-6, 0, 6];
    if (stripeType === 'double') return [-3.5, 3.5];
    return [0];
  }

  _renderStripes(ctx, layer = 'all') {
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const conn of this.connections) {
      if (layer !== 'all' && conn.layer !== layer) continue;
      const s1 = this.shapes[conn.from], s2 = this.shapes[conn.to], color = `hsl(${conn.color.h}, 100%, 60%)`;
      ctx.shadowColor = color; ctx.shadowBlur = 2;
      const offs = this._getStripeOffsets(conn.stripeType);
      offs.forEach((o, i) => {
        ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha = conn.gazeGuide ? 0.2 : 0.08; ctx.lineWidth = conn.gazeGuide ? (i === 1 ? 1.8 : 0.85) : conn.stripeType === 'double' ? 0.9 : 1.1; this._drawStripePath(ctx, s1, s2, o, conn.controlPoint);
        if (conn.gazeGuide || Math.random() > 0.8) { ctx.strokeStyle = '#fff'; ctx.globalAlpha = conn.gazeGuide ? 0.3 : 0.15; ctx.setLineDash(conn.gazeGuide ? [8, 26] : [12, 48]); this._drawStripePath(ctx, s1, s2, o, conn.controlPoint); }
        ctx.restore();
      });
      if (conn.gazeGuide || Math.random() > 0.4) {
        const t = conn.gazeGuide ? 0.5 : Math.random(); let p = conn.controlPoint ? getQuadraticBezier(t, s1, conn.controlPoint, s2) : { x: s1.x + (s2.x - s1.x) * t, y: s1.y + (s2.y - s1.y) * t };
        ctx.save(); const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 10); g.addColorStop(0, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.shadowColor = color; ctx.shadowBlur = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 2.0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }
    ctx.restore();
  }

  _renderMiniChains(ctx, layer = 'all') {
    ctx.save();
    for (const c of this.miniChains) {
      if (layer !== 'all' && c.layer !== layer) continue;
      ctx.fillStyle = `hsl(${c.color.h}, 100%, 60%)`; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      for (let i = 0; i <= 40; i++) {
        const t = i / 40, { x, y } = getCubicBezier(t, c.p);
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * Math.PI * 4); ctx.beginPath();
        if (c.type === 'circle') ctx.arc(0, 0, c.size, 0, Math.PI * 2); else ctx.rect(-c.size/2, -c.size/2, c.size, c.size);
        ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
    ctx.restore();
  }

  _renderGhostTrails(ctx, s) {
    if (!s.hasGhost) return;
    for (let g = s.ghostCount; g > 0; g--) {
      ctx.save(); const melt = g * 0.05; ctx.translate(Math.cos(s.ghostAngle) * s.ghostDist * g, Math.sin(s.ghostAngle) * s.ghostDist * g); ctx.scale(1 + g * 0.02, 1 + g * 0.02); ctx.transform(1, s.skew + melt, melt * 0.5, 1, 0, 0);
      ctx.globalAlpha = 0.1 / g; ctx.fillStyle = `hsl(${s.color.h}, 100%, 70%)`; if (g > 5) ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5); ctx.fill(s.path); ctx.restore();
    }
  }

  _renderPixelBlur(ctx, s) {
    if (!s.hasPixelBlur) return;
    ctx.fillStyle = `hsl(${s.color.h}, 100%, 60%)`;
    for (let i = 1; i <= 5; i++) {
      const t = i / 5; ctx.save(); ctx.translate(Math.cos(s.pixelBlurAngle) * s.pixelBlurDist * t, Math.sin(s.pixelBlurAngle) * s.pixelBlurDist * t); ctx.globalAlpha = (1 - t) * 0.4;
      ctx.save(); ctx.clip(s.path); const b = s.size * 0.6; for (let px = -b; px < b; px += s.pixelBlurSize) { for (let py = -b; py < b; py += s.pixelBlurSize) { if (Math.random() > 0.4) ctx.fillRect(px, py, s.pixelBlurSize - 1, s.pixelBlurSize - 1); } }
      ctx.restore(); ctx.restore();
    }
  }

  _renderDataStamps(ctx, s) {
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.textAlign = 'center';
    ctx.save(); ctx.clip(s.path); for (let i = 0; i < 2; i++) { ctx.save(); ctx.translate(randomRange(-s.size/2, s.size/2), randomRange(-s.size/2, s.size/2)); ctx.rotate(randomRange(-0.3, 0.3)); ctx.fillText(s.snippet.substring(0, 20), 0, 0); ctx.restore(); }
    ctx.restore(); ctx.restore();
  }

  _renderGlitch(ctx, s) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) {
      if (Math.random() > 0.6) {
        const sy = (i / 4) * s.size - s.size/2, sh = s.size / 4, ox = (Math.random() - 0.5) * 15 * s.glitchFactor;
        ctx.save(); ctx.beginPath(); ctx.rect(-s.size/2, sy, s.size, sh); ctx.clip(); ctx.globalAlpha = 0.4;
        ctx.fillStyle = 'rgba(255,0,0,0.5)'; ctx.save(); ctx.translate(ox, 0); ctx.fill(s.path); ctx.restore();
        ctx.fillStyle = 'rgba(0,255,255,0.5)'; ctx.save(); ctx.translate(-ox, 0); ctx.fill(s.path); ctx.restore(); ctx.restore();
      }
    }
    ctx.restore();
  }

  _renderBloom(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.shadowColor = 'rgba(255,255,255,0.12)'; ctx.shadowBlur = 2; ctx.globalAlpha = 0.05;
    this._renderFlowRibbons(ctx); this._renderStripes(ctx); this._renderDataPulses(ctx); ctx.restore();
  }

  _renderMidgroundHaze(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'screen'; const g = ctx.createRadialGradient(this.width / 2, this.height * 0.3, 0, this.width / 2, this.height * 0.3, this.width * 1.2); g.addColorStop(0, `hsla(${this.palette[0].h}, 90%, 4%, 0.06)`); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.fillRect(0, 0, this.width, this.height); ctx.restore();
  }

  _renderChromaticAberration(ctx, s) {
    ctx.save(); ctx.globalCompositeOperation = 'screen'; [{ f: 'rgba(255,0,0,0.5)', x: -3, y: 0 }, { f: 'rgba(0,255,255,0.5)', x: 3, y: 0 }].forEach(c => { ctx.save(); ctx.translate(c.x, c.y); ctx.fillStyle = c.f; ctx.fill(s.path); ctx.restore(); }); ctx.restore();
    this._renderStandardFill(ctx, s);
  }

  _renderPatterns(ctx, s) {
    if (s.hasPattern) { ctx.save(); ctx.clip(s.path); ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = ctx.createPattern(this.patternCache.get(s.patternType), 'repeat'); ctx.fillRect(-s.size, -s.size, s.size * 2, s.size * 2); ctx.restore(); }
  }

  _renderNestedGeometry(ctx, s) {
    if (!s.hasNestedGeometry || s.shapeType === 'sphere' || s.shapeType === 'cube') return;
    ctx.save();
    ctx.clip(s.path);
    
    // Choose contrasting color from palette
    const contrastColor = this.palette[(this.palette.indexOf(s.color) + 2) % this.palette.length] || this.palette[0];
    ctx.fillStyle = `hsla(${contrastColor.h}, ${contrastColor.s}%, ${contrastColor.l}%, 0.4)`;
    ctx.strokeStyle = `hsla(${contrastColor.h}, ${contrastColor.s}%, ${contrastColor.l}%, 0.6)`;
    ctx.lineWidth = 1.5;

    const r = s.size / 2;
    if (s.nestedType === 'rings') {
      for (let cr = r * 0.2; cr < r; cr += r * 0.25) {
        ctx.beginPath();
        ctx.arc(0, 0, cr, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (s.nestedType === 'stripes') {
      const spacing = s.size * 0.12;
      ctx.beginPath();
      for (let x = -s.size; x < s.size; x += spacing) {
        ctx.moveTo(x, -s.size);
        ctx.lineTo(x + s.size, s.size);
      }
      ctx.stroke();
    } else if (s.nestedType === 'inset') {
      ctx.save();
      ctx.scale(0.5, 0.5);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = `hsla(${contrastColor.h}, ${contrastColor.s}%, ${contrastColor.l}%, 0.8)`;
      ctx.fill(s.path);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke(s.path);
      ctx.restore();
    } else if (s.nestedType === 'grid') {
      const step = s.size * 0.15;
      ctx.beginPath();
      for (let xy = -r; xy <= r; xy += step) {
        ctx.moveTo(xy, -r); ctx.lineTo(xy, r);
        ctx.moveTo(-r, xy); ctx.lineTo(r, xy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  _renderStripeGroups(ctx, layer = 'all') {
    ctx.save();
    for (const g of this.stripeGroups) {
      if (layer !== 'all' && g.layer !== layer) continue;
      ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.rotation); ctx.transform(1, g.skew, 0, 1, 0, 0);
      ctx.strokeStyle = `hsl(${g.color.h}, ${g.color.s}%, ${g.color.l}%)`; ctx.globalAlpha = 0.35; ctx.shadowColor = 'rgba(0,0,0,0.42)'; ctx.shadowBlur = 3; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
      g.lines.forEach((l, i) => {
        const ox = i * g.spacing; ctx.lineWidth = l.width; ctx.beginPath(); ctx.moveTo(ox, l.staggerStart); ctx.lineTo(ox, l.staggerStart + l.length + l.staggerEnd); ctx.stroke();
        if (Math.random() > 0.5) { ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.6; ctx.fillRect(ox - 2, l.staggerStart - 5, 4, 4); }
      });
      ctx.restore();
    }
    ctx.restore();
  }

  _drawStripePath(ctx, s1, s2, offset, cp) {
    const a = Math.atan2(s2.y - s1.y, s2.x - s1.x), ox = Math.cos(a + Math.PI/2) * offset, oy = Math.sin(a + Math.PI/2) * offset;
    ctx.beginPath(); ctx.moveTo(s1.x + ox, s1.y + oy); if (cp) ctx.quadraticCurveTo(cp.x + ox, cp.y + oy, s2.x + ox, s2.y + oy); else ctx.lineTo(s2.x + ox, s2.y + oy); ctx.stroke();
  }

  _renderDataPulses(ctx, layer = 'all') {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    
    const mm = this.latest.mm || 0;
    const ss = this.latest.ss || 0;
    const pt = this.latest.ptSmoothed !== undefined ? this.latest.ptSmoothed : (this.latest.pt || 50);
    const numPulses = Math.floor(mapRange(pt, 0, 150, 1, 3));

    for (const conn of this.connections) {
      if (layer !== 'all' && conn.layer !== layer) continue;
      const s1 = this.shapes[conn.from];
      const s2 = this.shapes[conn.to];
      const color = `hsl(${conn.color.h}, 100%, 75%)`;

      for (let p = 0; p < numPulses; p++) {
        const tOffset = p * 0.3;
        const t = ((conn.from * 17 + mm * 60 + ss) / 100 + tOffset) % 1.0;

        let ptPos, dx, dy;
        if (conn.controlPoint) {
          ptPos = getQuadraticBezier(t, s1, conn.controlPoint, s2);
          dx = 2 * (1 - t) * (conn.controlPoint.x - s1.x) + 2 * t * (s2.x - conn.controlPoint.x);
          dy = 2 * (1 - t) * (conn.controlPoint.y - s1.y) + 2 * t * (s2.y - conn.controlPoint.y);
        } else {
          ptPos = { x: s1.x + (s2.x - s1.x) * t, y: s1.y + (s2.y - s1.y) * t };
          dx = s2.x - s1.x;
          dy = s2.y - s1.y;
        }
        const ang = Math.atan2(dy, dx);

        ctx.save();
        ctx.translate(ptPos.x, ptPos.y);
        ctx.rotate(ang);

        const trailLen = randomRange(15, 30);
        const grad = ctx.createLinearGradient(-trailLen, 0, 0, 0);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.7, `hsla(${conn.color.h}, 100%, 75%, 0.3)`);
        grad.addColorStop(1, '#ffffff');

        ctx.strokeStyle = grad;
        ctx.lineWidth = conn.width * 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-trailLen, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();

        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, conn.width * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  _drawHUDDecorations(ctx, s) {
    ctx.save();
    // Rotate counter to parent shape rotation to keep text/HUD upright or aligned differently
    ctx.rotate(-s.rotation);
    
    ctx.strokeStyle = `hsla(${s.color.h}, 100%, 80%, 0.45)`;
    ctx.lineWidth = 0.8;
    ctx.fillStyle = `hsla(${s.color.h}, 100%, 85%, 0.7)`;
    ctx.font = '8px monospace';
    
    const r = s.size / 2;
    const hudR = r + 15;

    // Outer thin circular ring
    ctx.beginPath();
    ctx.arc(0, 0, hudR, 0, Math.PI * 2);
    ctx.stroke();

    // Small tick marks at 0, 90, 180, 270 degrees
    const tickLen = 4;
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(cos * hudR, sin * hudR);
      ctx.lineTo(cos * (hudR - tickLen), sin * (hudR - tickLen));
      ctx.stroke();
    }

    // A tiny crosshair at the center
    const ch = 3;
    ctx.beginPath();
    ctx.moveTo(-ch, 0); ctx.lineTo(ch, 0);
    ctx.moveTo(0, -ch); ctx.lineTo(0, ch);
    ctx.stroke();

    // Data-driven numeric stamp next to the ring
    const bp = this.latest.bpSmoothed !== undefined ? Math.round(this.latest.bpSmoothed) : (this.latest.bp || 100);
    const labelX = Math.cos(Math.PI / 4) * (hudR + 6);
    const labelY = Math.sin(Math.PI / 4) * (hudR + 6);
    ctx.textAlign = 'left';
    ctx.fillText(`${bp}%`, labelX, labelY);
    
    ctx.restore();
  }

  _renderTypoGrid(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    
    const margin = 40;
    const w = this.width;
    const h = this.height;
    const color = `hsla(${this.palette[0].h}, 100%, 80%, 0.35)`;
    const textColor = 'rgba(255, 255, 255, 0.5)';
    const bp = this.latest.bpSmoothed !== undefined ? Math.round(this.latest.bpSmoothed) : (this.latest.bp || 100);
    const hh = String(this.latest.hh || 12).padStart(2, '0');
    const mm = String(this.latest.mm || 0).padStart(2, '0');
    const up = this.latest.up || 3600;

    // 1. Margins and Ticks
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;
    
    // Vertical left guide line
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, h - margin);
    ctx.stroke();

    // Horizontal bottom guide line
    ctx.beginPath();
    ctx.moveTo(margin, h - margin);
    ctx.lineTo(w - margin, h - margin);
    ctx.stroke();

    // Tick marks on left vertical guide
    for (let y = margin + 100; y < h - margin; y += 100) {
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(margin + 5, y);
      ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.font = '6px monospace';
      ctx.fillText(`${y}`, margin - 25, y + 2);
    }

    // 2. Corner Metadata Text
    ctx.fillStyle = textColor;
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';

    // Top-Left corner
    ctx.fillText('SYS.INIT // OK', margin, margin - 15);
    ctx.fillText(`SYS.TIME // ${hh}:${mm}`, margin, margin - 5);

    // Top-Right corner
    ctx.textAlign = 'right';
    const bar = '='.repeat(Math.round(bp / 20)).padEnd(5, ' ');
    ctx.fillText(`BATTERY [${bar}] ${bp}%`, w - margin, margin - 15);
    ctx.fillText(`UPTIME // ${Math.floor(up / 3600)}h`, w - margin, margin - 5);

    // Bottom-Left corner
    ctx.textAlign = 'left';
    ctx.fillText('SYSTEM // TRILL.AUTO_V2.02', margin, h - margin + 15);
    ctx.fillText('COORD  // 40° 42\' N // 74° 00\' W', margin, h - margin + 25);

    // Bottom-Right corner
    ctx.textAlign = 'right';
    const seed = Math.abs(this.lightAngle * 1000).toString(16).substring(0, 6).toUpperCase();
    ctx.fillText(`SEED // ${seed}`, w - margin, h - margin + 15);
    ctx.fillText('STATUS // DEPLOYED', w - margin, h - margin + 25);

    // 3. Vertical text along left line
    ctx.save();
    ctx.translate(margin - 10, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = '7px monospace';
    ctx.fillText('GENERATIVE POSTMODERN WALLPAPER ENGINE // STYLE.TRILL', 0, 0);
    ctx.restore();

    // 4. Shape labels (Callout lines)
    const fgShapes = this.shapes.filter(s => s.layer === 'foreground').slice(0, 2);
    for (let s of fgShapes) {
      ctx.save();
      const angle = s.rotation + Math.PI / 4;
      const r = s.size / 2;
      const startX = s.x + Math.cos(angle) * r;
      const startY = s.y + Math.sin(angle) * r;
      const endX = startX + Math.cos(angle) * 30;
      const endY = startY + Math.sin(angle) * 30;
      
      // Draw callout line
      ctx.strokeStyle = color;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.lineTo(endX + (Math.cos(angle) >= 0 ? 15 : -15), endY);
      ctx.stroke();

      // Label text
      ctx.fillStyle = textColor;
      ctx.font = '7px monospace';
      ctx.textAlign = Math.cos(angle) >= 0 ? 'left' : 'right';
      const typeStr = s.shapeType.toUpperCase();
      ctx.fillText(`${typeStr}:${Math.round(s.size)}px`, endX + (Math.cos(angle) >= 0 ? 18 : -18), endY + 2.5);
      ctx.restore();
    }

    ctx.restore();
  }

  _renderRegistrationMarks(ctx) {
    const inset = 18;
    const length = 12;
    const color = this.palette[0] || { h: 200, s: 80, l: 70 };
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.42)`;
    ctx.lineWidth = 1;
    for (const [x, y, dx, dy] of [
      [inset, inset, 1, 1], [this.width - inset, inset, -1, 1],
      [inset, this.height - inset, 1, -1], [this.width - inset, this.height - inset, -1, -1]
    ]) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * length, y); ctx.moveTo(x, y); ctx.lineTo(x, y + dy * length); ctx.stroke();
    }
    ctx.restore();
  }

  _renderGlobalGlitch(ctx) {
    // Determine glitch rate based on smoothed battery level (more glitchy if low battery)
    const bp = this.latest.bpSmoothed !== undefined ? this.latest.bpSmoothed : (this.latest.bp || 100);
    const glitchChance = mapRange(bp, 0, 100, 0.5, 0.1);
    if (Math.random() > glitchChance) return;

    const w = this.width;
    const h = this.height;
    const numSlices = Math.floor(randomRange(3, 8));

    // Create a small slice buffer instead of full screen copy (reduce memory by ~88%)
    const maxSliceH = Math.ceil(h * 0.12);
    const tempCanvas = createCanvas(w, maxSliceH);
    const tempCtx = tempCanvas.getContext('2d');

    for (let i = 0; i < numSlices; i++) {
      const sliceY = Math.random() * (h - maxSliceH);
      const sliceH = Math.floor(randomRange(15, maxSliceH));
      const offset = (Math.random() - 0.5) * 35; // Horizontal shift

      // Copy slice from main canvas to temp buffer
      tempCtx.clearRect(0, 0, w, maxSliceH);
      tempCtx.drawImage(ctx.canvas, 0, sliceY, w, sliceH, 0, 0, w, sliceH);

      // Draw the offset slice back
      ctx.drawImage(
        tempCanvas,
        0, 0, w, sliceH,
        offset, sliceY, w, sliceH
      );

      // Chromatic aberration overlay on the slice
      if (Math.random() > 0.4) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.5;
        // Red offset channel
        ctx.drawImage(tempCanvas, 0, 0, w, sliceH, offset - 4, sliceY, w, sliceH);
        // Cyan offset channel
        ctx.drawImage(tempCanvas, 0, 0, w, sliceH, offset + 4, sliceY, w, sliceH);
        ctx.restore();
      }
    }
  }

  _renderBackgroundNumerals(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.font = '900 320px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const color = this.palette[0] || { h: 200, s: 80, l: 60 };
    ctx.fillStyle = `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.05)`;
    ctx.strokeStyle = `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.09)`;
    ctx.lineWidth = 1.5;

    const hh = String(this.latest.hh || 12).padStart(2, '0');
    const mm = String(this.latest.mm || 0).padStart(2, '0');

    ctx.fillText(hh, this.width * 0.35, this.height * 0.32);
    ctx.strokeText(hh, this.width * 0.35, this.height * 0.32);

    ctx.fillText(mm, this.width * 0.65, this.height * 0.62);
    ctx.strokeText(mm, this.width * 0.65, this.height * 0.62);
    
    ctx.restore();
  }

  _renderPerspectiveGrid(ctx) {
    if (Math.random() > 0.6) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    
    const w = this.width;
    const h = this.height;
    
    const color = this.palette[1] || { h: 180, s: 70, l: 50 };
    ctx.strokeStyle = `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.15)`;
    ctx.lineWidth = 0.8;

    const vanishingX = w / 2;
    const vanishingY = h * 0.45;
    
    const numRadial = 18;
    ctx.beginPath();
    for (let i = 0; i <= numRadial; i++) {
      const angle = Math.PI * (0.05 + (i / numRadial) * 0.9);
      const dx = Math.cos(angle) * w * 1.5;
      const dy = Math.sin(angle) * h * 1.5;
      ctx.moveTo(vanishingX, vanishingY);
      ctx.lineTo(vanishingX + dx, vanishingY + dy);
    }
    ctx.stroke();

    const numHorizontal = 12;
    ctx.beginPath();
    for (let i = 0; i < numHorizontal; i++) {
      const t = Math.pow(i / numHorizontal, 2.2);
      const y = vanishingY + t * (h - vanishingY) * 1.2;
      if (y > h) continue;
      
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    ctx.restore();
  }

  _renderHalftoneScreen(ctx) {
    if (Math.random() > 0.5) return;
    ctx.save();
    
    const w = this.width;
    const h = this.height;
    
    const off = createCanvas(w, h);
    const octx = off.getContext('2d');
    
    const pattern = octx.createPattern(this.patternCache.get('halftone'), 'repeat');
    octx.fillStyle = pattern;
    octx.fillRect(0, 0, w, h);
    
    octx.globalCompositeOperation = 'source-in';
    const color = this.palette[2] || this.palette[0];
    const grad = octx.createLinearGradient(0, h, 0, h * 0.35);
    grad.addColorStop(0, `hsla(${color.h}, ${color.s}%, 70%, 0.15)`);
    grad.addColorStop(1, 'transparent');
    octx.fillStyle = grad;
    octx.fillRect(0, 0, w, h);
    
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(off, 0, 0);
    
    ctx.restore();
  }
}
