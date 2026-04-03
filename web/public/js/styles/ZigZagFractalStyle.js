import { Style } from '../core/Style.js';
import { mapRange, randomRange } from '../utils/math.js';

/**
 * ZigZagFractalStyle: Optimized for Browser performance.
 */
export class ZigZagFractalStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.mandalaNodes = [];
    this.speckles = [];
    this.time = 0;
  }

  static get metadata() {
    return [
      { id: 'minSegments', name: 'Min Segments', type: 'range', min: 1, max: 10, default: 2 },
      { id: 'maxSegments', name: 'Max Segments', type: 'range', min: 5, max: 20, default: 8 },
      { id: 'minAmplitude', name: 'Min Amplitude', type: 'range', min: 1, max: 20, default: 5 },
      { id: 'maxAmplitude', name: 'Max Amplitude', type: 'range', min: 10, max: 100, default: 30 },
      { id: 'twistFactor', name: 'Twist Intensity', type: 'range', min: 0.1, max: 5.0, step: 0.1, default: 2.0 },
      { id: 'visibleNodes', name: 'Visible History', type: 'range', min: 5, max: 50, default: 20 },
      { id: 'animationSpeed', name: 'Animation Speed', type: 'range', min: 0, max: 5, step: 0.1, default: 1.0 }
    ];
  }

  async process() {
    const speed = this.config.animationSpeed || 1.0;
    this.time += 0.01 * speed;
    
    // Dynamic updates for movement
    this.mandalaNodes.forEach((node, i) => {
        node.rotation += 0.005 * speed * (i % 2 === 0 ? 1 : -1);
        node.currentScale = node.scale * (1 + Math.sin(this.time + i) * 0.05);
    });
  }

  _generateMandala(data) {
    const margin = 200;
    const visibleLimit = this.config.visibleNodes || 20;
    const fadeLimit = Math.floor(visibleLimit * 0.4);
    const opaqueLimit = visibleLimit - fadeLimit;

    this.mandalaNodes = data.map((log, index) => {
      const hh = Number(log.hh) || 0;
      const mm = Number(log.mm) || 0;
      const bp = Number(log.bp) || 0;
      const pt = Number(log.pt) || 0;
      const fm = Number(log.fm) || 0;

      const progress = (hh + mm / 60) / 24;
      const y = mapRange(progress, 0, 1, margin, this.height - margin);
      
      const strand = index % 2;
      const helixAngle = progress * Math.PI * 5; 
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
      if (reverseIndex < opaqueLimit) {
        opacity = 0.9;
      } else if (reverseIndex < visibleLimit) {
        opacity = mapRange(reverseIndex, opaqueLimit, visibleLimit, 0.9, 0);
      }
      
      return {
        x: x || 0,
        y: y || 0,
        depth,
        spokes,
        angleStep,
        baseHue: nodeHue,
        scale,
        currentScale: scale,
        lineWidth: Math.max(0.1, mapRange(fm, 0, 100, 1.8, 0.4)),
        fm, 
        pt, 
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
            this._drawRecursiveBranch(ctx, node.x, node.y, 380 * node.currentScale, startAngle, node.depth, node);
        }
        ctx.restore();
    });

    // Render Galaxy Dust (speckles) - Batched
    ctx.globalCompositeOperation = 'lighter';
    const sGroups = {};
    this.speckles.forEach(s => {
        if (!sGroups[s.color]) sGroups[s.color] = [];
        sGroups[s.color].push(s);
    });

    for (const color in sGroups) {
        ctx.fillStyle = color;
        sGroups[color].forEach(s => {
            ctx.fillRect(s.x, s.y, s.size, s.size);
        });
    }

    // Ambient Dust - Optimization: pre-calculate twisted positions or reduce count
    for(let i=0; i<150; i++) {
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
    
    const intensity = this.config.twistFactor || 2.0;
    const angle = Math.log(dist + 1) * 3.5 + (dist / this.width) * intensity;
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
    
    const minS = this.config.minSegments || 2;
    const maxS = this.config.maxSegments || 8;
    const segments = Math.floor(mapRange(config.fm, 100, 0, minS, maxS));
    
    const minA = this.config.minAmplitude || 5;
    const maxA = this.config.maxAmplitude || 30;
    const baseAmplitude = mapRange(config.pt % 1000, 0, 1000, minA, maxA);
    const amplitude = baseAmplitude * (length / 380);

    // OPTIMIZATION: Calculate twisted points once
    const strands = this._calculateDoubleHelixPoints(x, y, x2, y2, segments, amplitude, branchHue, saturation);

    ctx.lineCap = 'round';
    
    // Draw Glow (multiple strokes for simulated glow - faster than shadowBlur)
    strands.forEach(points => {
        // 1. Wide Glow
        ctx.strokeStyle = `hsla(${branchHue}, ${saturation}%, 50%, 0.1)`;
        ctx.lineWidth = config.lineWidth * depth * 3.5;
        this._drawPathPoints(ctx, points);

        // 2. High-intensity Core
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = config.lineWidth * 0.8;
        this._drawPathPoints(ctx, points);

        // 3. Neon Line
        ctx.strokeStyle = `hsla(${branchHue}, ${saturation}%, 75%, 0.8)`;
        ctx.lineWidth = config.lineWidth * 0.4;
        this._drawPathPoints(ctx, points);
    });

    const nextLength = length * 0.73;
    this._drawRecursiveBranch(ctx, x2, y2, nextLength, angle - config.branchAngle, depth - 1, config);
    this._drawRecursiveBranch(ctx, x2, y2, nextLength, angle + config.branchAngle, depth - 1, config);
  }

  _calculateDoubleHelixPoints(x1, y1, x2, y2, segments, amplitude, branchHue, saturation) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    const steps = Math.max(10, segments * 3); // Slightly reduced steps for speed

    const calculateStrand = (phaseOffset) => {
        const points = [];
        let lastP = this._twist(x1, y1);
        points.push(lastP);
        
        for (let i = 1; i <= steps; i++) {
            const p = i / steps;
            let tx = x1 + dx * p;
            let ty = y1 + dy * p;
            
            const phase = p * Math.PI * 2 + phaseOffset;
            const offset = Math.sin(phase) * amplitude;
            
            tx += Math.cos(angle + Math.PI / 2) * offset;
            ty += Math.sin(angle + Math.PI / 2) * offset;
            
            const twisted = this._twist(tx, ty);
            points.push(twisted);

            // Speckles based on stretch
            const segDist = Math.sqrt((twisted.x - lastP.x)**2 + (twisted.y - lastP.y)**2);
            if (segDist > 20 && Math.random() > 0.5) {
                this.speckles.push({
                    x: twisted.x + (Math.random() - 0.5) * 15,
                    y: twisted.y + (Math.random() - 0.5) * 15,
                    size: Math.random() * 1.0,
                    color: `hsla(${branchHue}, ${saturation}%, 80%, 0.25)`
                });
            }
            lastP = twisted;
        }
        return points;
    };

    return [calculateStrand(0), calculateStrand(Math.PI)];
  }

  _drawPathPoints(ctx, points) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }
}
