import { Style } from '../core/Style.js';
import { mapRange, randomRange } from '../utils/math.js';
import * as canvasUtils from '../utils/canvas.js';
import * as colorUtils from '../utils/color.js';
import { Path2D, createCanvas } from '@napi-rs/canvas';

/**
 * ExpressiveShapesStyle: Refactored for maximum color depth and fixed intersection logic.
 */
export class ExpressiveShapesStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.shapes = [];
    this.palette = [];
    this.hybridColors = [];
    this.patternPaths = new Map();
    this.patternCache = new Map();
    this.tileCanvas = null;
  }

  async init(data) {
    await super.init(data);
    this.patternCache.clear();
    this.patternPaths.clear();

    const latest = (data && data.length > 0) 
      ? data[data.length - 1] 
      : { hh: 12, mm: 0, bp: 100, fm: 50 };

    this._initPalette(latest);
    this._generateShapes(data && data.length > 0 ? data : [latest]);
  }

  _initPalette(entry) {
    const baseHue = Math.random() * 360;
    const isPastel = Math.random() > 0.6;
    const s = isPastel ? 85 : 100;
    const lBase = isPastel ? 75 : 60;
    const type = Math.random();

    if (type < 0.33) {
      // Analogous + Complementary Accent
      this.palette = [
        { h: baseHue, s, l: lBase },
        { h: (baseHue + 35) % 360, s: s - 5, l: lBase + 5 },
        { h: (baseHue - 35 + 360) % 360, s: s - 5, l: lBase - 5 },
        { h: (baseHue + 180) % 360, s: 100, l: lBase + 10 },
        { h: (baseHue + 210) % 360, s: 95, l: lBase + 15 }
      ];
    } else if (type < 0.66) {
      // Triadic
      this.palette = [
        { h: baseHue, s, l: lBase },
        { h: (baseHue + 120) % 360, s, l: lBase },
        { h: (baseHue + 240) % 360, s, l: lBase },
        { h: (baseHue + 60) % 360, s: 90, l: lBase + 10 },
        { h: (baseHue + 180) % 360, s: 90, l: lBase + 15 }
      ];
    } else {
      // Split Complementary
      this.palette = [
        { h: baseHue, s, l: lBase },
        { h: (baseHue + 150) % 360, s, l: lBase + 5 },
        { h: (baseHue + 210) % 360, s, l: lBase - 5 },
        { h: (baseHue + 45) % 360, s: 80, l: lBase + 10 },
        { h: (baseHue + 315) % 360, s: 80, l: lBase + 15 }
      ];
    }
    
    this.hybridColors = this.palette.map((c, i) => {
        const next = this.palette[(i + 1) % this.palette.length];
        return { h: (c.h + next.h) / 2, s: 100, l: (c.l + next.l) / 2 };
    });
  }

  _generateShapes(data) {
    this.shapes = [];
    const latest = data[data.length - 1];
    const battery = latest.bp || 100;
    const cols = 3, rows = 5;
    const cellW = this.width / cols, cellH = this.height / rows;

    const slots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) slots.push({ r, c });
    slots.sort(() => Math.random() - 0.5);

    const jitter = mapRange(battery, 0, 100, 0.5, 0.05);
    for (let i = 0; i < 12; i++) {
      const slot = slots[i % slots.length];
      const type = i < 4 ? 'hero' : 'expressive';
      const x = (slot.c + 0.5) * cellW + (Math.random() - 0.5) * cellW * jitter;
      const y = (slot.r + 0.5) * cellH + (Math.random() - 0.5) * cellH * jitter;
      this.shapes.push(this._createShape(data, type, x, y, cellW));
    }
  }

  _createShape(data, type, x, y, cellSize) {
    const isHero = type === 'hero';
    const size = isHero ? randomRange(cellSize * 0.6, cellSize * 0.9) : randomRange(cellSize * 0.3, cellSize * 0.5);
    const shapeType = ['squircle', 'stadium', 'flower', 'octagon', 'circle'][Math.floor(Math.random() * 5)];
    const baseColor = this.palette[Math.floor(Math.random() * this.palette.length)];
    const battery = data[data.length - 1].bp || 100;

    return { 
      x, y, type, shapeType, size, rotation: (battery > 60 && Math.random() > 0.5) ? (Math.floor(Math.random() * 4) * 90 * Math.PI / 180) : (Math.random() * Math.PI * 2),
      color: { h: (baseColor.h + randomRange(-5, 5) + 360) % 360, s: baseColor.s, l: baseColor.l },
      pattern: { type: ['dots', 'stripes', 'plus', 'grid'][Math.floor(Math.random() * 4)], spacing: 18, size: 6 },
      thick: isHero && Math.random() > 0.4
    };
  }

  _getPath(type, size) {
    const p = new Path2D();
    if (type === 'squircle') {
      const cp = size * 0.9;
      p.moveTo(0, -size);
      p.bezierCurveTo(cp, -size, size, -cp, size, 0); p.bezierCurveTo(size, cp, cp, size, 0, size);
      p.bezierCurveTo(-cp, size, -size, cp, -size, 0); p.bezierCurveTo(-size, -cp, -cp, -size, 0, -size);
    } else if (type === 'stadium') p.roundRect(-size*0.8, -size*0.35, size*1.6, size*0.7, size*0.35);
    else if (type === 'flower') {
      for (let i = 0; i < 16; i++) {
        const r = i % 2 === 0 ? size : size * 0.6;
        const a = (i / 16) * Math.PI * 2;
        if (i === 0) p.moveTo(Math.cos(a)*r, Math.sin(a)*r); else p.lineTo(Math.cos(a)*r, Math.sin(a)*r);
      }
    } else if (type === 'octagon') {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        if (i === 0) p.moveTo(Math.cos(a)*size, Math.sin(a)*size); else p.lineTo(Math.cos(a)*size, Math.sin(a)*size);
      }
    } else p.arc(0, 0, size * 0.85, 0, Math.PI * 2);
    p.closePath();
    return p;
  }

  async render(ctx, width, height) {
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, width, height);
    const sorted = [...this.shapes].sort((a, b) => a.type === 'hero' ? 1 : -1);
    
    for (const s of sorted) {
      const path = this._getPath(s.shapeType, s.size);
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rotation);
      // Fill
      ctx.fillStyle = `hsl(${s.color.h}, ${s.color.s}%, ${s.color.l}%)`; ctx.fill(path);
      // Pattern
      ctx.save(); ctx.clip(path); this._drawPattern(ctx, s); ctx.restore();
      // Border
      if (s.thick) { const c = this.hybridColors[0]; ctx.strokeStyle = `hsla(${c.h}, ${c.s}%, ${c.l}%, 0.5)`; ctx.lineWidth = s.size * 0.15; ctx.stroke(path); }
      ctx.restore();
    }

    this._drawIntersections(ctx);
    await canvasUtils.drawGrain(ctx, width, height, 0, 0.05);
  }

  _drawIntersections(ctx) {
    const heroes = this.shapes.filter(s => s.type === 'hero');
    for (let i = 0; i < heroes.length; i++) {
      for (let j = i + 1; j < heroes.length; j++) {
        const h1 = heroes[i], h2 = heroes[j];
        if (Math.hypot(h1.x - h2.x, h1.y - h2.y) < (h1.size + h2.size) * 1.5) {
          ctx.save();
          const p1 = this._getPath(h1.shapeType, h1.size), p2 = this._getPath(h2.shapeType, h2.size);
          ctx.translate(h1.x, h1.y); ctx.rotate(h1.rotation); ctx.clip(p1); ctx.setTransform(1,0,0,1,0,0);
          ctx.translate(h2.x, h2.y); ctx.rotate(h2.rotation); ctx.clip(p2); ctx.setTransform(1,0,0,1,0,0);
          const c = this.hybridColors[(i+j)%this.hybridColors.length];
          ctx.fillStyle = `hsla(${c.h}, ${c.s}%, ${c.l}%, 0.9)`; ctx.fillRect(0, 0, this.width, this.height);
          ctx.restore();
        }
      }
    }
  }

  _drawPattern(ctx, s) {
    const { type, spacing, size } = s.pattern;
    const tile = createCanvas(spacing, spacing); const pctx = tile.getContext('2d');
    pctx.fillStyle = s.color.l > 60 ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)';
    pctx.strokeStyle = pctx.fillStyle; pctx.translate(spacing/2, spacing/2);
    if (type === 'dots') { pctx.beginPath(); pctx.arc(0, 0, size/2, 0, Math.PI*2); pctx.fill(); }
    else if (type === 'stripes') { pctx.lineWidth = 3; pctx.beginPath(); pctx.moveTo(-size, -size); pctx.lineTo(size, size); pctx.stroke(); }
    else if (type === 'plus') { pctx.beginPath(); pctx.moveTo(-size, 0); pctx.lineTo(size, 0); pctx.moveTo(0, -size); pctx.lineTo(0, size); pctx.stroke(); }
    else { pctx.beginPath(); pctx.rect(-size/2, -size/2, size, size); pctx.fill(); }
    ctx.fillStyle = ctx.createPattern(tile, 'repeat'); ctx.fillRect(-s.size*2, -s.size*2, s.size*4, s.size*4);
  }
}
