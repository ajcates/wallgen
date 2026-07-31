import { Style } from '../core/Style.js';
import { mapRange, randomRange } from '../utils/math.js';
import * as canvasUtils from '../utils/canvas.js';

/**
 * FlowingRibbonsStyle: Silk-like ribbons interweaving in 3D-ish space.
 * Features: Glossy highlights, darker backsides, and soft multi-colored stage lighting.
 */
export class FlowingRibbonsStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.ribbons = [];
    this.lights = [];
  }

  async init(data) {
    await super.init(data);
    const latest = (data && data.length > 0) 
      ? data[data.length - 1] 
      : { bp: 100, fm: 50, hh: 12 };
    
    this._generateRibbons(latest);
  }

  _initLights(baseHue) {
    this.lights = [];
    const numLights = 10;
    for (let i = 0; i < numLights; i++) {
      // Use structured hues based on baseHue (Analogous or Complementary)
      const hueOffset = Math.random() > 0.5 ? randomRange(-40, 40) : randomRange(140, 220);
      const hue = (baseHue + hueOffset + 360) % 360;

      this.lights.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: randomRange(this.width * 0.4, this.width * 1.5),
        hue: hue,
        alpha: randomRange(0.1, 0.2)
      });
    }
  }

  _generateRibbons(latest) {
    this.ribbons = [];
    const numRibbons = Math.floor(mapRange(latest.bp, 0, 100, 20, 40));
    const baseHue = Math.random() * 360;

    this._initLights(baseHue);

    for (let i = 0; i < numRibbons; i++) {
      const points = [];
      const numPoints = 6;
      const width = randomRange(20, 65); // Even finer ribbons
      
      // Keep ribbons within the structured palette
      const hueOffset = Math.random() > 0.7 ? randomRange(140, 220) : randomRange(-30, 30);
      const hue = (baseHue + hueOffset + 360) % 360;
      
      // Starting position (top or side)
      const startX = randomRange(-0.2 * this.width, 1.2 * this.width);
      const startY = -0.2 * this.height;

      for (let j = 0; j < numPoints; j++) {
        points.push({
          x: j === 0 ? startX : randomRange(-0.3 * this.width, 1.3 * this.width),
          y: j === 0 ? startY : (j / (numPoints - 1)) * this.height * 1.4 - (0.2 * this.height),
          z: Math.random() * 1000 // Depth for sorting
        });
      }

      this.ribbons.push({
        points,
        width,
        hue,
        saturation: randomRange(70, 100),
        lightness: randomRange(45, 65),
        twistFreq: randomRange(2.5, 6),
        offset: Math.random() * Math.PI * 2,
        z: points[0].z
      });
    }

    // Sort by "average depth"
    this.ribbons.sort((a, b) => a.z - b.z);
  }

  async render(ctx, width, height) {
    // Deep dark base
    ctx.fillStyle = '#020205';
    ctx.fillRect(0, 0, width, height);

    // Render Stage Lighting (Atmospheric/Background)
    this._renderLights(ctx, 'screen', 0.8);

    // Global shadow for ambient occlusion between ribbons
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 5;

    // Draw ribbons
    for (const r of this.ribbons) {
      this._drawRibbon(ctx, r);
    }

    // Reset shadow before foreground effects
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Render Foreground Highlights (Bloom/Lighting)
    this._renderLights(ctx, 'overlay', 0.4);

    await canvasUtils.drawGrain(ctx, width, height, 0, 0.05);
  }

  _renderLights(ctx, mode, globalAlpha) {
    ctx.save();
    ctx.globalCompositeOperation = mode;
    
    for (const light of this.lights) {
      const grad = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.radius);
      grad.addColorStop(0, `hsla(${light.hue}, 90%, 65%, ${light.alpha * globalAlpha})`);
      grad.addColorStop(0.5, `hsla(${light.hue}, 80%, 50%, ${light.alpha * 0.3 * globalAlpha})`);
      grad.addColorStop(1, `hsla(${light.hue}, 70%, 40%, 0)`);
      
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    ctx.restore();
  }

  _drawRibbon(ctx, r) {
    const steps = 500; // Ultra high density
    const points = r.points;

    for (let i = 0; i < steps - 1; i++) {
      const t1 = i / steps;
      const t2 = (i + 2.5) / steps; // Aggressive overlap to bridge any gaps

      const p1 = this._getBezierPoint(points, t1);
      const p2 = this._getBezierPoint(points, t2);
      
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const normal = angle + Math.PI / 2;

      const twist = Math.sin(t1 * r.twistFreq + r.offset);
      const isBackside = twist < 0;
      const currentWidth = r.width * Math.abs(twist);
      
      const x1 = p1.x + Math.cos(normal) * currentWidth / 2;
      const y1 = p1.y + Math.sin(normal) * currentWidth / 2;
      const x2 = p1.x - Math.cos(normal) * currentWidth / 2;
      const y2 = p1.y - Math.sin(normal) * currentWidth / 2;
      const x3 = p2.x - Math.cos(normal) * currentWidth / 2;
      const y3 = p2.y - Math.sin(normal) * currentWidth / 2;
      const x4 = p2.x + Math.cos(normal) * currentWidth / 2;
      const y4 = p2.y + Math.sin(normal) * currentWidth / 2;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.closePath();

      let l = isBackside ? r.lightness * 0.4 : r.lightness;
      let s = isBackside ? r.saturation * 0.6 : r.saturation;
      
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      if (isBackside) {
        grad.addColorStop(0, `hsl(${r.hue}, ${s}%, ${l * 0.9}%)`);
        grad.addColorStop(0.5, `hsl(${r.hue}, ${s - 20}%, ${l * 0.5}%)`);
        grad.addColorStop(1, `hsl(${r.hue}, ${s}%, ${l * 0.8}%)`);
      } else {
        grad.addColorStop(0, `hsl(${r.hue}, ${s}%, ${Math.min(100, l + 25)}%)`); 
        grad.addColorStop(0.1, `hsl(${r.hue}, ${s}%, ${l * 0.8}%)`);
        grad.addColorStop(0.45, `hsl(${r.hue}, ${s}%, ${l * 0.9}%)`); 
        grad.addColorStop(0.5, `hsl(${r.hue}, 100%, 95%)`); 
        grad.addColorStop(0.55, `hsl(${r.hue}, ${s}%, ${l * 0.9}%)`);
        grad.addColorStop(1, `hsl(${r.hue}, ${s}%, ${l * 0.6}%)`);
      }

      ctx.fillStyle = grad;
      ctx.fill();

      // Slightly thicker stroke to guarantee no sub-pixel gaps
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  _getBezierPoint(points, t) {
    let tempPoints = [...points];
    while (tempPoints.length > 1) {
      const nextPoints = [];
      for (let i = 0; i < tempPoints.length - 1; i++) {
        nextPoints.push({
          x: (1 - t) * tempPoints[i].x + t * tempPoints[i+1].x,
          y: (1 - t) * tempPoints[i].y + t * tempPoints[i+1].y
        });
      }
      tempPoints = nextPoints;
    }
    return tempPoints[0];
  }
}
