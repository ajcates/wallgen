import { Style } from '../core/Style.js';
import { mapRange, distance, randomRange, dot, lerp } from '../utils/math.js';

/**
 * CrystalSmoke2Style: A copy of CrystalSmokeStyle for experimentation.
 */
export class CrystalSmoke2Style extends Style {
  constructor(config = {}) {
    super(config);
    this.palette = [];
    this.paletteStrings = [];
    this.lightSource = { angle: 0, x: 0, y: 0, tint: '' };
    this.shards = [];
    this.dust = [];
    this.smokePuffs = [];
  }

  async init(data) {
    await super.init(data);
    if (!data || data.length === 0) return;

    this._initPalette(data[0]);
    this._initLighting(data[data.length - 1]);
    this._generateShards(data);
    this._generateSmoke(data);
  }

  _initPalette(firstEntry) {
    const randomSeed = Math.random() * 360;
    const baseHue = (mapRange(firstEntry.up % 86400, 0, 86400, 0, 360) + randomSeed) % 360;
    // Slightly more saturation for punch (50 - 85)
    const baseSat = mapRange(firstEntry.fm, 0, 100, 50, 85);
    
    this.palette = this.generateTriadicPalette(baseHue, baseSat);
    // Darken but keep a bit more range (max 45 instead of 35)
    this.palette.forEach(c => {
        c.l = Math.min(c.l, 45);
    });
    
    this.paletteStrings = this.palette.map(c => `hsl(${c.h}, ${c.s}%, ${c.l}%)`);
  }

  _initLighting(lastEntry) {
    const angle = mapRange(lastEntry.hh + (lastEntry.mm / 60), 0, 24, 0, Math.PI * 2);
    const accent = this.palette[2];
    // Lower lighting intensity (0.2 - 0.5)
    const lightIntensity = mapRange(lastEntry.bp, 0, 100, 0.2, 0.5);

    this.lightSource = { 
        angle, 
        x: Math.cos(angle), 
        y: Math.sin(angle), 
        tint: `hsla(${accent.h}, 100%, 70%, ${lightIntensity})`,
        hue: accent.h
    };
  }

  _generateShards(data) {
    this.shards = [];
    this.dust = [];

    // Increase number of potential shard locations with more randomness
    const anchorCount = 8;
    const anchors = [];
    for (let i = 0; i < anchorCount; i++) {
        anchors.push({
            x: randomRange(this.width * 0.1, this.width * 0.9),
            y: randomRange(this.height * 0.1, this.height * 0.9)
        });
    }

    data.filter((_, i) => i % 3 === 0).forEach((log, i) => {
      const anchor = anchors[i % anchors.length];
      // Use a wider spread for placement
      const offsetX = (Math.random() - 0.5) * this.width * 0.8;
      const offsetY = (Math.random() - 0.5) * this.height * 0.8;
      
      const cx = this.wrapX(anchor.x + offsetX);
      const cy = this.wrapY(anchor.y + offsetY);
      
      // Use a power-law-like distribution for size: many small, few very large
      const baseSize = mapRange(log.fm, 0, 100, 15, 120);
      const sizeMult = Math.pow(Math.random(), 2) * 2.5 + 0.5;
      const size = baseSize * sizeMult;
      
      // Randomize "stretch" to make some shards elongated
      const stretchX = randomRange(0.7, 1.4);
      const stretchY = randomRange(0.7, 1.4);
      
      const points = [];
      const numPoints = 3 + Math.floor(Math.random() * 5); // 3 to 7 points
      const shardBase = this.palette[i % this.palette.length];
      
      // Generate irregular points with varying radii
      for (let j = 0; j < numPoints; j++) {
        const angle = (j / numPoints) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const r = size * (0.3 + Math.random() * 1.2);
        points.push({
          x: cx + Math.cos(angle) * r * stretchX,
          y: cy + Math.sin(angle) * r * stretchY,
          angle
        });
      }

      // Add "internal" depth by jittering the center point for each facet
      const facets = points.map((p, j) => {
        const nextP = points[(j + 1) % points.length];
        
        // Calculate a mid-point for lighting normal
        const midAngle = (p.angle + nextP.angle) / 2;
        const nx = Math.cos(midAngle);
        const ny = Math.sin(midAngle);
        const l = dot(nx, ny, this.lightSource.x, this.lightSource.y);
        
        // Jitter the "center" of the shard for this specific facet to create more complex 3D-like geometry
        const facetCx = cx + (Math.random() - 0.5) * (size * 0.4);
        const facetCy = cy + (Math.random() - 0.5) * (size * 0.4);
        
        const brightness = mapRange(l, -1, 1, 5, 85);
        
        return {
          p1: p,
          p2: nextP,
          cx: facetCx, 
          cy: facetCy,
          color: `hsla(${lerp(shardBase.h, this.lightSource.hue, 0.4)}, ${shardBase.s}%, ${brightness}%, 0.9)`,
          edgeColor: `hsla(${this.lightSource.hue}, 80%, ${Math.min(100, brightness + 20)}%, 0.5)`,
          brightness
        };
      });

      this.shards.push({ cx, cy, facets, size, hue: shardBase.h, subShards: this._generateSubShards(cx, cy, size, shardBase.h, i) });

      // Dust generation tied more to shard size
      const dustCount = Math.floor(size / 10) + 5;
      for (let k = 0; k < dustCount; k++) {
        this.dust.push({
           x: this.wrapX(cx + (Math.random() - 0.5) * size * 4),
           y: this.wrapY(cy + (Math.random() - 0.5) * size * 4),
           size: Math.random() * 1.5 + 0.5,
           hue: (k % 2 === 0) ? shardBase.h : this.lightSource.hue,
           alpha: Math.random() * 0.3 + 0.05
        });
      }
    });
  }

  _generateSubShards(parentCx, parentCy, parentSize, hue, index) {
    const subShards = [];
    const count = Math.floor(Math.random() * 3) + 1; // 1 to 3 sub-shards

    for (let s = 0; s < count; s++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = parentSize * randomRange(0.6, 1.1);
      const cx = this.wrapX(parentCx + Math.cos(angle) * dist);
      const cy = this.wrapY(parentCy + Math.sin(angle) * dist);
      const size = parentSize * randomRange(0.3, 0.7);
      
      const points = [];
      const numPoints = 3 + (s % 3);
      
      for (let j = 0; j < numPoints; j++) {
        const pAngle = (j / numPoints) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const r = size * (0.4 + Math.random() * 0.8);
        points.push({
          x: cx + Math.cos(pAngle) * r,
          y: cy + Math.sin(pAngle) * r,
          angle: pAngle
        });
      }

      const facets = points.map((p, j) => {
        const nextP = points[(j + 1) % points.length];
        const nx = Math.cos((p.angle + nextP.angle) / 2);
        const ny = Math.sin((p.angle + nextP.angle) / 2);
        const l = dot(nx, ny, this.lightSource.x, this.lightSource.y);
        const brightness = mapRange(l, -1, 1, 5, 80);
        
        return {
          p1: p,
          p2: nextP,
          cx: cx + (Math.random() - 0.5) * (size * 0.3),
          cy: cy + (Math.random() - 0.5) * (size * 0.3),
          color: `hsla(${lerp(hue, this.lightSource.hue, 0.3)}, 80%, ${brightness}%, 0.9)`,
          edgeColor: `hsla(${this.lightSource.hue}, 80%, ${Math.min(100, brightness + 15)}%, 0.4)`,
          brightness
        };
      });

      subShards.push({ cx, cy, facets, size, hue });
    }
    return subShards;
  }

  _generateSmoke(data) {
    this.smokePuffs = [];
    data.filter((_, i) => i % 2 === 0).forEach((log, i) => {
      const startX = this.wrapX(mapRange(log.mm, 0, 60, 0, this.width));
      const startY = this.wrapY(mapRange(log.hh, 0, 24, 0, this.height));
      const length = mapRange(log.up % 3600, 0, 3600, 400, 1500);
      const baseAngle = mapRange(log.pt, 0, 1000, 0, Math.PI * 2);
      const baseColor = this.palette[i % this.palette.length];

      const numPuffs = 80; // Increased count
      for (let j = 0; j < numPuffs; j++) {
          const t = j / (numPuffs - 1);
          
          // Multi-frequency turbulence
          const f1 = 7, a1 = 60;
          const f2 = 19, a2 = 25;
          const f3 = 3, a3 = 100;
          
          const turb1 = Math.sin(t * f1 + i) * a1 * t;
          const turb2 = Math.sin(t * f2 + i * 1.5) * a2 * t;
          const turb3 = Math.cos(t * f3 + i * 0.5) * a3 * (1-t); // Larger base swing
          
          const angle = baseAngle + Math.sin(t * 2 + i) * 0.5 + (Math.random() - 0.5) * 0.1; 
          const dist = t * length;
          
          const x = this.wrapX(startX + Math.cos(angle) * dist + turb1 + turb2);
          const y = this.wrapY(startY + Math.sin(angle) * dist + turb3);

          // Main puff with noise
          this.smokePuffs.push({
              x: x + (Math.random() - 0.5) * 50 * t,
              y: y + (Math.random() - 0.5) * 50 * t,
              size: mapRange(t, 0, 1, 40, 400) * (0.8 + Math.random() * 0.4), 
              alpha: mapRange(t, 0, 1, 0.06, 0.001) * (0.6 + Math.random() * 0.4), 
              hue: (baseColor.h + (t * 40)) % 360
          });

          // Occasional branching whisp
          if (j % 8 === 0 && j > 0) {
            const whispCount = 8;
            const whispAngle = angle + (Math.random() - 0.5) * Math.PI * 1.5;
            for (let k = 0; k < whispCount; k++) {
              const wt = k / whispCount;
              const wDist = wt * 150 * t;
              this.smokePuffs.push({
                x: this.wrapX(x + Math.cos(whispAngle) * wDist),
                y: this.wrapY(y + Math.sin(whispAngle) * wDist),
                size: (15 + (1 - wt) * 50) * t,
                alpha: 0.015 * (1 - wt),
                hue: (baseColor.h + 60) % 360
              });
            }
          }
      }
    });
  }

  async process() {}

  render(ctx, width, height) {
    this._renderBackground(ctx, width, height);
    this._renderSmoke(ctx);
    this._renderShards(ctx);
    this._renderBloom(ctx);
    this._renderTexture(ctx, width, height);
  }

  _renderBackground(ctx, width, height) {
    // True black background for depth
    ctx.fillStyle = '#020202';
    ctx.fillRect(0, 0, width, height);
    
    const grad = ctx.createRadialGradient(
      width * 0.5, height * 0.5, 0,
      width * 0.5, height * 0.5, width * 1.5
    );
    grad.addColorStop(0, `hsla(${this.palette[1].h}, 40%, 4%, 1)`); 
    grad.addColorStop(1, '#000000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  _renderSmoke(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    
    this.smokePuffs.forEach(p => {
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        // Softer transition to transparent
        grad.addColorStop(0, `hsla(${p.hue}, 90%, 25%, ${p.alpha})`);
        grad.addColorStop(0.5, `hsla(${p.hue}, 80%, 15%, ${p.alpha * 0.3})`);
        grad.addColorStop(1, 'transparent');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    
    ctx.restore();
  }

  _renderBloom(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    
    // Bloom for crystalline facets
    this.shards.forEach(s => {
      s.facets.forEach(f => {
        if (f.brightness > 70) {
          ctx.shadowBlur = mapRange(f.brightness, 70, 100, 10, 40);
          ctx.shadowColor = f.edgeColor;
          ctx.fillStyle = f.color;
          ctx.beginPath();
          ctx.moveTo(f.cx, f.cy);
          ctx.lineTo(f.p1.x, f.p1.y);
          ctx.lineTo(f.p2.x, f.p2.y);
          ctx.closePath();
          ctx.fill();
        }
      });
      
      s.subShards.forEach(ss => {
        ss.facets.forEach(f => {
          if (f.brightness > 75) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = f.edgeColor;
            ctx.fillStyle = f.color;
            ctx.beginPath();
            ctx.moveTo(f.cx, f.cy);
            ctx.lineTo(f.p1.x, f.p1.y);
            ctx.lineTo(f.p2.x, f.p2.y);
            ctx.closePath();
            ctx.fill();
          }
        });
      });
    });

    // Bloom for smoke cores
    this.smokePuffs.filter(p => p.alpha > 0.05).forEach(p => {
      ctx.shadowBlur = p.size * 0.2;
      ctx.shadowColor = `hsla(${p.hue}, 100%, 50%, 0.5)`;
      ctx.fillStyle = `hsla(${p.hue}, 100%, 60%, 0.1)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.1, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  _renderShards(ctx) {
    this.shards.forEach(s => {
      // Atmospheric glow for the cluster
      const atmosGlow = ctx.createRadialGradient(s.cx, s.cy, 0, s.cx, s.cy, s.size * 3);
      atmosGlow.addColorStop(0, `hsla(${s.hue}, 100%, 50%, 0.1)`);
      atmosGlow.addColorStop(1, 'transparent');
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = atmosGlow;
      ctx.beginPath();
      ctx.arc(s.cx, s.cy, s.size * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Render sub-shards first (they are "behind")
      s.subShards.forEach(ss => this._drawShard(ctx, ss));
      
      // Render main shard
      this._drawShard(ctx, s);
    });

    ctx.globalCompositeOperation = 'screen';
    this.dust.forEach(d => {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${d.hue}, 90%, 80%, ${d.alpha})`;
        ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  _drawShard(ctx, s) {
    // Subtle shadow
    ctx.save();
    ctx.translate(5, 8);
    ctx.beginPath();
    s.facets.forEach((f, i) => {
      if (i === 0) ctx.moveTo(f.p1.x, f.p1.y);
      ctx.lineTo(f.p2.x, f.p2.y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.restore();

    // Render facets
    s.facets.forEach(f => {
      ctx.beginPath();
      ctx.moveTo(f.cx, f.cy);
      ctx.lineTo(f.p1.x, f.p1.y);
      ctx.lineTo(f.p2.x, f.p2.y);
      ctx.closePath();
      
      const grad = ctx.createLinearGradient(f.cx, f.cy, (f.p1.x + f.p2.x)/2, (f.p1.y + f.p2.y)/2);
      grad.addColorStop(0, f.color);
      grad.addColorStop(1, `hsla(${this.lightSource.hue}, 40%, ${Math.max(2, f.brightness - 20)}%, 0.7)`);
      
      ctx.fillStyle = grad;
      ctx.fill();
      
      ctx.strokeStyle = f.edgeColor;
      ctx.lineWidth = 0.8;
      ctx.stroke();

      if (f.brightness > 70) {
          ctx.beginPath();
          ctx.moveTo(f.cx, f.cy);
          ctx.lineTo(f.p1.x, f.p1.y);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 1;
          ctx.stroke();
      }
    });

    // Sharp specular highlights
    const glow = ctx.createRadialGradient(s.cx, s.cy, 0, s.cx, s.cy, s.size * 1.2);
    glow.addColorStop(0, `hsla(${s.hue}, 100%, 70%, 0.08)`);
    glow.addColorStop(1, 'transparent');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.cx, s.cy, s.size * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _renderTexture(ctx, width, height) {
    ctx.save();
    
    const vignette = ctx.createRadialGradient(
        width/2, height/2, width * 0.4,
        width/2, height/2, width * 1.3
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = 0.03;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3000; i++) {
        ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
    }
    
    ctx.globalCompositeOperation = 'color-dodge';
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 8; i++) {
      const color = this.palette[i % 3];
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 400 + 200;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
      grad.addColorStop(0, `hsla(${color.h}, 100%, 40%, 1)`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    
    // Cycle 1 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.013377637477125663)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 11.239789458434952, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 2 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.01154975487534397)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 11.746055241448753, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 3 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.009843590432667302)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 7.7349134251375, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 4 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.009160754101708326)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 7.719239014330935, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 5 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.013042292841927712)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 5.05477865847034, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 6 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.011391842516384396)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 11.137399217451227, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 7 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.009012708873249058)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 8.16974481674573, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 8 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.005165103671347566)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 6.1750239728057785, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 9 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.012481692812058952)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 2.9653112938260664, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 10 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.010542057952233959)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 4.6082633043532795, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 11 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.008524624803675445)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 7.1626236589562655, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 12 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.007092919254345626)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 11.29385585858743, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 13 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.006808526470343176)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 10.186844672113882, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 14 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.005956823712472915)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 10.630800345442339, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 15 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.014513052958149045)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 11.513269499590285, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 16 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.013966994162410637)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 10.156121702918481, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 17 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.009925834291426147)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 4.546615525556013, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 18 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.014427630670551913)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 3.848271634537003, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 19 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.013931198393326117)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 8.763445617832122, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 20 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.005023124558224677)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 8.40571124064597, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 21 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.014588339729771301)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 6.485707452404277, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 22 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.011909281272733472)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 8.056199489333638, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 23 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.010294994918587031)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 6.671450159847933, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 24 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.009118339537928696)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 11.587650203806342, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 25 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.006278693362258542)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 3.8475281937216224, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 26 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.009371411055899708)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 9.034182495855857, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 27 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.009601118183686853)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 11.17957445209979, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 28 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.007816291857420127)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 9.540544736811821, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 29 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.010426694173316507)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 3.6926650735147897, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 30 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.009852170783816637)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 6.570686977249108, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 31 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.009165517555493191)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 4.421826284243526, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 32 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.006748247722243252)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 7.953763170771481, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 33 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.007443316357383153)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 7.869138007724906, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 34 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.007372992728133911)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 6.463735636191068, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 35 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.007188001233030482)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 6.419946947026859, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 36 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.009889657739715892)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 5.844073332780827, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 37 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.007949701942406878)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 4.3187685884467655, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 38 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.01247370220511566)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 7.959197415534138, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 39 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.010020404641259058)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 3.6561915838522054, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 40 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.014359016741885344)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 7.229100287766121, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 41 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.014030812445458743)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 9.248451539243872, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 42 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.010404724874014054)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 8.665822982143858, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 43 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.010976793439928637)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 10.20829258077342, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 44 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.009396547356978813)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 11.591948199694137, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 45 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.005031377700163192)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 5.931853258542911, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 46 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.014788918043250106)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 3.176241040879961, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 47 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.010459636967863065)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 4.0015605115256365, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 48 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.010304231937928393)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 10.83241455494469, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 49 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.01229143246769807)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 3.754804199324095, 0, Math.PI * 2);
    ctx.fill();

    // Cycle 50 Enhancement: Data Fragment Overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.012631560960345555)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 10.406586910266885, 0, Math.PI * 2);
    ctx.fill();
ctx.restore();
  }
}
