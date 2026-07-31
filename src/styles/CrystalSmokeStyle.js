import { Style } from '../core/Style.js';
import { mapRange, distance, randomRange, dot, lerp } from '../utils/math.js';

/**
 * CrystalSmokeStyle: A style featuring 3D shards and volumetric smoke effects.
 */
export class CrystalSmokeStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.palette = [];
    this.paletteStrings = [];
    this.lightSource = { angle: 0, x: 0, y: 0, tint: '' };
    this.shards = [];
    this.dust = [];
    this.smokePuffs = [];
    this.smokeRibbons = [];
    this.smokeTendrils = [];
    this.vortexes = [];
    this.embers = [];
    this.lightRays = [];
  }

  async init(data) {
    await super.init(data);
    if (!data || data.length === 0) return;

    this._initPalette(data[0]);
    this._initLighting(data[data.length - 1]);
    this._generateShards(data);
    this._generateSmoke(data);
    this._generateAtmosphere(data);
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
    this.smokeRibbons = [];
    this.smokeTendrils = [];
    this.embers = [];
    data.filter((_, i) => i % 2 === 0).forEach((log, i) => {
      const startX = this.wrapX(mapRange(log.mm, 0, 60, 0, this.width));
      const startY = this.wrapY(mapRange(log.hh, 0, 24, 0, this.height));
      const length = mapRange(log.up % 3600, 0, 3600, 400, 1500);
      const baseAngle = mapRange(log.pt, 0, 1000, 0, Math.PI * 2);
      const baseColor = this.palette[i % this.palette.length];

      // 1. Long, coherent filaments give the smoke a readable flow direction.
      for (let ribbon = 0; ribbon < 3; ribbon++) {
        const side = ribbon - 1;
        const normalX = Math.cos(baseAngle + Math.PI / 2);
        const normalY = Math.sin(baseAngle + Math.PI / 2);
        const ribbonLength = length * randomRange(0.55, 1.05);
        const ribbonStartX = this.wrapX(startX + normalX * side * 58);
        const ribbonStartY = this.wrapY(startY + normalY * side * 58);
        const controlDistance = ribbonLength * randomRange(0.36, 0.62);
        const bend = side * randomRange(80, 190) + Math.sin(i * 1.7 + ribbon) * 75;
        this.smokeRibbons.push({
          startX: ribbonStartX,
          startY: ribbonStartY,
          controlX: this.wrapX(ribbonStartX + Math.cos(baseAngle) * controlDistance + normalX * bend),
          controlY: this.wrapY(ribbonStartY + Math.sin(baseAngle) * controlDistance + normalY * bend),
          endX: this.wrapX(ribbonStartX + Math.cos(baseAngle) * ribbonLength + normalX * bend * 0.35),
          endY: this.wrapY(ribbonStartY + Math.sin(baseAngle) * ribbonLength + normalY * bend * 0.35),
          width: randomRange(16, 42),
          hue: (baseColor.h + ribbon * 18) % 360,
          alpha: randomRange(0.025, 0.055)
        });

        // Fine turbulent tendrils dissolve the hard edge of each broad ribbon.
        for (let strand = 0; strand < 3; strand++) {
          const strandOffset = (strand - 1) * randomRange(9, 22);
          this.smokeTendrils.push({
            startX: this.wrapX(ribbonStartX + normalX * strandOffset),
            startY: this.wrapY(ribbonStartY + normalY * strandOffset),
            controlX: this.wrapX(ribbonStartX + Math.cos(baseAngle) * controlDistance + normalX * (bend + strandOffset * 2.5)),
            controlY: this.wrapY(ribbonStartY + Math.sin(baseAngle) * controlDistance + normalY * (bend + strandOffset * 2.5)),
            endX: this.wrapX(ribbonStartX + Math.cos(baseAngle) * ribbonLength + normalX * (bend * 0.35 + strandOffset)),
            endY: this.wrapY(ribbonStartY + Math.sin(baseAngle) * ribbonLength + normalY * (bend * 0.35 + strandOffset)),
            width: randomRange(1.2, 3.5), hue: (baseColor.h + 10 + strand * 13) % 360,
            alpha: randomRange(0.018, 0.05)
          });
        }
      }

      const numPuffs = 50; 
      for (let j = 0; j < numPuffs; j++) {
          const t = j / (numPuffs - 1);
          const angle = baseAngle + Math.sin(t * 3 + i) * 0.8 + (Math.random() - 0.5) * 0.2; 
          const dist = t * length;
          const turbulence = Math.sin(t * 12 + i) * (50 * t);
          
          const x = this.wrapX(startX + Math.cos(angle) * dist + Math.cos(angle + Math.PI/2) * turbulence);
          const y = this.wrapY(startY + Math.sin(angle) * dist + Math.sin(angle + Math.PI/2) * turbulence);

          // Main puff with noise
          // 2. A dense core, soft body, and sparse fringe make each plume volumetric.
          const densityBand = t < 0.24 ? 'core' : (t < 0.7 ? 'body' : 'fringe');
          const bandAlpha = densityBand === 'core' ? 1.35 : (densityBand === 'body' ? 1 : 0.65);
          this.smokePuffs.push({
              x: x + (Math.random() - 0.5) * 80 * t,
              y: y + (Math.random() - 0.5) * 80 * t,
              size: mapRange(t, 0, 1, 30, 300) * (0.8 + Math.random() * 0.4), 
              alpha: mapRange(t, 0, 1, 0.11, 0.003) * bandAlpha * (0.7 + Math.random() * 0.6),
              hue: (baseColor.h + (t * 30)) % 360,
              aspect: randomRange(0.45, 1.35),
              rotation: angle + randomRange(-0.9, 0.9),
              densityBand
          });

          // 3. Tiny incandescent particles break up the soft gradients and add scale.
          if (j % 5 === 0) {
            this.embers.push({
              x: this.wrapX(x + (Math.random() - 0.5) * 55),
              y: this.wrapY(y + (Math.random() - 0.5) * 55),
              size: randomRange(0.7, 2.2),
              hue: (baseColor.h + randomRange(35, 80)) % 360,
              alpha: mapRange(t, 0, 1, 0.5, 0.08)
            });
          }

          // Occasional branching whisp
          if (j % 10 === 0 && j > 0) {
            const whispCount = 5;
            const whispAngle = angle + (Math.random() - 0.5) * Math.PI;
            for (let k = 0; k < whispCount; k++) {
              const wt = k / whispCount;
              const wDist = wt * 100 * t;
              this.smokePuffs.push({
                x: this.wrapX(x + Math.cos(whispAngle) * wDist),
                y: this.wrapY(y + Math.sin(whispAngle) * wDist),
                size: (20 + (1 - wt) * 40) * t,
                alpha: 0.02 * (1 - wt),
                hue: (baseColor.h + 50) % 360
              });
            }
          }
      }
    });
  }

  _generateAtmosphere(data) {
    this.vortexes = [];
    this.lightRays = [];
    const sample = data.filter((_, index) => index % 4 === 0);
    sample.forEach((log, index) => {
      const hue = this.palette[index % this.palette.length].h;
      const x = this.wrapX(mapRange(log.mm, 0, 60, 0, this.width) + Math.cos(index * 2.1) * this.width * 0.18);
      const y = this.wrapY(mapRange(log.hh, 0, 24, 0, this.height) + Math.sin(index * 1.3) * this.height * 0.12);
      // 4. Low-contrast vortex pockets create negative space inside the plumes.
      this.vortexes.push({ x, y, radius: mapRange(log.fm, 0, 100, 80, 240), hue, rotation: index * 1.73 });
    });

    // 5. Light shafts tie smoke, crystals, and the data-driven light direction together.
    for (let i = 0; i < 4; i++) {
      this.lightRays.push({
        offset: mapRange(i, 0, 3, -0.38, 0.38),
        width: randomRange(0.05, 0.13),
        alpha: randomRange(0.025, 0.06)
      });
    }
  }

  async process() {}

  render(ctx, width, height) {
    this._renderBackground(ctx, width, height);
    this._renderLightRays(ctx, width, height);
    this._renderShards(ctx);
    // Smoke stays in the foreground so the style reads as smoke first, crystals second.
    this._renderSmoke(ctx);
    this._renderVortexes(ctx);
    this._renderEmbers(ctx);
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

    this.smokeRibbons.forEach(ribbon => {
      ctx.beginPath();
      ctx.moveTo(ribbon.startX, ribbon.startY);
      ctx.quadraticCurveTo(ribbon.controlX, ribbon.controlY, ribbon.endX, ribbon.endY);
      ctx.strokeStyle = `hsla(${ribbon.hue}, 85%, 56%, ${ribbon.alpha})`;
      ctx.lineWidth = ribbon.width;
      ctx.lineCap = 'round';
      ctx.shadowColor = `hsla(${ribbon.hue}, 100%, 55%, ${ribbon.alpha})`;
      ctx.shadowBlur = ribbon.width * 1.8;
      ctx.stroke();
    });

    this.smokeTendrils.forEach(tendril => {
      ctx.beginPath();
      ctx.moveTo(tendril.startX, tendril.startY);
      ctx.quadraticCurveTo(tendril.controlX, tendril.controlY, tendril.endX, tendril.endY);
      ctx.strokeStyle = `hsla(${tendril.hue}, 90%, 70%, ${tendril.alpha})`;
      ctx.lineWidth = tendril.width;
      ctx.shadowBlur = tendril.width * 3;
      ctx.shadowColor = `hsla(${tendril.hue}, 100%, 62%, ${tendril.alpha})`;
      ctx.stroke();
    });
    
    this.smokePuffs.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        ctx.scale(p.aspect || 1, 1);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
        // Softer transition to transparent
        const coreLightness = p.densityBand === 'core' ? 52 : (p.densityBand === 'body' ? 32 : 22);
        grad.addColorStop(0, `hsla(${p.hue}, 90%, ${coreLightness}%, ${p.alpha})`);
        grad.addColorStop(0.5, `hsla(${p.hue}, 80%, 15%, ${p.alpha * 0.3})`);
        grad.addColorStop(1, 'transparent');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
    
    ctx.restore();
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
      grad.addColorStop(0.45, `hsla(${this.lightSource.hue}, 95%, 70%, ${ray.alpha})`);
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
      grad.addColorStop(0.45, 'rgba(0,0,0,0.06)');
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
      glow.addColorStop(0, `hsla(${ember.hue}, 100%, 84%, ${ember.alpha})`);
      glow.addColorStop(0.25, `hsla(${ember.hue}, 100%, 55%, ${ember.alpha * 0.5})`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ember.x, ember.y, ember.size * 4, 0, Math.PI * 2);
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
    
    ctx.restore();
  }
}
