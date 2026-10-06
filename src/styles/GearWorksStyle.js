import { Style } from '../core/Style.js';

const PART_TYPES = ['gear', 'piston', 'pipe'];
const TAU = Math.PI * 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * GearWorksStyle: an abstract flat-lay of disassembled machine parts —
 * toothed gears, hydraulic pistons, and connecting pipework — scattered
 * across a dark oiled-steel backdrop and tied together by rivets and
 * a single accent color drawn from the log data.
 */
export class GearWorksStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.gears = [];
    this.pistons = [];
    this.pipes = [];
    this.rivets = [];
    this.accentHue = 32;
  }

  async init(data) {
    await super.init(data);
    const latest = data?.at(-1) || { hh: 12, mm: 0, bp: 72, fm: 55 };
    this.accentHue = ((latest.bp || 60) * 3.7 + 20) % 360;
    this.driftAngle = ((latest.hh + latest.mm / 60) / 24) * TAU;
    this._generateLayout(latest);
  }

  _generateLayout(latest) {
    const minSide = Math.min(this.width, this.height);
    const gearCount = Math.round(5 + (latest.fm || 50) / 16);
    const pistonCount = Math.round(3 + (latest.bp || 50) / 30);

    this.gears = [];
    for (let index = 0; index < gearCount; index++) {
      const radius = minSide * (0.05 + Math.random() * (index < 2 ? 0.16 : 0.09));
      this.gears.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius,
        toothDepth: radius * (0.16 + Math.random() * 0.08),
        teeth: 8 + Math.floor(Math.random() * 10),
        angle: Math.random() * TAU,
        hubRadius: radius * 0.32,
        boltCount: 4 + Math.floor(Math.random() * 3),
        accented: Math.random() < 0.3,
        z: Math.random()
      });
    }

    this.pistons = [];
    for (let index = 0; index < pistonCount; index++) {
      const length = minSide * (0.28 + Math.random() * 0.3);
      const bodyWidth = minSide * (0.05 + Math.random() * 0.035);
      this.pistons.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        angle: Math.random() * TAU,
        length,
        bodyWidth,
        rodLength: length * (0.45 + Math.random() * 0.4),
        accented: Math.random() < 0.4,
        z: Math.random()
      });
    }

    this.pipes = [];
    const anchors = [...this.gears, ...this.pistons];
    const pipeCount = Math.round(anchors.length * 0.7);
    for (let index = 0; index < pipeCount; index++) {
      const from = anchors[Math.floor(Math.random() * anchors.length)];
      const to = anchors[Math.floor(Math.random() * anchors.length)];
      if (!from || !to || from === to) continue;
      const midX = (from.x + to.x) / 2 + (Math.random() - 0.5) * minSide * 0.3;
      const midY = (from.y + to.y) / 2 + (Math.random() - 0.5) * minSide * 0.3;
      this.pipes.push({
        x1: from.x, y1: from.y,
        cx: midX, cy: midY,
        x2: to.x, y2: to.y,
        width: minSide * (0.012 + Math.random() * 0.014)
      });
    }

    this.rivets = [];
    const rivetCount = Math.round(minSide * 0.05);
    for (let index = 0; index < rivetCount; index++) {
      this.rivets.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: minSide * (0.004 + Math.random() * 0.006)
      });
    }
  }

  async process() {}

  render(ctx, width, height) {
    this._drawBackdrop(ctx, width, height);
    this.pipes.forEach(pipe => this._drawPipe(ctx, pipe));

    const parts = [
      ...this.gears.map(part => ({ type: 'gear', part })),
      ...this.pistons.map(part => ({ type: 'piston', part }))
    ].sort((a, b) => a.part.z - b.part.z);

    parts.forEach(({ type, part }) => {
      if (type === 'gear') this._drawGear(ctx, part);
      else this._drawPiston(ctx, part);
    });

    this.rivets.forEach(rivet => this._drawRivet(ctx, rivet));
    this._drawVignette(ctx, width, height);
  }

  _drawBackdrop(ctx, width, height) {
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#16181b');
    background.addColorStop(0.5, '#26282c');
    background.addColorStop(1, '#101214');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = '#5a6068';
    ctx.lineWidth = 1;
    const grid = Math.max(28, Math.min(width, height) * 0.045);
    for (let x = 0; x < width; x += grid) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += grid) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 140; i++) {
      const x = (Math.sin(i * 91.73) * 0.5 + 0.5) * width;
      const y = (Math.sin(i * 41.17 + 4) * 0.5 + 0.5) * height;
      ctx.fillStyle = i % 3 === 0 ? '#d9d2c7' : '#050607';
      ctx.fillRect(x, y, 1 + (i % 3), 1 + (i % 3));
    }
    ctx.restore();
  }

  _metalGradient(ctx, length, lightAngle) {
    const lightX = Math.cos(lightAngle) * length;
    const lightY = Math.sin(lightAngle) * length;
    const steel = ctx.createLinearGradient(-lightX, -lightY, lightX, lightY);
    steel.addColorStop(0, '#1b2226');
    steel.addColorStop(0.22, '#9aa7ac');
    steel.addColorStop(0.42, '#4b585e');
    steel.addColorStop(0.6, '#c3ced2');
    steel.addColorStop(1, '#232a2e');
    return steel;
  }

  _drawGear(ctx, gear) {
    ctx.save();
    ctx.translate(gear.x, gear.y);
    ctx.rotate(gear.angle);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = gear.radius * 0.25;
    ctx.shadowOffsetX = gear.radius * 0.08;
    ctx.shadowOffsetY = gear.radius * 0.12;

    this._gearPath(ctx, gear.radius, gear.toothDepth, gear.teeth);
    ctx.fillStyle = gear.accented
      ? `hsl(${this.accentHue}, 62%, 42%)`
      : this._metalGradient(ctx, gear.radius, this.driftAngle);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = Math.max(1, gear.radius * 0.02);
    ctx.strokeStyle = 'rgba(10, 12, 13, 0.7)';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, gear.hubRadius, 0, TAU);
    ctx.fillStyle = '#15181a';
    ctx.fill();
    ctx.lineWidth = Math.max(1, gear.radius * 0.015);
    ctx.strokeStyle = 'rgba(220, 220, 220, 0.25)';
    ctx.stroke();

    for (let i = 0; i < gear.boltCount; i++) {
      const boltAngle = (i / gear.boltCount) * TAU;
      const bx = Math.cos(boltAngle) * gear.hubRadius * 0.62;
      const by = Math.sin(boltAngle) * gear.hubRadius * 0.62;
      ctx.beginPath();
      ctx.arc(bx, by, gear.hubRadius * 0.16, 0, TAU);
      ctx.fillStyle = '#3a4046';
      ctx.fill();
    }

    ctx.restore();
  }

  _gearPath(ctx, outerRadius, toothDepth, teeth) {
    const innerRadius = outerRadius - toothDepth;
    const step = TAU / teeth;
    const toothAngle = step * 0.52;
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const base = i * step;
      const a1 = base;
      const a2 = base + toothAngle * 0.5;
      const a3 = base + toothAngle;
      const a4 = base + step * 0.5;
      const x1 = Math.cos(a1) * innerRadius, y1 = Math.sin(a1) * innerRadius;
      const x2 = Math.cos(a2) * outerRadius, y2 = Math.sin(a2) * outerRadius;
      const x3 = Math.cos(a3) * outerRadius, y3 = Math.sin(a3) * outerRadius;
      const x4 = Math.cos(a4) * innerRadius, y4 = Math.sin(a4) * innerRadius;
      if (i === 0) ctx.moveTo(x1, y1); else ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.lineTo(x4, y4);
    }
    ctx.closePath();
  }

  _drawPiston(ctx, piston) {
    ctx.save();
    ctx.translate(piston.x, piston.y);
    ctx.rotate(piston.angle);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = piston.bodyWidth * 0.6;
    ctx.shadowOffsetX = piston.bodyWidth * 0.15;
    ctx.shadowOffsetY = piston.bodyWidth * 0.25;

    const bodyLength = piston.length - piston.rodLength;
    const halfWidth = piston.bodyWidth / 2;
    const bodyStart = -piston.length / 2;

    this._roundedRect(ctx, bodyStart, -halfWidth, bodyLength, piston.bodyWidth, halfWidth * 0.35);
    const bodyGradient = ctx.createLinearGradient(0, -halfWidth, 0, halfWidth);
    bodyGradient.addColorStop(0, '#e2e6e8');
    bodyGradient.addColorStop(0.32, '#7c868c');
    bodyGradient.addColorStop(0.55, '#2c3236');
    bodyGradient.addColorStop(0.78, '#8f989d');
    bodyGradient.addColorStop(1, '#454c50');
    ctx.fillStyle = bodyGradient;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = Math.max(1, piston.bodyWidth * 0.04);
    ctx.strokeStyle = 'rgba(8, 10, 11, 0.7)';
    ctx.stroke();

    const capWidth = piston.bodyWidth * 1.18;
    const capLength = piston.bodyWidth * 0.4;
    this._roundedRect(ctx, bodyStart - capLength * 0.15, -capWidth / 2, capLength, capWidth, capWidth * 0.18);
    ctx.fillStyle = piston.accented ? `hsl(${this.accentHue}, 65%, 40%)` : '#20262a';
    ctx.fill();
    ctx.stroke();

    ctx.lineWidth = Math.max(1, piston.bodyWidth * 0.05);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    for (let i = 1; i <= 3; i++) {
      const sx = bodyStart + (bodyLength * i) / 4;
      ctx.beginPath();
      ctx.moveTo(sx, -halfWidth);
      ctx.lineTo(sx, halfWidth);
      ctx.stroke();
    }

    const rodStart = bodyStart + bodyLength;
    const rodWidth = piston.bodyWidth * 0.28;
    const rodGradient = ctx.createLinearGradient(0, -rodWidth / 2, 0, rodWidth / 2);
    rodGradient.addColorStop(0, '#f2f4f5');
    rodGradient.addColorStop(0.5, '#a6adb1');
    rodGradient.addColorStop(1, '#585f63');
    ctx.fillStyle = rodGradient;
    ctx.fillRect(rodStart, -rodWidth / 2, piston.rodLength, rodWidth);

    ctx.beginPath();
    ctx.arc(rodStart + piston.rodLength, 0, rodWidth * 1.3, 0, TAU);
    ctx.fillStyle = '#1c2124';
    ctx.fill();
    ctx.lineWidth = Math.max(1, rodWidth * 0.2);
    ctx.strokeStyle = 'rgba(210, 210, 210, 0.4)';
    ctx.stroke();

    ctx.restore();
  }

  _drawPipe(ctx, pipe) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = pipe.width * 0.6;

    ctx.beginPath();
    ctx.moveTo(pipe.x1, pipe.y1);
    ctx.quadraticCurveTo(pipe.cx, pipe.cy, pipe.x2, pipe.y2);
    ctx.lineWidth = pipe.width + pipe.width * 0.35;
    ctx.strokeStyle = '#0e1012';
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    const pipeGradient = ctx.createLinearGradient(pipe.x1, pipe.y1, pipe.x2, pipe.y2);
    pipeGradient.addColorStop(0, '#8a949a');
    pipeGradient.addColorStop(0.5, '#3c454a');
    pipeGradient.addColorStop(1, '#7c868c');
    ctx.beginPath();
    ctx.moveTo(pipe.x1, pipe.y1);
    ctx.quadraticCurveTo(pipe.cx, pipe.cy, pipe.x2, pipe.y2);
    ctx.lineWidth = pipe.width;
    ctx.strokeStyle = pipeGradient;
    ctx.stroke();

    [pipe.x1, pipe.x2].forEach((x, i) => {
      const y = i === 0 ? pipe.y1 : pipe.y2;
      ctx.beginPath();
      ctx.arc(x, y, pipe.width * 0.75, 0, TAU);
      ctx.fillStyle = '#2a3034';
      ctx.fill();
      ctx.lineWidth = pipe.width * 0.18;
      ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
      ctx.stroke();
    });

    ctx.restore();
  }

  _drawRivet(ctx, rivet) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(rivet.x, rivet.y, rivet.radius, 0, TAU);
    const gradient = ctx.createRadialGradient(
      rivet.x - rivet.radius * 0.3, rivet.y - rivet.radius * 0.3, 0,
      rivet.x, rivet.y, rivet.radius
    );
    gradient.addColorStop(0, '#e4e7e8');
    gradient.addColorStop(0.5, '#7d868b');
    gradient.addColorStop(1, '#2a2f32');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
  }

  _drawVignette(ctx, width, height) {
    ctx.save();
    const vignette = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.3,
      width / 2, height / 2, Math.max(width, height) * 0.75
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  _roundedRect(ctx, x, y, width, height, radius) {
    const r = clamp(radius, 0, Math.min(width, height) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

export { PART_TYPES };
