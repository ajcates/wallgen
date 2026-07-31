import { Style } from '../core/Style.js';
import { mapRange } from '../utils/math.js';

export class GeometricGridStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.shapes = [];
  }

  static get metadata() {
    return [
      { id: 'columns', name: 'Columns', type: 'range', min: 2, max: 20, default: 8 },
      { id: 'rows', name: 'Rows', type: 'range', min: 2, max: 30, default: 12 },
      { id: 'baseSize', name: 'Base Size', type: 'range', min: 5, max: 100, default: 30 },
      { id: 'opacity', name: 'Global Opacity', type: 'range', min: 0.1, max: 1.0, step: 0.1, default: 0.7 },
      { id: 'animationSpeed', name: 'Animation Speed', type: 'range', min: 0, max: 5, step: 0.1, default: 1.0 }
    ];
  }

  async init(data) {
    const cols = this.config.columns || 8;
    const rows = this.config.rows || 12;
    
    this.shapes = data.map((log, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols) % rows;
      
      return {
        col,
        row,
        size: mapRange(log.bp, 0, 100, 0.2, 1.2) * (this.config.baseSize || 30),
        hue: mapRange(log.up % 86400, 0, 86400, 0, 360),
        opacity: mapRange(log.pt % 1000, 0, 1000, 0.3, 0.9) * (this.config.opacity || 0.7),
        sides: Math.max(3, Math.floor(mapRange(log.fm, 0, 100, 3, 8))),
        rotation: (log.mm / 60) * Math.PI * 2
      };
    });
  }

  async process() {
    const speed = this.config.animationSpeed || 1.0;
    this.shapes.forEach((s, i) => {
      s.rotation += 0.02 * speed * (i % 2 === 0 ? 1 : -1);
    });
  }

  render(ctx, width, height) {
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    const cols = this.config.columns || 8;
    const rows = this.config.rows || 12;
    const cellWidth = width / cols;
    const cellHeight = height / rows;

    this.shapes.forEach(s => {
      const centerX = s.col * cellWidth + cellWidth / 2;
      const centerY = s.row * cellHeight + cellHeight / 2;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(s.rotation);
      
      ctx.beginPath();
      ctx.fillStyle = `hsla(${s.hue}, 70%, 60%, ${s.opacity})`;
      
      for (let i = 0; i < s.sides; i++) {
        const angle = (i / s.sides) * Math.PI * 2;
        const x = Math.cos(angle) * s.size;
        const y = Math.sin(angle) * s.size;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      
      ctx.strokeStyle = `hsla(${s.hue}, 70%, 80%, ${s.opacity + 0.1})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.restore();
    });
  }
}
