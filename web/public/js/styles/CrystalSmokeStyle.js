import { Style } from '../core/Style.js';
import { mapRange, randomRange, dot } from '../utils/math.js';

export class CrystalSmokeStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.palette = [];
    this.shards = [];
    this.smokePuffs = [];
    this.puffSprite = null;
    this.time = 0;
  }

  static get metadata() {
    return [
      { id: 'shardCount', name: 'Shard Density', type: 'range', min: 1, max: 20, default: 8 },
      { id: 'smokeDensity', name: 'Smoke Density', type: 'range', min: 10, max: 100, default: 50 },
      { id: 'lightIntensity', name: 'Light Intensity', type: 'range', min: 0.1, max: 1.0, step: 0.1, default: 0.4 },
      { id: 'bloom', name: 'Bloom Strength', type: 'range', min: 0, max: 1.0, step: 0.1, default: 0.5 },
      { id: 'animationSpeed', name: 'Animation Speed', type: 'range', min: 0, max: 5, step: 0.1, default: 1.0 }
    ];
  }

  async process() {
    const speed = this.config.animationSpeed || 1.0;
    this.time += 0.01 * speed;
    
    // Animate Shards
    this.shards.forEach((s, i) => {
        s.rotation = (s.rotation || 0) + 0.005 * speed * (i % 2 === 0 ? 1 : -1);
    });

    // Animate Smoke Drift
    this.smokePuffs.forEach((p, i) => {
        p.x += Math.cos(this.time * 0.5 + i) * 0.5 * speed;
        p.y += Math.sin(this.time * 0.5 + i) * 0.5 * speed;
    });
  }

  async init(data) {
    await super.init(data);
    if (!data || data.length === 0) return;

    this._initPalette(data[0]);
    this._initLighting(data[data.length - 1]);
    this._generateShards(data);
    this._generateSmoke(data);
    this._createPuffSprite();
  }

  _createPuffSprite() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size * 2;
    canvas.height = size * 2;
    const ctx = canvas.getContext('2d');
    
    const grad = ctx.createRadialGradient(size, size, 0, size, size, size);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.2)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(size, size, size, 0, Math.PI * 2);
    ctx.fill();
    
    this.puffSprite = canvas;
  }

  _initPalette(firstEntry) {
    const baseHue = mapRange(firstEntry.up % 86400, 0, 86400, 0, 360);
    this.palette = this.generateTriadicPalette(baseHue, 70);
  }

  _initLighting(lastEntry) {
    const angle = mapRange(lastEntry.hh + (lastEntry.mm / 60), 0, 24, 0, Math.PI * 2);
    this.lightSource = { 
        angle, 
        x: Math.cos(angle), 
        y: Math.sin(angle), 
        intensity: this.config.lightIntensity || 0.4,
        hue: this.palette[2].h
    };
  }

  _generateShards(data) {
    this.shards = [];
    const count = this.config.shardCount || 8;
    
    data.slice(-count).forEach((log, i) => {
      const cx = randomRange(this.width * 0.1, this.width * 0.9);
      const cy = randomRange(this.height * 0.1, this.height * 0.9);
      const size = mapRange(log.fm, 0, 100, 30, 150);
      const shardBase = this.palette[i % this.palette.length];
      
      const points = [];
      const numPoints = 3 + Math.floor(Math.random() * 4);
      for (let j = 0; j < numPoints; j++) {
        const angle = (j / numPoints) * Math.PI * 2;
        const r = size * (0.5 + Math.random() * 1.0);
        points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r, angle });
      }

      const facets = points.map((p, j) => {
        const nextP = points[(j + 1) % points.length];
        const nx = Math.cos((p.angle + nextP.angle) / 2);
        const ny = Math.sin((p.angle + nextP.angle) / 2);
        const l = dot(nx, ny, this.lightSource.x, this.lightSource.y);
        const brightness = mapRange(l, -1, 1, 10, 80);
        
        return {
          p1: p, p2: nextP,
          color: `hsla(${shardBase.h}, ${shardBase.s}%, ${brightness}%, 0.8)`,
          edgeColor: `hsla(${this.lightSource.hue}, 100%, 80%, 0.4)`
        };
      });

      this.shards.push({ cx, cy, facets, size, hue: shardBase.h, rotation: randomRange(0, Math.PI * 2) });
    });
  }

  _generateSmoke(data) {
    this.smokePuffs = [];
    const density = this.config.smokeDensity || 50;
    
    data.slice(-5).forEach((log, i) => {
      const startX = mapRange(log.mm, 0, 60, 0, this.width);
      const startY = mapRange(log.hh, 0, 24, 0, this.height);
      const baseColor = this.palette[i % this.palette.length];

      for (let j = 0; j < density; j++) {
          const t = j / density;
          const angle = mapRange(log.pt % 1000, 0, 1000, 0, Math.PI * 2) + Math.sin(t * 5) * 0.5;
          const dist = t * 600;
          this.smokePuffs.push({
              x: startX + Math.cos(angle) * dist,
              y: startY + Math.sin(angle) * dist,
              size: (50 + t * 200) * 1.5,
              alpha: (1 - t) * 0.05,
              hue: baseColor.h
          });
      }
    });
  }

  render(ctx, width, height) {
    ctx.fillStyle = '#020205';
    ctx.fillRect(0, 0, width, height);

    // Optimized Smoke - Using pre-rendered sprite
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    this.smokePuffs.forEach(p => {
        ctx.globalAlpha = p.alpha;
        ctx.drawImage(this.puffSprite, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
    });
    ctx.restore();

    // Shards
    this.shards.forEach(s => {
      ctx.save();
      ctx.translate(s.cx, s.cy);
      ctx.rotate(s.rotation);
      s.facets.forEach(f => {
        ctx.beginPath();
        ctx.moveTo(0, 0); // Facet center (relative to shard cx,cy)
        ctx.lineTo(f.p1.x, f.p1.y);
        ctx.lineTo(f.p2.x, f.p2.y);
        ctx.closePath();
        ctx.fillStyle = f.color;
        ctx.fill();
        ctx.strokeStyle = f.edgeColor;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });
      ctx.restore();
    });

    const bloom = this.config.bloom || 0.5;
    if (bloom > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = bloom * 0.15;
        ctx.drawImage(this.puffSprite, 0, 0, width, height);
        ctx.restore();
    }
  }
}
