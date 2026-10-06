import { Style } from '../core/Style.js';
import { mapRange, randomRange } from '../utils/math.js';
import * as canvasUtils from '../utils/canvas.js';
import * as colorUtils from '../utils/color.js';
import { Path2D, createCanvas } from '@napi-rs/canvas';

/**
 * ExpressiveMaterialStyle: A Material 3 Expressive inspired style featuring
 * the real M3 shape library (cookie, clover, burst, gem, squircle, pill, arch),
 * vibrant dynamic palettes, and layered depth.
 * Optimized with canvas reuse, pattern batching, and native filters.
 */
export class ExpressiveMaterialStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.blobs = [];
    this.palette = [];
    this.patternPaths = new Map();
    this.timeData = { hh: 12, mm: 0 };
    // Reuse canvases to avoid GC pressure
    this.offscreen = null;
    this.blurCanvas = null;
    this.patternCanvas = null;
  }

  async init(data) {
    await super.init(data);
    
    // Initialize or resize reusable canvases
    if (!this.offscreen || this.offscreen.width !== this.width || this.offscreen.height !== this.height) {
      this.offscreen = createCanvas(this.width, this.height);
      this.blurCanvas = createCanvas(this.width, this.height);
      this.patternCanvas = createCanvas(256, 256); // Buffer for pattern tiles
    }

    if (!data || data.length === 0) return;

    const latest = data[data.length - 1];
    this.timeData = { hh: latest.hh, mm: latest.mm };
    this._initPalette(latest);
    this._generateBlobs(data);
  }

  _initPalette(entry) {
    const hueOffset = Math.random() * 360;
    const baseHue = (mapRange(entry.hh + (entry.mm / 60), 0, 24, 0, 360) + hueOffset) % 360;
    const saturation = mapRange(entry.fm, 0, 100, 85, 100); 
    
    this.isLightMode = entry.hh >= 6 && entry.hh < 18;
    this.palette = colorUtils.generateMaterialPalette(baseHue, saturation, this.isLightMode);
  }

  _generateBlobs(data) {
    this.blobs = [];
    const latest = data[data.length - 1];
    const numHeroBlobs = 3; 
    const numExpressiveBlobs = Math.floor(mapRange(latest.bp, 0, 100, 5, 12));

    for (let i = 0; i < numHeroBlobs; i++) {
      const log = data[Math.floor(Math.random() * data.length)];
      this.blobs.push(this._createBlob(log, i, 'hero'));
    }

    for (let i = 0; i < numExpressiveBlobs; i++) {
      const log = data[Math.floor(Math.random() * data.length)];
      this.blobs.push(this._createBlob(log, i, 'expressive'));
    }
  }

  _createPath(points) {
    if (points.length < 3) return null;
    const p = new Path2D();
    let xc1 = (points[points.length - 1].x + points[0].x) / 2;
    let yc1 = (points[points.length - 1].y + points[0].y) / 2;
    p.moveTo(xc1, yc1);

    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      const xc = (p1.x + p2.x) / 2;
      const yc = (p1.y + p2.y) / 2;
      p.quadraticCurveTo(p1.x, p1.y, xc, yc);
    }
    p.closePath();
    return p;
  }

  _pickShapeType() {
    const pool = ['circle', 'squircle', 'clover', 'cookie6', 'cookie9', 'cookie12', 'burst', 'gem5', 'gem6', 'pill', 'arch'];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Real M3 Expressive silhouettes: a periodic radius function per shape
  // family (or a fixed low vertex count for the rounded-polygon "gem" shapes)
  // instead of independently randomized points — that periodicity is what
  // reads as a named shape rather than an amorphous blob.
  _radialShapePoints(shapeType, baseSize, jitterAmp, seed) {
    const config = {
      circle:   { points: 40, lobes: 0,  amp: 0 },
      squircle: { points: 40, lobes: 0,  amp: 0 },
      clover:   { points: 56, lobes: 4,  amp: 0.4 },
      cookie6:  { points: 72, lobes: 6,  amp: 0.14 },
      cookie9:  { points: 72, lobes: 9,  amp: 0.14 },
      cookie12: { points: 90, lobes: 12, amp: 0.12 },
      burst:    { points: 32, lobes: 8,  amp: 0.32 },
      gem5:     { points: 5,  lobes: 0,  amp: 0 },
      gem6:     { points: 6,  lobes: 0,  amp: 0 }
    }[shapeType];

    return Array.from({ length: config.points }, (_, j) => {
      const angle = (j / config.points) * Math.PI * 2;
      let r = baseSize;

      if (shapeType === 'squircle') {
        const n = 4;
        const c = Math.abs(Math.cos(angle)) ** n;
        const s = Math.abs(Math.sin(angle)) ** n;
        r = baseSize / Math.pow(c + s, 1 / n);
      } else if (config.lobes > 0) {
        r = baseSize * (1 - config.amp + config.amp * Math.cos(config.lobes * angle));
      }

      // Faint hand-drawn wobble only: a couple of smooth cycles across the
      // whole shape (tied to angle, not vertex index), so it reads as a
      // gentle asymmetric squash rather than a jagged/noisy edge.
      const wobbleFreq = 2 + (Math.floor(seed) % 3);
      r *= 1 + Math.sin(angle * wobbleFreq + seed) * jitterAmp;
      return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
    });
  }

  _pillPath(baseSize) {
    const p = new Path2D();
    const w = baseSize * 1.9, h = baseSize * 1.05;
    p.roundRect(-w / 2, -h / 2, w, h, h / 2);
    return p;
  }

  _archPath(baseSize) {
    const p = new Path2D();
    const w = baseSize * 1.7, h = baseSize * 1.7;
    p.roundRect(-w / 2, -h / 2, w, h, [w / 2, w / 2, h * 0.12, h * 0.12]);
    return p;
  }

  // Two same-colored shapes stacked near-center-on-center just read as one
  // blob, so same-hue placements need real separation; different-hue overlap
  // is the whole point of the layered look and stays unrestricted.
  _findNonOverlappingPosition(maxR, color) {
    const hueThreshold = 22;
    const overlapAllowance = 0.35;
    const maxAttempts = 30;

    let bestX = randomRange(0, this.width);
    let bestY = randomRange(0, this.height);
    let bestScore = -Infinity;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = randomRange(0, this.width);
      const y = randomRange(0, this.height);

      let score = Infinity;
      for (const b of this.blobs) {
        const hueDist = Math.min(Math.abs(b.color.h - color.h), 360 - Math.abs(b.color.h - color.h));
        if (hueDist > hueThreshold) continue;
        const allowedOverlap = (b.maxR + maxR) * overlapAllowance;
        const clearance = Math.hypot(b.x - x, b.y - y) - (b.maxR + maxR) + allowedOverlap;
        score = Math.min(score, clearance);
      }

      if (score === Infinity) return { x, y }; // no same-hue neighbors at all
      if (score > bestScore) { bestScore = score; bestX = x; bestY = y; }
      if (score >= 0) return { x, y }; // acceptable separation found
    }

    return { x: bestX, y: bestY }; // best-effort fallback after maxAttempts
  }

  _createBlob(log, index, type) {
    const isHero = type === 'hero';
    const baseSize = isHero
      ? randomRange(this.width * 0.3, this.width * 0.6)
      : randomRange(this.width * 0.05, this.width * 0.25);

    const shapeType = this._pickShapeType();
    // Subtle organic edge wobble, scaled by battery — the silhouette itself
    // now comes from the shape family above, so this stays gentle.
    const jitterAmp = mapRange(log.bp, 0, 100, 0.05, 0.012) * randomRange(0.8, 1.2);

    let points = null;
    let path;
    if (shapeType === 'pill') {
      path = this._pillPath(baseSize);
    } else if (shapeType === 'arch') {
      path = this._archPath(baseSize);
    } else {
      points = this._radialShapePoints(shapeType, baseSize, jitterAmp, index);
      path = this._createPath(points);
    }

    const maxR = points
      ? Math.max(...points.map(p => Math.hypot(p.x, p.y)))
      : baseSize * 1.3;

    const baseColor = this.palette[Math.floor(Math.random() * (this.palette.length - 1))];
    const color = {
      h: (baseColor.h + randomRange(-30, 30)) % 360,
      s: Math.min(100, baseColor.s + randomRange(-15, 15)),
      l: Math.min(100, Math.max(0, baseColor.l + randomRange(-10, 10)))
    };

    const { x, y } = this._findNonOverlappingPosition(maxR, color);

    const patterns = ['dots', 'pills', 'stripes', 'grid', 'plus', 'star', 'circle', 'crescent'];
    const patternType = patterns[Math.floor(Math.random() * patterns.length)];
    const gridRotation = Math.random() * Math.PI * 2;
    const isHex = Math.random() > 0.5;
    
    const densityFactor = mapRange(log.fm, 0, 100, 1.8, 0.6) * randomRange(0.8, 1.2);
    const baseSpacing = randomRange(15, 40) / densityFactor;
    const basePatternSize = mapRange(baseSpacing, 10, 80, 2, 10);

    const hasThickBorder = Math.random() > 0.6;
    const borderLayers = hasThickBorder ? 1 : 0;

    return { 
      x, y, points, path, maxR, color, 
      rotation: Math.random() * Math.PI * 2, 
      type,
      border: {
        hasThick: hasThickBorder,
        layers: borderLayers,
        // Scaled to the shape's own radius — a flat 15-40px stroke used to
        // dwarf small "expressive" blobs and read as a thick dark ring.
        baseWidth: Math.max(3, maxR * randomRange(0.02, 0.045))
      },
      pattern: {
        type: patternType,
        spacing: baseSpacing,
        size: basePatternSize,
        rotation: gridRotation,
        isHex,
        densityFactor,
        noiseSeed: Math.random() * 1000
      }
    };
  }

  async process() {
    const steps = 5; // Reduced steps for performance
    for (let s = 0; s < steps; s++) {
      this.blobs.forEach((blob, i) => {
        const speed = blob.type === 'hero' ? 0.002 : 0.005;
        blob.rotation += speed * (i % 2 === 0 ? 1 : -1);
        blob.x += Math.sin(blob.rotation * 0.2) * 2;
        blob.y += Math.cos(blob.rotation * 0.2) * 2;
      });
    }
  }

  async render(ctx, width, height) {
    const octx = this.offscreen.getContext('2d');
    octx.clearRect(0, 0, width, height);

    this._drawBackground(octx, width, height);

    // One light source drives everything: per-blob elevation shadow, gloss
    // highlight and specular rim below, plus the directional motion blur
    // further down — so the whole piece reads as lit from one direction.
    const hour12 = this.timeData.hh % 12;
    const angle = (hour12 / 12) * Math.PI * 2 - Math.PI / 2;

    octx.globalCompositeOperation = 'source-over';
    octx.globalAlpha = 0.8;

    this.blobs.sort((a, b) => (a.type === 'hero' ? -1 : 1));
    this.blobs.forEach(blob => this._drawBlob(octx, blob, angle));

    octx.globalAlpha = 1.0;
    await canvasUtils.drawGrain(octx, width, height, 400);

    const bctx = this.blurCanvas.getContext('2d');
    bctx.clearRect(0, 0, width, height);

    const blurAmount = mapRange(this.timeData.mm, 0, 59, 1, 100);
    
    const passes = Math.min(12, Math.max(4, Math.floor(blurAmount / 8))); 
    bctx.globalAlpha = 1 / passes;
    const dx = Math.cos(angle) * blurAmount / passes;
    const dy = Math.sin(angle) * blurAmount / passes;

    for (let i = 0; i < passes; i++) {
        bctx.drawImage(this.offscreen, i * dx, i * dy);
    }

    ctx.drawImage(this.offscreen, 0, 0);

    ctx.save();
    ctx.filter = 'contrast(1.4) saturate(1.2)';
    ctx.globalCompositeOperation = 'color-burn';
    ctx.globalAlpha = 0.8;
    ctx.drawImage(this.blurCanvas, 0, 0);
    ctx.filter = 'none';
    ctx.restore();
  }

  _drawBackground(ctx, width, height) {
    const bg = this.palette[3]; 
    if (!this.isLightMode) {
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, `hsl(${bg.h}, ${bg.s}%, ${bg.l}%)`);
    grad.addColorStop(1, `hsl(${bg.h}, ${bg.s}%, ${bg.l - 3}%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  _drawBlob(ctx, blob, lightAngle = -Math.PI / 4) {
    ctx.save();
    ctx.translate(blob.x, blob.y);
    ctx.rotate(blob.rotation);

    // Light direction in the blob's own rotated space, so the highlight/
    // shadow stay consistent with the global light regardless of spin.
    const lx = Math.cos(lightAngle - blob.rotation);
    const ly = Math.sin(lightAngle - blob.rotation);
    const isHero = blob.type === 'hero';
    const elevation = isHero ? 26 : 12;

    const alpha = isHero ? 0.9 : 0.8;

    // Directional elevation shadow, drawn as its own blurred silhouette pass
    // (not ctx.shadow*) offset further than it's blurred — that keeps it
    // reading as a cast shadow on one side instead of a halo wrapping the
    // whole shape, and it doesn't bleed through the shape's own translucent
    // fill the way the built-in canvas shadow did.
    const shadowOffset = elevation * 1.1;
    const shadowBlur = elevation * 0.45;
    ctx.save();
    ctx.translate(lx * shadowOffset, ly * shadowOffset);
    ctx.filter = `blur(${shadowBlur}px)`;
    ctx.fillStyle = this.isLightMode ? 'rgba(20,18,25,0.25)' : 'rgba(0,0,0,0.45)';
    ctx.fill(blob.path);
    ctx.filter = 'none';
    ctx.restore();

    ctx.fillStyle = `hsla(${blob.color.h}, ${blob.color.s}%, ${blob.color.l}%, ${alpha})`;
    ctx.fill(blob.path);

    ctx.save();
    ctx.clip(blob.path);
    this._drawPattern(ctx, blob);
    this._drawVolumetricShading(ctx, blob, lx, ly);
    ctx.restore();

    this._drawSpecularRim(ctx, blob, lx, ly);

    if (blob.border.hasThick) {
      const { layers, baseWidth } = blob.border;
      const baseAlpha = this.isLightMode ? 0.2 : 0.15;
      const bColor = { h: blob.color.h, s: blob.color.s * 0.5, l: this.isLightMode ? 98 : 15 };

      ctx.strokeStyle = `hsla(${bColor.h}, ${bColor.s}%, ${bColor.l}%, ${baseAlpha})`;
      ctx.lineWidth = baseWidth;
      ctx.stroke(blob.path);

      if (layers >= 2) {
        ctx.lineWidth = baseWidth * 0.45;
        ctx.stroke(blob.path);
      }
    }
    ctx.restore();
  }

  _drawVolumetricShading(ctx, blob, lx, ly) {
    // Puffy/inflated "sticker" look: a soft gloss highlight offset toward
    // the light, and a soft ambient-occlusion shade on the far side.
    const r = blob.maxR;
    const isHero = blob.type === 'hero';

    const hlx = -lx * r * 0.35;
    const hly = -ly * r * 0.35;
    const highlight = ctx.createRadialGradient(hlx, hly, 0, hlx, hly, r * (isHero ? 0.95 : 0.8));
    const hlAlpha = this.isLightMode ? (isHero ? 0.4 : 0.3) : (isHero ? 0.3 : 0.22);
    highlight.addColorStop(0, `rgba(255,255,255,${hlAlpha})`);
    highlight.addColorStop(0.55, 'rgba(255,255,255,0.05)');
    highlight.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = highlight;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();

    const shx = lx * r * 0.5;
    const shy = ly * r * 0.5;
    const shade = ctx.createRadialGradient(shx, shy, 0, shx, shy, r * 1.1);
    shade.addColorStop(0, `rgba(0,0,0,${isHero ? 0.24 : 0.16})`);
    shade.addColorStop(0.6, 'rgba(0,0,0,0.06)');
    shade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = shade;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }

  _drawSpecularRim(ctx, blob, lx, ly) {
    // A thin bright edge that fades from the light-facing side to the
    // shadow side — a linear gradient stroke along the path itself.
    const r = blob.maxR;
    const rim = ctx.createLinearGradient(-lx * r, -ly * r, lx * r, ly * r);
    const rimAlpha = this.isLightMode ? 0.45 : 0.35;
    rim.addColorStop(0, `rgba(255,255,255,${rimAlpha})`);
    rim.addColorStop(0.45, 'rgba(255,255,255,0.04)');
    rim.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = rim;
    ctx.lineWidth = Math.max(2, r * 0.02);
    ctx.stroke(blob.path);
    ctx.restore();
  }

  _drawPattern(ctx, blob) {
    const { type, spacing, size, rotation, isHex } = blob.pattern;
    const isDarkBlob = blob.color.l < 50;
    const lOffset = isDarkBlob ? 15 : -15; 
    
    const vSpacing = isHex ? spacing * 0.866 : spacing;
    
    this.patternCanvas.width = spacing;
    this.patternCanvas.height = vSpacing;
    const pctx = this.patternCanvas.getContext('2d');
    
    pctx.fillStyle = `hsla(${blob.color.h}, ${blob.color.s * 0.8}%, ${Math.max(0, Math.min(100, blob.color.l + lOffset))}%, 0.5)`;
    pctx.strokeStyle = pctx.fillStyle;
    
    const patternPath = this._getPatternPath(type, size, spacing);
    
    pctx.save();
    pctx.translate(spacing/2, vSpacing/2);
    this._renderPatternUnit(pctx, type, patternPath, size);
    if (isHex) {
        pctx.translate(-spacing/2, -vSpacing/2);
        pctx.translate(0, 0); // Origin unit
        this._renderPatternUnit(pctx, type, patternPath, size);
        pctx.translate(spacing, 0);
        this._renderPatternUnit(pctx, type, patternPath, size);
        pctx.translate(-spacing/2, vSpacing);
        this._renderPatternUnit(pctx, type, patternPath, size);
    }
    pctx.restore();

    const pattern = ctx.createPattern(this.patternCanvas, 'repeat');
    
    ctx.save();
    ctx.rotate(rotation);
    ctx.fillStyle = pattern;
    const bounds = blob.maxR * 1.5;
    ctx.fillRect(-bounds, -bounds, bounds * 2, bounds * 2);
    ctx.restore();
  }

  _renderPatternUnit(ctx, type, path, size) {
    if (type === 'stripes' || type === 'grid' || type === 'circle' || type === 'plus') {
      ctx.lineWidth = Math.max(1, size / 4);
      ctx.stroke(path);
    } else {
      ctx.fill(path);
    }
  }

  _getPatternPath(type, size, spacing) {
    const key = `${type}_${size.toFixed(1)}_${spacing.toFixed(1)}`;
    if (this.patternPaths.has(key)) return this.patternPaths.get(key);

    const p = new Path2D();
    switch(type) {
      case 'dots': 
        p.arc(0, 0, size / 2, 0, Math.PI * 2); 
        break;
      case 'pills': 
        p.roundRect(-size * 1.5, -size / 2, size * 3, size, size / 2);
        break;
      case 'stripes': 
        p.moveTo(-spacing/3, -spacing/3); p.lineTo(spacing/3, spacing/3); 
        break;
      case 'grid': 
        p.rect(-size, -size, size * 2, size * 2); 
        break;
      case 'plus': 
        p.moveTo(-size, 0); p.lineTo(size, 0); p.moveTo(0, -size); p.lineTo(0, size); 
        break;
      case 'star': {
        const spikes = 5;
        const outerRadius = size;
        const innerRadius = size / 2.2;
        let rot = -Math.PI / 2;
        let step = Math.PI / spikes;
        p.moveTo(0, -outerRadius);
        for (let i = 0; i < spikes; i++) {
          p.lineTo(Math.cos(rot) * outerRadius, Math.sin(rot) * outerRadius);
          rot += step;
          p.lineTo(Math.cos(rot) * innerRadius, Math.sin(rot) * innerRadius);
          rot += step;
        }
        p.closePath();
        break;
      }
      case 'circle': 
        p.arc(0, 0, size, 0, Math.PI * 2); 
        break;
      case 'crescent': {
        const radius = size;
        p.arc(0, 0, radius, 0, Math.PI * 2);
        p.arc(radius * 0.6, -radius * 0.3, radius, 0, Math.PI * 2, true);
        break;
      }
    }
    this.patternPaths.set(key, p);
    return p;
  }
}
