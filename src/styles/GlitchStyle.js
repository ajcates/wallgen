import { Style } from '../core/Style.js';
import { randomRange, mapRange, lerp } from '../utils/math.js';
import * as colorUtils from '../utils/color.js';

/**
 * GlitchStyle (AMOLED): A high-intensity digital corruption style optimized for OLED.
 * Features: True black base, Material-style dynamic palette, chromatic aberration, 
 * pixel shifting, pixel replication, and intense data-driven overlays.
 */
export class GlitchStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.noiseLevel = config.noiseLevel || 1.0;
    this.artifacts = [];
    this.slices = [];
    this.palette = [];
    this.inversions = [];
    this.mosaics = [];
    this.replications = [];
    this.pixelShifts = [];
  }

  async init(data) {
    await super.init(data);
    if (!data || data.length === 0) return;

    this._initPalette(data);
    this._generateSlices(data);
    this._generateArtifacts(data);
    this._generateInversions();
    this._generateMosaics();
    this._generateReplications();
    this._generatePixelShifts();
  }

  _initPalette(data) {
    const lastEntry = data[data.length - 1];
    // Use material palette generation logic
    const baseHue = mapRange(lastEntry.bp, 0, 100, 0, 360);
    const saturation = mapRange(lastEntry.fm, 0, 100, 70, 100);
    
    // Always force dark mode for AMOLED
    const matPalette = colorUtils.generateMaterialPalette(baseHue, saturation, false);
    
    this.palette = matPalette.map(c => `hsla(${c.h}, ${c.s}%, ${c.l}%, 0.9)`);
    // Ensure primary glitch colors are vibrant
    this.glitchColors = [
        `hsla(${matPalette[0].h}, 100%, 60%, 0.9)`,
        `hsla(${matPalette[2].h}, 100%, 65%, 0.9)`,
        `hsla(0, 0%, 100%, 1.0)`
    ];
  }

  _generateSlices(data) {
    this.slices = [];
    const numSlices = 70 + Math.floor(data.length / 2);
    for (let i = 0; i < numSlices; i++) {
        this.slices.push({
            y: randomRange(0, this.height),
            h: randomRange(1, 150),
            offset: randomRange(-500, 500) * this.noiseLevel,
            flicker: Math.random() > 0.15
        });
    }
  }

  _generateArtifacts(data) {
    this.artifacts = [];
    data.forEach((log, i) => {
        if (i % 2 === 0) {
            this.artifacts.push({
                x: randomRange(0, this.width),
                y: randomRange(0, this.height),
                w: randomRange(10, 800),
                h: randomRange(1, 60),
                type: Math.random() > 0.2 ? 'block' : 'line',
                color: this.glitchColors[i % this.glitchColors.length],
                text: Math.random() > 0.5 ? `SYS_0x${log.up.toString(16).toUpperCase()}` : null
            });
        }
    });
  }

  _generateInversions() {
      this.inversions = [];
      const count = 15 + Math.floor(Math.random() * 20);
      for (let i = 0; i < count; i++) {
          this.inversions.push({
              y: randomRange(0, this.height),
              h: randomRange(5, 300),
              active: Math.random() > 0.3
          });
      }
  }

  _generateMosaics() {
      this.mosaics = [];
      const count = 25 + Math.floor(Math.random() * 20);
      for (let i = 0; i < count; i++) {
          this.mosaics.push({
              x: randomRange(0, this.width),
              y: randomRange(0, this.height),
              size: randomRange(200, 800),
              pixelSize: randomRange(2, 40)
          });
      }
  }

  _generateReplications() {
      this.replications = [];
      const count = 20 + Math.floor(Math.random() * 20);
      for (let i = 0; i < count; i++) {
          this.replications.push({
              x: randomRange(0, this.width),
              y: randomRange(0, this.height),
              w: randomRange(40, 250),
              h: randomRange(40, 250),
              repeats: 5 + Math.floor(Math.random() * 8),
              spacingX: randomRange(5, 200),
              spacingY: randomRange(5, 200),
              color: this.glitchColors[Math.floor(Math.random() * 2)]
          });
      }
  }

  _generatePixelShifts() {
      this.pixelShifts = [];
      const count = 150;
      for (let i = 0; i < count; i++) {
          this.pixelShifts.push({
              x: randomRange(0, this.width),
              y: randomRange(0, this.height),
              w: randomRange(20, 500),
              h: randomRange(1, 15),
              offsetX: randomRange(-100, 100) * this.noiseLevel,
              color: this.glitchColors[Math.floor(Math.random() * 3)],
              alpha: randomRange(0.2, 0.6)
          });
      }
  }

  render(ctx, width, height) {
    this._renderBackground(ctx, width, height);
    this._renderSlices(ctx, width, height);
    this._renderPixelShifts(ctx);
    this._renderReplications(ctx);
    this._renderChromaticAberration(ctx);
    this._renderPixelSorting(ctx, width, height);
    this._renderArtifacts(ctx);
    this._renderInversions(ctx, width, height);
    this._renderMosaics(ctx);
    this._renderScanlines(ctx, width, height);
    this._renderDataOverlay(ctx, width, height);
    this._renderGlitchText(ctx, width, height);
  }

  _renderBackground(ctx, width, height) {
    // Pure AMOLED Black
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    // Extremely subtle dark gradient to anchor the center
    const g = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.02)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    if (Math.random() < 0.3) {
        ctx.fillStyle = this.glitchColors[Math.floor(Math.random() * 3)];
        ctx.globalAlpha = 0.35;
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 1.0;
    }
  }

  _renderSlices(ctx, width, height) {
    ctx.save();
    this.slices.forEach(s => {
        if (s.flicker && Math.random() > 0.2) return;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.25 * this.noiseLevel})`;
        ctx.fillRect(0, s.y, width, s.h);
        
        ctx.fillStyle = this.glitchColors[Math.floor(Math.random() * 2)];
        ctx.globalAlpha = 0.5;
        ctx.fillRect(s.offset, s.y, width * 0.7, s.h);
        ctx.globalAlpha = 1.0;
    });
    ctx.restore();
  }

  _renderPixelShifts(ctx) {
      ctx.save();
      this.pixelShifts.forEach(ps => {
          ctx.fillStyle = ps.color;
          ctx.globalAlpha = ps.alpha;
          ctx.fillRect(ps.x + ps.offsetX, ps.y, ps.w, ps.h);
          
          if (Math.random() > 0.7) {
              ctx.fillRect(ps.x, ps.y - ps.offsetX, 3, ps.h * 15);
          }
      });
      ctx.restore();
  }

  _renderReplications(ctx) {
      ctx.save();
      this.replications.forEach(rep => {
          ctx.fillStyle = rep.color;
          ctx.globalAlpha = 0.6;
          for (let i = 0; i < rep.repeats; i++) {
              const ox = i * rep.spacingX;
              const oy = i * rep.spacingY;
              ctx.fillRect(rep.x + ox, rep.y + oy, rep.w, rep.h);
              
              ctx.fillStyle = '#fff';
              ctx.globalAlpha = 0.4;
              ctx.fillRect(rep.x + ox + 3, rep.y + oy + 3, rep.w - 6, 2);
              ctx.fillStyle = rep.color;
              ctx.globalAlpha = 0.6;
          }
      });
      ctx.restore();
  }

  _renderChromaticAberration(ctx) {
    const intensity = this.noiseLevel * 25;
    this.data.forEach(log => {
        const baseX = mapRange(log.mm, 0, 60, 0, this.width);
        const baseY = mapRange(log.hh, 0, 24, 0, this.height);
        const size = mapRange(log.bp, 0, 100, 60, 500);

        const ghostCount = 5 + Math.floor(Math.random() * 5);
        for (let g = 0; g < ghostCount; g++) {
            const offX = (Math.random() - 0.5) * intensity * 4;
            const offY = (Math.random() - 0.5) * intensity * 2;
            const alpha = 0.7 / (g + 1);
            
            ctx.fillStyle = g % 3 === 0 ? 'rgba(255,0,0,'+alpha+')' : (g % 3 === 1 ? 'rgba(0,255,255,'+alpha+')' : 'rgba(255,255,255,'+alpha+')');
            ctx.fillRect(
                this.wrapX(baseX + offX), 
                this.wrapY(baseY + offY), 
                size * (1 + Math.random() * 0.8), 
                randomRange(1, 8)
            );
        }
    });
  }

  _renderPixelSorting(ctx, width, height) {
    ctx.save();
    const count = 60;
    for (let i = 0; i < count; i++) {
        const x = randomRange(0, width);
        const y = randomRange(0, height);
        const h = randomRange(400, 1500);
        const w = randomRange(2, 20);
        
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, 'white');
        grad.addColorStop(0.2, this.glitchColors[0]);
        grad.addColorStop(0.4, this.glitchColors[1]);
        grad.addColorStop(1, 'transparent');
        
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  _renderInversions(ctx, width, height) {
      this.inversions.forEach(inv => {
          if (!inv.active) return;
          ctx.save();
          ctx.globalCompositeOperation = 'difference';
          ctx.fillStyle = 'white';
          ctx.fillRect(0, inv.y, width, inv.h);
          ctx.restore();
      });
  }

  _renderMosaics(ctx) {
      this.mosaics.forEach(m => {
          ctx.save();
          const color = this.glitchColors[Math.floor(Math.random() * 2)];
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.6;
          
          for (let i = 0; i < m.size; i += m.pixelSize) {
              for (let j = 0; j < m.size; j += m.pixelSize) {
                  if (Math.random() > 0.25) {
                      ctx.fillRect(m.x + i, m.y + j, m.pixelSize - 1, m.pixelSize - 1);
                  }
              }
          }
          ctx.restore();
      });
  }

  _renderArtifacts(ctx) {
    this.artifacts.forEach(a => {
        ctx.fillStyle = a.color;
        ctx.globalAlpha = randomRange(0.6, 1.0);
        
        if (a.type === 'block') {
            ctx.fillRect(a.x, a.y, a.w, a.h);
        } else {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(a.x + a.w, a.y);
            ctx.lineWidth = randomRange(5, 15);
            ctx.stroke();
        }

        if (a.text) {
            ctx.font = 'bold 22px monospace';
            ctx.fillStyle = '#fff';
            ctx.fillText(a.text, a.x, a.y - 5);
        }
        
        ctx.globalAlpha = 1.0;
    });
  }

  _renderScanlines(ctx, width, height) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)'; // Darker scanlines
    ctx.lineWidth = 3;
    for (let i = 0; i < height; i += 2) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
    }
    ctx.restore();
  }

  _renderDataOverlay(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 255, 0, 0.55)';
    ctx.font = 'bold 18px monospace';
    
    for (let i = 0; i < 15; i++) {
        const x = (width / 15) * i + 10;
        for (let j = 0; j < 100; j++) {
            const val = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
            ctx.fillText(val, x, j * 20 + 20);
        }
    }
    ctx.restore();
  }

  _renderGlitchText(ctx, width, height) {
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 120px monospace';
      ctx.globalAlpha = 0.75;
      
      const words = ["CRITICAL", "HARDWARE_FAIL", "IO_ABORT", "SIG_KILL", "BUFFER_OVERRUN"];
      const word = words[Math.floor(Math.random() * words.length)];
      
      const tx = width / 2 - 400;
      const ty = height / 2;
      
      ctx.fillStyle = 'red';
      ctx.fillText(word, tx - 30, ty - 15);
      ctx.fillStyle = 'cyan';
      ctx.fillText(word, tx + 30, ty + 15);
      ctx.fillStyle = 'white';
      ctx.fillText(word, tx, ty);
      
      ctx.restore();
  }
}
