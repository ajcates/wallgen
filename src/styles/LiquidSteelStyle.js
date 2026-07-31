import { Style } from '../core/Style.js';
import { mapRange, randomRange, lerp } from '../utils/math.js';
import { drawGrain } from '../utils/canvas.js';

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

  async init(data) {
    await super.init(data);
    this._initFluidGrid();
    this._generateComposition();
  }

  _initFluidGrid() {
    this.cols = Math.ceil(this.width / this.gridSize) + 1;
    this.rows = Math.ceil(this.height / this.gridSize) + 1;
    const total = this.cols * this.rows;
    this.vxField = new Float32Array(total);
    this.vyField = new Float32Array(total);
  }

  _generateComposition() {
    this.slicks = [];
    const count = 60; // Increased for a richer, more complex composition
    for (let i = 0; i < count; i++) {
      const points = [];
      const numPoints = 12; // Shorter history for "heavier" look
      const startX = Math.random() * this.width;
      const startY = Math.random() * this.height;
      for (let j = 0; j < numPoints; j++) {
        points.push({ x: startX, y: startY });
      }
      this.slicks.push({
        points,
        hue: randomRange(0, 360),
        size: randomRange(100, 300), // Large soft radii
        speed: randomRange(1.0, 2.5),
        alpha: randomRange(0.2, 0.5)
      });
    }
  }

  process() {
    this.time += 0.007;

    // 1. Update Fluid Field with Viscous Coordinated Swirls
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

    // 2. Move Slicks with Viscous Drag
    this.slicks.forEach(s => {
      const head = s.points[0];
      const gx = Math.floor(head.x / this.gridSize);
      const gy = Math.floor(head.y / this.gridSize);
      
      if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
        const idx = gy * this.cols + gx;
        head.x += this.vxField[idx] * s.speed;
        head.y += this.vyField[idx] * s.speed;
      }

      // Smooth point trailing (the "Blended Smudge")
      for (let i = s.points.length - 1; i > 0; i--) {
        const p = s.points[i];
        const prev = s.points[i - 1];
        p.x = lerp(p.x, prev.x, 0.15); 
        p.y = lerp(p.y, prev.y, 0.15);
      }

      // Wrap around
      const margin = s.size;
      if (head.x < -margin) head.x = this.width + margin;
      if (head.x > this.width + margin) head.x = -margin;
      if (head.y < -margin) head.y = this.height + margin;
      if (head.y > this.height + margin) head.y = -margin;
    });
  }

  render(ctx, width, height) {
    // 1. Deep Viscous Background
    const bgGrad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width);
    bgGrad.addColorStop(0, '#0a0a14');
    bgGrad.addColorStop(1, '#020205');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Render Under-layer (Deep Sludge Base)
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    this.slicks.forEach(s => {
      this._drawSoftSlick(ctx, s, 1.2, 0.1, '#000000'); // Shadow trail
    });
    ctx.restore();

    // 3. Render Iridescent Color Layer
    ctx.save();
    this.slicks.forEach((s, i) => {
      const h = (s.hue + this.time * 15) % 360;
      
      // Layer 1: Spectral Base (Screen for glow)
      ctx.globalCompositeOperation = 'screen';
      this._drawSoftSlick(ctx, s, 1.0, s.alpha * 0.6, `hsla(${h}, 100%, 50%, 1)`);

      // Layer 2: Sharp core highlights (Color-Dodge)
      ctx.globalCompositeOperation = 'color-dodge';
      this._drawSoftSlick(ctx, s, 0.4, 0.1, '#ffffff');
    });
    ctx.restore();

    // 4. Global Specular Sheen
    this._renderFluidReflections(ctx, width, height);
    
    drawGrain(ctx, width, height, 0, 0.1);
  }

  /**
   * Draws a slick as a series of soft radial gradients to ensure smooth blending
   */
  _drawSoftSlick(ctx, s, sizeScale, alpha, colorStr) {
    const pts = s.points;
    const radius = s.size * sizeScale;
    
    // We only render a few representative points to maintain softness
    for (let i = 0; i < pts.length; i += 2) {
      const p = pts[i];
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      
      // Extract HSLA if it's our dynamic color
      let finalColor = colorStr;
      if (colorStr.includes('hsla')) {
        const parts = colorStr.split(',');
        parts[3] = ` ${alpha})`; // Inject local alpha
        finalColor = parts.join(',');
      } else {
        // Simple alpha injection for hex/named
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
}
