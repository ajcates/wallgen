import { Style } from '../core/Style.js';
import { mapRange, randomRange, dot } from '../utils/math.js';

export class CrystalSmokeStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.palette = [];
    this.shards = [];
    this.smokePuffs = [];
    this.smokeRibbons = [];
    this.smokeTendrils = [];
    this.vortexes = [];
    this.embers = [];
    this.lightRays = [];
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
    this.smokeRibbons.forEach((ribbon, i) => {
      ribbon.drift = Math.sin(this.time * 0.7 + i) * 10;
    });
    this.smokeTendrils.forEach((tendril, i) => {
      tendril.drift = Math.sin(this.time * 1.1 + i * 0.7) * 7;
    });
  }

  async init(data) {
    await super.init(data);
    if (!data || data.length === 0) return;

    this._initPalette(data[0]);
    this._initLighting(data[data.length - 1]);
    this._generateShards(data);
    this._generateSmoke(data);
    this._generateAtmosphere(data);
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
    this.smokeRibbons = [];
    this.smokeTendrils = [];
    this.embers = [];
    const density = this.config.smokeDensity || 50;
    
    data.slice(-5).forEach((log, i) => {
      const startX = mapRange(log.mm, 0, 60, 0, this.width);
      const startY = mapRange(log.hh, 0, 24, 0, this.height);
      const baseColor = this.palette[i % this.palette.length];
      const baseAngle = mapRange(log.pt % 1000, 0, 1000, 0, Math.PI * 2);

      // 1. Coherent ribbons make the animated smoke read as a flowing current.
      for (let ribbon = 0; ribbon < 3; ribbon++) {
        const side = ribbon - 1;
        const normalX = Math.cos(baseAngle + Math.PI / 2);
        const normalY = Math.sin(baseAngle + Math.PI / 2);
        const length = randomRange(300, 700);
        const bend = side * randomRange(70, 170);
        this.smokeRibbons.push({
          startX: startX + normalX * side * 44, startY: startY + normalY * side * 44,
          controlX: startX + Math.cos(baseAngle) * length * 0.48 + normalX * bend,
          controlY: startY + Math.sin(baseAngle) * length * 0.48 + normalY * bend,
          endX: startX + Math.cos(baseAngle) * length + normalX * bend * 0.25,
          endY: startY + Math.sin(baseAngle) * length + normalY * bend * 0.25,
          width: randomRange(12, 34), hue: (baseColor.h + ribbon * 18) % 360, alpha: randomRange(0.025, 0.055)
        });
        for (let strand = 0; strand < 3; strand++) {
          const strandOffset = (strand - 1) * randomRange(8, 18);
          this.smokeTendrils.push({
            startX: startX + normalX * (side * 44 + strandOffset), startY: startY + normalY * (side * 44 + strandOffset),
            controlX: startX + Math.cos(baseAngle) * length * 0.48 + normalX * (bend + strandOffset * 2.5),
            controlY: startY + Math.sin(baseAngle) * length * 0.48 + normalY * (bend + strandOffset * 2.5),
            endX: startX + Math.cos(baseAngle) * length + normalX * (bend * 0.25 + strandOffset),
            endY: startY + Math.sin(baseAngle) * length + normalY * (bend * 0.25 + strandOffset),
            width: randomRange(1.1, 3), hue: (baseColor.h + 10 + strand * 13) % 360, alpha: randomRange(0.018, 0.05)
          });
        }
      }

      for (let j = 0; j < density; j++) {
          const t = j / density;
          const angle = baseAngle + Math.sin(t * 5) * 0.5;
          const dist = t * 600;
          // 2. Plume bands keep a luminous core inside a softer fringe.
          const densityBand = t < 0.24 ? 'core' : (t < 0.7 ? 'body' : 'fringe');
          this.smokePuffs.push({
              x: startX + Math.cos(angle) * dist,
              y: startY + Math.sin(angle) * dist,
              size: (50 + t * 200) * 1.5,
              alpha: (1 - t) * 0.07 * (densityBand === 'core' ? 1.35 : densityBand === 'fringe' ? 0.65 : 1),
              hue: baseColor.h, aspect: randomRange(0.45, 1.35), rotation: angle + randomRange(-0.9, 0.9), densityBand
          });
          // 3. Embers give the large soft volumes a crisp scale reference.
          if (j % 5 === 0) this.embers.push({
            x: startX + Math.cos(angle) * dist + randomRange(-28, 28),
            y: startY + Math.sin(angle) * dist + randomRange(-28, 28),
            size: randomRange(0.7, 2), hue: (baseColor.h + randomRange(35, 80)) % 360, alpha: (1 - t) * 0.5
          });
      }
    });
  }

  _generateAtmosphere(data) {
    // 4. Negative-space vortexes stop the smoke becoming an even haze.
    this.vortexes = data.filter((_, i) => i % 4 === 0).map((log, i) => ({
      x: mapRange(log.mm, 0, 60, 0, this.width) + Math.cos(i * 2.1) * this.width * 0.18,
      y: mapRange(log.hh, 0, 24, 0, this.height) + Math.sin(i * 1.3) * this.height * 0.12,
      radius: mapRange(log.fm, 0, 100, 70, 200)
    }));
    // 5. Directional shafts use the same data-derived light angle as the facets.
    this.lightRays = Array.from({ length: 4 }, (_, i) => ({
      offset: mapRange(i, 0, 3, -0.38, 0.38), width: randomRange(0.05, 0.13), alpha: randomRange(0.025, 0.06)
    }));
  }

  render(ctx, width, height) {
    ctx.fillStyle = '#020205';
    ctx.fillRect(0, 0, width, height);

    this._renderLightRays(ctx, width, height);

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

    // Keep smoke over the facets: this is a smoke style with crystal structure beneath it.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    this.smokeRibbons.forEach(ribbon => {
        ctx.beginPath();
        ctx.moveTo(ribbon.startX, ribbon.startY + (ribbon.drift || 0));
        ctx.quadraticCurveTo(ribbon.controlX, ribbon.controlY + (ribbon.drift || 0), ribbon.endX, ribbon.endY + (ribbon.drift || 0));
        ctx.strokeStyle = `hsla(${ribbon.hue}, 85%, 64%, ${ribbon.alpha})`;
        ctx.lineWidth = ribbon.width;
        ctx.lineCap = 'round';
        ctx.shadowColor = `hsla(${ribbon.hue}, 100%, 60%, ${ribbon.alpha})`;
        ctx.shadowBlur = ribbon.width * 1.6;
        ctx.stroke();
    });
    this.smokeTendrils.forEach(tendril => {
        ctx.beginPath();
        ctx.moveTo(tendril.startX, tendril.startY + (tendril.drift || 0));
        ctx.quadraticCurveTo(tendril.controlX, tendril.controlY + (tendril.drift || 0), tendril.endX, tendril.endY + (tendril.drift || 0));
        ctx.strokeStyle = `hsla(${tendril.hue}, 90%, 72%, ${tendril.alpha})`;
        ctx.lineWidth = tendril.width;
        ctx.shadowColor = `hsla(${tendril.hue}, 100%, 62%, ${tendril.alpha})`;
        ctx.shadowBlur = tendril.width * 3;
        ctx.stroke();
    });
    this.smokePuffs.forEach(p => {
        ctx.globalAlpha = p.alpha;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        ctx.scale(p.aspect || 1, 1);
        ctx.drawImage(this.puffSprite, -p.size, -p.size, p.size * 2, p.size * 2);
        ctx.restore();
    });
    ctx.restore();
    this._renderVortexes(ctx);

    const bloom = this.config.bloom || 0.5;
    if (bloom > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = bloom * 0.15;
        ctx.drawImage(this.puffSprite, 0, 0, width, height);
        ctx.restore();
    }
    this._renderEmbers(ctx);
  }

  _renderLightRays(ctx, width, height) {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(this.lightSource.angle);
    ctx.globalCompositeOperation = 'screen';
    this.lightRays.forEach(ray => {
      const x = ray.offset * width;
      const grad = ctx.createLinearGradient(x, -height, x, height);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.45, `hsla(${this.lightSource.hue}, 95%, 72%, ${ray.alpha})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(x - ray.width * width / 2, -height, ray.width * width, height * 2);
    });
    ctx.restore();
  }

  _renderVortexes(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    this.vortexes.forEach(vortex => {
      const grad = ctx.createRadialGradient(vortex.x, vortex.y, vortex.radius * 0.15, vortex.x, vortex.y, vortex.radius);
      grad.addColorStop(0, 'rgba(0,0,0,0.22)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(vortex.x, vortex.y, vortex.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  _renderEmbers(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    this.embers.forEach(ember => {
      const glow = ctx.createRadialGradient(ember.x, ember.y, 0, ember.x, ember.y, ember.size * 4);
      glow.addColorStop(0, `hsla(${ember.hue}, 100%, 86%, ${ember.alpha})`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ember.x, ember.y, ember.size * 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
}
