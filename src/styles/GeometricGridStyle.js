import { Style } from '../core/Style.js';
import { mapRange } from '../utils/math.js';

/**
 * GeometricGridStyle: A style that maps log entries to a grid of shapes.
 */
export class GeometricGridStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.columns = config.columns || 8;
    this.rows = config.rows || 12;
    this.padding = config.padding || 10;
    this.shapes = [];
  }

  async init(data) {
    super.init(data);
    this._processData(data);
  }

  _processData(data) {
    // Map data entries to grid cells
    this.shapes = data.map((log, index) => {
      // Use index or time to find grid position
      const col = index % this.columns;
      const row = Math.floor(index / this.columns) % this.rows;
      
      return {
        col,
        row,
        size: mapRange(log.bp, 0, 100, 5, 40),
        hue: mapRange(log.up, 0, 86400, 0, 360),
        opacity: mapRange(log.pt, 0, 1000, 0.3, 0.9),
        sides: Math.floor(mapRange(log.fm, 0, 100, 3, 8)),
        rotation: (log.mm / 60) * Math.PI * 2
      };
    });
  }

  render(ctx, width, height) {
    const cellWidth = width / this.columns;
    const cellHeight = height / this.rows;

    this.shapes.forEach(s => {
      const centerX = s.col * cellWidth + cellWidth / 2;
      const centerY = s.row * cellHeight + cellHeight / 2;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(s.rotation);
      
      ctx.beginPath();
      ctx.fillStyle = `hsla(${s.hue}, 70%, 60%, ${s.opacity})`;
      
      // Draw a polygon with 's.sides'
      if (s.sides <= 3) {
          // Circle for low sides
          ctx.arc(0, 0, s.size, 0, Math.PI * 2);
      } else {
          // Polygon
          for (let i = 0; i < s.sides; i++) {
            const angle = (i / s.sides) * Math.PI * 2;
            const x = Math.cos(angle) * s.size;
            const y = Math.sin(angle) * s.size;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
      }
      
      ctx.fill();
      
      // Add a subtle border
      ctx.strokeStyle = `hsla(${s.hue}, 70%, 80%, ${s.opacity + 0.1})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.restore();
    });
  }
}
