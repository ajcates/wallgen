import { Style } from '../core/Style.js';
import { mapRange, randomRange } from '../utils/math.js';
import { Path2D } from '@napi-rs/canvas';

/**
 * LichenBloomStyle: Mimics the fractal growth of lichen/moss.
 * Uses a simplified Diffusion-Limited Aggregation (DLA) simulation.
 */
export class LichenBloomStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.colonies = [];
    this.gridSize = 4;
    this.steps = config.steps || 1500;
    this.maxColonies = config.maxColonies || 5;
  }

  async init(data) {
    await super.init(data);
    const entry = data[data.length - 1] || { hh: 12, bp: 50, fm: 50, up: 3600 };
    
    this.cols = Math.ceil(this.width / this.gridSize);
    this.rows = Math.ceil(this.height / this.gridSize);
    this.grid = new Uint8Array(this.cols * this.rows);

    this.palette = this._generateLichenPalette(entry);
    this._seedColonies(entry);
  }

  _generateLichenPalette(entry) {
    const bp = entry.bp || 50;
    const baseHue = mapRange(entry.hh || 12, 0, 24, 0, 360);
    const sat = mapRange(bp, 0, 100, 20, 80);
    
    return [
      { h: (baseHue + 120) % 360, s: sat, l: 30 }, // Deep forest
      { h: (baseHue + 140) % 360, s: sat + 10, l: 45 }, // Moss green
      { h: (baseHue + 160) % 360, s: sat - 10, l: 60 }, // Sage
      { h: (baseHue + 20) % 360, s: 90, l: 65 },  // Neon Spore
      { h: (baseHue + 40) % 360, s: 80, l: 50 }   // Earthy Ochre
    ];
  }

  _seedColonies(entry) {
    const num = Math.floor(mapRange(entry.fm || 50, 0, 100, 2, this.maxColonies));
    for (let i = 0; i < num; i++) {
      const x = Math.floor(randomRange(this.cols * 0.2, this.cols * 0.8));
      const y = Math.floor(randomRange(this.rows * 0.2, this.rows * 0.8));
      const index = y * this.cols + x;
      this.grid[index] = 1;
      this.colonies.push({
        points: [{ x, y }],
        color: this.palette[i % this.palette.length],
        sporeColor: this.palette[3]
      });
    }
  }

  process() {
    // Simplified DLA simulation
    for (let s = 0; s < this.steps; s++) {
      let x = Math.floor(Math.random() * this.cols);
      let y = Math.floor(Math.random() * this.rows);
      
      if (this.grid[y * this.cols + x] === 0) {
        // Check neighbors
        let stuck = false;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
              if (this.grid[ny * this.cols + nx] === 1) {
                stuck = true;
                break;
              }
            }
          }
          if (stuck) break;
        }

        if (stuck) {
          this.grid[y * this.cols + x] = 1;
          // Find closest colony to attach to
          let minDist = Infinity;
          let targetColony = null;
          for (const colony of this.colonies) {
            const last = colony.points[colony.points.length - 1];
            const d = Math.sqrt((x - last.x)**2 + (y - last.y)**2);
            if (d < minDist) {
              minDist = d;
              targetColony = colony;
            }
          }
          if (targetColony) {
            targetColony.points.push({ x, y });
          }
        }
      }
    }
  }

  render(ctx, width, height) {
    // Background Texture (Stone-like)
    ctx.fillStyle = '#1a1a15';
    ctx.fillRect(0, 0, width, height);
    
    this._renderStoneTexture(ctx, width, height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const colony of this.colonies) {
      this._renderColony(ctx, colony);
    }
  }

  _renderStoneTexture(ctx, width, height) {
    ctx.save();
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = Math.random() * 2;
      ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _renderColony(ctx, colony) {
    const p = new Path2D();
    if (colony.points.length === 0) return;

    p.moveTo(colony.points[0].x * this.gridSize, colony.points[0].y * this.gridSize);
    
    // Draw connections to create branching feel
    ctx.shadowBlur = 4;
    ctx.shadowColor = `hsla(${colony.color.h}, ${colony.color.s}%, ${colony.color.l}%, 0.5)`;
    
    ctx.strokeStyle = `hsl(${colony.color.h}, ${colony.color.s}%, ${colony.color.l}%)`;
    ctx.lineWidth = 2;

    for (let i = 1; i < colony.points.length; i++) {
      const pt = colony.points[i];
      // Connect to a nearby point that was already in the colony
      // For simplicity, we just draw small dots or short segments
      ctx.beginPath();
      ctx.arc(pt.x * this.gridSize, pt.y * this.gridSize, randomRange(1, 3), 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();

      if (Math.random() > 0.95) {
        // Spore
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = `hsl(${colony.sporeColor.h}, ${colony.sporeColor.s}%, ${colony.sporeColor.l}%)`;
        ctx.fillStyle = ctx.shadowColor;
        ctx.beginPath();
        ctx.arc(pt.x * this.gridSize, pt.y * this.gridSize, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}
