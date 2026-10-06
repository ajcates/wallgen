import { Style } from '../core/Style.js';

const TAU = Math.PI * 2;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

const createRandom = (seed) => {
  let state = seed >>> 0 || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const range = (random, minimum, maximum) => minimum + random() * (maximum - minimum);

/**
 * LaserLiquidSmokeStyle: an AMOLED sky where dense, oil-like smoke banks
 * refract a few deliberately placed cyan, magenta, and lime laser beams.
 * Geometry is generated once in init, keeping each render to a bounded number
 * of Canvas primitives instead of an expensive per-pixel fluid simulation.
 */
export class LaserLiquidSmokeStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.smokePuffs = [];
    this.ribbons = [];
    this.lasers = [];
    this.prisms = [];
    this.stars = [];
    this.grain = [];
  }

  async init(data) {
    await super.init(data);
    const latest = data?.at(-1) || { hh: 22, mm: 14, bp: 72, fm: 58, up: 3600, pt: 60 };
    const seed = this.config.seed ?? this._seedFromEntry(latest);
    const random = createRandom(seed);

    this._generateSmoke(random, latest);
    this._generateRibbons(random);
    this._generateLasers(random, latest);
    this._generateStars(random);
    this._generateGrain(random);
  }

  async process() {}

  _seedFromEntry(entry) {
    const clock = (entry.hh || 0) * 60 + (entry.mm || 0);
    return (clock * 1000003 + (entry.bp || 0) * 7919 + (entry.fm || 0) * 257 + (entry.up || 0) + (entry.pt || 0)) >>> 0;
  }

  _generateSmoke(random, latest) {
    const density = clamp(Math.round(14 + (latest.fm || 50) / 11), 17, 23);
    const banks = [
      { x: 0.22, y: 0.24, hue: 250, span: 0.72, rise: -0.16, layer: 'far' },
      { x: 0.7, y: 0.48, hue: 316, span: 0.8, rise: 0.13, layer: 'mid' },
      { x: 0.34, y: 0.77, hue: 206, span: 0.86, rise: -0.1, layer: 'front' }
    ];
    this.smokePuffs = [];

    for (const bank of banks) {
      for (let index = 0; index < density; index++) {
        const progress = density === 1 ? 0.5 : index / (density - 1);
        const drift = Math.sin(progress * TAU * 1.42 + bank.hue) * 0.07;
        const wobble = Math.sin(progress * TAU * 2.7 + bank.hue * 0.03) * 0.045;
        const x = (bank.x + (progress - 0.5) * bank.span + drift + range(random, -0.055, 0.055)) * this.width;
        const y = (bank.y + (progress - 0.5) * bank.rise + wobble + range(random, -0.045, 0.045)) * this.height;
        const depth = bank.layer === 'far' ? 0.76 : bank.layer === 'mid' ? 1 : 1.18;
        const size = Math.min(this.width, this.height) * range(random, 0.16, 0.3) * depth;

        this.smokePuffs.push({
          x,
          y,
          size,
          hue: (bank.hue + range(random, -20, 24) + 360) % 360,
          alpha: range(random, 0.032, 0.075) * (bank.layer === 'far' ? 0.7 : 1),
          aspect: range(random, 0.38, 0.7),
          rotation: range(random, -0.75, 0.75),
          layer: bank.layer
        });
      }
    }
  }

  _generateRibbons(random) {
    const shortSide = Math.min(this.width, this.height);
    this.ribbons = Array.from({ length: 7 }, (_, index) => {
      const fromLeft = index % 2 === 0;
      const y = range(random, 0.1, 0.9) * this.height;
      const bend = range(random, -0.18, 0.18) * this.height;
      return {
        x0: fromLeft ? -shortSide * 0.18 : this.width + shortSide * 0.18,
        y0: y,
        x1: this.width * range(random, 0.2, 0.4),
        y1: y + bend,
        x2: this.width * range(random, 0.58, 0.8),
        y2: y - bend * 0.72,
        x3: fromLeft ? this.width + shortSide * 0.18 : -shortSide * 0.18,
        y3: y + bend * 0.28,
        hue: [204, 266, 314][index % 3],
        alpha: range(random, 0.05, 0.12),
        width: range(random, 0.8, 2.1) * Math.max(1, shortSide / 540)
      };
    });
  }

  _generateLasers(random, latest) {
    const shortSide = Math.min(this.width, this.height);
    const energy = clamp((latest.bp || 50) / 100, 0.35, 1);
    const colors = [190, 320, 84, 262];
    this.lasers = colors.map((hue, index) => ({
      hue,
      angle: -0.7 + index * 0.18 + range(random, -0.035, 0.035),
      offset: (index - 1.5) * shortSide * 0.16 + range(random, -shortSide * 0.045, shortSide * 0.045),
      coreWidth: Math.max(1.15, shortSide * 0.0031),
      bloomWidth: shortSide * range(random, 0.055, 0.09),
      alpha: (0.7 + energy * 0.28) * range(random, 0.86, 1),
      flareX: range(random, 0.26, 0.76)
    }));

    this.prisms = this.lasers.slice(0, 3).map((laser, index) => ({
      x: this.width * (0.3 + index * 0.2) + Math.cos(laser.angle + Math.PI / 2) * laser.offset * 0.18,
      y: this.height * (0.33 + index * 0.16) + Math.sin(laser.angle + Math.PI / 2) * laser.offset * 0.18,
      hue: laser.hue,
      radius: shortSide * range(random, 0.11, 0.18)
    }));
  }

  _generateStars(random) {
    const total = Math.round((this.width * this.height) / 11000);
    this.stars = Array.from({ length: clamp(total, 42, 105) }, () => ({
      x: random() * this.width,
      y: random() * this.height,
      radius: range(random, 0.35, 1.25),
      alpha: range(random, 0.12, 0.6),
      hue: random() > 0.72 ? 190 : 235
    }));
  }

  _generateGrain(random) {
    const total = clamp(Math.round((this.width * this.height) / 9000), 70, 180);
    this.grain = Array.from({ length: total }, () => ({
      x: random() * this.width,
      y: random() * this.height,
      alpha: range(random, 0.018, 0.055)
    }));
  }

  render(ctx, width, height) {
    this._drawBackdrop(ctx, width, height);
    this._drawStars(ctx);
    this._drawSmoke(ctx, 'far');
    this._drawLiquidRibbons(ctx);
    this._drawSmoke(ctx, 'mid');
    this._drawLasers(ctx, width, height);
    this._drawPrisms(ctx);
    this._drawSmoke(ctx, 'front');
    this._drawGrain(ctx);
    this._drawVignette(ctx, width, height);
  }

  _drawBackdrop(ctx, width, height) {
    ctx.fillStyle = '#010104';
    ctx.fillRect(0, 0, width, height);
    const sky = ctx.createRadialGradient(width * 0.5, height * 0.42, 0, width * 0.5, height * 0.42, Math.max(width, height) * 0.78);
    sky.addColorStop(0, '#11103a');
    sky.addColorStop(0.42, '#080823');
    sky.addColorStop(1, '#010104');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
  }

  _drawStars(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const star of this.stars) {
      ctx.fillStyle = `hsla(${star.hue}, 68%, 88%, ${star.alpha})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawSmoke(ctx, layer) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const puff of this.smokePuffs) {
      if (puff.layer !== layer) continue;
      ctx.save();
      ctx.translate(puff.x, puff.y);
      ctx.rotate(puff.rotation);
      ctx.scale(1, puff.aspect);
      const cloud = ctx.createRadialGradient(-puff.size * 0.16, -puff.size * 0.12, puff.size * 0.04, 0, 0, puff.size);
      cloud.addColorStop(0, `hsla(${puff.hue}, 90%, 67%, ${puff.alpha})`);
      cloud.addColorStop(0.32, `hsla(${(puff.hue + 24) % 360}, 84%, 48%, ${puff.alpha * 0.78})`);
      cloud.addColorStop(0.7, `hsla(${(puff.hue + 320) % 360}, 76%, 28%, ${puff.alpha * 0.28})`);
      cloud.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = cloud;
      ctx.beginPath();
      ctx.arc(0, 0, puff.size, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  _drawLiquidRibbons(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';
    for (const ribbon of this.ribbons) {
      ctx.beginPath();
      ctx.moveTo(ribbon.x0, ribbon.y0);
      ctx.bezierCurveTo(ribbon.x1, ribbon.y1, ribbon.x2, ribbon.y2, ribbon.x3, ribbon.y3);
      ctx.strokeStyle = `hsla(${ribbon.hue}, 86%, 62%, ${ribbon.alpha})`;
      ctx.lineWidth = ribbon.width * 3.8;
      ctx.stroke();
      ctx.strokeStyle = `hsla(${(ribbon.hue + 25) % 360}, 92%, 78%, ${ribbon.alpha * 0.85})`;
      ctx.lineWidth = ribbon.width;
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawLasers(ctx, width, height) {
    const reach = Math.hypot(width, height) * 0.84;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';
    for (const laser of this.lasers) {
      const perpendicular = laser.angle + Math.PI / 2;
      const centerX = width * 0.5 + Math.cos(perpendicular) * laser.offset;
      const centerY = height * 0.5 + Math.sin(perpendicular) * laser.offset;
      const dx = Math.cos(laser.angle) * reach;
      const dy = Math.sin(laser.angle) * reach;
      const startX = centerX - dx;
      const startY = centerY - dy;
      const endX = centerX + dx;
      const endY = centerY + dy;

      ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY);
      ctx.strokeStyle = `hsla(${laser.hue}, 100%, 58%, ${0.05 * laser.alpha})`;
      ctx.lineWidth = laser.bloomWidth;
      ctx.stroke();
      ctx.strokeStyle = `hsla(${laser.hue}, 100%, 70%, ${0.23 * laser.alpha})`;
      ctx.lineWidth = laser.bloomWidth * 0.17;
      ctx.stroke();
      ctx.strokeStyle = `hsla(${laser.hue}, 100%, 94%, ${laser.alpha})`;
      ctx.lineWidth = laser.coreWidth;
      ctx.stroke();

      const flareX = startX + (endX - startX) * laser.flareX;
      const flareY = startY + (endY - startY) * laser.flareX;
      ctx.beginPath();
      ctx.arc(flareX, flareY, laser.bloomWidth * 0.1, 0, TAU);
      ctx.fillStyle = `hsla(${laser.hue}, 100%, 84%, ${0.3 * laser.alpha})`;
      ctx.fill();
    }
    ctx.restore();
  }

  _drawPrisms(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const prism of this.prisms) {
      const halo = ctx.createRadialGradient(prism.x, prism.y, 0, prism.x, prism.y, prism.radius);
      halo.addColorStop(0, `hsla(${prism.hue}, 100%, 76%, 0.3)`);
      halo.addColorStop(0.2, `hsla(${(prism.hue + 96) % 360}, 100%, 66%, 0.13)`);
      halo.addColorStop(0.54, `hsla(${(prism.hue + 190) % 360}, 95%, 58%, 0.045)`);
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(prism.x, prism.y, prism.radius, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawGrain(ctx) {
    ctx.save();
    for (const dot of this.grain) {
      ctx.fillStyle = `rgba(190, 201, 255, ${dot.alpha})`;
      ctx.fillRect(dot.x, dot.y, 1, 1);
    }
    ctx.restore();
  }

  _drawVignette(ctx, width, height) {
    const vignette = ctx.createRadialGradient(width * 0.5, height * 0.48, Math.min(width, height) * 0.2, width * 0.5, height * 0.48, Math.max(width, height) * 0.74);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.62, 'rgba(0, 0, 0, 0.08)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.72)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }
}
