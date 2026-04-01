import { Style } from '../core/Style.js';
import { mapRange, randomRange } from '../utils/math.js';
import * as canvasUtils from '../utils/canvas.js';
import * as colorUtils from '../utils/color.js';
import { Path2D } from '@napi-rs/canvas';

/**
 * ExpressiveMaterialStyle: A Material 3 inspired style featuring organic, 
 * fluid shapes, vibrant dynamic palettes, and layered depth.
 */
export class ExpressiveMaterialStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.blobs = [];
    this.palette = [];
    this.patternPaths = new Map();
  }

  async init(data) {
    await super.init(data);
    if (!data || data.length === 0) return;

    const latest = data[data.length - 1];
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

  _createBlob(log, index, type) {
    const isHero = type === 'hero';
    const x = Math.random() * this.width;
    const y = Math.random() * this.height;
    const baseSize = isHero 
      ? randomRange(this.width * 0.3, this.width * 0.6)
      : randomRange(this.width * 0.05, this.width * 0.25);
      
    // Increased wiggle: higher deformation and noise variation
    const deformation = mapRange(log.bp, 0, 100, 0.55, 1.3) * randomRange(0.9, 1.15);
    const numPoints = isHero ? 14 : 10; 
    const points = Array.from({ length: numPoints }, (_, j) => {
      const angle = (j / numPoints) * Math.PI * 2;
      const noise = randomRange(0.75, 1.25); 
      const r = baseSize + (Math.sin(j * 2.2 + index) * 0.5 + 0.5) * baseSize * deformation * noise;
      return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
    });

    const path = this._createPath(points);
    const maxR = Math.max(...points.map(p => Math.hypot(p.x, p.y)));

    const baseColor = this.palette[Math.floor(Math.random() * (this.palette.length - 1))];
    const color = {
      h: (baseColor.h + randomRange(-30, 30)) % 360,
      s: Math.min(100, baseColor.s + randomRange(-15, 15)),
      l: Math.min(100, Math.max(0, baseColor.l + randomRange(-10, 10)))
    };

    // Pattern Configuration
    const patterns = ['dots', 'pills', 'stripes', 'grid', 'plus', 'star', 'circle', 'crescent'];
    const patternType = patterns[Math.floor(Math.random() * patterns.length)];
    const gridRotation = Math.random() * Math.PI * 2;
    const isHex = Math.random() > 0.5;
    
    // Vary density based on ping (latency) and free memory (fm)
    const densityFactor = mapRange(log.fm, 0, 100, 1.8, 0.6) * randomRange(0.8, 1.2);
    const baseSpacing = randomRange(25, 75) / densityFactor;
    const basePatternSize = mapRange(baseSpacing, 15, 120, 2, 14);

    // Border Configuration
    const hasThickBorder = Math.random() > 0.6;
    const borderLayers = hasThickBorder ? (Math.random() > 0.5 ? 2 : 1) : 0;

    return { 
      x, y, points, path, maxR, color, 
      rotation: Math.random() * Math.PI * 2, 
      type,
      border: {
        hasThick: hasThickBorder,
        layers: borderLayers,
        baseWidth: randomRange(15, 40)
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
    // Reduced steps since this is mostly for positioning
    const steps = 10;
    for (let s = 0; s < steps; s++) {
      this.blobs.forEach((blob, i) => {
        const speed = blob.type === 'hero' ? 0.002 : 0.005;
        blob.rotation += speed * (i % 2 === 0 ? 1 : -1);
        blob.x += Math.sin(blob.rotation * 0.2) * 2;
        blob.y += Math.cos(blob.rotation * 0.2) * 2;
      });
    }
  }

  render(ctx, width, height) {
    this._drawBackground(ctx, width, height);
    
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.8;

    // Draw blobs: hero first, then expressive
    this.blobs.sort((a, b) => (a.type === 'hero' ? -1 : 1));
    this.blobs.forEach(blob => this._drawBlob(ctx, blob));

    ctx.globalAlpha = 1.0;
    canvasUtils.drawGrain(ctx, width, height, 600); // Slightly reduced grain density
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

  _drawBlob(ctx, blob) {
    ctx.save();
    ctx.translate(blob.x, blob.y);
    ctx.rotate(blob.rotation);
    
    // Bold solid colors with semi-transparency for overlapping
    const alpha = blob.type === 'hero' ? 0.9 : 0.8;
    ctx.fillStyle = `hsla(${blob.color.h}, ${blob.color.s}%, ${blob.color.l}%, ${alpha})`;
    
    // Shadow pass (only for hero blobs to save performance)
    if (blob.type === 'hero') {
      ctx.save();
      ctx.shadowColor = this.isLightMode ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 20;
      ctx.fill(blob.path);
      ctx.restore();
    } else {
      ctx.fill(blob.path);
    }

    // Pattern Layer 
    ctx.save();
    ctx.clip(blob.path); 
    this._drawPattern(ctx, blob);
    ctx.restore();

    // Multi-layered Thick Border
    if (blob.border.hasThick) {
      const { layers, baseWidth } = blob.border;
      const baseAlpha = this.isLightMode ? 0.2 : 0.15;
      const bColor = { h: blob.color.h, s: blob.color.s * 0.5, l: this.isLightMode ? 98 : 15 };

      ctx.strokeStyle = `hsla(${bColor.h}, ${bColor.s}%, ${bColor.l}%, ${baseAlpha})`;
      ctx.lineWidth = baseWidth;
      ctx.stroke(blob.path);

      if (layers >= 2) {
        ctx.strokeStyle = `hsla(${bColor.h}, ${bColor.s}%, ${bColor.l}%, ${baseAlpha * 1.5})`;
        ctx.lineWidth = baseWidth * 0.45;
        ctx.stroke(blob.path);
      }
    } else if (blob.type === 'expressive') {
      ctx.strokeStyle = `hsla(${blob.color.h}, 100%, 98%, 0.1)`;
      ctx.lineWidth = 2; 
      ctx.stroke(blob.path);
    }
    ctx.restore();
  }

  _drawPattern(ctx, blob) {
    const { type, spacing, size, rotation, isHex, densityFactor, noiseSeed } = blob.pattern;

    const isDarkBlob = blob.color.l < 50;
    const lOffset = isDarkBlob ? 12 : -12; 
    ctx.fillStyle = `hsla(${blob.color.h}, ${blob.color.s * 0.8}%, ${Math.max(0, Math.min(100, blob.color.l + lOffset))}%, 0.6)`;
    ctx.strokeStyle = ctx.fillStyle;
    
    const bounds = blob.maxR + spacing; 
    const vSpacing = isHex ? spacing * 0.866 : spacing; // sqrt(3)/2 approx
    
    ctx.save();
    ctx.rotate(rotation); 
    
    const patternPath = this._getPatternPath(type, size, spacing);
    const skipThreshold = densityFactor * 0.75;
    
    let row = 0;
    for (let y = -bounds; y < bounds; y += vSpacing) {
      const xOffset = (isHex && row % 2 === 0) ? spacing * 0.5 : 0;
      for (let x = -bounds; x < bounds; x += spacing) {
        // Faster pseudo-random for skipping
        const stableSkip = ((Math.abs(x * 123.45 + y * 678.9 + noiseSeed)) % 100) / 100;
        if (stableSkip > skipThreshold) continue; 

        ctx.translate(x + xOffset, y);
        if (type === 'stripes' || type === 'grid' || type === 'plus' || type === 'circle') {
          ctx.lineWidth = Math.max(1, size / 4);
          ctx.stroke(patternPath);
        } else {
          ctx.fill(patternPath);
        }
        ctx.translate(-(x + xOffset), -y);
      }
      row++;
    }
    ctx.restore();
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
        const cutPath = new Path2D();
        cutPath.arc(radius * 0.6, -radius * 0.3, radius, 0, Math.PI * 2, true);
        // Note: Crescent with Path2D might need more care if we want a single path.
        // Actually arc(..., true) makes it counter-clockwise, which "cuts" if filled with even-odd or just overlapping.
        // But Path2D.arc doesn't "cut" unless we use it correctly. 
        // For simplicity, I'll use a slightly different approach for crescent if needed.
        p.arc(radius * 0.6, -radius * 0.3, radius, 0, Math.PI * 2, true);
        break;
      }
    }
    this.patternPaths.set(key, p);
    return p;
  }
}
