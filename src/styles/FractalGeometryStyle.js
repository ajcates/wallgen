import { Style } from '../core/Style.js';
import { mapRange, lerp, randomRange } from '../utils/math.js';
import * as colorUtils from '../utils/color.js';
import * as canvasUtils from '../utils/canvas.js';

/**
 * FractalGeometryStyle: A Material 3 inspired recursive visualization.
 * Uses harmonized palettes and adaptive contrast for a modern look.
 */
export class FractalGeometryStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.mandalaNodes = [];
    this.palette = [];
  }

  async init(data) {
    await super.init(data);
    if (!data || data.length === 0) return;

    const latest = data[data.length - 1];
    this._initPalette(latest);
    this._generateMandala(data);
  }

  _initPalette(entry) {
    const hueOffset = Math.random() * 360;
    const baseHue = (mapRange(entry.hh + (entry.mm / 60), 0, 24, 0, 360) + hueOffset) % 360;
    const saturation = mapRange(entry.fm, 0, 100, 80, 95); 
    
    this.isLightMode = entry.hh >= 6 && entry.hh < 18;
    this.palette = colorUtils.generateMaterialPalette(baseHue, saturation, this.isLightMode);
  }

  _generateMandala(data) {
    const margin = 200;
    this.mandalaNodes = data.map((log, index) => {
      const hh = Number(log.hh) || 0;
      const mm = Number(log.mm) || 0;
      const bp = Number(log.bp) || 0;
      const pt = Number(log.pt) || 0;
      const fm = Number(log.fm) || 0;

      const y = mapRange(hh, 0, 24, margin, this.height - margin);
      const x = mapRange(mm, 0, 60, margin, this.width - margin);
      
      const depth = Math.max(1, Math.min(4, Math.floor(mapRange(bp, 0, 100, 2, 4))));
      const spokes = Math.max(1, Math.min(6, Math.floor(mapRange(pt % 200, 0, 200, 3, 6))));
      const angleStep = (Math.PI * 2) / spokes;
      
      // Select a color from the Material palette
      const paletteColor = this.palette[index % (this.palette.length - 1)];
      const nodeColor = {
        h: (paletteColor.h + randomRange(-20, 20)) % 360,
        s: Math.min(100, paletteColor.s + randomRange(-10, 10)),
        l: Math.min(100, Math.max(0, paletteColor.l + randomRange(-10, 10)))
      };

      const scale = mapRange(bp, 0, 100, 0.8, 1.3);
      
      const reverseIndex = (data.length - 1) - index; 
      let opacity = 0;
      if (reverseIndex < 8) {
        opacity = 0.95;
      } else if (reverseIndex < 25) {
        opacity = mapRange(reverseIndex, 8, 25, 0.95, 0);
      }
      
      return {
        x: x || 0,
        y: y || 0,
        depth,
        spokes,
        angleStep,
        color: nodeColor,
        scale,
        lineWidth: Math.max(0.2, mapRange(fm, 0, 100, 2.5, 0.8)),
        opacity: Math.max(0, Math.min(1, opacity)),
        rotation: randomRange(0, Math.PI * 2),
        branchAngle: mapRange(hh + mm / 60, 0, 24, Math.PI / 8, Math.PI / 3.5)
      };
    });
  }

  render(ctx, width, height) {
    this._drawBackground(ctx, width, height);

    // Render Material fractals
    this.mandalaNodes.forEach((node) => {
        if (node.opacity <= 0.01) return;
        ctx.save();
        ctx.translate(node.x, node.y);
        ctx.rotate(node.rotation);
        ctx.globalAlpha = node.opacity;
        
        for (let i = 0; i < node.spokes; i++) {
            ctx.save();
            ctx.rotate(i * node.angleStep);
            this._drawRecursiveBranch(ctx, 0, 0, 320 * node.scale, -Math.PI / 2, node.depth, node);
            ctx.restore();
        }
        ctx.restore();
    });

    canvasUtils.drawGrain(ctx, width, height);
  }

  _drawBackground(ctx, width, height) {
    const bg = this.palette[3]; // Neutral
    if (!this.isLightMode) {
      ctx.fillStyle = '#000000'; // AMOLED
      ctx.fillRect(0, 0, width, height);
      return;
    }

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, `hsl(${bg.h}, ${bg.s}%, ${bg.l}%)`);
    grad.addColorStop(1, `hsl(${bg.h}, ${bg.s}%, ${bg.l - 4}%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  _drawRecursiveBranch(ctx, x, y, length, angle, depth, config) {
    if (depth <= 0 || length < 5) return;

    const x2 = x + Math.cos(angle) * length;
    const y2 = y + Math.sin(angle) * length;
    
    if (isNaN(x2) || isNaN(y2)) return;

    const cpX = x + Math.cos(angle + 0.05) * (length * 0.5);
    const cpY = y + Math.sin(angle + 0.05) * (length * 0.5);

    // Use harmonized Material shifts for branches
    const branchL = this.isLightMode ? Math.max(10, config.color.l - (depth * 5)) : Math.min(95, config.color.l + (depth * 5));
    const strokeColor = `hsl(${config.color.h}, ${config.color.s}%, ${branchL}%)`;

    ctx.lineCap = 'round';
    
    // 1. Shadow/Depth (Optimized)
    ctx.save();
    ctx.shadowColor = this.isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = depth * 4;
    ctx.shadowOffsetY = 2;

    // 2. Main Branch Line
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = config.lineWidth * depth * 1.5;
    this._path(ctx, x, y, cpX, cpY, x2, y2);
    ctx.restore();

    // 3. Highlight/Edge detail (Material crispness)
    ctx.strokeStyle = `hsla(${config.color.h}, 100%, ${this.isLightMode ? 98 : 30}%, 0.2)`;
    ctx.lineWidth = config.lineWidth * 0.5;
    this._path(ctx, x, y, cpX, cpY, x2, y2);

    const nextLength = length * 0.7;
    this._drawRecursiveBranch(ctx, x2, y2, nextLength, angle - config.branchAngle, depth - 1, config);
    this._drawRecursiveBranch(ctx, x2, y2, nextLength, angle + config.branchAngle, depth - 1, config);

    if (depth === 1) {
        ctx.fillStyle = colorUtils.getAdaptiveContrast(config.color.h, config.color.s, branchL);
        ctx.beginPath();
        ctx.arc(x2, y2, config.lineWidth * 2, 0, Math.PI * 2);
        ctx.fill();
    }
  }

  _path(ctx, x1, y1, cpX, cpY, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cpX, cpY, x2, y2);
    ctx.stroke();
  }
}
