import { Style } from '../core/Style.js';
import { mapRange, lerp, randomRange } from '../utils/math.js';

/**
 * FractalGeometryStyle: A Multi-Chromatic, high-contrast visualization.
 * Every fractal has a unique color, creating a vibrant, rainbow field.
 */
export class FractalGeometryStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.mandalaNodes = [];
  }

  async init(data) {
    await super.init(data);
    this._generateMandala(data);
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
      
      // UNIQUE COLOR PER FRACTAL: Each entry gets a random base hue
      const nodeHue = Math.random() * 360;

      const scale = mapRange(bp, 0, 100, 0.9, 1.4);
      
      const reverseIndex = (data.length - 1) - index; 
      let opacity = 0;
      if (reverseIndex < 10) {
        opacity = 0.9;
      } else if (reverseIndex < 30) {
        opacity = mapRange(reverseIndex, 10, 30, 0.9, 0);
      }
      
      return {
        x: x || 0,
        y: y || 0,
        depth,
        spokes,
        angleStep,
        baseHue: nodeHue,
        scale,
        lineWidth: Math.max(0.1, mapRange(fm, 0, 100, 1.8, 0.4)),
        opacity: Math.max(0, Math.min(1, opacity)),
        rotation: randomRange(0, Math.PI * 2),
        branchAngle: mapRange(hh + mm / 60, 0, 24, Math.PI / 10, Math.PI / 3)
      };
    });
  }

  render(ctx, width, height) {
    // Pure obsidian background (Neutral)
    ctx.fillStyle = '#010102';
    ctx.fillRect(0, 0, width, height);

    // Render multi-colored fractals
    this.mandalaNodes.forEach((node) => {
        if (node.opacity <= 0.01) return;
        ctx.save();
        ctx.translate(node.x, node.y);
        ctx.rotate(node.rotation);
        ctx.globalAlpha = node.opacity;
        
        for (let i = 0; i < node.spokes; i++) {
            ctx.save();
            ctx.rotate(i * node.angleStep);
            this._drawRecursiveBranch(ctx, 0, 0, 380 * node.scale, -Math.PI / 2, node.depth, node);
            ctx.restore();
        }
        ctx.restore();
    });

    // Multi-colored Ambient Dust
    ctx.globalCompositeOperation = 'lighter';
    for(let i=0; i<300; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const s = Math.random() * 1.5;
        const h = Math.random() * 360;
        ctx.fillStyle = `hsla(${h}, 100%, 70%, 0.15)`;
        ctx.fillRect(x, y, s, s);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  _drawRecursiveBranch(ctx, x, y, length, angle, depth, config) {
    if (depth <= 0 || length < 5) return;

    const x2 = x + Math.cos(angle) * length;
    const y2 = y + Math.sin(angle) * length;
    
    if (isNaN(x2) || isNaN(y2)) return;

    const cpX = x + Math.cos(angle + 0.1) * (length * 0.5);
    const cpY = y + Math.sin(angle + 0.1) * (length * 0.5);

    // AGGRESSIVE COLOR SHIFT: 140 degrees per level for high-contrast pairs
    const branchHue = (config.baseHue + (depth * 140)) % 360;
    const color = `hsl(${branchHue}, 100%, 65%)`;

    ctx.lineCap = 'round';
    
    // 1. Vibrant Glow
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.strokeStyle = `hsla(${branchHue}, 100%, 50%, 0.15)`;
    ctx.lineWidth = config.lineWidth * depth * 2.8;
    this._path(ctx, x, y, cpX, cpY, x2, y2);

    // 2. High-intensity Core
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = config.lineWidth * 0.6;
    this._path(ctx, x, y, cpX, cpY, x2, y2);
    
    // 3. True Neon Line
    ctx.strokeStyle = `hsla(${branchHue}, 100%, 75%, 0.8)`;
    ctx.lineWidth = config.lineWidth * 0.4;
    this._path(ctx, x, y, cpX, cpY, x2, y2);

    const nextLength = length * 0.73;
    this._drawRecursiveBranch(ctx, x2, y2, nextLength, angle - config.branchAngle, depth - 1, config);
    this._drawRecursiveBranch(ctx, x2, y2, nextLength, angle + config.branchAngle, depth - 1, config);

    if (depth === 1) {
        ctx.fillStyle = `hsl(${branchHue}, 100%, 85%)`;
        ctx.beginPath();
        ctx.arc(x2, y2, 2.5, 0, Math.PI * 2);
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
