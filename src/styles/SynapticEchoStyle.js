import { Style } from '../core/Style.js';
import { mapRange, randomRange, lerp, distance } from '../utils/math.js';

/**
 * SynapticEchoStyle: A high-tech neural web representing data transmission.
 * Features interconnected nodes, traveling synaptic pulses, and "ghost" echoes.
 */
export class SynapticEchoStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.nodes = [];
    this.links = [];
    this.pulses = [];
    this.palette = [];
    this.signalStrength = 1.0;
  }

  async init(data) {
    await super.init(data);
    if (!data || data.length === 0) return;

    this._initPalette(data);
    this._generateNodes(data);
    this._generateLinks();
    this._generatePulses(data);
    
    // Warm up simulation
    for (let i = 0; i < 60; i++) {
        this.processStep();
    }
  }

  _initPalette(data) {
    const lastEntry = data[data.length - 1];
    // Cyan/Magenta/White "Cyber" palette
    const baseHue = mapRange(lastEntry.pt, 0, 1000, 180, 340); // Temperature drives hue
    this.palette = [
        { h: baseHue, s: 100, l: 50 },                     // Signal color
        { h: (baseHue + 40) % 360, s: 90, l: 40 },          // Echo color
        { h: (baseHue - 40 + 360) % 360, s: 100, l: 70 }    // Pulse color
    ];
    this.signalStrength = mapRange(lastEntry.bp, 0, 100, 0.4, 1.2);
  }

  _generateNodes(data) {
    this.nodes = [];
    const step = Math.max(1, Math.floor(data.length / 50));
    for (let i = 0; i < data.length; i += step) {
      const log = data[i];
      this.nodes.push({
        x: mapRange(log.mm, 0, 60, this.width * 0.05, this.width * 0.95),
        y: mapRange(log.hh, 0, 24, this.height * 0.05, this.height * 0.95),
        size: mapRange(log.fm, 0, 100, 4, 12),
        hue: this.palette[i % 3].h,
        pulseOffset: Math.random() * Math.PI * 2,
        activity: mapRange(log.bp, 0, 100, 0.2, 1.0)
      });
    }
  }

  _generateLinks() {
    this.links = [];
    const maxDist = this.width * 0.25;
    
    for (let i = 0; i < this.nodes.length; i++) {
      const n1 = this.nodes[i];
      let connections = 0;
      
      for (let j = i + 1; j < this.nodes.length; j++) {
        const n2 = this.nodes[j];
        const d = distance(n1, n2);
        
        if (d < maxDist && connections < 3) {
          this.links.push({
            from: n1,
            to: n2,
            dist: d,
            strength: (1 - d / maxDist) * n1.activity,
            hue: lerp(n1.hue, n2.hue, 0.5)
          });
          connections++;
        }
      }
    }
  }

  _generatePulses(data) {
    this.pulses = [];
    const count = 40;
    for (let i = 0; i < count; i++) {
        if (this.links.length === 0) break;
        const link = this.links[Math.floor(Math.random() * this.links.length)];
        this.pulses.push({
            link: link,
            progress: Math.random(),
            speed: randomRange(0.005, 0.02) * this.signalStrength,
            size: randomRange(2, 6),
            color: this.palette[2]
        });
    }
  }

  processStep() {
    this.pulses.forEach(p => {
        p.progress += p.speed;
        if (p.progress >= 1.0) {
            // Find a new link connected to the 'to' node of current link
            const currentNode = p.link.to;
            const nextLinks = this.links.filter(l => l.from === currentNode || l.to === currentNode);
            if (nextLinks.length > 0) {
                const nextLink = nextLinks[Math.floor(Math.random() * nextLinks.length)];
                p.link = nextLink;
                p.progress = 0;
            } else {
                p.progress = 0; // Loop back if dead end
            }
        }
    });
  }

  async process() {}

  render(ctx, width, height) {
    this._renderBackground(ctx, width, height);
    this._renderWeb(ctx);
    this._renderNodes(ctx);
    this._renderPulses(ctx);
    this._renderVignette(ctx, width, height);
  }

  _renderBackground(ctx, width, height) {
    ctx.fillStyle = '#020408';
    ctx.fillRect(0, 0, width, height);

    // Subtle digital "noise" grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 0.5;
    const gSize = 100;
    for (let x = 0; x < width; x += gSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0); ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = 0; y < height; y += gSize) {
        ctx.beginPath();
        ctx.moveTo(0, y); ctx.lineTo(width, y);
        ctx.stroke();
    }
  }

  _renderWeb(ctx) {
    ctx.save();
    this.links.forEach(l => {
        const grad = ctx.createLinearGradient(l.from.x, l.from.y, l.to.x, l.to.y);
        grad.addColorStop(0, `hsla(${l.from.hue}, 80%, 40%, ${l.strength * 0.3})`);
        grad.addColorStop(1, `hsla(${l.to.hue}, 80%, 40%, ${l.strength * 0.3})`);
        
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(l.from.x, l.from.y);
        ctx.lineTo(l.to.x, l.to.y);
        ctx.stroke();
    });
    ctx.restore();
  }

  _renderNodes(ctx) {
    ctx.save();
    this.nodes.forEach(n => {
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.size * 4);
        glow.addColorStop(0, `hsla(${n.hue}, 100%, 50%, 0.2)`);
        glow.addColorStop(1, 'transparent');
        
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size * 4, 0, Math.PI * 2);
        ctx.fill();

        // Node core
        ctx.fillStyle = `hsla(${n.hue}, 100%, 70%, 0.8)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Outer ring
        ctx.strokeStyle = `hsla(${n.hue}, 100%, 50%, 0.4)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size * 1.5, 0, Math.PI * 2);
        ctx.stroke();
    });
    ctx.restore();
  }

  _renderPulses(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    this.pulses.forEach(p => {
        const x = lerp(p.link.from.x, p.link.to.x, p.progress);
        const y = lerp(p.link.from.y, p.link.to.y, p.progress);
        
        const grad = ctx.createRadialGradient(x, y, 0, x, y, p.size * 3);
        grad.addColorStop(0, `hsla(${p.color.h}, 100%, 80%, 0.8)`);
        grad.addColorStop(1, 'transparent');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, p.size * 3, 0, Math.PI * 2);
        ctx.fill();

        // Pulse core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, p.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
  }

  _renderVignette(ctx, width, height) {
    const v = ctx.createRadialGradient(width/2, height/2, width * 0.2, width/2, height/2, width * 1.2);
    v.addColorStop(0, 'transparent');
    v.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, width, height);
  }
}
