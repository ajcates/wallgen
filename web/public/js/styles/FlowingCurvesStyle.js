import { Style } from '../core/Style.js';
import { mapRange, randomRange } from '../utils/math.js';

export class FlowingCurvesStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.points = [];
  }

  static get metadata() {
    return [
      { id: 'steps', name: 'Flow Steps', type: 'range', min: 10, max: 100, default: 40 },
      { id: 'caSteps', name: 'CA Iterations', type: 'range', min: 0, max: 20, default: 10 },
      { id: 'curveTightness', name: 'Curve Tightness', type: 'range', min: 0.1, max: 1.0, step: 0.1, default: 0.5 },
      { id: 'lineWidth', name: 'Base Line Width', type: 'range', min: 0.5, max: 5.0, step: 0.1, default: 1.5 },
      { id: 'animationSpeed', name: 'Animation Speed', type: 'range', min: 0, max: 5, step: 0.1, default: 1.0 }
    ];
  }

  async init(data) {
    await super.init(data);
    this.points = data.map(log => {
      const hh = Number(log.hh) || 0;
      const mm = Number(log.mm) || 0;
      const bp = Number(log.bp) || 0;

      return {
        x: mapRange(mm, 0, 60, 0, this.width),
        y: mapRange(hh, 0, 24, 0, this.height),
        hue: mapRange(bp, 0, 100, 200, 360),
        vx: randomRange(-1, 1),
        vy: randomRange(-1, 1),
        history: []
      };
    });
    
    // Run initial "CA" steps
    const iterations = this.config.caSteps || 10;
    for(let i = 0; i < iterations; i++) {
        this.process();
    }
  }

  process() {
    const speed = this.config.animationSpeed || 1.0;
    this.points.forEach(p => {
      p.history.push({x: p.x, y: p.y});
      if (p.history.length > (this.config.steps || 40)) p.history.shift();

      p.x += p.vx * 2 * speed;
      p.y += p.vy * 2 * speed;

      p.x = this.wrapX(p.x);
      p.y = this.wrapY(p.y);

      // Magnetic "CA" like interaction
      this.points.forEach(other => {
        if (p === other) return;
        const d = Math.hypot(p.x - other.x, p.y - other.y);
        if (d < 100) {
          p.vx += (other.x - p.x) * 0.001 * speed;
          p.vy += (other.y - p.y) * 0.001 * speed;
        }
      });
    });
  }

  render(ctx, width, height) {
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, width, height);

    this.points.forEach(p => {
      if (p.history.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(p.history[0].x, p.history[0].y);

      for (let i = 1; i < p.history.length; i++) {
        const p1 = p.history[i-1];
        const p2 = p.history[i];
        
        // Wrap-aware drawing
        if (Math.abs(p1.x - p2.x) > width / 2 || Math.abs(p1.y - p2.y) > height / 2) {
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(p2.x, p2.y);
        } else {
            ctx.lineTo(p2.x, p2.y);
        }
      }

      ctx.shadowBlur = 15;
      ctx.shadowColor = `hsla(${p.hue}, 80%, 60%, 0.5)`;
      ctx.strokeStyle = `hsla(${p.hue}, 80%, 60%, 0.8)`;
      ctx.lineWidth = this.config.lineWidth || 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    });
  }
}
