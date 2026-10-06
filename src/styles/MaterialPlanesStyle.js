import { Style } from '../core/Style.js';

const MATERIALS = ['concrete', 'metal', 'canvas', 'glass'];
const REGULAR_ANGLES = [-60, -30, 0, 30, 60, 90];

const GLASS_TINTS = [
  { h: 194, s: 76, l: 59 },
  { h: 326, s: 72, l: 63 },
  { h: 42, s: 89, l: 64 },
  { h: 151, s: 58, l: 55 }
];

/**
 * MaterialPlanesStyle: an architectural abstract composition of broad, orderly
 * planes. Concrete, brushed metal, woven canvas, and translucent tinted glass
 * sit at a deliberately limited set of angles so their overlaps stay legible.
 */
export class MaterialPlanesStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.planes = [];
    this.lightAngle = -Math.PI / 3;
  }

  async init(data) {
    await super.init(data);
    const latest = data?.at(-1) || { hh: 12, mm: 0, bp: 72, fm: 55 };
    this.lightAngle = ((latest.hh + latest.mm / 60) / 24) * Math.PI * 2 - Math.PI * 0.72;
    this._generatePlanes(latest);
  }

  _generatePlanes(latest) {
    const minSide = Math.min(this.width, this.height);
    const density = Math.round(11 + (latest.bp || 50) / 28);
    const materialCycle = ['concrete', 'metal', 'canvas', 'glass', 'metal', 'glass', 'concrete', 'canvas'];
    this.planes = [];

    for (let index = 0; index < density; index++) {
      const isHero = index < 4;
      const material = materialCycle[index % materialCycle.length];
      const angle = REGULAR_ANGLES[index % REGULAR_ANGLES.length] * Math.PI / 180;
      const wide = isHero
        ? minSide * (0.82 + Math.random() * 0.45)
        : minSide * (0.4 + Math.random() * 0.62);
      const tall = isHero
        ? minSide * (0.2 + Math.random() * 0.16)
        : minSide * (0.1 + Math.random() * 0.22);
      const inset = minSide * 0.09;
      const glass = GLASS_TINTS[index % GLASS_TINTS.length];

      this.planes.push({
        material,
        angle,
        x: -wide * 0.15 + Math.random() * (this.width + wide * 0.3),
        y: -tall * 0.2 + Math.random() * (this.height + tall * 0.4),
        width: wide,
        height: tall,
        radius: Math.max(4, minSide * (isHero ? 0.012 : 0.006)),
        inset,
        glass,
        opacity: material === 'glass' ? 0.36 + Math.random() * 0.18 : 0.9 + Math.random() * 0.08,
        grainSeed: Math.random() * 1000,
        z: index
      });
    }

    // A large final glass plane makes the colored transparency read as an
    // actual foreground material rather than a universal color filter.
    this.planes.push({
      material: 'glass', angle: 30 * Math.PI / 180,
      x: this.width * 0.62, y: this.height * 0.45,
      width: minSide * 1.15, height: minSide * 0.34,
      radius: minSide * 0.014, inset, glass: GLASS_TINTS[1], opacity: 0.35,
      grainSeed: 71, z: density
    });
  }

  async process() {}

  render(ctx, width, height) {
    this._drawBackdrop(ctx, width, height);
    this.planes.forEach(plane => this._drawPlane(ctx, plane));
    this._drawArchitecturalSeams(ctx, width, height);
  }

  _drawBackdrop(ctx, width, height) {
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#171a1c');
    background.addColorStop(0.52, '#343337');
    background.addColorStop(1, '#111416');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.19;
    for (let i = 0; i < 120; i++) {
      const x = (Math.sin(i * 91.73) * 0.5 + 0.5) * width;
      const y = (Math.sin(i * 41.17 + 4) * 0.5 + 0.5) * height;
      const size = 1 + (i % 4);
      ctx.fillStyle = i % 3 === 0 ? '#d9d2c7' : '#07090a';
      ctx.fillRect(x, y, size, size);
    }
    ctx.restore();
  }

  _drawPlane(ctx, plane) {
    ctx.save();
    ctx.translate(plane.x, plane.y);
    ctx.rotate(plane.angle);
    ctx.globalAlpha = plane.opacity;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.48)';
    ctx.shadowBlur = plane.material === 'glass' ? 16 : 10;
    ctx.shadowOffsetX = 8;
    ctx.shadowOffsetY = 12;
    this._roundedRect(ctx, -plane.width / 2, -plane.height / 2, plane.width, plane.height, plane.radius);
    ctx.fillStyle = '#101112';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.clip();

    if (plane.material === 'concrete') this._drawConcrete(ctx, plane);
    if (plane.material === 'metal') this._drawMetal(ctx, plane);
    if (plane.material === 'canvas') this._drawCanvas(ctx, plane);
    if (plane.material === 'glass') this._drawGlass(ctx, plane);

    ctx.restore();
    this._drawPlaneEdge(ctx, plane);
  }

  _drawConcrete(ctx, plane) {
    const { width, height, grainSeed } = plane;
    const wash = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
    wash.addColorStop(0, '#b7b1aa');
    wash.addColorStop(0.5, '#827e78');
    wash.addColorStop(1, '#4f504f');
    ctx.fillStyle = wash;
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 90; i++) {
      const x = -width / 2 + ((Math.sin(grainSeed + i * 12.31) + 1) / 2) * width;
      const y = -height / 2 + ((Math.sin(grainSeed + i * 47.17) + 1) / 2) * height;
      const r = 0.7 + (i % 5) * 0.6;
      ctx.fillStyle = i % 2 ? '#2a2d2e' : '#f1ebe1';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawMetal(ctx, plane) {
    const { width, height } = plane;
    const lightX = Math.cos(this.lightAngle) * width / 2;
    const lightY = Math.sin(this.lightAngle) * height / 2;
    const steel = ctx.createLinearGradient(-lightX, -lightY, lightX, lightY);
    steel.addColorStop(0, '#151d21');
    steel.addColorStop(0.24, '#aebbc0');
    steel.addColorStop(0.42, '#53646b');
    steel.addColorStop(0.62, '#d1dce0');
    steel.addColorStop(1, '#263238');
    ctx.fillStyle = steel;
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#effcff';
    ctx.lineWidth = 1;
    for (let y = -height / 2; y < height / 2; y += 4) {
      ctx.beginPath(); ctx.moveTo(-width / 2, y); ctx.lineTo(width / 2, y - width * 0.06); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  _drawCanvas(ctx, plane) {
    const { width, height } = plane;
    const fabric = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
    fabric.addColorStop(0, '#746f60');
    fabric.addColorStop(0.48, '#c4b99a');
    fabric.addColorStop(1, '#716957');
    ctx.fillStyle = fabric;
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.globalAlpha = 0.27;
    ctx.lineWidth = 1;
    for (let x = -width / 2; x < width / 2; x += 6) {
      ctx.strokeStyle = x % 12 === 0 ? '#382f26' : '#f0dfbb';
      ctx.beginPath(); ctx.moveTo(x, -height / 2); ctx.lineTo(x, height / 2); ctx.stroke();
    }
    for (let y = -height / 2; y < height / 2; y += 6) {
      ctx.strokeStyle = y % 12 === 0 ? '#362f29' : '#f6e9cd';
      ctx.beginPath(); ctx.moveTo(-width / 2, y); ctx.lineTo(width / 2, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  _drawGlass(ctx, plane) {
    const { width, height, glass } = plane;
    const tinted = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
    tinted.addColorStop(0, `hsla(${glass.h}, ${glass.s}%, ${Math.min(88, glass.l + 20)}%, 0.82)`);
    tinted.addColorStop(0.48, `hsla(${glass.h}, ${glass.s}%, ${glass.l}%, 0.5)`);
    tinted.addColorStop(1, `hsla(${glass.h}, ${glass.s}%, ${Math.max(25, glass.l - 16)}%, 0.7)`);
    ctx.fillStyle = tinted;
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.55;
    const flare = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
    flare.addColorStop(0, 'rgba(255,255,255,0)');
    flare.addColorStop(0.45, 'rgba(255,255,255,0.65)');
    flare.addColorStop(0.53, 'rgba(255,255,255,0.08)');
    flare.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = flare;
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  _drawPlaneEdge(ctx, plane) {
    ctx.save();
    ctx.translate(plane.x, plane.y);
    ctx.rotate(plane.angle);
    this._roundedRect(ctx, -plane.width / 2, -plane.height / 2, plane.width, plane.height, plane.radius);
    ctx.lineWidth = plane.material === 'glass' ? 2 : 1.2;
    ctx.strokeStyle = plane.material === 'glass'
      ? `hsla(${plane.glass.h}, ${plane.glass.s}%, 89%, 0.72)`
      : 'rgba(246, 243, 235, 0.24)';
    ctx.stroke();
    ctx.restore();
  }

  _drawArchitecturalSeams(ctx, width, height) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#e8e1d5';
    ctx.lineWidth = 1;
    for (let offset = -height; offset < width + height; offset += Math.max(105, width * 0.14)) {
      ctx.beginPath(); ctx.moveTo(offset, 0); ctx.lineTo(offset - height * 0.58, height); ctx.stroke();
    }
    ctx.restore();
  }

  _roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

export { MATERIALS, REGULAR_ANGLES };
