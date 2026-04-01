import { Style } from '../core/Style.js';
import { mapRange, randomRange, distance } from '../utils/math.js';
import * as colorUtils from '../utils/color.js';
import * as canvasUtils from '../utils/canvas.js';

/**
 * DoubleHelixFractalStyle: A recursive fractal where every branch is a 
 * complex, intertwined double-helix structure.
 */
export class DoubleHelixFractalStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.helixNodes = [];
    this.palette = [];
  }

  async init(data) {
    await super.init(data);
    if (!data || data.length === 0) return;

    const latest = data[data.length - 1];
    this._initPalette(latest);
    this._generateFractals(data);
  }

  _initPalette(entry) {
    const hueOffset = Math.random() * 360;
    const baseHue = (mapRange(entry.hh + (entry.mm / 60), 0, 24, 0, 360) + hueOffset) % 360;
    const saturation = mapRange(entry.fm, 0, 100, 85, 100); 
    
    this.isLightMode = entry.hh >= 6 && entry.hh < 18;
    this.palette = colorUtils.generateMaterialPalette(baseHue, saturation, this.isLightMode);
  }

  _generateFractals(data) {
    const margin = 150;
    // We'll draw fewer but more complex structures
    this.helixNodes = data.slice(-15).map((log, index) => {
      const hh = Number(log.hh) || 0;
      const mm = Number(log.mm) || 0;
      const bp = Number(log.bp) || 0;
      const pt = Number(log.pt) || 0;

      const x = randomRange(margin, this.width - margin);
      const y = randomRange(margin, this.height - margin);
      const z = randomRange(-300, 300); // Base Z depth
      
      const depth = Math.max(1, Math.min(3, Math.floor(mapRange(bp, 0, 100, 2, 3))));
      const spokes = Math.max(2, Math.min(5, Math.floor(mapRange(pt % 300, 0, 300, 2, 5))));
      
      const paletteColor = this.palette[index % (this.palette.length - 1)];
      const nodeColor = {
        h: (paletteColor.h + randomRange(-15, 15)) % 360,
        s: paletteColor.s,
        l: paletteColor.l
      };

      return {
        x, y, z,
        depth,
        spokes,
        color: nodeColor,
        scale: mapRange(bp, 0, 100, 0.4, 1.8), // Increased size variance
        twistFreq: mapRange(pt, 0, 1000, 6, 24), 
        amplitude: mapRange(bp, 0, 100, 25, 60), 
        rotation: randomRange(0, Math.PI * 2),
        branchAngle: mapRange(hh + mm / 60, 0, 24, Math.PI / 6, Math.PI / 3),
        bendIntensity: randomRange(-40, 40), // How much the helix curves
        bendPhase: randomRange(0, Math.PI * 2) // Variation in the curve shape
      };
    });
  }

  render(ctx, width, height) {
    this._drawBackground(ctx, width, height);
    this._drawAmbientParticles(ctx, width, height);

    // Sort by Z for Painter's Algorithm (Back to Front)
    const sortedNodes = [...this.helixNodes].sort((a, b) => b.z - a.z);

    sortedNodes.forEach((node) => {
      ctx.save();
      
      // Project the root position
      const focalLength = 1000;
      const perspectiveScale = focalLength / (focalLength + node.z);
      const screenX = (node.x - width / 2) * perspectiveScale + width / 2;
      const screenY = (node.y - height / 2) * perspectiveScale + height / 2;

      ctx.translate(screenX, screenY);
      ctx.rotate(node.rotation);
      ctx.scale(perspectiveScale, perspectiveScale); // Scale based on base Z
      
      const angleStep = (Math.PI * 2) / node.spokes;
      for (let i = 0; i < node.spokes; i++) {
        ctx.save();
        ctx.rotate(i * angleStep);
        this._drawRecursiveHelix(ctx, 0, 0, 400 * node.scale, -Math.PI / 2, node.depth, node);
        ctx.restore();
      }
      ctx.restore();
    });

    canvasUtils.drawGrain(ctx, width, height);
  }

  _drawAmbientParticles(ctx, width, height) {
    const particleCount = 60;
    const focalLength = 1000;
    
    ctx.save();
    for (let i = 0; i < particleCount; i++) {
      const x = randomRange(-width, width * 2);
      const y = randomRange(-height, height * 2);
      const z = randomRange(-500, 1000);
      
      const perspectiveScale = focalLength / (focalLength + z);
      const screenX = (x - width / 2) * perspectiveScale + width / 2;
      const screenY = (y - height / 2) * perspectiveScale + height / 2;
      
      if (screenX < 0 || screenX > width || screenY < 0 || screenY > height) continue;
      
      const size = randomRange(1, 4) * perspectiveScale;
      const opacity = mapRange(z, -500, 1000, 0.6, 0.1);
      const hue = (this.palette[0].h + randomRange(-30, 30)) % 360;
      
      ctx.fillStyle = `hsla(${hue}, 70%, 80%, ${opacity})`;
      ctx.beginPath();
      ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
      ctx.fill();
      
      if (opacity > 0.3) {
        ctx.shadowBlur = size * 4;
        ctx.shadowColor = `hsl(${hue}, 70%, 80%)`;
        ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  _drawBackground(ctx, width, height) {
    const bg = this.palette[3]; 
    if (!this.isLightMode) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      return;
    }
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, `hsl(${bg.h}, ${bg.s}%, ${bg.l}%)`);
    grad.addColorStop(1, `hsl(${bg.h}, ${bg.s}%, ${bg.l - 5}%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  _drawRecursiveHelix(ctx, x, y, length, angle, depth, config) {
    if (depth <= 0 || length < 10) return;

    const x2 = x + Math.cos(angle) * length;
    const y2 = y + Math.sin(angle) * length;

    // Draw the Double Helix segment
    this._drawDoubleHelix(ctx, x, y, x2, y2, config, depth);

    const nextLength = length * 0.65;
    this._drawRecursiveHelix(ctx, x2, y2, nextLength, angle - config.branchAngle, depth - 1, config);
    this._drawRecursiveHelix(ctx, x2, y2, nextLength, angle + config.branchAngle, depth - 1, config);
  }

  _drawDoubleHelix(ctx, x1, y1, x2, y2, config, depth) {
    const dist = distance({x: x1, y: y1}, {x: x2, y: y2});
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const steps = 40; 
    const amp = config.amplitude * (depth / config.depth);
    const freq = config.twistFreq;

    // Perspective Parameters
    const focalLength = 800;
    const skewX = Math.cos(config.rotation) * 0.3; // Data-driven skew
    const skewY = Math.sin(config.rotation) * 0.3;

    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(angle);

    const baseColor = config.color;
    const color1 = `hsl(${baseColor.h}, ${baseColor.s}%, ${baseColor.l}%)`;
    const color2 = `hsl(${(baseColor.h + 40) % 360}, ${baseColor.s}%, ${this.isLightMode ? baseColor.l - 10 : baseColor.l + 10}%)`;

    // 3D Projection Helper with Bending
    const project = (x, y, z, t) => {
      // Apply a quadratic bend based on progress (t) along the segment
      const bendFactor = Math.sin(t * Math.PI); 
      const bendY = bendFactor * config.bendIntensity * (depth / config.depth);
      
      const scale = focalLength / (focalLength + z);
      return {
        x: x * scale + (z * skewX),
        y: (y + bendY) * scale + (z * skewY),
        scale
      };
    };

    // 1. Draw BACK Segments
    for (let i = 0; i < steps; i++) {
      const t1 = i / steps;
      const t2 = (i + 1) / steps;
      
      const phaseA = 0;
      const phaseB = Math.PI;

      // Fade factor: based on recursion depth and progress along segment
      const fade = (depth / config.depth) * (1 - t1 * 0.4);

      // Calculate 3D Z-depth
      const z1A = Math.cos(t1 * freq + phaseA) * amp;
      const z2A = Math.cos(t2 * freq + phaseA) * amp;
      const z1B = Math.cos(t1 * freq + phaseB) * amp;
      const z2B = Math.cos(t2 * freq + phaseB) * amp;

      // Calculate 3D Y-offset (the wave)
      const y1A = Math.sin(t1 * freq + phaseA) * amp;
      const y2A = Math.sin(t2 * freq + phaseA) * amp;
      const y1B = Math.sin(t1 * freq + phaseB) * amp;
      const y2B = Math.sin(t2 * freq + phaseB) * amp;

      // Project Points
      const p1A = project(t1 * dist, y1A, z1A, t1);
      const p2A = project(t2 * dist, y2A, z2A, t2);
      const p1B = project(t1 * dist, y1B, z1B, t1);
      const p2B = project(t2 * dist, y2B, z2B, t2);

      if (z1A < 0) this._drawProjectedSegment(ctx, p1A, p2A, color1, depth, config, true, fade);
      if (z1B < 0) this._drawProjectedSegment(ctx, p1B, p2B, color2, depth, config, true, fade);
    }

    // 2. Draw Connecting Rungs
    const rungsFade = (depth / config.depth);
    ctx.globalAlpha = 0.25 * rungsFade;
    ctx.strokeStyle = colorUtils.getAdaptiveContrast(baseColor.h, baseColor.s, baseColor.l);
    for (let i = 0; i <= steps; i += 6) {
      const t = i / steps;
      const yA = Math.sin(t * freq) * amp;
      const zA = Math.cos(t * freq) * amp;
      const yB = Math.sin(t * freq + Math.PI) * amp;
      const zB = Math.cos(t * freq + Math.PI) * amp;

      const pA = project(t * dist, yA, zA, t);
      const pB = project(t * dist, yB, zB, t);

      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();
    }

    // 3. Draw FRONT Segments
    for (let i = 0; i < steps; i++) {
      const t1 = i / steps;
      const t2 = (i + 1) / steps;
      
      const fade = (depth / config.depth) * (1 - t1 * 0.4);

      const z1A = Math.cos(t1 * freq) * amp;
      const z1B = Math.cos(t1 * freq + Math.PI) * amp;
      const y1A = Math.sin(t1 * freq) * amp;
      const y2A = Math.sin(t2 * freq) * amp;
      const y1B = Math.sin(t1 * freq + Math.PI) * amp;
      const y2B = Math.sin(t2 * freq + Math.PI) * amp;

      const p1A = project(t1 * dist, y1A, z1A, t1);
      const p2A = project(t2 * dist, y2A, Math.cos(t2 * freq) * amp, t2);
      const p1B = project(t1 * dist, y1B, z1B, t1);
      const p2B = project(t2 * dist, y2B, Math.cos(t2 * freq + Math.PI) * amp, t2);

      if (z1A >= 0) this._drawProjectedSegment(ctx, p1A, p2A, color1, depth, config, false, fade);
      if (z1B >= 0) this._drawProjectedSegment(ctx, p1B, p2B, color2, depth, config, false, fade);
    }

    ctx.restore();
  }

  _drawProjectedSegment(ctx, p1, p2, color, depth, config, isBehind, fade = 1.0) {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    
    // Perspective-aware line width
    const baseWidth = Math.max(1.5, config.scale * depth * 3.5 * p1.scale);
    
    if (isBehind) {
      ctx.globalAlpha = 0.3 * p1.scale * fade;
      ctx.lineWidth = baseWidth;
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    } else {
      ctx.globalAlpha = 0.9 * fade;
      ctx.shadowBlur = depth * 12 * p1.scale * fade;
      ctx.shadowColor = color;
      ctx.lineWidth = baseWidth;
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      ctx.globalAlpha = 1.0 * fade;
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = baseWidth * 0.25;
      ctx.stroke();
    }
    ctx.restore();
  }

}
