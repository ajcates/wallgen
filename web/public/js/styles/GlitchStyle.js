import { Style } from '../core/Style.js';
import { mapRange, randomRange } from '../utils/math.js';

export class GlitchStyle extends Style {
  constructor(config = {}) {
    super(config);
  }

  static get metadata() {
    return [
      { id: 'noiseLevel', name: 'Noise Level', type: 'range', min: 0, max: 1.0, step: 0.1, default: 0.5 },
      { id: 'scanlines', name: 'Scanline Intensity', type: 'range', min: 0, max: 0.5, step: 0.05, default: 0.1 },
      { id: 'colorShift', name: 'RGB Shift', type: 'range', min: 0, max: 50, default: 10 },
      { id: 'animationSpeed', name: 'Animation Speed', type: 'range', min: 0, max: 5, step: 0.1, default: 1.0 }
    ];
  }

  process() {
    const speed = this.config.animationSpeed || 1.0;
    if (Math.random() < 0.1 * speed) {
        this.glitchOffset = (Math.random() - 0.5) * 20 * speed;
    } else {
        this.glitchOffset *= 0.9;
    }
  }

  async transform(data) {
    const noise = this.config.noiseLevel || 0.5;
    return data.map(log => ({
      ...log,
      hh: log.hh + (Math.random() - 0.5) * noise,
      mm: log.mm + (Math.random() - 0.5) * noise * 5
    }));
  }

  render(ctx, width, height) {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, width, height);

    const shift = (this.config.colorShift || 10) + (this.glitchOffset || 0);
  ...
    this.data.forEach((log, i) => {
      const y = mapRange(log.hh % 24, 0, 24, 0, height);
      const x = mapRange(log.mm % 60, 0, 60, 0, width);
      const h = 20 + Math.random() * 50;

      // RGB Split effect
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.fillRect(x - shift, y, width * 0.8, h);
      ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
      ctx.fillRect(x + shift, y, width * 0.8, h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(x, y, width * 0.8, h);
    });

    // Scanlines
    const scanlineInt = this.config.scanlines || 0.1;
    ctx.fillStyle = `rgba(0, 0, 0, ${scanlineInt})`;
    for (let i = 0; i < height; i += 4) {
      ctx.fillRect(0, i, width, 2);
    }
  }
}
