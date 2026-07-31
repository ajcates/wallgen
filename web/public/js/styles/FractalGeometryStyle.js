import { Style } from '../core/Style.js';
import { mapRange, randomRange } from '../utils/math.js';

export class FractalGeometryStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.mandalaNodes = [];
    this.time = 0;
  }

  static get metadata() {
    return [
      { id: 'maxDepth', name: 'Max Depth', type: 'range', min: 1, max: 5, default: 4 },
      { id: 'maxSpokes', name: 'Max Spokes', type: 'range', min: 1, max: 12, default: 6 },
      { id: 'branchAngleScale', name: 'Branch Angle', type: 'range', min: 0.1, max: 1.5, step: 0.1, default: 1.0 },
      { id: 'scale', name: 'Overall Scale', type: 'range', min: 0.5, max: 2.0, step: 0.1, default: 1.0 },
      { id: 'opacityWindow', name: 'History Window', type: 'range', min: 5, max: 50, default: 30 },
      { id: 'animationSpeed', name: 'Animation Speed', type: 'range', min: 0, max: 5, step: 0.1, default: 1.0 }
    ];
  }

  async process() {
    const speed = this.config.animationSpeed || 1.0;
    this.time += 0.01 * speed;
    
    this.mandalaNodes.forEach((node, i) => {
        node.rotation += 0.005 * speed * (i % 2 === 0 ? 1 : -1);
        node.currentScale = node.scale * (1 + Math.sin(this.time + i) * 0.04);
    });
  }

  async init(data) {
    await super.init(data);
    this._generateMandala(data);
  }

  _generateMandala(data) {
    const margin = 200;
    const windowSize = this.config.opacityWindow || 30;

    this.mandalaNodes = data.map((log, index) => {
      const hh = Number(log.hh) || 0;
      const mm = Number(log.mm) || 0;
      const bp = Number(log.bp) || 0;
      const pt = Number(log.pt) || 0;
      const fm = Number(log.fm) || 0;

      const y = mapRange(hh, 0, 24, margin, this.height - margin);
      const x = mapRange(mm, 0, 60, margin, this.width - margin);
      
      const depth = Math.max(1, Math.min(this.config.maxDepth, Math.floor(mapRange(bp, 0, 100, 2, this.config.maxDepth))));
      const spokes = Math.max(1, Math.min(this.config.maxSpokes, Math.floor(mapRange(pt % 200, 0, 200, 3, this.config.maxSpokes))));
      const angleStep = (Math.PI * 2) / spokes;
      const nodeHue = Math.random() * 360;
      const scale = mapRange(bp, 0, 100, 0.9, 1.4) * (this.config.scale || 1.0);
      
      const reverseIndex = (data.length - 1) - index; 
      let opacity = 0;
      if (reverseIndex < windowSize * 0.3) {
        opacity = 0.9;
      } else if (reverseIndex < windowSize) {
        opacity = mapRange(reverseIndex, windowSize * 0.3, windowSize, 0.9, 0);
      }
      
      return {
        x: x || 0,
        y: y || 0,
        depth,
        spokes,
        angleStep,
        baseHue: nodeHue,
        scale,
        currentScale: scale,
        lineWidth: Math.max(0.1, mapRange(fm, 0, 100, 1.8, 0.4)),
        opacity: Math.max(0, Math.min(1, opacity)),
        rotation: randomRange(0, Math.PI * 2),
        branchAngle: mapRange(hh + mm / 60, 0, 24, Math.PI / 10, Math.PI / 3) * (this.config.branchAngleScale || 1.0)
      };
    });
  }

  render(ctx, width, height) {
    ctx.fillStyle = '#010102';
    ctx.fillRect(0, 0, width, height);

    this.mandalaNodes.forEach((node) => {
        if (node.opacity <= 0.01) return;
        ctx.save();
        ctx.translate(node.x, node.y);
        ctx.rotate(node.rotation);
        ctx.globalAlpha = node.opacity;
        
        for (let i = 0; i < node.spokes; i++) {
            ctx.save();
            ctx.rotate(i * node.angleStep);
            this._drawRecursiveBranch(ctx, 0, 0, 380 * node.currentScale, -Math.PI / 2, node.depth, node);
            ctx.restore();
        }
        ctx.restore();
    });

    ctx.globalCompositeOperation = 'lighter';
    for(let i=0; i<150; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const s = Math.random() * 1.5;
        const h = Math.random() * 360;
        ctx.fillStyle = `hsla(${h}, 100%, 70%, 0.1)`;
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

    const branchHue = (config.baseHue + (depth * 140)) % 360;
    
    ctx.lineCap = 'round';
    
    // Multi-stroke glow (faster than shadowBlur)
    // 1. Wide Glow
    ctx.strokeStyle = `hsla(${branchHue}, 100%, 50%, 0.08)`;
    ctx.lineWidth = config.lineWidth * depth * 3.5;
    this._path(ctx, x, y, cpX, cpY, x2, y2);

    // 2. High-intensity Core
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = config.lineWidth * 0.6;
    this._path(ctx, x, y, cpX, cpY, x2, y2);
    
    // 3. True Neon Line
    ctx.strokeStyle = `hsla(${branchHue}, 100%, 75%, 0.7)`;
    ctx.lineWidth = config.lineWidth * 0.4;
    this._path(ctx, x, y, cpX, cpY, x2, y2);

    const nextLength = length * 0.61803398875;
    this._drawRecursiveBranch(ctx, x2, y2, nextLength, angle - config.branchAngle, depth - 1, config);
    this._drawRecursiveBranch(ctx, x2, y2, nextLength, angle + config.branchAngle, depth - 1, config);
  }

  _path(ctx, x1, y1, cpX, cpY, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cpX, cpY, x2, y2);
    ctx.stroke();
  }
}
