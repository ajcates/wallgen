import { Style } from '../core/Style.js';
import { mapRange, randomRange } from '../utils/math.js';
import * as canvasUtils from '../utils/canvas.js';
import * as colorUtils from '../utils/color.js';
import { Path2D, createCanvas } from '@napi-rs/canvas';

/**
 * ExpressiveMaterialStyle: A Material 3 inspired style featuring organic, 
 * fluid shapes, vibrant dynamic palettes, and layered depth.
 * Enhanced with time-driven post-processing: S-curve and directional motion blur.
 */
export class ExpressiveMaterialStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.blobs = [];
    this.palette = [];
    this.patternPaths = new Map();
    this.timeData = { hh: 12, mm: 0 };
  }

  async init(data) {
    await super.init(data);
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

  _createBlob(log, index, type) {
    const isHero = type === 'hero';
    const x = Math.random() * this.width;
    const y = Math.random() * this.height;
    const baseSize = isHero 
      ? randomRange(this.width * 0.3, this.width * 0.6)
      : randomRange(this.width * 0.05, this.width * 0.25);
      
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

    const patterns = ['dots', 'pills', 'stripes', 'grid', 'plus', 'star', 'circle', 'crescent'];
    const patternType = patterns[Math.floor(Math.random() * patterns.length)];
    const gridRotation = Math.random() * Math.PI * 2;
    const isHex = Math.random() > 0.5;
    
    const densityFactor = mapRange(log.fm, 0, 100, 1.8, 0.6) * randomRange(0.8, 1.2);
    const baseSpacing = randomRange(25, 75) / densityFactor;
    const basePatternSize = mapRange(baseSpacing, 15, 120, 2, 14);

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
    // 1. Create offscreen canvas for the "semi-final draft"
    const offscreen = createCanvas(width, height);
    const octx = offscreen.getContext('2d');

    // 2. Draw the draft logic to offscreen
    this._drawBackground(octx, width, height);
    
    octx.globalCompositeOperation = 'source-over';
    octx.globalAlpha = 0.8;

    this.blobs.sort((a, b) => (a.type === 'hero' ? -1 : 1));
    this.blobs.forEach(blob => this._drawBlob(octx, blob));

    octx.globalAlpha = 1.0;
    canvasUtils.drawGrain(octx, width, height, 600);

    // 3. Draw the draft to the main canvas
    ctx.drawImage(offscreen, 0, 0);

    // 4. Create a second offscreen for effects (Blur + S-curve)
    const blurCanvas = createCanvas(width, height);
    const bctx = blurCanvas.getContext('2d');
    
    // 4a. Apply Linear Motion Blur first (on the draft)
    const hour12 = this.timeData.hh % 12;
    const angle = (hour12 / 12) * Math.PI * 2 - Math.PI / 2;
    const blurAmount = mapRange(this.timeData.mm, 0, 59, 1, 150);
    
    const passes = Math.max(16, Math.floor(blurAmount / 2)); 
    bctx.globalAlpha = 1 / passes;
    const dx = Math.cos(angle) * blurAmount / passes;
    const dy = Math.sin(angle) * blurAmount / passes;

    for (let i = 0; i < passes; i++) {
        bctx.drawImage(offscreen, i * dx, i * dy);
    }

    // 4b. Apply aggressive S-Curve (contrast) to the blurred result
    const imageData = bctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const curve = new Uint8Array(256);
    const contrastBoost = 1.3; // Extra contrast factor
    for (let i = 0; i < 256; i++) {
      let x = i / 255;
      // Center around 0.5 and boost
      x = (x - 0.5) * contrastBoost + 0.5;
      x = Math.max(0, Math.min(1, x));
      // S-curve: 3x^2 - 2x^3
      const s = x * x * (3 - 2 * x);
      curve[i] = s * 255;
    }

    for (let i = 0; i < data.length; i += 4) {
      data[i] = curve[data[i]];     // R
      data[i+1] = curve[data[i+1]]; // G
      data[i+2] = curve[data[i+2]]; // B
    }
    bctx.putImageData(imageData, 0, 0);

    // 5. Composite the effect back onto the main canvas
    ctx.save();
    ctx.globalCompositeOperation = 'color-burn';
    ctx.globalAlpha = 0.85; // Increased alpha for more definition
    ctx.drawImage(blurCanvas, 0, 0);
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

  _drawBlob(ctx, blob) {
    ctx.save();
    ctx.translate(blob.x, blob.y);
    ctx.rotate(blob.rotation);
    
    const alpha = blob.type === 'hero' ? 0.9 : 0.8;
    ctx.fillStyle = `hsla(${blob.color.h}, ${blob.color.s}%, ${blob.color.l}%, ${alpha})`;
    
    if (blob.type === 'hero') {
      ctx.save();
      ctx.shadowColor = this.isLightMode ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 20;
      ctx.fill(blob.path);
      ctx.restore();
    } else {
      ctx.fill(blob.path);
    }

    ctx.save();
    ctx.clip(blob.path); 
    this._drawPattern(ctx, blob);
    ctx.restore();

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
        p.arc(radius * 0.6, -radius * 0.3, radius, 0, Math.PI * 2, true);
        break;
      }
    }
    this.patternPaths.set(key, p);
    return p;
  }
}
