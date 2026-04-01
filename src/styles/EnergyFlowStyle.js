import { Style } from '../core/Style.js';
import { mapRange, randomRange, lerp } from '../utils/math.js';

/**
 * EnergyFlowStyle (Vortex 3D): A cinematic style featuring pseudo-3D perspective, 
 * prismatic energy ribbons, and high-velocity vortex physics.
 */
export class EnergyFlowStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.particles = [];
    this.sparks = [];
    this.attractors = [];
    this.blobs = [];
    this.orbs = [];
    this.palette = [];
    
    // 3D Perspective Parameters
    this.focalLength = 1000;
    this.center = { x: 0, y: 0 };
    
    // Fluid Grid Parameters
    this.gridSize = 40; 
    this.vxField = null;
    this.vyField = null;
    
    this.flowParams = {
        freqX: 0.003,
        freqY: 0.003,
        strength: 7.0,
        viscosity: 0.96
    };
  }

  async init(data) {
    await super.init(data);
    if (!data || data.length === 0) return;

    this.center = { x: this.width / 2, y: this.height / 2 };

    this._initPalette(data);
    this._initFlowParams(data);
    this._initFluidGrid();
    this._generateAttractors(data);
    this._generateBlobs(data);
    this._generateOrbs(data);
    this._generateParticles(data);
    this._generateSparks(data);
    
    const simulationSteps = 120;
    for (let i = 0; i < simulationSteps; i++) {
        this.processStep();
        if (i % 8 === 0) this._updateFluidGrid();
    }
  }

  _initPalette(data) {
    const lastEntry = data[data.length - 1];
    const baseHue = (mapRange(lastEntry.up % 86400, 0, 86400, 0, 360) + lastEntry.bp) % 360;
    // Wider palette for "Prismatic" feel
    this.palette = [
        { h: baseHue, s: 95, l: 55 },
        { h: (baseHue + 130) % 360, s: 90, l: 45 },
        { h: (baseHue + 230) % 360, s: 100, l: 70 }
    ];
  }

  _initFlowParams(data) {
    const avgBattery = data.reduce((sum, d) => sum + d.bp, 0) / data.length;
    this.flowParams = {
        freqX: mapRange(avgBattery, 0, 100, 0.002, 0.01),
        freqY: mapRange(avgBattery, 0, 100, 0.002, 0.01),
        strength: mapRange(avgBattery, 0, 100, 5.0, 12.0),
        viscosity: 0.96
    };
  }

  _initFluidGrid() {
    this.gridCols = Math.ceil(this.width / this.gridSize) + 1;
    this.gridRows = Math.ceil(this.height / this.gridSize) + 1;
    const totalCells = this.gridCols * this.gridRows;
    this.vxField = new Float32Array(totalCells);
    this.vyField = new Float32Array(totalCells);

    for (let i = 0; i < totalCells; i++) {
        const x = i % this.gridCols;
        const y = Math.floor(i / this.gridCols);
        const angle = Math.sin(x * 0.2) * Math.PI + Math.cos(y * 0.2) * Math.PI;
        this.vxField[i] = Math.cos(angle) * 3;
        this.vyField[i] = Math.sin(angle) * 3;
    }
  }

  _updateFluidGrid() {
    const { vxField, vyField, gridCols, gridRows } = this;
    const viscosity = this.flowParams.viscosity;
    for (let x = 1; x < gridCols - 1; x++) {
      for (let y = 1; y < gridRows - 1; y++) {
        const idx = y * gridCols + x;
        const avgVx = (vxField[idx-1] + vxField[idx+1] + vxField[idx-gridCols] + vxField[idx+gridCols]) * 0.25;
        const avgVy = (vyField[idx-1] + vyField[idx+1] + vyField[idx-gridCols] + vyField[idx+gridCols]) * 0.25;
        vxField[idx] = (vxField[idx] * 0.8 + avgVx * 0.2) * viscosity;
        vyField[idx] = (vyField[idx] * 0.8 + avgVy * 0.2) * viscosity;
      }
    }
  }

  _generateAttractors(data) {
    this.attractors = [];
    const step = Math.max(1, Math.floor(data.length / 18));
    for (let i = 0; i < data.length; i += step) {
      const log = data[i];
      const radius = mapRange(log.fm, 0, 100, 600, 1800);
      this.attractors.push({
        x: mapRange(log.mm, 0, 60, 0, this.width),
        y: mapRange(log.hh, 0, 24, 0, this.height),
        z: randomRange(-400, 400),
        strength: mapRange(log.bp, 0, 100, 5.0, 15.0),
        radius: radius,
        radiusSq: radius * radius,
        type: i % 5 === 0 ? 'repel' : 'attract',
        hue: this.palette[i % 3].h,
        vortexStrength: randomRange(5.0, 15.0) 
      });
    }
  }

  _generateBlobs(data) {
    this.blobs = [];
    data.filter((_, i) => i % 18 === 0).forEach((log, i) => {
        const color = this.palette[i % this.palette.length];
        this.blobs.push({
            x: randomRange(0, this.width),
            y: randomRange(0, this.height),
            z: randomRange(200, 800), // Background depth
            radius: mapRange(log.fm, 0, 100, 800, 2000),
            hue: color.h,
            sat: color.s,
            lum: color.l
        });
    });
  }

  _generateOrbs(data) {
      this.orbs = [];
      const count = 12;
      for (let i = 0; i < count; i++) {
          const log = data[i % data.length];
          this.orbs.push({
              x: randomRange(0, this.width),
              y: randomRange(0, this.height),
              z: randomRange(-200, 600),
              radius: randomRange(250, 600),
              hue: this.palette[i % 3].h,
              pulse: Math.random() * Math.PI * 2,
              speed: randomRange(0.8, 2.0),
              intensity: mapRange(log.bp, 0, 100, 0.7, 1.0)
          });
      }
  }

  _generateParticles(data) {
    this.particles = [];
    const count = 150; 
    for (let i = 0; i < count; i++) {
        const baseColor = this.palette[i % this.palette.length];
        this.particles.push({
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            z: randomRange(-500, 500),
            vx: 0, vy: 0, vz: 0,
            history: [], // Stores projected x,y and original z
            maxHistory: 120 + Math.floor(Math.random() * 80),
            speedMult: randomRange(2.0, 4.0),
            hue: baseColor.h,
            ribbonWidth: randomRange(10, 35),
            braidCount: 4, 
            inertia: randomRange(0.12, 0.25)
        });
    }
  }

  _generateSparks(data) {
      this.sparks = [];
      const count = 800;
      for (let i = 0; i < count; i++) {
          this.sparks.push({
              x: Math.random() * this.width,
              y: Math.random() * this.height,
              z: randomRange(-500, 500),
              vx: 0, vy: 0, vz: 0,
              life: Math.random(),
              decay: randomRange(0.005, 0.02),
              speedMult: randomRange(6.0, 12.0),
              hue: this.palette[i % 3].h
          });
      }
  }

  processStep() {
    const { vxField, vyField, gridSize, gridCols, gridRows, attractors, focalLength, center } = this;
    const { freqX, freqY, strength } = this.flowParams;
    const targets = [...this.particles, ...this.sparks];
    
    for (let i = 0; i < targets.length; i++) {
        const p = targets[i];
        
        // Perspective Projection
        const scale = focalLength / (focalLength + p.z);
        const px = (p.x - center.x) * scale + center.x;
        const py = (p.y - center.y) * scale + center.y;

        if (p.history) {
            p.history.push({ x: px, y: py, z: p.z, scale: scale });
            if (p.history.length > p.maxHistory) p.history.shift();
        }

        // Fluid Grid Influence
        const gx = Math.floor(p.x / gridSize);
        const gy = Math.floor(p.y / gridSize);
        let fvx = 0, fvy = 0;
        if (gx >= 0 && gx < gridCols && gy >= 0 && gy < gridRows) {
            const idx = gy * gridCols + gx;
            fvx = vxField[idx];
            fvy = vyField[idx];
        }

        const angle = 
            Math.sin(p.x * freqX + fvx * 0.4) * Math.PI + 
            Math.cos(p.y * freqY + fvy * 0.4) * Math.PI +
            Math.sin((p.x + p.y + p.z) * 0.001) * 4.0;
        
        let fx = Math.cos(angle) * strength + fvx;
        let fy = Math.sin(angle) * strength + fvy;
        let fz = Math.sin(p.x * 0.002) * 5.0; // Dynamic depth movement

        for (let j = 0; j < attractors.length; j++) {
            const a = attractors[j];
            const dx = a.x - p.x;
            const dy = a.y - p.y;
            const dz = a.z - p.z;
            const distSq = dx * dx + dy * dy + dz * dz;
            
            if (distSq < a.radiusSq && distSq > 1) {
                const d = Math.sqrt(distSq);
                const force = Math.pow(1 - d / a.radius, 1.5) * a.strength;
                const ax = dx / d;
                const ay = dy / d;
                const az = dz / d;
                
                if (a.type === 'attract') {
                    fx += ax * force * 6.0;
                    fy += ay * force * 6.0;
                    fz += az * force * 6.0;
                    // Powerful 3D Twist
                    fx += -ay * force * a.vortexStrength;
                    fy += ax * force * a.vortexStrength;
                } else {
                    fx -= ax * force * 4.0;
                    fy -= ay * force * 4.0;
                    fz -= az * force * 4.0;
                }
            }
        }

        const inertia = p.inertia || 0.18;
        p.vx = lerp(p.vx, fx, inertia);
        p.vy = lerp(p.vy, fy, inertia);
        p.vz = lerp(p.vz, fz, inertia);
        
        p.x += p.vx * p.speedMult;
        p.y += p.vy * p.speedMult;
        p.z += p.vz * p.speedMult;

        // Fluid Interaction
        if (gx >= 0 && gx < gridCols && gy >= 0 && gy < gridRows) {
            const idx = gy * gridCols + gx;
            vxField[idx] += p.vx * 0.08;
            vyField[idx] += p.vy * 0.08;
        }

        // 3D Bounds Wrap
        const margin = 600;
        if (p.x < -margin || p.x > this.width + margin || p.y < -margin || p.y > this.height + margin || p.z > 800 || p.z < -800) {
            p.x = randomRange(0, this.width);
            p.y = randomRange(0, this.height);
            p.z = randomRange(-500, 500);
            if (p.history) p.history = [];
        }

        if (p.life !== undefined) {
            p.life -= p.decay;
            if (p.life <= 0) {
                p.x = randomRange(0, this.width);
                p.y = randomRange(0, this.height);
                p.z = randomRange(-500, 500);
                p.vx = p.vy = p.vz = 0;
                p.life = 1.0;
            }
        }
    }

    for (let i = 0; i < this.orbs.length; i++) {
        const o = this.orbs[i];
        o.pulse += 0.05;
        o.x += Math.cos(o.pulse * 0.4) * o.speed * 3;
        o.y += Math.sin(o.pulse * 0.6) * o.speed * 3;
        o.z += Math.cos(o.pulse * 0.2) * 2;
    }
  }

  render(ctx, width, height) {
    this._renderBackground(ctx, width, height);
    this._renderOil(ctx);
    
    // Sort orbs by depth for rendering
    const sortedOrbs = [...this.orbs].sort((a, b) => b.z - a.z);
    sortedOrbs.forEach(o => this._renderSingleOrb(ctx, o));

    this._renderShadows(ctx);
    this._renderEnergyFlows(ctx);
    this._renderSparks(ctx);
    this._renderAtmosphere(ctx, width, height);
  }

  _renderBackground(ctx, width, height) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    const g = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width * 2.2);
    g.addColorStop(0, '#040b1e');
    g.addColorStop(1, '#000000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  _renderOil(ctx) {
    ctx.save();
    this.blobs.forEach(b => {
        const scale = this.focalLength / (this.focalLength + b.z);
        const rx = (b.x - this.center.x) * scale + this.center.x;
        const ry = (b.y - this.center.y) * scale + this.center.y;
        const radius = b.radius * scale;
        
        ctx.globalCompositeOperation = 'overlay';
        const g = ctx.createRadialGradient(rx, ry, 0, rx, ry, radius);
        g.addColorStop(0, `hsla(${b.hue}, 100%, 20%, ${0.1 * scale})`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(rx, ry, radius, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
  }

  _renderSingleOrb(ctx, o) {
      const scale = this.focalLength / (this.focalLength + o.z);
      const px = (o.x - this.center.x) * scale + this.center.x;
      const py = (o.y - this.center.y) * scale + this.center.y;
      const r = (o.radius + Math.sin(o.pulse) * 40) * scale;
      
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      
      const g1 = ctx.createRadialGradient(px, py, 0, px, py, r);
      g1.addColorStop(0, `hsla(${o.hue}, 100%, 50%, ${0.3 * o.intensity * scale})`);
      g1.addColorStop(1, 'transparent');
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();

      const g2 = ctx.createRadialGradient(px, py, 0, px, py, r * 0.3);
      g2.addColorStop(0, `hsla(${(o.hue + 60) % 360}, 100%, 90%, ${0.6 * o.intensity * scale})`);
      g2.addColorStop(1, 'transparent');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(px, py, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
  }

  _renderShadows(ctx) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.globalCompositeOperation = 'multiply';
      ctx.strokeStyle = '#000000';
      ctx.shadowBlur = 40;
      ctx.shadowColor = '#000000';
      
      this.particles.forEach(p => {
          if (p.history.length < 15) return;
          const last = p.history[p.history.length-1];
          ctx.beginPath();
          ctx.lineWidth = p.ribbonWidth * last.scale * 1.5;
          this._drawShadowPath(ctx, p.history); 
          ctx.stroke();
      });
      ctx.restore();
  }

  _drawShadowPath(ctx, history) {
      ctx.moveTo(history[0].x + 40, history[0].y + 40);
      for (let i = 1; i < history.length - 1; i++) {
          const xc = (history[i].x + history[i+1].x) * 0.5 + 40;
          const yc = (history[i].y + history[i+1].y) * 0.5 + 40;
          ctx.quadraticCurveTo(history[i].x + 40, history[i].y + 40, xc, yc);
      }
  }

  _renderEnergyFlows(ctx) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    this.particles.forEach(p => {
        if (p.history.length < 10) return;

        for (let b = 0; b < p.braidCount; b++) {
            const threadHue = (p.hue + b * (360 / p.braidCount)) % 360;
            const last = p.history[p.history.length-1];
            
            // Prismatic shift along path
            const gradient = ctx.createLinearGradient(
                p.history[0].x, p.history[0].y, 
                last.x, last.y
            );
            gradient.addColorStop(0, `hsla(${threadHue}, 100%, 60%, 0)`);
            gradient.addColorStop(0.5, `hsla(${(threadHue + 60) % 360}, 100%, 70%, ${0.15 * last.scale})`);
            gradient.addColorStop(1, `hsla(${(threadHue + 120) % 360}, 100%, 80%, ${0.3 * last.scale})`);

            ctx.globalCompositeOperation = 'screen';
            ctx.beginPath();
            ctx.strokeStyle = gradient;
            ctx.lineWidth = p.ribbonWidth * last.scale * (0.3 + b * 0.1);
            
            this._drawProjectedPath(ctx, p.history, b * 10);
            ctx.stroke();
            
            // White-hot filament
            ctx.beginPath();
            ctx.strokeStyle = `hsla(${threadHue}, 100%, 98%, ${0.4 * last.scale})`;
            ctx.lineWidth = 0.8 * last.scale;
            this._drawProjectedPath(ctx, p.history, b * 10);
            ctx.stroke();
        }
    });
    ctx.restore();
  }

  _drawProjectedPath(ctx, history, offset) {
      ctx.moveTo(history[0].x, history[0].y);
      for (let i = 1; i < history.length - 1; i++) {
          const t = i / history.length;
          const h = history[i];
          const osc = Math.sin(t * 15 + offset) * 15 * h.scale;
          const xc = (h.x + history[i+1].x) * 0.5 + osc;
          const yc = (h.y + history[i+1].y) * 0.5 + osc;
          ctx.quadraticCurveTo(h.x + osc, h.y + osc, xc, yc);
      }
  }

  _renderSparks(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      this.sparks.forEach(s => {
          const scale = this.focalLength / (this.focalLength + s.z);
          const px = (s.x - this.center.x) * scale + this.center.x;
          const py = (s.y - this.center.y) * scale + this.center.y;
          
          const speed = Math.sqrt(s.vx*s.vx + s.vy*s.vy + s.vz*s.vz);
          const length = Math.min(80, speed * 6) * scale;
          const angle = Math.atan2(s.vy, s.vx);
          
          ctx.strokeStyle = `hsla(${s.hue}, 100%, 95%, ${s.life * 0.8 * scale})`;
          ctx.lineWidth = 1.8 * scale;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px - Math.cos(angle) * length, py - Math.sin(angle) * length);
          ctx.stroke();
      });
      ctx.restore();
  }

  _renderAtmosphere(ctx, width, height) {
    ctx.save();
    
    // Depth-based fog
    const fog = ctx.createRadialGradient(width/2, height/2, width * 0.1, width/2, height/2, width * 1.6);
    fog.addColorStop(0, 'transparent');
    fog.addColorStop(0.7, 'rgba(0,0,0,0.5)');
    fog.addColorStop(1, 'rgba(0,0,0,0.99)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, width, height);

    // Prismatic bloom overlay
    ctx.globalCompositeOperation = 'color-dodge';
    ctx.globalAlpha = 0.08;
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, '#ff0000');
    g.addColorStop(0.5, '#00ff00');
    g.addColorStop(1, '#0000ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    
    ctx.restore();
  }
}
