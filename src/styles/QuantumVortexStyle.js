import { Style } from '../core/Style.js';
import { mapRange, randomRange } from '../utils/math.js';
import * as canvasUtils from '../utils/canvas.js';

/**
 * QuantumVortexStyle (Overhauled): "Gargantua"
 * A hyper-realistic, cinematic black hole visualization with 
 * an accretion disk, gravitational lensing, and intense volumetric bloom.
 */
export class QuantumVortexStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.particles = [];
    this.stars = [];
    this.center = { x: 0, y: 0 };
    this.baseHue = Math.random() * 360;
  }

  async init(data) {
    await super.init(data);
    const latest = data[data.length - 1] || { bp: 100, fm: 50 };
    
    this.center = { x: this.width / 2, y: this.height / 2 };
    this.baseHue = Math.random() * 360;
    this.radius = Math.min(this.width, this.height) * 0.18; // Event horizon radius
    this.tilt = 0.25; // 3D Tilt of the accretion disk

    this._generateParticles(data);
    this._generateStars();
  }

  _generateStars() {
    this.stars = [];
    for(let i = 0; i < 400; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() > 0.9 ? randomRange(1.5, 2.5) : randomRange(0.5, 1.2),
        alpha: randomRange(0.1, 0.8),
        color: Math.random() > 0.8 ? `hsl(${this.baseHue + randomRange(-40, 40)}, 80%, 80%)` : '#ffffff'
      });
    }
  }

  _generateParticles(data) {
    this.particles = [];
    const count = 12000; // Massive particle count for a dense, fluid-like accretion disk

    for (let i = 0; i < count; i++) {
      // Exponential distribution to cluster particles near the event horizon
      const t = Math.pow(Math.random(), 2.5);
      const dist = this.radius * 1.05 + t * this.radius * 6; 
      
      const angle = Math.random() * Math.PI * 2;
      
      // Disk thickness tapers off at the edges
      const maxThickness = mapRange(dist, this.radius, this.radius * 7, this.radius * 0.2, this.radius * 0.02);
      const yOffset = randomRange(-maxThickness, maxThickness);

      // Orbital speed (Keplerian-ish: faster closer to center)
      const speed = Math.sqrt(this.radius / dist) * 0.1;

      // Color mapping based on distance (White-hot inner, rich colors outer)
      const heat = 1 - t; // 1 is close to center, 0 is far
      let hueOffset, saturation, lightness;
      
      if (heat > 0.8) {
        hueOffset = randomRange(-10, 10);
        saturation = randomRange(50, 100);
        lightness = randomRange(80, 100); // White hot
      } else if (heat > 0.4) {
        hueOffset = randomRange(-30, 30);
        saturation = randomRange(80, 100);
        lightness = randomRange(50, 80);
      } else {
        hueOffset = randomRange(30, 90); // Shift to secondary colors at edges
        saturation = randomRange(60, 90);
        lightness = randomRange(20, 50);
      }

      this.particles.push({
        angle,
        dist,
        yOffset,
        speed,
        size: randomRange(0.5, 2.5),
        hueOffset,
        saturation,
        lightness,
        heat
      });
    }

    // Sort particles by distance for proper rendering order (painter's algorithm)
    this.particles.sort((a, b) => b.dist - a.dist);
  }

  async render(ctx, width, height) {
    // 1. Deep Space Background
    ctx.fillStyle = '#030105';
    ctx.fillRect(0, 0, width, height);

    // 2. Stars
    this._renderStars(ctx);

    // 3. Background Nebula Glow
    this._renderNebula(ctx);

    // 4. Back half of the Accretion Disk (behind the black hole, lensed upwards/downwards)
    this._renderDisk(ctx, true);

    // 5. The Event Horizon (Pitch Black Sphere)
    this._renderSingularity(ctx);

    // 6. Front half of the Accretion Disk
    this._renderDisk(ctx, false);

    // 7. Volumetric Ray Bursts & Flares
    this._renderFlares(ctx);

    // 8. Cinematic Grain and slight chromatic aberration
    await canvasUtils.drawGrain(ctx, width, height, 0, 0.05);
  }

  _renderStars(ctx) {
    ctx.globalCompositeOperation = 'screen';
    this.stars.forEach(s => {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
  }

  _renderNebula(ctx) {
    ctx.globalCompositeOperation = 'screen';
    const bgGlow = ctx.createRadialGradient(this.center.x, this.center.y, this.radius, this.center.x, this.center.y, this.radius * 8);
    bgGlow.addColorStop(0, `hsla(${this.baseHue}, 80%, 50%, 0.15)`);
    bgGlow.addColorStop(0.3, `hsla(${(this.baseHue + 40)%360}, 90%, 30%, 0.08)`);
    bgGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = bgGlow;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  _renderSingularity(ctx) {
    ctx.globalCompositeOperation = 'source-over';
    
    // Intense photon ring behind the event horizon
    ctx.shadowColor = `hsl(${this.baseHue}, 100%, 70%)`;
    ctx.shadowBlur = 60;
    
    ctx.beginPath();
    ctx.arc(this.center.x, this.center.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    
    ctx.shadowBlur = 0;

    // Glowing edge of the event horizon
    ctx.globalCompositeOperation = 'screen';
    ctx.lineWidth = 2;
    ctx.strokeStyle = `hsla(${this.baseHue}, 100%, 80%, 0.9)`;
    ctx.stroke();

    ctx.lineWidth = 8;
    ctx.strokeStyle = `hsla(${this.baseHue}, 100%, 60%, 0.4)`;
    ctx.stroke();

    ctx.lineWidth = 20;
    ctx.strokeStyle = `hsla(${this.baseHue}, 100%, 50%, 0.15)`;
    ctx.stroke();
  }

  _renderDisk(ctx, isBack) {
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';

    const lensedParticles = [];

    // Calculate positions and apply gravitational lensing
    this.particles.forEach(p => {
      const sinA = Math.sin(p.angle);
      const isBehind = sinA < 0;
      
      if (isBack !== isBehind) return;

      // Base 3D to 2D projection
      let x = p.dist * Math.cos(p.angle);
      let y = p.dist * sinA * this.tilt + p.yOffset;
      let z = p.dist * sinA;

      let lensed = false;
      let alphaMultiplier = 1;

      // GRAVITATIONAL LENSING
      // Light from the back half warps over and under the black hole
      if (isBehind) {
        const distToCenter2D = Math.hypot(x, y);
        
        // If the particle appears directly behind the event horizon, warp it
        if (distToCenter2D < this.radius * 1.8) {
          lensed = true;
          // Warp strength increases the closer it is to the center
          const warpStrength = Math.pow((this.radius * 1.8 - distToCenter2D) / (this.radius * 1.8), 2.5);
          
          // Bend it outwards towards the poles
          const warpDir = y < 0 ? -1 : 1;
          const warpAmount = this.radius * warpStrength * 2.2;
          y += warpDir * warpAmount;

          // Stretch the particle along the warp curve
          p.size *= (1 + warpStrength * 2);
          
          // Dim it slightly as light scatters
          alphaMultiplier = 1 - (warpStrength * 0.3);
        }
      } else {
        // Front half: Fade out particles that pass exactly in front of the blinding photon ring
        const distToCenter2D = Math.hypot(x, y);
        if (distToCenter2D > this.radius * 0.9 && distToCenter2D < this.radius * 1.2) {
          alphaMultiplier = 1.5; // Actually brighten them (bloom)
        }
      }

      // Calculate trail
      let endX = p.dist * Math.cos(p.angle - p.speed * 4);
      let endY = p.dist * Math.sin(p.angle - p.speed * 4) * this.tilt + p.yOffset;
      
      if (isBehind && lensed) {
         const endDist2D = Math.hypot(endX, endY);
         if (endDist2D < this.radius * 1.8) {
            const warpStrength = Math.pow((this.radius * 1.8 - endDist2D) / (this.radius * 1.8), 2.5);
            const warpDir = endY < 0 ? -1 : 1;
            endY += warpDir * this.radius * warpStrength * 2.2;
         }
      }

      lensedParticles.push({
        p,
        x1: this.center.x + x,
        y1: this.center.y + y,
        x2: this.center.x + endX,
        y2: this.center.y + endY,
        alphaMultiplier
      });
    });

    // Batch draw lines for performance, but we need individual colors
    lensedParticles.forEach(lp => {
      const { p, x1, y1, x2, y2, alphaMultiplier } = lp;
      
      const hue = (this.baseHue + p.hueOffset + 360) % 360;
      let alpha = p.heat * 0.8 + 0.1;
      alpha *= alphaMultiplier;

      ctx.beginPath();
      ctx.strokeStyle = `hsla(${hue}, ${p.saturation}%, ${p.lightness}%, ${alpha})`;
      ctx.lineWidth = p.size;
      
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Add a hot core to thick particles
      if (p.size > 1.5 && p.heat > 0.5) {
        ctx.beginPath();
        ctx.strokeStyle = `hsla(0, 0%, 100%, ${alpha * 0.8})`;
        ctx.lineWidth = p.size * 0.4;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    });
  }

  _renderFlares(ctx) {
    ctx.globalCompositeOperation = 'screen';
    
    // Equatorial flare
    const grad = ctx.createRadialGradient(this.center.x, this.center.y, this.radius, this.center.x, this.center.y, this.width);
    grad.addColorStop(0, `hsla(${this.baseHue}, 100%, 80%, 0.4)`);
    grad.addColorStop(0.2, `hsla(${this.baseHue}, 80%, 50%, 0.1)`);
    grad.addColorStop(1, 'transparent');

    ctx.save();
    ctx.translate(this.center.x, this.center.y);
    
    // Horizontal stretch
    ctx.scale(1, this.tilt);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, this.width, 0, Math.PI * 2);
    ctx.fill();

    // Sharp horizontal light ray (Anamorphic flare)
    const rayGrad = ctx.createLinearGradient(-this.width, 0, this.width, 0);
    rayGrad.addColorStop(0, 'transparent');
    rayGrad.addColorStop(0.4, `hsla(${this.baseHue}, 100%, 70%, 0.3)`);
    rayGrad.addColorStop(0.5, 'hsla(0, 0%, 100%, 0.8)');
    rayGrad.addColorStop(0.6, `hsla(${this.baseHue}, 100%, 70%, 0.3)`);
    rayGrad.addColorStop(1, 'transparent');
    
    ctx.fillStyle = rayGrad;
    ctx.fillRect(-this.width, -4, this.width * 2, 8);
    
    ctx.restore();
  }
}
