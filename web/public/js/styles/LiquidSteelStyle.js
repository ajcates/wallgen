import { Style } from '../core/Style.js';

/**
 * LiquidSteelStyle: A hyper-fluid "Macro Oil" style.
 * Features deep viscous blending, soft-edge smears, and
 * multi-layered iridescence that bleeds into the dark base.
 */
export class LiquidSteelStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.slicks = [];
    this.time = 0;
    this.gridSize = 35;
    this.vxField = null;
    this.vyField = null;
  }

  static get metadata() {
    return [
      { id: 'slickDensity', name: 'Slick Density', min: 10, max: 100, default: 60 },
      { id: 'slickSize', name: 'Macro Size', min: 50, max: 400, default: 200 },
      { id: 'speed', name: 'Flow Speed', min: 0.5, max: 4.0, step: 0.1, default: 1.8 }
    ];
  }

  async init(data) {
    await super.init(data);
    this.cols = Math.ceil(this.width / this.gridSize) + 1;
    this.rows = Math.ceil(this.height / this.gridSize) + 1;
    const total = this.cols * this.rows;
    this.vxField = new Float32Array(total);
    this.vyField = new Float32Array(total);
    this._generateComposition();
  }

  _generateComposition() {
    this.slicks = [];
    const count = this.config.slickDensity;
    const baseSize = this.config.slickSize;
    for (let i = 0; i < count; i++) {
      const points = [];
      const numPoints = 12;
      const startX = Math.random() * this.width;
      const startY = Math.random() * this.height;
      for (let j = 0; j < numPoints; j++) {
        points.push({ x: startX, y: startY });
      }
      this.slicks.push({
        points,
        hue: this._randomRange(0, 360),
        size: this._randomRange(0.5, 1.5) * baseSize,
        speed: this._randomRange(0.8, 1.5) * this.config.speed,
        alpha: this._randomRange(0.2, 0.5)
      });
    }
  }

  process() {
    this.time += 0.007;

    for (let x = 0; x < this.cols; x++) {
      for (let y = 0; y < this.rows; y++) {
        const idx = y * this.cols + x;
        const px = x * this.gridSize;
        const py = y * this.gridSize;
        const n1 = Math.sin(px * 0.001 + this.time) * Math.cos(py * 0.001 - this.time);
        const n2 = Math.sin(py * 0.003 + this.time * 0.5) * Math.cos(px * 0.003);
        this.vxField[idx] = Math.cos(n1 * Math.PI + n2) * 4;
        this.vyField[idx] = Math.sin(n1 * Math.PI + n2) * 4;
      }
    }

    this.slicks.forEach(s => {
      const head = s.points[0];
      const gx = Math.floor(head.x / this.gridSize);
      const gy = Math.floor(head.y / this.gridSize);
      if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
        const idx = gy * this.cols + gx;
        head.x += this.vxField[idx] * s.speed;
        head.y += this.vyField[idx] * s.speed;
      }
      for (let i = s.points.length - 1; i > 0; i--) {
        const p = s.points[i];
        const prev = s.points[i - 1];
        p.x = this._lerp(p.x, prev.x, 0.15);
        p.y = this._lerp(p.y, prev.y, 0.15);
      }
      const margin = s.size;
      if (head.x < -margin) head.x = this.width + margin;
      if (head.x > this.width + margin) head.x = -margin;
      if (head.y < -margin) head.y = this.height + margin;
      if (head.y > this.height + margin) head.y = -margin;
    });
  }

  render(ctx, width, height) {
    const bgGrad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width);
    bgGrad.addColorStop(0, '#0a0a14');
    bgGrad.addColorStop(1, '#020205');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    this.slicks.forEach(s => {
      this._drawSoftSlick(ctx, s, 1.2, 0.1, '#000000');
    });
    ctx.restore();

    ctx.save();
    this.slicks.forEach((s, i) => {
      const h = (s.hue + this.time * 15) % 360;
      ctx.globalCompositeOperation = 'screen';
      this._drawSoftSlick(ctx, s, 1.0, s.alpha * 0.6, `hsla(${h}, 100%, 50%, 1)`);
      ctx.globalCompositeOperation = 'color-dodge';
      this._drawSoftSlick(ctx, s, 0.4, 0.1, '#ffffff');
    });
    ctx.restore();

    this._renderFluidReflections(ctx, width, height);
  }

  _drawSoftSlick(ctx, s, sizeScale, alpha, colorStr) {
    const pts = s.points;
    const radius = s.size * sizeScale;
    for (let i = 0; i < pts.length; i += 2) {
      const p = pts[i];
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      let finalColor = colorStr;
      if (colorStr.includes('hsla')) {
        const parts = colorStr.split(',');
        parts[3] = ` ${alpha})`;
        finalColor = parts.join(',');
      } else {
        ctx.globalAlpha = alpha;
      }
      g.addColorStop(0, finalColor);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
    }
    ctx.globalAlpha = 1.0;
  }

  _renderFluidReflections(ctx, width, height) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    for (let i = 0; i < 3; i++) {
      const x = (Math.sin(this.time * 0.3 + i) * 0.5 + 0.5) * width;
      const y = (Math.cos(this.time * 0.2 + i) * 0.5 + 0.5) * height;
      const r = width * 0.8;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
      g.addColorStop(0.5, 'rgba(128, 180, 255, 0.05)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  }

  _mapRange(val, inMin, inMax, outMin, outMax) { return ((val - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin; }
  _randomRange(min, max) { return Math.random() * (max - min) + min; }
  _lerp(a, b, t) { return a + (b - a) * t; }
}
