import { Style } from '../core/Style.js';
import { mapRange, randomRange } from '../utils/math.js';
import * as colorUtils from '../utils/color.js';
import { Path2D } from '@napi-rs/canvas';

/**
 * VaporwaveSunsetStyle: A retro-futuristic style with GBA-style glitches,
 * dithered gradients, and a pixel-stretched VR zoom.
 */
export class VaporwaveSunsetStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.palette = [];
    this.gridOffset = 0;
    this.sunPath = null;
    this.horizonY = 0;
  }

  async init(data) {
    await super.init(data);
    if (!data || data.length === 0) return;

    const latest = data[data.length - 1];
    this.horizonY = this.height * 0.65;
    
    this._initPalette(latest);
    this._initSun(latest);
  }

  _initPalette(entry) {
    // Vaporwave classic: Pinks, Cyans, Purples
    const baseHue = 300; // Magenta/Pink
    this.palette = [
      { h: 300, s: 100, l: 50 }, // Hot Pink
      { h: 180, s: 100, l: 50 }, // Cyan
      { h: 280, s: 80, l: 30 },  // Deep Purple
      { h: 40, s: 100, l: 60 }   // Sunset Orange/Yellow
    ];
    
    // Hardware-limited colors (GBA feel)
    this.colors = {
      sunTop: `hsl(40, 100%, 60%)`,
      sunBottom: `hsl(320, 100%, 50%)`,
      grid: `hsl(180, 100%, 50%)`,
      bg: '#050510'
    };
  }

  _initSun(entry) {
    const sunSize = this.width * 0.4;
    const hour = entry.hh + (entry.mm / 60);
    const sunYOffset = mapRange(Math.abs(hour - 12), 0, 12, -this.height * 0.2, this.height * 0.1);
    this.sunCenter = { x: this.width / 2, y: this.horizonY + sunYOffset };
    this.sunRadius = sunSize;

    const p = new Path2D();
    p.arc(0, 0, this.sunRadius, 0, Math.PI * 2);
    this.sunPath = p;

    this._initTrees(entry);
  }

  _initTrees(entry) {
    this.trees = [];
    const numTrees = 6;
    for (let i = 0; i < numTrees; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const xBase = this.width / 2 + side * (this.width * 0.35);
      const yBase = this.horizonY + (i * 150);
      
      this.trees.push({
        x: xBase,
        y: yBase,
        side,
        scale: mapRange(yBase, this.horizonY, this.height, 0.4, 1.2),
        trunkPath: this._createTrunkPath(),
        frondPaths: this._createFrondPaths(),
        glitchOffset: 0
      });
    }
  }

  _createTrunkPath() {
    const p = new Path2D();
    const segments = 8;
    const h = 120;
    const w = 15;
    for (let i = 0; i < segments; i++) {
      const y = -i * (h / segments);
      const xOff = Math.sin(i * 0.5) * 10;
      p.rect(xOff - w / 2, y, w, h / segments);
    }
    return p;
  }

  _createFrondPaths() {
    const fronds = [];
    const numFronds = 5;
    for (let i = 0; i < numFronds; i++) {
      const p = new Path2D();
      const angle = mapRange(i, 0, numFronds - 1, -Math.PI * 0.8, -Math.PI * 0.2);
      const len = randomRange(40, 70);
      p.moveTo(0, 0);
      p.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
      fronds.push(p);
    }
    return fronds;
  }

  async process() {
    const latest = this.data[this.data.length - 1];
    
    // Grid movement tied to ping (pt). Higher ping = faster, jerkier scrolling.
    const baseSpeed = mapRange(latest.pt || 50, 0, 500, 2, 12);
    const jitter = Math.random() > 0.9 ? randomRange(5, 15) : 0; // "Bursts" of lag
    this.gridOffset = (this.gridOffset + baseSpeed + jitter) % 100;

    // Phase 2: Glitch logic
    const glitchChance = mapRange(latest.fm || 50, 0, 100, 0.3, 0.05);
    this.trees.forEach(tree => {
      tree.glitchOffset = Math.random() < glitchChance ? randomRange(-20, 20) : 0;
    });
  }

  render(ctx, width, height) {
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, width, height);

    this._drawSun(ctx);
    this._drawGrid(ctx);
    this._drawTrees(ctx);

    // Phase 2: GBA Artifacts
    this._drawGBAArtifacts(ctx, width, height);

    // Phase 3: VR Smear Pass
    this._drawVRSmear(ctx, width, height);
  }

  _drawSun(ctx) {
    const latest = this.data[this.data.length - 1];
    ctx.save();
    ctx.translate(this.sunCenter.x, this.sunCenter.y);

    // Battery integrity: Sun "tears" if battery < 20
    if (latest.bp < 20 && Math.random() > 0.5) {
        ctx.translate(randomRange(-15, 15), 0);
    }

    // Create stepped gradient (GBA hardware limit feel)
    const grad = ctx.createLinearGradient(0, -this.sunRadius, 0, this.sunRadius);
    grad.addColorStop(0, this.colors.sunTop);
    grad.addColorStop(0.33, this.colors.sunTop);
    grad.addColorStop(0.34, this.colors.sunBottom);
    grad.addColorStop(0.66, this.colors.sunBottom);
    grad.addColorStop(0.67, `hsl(${this.palette[2].h}, ${this.palette[2].s}%, ${this.palette[2].l}%)`); 
    grad.addColorStop(1, '#000');

    ctx.fillStyle = grad;
    
    // Draw sun with slats
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, this.sunRadius, 0, Math.PI * 2);
    ctx.clip();

    // Draw the actual color
    ctx.fill(this.sunPath);

    // Cut slats
    ctx.globalCompositeOperation = 'destination-out';
    const numSlats = 12;
    for (let i = 0; i < numSlats; i++) {
        const y = mapRange(i, 0, numSlats, 0, this.sunRadius * 2) - this.sunRadius;
        const h = mapRange(i, 0, numSlats, 2, 15); 
        if (y > 0) {
            ctx.fillRect(-this.sunRadius, y, this.sunRadius * 2, h);
        }
    }
    ctx.restore();
    
    ctx.strokeStyle = this.colors.sunTop;
    ctx.lineWidth = 4;
    ctx.stroke(this.sunPath);

    ctx.restore();
  }

  _drawGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = this.colors.grid;
    ctx.lineWidth = 2;
    
    const horizon = this.horizonY;
    const numHorizontalLines = 20;
    const numVerticalLines = 15;

    // Horizontal lines (Perspective + Animation)
    for (let i = 0; i < numHorizontalLines; i++) {
        // Offset the normalization by gridOffset to create movement
        const offsetNorm = (i + (this.gridOffset / 100)) / numHorizontalLines;
        const y = horizon + Math.pow(offsetNorm, 2) * (this.height - horizon);
        
        if (y > horizon) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
            ctx.stroke();
        }
    }

    // Vertical lines
    const vanishingX = this.width / 2;
    for (let i = 0; i < numVerticalLines; i++) {
        const xAtBottom = mapRange(i, 0, numVerticalLines - 1, -this.width * 0.5, this.width * 1.5);
        ctx.beginPath();
        ctx.moveTo(vanishingX, horizon);
        ctx.lineTo(xAtBottom, this.height);
        ctx.stroke();
    }

    ctx.restore();
  }

  _drawGBAArtifacts(ctx, width, height) {
    const latest = this.data[this.data.length - 1];
    
    // 1. Scanline Jitter (DMA sync error feel)
    const jitterChance = mapRange(latest.pt || 50, 0, 500, 0.05, 0.4);
    if (Math.random() < jitterChance) {
        const numJitters = Math.floor(randomRange(1, 5));
        for (let i = 0; i < numJitters; i++) {
            const h = randomRange(10, 50);
            const sy = randomRange(0, height - h);
            const xOff = randomRange(-30, 30);
            ctx.drawImage(ctx.canvas, 0, sy, width, h, xOff, sy, width, h);
        }
    }

    // 2. Tile Corruption (VRAM corruption feel)
    const corruptionChance = mapRange(latest.fm || 50, 0, 100, 0.5, 0.05);
    if (Math.random() < corruptionChance) {
        const tileSize = 32;
        const numTiles = Math.floor(randomRange(1, 10));
        for (let i = 0; i < numTiles; i++) {
            const sx = Math.floor(randomRange(0, width / tileSize)) * tileSize;
            const sy = Math.floor(randomRange(0, height / tileSize)) * tileSize;
            const dx = Math.floor(randomRange(0, width / tileSize)) * tileSize;
            const dy = Math.floor(randomRange(0, height / tileSize)) * tileSize;
            ctx.drawImage(ctx.canvas, sx, sy, tileSize, tileSize, dx, dy, tileSize, tileSize);
        }
    }

    // 3. Chroma Wrap (Color Inversion)
    if (latest.pt > 400 && Math.random() > 0.8) {
        ctx.save();
        ctx.globalCompositeOperation = 'difference';
        ctx.fillStyle = 'white';
        const h = randomRange(100, 300);
        const y = randomRange(0, height - h);
        ctx.fillRect(0, y, width, h);
        ctx.restore();
    }
  }

  _drawVRSmear(ctx, width, height) {
    const latest = this.data[this.data.length - 1];
    // Uptime determines zoom intensity
    const uptimeHours = (latest.up || 0) / 3600000;
    const smearCount = Math.floor(mapRange(Math.min(uptimeHours, 24), 0, 24, 2, 12));
    
    if (smearCount <= 0) return;

    ctx.save();
    ctx.imageSmoothingEnabled = false; // Keep it "crunchy" and pixelated

    for (let i = 0; i < smearCount; i++) {
        const scale = 1.0 + (i * 0.02);
        const alpha = 0.15 / (i + 1);
        ctx.globalAlpha = alpha;
        
        const sw = width / scale;
        const sh = height / scale;
        const sx = (width - sw) / 2;
        const sy = (height - sh) / 2;

        ctx.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, width, height);
    }
    ctx.restore();
  }

  _drawTrees(ctx) {
    this.trees.forEach(tree => {
      ctx.save();
      ctx.translate(tree.x, tree.y + tree.glitchOffset);
      ctx.scale(tree.scale, tree.scale);
      
      // Shadow-like silhouette
      ctx.fillStyle = '#000';
      ctx.fill(tree.trunkPath);
      
      ctx.strokeStyle = this.palette[0].h === 300 ? '#ff00ff' : '#00ffff'; // Neon glow
      ctx.lineWidth = 2;
      tree.frondPaths.forEach(fp => ctx.stroke(fp));
      
      ctx.restore();
    });
  }
}
