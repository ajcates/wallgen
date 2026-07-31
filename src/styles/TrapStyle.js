import { Style } from '../core/Style.js';
import { mapRange, randomRange, distance, dot, lerp } from '../utils/math.js';
import * as canvasUtils from '../utils/canvas.js';
import { Path2D, createCanvas } from '@napi-rs/canvas';

/**
 * TrapStyle: A combination of Trill's postmodern geometry 
 * and Smoke's volumetric atmosphere and crystalline shards.
 */
export class TrapStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.shapes = [];
    this.smokePuffs = [];
    this.energyPaths = [];
    this.particles = [];
    this.palette = [];
    this.synapses = [];
    this.energyBundles = [];
    this.patternCache = new Map();
    this.lightAngle = randomRange(0, Math.PI * 2);
    this.paletteType = ['analogous', 'split', 'tetradic', 'triadic'][Math.floor(Math.random() * 4)];
  }

  // --- Lifecycle ---

  async init(data) {
    await super.init(data);
    this.latest = (data && data.length > 0) 
      ? data[data.length - 1] 
      : { hh: 12, mm: 0, bp: 100, fm: 50 };

    this.motionAngle = mapRange(this.latest.hh || 12, 0, 24, 0, Math.PI * 2);

    this._initPalette(this.latest);
    this._generateComposition(this.latest); // Shards first
    this._generateAtmosphere(data || [this.latest]);
    this._generateParticles(this.latest);
    this._generateEnergyBundles(this.latest);
    this._preRenderPatterns();
    this._createPaperTexture();
  }

  async render(ctx, width, height) {
    this._renderBase(ctx, width, height);
    this._renderSmoke(ctx);

    // Removed Energy Paths and Synapses to get rid of "weird lines"
    this._renderParticles(ctx);

    // Render Trails for Foreground/Mid shards
    this._renderShardTrails(ctx);

    // Deep Layer (0.0 - 0.4)
    this._renderEnergyBundles(ctx, 0.0, 0.4);
    this._renderShapeGroup(ctx, this.shapes.filter(s => s.depth <= 0.4));
    
    this._renderFogLayer(ctx, 0.1); // Subtle intermediate fog

    // Mid Layer (0.4 - 0.7)
    this._renderEnergyBundles(ctx, 0.4, 0.7);
    this._renderShapeGroup(ctx, this.shapes.filter(s => s.depth > 0.4 && s.depth <= 0.7));

    this._renderFogLayer(ctx, 0.15); // Thicker foreground fog

    // Foreground Layer (0.7 - 1.0)
    this._renderEnergyBundles(ctx, 0.7, 1.0);
    this._renderShapeGroup(ctx, this.shapes.filter(s => s.depth > 0.7));

    this._renderLightShafts(ctx);

    this._renderPost(ctx, width, height);
    await canvasUtils.drawGrain(ctx, width, height, 0, 0.15);
  }

  _renderFogLayer(ctx, alpha) {
    ctx.save();
    // High battery (100) -> lower fog density (0.5x)
    // Low battery (0) -> higher fog density (1.5x)
    const batteryFactor = mapRange(this.latest.bp || 100, 0, 100, 1.5, 0.5);
    const tunedAlpha = alpha * 0.8 * batteryFactor;
    
    const grad = ctx.createRadialGradient(
      this.width / 2, this.height * 0.4, 0,
      this.width / 2, this.height * 0.4, this.width * 1.5
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, `hsla(${this.palette[0].h}, 50%, 5%, ${tunedAlpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  _renderLightShafts(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    
    // Only from bright foreground shards
    this.shapes.filter(s => s.depth > 0.8).forEach(s => {
      const angle = this.lightAngle + (Math.random() - 0.5) * 0.2;
      const length = this.width * 0.8;
      
      const grad = ctx.createLinearGradient(s.x, s.y, s.x + Math.cos(angle) * length, s.y + Math.sin(angle) * length);
      grad.addColorStop(0, `hsla(${s.color.h}, 100%, 70%, 0.1)`);
      grad.addColorStop(1, 'transparent');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      const beamWidth = s.size * 0.5;
      ctx.lineTo(s.x + Math.cos(angle - 0.05) * length, s.y + Math.sin(angle - 0.05) * length);
      ctx.lineTo(s.x + Math.cos(angle + 0.05) * length, s.y + Math.sin(angle + 0.05) * length);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  }

  _renderEnergyPaths(ctx) {
    ctx.save();
    ctx.lineCap = 'butt';
    this.energyPaths.forEach(path => {
      ctx.strokeStyle = `hsla(${path.color.h}, 100%, 70%, 0.4)`;
      ctx.lineWidth = path.width;
      ctx.shadowColor = `hsla(${path.color.h}, 100%, 60%, 0.8)`;
      ctx.shadowBlur = 10;
      
      ctx.beginPath();
      path.pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();
      
      // White core
      ctx.save();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = path.width * 0.3;
      ctx.shadowBlur = 5;
      ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  }

  _renderParticles(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    this.particles.forEach(p => {
      ctx.fillStyle = `hsla(${p.color.h}, 100%, 80%, ${p.alpha})`;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      
      if (Math.random() > 0.95) {
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 10;
        ctx.fillRect(p.x - 1, p.y - 1, p.size + 2, p.size + 2);
      }
    });
    ctx.restore();
  }

  // --- Initialization Helpers ---

  _initPalette(entry) {
    const baseHue = Math.random() * 360;
    const saturation = 90;
    this.palette = [];
    const addColor = (h, s, l) => this.palette.push({ h: (h + 360) % 360, s, l });

    if (this.paletteType === 'analogous') {
      addColor(baseHue, saturation, 60);
      addColor(baseHue + 30, saturation - 10, 50);
      addColor(baseHue - 30, saturation - 10, 50);
    } else if (this.paletteType === 'split') {
      addColor(baseHue, saturation, 60);
      addColor(baseHue + 150, saturation, 55);
      addColor(baseHue + 210, saturation, 55);
    } else if (this.paletteType === 'tetradic') {
      addColor(baseHue, saturation, 60);
      addColor(baseHue + 90, saturation, 55);
      addColor(baseHue + 180, saturation, 50);
      addColor(baseHue + 270, saturation, 45);
    } else {
      addColor(baseHue, saturation, 60);
      addColor(baseHue + 120, saturation, 55);
      addColor(baseHue + 240, saturation, 55);
    }
    this.palette.push({ h: 0, s: 0, l: 100 }); 
  }

  _generateAtmosphere(data) {
    this.smokePuffs = [];
    const sampleSize = Math.min(data.length, 12);
    const subset = data.slice(-sampleSize);

    subset.forEach((log, i) => {
      const startX = randomRange(0, this.width), startY = randomRange(0, this.height);
      const color = this.palette[i % (this.palette.length - 1)];
      const numPuffs = 18; // Reduced slightly from 25

      for (let j = 0; j < numPuffs; j++) {
        const t = j / numPuffs;
        this.smokePuffs.push({
          x: this.wrapX(startX + (Math.random() - 0.5) * 600),
          y: this.wrapY(startY + (Math.random() - 0.5) * 600),
          size: randomRange(150, 500) * (1 + t),
          alpha: randomRange(0.02, 0.08) * (1 - t), // Reduced from 0.04-0.12
          hue: color.h
        });
      }
    });

    // Shard-local smoke for "glow" and volume
    this.shapes.forEach(s => {
      const numPuffs = Math.floor(randomRange(4, 7)); // Reduced from 5-10
      for (let i = 0; i < numPuffs; i++) {
        this.smokePuffs.push({
          x: s.x + (Math.random() - 0.5) * s.size * 1.5,
          y: s.y + (Math.random() - 0.5) * s.size * 1.5,
          size: s.size * randomRange(1.5, 4),
          alpha: randomRange(0.02, 0.05), // Reduced from 0.03-0.08
          hue: s.color.h
        });
      }
    });
  }

  _generateEnergyBundles(entry) {
    this.energyBundles = [];
    const bundleCount = Math.floor(mapRange(entry.bp, 0, 100, 4, 8));
    
    for (let i = 0; i < bundleCount; i++) {
      const lineCount = Math.floor(randomRange(3, 8));
      const color = this.palette[Math.floor(Math.random() * (this.palette.length - 1))];
      const depth = Math.random();
      
      const pts = [];
      // Start/End outside screen
      const startX = randomRange(-100, this.width + 100);
      const startY = randomRange(-100, this.height + 100);
      pts.push({ x: startX, y: startY });
      
      const segments = 4;
      let curX = startX, curY = startY;
      for (let j = 0; j < segments; j++) {
        curX += (Math.random() - 0.5) * this.width * 1.5;
        curY += (Math.random() - 0.5) * this.height * 1.5;
        pts.push({ x: curX, y: curY });
      }

      const orbs = [];
      const orbCount = Math.floor(randomRange(2, 5));
      for (let j = 0; j < orbCount; j++) {
        orbs.push({ t: Math.random(), size: randomRange(6, 15) });
      }

      this.energyBundles.push({ pts, color, lineCount, depth, orbs });
    }
  }

  _renderEnergyBundles(ctx, minDepth, maxDepth) {
    const bundles = this.energyBundles.filter(b => b.depth >= minDepth && b.depth < maxDepth);
    if (bundles.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'screen';

    bundles.forEach(b => {
      const mainPath = this._getCurvePath(b.pts);
      
      for (let i = 0; i < b.lineCount; i++) {
        ctx.save();
        const ox = (i - b.lineCount / 2) * 6;
        const oy = (i % 2 === 0 ? 1 : -1) * 4;
        ctx.translate(ox, oy);

        ctx.strokeStyle = `hsla(${b.color.h}, 100%, 75%, ${0.1 + (1 / b.lineCount) * 0.4})`;
        ctx.lineWidth = randomRange(1, 3);
        ctx.shadowColor = `hsla(${b.color.h}, 100%, 60%, 0.6)`;
        ctx.shadowBlur = 10;
        ctx.stroke(mainPath);

        if (i === Math.floor(b.lineCount / 2)) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.6;
          ctx.stroke(mainPath);
        }
        ctx.restore();
      }

      b.orbs.forEach(orb => {
        const pos = this._getPointOnCurve(b.pts, orb.t);
        if (pos) {
          ctx.save();
          const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, orb.size * 3);
          g.addColorStop(0, '#fff');
          g.addColorStop(0.2, `hsla(${b.color.h}, 100%, 85%, 1)`);
          g.addColorStop(0.5, `hsla(${b.color.h}, 100%, 60%, 0.5)`);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.shadowColor = `hsla(${b.color.h}, 100%, 60%, 1)`;
          ctx.shadowBlur = 25;
          ctx.beginPath(); ctx.arc(pos.x, pos.y, orb.size, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      });
    });
    ctx.restore();
  }

  _getCurvePath(pts) {
    const path = new Path2D();
    if (pts.length < 2) return path;
    path.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 2; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2;
      const yc = (pts[i].y + pts[i + 1].y) / 2;
      path.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
    }
    path.quadraticCurveTo(pts[pts.length - 2].x, pts[pts.length - 2].y, pts[pts.length - 1].x, pts[pts.length - 1].y);
    return path;
  }

  _getPointOnCurve(pts, t) {
    if (pts.length < 2) return null;
    const i = Math.floor(t * (pts.length - 1));
    const localT = (t * (pts.length - 1)) % 1;
    if (i >= pts.length - 1) return pts[pts.length - 1];
    return {
      x: lerp(pts[i].x, pts[i+1].x, localT),
      y: lerp(pts[i].y, pts[i+1].y, localT)
    };
  }

  _generateParticles(entry) {
    this.particles = [];
    const count = Math.floor(mapRange(entry.fm, 0, 100, 80, 250));
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: randomRange(2, 6),
        alpha: randomRange(0.2, 0.7),
        color: this.palette[Math.floor(Math.random() * (this.palette.length - 1))]
      });
    }
  }

  _generateComposition(entry) {
    this.shapes = [];
    const count = Math.floor(randomRange(6, 10));
    const centerX = this.width / 2, centerY = this.height * 0.45;
    
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2, dist = randomRange(0, Math.min(this.width, this.height) * 0.4);
      const x = centerX + Math.cos(angle) * dist, y = centerY + Math.sin(angle) * dist;
      const color = this.palette[Math.floor(Math.random() * (this.palette.length - 1))];
      const size = randomRange(this.width * 0.1, this.width * 0.35);
      this.shapes.push(this._createTrapShape(x, y, color, size));
    }
    // Sort by depth (0 to 1)
    this.shapes.sort((a, b) => a.depth - b.depth);
  }

  _createTrapShape(x, y, color, size) {
    const rotation = Math.random() * Math.PI * 2;
    const shapeType = 'shard'; 
    const pts = this._getPointsForShape(shapeType, size);
    
    // Create organic depth with offset centers
    const centerX = (Math.random() - 0.5) * size * 0.2;
    const centerY = (Math.random() - 0.5) * size * 0.2;

    const facets = pts.map((p, j) => {
      const nextP = pts[(j + 1) % pts.length];
      
      // Calculate light based on facet normal
      const midX = (p.x + nextP.x) / 2;
      const midY = (p.y + nextP.y) / 2;
      const midAngle = Math.atan2(midY - centerY, midX - centerX);
      const nx = Math.cos(midAngle), ny = Math.sin(midAngle);
      
      // Use relative light angle to account for shard rotation
      const relLight = this.lightAngle - rotation;
      const l = dot(nx, ny, Math.cos(relLight), Math.sin(relLight));
      const brightness = mapRange(l, -1, 1, 15, 85);
      
      const path = new Path2D();
      path.moveTo(centerX, centerY); 
      path.lineTo(p.x, p.y); 
      path.lineTo(nextP.x, nextP.y); 
      path.closePath();

      return { 
        path, 
        color: `hsla(${color.h}, ${color.s}%, ${brightness}%, 0.9)`, 
        brightness 
      };
    });

    const fullPath = new Path2D();
    pts.forEach((p, i) => i === 0 ? fullPath.moveTo(p.x, p.y) : fullPath.lineTo(p.x, p.y));
    fullPath.closePath();

    return {
      x, y, size, facets, fullPath, pts,
      rotation,
      color,
      layer: Math.random() > 0.4 ? 'foreground' : 'background',
      isCutout: false,
      blendMode: ['source-over', 'screen', 'overlay'][Math.floor(Math.random() * 3)],
      hasPattern: Math.random() > 0.4,
      patternType: ['dots', 'halftone'][Math.floor(Math.random() * 2)],
      hasGlow: Math.random() > 0.4,
      glitchChance: 0,
      depth: Math.random() 
    };
  }

  _getPointsForShape(type, size) {
    const pts = [], r = size / 2;
    // Always use organic shards with varied sides and radii
    const sides = Math.floor(randomRange(5, 10));
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + (Math.random() - 0.5) * (Math.PI * 2 / sides);
      const dist = r * randomRange(0.6, 1.2);
      pts.push({ x: Math.cos(a) * dist, y: Math.sin(a) * dist });
    }
    return pts;
  }

  _preRenderPatterns() {
    this.patternCache.clear();
    ['dots', 'lines', 'halftone'].forEach(type => {
      const tile = createCanvas(12, 12), pctx = tile.getContext('2d');
      pctx.strokeStyle = 'rgba(255,255,255,0.2)';
      if (type === 'dots') { pctx.fillStyle = 'rgba(255,255,255,0.3)'; pctx.beginPath(); pctx.arc(6, 6, 1.5, 0, Math.PI*2); pctx.fill(); }
      else if (type === 'halftone') { pctx.fillStyle = 'rgba(255,255,255,0.4)'; pctx.beginPath(); pctx.arc(0, 0, 2, 0, Math.PI*2); pctx.arc(12, 12, 2, 0, Math.PI*2); pctx.fill(); }
      else { pctx.beginPath(); pctx.moveTo(0,0); pctx.lineTo(12,12); pctx.stroke(); }
      this.patternCache.set(type, tile);
    });
  }

  _createPaperTexture() {
    const canvas = createCanvas(this.width, this.height), ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, this.width, this.height);
    const imgData = ctx.getImageData(0,0,this.width,this.height);
    for(let i=0; i<imgData.data.length; i+=4) { const n = (Math.random()-0.5)*20; imgData.data[i] += n; imgData.data[i+1] += n; imgData.data[i+2] += n; }
    ctx.putImageData(imgData,0,0); this.paperTexture = canvas;
  }

  // --- Rendering ---

  _renderBase(ctx, width, height) {
    ctx.fillStyle = '#010101'; ctx.fillRect(0, 0, width, height);
    const g = ctx.createRadialGradient(width/2, height*0.4, 0, width/2, height*0.4, width);
    g.addColorStop(0, `hsla(${this.palette[0].h}, 60%, 8%, 0.4)`); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
    ctx.save(); ctx.globalAlpha = 0.1; ctx.drawImage(this.paperTexture, 0, 0); ctx.restore();
  }

  _renderSmoke(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    this.smokePuffs.forEach(p => {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      // Increased lightness and saturation for more noticeable colored smoke
      g.addColorStop(0, `hsla(${p.hue}, 90%, 50%, ${p.alpha})`); 
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
    });
    ctx.restore();
  }

  _renderShardTrails(ctx) {
    ctx.save();
    // Only trail foreground-ish shards, but much more subtly
    this.shapes.filter(s => s.depth > 0.7).forEach(s => {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      
      const trailLength = s.size * 1.2 * s.depth;
      const tx = Math.cos(this.motionAngle - s.rotation) * trailLength;
      const ty = Math.sin(this.motionAngle - s.rotation) * trailLength;
      
      ctx.globalAlpha = 0.08 * s.depth;
      ctx.fillStyle = `hsla(${s.color.h}, 100%, 75%, 1)`;
      
      s.pts.forEach(p => {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + tx, p.y + ty);
        ctx.lineTo(p.x + tx * 0.2, p.y + ty * 0.2); 
        ctx.closePath();
        ctx.fill();
      });
      ctx.restore();
    });
    ctx.restore();
  }

  _renderShapeGroup(ctx, shapes) {
    const off = createCanvas(this.width, this.height), octx = off.getContext('2d');
    shapes.forEach(s => this._drawTrapShard(octx, s));
    ctx.drawImage(off, 0, 0);
  }

  _drawTrapShard(ctx, s) {
    const jX = s.glitchChance > 0 ? (Math.random() - 0.5) * s.glitchChance : 0;
    const jY = s.glitchChance > 0 ? (Math.random() - 0.5) * s.glitchChance : 0;

    ctx.save();
    ctx.globalCompositeOperation = s.blendMode;
    ctx.translate(s.x + jX, s.y + jY); ctx.rotate(s.rotation);

    const relLight = this.lightAngle - s.rotation;
    const relRim = relLight + Math.PI;

    // Chromatic Aberration for foreground shards
    if (s.depth > 0.7) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const shift = 3 * s.depth;
      ctx.save(); ctx.translate(-shift, -shift * 0.5); ctx.fillStyle = 'rgba(255,0,0,0.15)'; ctx.fill(s.fullPath); ctx.restore();
      ctx.save(); ctx.translate(shift, shift * 0.5); ctx.fillStyle = 'rgba(0,255,255,0.15)'; ctx.fill(s.fullPath); ctx.restore();
      ctx.restore();
    }

    // Dynamic Lighting Layer 1: Core Glow (Internal depth, offset towards light)
    ctx.save();
    const glowX = Math.cos(relLight) * s.size * 0.15;
    const glowY = Math.sin(relLight) * s.size * 0.15;
    const coreGrad = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, s.size * 0.7);
    coreGrad.addColorStop(0, `hsla(${s.color.h}, 100%, 75%, 0.4)`);
    coreGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGrad;
    ctx.globalCompositeOperation = 'screen';
    ctx.fill(s.fullPath);
    ctx.restore();

    // Render Facets
    s.facets.forEach(f => {
      ctx.fillStyle = f.color; ctx.fill(f.path);
      
      // Fresnel / Edge Highlight
      if (f.brightness > 40) {
        ctx.save();
        const g = ctx.createLinearGradient(0, 0, Math.cos(relLight)*s.size, Math.sin(relLight)*s.size);
        g.addColorStop(0, `hsla(${s.color.h}, 100%, 95%, 0.4)`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.globalCompositeOperation = 'overlay'; ctx.fill(f.path);
        ctx.restore();
      }

      if (s.hasGlow && f.brightness > 50) {
        ctx.save(); ctx.strokeStyle = `hsla(${s.color.h}, 100%, 80%, 0.5)`; ctx.shadowColor = `hsla(${s.color.h}, 100%, 70%, 0.8)`; ctx.shadowBlur = 15; ctx.lineWidth = 1.5; ctx.stroke(f.path); ctx.restore();
      } else {
        ctx.strokeStyle = `hsla(${s.color.h}, 100%, 80%, 0.2)`; ctx.lineWidth = 1; ctx.stroke(f.path);
      }
    });

    // Dynamic Lighting Layer 2: Rim Highlight (Opposite the light source)
    ctx.save();
    ctx.strokeStyle = `hsla(${s.color.h}, 100%, 90%, 0.5)`;
    ctx.lineWidth = 2 * s.depth;
    ctx.globalCompositeOperation = 'overlay';
    ctx.shadowColor = `hsla(${s.color.h}, 100%, 80%, 0.4)`;
    ctx.shadowBlur = 10;
    
    // Only stroke the rim part of the path
    ctx.beginPath();
    const rimThreshold = 1.3;
    s.pts.forEach((p, i) => {
      const pAngle = Math.atan2(p.y, p.x);
      let diff = Math.abs(pAngle - relRim);
      while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
      
      if (diff < rimThreshold) {
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
    });
    ctx.stroke();
    ctx.restore();

    if (s.hasPattern) {
      ctx.save(); ctx.clip(s.fullPath); ctx.globalAlpha = 0.2;
      ctx.fillStyle = ctx.createPattern(this.patternCache.get(s.patternType), 'repeat');
      ctx.fillRect(-s.size, -s.size, s.size*2, s.size*2); ctx.restore();
    }

    // Specular Edge Highlight (Final polish)
    ctx.save();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.4;
    ctx.stroke(s.fullPath);
    ctx.restore();

    ctx.restore();
  }

  _renderPost(ctx, width, height) {
    const v = ctx.createRadialGradient(width/2, height/2, width*0.5, width/2, height/2, width*1.3);
    v.addColorStop(0, 'transparent'); v.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, width, height);
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.15; ctx.drawImage(this.paperTexture, 0, 0); ctx.restore();
  }
}
