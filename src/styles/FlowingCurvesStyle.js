import { Style } from '../core/Style.js';
import { mapRange, distance } from '../utils/math.js';

export class FlowingCurvesStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.stepsPerSegment = config.stepsPerSegment || 100;
    this.caSteps = config.caSteps || 10;
    this.curves = [];
    this.allNodes = [];
  }

  async init(data) {
    await super.init(data);
    this._generateContinuousRibbon(data);
    this.allNodes = this.curves.flatMap(c => c.points);
  }

  _generateContinuousRibbon(data) {
    if (data.length === 0) return;

    // The very first entry seeds the starting position based on its time
    const first = data[0];
    let currentX = mapRange(first.mm, 0, 60, 0, this.width);
    let currentY = mapRange(first.hh, 0, 24, 0, this.height);

    this.curves = data.map((log, index) => {
      const segment = this._segmentFromLog(log, currentX, currentY, index);
      // Update anchor for the next segment
      const lastPoint = segment.points[segment.points.length - 1];
      currentX = lastPoint.x;
      currentY = lastPoint.y;
      
      // Screen wrapping
      currentX = this.wrapX(currentX);
      currentY = this.wrapY(currentY);
      
      return segment;
    });
  }

  _segmentFromLog({ hh, mm, bp, fm, up, pt }, startX, startY, index) {
    // Angle determined by time (0 to 2*PI)
    const angle = mapRange(hh + (mm / 60), 0, 24, 0, Math.PI * 2);
    
    // Length determined by uptime (0 to 24h+ scaled to pixels)
    const length = mapRange(Math.min(up, 172800), 0, 172800, 200, 1500);

    // Curvature (amount of curve) based on memory usage (inverse of free memory)
    const amplitude = mapRange(fm, 0, 100, 300, 20); // Less free memory = more curve
    const frequency = mapRange(fm, 0, 100, 0.03, 0.005);

    const baseLineWidth = mapRange(bp, 0, 100, 4, 18);
    const baseHue = mapRange(bp, 0, 100, 0, 240); 

    const points = Array.from({ length: this.stepsPerSegment }, (_, i) => {
      const t = i / (this.stepsPerSegment - 1);
      const dist = t * length;
      
      // Path along the time-angle
      const baseX = startX + Math.cos(angle) * dist;
      const baseY = startY + Math.sin(angle) * dist;
      
      // Wiggle perpendicular to the travel angle
      const wiggleAngle = angle + Math.PI / 2;
      const drift = Math.sin(i * frequency + index) * amplitude;
      
      const x = this.wrapX(baseX + Math.cos(wiggleAngle) * drift);
      const y = this.wrapY(baseY + Math.sin(wiggleAngle) * drift);

      // Tapering
      const taper = Math.sin(t * Math.PI); 
      const lineWidth = baseLineWidth * (0.5 + taper * 0.5);

      return { 
        x, y, 
        alpha: taper,
        lineWidth, 
        colorHue: baseHue,
        neighborRadius: 40,
        vx: 0, vy: 0
      };
    });

    return { points };
  }

  async process() {
    for (let i = 0; i < this.caSteps; i++) {
      this.allNodes = this._caStep(this.allNodes);
    }
  }

  _caStep(nodes) {
    return nodes.map(node => {
      const neighbors = nodes.filter(
        n => n !== node && distance(n, node) < node.neighborRadius
      );
      const force = neighbors.reduce(
        (acc, n) => {
          const d = distance(n, node);
          const strength = (node.neighborRadius - d) / node.neighborRadius;
          acc.vx += (n.x - node.x) * 0.005 * strength;
          acc.vy += (n.y - node.y) * 0.005 * strength;
          return acc;
        },
        { vx: 0, vy: 0 }
      );

      return { 
        ...node, 
        vx: (node.vx + force.vx) * 0.95,
        vy: (node.vy + force.vy) * 0.95,
        x: this.wrapX(node.x + node.vx), 
        y: this.wrapY(node.y + node.vy), 
        alpha: node.alpha * 0.99 
      };
    });
  }

  render(ctx, width, height) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    this.curves.forEach(curve => {
      const pts = curve.points;
      if (pts.length < 3) return;

      const baseHue = pts[0].colorHue;
      const baseWidth = Math.max(...pts.map(p => p.lineWidth));

      // --- Ribbon Rendering ---
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = `hsla(${baseHue}, 100%, 50%, 0.15)`;
      ctx.lineWidth = baseWidth * 3;
      this._drawPath(ctx, pts);

      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `hsla(${baseHue}, 100%, 55%, 0.9)`;
      ctx.lineWidth = baseWidth;
      this._drawPath(ctx, pts);

      ctx.strokeStyle = `hsla(${(baseHue + 10) % 360}, 100%, 85%, 0.8)`;
      ctx.lineWidth = baseWidth * 0.3;
      this._drawPath(ctx, pts);
    });

    // Suble high-intensity dust
    ctx.globalCompositeOperation = 'lighter';
    this.allNodes.forEach(n => {
      if (n.alpha < 0.2 || Math.random() > 0.05) return;
      ctx.fillStyle = `hsla(${n.colorHue}, 100%, 95%, ${n.alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalCompositeOperation = 'source-over';
  }

  _drawPath(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];

        // If points jump across the screen due to wrapping, break the path
        const dx = Math.abs(p2.x - p1.x);
        const dy = Math.abs(p2.y - p1.y);
        
        if (dx > this.width / 2 || dy > this.height / 2) {
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(p2.x, p2.y);
        } else {
          const xc = (p1.x + p2.x) / 2;
          const yc = (p1.y + p2.y) / 2;
          ctx.quadraticCurveTo(p1.x, p1.y, xc, yc);
        }
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  }
}
