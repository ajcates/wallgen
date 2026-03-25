import { Style } from '../core/Style.js';
import { randomRange, mapRange } from '../utils/math.js';

/**
 * GlitchStyle: A style that tests data transformation by adding noise
 * to log entries before rendering them as "digital noise" or "glitches".
 */
export class GlitchStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.noiseLevel = config.noiseLevel || 0.2;
  }

  // Override transform to inject noise into data
  async transform(data) {
    return data.map(item => ({
      ...item,
      // Randomly offset time data
      hh: item.hh + (Math.random() - 0.5) * 5 * this.noiseLevel,
      mm: item.mm + (Math.random() - 0.5) * 30 * this.noiseLevel,
      // Randomize values based on noise level
      bp: item.bp * (1 + (Math.random() - 0.5) * this.noiseLevel)
    }));
  }

  render(ctx, width, height) {
    ctx.strokeStyle = '#0f0'; // Retro green
    ctx.lineWidth = 1;

    this.data.forEach(log => {
      const x = this.wrapX(mapRange(log.mm, -30, 90, 0, width));
      const y = this.wrapY(mapRange(log.hh, -5, 30, 0, height));
      const size = mapRange(log.bp, 0, 100, 1, 50);

      // Draw horizontal glitch lines
      ctx.beginPath();
      ctx.moveTo(x - size, y);
      ctx.lineTo(x + size, y);
      ctx.stroke();

      // Draw occasional vertical "data spike"
      if (Math.random() < 0.1) {
          ctx.beginPath();
          ctx.moveTo(x, y - size * 2);
          ctx.lineTo(x, y + size * 2);
          ctx.stroke();
      }
    });
  }
}
