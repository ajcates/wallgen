import { Style } from '../core/Style.js';
import { EFFECT_NAMES, applyDnaChain } from './symmetry/DnaModules.js';

/**
 * SymmetryStyle deliberately has no fixed visual signature beyond rotational
 * symmetry. A seed chooses a complete art direction, rather than merely
 * recolouring one mandala recipe.
 */
export class SymmetryStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.family = null;
    this.symmetry = 8;
    this.seed = 1;
    this.palette = [];
    this.background = '#090912';
    this.motifs = [];
    this.dna = null;
  }

  async init(data) {
    await super.init(data);
    const latest = data?.[data.length - 1] || {};
    const dataSeed = this._seedFrom(latest, data?.length || 0);
    // A generation is intentionally a new composition even if it is rendered
    // twice from an unchanged log. Pass --seed when a repeatable result is wanted.
    this.seed = Number.isFinite(Number(this.config.seed))
      ? Number(this.config.seed) >>> 0
      : (dataSeed ^ Math.floor(Math.random() * 4294967296)) >>> 0;
    const rng = this._rng(this.seed);
    const families = [
      'stained-glass', 'neon-wire', 'paper-cut', 'celestial-ink',
      'chrome-op-art', 'botanical', 'crystal-mosaic', 'desert-weave'
    ];
    this.family = this.config.family || families[Math.floor(rng() * families.length)];
    this.symmetry = this.config.symmetry || [4, 5, 6, 7, 8, 9, 10, 12, 14, 16][Math.floor(rng() * 10)];
    this._createArtDirection(rng);
    this._createMotifs(rng);
  }

  _seedFrom(entry, length) {
    const values = [entry.up, entry.bp, entry.fm, entry.pt, entry.hh, entry.mm, length];
    return values.reduce((seed, value, index) => ((seed * 1664525) + (Number(value) || 0) * (index + 11) + 1013904223) >>> 0, 2166136261);
  }

  _rng(seed) {
    let state = seed || 1;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  _createArtDirection(rng) {
    const hue = Math.floor(rng() * 360);
    const palettes = {
      'stained-glass': { bg: `hsl(${(hue + 220) % 360} 35% 8%)`, colors: [[hue, 82, 58], [(hue + 75) % 360, 78, 55], [(hue + 175) % 360, 72, 54], [(hue + 255) % 360, 82, 63]], treatment: 'glass' },
      'neon-wire': { bg: `hsl(${(hue + 190) % 360} 48% 5%)`, colors: [[hue, 100, 63], [(hue + 120) % 360, 100, 60], [(hue + 210) % 360, 100, 66], [0, 0, 96]], treatment: 'neon' },
      'paper-cut': { bg: `hsl(${hue} 22% 16%)`, colors: [[hue, 48, 68], [(hue + 35) % 360, 52, 57], [(hue + 170) % 360, 43, 62], [(hue + 215) % 360, 35, 46]], treatment: 'paper' },
      'celestial-ink': { bg: '#070815', colors: [[hue, 82, 67], [(hue + 45) % 360, 90, 70], [(hue + 180) % 360, 50, 76], [0, 0, 94]], treatment: 'ink' },
      'chrome-op-art': { bg: `hsl(${hue} 15% 10%)`, colors: [[hue, 14, 82], [(hue + 25) % 360, 10, 42], [(hue + 190) % 360, 25, 64], [(hue + 300) % 360, 58, 58]], treatment: 'chrome' },
      'botanical': { bg: `hsl(${(hue + 180) % 360} 35% 10%)`, colors: [[hue, 62, 52], [(hue + 35) % 360, 74, 61], [(hue + 145) % 360, 48, 47], [(hue + 210) % 360, 65, 70]], treatment: 'botanical' },
      'crystal-mosaic': { bg: `hsl(${(hue + 210) % 360} 42% 9%)`, colors: [[hue, 82, 62], [(hue + 65) % 360, 83, 60], [(hue + 145) % 360, 72, 57], [(hue + 245) % 360, 76, 68]], treatment: 'crystal' },
      'desert-weave': { bg: `hsl(${(hue + 25) % 360} 38% 13%)`, colors: [[hue, 68, 56], [(hue + 28) % 360, 78, 64], [(hue + 180) % 360, 47, 57], [(hue + 220) % 360, 45, 72]], treatment: 'weave' }
    };
    const direction = palettes[this.family] || palettes['stained-glass'];
    this.background = direction.bg;
    this.treatment = direction.treatment;
    this.palette = direction.colors.map(([h, s, l]) => `hsl(${h} ${s}% ${l}%)`);
  }

  _createMotifs(rng) {
    const radius = Math.min(this.width, this.height) * 0.47;
    const kinds = this.treatment === 'botanical' ? ['leaf', 'petal', 'vine']
      : this.treatment === 'weave' ? ['ribbon', 'diamond', 'arc']
        : this.treatment === 'neon' ? ['ray', 'arc', 'orb']
          : this.treatment === 'crystal' || this.treatment === 'glass' ? ['diamond', 'shard', 'star']
            : ['petal', 'diamond', 'arc', 'star', 'ray'];
    const count = 5 + Math.floor(rng() * 8);
    const baseMotifs = Array.from({ length: count }, (_, index) => ({
      kind: kinds[Math.floor(rng() * kinds.length)],
      radius: radius * (0.11 + index / (count + 1) * 0.87),
      size: radius * (0.045 + rng() * 0.13),
      stretch: 0.45 + rng() * 1.25,
      colorIndex: Math.floor(rng() * this.palette.length),
      color: null,
      rotation: (rng() > 0.5 ? 0 : 0.5) * (Math.PI * 2 / this.symmetry),
      detail: rng(),
      signal: rng(),
      surface: 'solid'
    }));
    baseMotifs.forEach(motif => { motif.color = this.palette[motif.colorIndex]; });
    const effects = this._buildDnaChain(rng);
    this.dna = {
      seed: this.seed,
      family: this.family,
      symmetry: this.symmetry,
      shapes: kinds,
      effects: effects.map(({ name, strength, phase }) => ({ name, strength, phase }))
    };
    this.motifs = applyDnaChain(baseMotifs, effects, {
      palette: this.palette,
      shapes: kinds,
      sectorAngle: Math.PI * 2 / this.symmetry
    });
  }

  _buildDnaChain(rng) {
    const requested = typeof this.config.effects === 'string'
      ? this.config.effects.split(',').map(name => name.trim()).filter(name => EFFECT_NAMES.includes(name))
      : null;
    const names = requested?.length ? requested : [...EFFECT_NAMES]
      .sort(() => rng() - 0.5)
      .slice(0, 3 + Math.floor(rng() * 5));
    return names.map(name => ({ name, strength: 0.35 + rng() * 0.65, phase: rng() * Math.PI * 2 }));
  }

  render(ctx, width, height) {
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2);
    this._drawConcentricField(ctx, Math.min(width, height) * 0.5);
    for (const motif of this.motifs) {
      for (let sector = 0; sector < this.symmetry; sector++) {
        ctx.save();
        ctx.rotate(sector * Math.PI * 2 / this.symmetry + motif.rotation);
        this._drawMotif(ctx, motif);
        ctx.restore();
      }
    }
    this._drawCenter(ctx);
    ctx.restore();
  }

  _drawConcentricField(ctx, maxRadius) {
    ctx.save();
    if (this.treatment === 'ink') {
      ctx.strokeStyle = 'rgba(190, 210, 255, 0.11)';
      ctx.setLineDash([2, 9]);
    } else if (this.treatment === 'chrome') {
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    }
    for (let radius = maxRadius * 0.16; radius < maxRadius; radius += maxRadius / 9) {
      ctx.lineWidth = this.treatment === 'neon' ? 1.5 : 1;
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  _drawMotif(ctx, motif) {
    const { kind, radius, size, stretch, color, detail, surface } = motif;
    ctx.save();
    this._applyTreatment(ctx, motif);
    this._path(ctx, kind, radius, size, stretch);
    if (this.treatment === 'glass' || this.treatment === 'crystal') {
      const gradient = ctx.createLinearGradient(-size, radius - size, size, radius + size);
      gradient.addColorStop(0, 'rgba(255,255,255,0.9)'); gradient.addColorStop(0.22, color); gradient.addColorStop(1, 'rgba(0,0,0,0.32)');
      ctx.fillStyle = gradient;
    } else if (this.treatment === 'chrome') {
      const gradient = ctx.createLinearGradient(0, radius - size, 0, radius + size * stretch);
      gradient.addColorStop(0, '#fff'); gradient.addColorStop(0.24, color); gradient.addColorStop(0.55, '#15151b'); gradient.addColorStop(1, '#d9e0e6');
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = color;
    }
    if (surface !== 'outline') ctx.fill();
    ctx.strokeStyle = this.treatment === 'neon' ? color : 'rgba(255,255,255,0.45)';
    ctx.lineWidth = this.treatment === 'neon' ? 1.4 : 0.8;
    ctx.stroke();
    if (surface === 'cutout') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 0.42;
      ctx.fill();
    }
    if (surface === 'hatch') {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = Math.max(0.75, size * 0.035);
      for (let offset = -size; offset < size; offset += Math.max(3, size * 0.22)) {
        ctx.beginPath(); ctx.moveTo(-size, radius + offset); ctx.lineTo(size, radius + offset - size * 0.7); ctx.stroke();
      }
    }
    if (detail > 0.42) {
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = Math.max(1, size * 0.07);
      ctx.beginPath(); ctx.moveTo(0, radius - size * 0.2); ctx.lineTo(0, radius + size * stretch * 0.72); ctx.stroke();
    }
    ctx.restore();
  }

  _applyTreatment(ctx, motif) {
    if (this.treatment === 'neon') { ctx.shadowColor = motif.color; ctx.shadowBlur = 15; ctx.globalCompositeOperation = 'screen'; }
    // Keep shadows centered: a directional offset would be the one asymmetric
    // thing in an otherwise rotationally identical sector copy.
    if (this.treatment === 'paper') { ctx.shadowColor = 'rgba(0,0,0,0.58)'; ctx.shadowBlur = 7; }
    if (this.treatment === 'ink') { ctx.globalAlpha = 0.78; ctx.shadowColor = 'rgba(90, 160, 255, 0.45)'; ctx.shadowBlur = 4; }
    if (this.treatment === 'weave') { ctx.globalAlpha = 0.84; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4; }
  }

  _path(ctx, kind, radius, size, stretch) {
    ctx.beginPath();
    if (kind === 'arc') {
      ctx.lineWidth = size * 0.55; ctx.arc(0, 0, radius, -0.22, 0.22); ctx.stroke(); return;
    }
    if (kind === 'ray') { ctx.moveTo(-size * 0.18, radius - size); ctx.lineTo(size * 0.18, radius - size); ctx.lineTo(size * 0.38, radius + size * stretch); ctx.lineTo(-size * 0.38, radius + size * stretch); ctx.closePath(); return; }
    if (kind === 'orb') { ctx.arc(0, radius, size * 0.48, 0, Math.PI * 2); return; }
    if (kind === 'diamond' || kind === 'shard') { ctx.moveTo(0, radius - size); ctx.lineTo(size * 0.62, radius); ctx.lineTo(0, radius + size * stretch); ctx.lineTo(-size * 0.62, radius); ctx.closePath(); return; }
    if (kind === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? size * 0.42 : size; const x = Math.cos(a) * r; const y = radius + Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); return; }
    if (kind === 'vine') { ctx.lineWidth = Math.max(1, size * 0.13); ctx.moveTo(0, radius - size); ctx.bezierCurveTo(size, radius - size * 0.4, -size, radius + size * 0.4, 0, radius + size * stretch); ctx.stroke(); return; }
    ctx.moveTo(0, radius - size); ctx.bezierCurveTo(size * stretch, radius - size * 0.35, size * 0.68, radius + size * 0.5, 0, radius + size * stretch); ctx.bezierCurveTo(-size * 0.68, radius + size * 0.5, -size * stretch, radius - size * 0.35, 0, radius - size); ctx.closePath();
  }

  _drawCenter(ctx) {
    const radius = Math.min(this.width, this.height) * 0.065;
    const gradient = ctx.createRadialGradient(0, 0, 1, 0, 0, radius);
    gradient.addColorStop(0, '#fff'); gradient.addColorStop(0.22, this.palette[0]); gradient.addColorStop(1, this.palette[2]);
    ctx.fillStyle = gradient; ctx.shadowColor = this.palette[0]; ctx.shadowBlur = this.treatment === 'neon' ? 22 : 7;
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke();
  }
}
