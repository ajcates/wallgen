import { Style } from '../core/Style.js';
import { randomRange, mapRange, lerp } from '../utils/math.js';
import * as colorUtils from '../utils/color.js';

/**
 * GlitchStyle (AMOLED Ultra): An advanced digital corruption style.
 * Features: True black base, Digital Bus background, Pixel Sorting simulations,
 * Wireframe fragments, Corrupted UI blocks, and high-fidelity chromatic shifts.
 */
export class GlitchStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.noiseLevel = config.noiseLevel || 1.0;
    this.artifacts = [];
    this.slices = [];
    this.palette = [];
    this.glitchColors = [];
    this.ghosts = [];
    this.busLines = [];
    this.pixelSorts = [];
    this.uiBlocks = [];
    this.wireframes = [];
  }

  async init(data) {
    await super.init(data);
    if (!data || data.length === 0) return;

    this._initPalette(data);
    this._generateBusLines();
    this._generateSlices(data);
    this._generateArtifacts(data);
    this._generatePixelSorts(data);
    this._generateUIBlocks(data);
    this._generateWireframes(data);
  }

  _initPalette(data) {
    const lastEntry = data[data.length - 1];
    const baseHue = mapRange(lastEntry.bp, 0, 100, 0, 360);
    const saturation = mapRange(lastEntry.fm, 0, 100, 75, 100);
    const matPalette = colorUtils.generateMaterialPalette(baseHue, saturation, false);
    
    this.palette = matPalette.map(c => `hsla(${c.h}, ${c.s}%, ${c.l}%, 0.8)`);
    
    this.glitchColors = [
        `hsla(${matPalette[0].h}, 100%, 65%, 0.9)`, // Primary
        `hsla(${(matPalette[0].h + 180) % 360}, 100%, 65%, 0.9)`, // Comp
        `hsla(${matPalette[2].h}, 100%, 70%, 0.9)`, // Tertiary
        '#ffffff',
        '#ff0055', // ERROR RED
        '#00ffcc', // CYBER CYAN
        '#ffff00'  // WARNING YELLOW
    ];
  }

  _generateBusLines() {
    this.busLines = [];
    const count = 30;
    for (let i = 0; i < count; i++) {
        this.busLines.push({
            pos: randomRange(0, i % 2 === 0 ? this.width : this.height),
            isVertical: i % 2 === 0,
            opacity: randomRange(0.02, 0.08),
            width: randomRange(1, 3)
        });
    }
  }

  _generateSlices(data) {
    this.slices = [];
    const intensity = 80 * this.noiseLevel;
    for (let i = 0; i < intensity; i++) {
        this.slices.push({
            y: randomRange(0, this.height),
            h: randomRange(1, 120),
            offset: randomRange(-this.width * 0.3, this.width * 0.3),
            color: this.glitchColors[Math.floor(Math.random() * 4)],
            flicker: Math.random() > 0.8
        });
    }
  }

  _generateArtifacts(data) {
    this.artifacts = [];
    data.filter((_, i) => i % 2 === 0).forEach((log, i) => {
        this.artifacts.push({
            x: randomRange(0, this.width),
            y: randomRange(0, this.height),
            w: mapRange(log.bp, 0, 100, 40, 500),
            h: mapRange(log.fm, 0, 100, 30, 2),
            color: this.glitchColors[i % this.glitchColors.length],
            label: `ERR_0x${log.pt.toString(16).toUpperCase()}`
        });
    });
  }

  _generatePixelSorts(data) {
    this.pixelSorts = [];
    const count = 40;
    for (let i = 0; i < count; i++) {
        const log = data[i % data.length];
        this.pixelSorts.push({
            x: randomRange(0, this.width),
            y: randomRange(0, this.height),
            w: randomRange(2, 15),
            h: mapRange(log.up % 1000, 0, 1000, 100, 1200),
            color: this.glitchColors[i % 3]
        });
    }
  }

  _generateUIBlocks(data) {
      this.uiBlocks = [];
      const count = 5;
      for (let i = 0; i < count; i++) {
          const log = data[Math.floor(Math.random() * data.length)];
          this.uiBlocks.push({
              x: randomRange(50, this.width - 250),
              y: randomRange(100, this.height - 400),
              w: 200,
              h: 150,
              title: `SUBSYS_${log.hh}:${log.mm}`,
              progress: log.bp / 100,
              isError: Math.random() > 0.7
          });
      }
  }

  _generateWireframes(data) {
      this.wireframes = [];
      const count = 10;
      for (let i = 0; i < count; i++) {
          const points = Array.from({length: 4}, () => ({
              x: randomRange(-100, 100),
              y: randomRange(-100, 100)
          }));
          this.wireframes.push({
              x: randomRange(0, this.width),
              y: randomRange(0, this.height),
              points,
              rotation: Math.random() * Math.PI * 2,
              color: this.glitchColors[Math.floor(Math.random() * 6)]
          });
      }
  }

  render(ctx, width, height) {
    this._renderBackground(ctx, width, height);
    this._renderBusLines(ctx, width, height);
    this._renderWireframes(ctx);
    this._renderPixelSorts(ctx);
    this._renderSlices(ctx, width, height);
    this._renderChromaticAberration(ctx);
    this._renderUIBlocks(ctx);
    this._renderArtifacts(ctx);
    this._renderScanlines(ctx, width, height);
    this._renderOverlayText(ctx, width, height);
  }

  _renderBackground(ctx, width, height) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    // Very faint gradient glow
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, 'rgba(0, 255, 204, 0.03)');
    g.addColorStop(0.5, 'transparent');
    g.addColorStop(1, 'rgba(255, 0, 85, 0.03)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  _renderBusLines(ctx, width, height) {
    this.busLines.forEach(line => {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = line.opacity;
        if (line.isVertical) {
            ctx.fillRect(line.pos, 0, line.width, height);
        } else {
            ctx.fillRect(0, line.pos, width, line.width);
        }
    });
    ctx.globalAlpha = 1.0;
  }

  _renderWireframes(ctx) {
      this.wireframes.forEach(w => {
          ctx.save();
          ctx.translate(w.x, w.y);
          ctx.rotate(w.rotation);
          ctx.strokeStyle = w.color;
          ctx.globalAlpha = 0.4;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(w.points[0].x, w.points[0].y);
          w.points.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.closePath();
          ctx.stroke();
          
          // Draw "vertices"
          w.points.forEach(p => {
              ctx.fillStyle = '#fff';
              ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
          });
          ctx.restore();
      });
  }

  _renderPixelSorts(ctx) {
      this.pixelSorts.forEach(ps => {
          const grad = ctx.createLinearGradient(ps.x, ps.y, ps.x, ps.y + ps.h);
          grad.addColorStop(0, 'white');
          grad.addColorStop(0.1, ps.color);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.globalAlpha = 0.6;
          ctx.fillRect(ps.x, ps.y, ps.w, ps.h);
      });
      ctx.globalAlpha = 1.0;
  }

  _renderSlices(ctx, width, height) {
    this.slices.forEach(s => {
        if (s.flicker && Math.random() > 0.5) return;
        ctx.fillStyle = s.color;
        ctx.globalAlpha = 0.2 * this.noiseLevel;
        ctx.fillRect(s.offset, s.y, width, s.h);
        
        if (Math.random() > 0.95) {
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = 0.8;
            ctx.fillRect(0, s.y, width, 1);
        }
    });
    ctx.globalAlpha = 1.0;
  }

  _renderChromaticAberration(ctx) {
    const intensity = 20 * this.noiseLevel;
    // Jittered shifts
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * this.width;
        const y = Math.random() * this.height;
        const w = randomRange(50, 400);
        const h = randomRange(1, 5);

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = 'rgba(255, 0, 80, 0.5)';
        ctx.fillRect(x - intensity, y, w, h);
        ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.fillRect(x + intensity, y, w, h);
        ctx.restore();
    }
  }

  _renderUIBlocks(ctx) {
      this.uiBlocks.forEach(block => {
          ctx.save();
          ctx.translate(block.x, block.y);
          
          // Window Frame
          ctx.strokeStyle = block.isError ? '#ff0055' : '#00ffcc';
          ctx.lineWidth = 1;
          ctx.strokeRect(0, 0, block.w, block.h);
          
          // Title Bar
          ctx.fillStyle = ctx.strokeStyle;
          ctx.globalAlpha = 0.2;
          ctx.fillRect(0, 0, block.w, 25);
          ctx.globalAlpha = 1.0;
          
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px monospace';
          ctx.fillText(block.title, 10, 18);
          
          // Progress Bar
          const barW = block.w - 40;
          ctx.strokeStyle = '#fff';
          ctx.globalAlpha = 0.3;
          ctx.strokeRect(20, 60, barW, 10);
          ctx.fillStyle = ctx.strokeStyle;
          ctx.globalAlpha = 0.8;
          ctx.fillRect(20, 60, barW * block.progress, 10);
          
          // Random Data Strings
          ctx.font = '10px monospace';
          ctx.fillStyle = '#fff';
          ctx.globalAlpha = 0.5;
          ctx.fillText(`MEM_ADDR: 0x${(Math.random()*0xFFFF|0).toString(16)}`, 20, 90);
          ctx.fillText(`STATUS: ${block.isError ? 'CRITICAL' : 'STABLE'}`, 20, 105);
          
          ctx.restore();
      });
  }

  _renderArtifacts(ctx) {
    this.artifacts.forEach(a => {
        ctx.fillStyle = a.color;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(a.x, a.y, a.w, a.h);
        
        if (Math.random() > 0.8) {
            ctx.fillStyle = '#fff';
            ctx.font = '12px monospace';
            ctx.fillText(a.label, a.x + 5, a.y - 5);
        }
    });
    ctx.globalAlpha = 1.0;
  }

  _renderScanlines(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    for (let i = 0; i < height; i += 4) {
        ctx.fillRect(0, i, width, 2);
    }
    ctx.restore();
  }

  _renderOverlayText(ctx, width, height) {
    ctx.save();
    const latest = this.data[this.data.length - 1];
    
    // Bottom Status Bar
    ctx.fillStyle = 'rgba(0, 255, 204, 0.1)';
    ctx.fillRect(0, height - 80, width, 80);
    
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#00ffcc';
    const time = `${latest.hh.toString().padStart(2, '0')}:${latest.mm.toString().padStart(2, '0')}`;
    ctx.fillText(`TIMESTAMP: ${time}`, 40, height - 40);
    ctx.fillText(`BATTERY_CORE: ${latest.bp}%`, width - 300, height - 40);
    
    // Large Center Warning if battery is low
    if (latest.bp < 15) {
        ctx.font = 'bold 120px monospace';
        ctx.fillStyle = '#ff0055';
        ctx.globalAlpha = 0.1;
        ctx.fillText("CRITICAL", width/2 - 300, height/2);
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = '#ff0055';
        ctx.strokeText("CRITICAL", width/2 - 300 + (Math.random()-0.5)*20, height/2 + (Math.random()-0.5)*20);
    }
    
    ctx.restore();
  }
}
