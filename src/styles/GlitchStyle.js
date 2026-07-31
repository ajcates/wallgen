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
    this.dataStreams = [];
    this.macroblocks = [];
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
    this._generateDataStreams(data);
    this._generateMacroblocks(data);
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
        '#ffff00', // WARNING YELLOW
        '#ff00ff'  // MAGENTA
    ];
  }

  _generateBusLines() {
    this.busLines = [];
    const count = 40;
    for (let i = 0; i < count; i++) {
        this.busLines.push({
            pos: randomRange(0, i % 2 === 0 ? this.width : this.height),
            isVertical: i % 2 === 0,
            opacity: randomRange(0.02, 0.12),
            width: randomRange(1, 4)
        });
    }
  }

  _generateSlices(data) {
    this.slices = [];
    const intensity = 120 * this.noiseLevel;
    for (let i = 0; i < intensity; i++) {
        this.slices.push({
            y: randomRange(0, this.height),
            h: randomRange(1, 150),
            offset: randomRange(-this.width * 0.4, this.width * 0.4),
            color: this.glitchColors[Math.floor(Math.random() * this.glitchColors.length)],
            flicker: Math.random() > 0.7,
            isInverted: Math.random() > 0.92,
            isDisplaced: Math.random() > 0.8
        });
    }
  }

  _generateArtifacts(data) {
    this.artifacts = [];
    data.filter((_, i) => i % 2 === 0).forEach((log, i) => {
        this.artifacts.push({
            x: randomRange(0, this.width),
            y: randomRange(0, this.height),
            w: mapRange(log.bp, 0, 100, 40, 600),
            h: mapRange(log.fm, 0, 100, 40, 4),
            color: this.glitchColors[i % this.glitchColors.length],
            label: `ERR_0x${log.pt.toString(16).toUpperCase()}`,
            opacity: randomRange(0.3, 0.8)
        });
    });
  }

  _generatePixelSorts(data) {
    this.pixelSorts = [];
    const count = 60;
    for (let i = 0; i < count; i++) {
        const log = data[i % data.length];
        this.pixelSorts.push({
            x: randomRange(0, this.width),
            y: randomRange(0, this.height),
            w: randomRange(1, 25),
            h: mapRange(log.up % 1000, 0, 1000, 100, 1500),
            color: this.glitchColors[Math.floor(Math.random() * 4)],
            jagged: Math.random() > 0.5
        });
    }
  }

  _generateUIBlocks(data) {
      this.uiBlocks = [];
      const count = 8;
      for (let i = 0; i < count; i++) {
          const log = data[Math.floor(Math.random() * data.length)];
          this.uiBlocks.push({
              x: randomRange(50, this.width - 300),
              y: randomRange(100, this.height - 500),
              w: randomRange(150, 300),
              h: randomRange(100, 250),
              title: `SUBSYS_${log.hh}:${log.mm}`,
              progress: log.bp / 100,
              isError: Math.random() > 0.6,
              id: (Math.random() * 10000 | 0).toString(16)
          });
      }
  }

  _generateWireframes(data) {
      this.wireframes = [];
      const count = 15;
      for (let i = 0; i < count; i++) {
          const points = Array.from({length: Math.floor(randomRange(3, 6))}, () => ({
              x: randomRange(-150, 150),
              y: randomRange(-150, 150)
          }));
          this.wireframes.push({
              x: randomRange(0, this.width),
              y: randomRange(0, this.height),
              points,
              rotation: Math.random() * Math.PI * 2,
              color: this.glitchColors[Math.floor(Math.random() * this.glitchColors.length)]
          });
      }
  }

  _generateDataStreams(data) {
    this.dataStreams = [];
    const count = 20;
    for (let i = 0; i < count; i++) {
        this.dataStreams.push({
            x: randomRange(0, this.width),
            y: randomRange(0, this.height),
            speed: randomRange(5, 20),
            length: Math.floor(randomRange(10, 30)),
            chars: Array.from({length: 30}, () => (Math.random() * 16 | 0).toString(16).toUpperCase())
        });
    }
  }

  _generateMacroblocks(data) {
      this.macroblocks = [];
      const count = 40;
      for (let i = 0; i < count; i++) {
          this.macroblocks.push({
              x: Math.floor(randomRange(0, this.width) / 64) * 64, // Grid aligned
              y: Math.floor(randomRange(0, this.height) / 64) * 64,
              w: 64 * Math.floor(randomRange(1, 4)),
              h: 64 * Math.floor(randomRange(1, 4)),
              color: this.glitchColors[Math.floor(Math.random() * this.glitchColors.length)],
              type: Math.random() > 0.5 ? 'noise' : 'solid',
              opacity: randomRange(0.1, 0.4)
          });
      }
  }

  render(ctx, width, height) {
    this._renderBackground(ctx, width, height);
    this._renderByteNoise(ctx, width, height);
    this._renderMacroblocks(ctx);
    this._renderDigitalNoise(ctx, width, height);
    this._renderBusLines(ctx, width, height);
    this._renderDataStreams(ctx);
    this._renderWireframes(ctx);
    this._renderPixelSorts(ctx);
    this._renderSlices(ctx, width, height);
    this._renderWaveDistortion(ctx, width, height);
    this._renderChromaticAberration(ctx);
    this._renderUIBlocks(ctx);
    this._renderArtifacts(ctx);
    this._renderScanlines(ctx, width, height);
    this._renderBlockyScanlines(ctx, width, height);
    this._renderDeadPixels(ctx, width, height);
    this._renderColorInversion(ctx, width, height);
    this._renderDataStaircase(ctx, width, height);
    this._renderOverlayText(ctx, width, height);
  }

  _renderBackground(ctx, width, height) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    // Faint grid
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 100;
    ctx.beginPath();
    for (let x = 0; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  _renderDigitalNoise(ctx, width, height) {
    ctx.save();
    const size = 4;
    for (let i = 0; i < 1500; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#00ffcc';
        ctx.globalAlpha = randomRange(0, 0.08);
        ctx.fillRect(Math.random() * width, Math.random() * height, size, size);
    }
    ctx.restore();
  }

  _renderDeadPixels(ctx, width, height) {
      ctx.save();
      const count = 50;
      for (let i = 0; i < count; i++) {
          const x = Math.floor(Math.random() * width);
          const y = Math.floor(Math.random() * height);
          ctx.fillStyle = Math.random() > 0.5 ? '#ff0055' : '#ffffff';
          ctx.globalAlpha = 0.8;
          ctx.fillRect(x, y, 2, 2);
      }
      ctx.restore();
  }

  _renderBlockyScanlines(ctx, width, height) {
      ctx.save();
      const count = 10;
      for (let i = 0; i < count; i++) {
          const y = randomRange(0, height);
          const h = randomRange(2, 20);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          if (Math.random() > 0.7) ctx.fillStyle = 'rgba(255, 0, 85, 0.1)';
          ctx.fillRect(0, y, width, h);
      }
      ctx.restore();
  }

  _renderBusLines(ctx, width, height) {
    this.busLines.forEach(line => {
        ctx.fillStyle = Math.random() > 0.9 ? this.glitchColors[4] : '#fff';
        ctx.globalAlpha = line.opacity;
        if (line.isVertical) {
            ctx.fillRect(line.pos, 0, line.width, height);
        } else {
            ctx.fillRect(0, line.pos, width, line.width);
        }
    });
    ctx.globalAlpha = 1.0;
  }

  _renderDataStreams(ctx) {
    ctx.save();
    ctx.font = '10px monospace';
    this.dataStreams.forEach(stream => {
        ctx.fillStyle = '#00ffcc';
        ctx.globalAlpha = 0.3;
        stream.chars.forEach((char, i) => {
            const y = (stream.y + i * 15) % this.height;
            ctx.fillText(char, stream.x, y);
        });
    });
    ctx.restore();
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
          
          if (Math.random() > 0.8) {
              ctx.fillStyle = w.color;
              ctx.globalAlpha = 0.1;
              ctx.fill();
          }

          // Draw "vertices"
          w.points.forEach(p => {
              ctx.fillStyle = '#fff';
              ctx.globalAlpha = 0.8;
              ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
          });
          ctx.restore();
      });
  }

  _renderPixelSorts(ctx) {
      this.pixelSorts.forEach(ps => {
          const grad = ctx.createLinearGradient(ps.x, ps.y, ps.x, ps.y + ps.h);
          grad.addColorStop(0, 'white');
          grad.addColorStop(0.1, ps.color);
          grad.addColorStop(0.5, ps.color);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.globalAlpha = 0.4;
          
          if (ps.jagged) {
              const segments = 5;
              const segH = ps.h / segments;
              for (let i = 0; i < segments; i++) {
                  const offset = (Math.random() - 0.5) * 10;
                  ctx.fillRect(ps.x + offset, ps.y + i * segH, ps.w, segH);
              }
          } else {
              ctx.fillRect(ps.x, ps.y, ps.w, ps.h);
          }
      });
      ctx.globalAlpha = 1.0;
  }

  _renderSlices(ctx, width, height) {
    this.slices.forEach(s => {
        if (s.flicker && Math.random() > 0.5) return;
        
        if (s.isDisplaced) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(0, s.y, width, s.h);
        }

        ctx.fillStyle = s.color;
        ctx.globalAlpha = 0.15 * this.noiseLevel;
        ctx.fillRect(s.offset, s.y, width, s.h);
        
        if (Math.random() > 0.98) {
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = 0.9;
            ctx.fillRect(0, s.y, width, 2);
        }
    });
    ctx.globalAlpha = 1.0;
  }

  _renderWaveDistortion(ctx, width, height) {
      const count = 5;
      for (let i = 0; i < count; i++) {
          const y = randomRange(0, height);
          const h = randomRange(50, 200);
          const freq = randomRange(0.01, 0.05);
          const amp = randomRange(10, 50);
          
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, y, width, h);
          ctx.clip();
          
          ctx.strokeStyle = 'rgba(0, 255, 204, 0.2)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let lx = 0; lx < width; lx += 10) {
              const ly = y + h/2 + Math.sin(lx * freq) * amp;
              if (lx === 0) ctx.moveTo(lx, ly);
              else ctx.lineTo(lx, ly);
          }
          ctx.stroke();
          ctx.restore();
      }
  }

  _renderChromaticAberration(ctx) {
    const intensity = 40 * this.noiseLevel;
    // Jittered shifts
    for (let i = 0; i < 40; i++) {
        const x = Math.random() * this.width;
        const y = Math.random() * this.height;
        const w = randomRange(100, 600);
        const h = randomRange(2, 8);

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        
        // Red Shift
        ctx.fillStyle = 'rgba(255, 0, 80, 0.6)';
        ctx.fillRect(x - intensity * Math.random(), y, w, h);
        
        // Cyan Shift
        ctx.fillStyle = 'rgba(0, 255, 255, 0.6)';
        ctx.fillRect(x + intensity * Math.random(), y, w, h);
        
        // Yellow Shift (occasional)
        if (Math.random() > 0.8) {
            ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
            ctx.fillRect(x, y + intensity * 0.5, w, h);
        }
        
        ctx.restore();
    }
  }

  _renderColorInversion(ctx, width, height) {
      const count = 3;
      for (let i = 0; i < count; i++) {
          if (Math.random() > 0.7) {
              const x = randomRange(0, width);
              const y = randomRange(0, height);
              const w = randomRange(100, 400);
              const h = randomRange(50, 200);
              
              ctx.save();
              ctx.globalCompositeOperation = 'difference';
              ctx.fillStyle = 'white';
              ctx.fillRect(x, y, w, h);
              ctx.restore();
          }
      }
  }

  _renderUIBlocks(ctx) {
      this.uiBlocks.forEach(block => {
          ctx.save();
          ctx.translate(block.x, block.y);
          
          if (Math.random() > 0.95) {
              ctx.translate((Math.random()-0.5)*20, 0);
          }

          // Shadow/Ghost
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(5, 5, block.w, block.h);

          // Window Frame
          ctx.strokeStyle = block.isError ? '#ff0055' : '#00ffcc';
          ctx.lineWidth = 1;
          ctx.strokeRect(0, 0, block.w, block.h);
          
          // Background
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, block.w, block.h);

          // Title Bar
          ctx.fillStyle = ctx.strokeStyle;
          ctx.globalAlpha = 0.3;
          ctx.fillRect(0, 0, block.w, 25);
          ctx.globalAlpha = 1.0;
          
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px monospace';
          ctx.fillText(block.title, 10, 18);
          ctx.fillText(`ID:${block.id}`, block.w - 60, 18);
          
          // Progress Bar
          const barW = block.w - 40;
          ctx.strokeStyle = '#fff';
          ctx.globalAlpha = 0.3;
          ctx.strokeRect(20, 60, barW, 10);
          ctx.fillStyle = block.isError ? '#ff0055' : '#00ffcc';
          ctx.globalAlpha = 0.8;
          ctx.fillRect(20, 60, barW * block.progress, 10);
          
          // Random Data Strings
          ctx.font = '10px monospace';
          ctx.fillStyle = '#fff';
          ctx.globalAlpha = 0.6;
          ctx.fillText(`MEM_ADDR: 0x${(Math.random()*0xFFFF|0).toString(16).toUpperCase()}`, 20, 90);
          ctx.fillText(`STATUS: ${block.isError ? 'FAULT_DETECTED' : 'RUNNING'}`, 20, 105);
          ctx.fillText(`CORE_TEMP: ${(randomRange(30, 90)).toFixed(1)}°C`, 20, 120);
          
          if (block.isError) {
              ctx.fillStyle = '#ff0055';
              ctx.globalAlpha = Math.random();
              ctx.fillText('!! CRITICAL FAILURE !!', 20, 145);
          }
          
          ctx.restore();
      });
  }

  _renderArtifacts(ctx) {
    this.artifacts.forEach(a => {
        ctx.fillStyle = a.color;
        ctx.globalAlpha = a.opacity;
        ctx.fillRect(a.x, a.y, a.w, a.h);
        
        if (Math.random() > 0.7) {
            ctx.fillStyle = '#fff';
            ctx.font = '10px monospace';
            ctx.globalAlpha = 0.8;
            ctx.fillText(a.label, a.x + 5, a.y + a.h + 12);
        }
        
        // Sub-rectangles for blocky feel
        if (Math.random() > 0.5) {
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = 0.2;
            ctx.fillRect(a.x + randomRange(0, a.w), a.y, randomRange(1, 10), a.h);
        }
    });
    ctx.globalAlpha = 1.0;
  }

  _renderScanlines(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    for (let i = 0; i < height; i += 4) {
        ctx.fillRect(0, i, width, 2);
    }
    
    // Vignette
    const grad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, height);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
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
        ctx.fillText('CRITICAL', width/2 - 300, height/2);
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = '#ff0055';
        ctx.strokeText('CRITICAL', width/2 - 300 + (Math.random()-0.5)*20, height/2 + (Math.random()-0.5)*20);
    }
    
    ctx.restore();
  }

  _renderByteNoise(ctx, width, height) {
      ctx.save();
      const areaCount = 12;
      for (let i = 0; i < areaCount; i++) {
          const ax = randomRange(0, width);
          const ay = randomRange(0, height);
          const aw = randomRange(150, 400);
          const ah = randomRange(40, 120);
          const cellSize = 6;

          for (let x = 0; x < aw; x += cellSize) {
              for (let y = 0; y < ah; y += cellSize) {
                  if (Math.random() > 0.6) {
                      ctx.fillStyle = this.glitchColors[Math.floor(Math.random() * this.glitchColors.length)];
                      ctx.globalAlpha = 0.25;
                      ctx.fillRect(ax + x, ay + y, cellSize - 1, cellSize - 1);
                  }
              }
          }
      }
      ctx.restore();
  }

  _renderMacroblocks(ctx) {
      this.macroblocks.forEach(mb => {
          ctx.save();
          ctx.globalAlpha = mb.opacity;
          if (mb.type === 'solid') {
              ctx.fillStyle = mb.color;
              ctx.fillRect(mb.x, mb.y, mb.w, mb.h);
          } else {
              // Internal mini-noise for the block
              const noiseSize = 8;
              for (let nx = 0; nx < mb.w; nx += noiseSize) {
                  for (let ny = 0; ny < mb.h; ny += noiseSize) {
                      if (Math.random() > 0.5) {
                          ctx.fillStyle = this.glitchColors[Math.floor(Math.random() * this.glitchColors.length)];
                          ctx.fillRect(mb.x + nx, mb.y + ny, noiseSize, noiseSize);
                      }
                  }
              }
          }
          ctx.restore();
      });
  }

  _renderDataStaircase(ctx, width, height) {
      ctx.save();
      const count = 6;
      for (let i = 0; i < count; i++) {
          const x = randomRange(0, width - 300);
          const y = randomRange(0, height - 300);
          const steps = 10;
          const stepW = 40;
          const stepH = 12;
          for (let j = 0; j < steps; j++) {
              ctx.fillStyle = this.glitchColors[Math.floor(Math.random() * this.glitchColors.length)];
              ctx.globalAlpha = 0.2;
              ctx.fillRect(x + j * stepW, y + j * stepH, stepW, stepH);
              
              if (Math.random() > 0.8) {
                  ctx.strokeStyle = '#fff';
                  ctx.lineWidth = 1;
                  ctx.strokeRect(x + j * stepW, y + j * stepH, stepW, stepH);
              }
          }
      }
      ctx.restore();
  }
}
