import { Style } from '../core/Style.js';
import { mapRange, randomRange } from '../utils/math.js';
import * as canvasUtils from '../utils/canvas.js';

/**
 * IsometricDataStyle (Overhauled): "Neo-Tokyo"
 * A complex 3D-ish isometric megalopolis with varied architecture, 
 * floating platforms, and glowing data-highways.
 */
export class IsometricDataStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.blocks = [];
    this.drones = [];
    this.baseHue = Math.random() * 360;
  }

  async init(data) {
    await super.init(data);
    const latest = data[data.length - 1] || { bp: 100, fm: 50 };
    
    this.baseHue = Math.random() * 360;
    this.gridSize = 50; 
    this.cols = Math.ceil(this.width / this.gridSize) + 6;
    this.rows = Math.ceil(this.height / (this.gridSize * 0.5)) + 12;

    this._generatePalette();
    this._generateCity(data);
  }

  _generatePalette() {
    // Triadic harmony for vibrant sci-fi look
    this.palette = [
      { h: this.baseHue, s: 80, l: 60 },
      { h: (this.baseHue + 120) % 360, s: 90, l: 50 },
      { h: (this.baseHue + 240) % 360, s: 100, l: 70 }
    ];
  }

  _generateCity(data) {
    this.blocks = [];
    this.drones = [];

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const log = data[(r * this.cols + c) % data.length] || { bp: 50, fm: 50 };
        
        // Use battery for building height, but with variety
        const baseH = mapRange(log.bp || 50, 0, 100, 20, 300);
        const type = Math.random();
        
        this.blocks.push({
          gx: c,
          gy: r,
          h: type > 0.3 ? baseH * randomRange(0.5, 1.5) : 5,
          z: Math.random() > 0.92 ? randomRange(100, 300) : 0, // Floating buildings
          type: type > 0.8 ? 'tower' : (type > 0.5 ? 'monolith' : 'block'),
          hue: this.palette[Math.floor(Math.random() * this.palette.length)].h,
          active: Math.random() > 0.35
        });
      }
    }

    // Add some "Data Drones" (small flying ships)
    for (let i = 0; i < 15; i++) {
        this.drones.push({
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            size: randomRange(5, 12),
            hue: this.palette[2].h
        });
    }

    // Sort for isometric depth (Back to Front)
    this.blocks.sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));
  }

  async render(ctx, width, height) {
    // 1. Cyberpunk Dark Background with vertical gradient
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#0a0a0f');
    bg.addColorStop(1, '#1a1025');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // 2. Distant Atmospheric Glow
    this._renderAtmosphere(ctx);

    // 3. Render Data Highways (The neon grid)
    this._renderHighways(ctx);

    // 4. Render the City
    this.blocks.forEach(b => {
      if (!b.active) return;
      this._drawBuilding(ctx, b);
    });

    // 5. Render Drones
    this.drones.forEach(d => this._drawDrone(ctx, d));

    await canvasUtils.drawGrain(ctx, width, height, 0, 0.06);
  }

  _renderAtmosphere(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const grad = ctx.createRadialGradient(this.width/2, this.height, 0, this.width/2, this.height, this.height * 0.8);
    grad.addColorStop(0, `hsla(${this.baseHue}, 80%, 20%, 0.3)`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  _renderHighways(ctx) {
    ctx.save();
    ctx.strokeStyle = `hsla(${this.baseHue}, 100%, 50%, 0.1)`;
    ctx.lineWidth = 2;
    
    // Draw grid lines in isometric
    for (let r = 0; r < this.rows; r += 2) {
        ctx.beginPath();
        const start = this._gridToScreen(0, r, 0);
        const end = this._gridToScreen(this.cols, r, 0);
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
    }
    for (let c = 0; c < this.cols; c += 2) {
        ctx.beginPath();
        const start = this._gridToScreen(c, 0, 0);
        const end = this._gridToScreen(c, this.rows, 0);
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
    }
    ctx.restore();
  }

  _gridToScreen(gx, gy, z = 0) {
    const size = this.gridSize;
    const w = size * 0.866;
    const h = size * 0.5;
    
    // Centering offset
    const cx = this.width * 0.5;
    const cy = this.height * 0.15;

    return {
      x: (gx - gy) * w + cx,
      y: (gx + gy) * h + cy - z
    };
  }

  _drawBuilding(ctx, b) {
    const { x, y } = this._gridToScreen(b.gx, b.gy, b.z);
    const size = this.gridSize;
    const w = size * 0.866;
    const sh = size * 0.5;

    // Drawing context setup
    const hue = b.hue;
    
    // If floating, draw a light field underneath
    if (b.z > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const groundPos = this._gridToScreen(b.gx, b.gy, 0);
        const groundGrad = ctx.createRadialGradient(groundPos.x, groundPos.y, 0, groundPos.x, groundPos.y, size);
        groundGrad.addColorStop(0, `hsla(${hue}, 100%, 50%, 0.4)`);
        groundGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(groundPos.x - size, groundPos.y - size, size * 2, size * 2);
        ctx.restore();
    }

    if (b.type === 'monolith') {
        this._drawMonolith(ctx, x, y, w, sh, b.h, hue);
    } else if (b.type === 'tower') {
        this._drawTower(ctx, x, y, w, sh, b.h, hue);
    } else {
        this._drawCube(ctx, x, y, w, sh, b.h, hue);
    }
  }

  _drawCube(ctx, x, y, w, sh, h, hue) {
    // Top
    this._fillPoly(ctx, [
        {x, y: y-sh-h}, {x: x+w, y: y-h}, {x, y: y+sh-h}, {x: x-w, y: y-h}
    ], `hsl(${hue}, 70%, 50%)`);

    // Sides
    this._fillPoly(ctx, [
        {x, y: y+sh-h}, {x: x+w, y: y-h}, {x: x+w, y: y}, {x, y: y+sh}
    ], `hsl(${hue}, 70%, 35%)`);
    
    this._fillPoly(ctx, [
        {x, y: y+sh-h}, {x: x-w, y: y-h}, {x: x-w, y: y}, {x, y: y+sh}
    ], `hsl(${hue}, 70%, 20%)`);

    // Windows
    if (h > 60) {
        ctx.fillStyle = `hsla(${hue}, 100%, 80%, 0.3)`;
        for(let i=0; i<3; i++) {
            ctx.fillRect(x + w*0.2, y - h*0.2 - (i*20), w*0.4, 4);
        }
    }
  }

  _drawMonolith(ctx, x, y, w, sh, h, hue) {
    // Glass Monolith - semi-transparent with glowing core
    ctx.save();
    ctx.globalAlpha = 0.8;
    this._drawCube(ctx, x, y, w, sh, h, hue);
    
    // Inner glowing core
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `hsla(${hue}, 100%, 70%, 0.5)`;
    ctx.fillRect(x - 2, y + sh - h + 10, 4, h - 20);
    ctx.restore();
  }

  _drawTower(ctx, x, y, w, sh, h, hue) {
    // A tower made of smaller stacked cubes
    const segments = Math.floor(h / 40);
    for(let i=0; i<segments; i++) {
        const segW = w * (1 - (i * 0.1));
        const segH = 35;
        const segY = y - (i * 40);
        this._drawCube(ctx, x, segY, segW, sh * (segW/w), segH, (hue + i*10)%360);
    }
    // Top spike
    ctx.beginPath();
    ctx.moveTo(x, y - (segments*40) - 40);
    ctx.lineTo(x, y - (segments*40));
    ctx.strokeStyle = `hsl(${hue}, 100%, 70%)`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  _drawDrone(ctx, d) {
    ctx.save();
    ctx.shadowColor = `hsl(${d.hue}, 100%, 50%)`;
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.size/2, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  _fillPoly(ctx, points, color) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}
