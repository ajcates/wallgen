import { Style } from '../core/Style.js';
import { mapRange, randomRange } from '../utils/math.js';
import * as canvasUtils from '../utils/canvas.js';
import * as colorUtils from '../utils/color.js';

/**
 * CyberCircuitStyle: A technological style that renders computer chip hardware
 * patterns with multiple layers, realistic 3D effects, and pathways.
 */
export class CyberCircuitStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.layers = {
      background: [],
      traces: [],
      components: []
    };
    this.palette = [];
  }

  async init(data) {
    await super.init(data);
    if (!data || data.length === 0) return;

    const latest = data[data.length - 1];
    this._initPalette(latest);
    this._generateCircuitry(data);
  }

  _initPalette(entry) {
    const hueOffset = Math.random() * 360;
    // Tech colors often lean towards blues, cyans, or greens
    const baseHue = (mapRange(entry.hh + (entry.mm / 60), 0, 24, 180, 240) + hueOffset) % 360;
    const saturation = mapRange(entry.fm, 0, 100, 40, 70); 
    
    this.isLightMode = entry.hh >= 6 && entry.hh < 18;
    this.palette = colorUtils.generateMaterialPalette(baseHue, saturation, this.isLightMode);
  }

  _generateCircuitry(data) {
    const latest = data[data.length - 1];
    const gridSpacing = 60;
    const cols = Math.ceil(this.width / gridSpacing);
    const rows = Math.ceil(this.height / gridSpacing);

    // 1. Background Traces (Deep Layer)
    this.layers.background = this._generateTraces(data.slice(-20), 0.3, 1.5);

    // 2. Main Traces (Mid Layer)
    this.layers.traces = this._generateTraces(data.slice(-15), 0.8, 3.5);

    // 3. Components (Top Layer)
    this.layers.components = [];
    const numComponents = Math.floor(mapRange(latest.bp, 0, 100, 8, 20));
    
    for (let i = 0; i < numComponents; i++) {
      const log = data[Math.floor(Math.random() * data.length)];
      const type = Math.random() > 0.6 ? 'chip' : (Math.random() > 0.5 ? 'capacitor' : 'resistor');
      
      const x = Math.floor(randomRange(1, cols - 1)) * gridSpacing;
      const y = Math.floor(randomRange(1, rows - 1)) * gridSpacing;
      
      this.layers.components.push(this._createComponent(log, x, y, type));
    }
  }

  _generateTraces(data, opacity, width) {
    const traces = [];
    const gridSpacing = 60;

    data.forEach(log => {
      const startX = Math.floor(randomRange(0, this.width / gridSpacing)) * gridSpacing;
      const startY = Math.floor(randomRange(0, this.height / gridSpacing)) * gridSpacing;
      
      const points = [{ x: startX, y: startY }];
      let curX = startX;
      let curY = startY;
      
      const segments = Math.floor(randomRange(3, 8));
      for (let i = 0; i < segments; i++) {
        const dir = Math.random();
        const dist = Math.floor(randomRange(1, 5)) * gridSpacing;
        
        if (dir < 0.5) curX += (Math.random() > 0.5 ? 1 : -1) * dist;
        else curY += (Math.random() > 0.5 ? 1 : -1) * dist;
        
        points.push({ x: curX, y: curY });
      }

      const baseColor = this.palette[Math.floor(Math.random() * 3)];
      traces.push({ 
        points, 
        width, 
        opacity, 
        color: baseColor,
        hasPads: Math.random() > 0.7 
      });
    });

    return traces;
  }

  _createComponent(log, x, y, type) {
    const sizeBase = 40;
    let w, h, color;

    if (type === 'chip') {
      w = Math.floor(randomRange(2, 4)) * 60;
      h = Math.floor(randomRange(2, 4)) * 60;
      color = this.palette[0]; // Darker primary
    } else if (type === 'capacitor') {
      w = 30;
      h = 60;
      color = this.palette[1];
    } else {
      w = 50;
      h = 20;
      color = this.palette[2];
    }

    return { x, y, w, h, type, color, rotation: (Math.random() > 0.5 ? 0 : Math.PI / 2) };
  }

  async render(ctx, width, height) {
    this._drawPCB(ctx, width, height);

    // Draw Background Traces
    this.layers.background.forEach(trace => this._drawTrace(ctx, trace));

    // Draw Main Traces
    this.layers.traces.forEach(trace => this._drawTrace(ctx, trace));

    // Draw Components with depth
    this.layers.components.forEach(comp => this._drawComponent(ctx, comp));

    await canvasUtils.drawGrain(ctx, width, height, 1200, 0.05);
  }

  _drawPCB(ctx, width, height) {
    const baseColor = this.palette[3];
    const bgHsl = `hsl(${baseColor.h}, ${baseColor.s}%, ${this.isLightMode ? 90 : 8}%)`;
    ctx.fillStyle = bgHsl;
    ctx.fillRect(0, 0, width, height);

    // Draw Subtle Grid
    ctx.strokeStyle = this.isLightMode ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    const grid = 60;
    for (let x = 0; x < width; x += grid) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += grid) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
  }

  _drawTrace(ctx, trace) {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = `hsla(${trace.color.h}, ${trace.color.s}%, ${trace.color.l}%, ${trace.opacity})`;
    ctx.lineWidth = trace.width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.moveTo(trace.points[0].x, trace.points[0].y);
    for (let i = 1; i < trace.points.length; i++) {
      ctx.lineTo(trace.points[i].x, trace.points[i].y);
    }
    ctx.stroke();

    // Add solder pads at joints
    if (trace.hasPads) {
      ctx.fillStyle = `hsla(${trace.color.h}, ${trace.color.s}%, ${trace.color.l + 20}%, ${trace.opacity})`;
      trace.points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, trace.width * 1.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();
  }

  _drawComponent(ctx, comp) {
    ctx.save();
    ctx.translate(comp.x, comp.y);
    ctx.rotate(comp.rotation);

    // Shadow for depth
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 8;

    if (comp.type === 'chip') {
      this._drawChip(ctx, comp);
    } else if (comp.type === 'capacitor') {
      this._drawCapacitor(ctx, comp);
    } else {
      this._drawResistor(ctx, comp);
    }

    ctx.restore();
  }

  _drawChip(ctx, comp) {
    const { w, h, color } = comp;
    
    // Body
    const grad = ctx.createLinearGradient(-w/2, -h/2, w/2, h/2);
    grad.addColorStop(0, `hsl(${color.h}, ${color.s}%, ${color.l}%)`);
    grad.addColorStop(1, `hsl(${color.h}, ${color.s}%, ${color.l - 10}%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(-w/2, -h/2, w, h);

    // Bevel/Top
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-w/2 + 2, -h/2 + 2, w - 4, h - 4);

    // Pins
    ctx.fillStyle = '#C0C0C0'; // Silver/Tin
    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    
    const pinW = 10;
    const pinH = 15;
    const pinGap = 20;
    
    // Top and Bottom Pins
    for (let x = -w/2 + 15; x < w/2 - 5; x += pinGap) {
      ctx.fillRect(x, -h/2 - pinH + 5, pinW, pinH);
      ctx.fillRect(x, h/2 - 5, pinW, pinH);
    }
    
    // Chip Markings
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GWF-X1', 0, -5);
    ctx.fillText('REV A', 0, 10);
    
    // Polarity Notch
    ctx.beginPath();
    ctx.arc(-w/2 + 10, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();
  }

  _drawCapacitor(ctx, comp) {
    const { w, h, color } = comp;
    
    // Body (Cylindrical look)
    const grad = ctx.createLinearGradient(-w/2, 0, w/2, 0);
    grad.addColorStop(0, `hsl(${color.h}, ${color.s}%, ${color.l - 10}%)`);
    grad.addColorStop(0.5, `hsl(${color.h}, ${color.s}%, ${color.l + 10}%)`);
    grad.addColorStop(1, `hsl(${color.h}, ${color.s}%, ${color.l - 10}%)`);
    
    ctx.fillStyle = grad;
    ctx.fillRect(-w/2, -h/2, w, h);
    
    // Stripe
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(w/2 - 10, -h/2, 5, h);
    
    // Top Cap
    ctx.fillStyle = '#E0E0E0';
    ctx.beginPath();
    ctx.ellipse(0, -h/2, w/2, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawResistor(ctx, comp) {
    const { w, h, color } = comp;
    
    // Leads
    ctx.strokeStyle = '#A0A0A0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-w, 0); ctx.lineTo(w, 0);
    ctx.stroke();
    
    // Body
    const grad = ctx.createLinearGradient(0, -h/2, 0, h/2);
    grad.addColorStop(0, '#D2B48C'); // Tan base
    grad.addColorStop(0.5, '#F5DEB3');
    grad.addColorStop(1, '#D2B48C');
    ctx.fillStyle = grad;
    ctx.roundRect(-w/2, -h/2, w, h, 5);
    ctx.fill();
    
    // Color Bands
    const bands = ['#8B4513', '#FF0000', '#FFA500', '#FFD700'];
    bands.forEach((b, i) => {
      ctx.fillStyle = b;
      ctx.fillRect(-w/2 + 10 + (i * 10), -h/2, 5, h);
    });
  }
}
