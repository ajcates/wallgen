import { Style } from '../core/Style.js';
import { mapRange, randomRange } from '../utils/math.js';

/**
 * ZigZagFractalStyle: A variant of FractalGeometryStyle that uses 
 * sharp zig-zag paths instead of smooth curves.
 * 
 * Update: Warped into a double helix and twisted into a galaxy shape.
 */
export class ZigZagFractalStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.mandalaNodes = [];
    this.speckles = [];
  }

  async init(data) {
    await super.init(data);
    this._generateMandala(data);
  }

  _generateMandala(data) {
    const margin = 200;
    this.mandalaNodes = data.map((log, index) => {
      const hh = Number(log.hh) || 0;
      const mm = Number(log.mm) || 0;
      const bp = Number(log.bp) || 0;
      const pt = Number(log.pt) || 0;
      const fm = Number(log.fm) || 0;

      // Layout: Vertical Double Helix
      const progress = (hh + mm / 60) / 24;
      const y = mapRange(progress, 0, 1, margin, this.height - margin);
      
      const strand = index % 2;
      const helixAngle = progress * Math.PI * 5; // 2.5 turns
      const strandOffset = (strand === 0 ? 0 : Math.PI);
      
      const helixRadius = this.width * 0.28;
      const x = (this.width / 2) + Math.cos(helixAngle + strandOffset) * helixRadius;
      
      const depth = Math.max(1, Math.min(4, Math.floor(mapRange(bp, 0, 100, 2, 4))));
      const spokes = Math.max(1, Math.min(6, Math.floor(mapRange(pt % 200, 0, 200, 3, 6))));
      const angleStep = (Math.PI * 2) / spokes;
      
      const nodeHue = Math.random() * 360;

      const scale = mapRange(bp, 0, 100, 0.9, 1.4);
      
      const reverseIndex = (data.length - 1) - index; 
      let opacity = 0;
      if (reverseIndex < 12) {
        opacity = 0.9;
      } else if (reverseIndex < 20) {
        opacity = mapRange(reverseIndex, 12, 20, 0.9, 0);
      }
      
      return {
        x: x || 0,
        y: y || 0,
        depth,
        spokes,
        angleStep,
        baseHue: nodeHue,
        scale,
        lineWidth: Math.max(0.1, mapRange(fm, 0, 100, 1.8, 0.4)),
        fm, // store free memory for zig-zag frequency
        pt, // store ping for zig-zag amplitude
        opacity: Math.max(0, Math.min(1, opacity)),
        rotation: randomRange(0, Math.PI * 2),
        branchAngle: mapRange(hh + mm / 60, 0, 24, Math.PI / 10, Math.PI / 3)
      };
    });
  }

  render(ctx, width, height) {
    ctx.fillStyle = '#010102';
    ctx.fillRect(0, 0, width, height);

    this.speckles = [];

    this.mandalaNodes.forEach((node) => {
        if (node.opacity <= 0.01) return;
        ctx.save();
        ctx.globalAlpha = node.opacity;
        
        for (let i = 0; i < node.spokes; i++) {
            const startAngle = node.rotation + (i * node.angleStep) - Math.PI / 2;
            this._drawRecursiveBranch(ctx, node.x, node.y, 380 * node.scale, startAngle, node.depth, node);
        }
        ctx.restore();
    });

    // Render Galaxy Dust (speckles)
    ctx.globalCompositeOperation = 'lighter';
    this.speckles.forEach(s => {
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x, s.y, s.size, s.size);
    });

    // Ambient Dust
    for(let i=0; i<300; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const s = Math.random() * 1.5;
        const h = Math.random() * 360;
        const twisted = this._twist(x, y);
        ctx.fillStyle = `hsla(${h}, 100%, 70%, 0.15)`;
        ctx.fillRect(twisted.x, twisted.y, s, s);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  _twist(x, y) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Logarithmic Spiral Distortion (Galaxy Shape)
    const angle = Math.log(dist + 1) * 3.5 + (dist / this.width) * 2.0;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    
    return {
        x: cx + dx * cosA - dy * sinA,
        y: cy + dx * sinA + dy * cosA
    };
  }

  _drawRecursiveBranch(ctx, x, y, length, angle, depth, config) {
    if (depth <= 0 || length < 5) return;

    const x2 = x + Math.cos(angle) * length;
    const y2 = y + Math.sin(angle) * length;
    
    if (isNaN(x2) || isNaN(y2)) return;

    const branchHue = (config.baseHue + (depth * 140)) % 360;
    const saturation = mapRange(config.opacity, 0, 0.9, 20, 100);
    const color = `hsl(${branchHue}, ${saturation}%, 65%)`;

    ctx.lineCap = 'round';
    
    // Zig-zag params
    const segments = Math.floor(mapRange(config.fm, 100, 0, 2, 8));
    const baseAmplitude = mapRange(config.pt % 1000, 0, 1000, 5, 30);
    const amplitude = baseAmplitude * (length / 380);

    // 1. Vibrant Glow
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.strokeStyle = `hsla(${branchHue}, ${saturation}%, 50%, 0.15)`;
    ctx.lineWidth = config.lineWidth * depth * 2.8;
    this._zigzagPath(ctx, x, y, x2, y2, segments, amplitude, branchHue, saturation);

    // 2. High-intensity Core
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = config.lineWidth * 0.6;
    this._zigzagPath(ctx, x, y, x2, y2, segments, amplitude, branchHue, saturation);
    
    // 3. True Neon Line
    ctx.strokeStyle = `hsla(${branchHue}, ${saturation}%, 75%, 0.8)`;
    ctx.lineWidth = config.lineWidth * 0.4;
    this._zigzagPath(ctx, x, y, x2, y2, segments, amplitude, branchHue, saturation);

    const nextLength = length * 0.73;
    this._drawRecursiveBranch(ctx, x2, y2, nextLength, angle - config.branchAngle, depth - 1, config);
    this._drawRecursiveBranch(ctx, x2, y2, nextLength, angle + config.branchAngle, depth - 1, config);
  }

  _zigzagPath(ctx, x1, y1, x2, y2, segments, amplitude, branchHue, saturation) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    
    // Smooth the helix with more steps
    const steps = Math.max(12, segments * 4);

    const drawStrand = (phaseOffset) => {
        const startP = this._twist(x1, y1);
        ctx.beginPath();
        ctx.moveTo(startP.x, startP.y);
        
        let lastP = startP;
        for (let i = 1; i <= steps; i++) {
            const p = i / steps;
            let tx = x1 + dx * p;
            let ty = y1 + dy * p;
            
            const phase = p * Math.PI * 2 + phaseOffset;
            const offset = Math.sin(phase) * amplitude;
            
            tx += Math.cos(angle + Math.PI / 2) * offset;
            ty += Math.sin(angle + Math.PI / 2) * offset;
            
            const twisted = this._twist(tx, ty);
            ctx.lineTo(twisted.x, twisted.y);

            // Noise speckles based on "stretch"
            const segDist = Math.sqrt((twisted.x - lastP.x)**2 + (twisted.y - lastP.y)**2);
            if (segDist > 15 && Math.random() > 0.4) {
                const count = Math.min(5, Math.floor(segDist / 10));
                for(let j=0; j<count; j++) {
                    this.speckles.push({
                        x: twisted.x + (Math.random() - 0.5) * 20,
                        y: twisted.y + (Math.random() - 0.5) * 20,
                        size: Math.random() * 1.2,
                        color: `hsla(${branchHue}, ${saturation}%, 80%, 0.3)`
                    });
                }
            }
            lastP = twisted;
        }
        ctx.stroke();
    };

    drawStrand(0);
    drawStrand(Math.PI);
  }
}
