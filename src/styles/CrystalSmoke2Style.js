import { Style } from '../core/Style.js';
import { mapRange, distance, randomRange, dot, lerp } from '../utils/math.js';

/**
 * CrystalSmoke2Style: A copy of CrystalSmokeStyle for experimentation.
 */
export class CrystalSmoke2Style extends Style {
  constructor(config = {}) {
    super(config);
    this.palette = [];
    this.paletteStrings = [];
    this.lightSource = { angle: 0, x: 0, y: 0, tint: '' };
    this.shards = [];
    this.dust = [];
    this.bgSmokePuffs = [];
    this.fgSmokePuffs = [];
    this.boilingFlasks = [];
  }

  async init(data) {
    await super.init(data);
    if (!data || data.length === 0) return;

    this._initPalette(data[0]);
    this._initLighting(data[data.length - 1]);
    this._generateShards(data);
    this._generateSmoke(data);
    this._generateBoilingFlasks(data);
  }

  _initPalette(firstEntry) {
    // Natural mineral/glass tones: smoky quartz, pale ice, warm amber, soft amethyst.
    // Muted saturation and gentle base lightness so shards read as real translucent
    // material rather than glowing neon signage.
    const naturalHues = [32, 200, 45, 265]; // Amber, ice-blue, gold, muted violet
    this.palette = naturalHues.map(h => ({
        h: h + (Math.random() - 0.5) * 16,
        s: 35 + Math.random() * 15, // Muted, believable saturation
        l: 18 // Dark enough base to hold depth without looking flat-black
    }));

    this.paletteStrings = this.palette.map(c => `hsl(${c.h}, ${c.s}%, ${c.l}%)`);
  }

  _initLighting(lastEntry) {
    const hour = lastEntry.hh + (lastEntry.mm / 60);
    const angle = mapRange(hour, 0, 24, 0, Math.PI * 2);

    // Natural light color temperature keyed to time of day: cool moonlight at
    // night, warm amber at dawn/dusk, near-neutral daylight at midday.
    let lightHue, lightSat;
    if (hour < 5 || hour >= 21) { lightHue = 215; lightSat = 35; } // Moonlight, cool blue
    else if (hour < 8 || hour >= 18) { lightHue = 28; lightSat = 65; } // Dawn/dusk, warm amber
    else { lightHue = 42; lightSat = 20; } // Midday, near-neutral warm white

    // Soft, physically modest lighting intensity (0.12 - 0.3)
    const lightIntensity = mapRange(lastEntry.bp, 0, 100, 0.12, 0.3);

    this.lightSource = {
        angle,
        x: Math.cos(angle),
        y: Math.sin(angle),
        tint: `hsla(${lightHue}, ${lightSat}%, 82%, ${lightIntensity})`,
        hue: lightHue,
        sat: lightSat
    };
  }

  _generateShards(data) {
    this.shards = [];
    this.dust = [];

    // Increase number of potential shard locations with more randomness
    const anchorCount = 8;
    const anchors = [];
    for (let i = 0; i < anchorCount; i++) {
        anchors.push({
            x: randomRange(this.width * 0.1, this.width * 0.9),
            y: randomRange(this.height * 0.1, this.height * 0.9)
        });
    }

    data.filter((_, i) => i % 2 === 0).forEach((log, i) => {
      const anchor = anchors[i % anchors.length];
      // Use a wider spread for placement
      const offsetX = (Math.random() - 0.5) * this.width * 0.8;
      const offsetY = (Math.random() - 0.5) * this.height * 0.8;

      const cx = this.wrapX(anchor.x + offsetX);
      const cy = this.wrapY(anchor.y + offsetY);

      // Use a power-law-like distribution for size: many small, few very large
      const baseSize = mapRange(log.fm, 0, 100, 15, 120);
      const sizeMult = Math.pow(Math.random(), 2) * 2.5 + 0.5;
      const size = baseSize * sizeMult;

      // Randomize "stretch" for aggressive cyber-spikes
      const stretchX = randomRange(0.3, 3.0);
      const stretchY = randomRange(0.3, 3.0);

      const points = [];
      const numPoints = 3 + Math.floor(Math.random() * 5); // 3 to 7 points
      const shardBase = this.palette[i % this.palette.length];

      // Generate irregular points with varying radii
      for (let j = 0; j < numPoints; j++) {
        const angle = (j / numPoints) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const r = size * (0.3 + Math.random() * 1.2);
        points.push({
          x: cx + Math.cos(angle) * r * stretchX,
          y: cy + Math.sin(angle) * r * stretchY,
          angle
        });
      }

      // Add "internal" depth by jittering the center point for each facet
      const facets = points.map((p, j) => {
        const nextP = points[(j + 1) % points.length];

        // Calculate a mid-point for lighting normal
        const midAngle = (p.angle + nextP.angle) / 2;
        const nx = Math.cos(midAngle);
        const ny = Math.sin(midAngle);
        const l = dot(nx, ny, this.lightSource.x, this.lightSource.y);

        // Jitter the "center" of the shard for this specific facet to create more complex 3D-like geometry
        const facetCx = cx + (Math.random() - 0.5) * (size * 0.4);
        const facetCy = cy + (Math.random() - 0.5) * (size * 0.4);

        const brightness = mapRange(l, -1, 1, 5, 85);

        return {
          p1: p,
          p2: nextP,
          cx: facetCx,
          cy: facetCy,
          color: `hsla(${lerp(shardBase.h, this.lightSource.hue, 0.25)}, ${shardBase.s}%, ${brightness}%, 0.22)`,
          edgeColor: `hsla(${this.lightSource.hue}, ${this.lightSource.sat}%, 92%, 0.6)`,
          brightness
        };
      });

      this.shards.push({
        cx,
        cy,
        facets,
        size,
        hue: shardBase.h,
        outlineAlpha: randomRange(0.15, 0.22),
        subShards: this._generateSubShards(cx, cy, size, shardBase.h, i)
      });

      // Dust generation tied more to shard size
      const dustCount = Math.floor(size / 10) + 5;
      for (let k = 0; k < dustCount; k++) {
        this.dust.push({
           x: this.wrapX(cx + (Math.random() - 0.5) * size * 4),
           y: this.wrapY(cy + (Math.random() - 0.5) * size * 4),
           size: Math.random() * 1.5 + 0.5,
           hue: (k % 2 === 0) ? shardBase.h : this.lightSource.hue,
           alpha: Math.random() * 0.3 + 0.05
        });
      }
    });
  }

  _generateSubShards(parentCx, parentCy, parentSize, hue, index) {
    const subShards = [];
    const count = Math.floor(Math.random() * 3) + 1; // 1 to 3 sub-shards

    for (let s = 0; s < count; s++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = parentSize * randomRange(0.6, 1.1);
      const cx = this.wrapX(parentCx + Math.cos(angle) * dist);
      const cy = this.wrapY(parentCy + Math.sin(angle) * dist);
      const size = parentSize * randomRange(0.3, 0.7);

      const points = [];
      const numPoints = 3 + (s % 3);

      for (let j = 0; j < numPoints; j++) {
        const pAngle = (j / numPoints) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const r = size * (0.4 + Math.random() * 0.8);
        points.push({
          x: cx + Math.cos(pAngle) * r,
          y: cy + Math.sin(pAngle) * r,
          angle: pAngle
        });
      }

      const facets = points.map((p, j) => {
        const nextP = points[(j + 1) % points.length];
        const nx = Math.cos((p.angle + nextP.angle) / 2);
        const ny = Math.sin((p.angle + nextP.angle) / 2);
        const l = dot(nx, ny, this.lightSource.x, this.lightSource.y);
        const brightness = mapRange(l, -1, 1, 5, 80);

        return {
          p1: p,
          p2: nextP,
          cx: cx + (Math.random() - 0.5) * (size * 0.3),
          cy: cy + (Math.random() - 0.5) * (size * 0.3),
          color: `hsla(${lerp(hue, this.lightSource.hue, 0.2)}, 40%, ${brightness}%, 0.2)`,
          edgeColor: `hsla(${this.lightSource.hue}, ${this.lightSource.sat}%, 92%, 0.55)`,
          brightness
        };
      });

      subShards.push({ cx, cy, facets, size, hue, outlineAlpha: randomRange(0.1, 0.16) });
    }
    return subShards;
  }

  _generateSmoke(data) {
    this.bgSmokePuffs = [];
    this.fgSmokePuffs = [];
    data.filter((_, i) => i % 2 === 0).forEach((log, i) => {
      const startX = this.wrapX(mapRange(log.mm, 0, 60, 0, this.width));
      const startY = this.wrapY(mapRange(log.hh, 0, 24, 0, this.height));
      const length = mapRange(log.up % 3600, 0, 3600, 400, 1500);
      const baseAngle = mapRange(log.pt, 0, 1000, 0, Math.PI * 2);
      const baseColor = this.palette[i % this.palette.length];

      const numPuffs = 80; // Increased count
      for (let j = 0; j < numPuffs; j++) {
          const t = j / (numPuffs - 1);

          // Multi-frequency turbulence
          const f1 = 7, a1 = 60;
          const f2 = 19, a2 = 25;
          const f3 = 3, a3 = 100;

          const turb1 = Math.sin(t * f1 + i) * a1 * t;
          const turb2 = Math.sin(t * f2 + i * 1.5) * a2 * t;
          const turb3 = Math.cos(t * f3 + i * 0.5) * a3 * (1-t);

          // Helix twirl to mix colors together
          // Every path twirls, but phase offset by index to braid them
          const twirlRadius = t * 250; // Expands outward as smoke rises
          const twirlPhase = i * Math.PI * 0.6; // Braid different logs together
          const twirlAngle = t * Math.PI * 8 + twirlPhase;
          const swirlX = Math.cos(twirlAngle) * twirlRadius;
          const swirlY = Math.sin(twirlAngle) * twirlRadius;

          const angle = baseAngle + Math.sin(t * 2 + i) * 0.3;
          const dist = t * length;

          const x = this.wrapX(startX + Math.cos(angle) * dist + turb1 + turb2 + swirlX);
          const y = this.wrapY(startY + Math.sin(angle) * dist + turb3 + swirlY);

          // BG Layer (larger, fainter)
          this.bgSmokePuffs.push({
              x: x + (Math.random() - 0.5) * 120 * t,
              y: y + (Math.random() - 0.5) * 120 * t,
              size: mapRange(t, 0, 1, 100, 600) * (0.8 + Math.random() * 0.4),
              alpha: mapRange(t, 0, 1, 0.03, 0.0005) * (0.6 + Math.random() * 0.4),
              hue: (baseColor.h + (t * 40)) % 360,
              aspect: randomRange(0.5, 0.76),
              rotation: angle + twirlAngle + Math.PI / 2
          });

          // FG Layer (smaller, denser)
          this.fgSmokePuffs.push({
              x: x + (Math.random() - 0.5) * 40 * t,
              y: y + (Math.random() - 0.5) * 40 * t,
              size: mapRange(t, 0, 1, 30, 250) * (0.8 + Math.random() * 0.4),
              alpha: mapRange(t, 0, 1, 0.08, 0.002) * (0.6 + Math.random() * 0.4),
              hue: (baseColor.h + (t * 20)) % 360,
              aspect: randomRange(0.38, 0.68),
              rotation: angle + twirlAngle + Math.PI / 2
          });

          // Occasional branching whisp in FG
          if (j % 8 === 0 && j > 0) {
            const whispCount = 8;
            const whispAngle = angle + (Math.random() - 0.5) * Math.PI * 1.5;
            for (let k = 0; k < whispCount; k++) {
              const wt = k / whispCount;
              const wDist = wt * 150 * t;
              this.fgSmokePuffs.push({
                x: this.wrapX(x + Math.cos(whispAngle) * wDist),
                y: this.wrapY(y + Math.sin(whispAngle) * wDist),
                size: (15 + (1 - wt) * 50) * t,
                alpha: 0.02 * (1 - wt),
                hue: (baseColor.h + 60) % 360,
                aspect: randomRange(0.28, 0.5),
                rotation: whispAngle
              });
            }
          }
      }
    });
  }

  _generateBoilingFlasks(data) {
    this.boilingFlasks = [];
    const shortSide = Math.min(this.width, this.height);
    const minRadius = Math.max(18, shortSide * 0.038);
    const maxRadius = Math.max(minRadius + 7, Math.min(68, shortSide * 0.078));
    const flaskCount = Math.min(12, Math.max(6, Math.round(data.length * 0.6)));
    const depthProfiles = {
      far: { scale: 0.82, opacity: 0.68, blur: 1.15 },
      mid: { scale: 0.96, opacity: 0.86, blur: 0.25 },
      near: { scale: 1.08, opacity: 0.98, blur: 0 }
    };

    const choosePosition = (radius, neckHeight, tilt) => {
      const horizontalMargin = radius * 1.08 + Math.abs(Math.sin(tilt)) * neckHeight + 4;
      const verticalMargin = radius * 1.08 + Math.abs(Math.cos(tilt)) * neckHeight + 4;
      const minX = Math.min(this.width / 2, horizontalMargin);
      const maxX = Math.max(this.width / 2, this.width - horizontalMargin);
      const minY = Math.min(
        this.height / 2,
        Math.max(verticalMargin, this.height * 0.1)
      );
      const maxY = Math.max(
        this.height / 2,
        Math.min(this.height - radius * 1.08, this.height * 0.9)
      );
      let best = { x: this.width / 2, y: this.height / 2, clearance: -Infinity };

      // Keep the best of several candidates. A small amount of overlap remains
      // possible, but dense accidental knots are strongly discouraged.
      for (let attempt = 0; attempt < 36; attempt++) {
        const x = randomRange(minX, maxX);
        const y = randomRange(minY, maxY);
        const clearance = this.boilingFlasks.length === 0
          ? radius
          : Math.min(...this.boilingFlasks.map(other => (
              distance({ x, y }, other) - (radius + other.radius) * 0.76
            )));

        if (clearance > best.clearance) best = { x, y, clearance };
        if (clearance > radius * 0.32) break;
      }
      return best;
    };

    for (let i = 0; i < flaskCount; i++) {
      const depth = ['mid', 'far', 'near'][i % 3];
      const depthProfile = depthProfiles[depth];
      const radius = randomRange(minRadius, maxRadius) * depthProfile.scale;
      const liquidLevel = randomRange(0.2, 0.38);
      const liquidSurfaceY = radius - radius * 2 * liquidLevel;

      const neckWidth = radius * randomRange(0.4, 0.5);
      const neckHeight = radius * randomRange(2.25, 3.05);
      const horizontal = i % 4 === 1;
      const horizontalDirection = i % 8 === 1 ? 1 : -1;
      const tilt = horizontal
        ? horizontalDirection * randomRange(1.32, 1.48)
        : randomRange(-0.16, 0.16);
      const position = choosePosition(radius, neckHeight, tilt);
      const liquidHue = this.palette[(i + 1) % this.palette.length].h;
      const crystalHue = (liquidHue + randomRange(-16, 16) + 360) % 360;
      const meltHue = (liquidHue + randomRange(10, 24)) % 360;
      const crystalLoad = ['sparse', 'balanced', 'dense'][(i + Math.floor(i / 3)) % 3];
      const crystalCountRange = {
        sparse: [1, 2],
        balanced: [3, 5],
        dense: [6, 9]
      }[crystalLoad];
      const crystalCount = crystalCountRange[0]
        + Math.floor(Math.random() * (crystalCountRange[1] - crystalCountRange[0] + 1));
      const crystalWidthRange = crystalLoad === 'dense'
        ? [0.1, 0.21]
        : crystalLoad === 'sparse' ? [0.18, 0.34] : [0.14, 0.28];
      const crystals = Array.from({ length: crystalCount }, () => {
        const baseY = Math.min(
          radius * 0.7,
          liquidSurfaceY + radius * randomRange(0.08, 0.26)
        );
        const width = radius * randomRange(...crystalWidthRange);
        return {
          x: randomRange(-radius * 0.5, radius * 0.5),
          baseY,
          width,
          height: radius * randomRange(0.28, 0.62),
          lean: width * randomRange(-0.42, 0.42),
          melt: randomRange(0.22, 0.78),
          drips: Array.from({ length: 1 + Math.floor(Math.random() * 2) }, () => ({
            offsetX: width * randomRange(-0.35, 0.35),
            length: radius * randomRange(0.08, 0.24),
            bend: width * randomRange(-0.5, 0.5)
          }))
        };
      });
      const meltVeins = Array.from({ length: 2 + (i % 3) }, (_, veinIndex) => ({
        startX: randomRange(-radius * 0.62, -radius * 0.16),
        endX: randomRange(radius * 0.16, radius * 0.62),
        y: liquidSurfaceY + radius * randomRange(0.12, 0.55),
        bow: radius * randomRange(-0.18, 0.18),
        width: radius * randomRange(0.012, 0.026),
        alpha: randomRange(0.16, 0.3),
        hue: veinIndex % 2 === 0 ? crystalHue : meltHue
      }));
      const ventSide = i % 2 === 0 ? 1 : -1;
      const ventAngle = -Math.PI / 2 + ventSide * Math.PI / 2;
      const ventX = Math.cos(ventAngle) * radius * 0.86;
      const ventY = Math.sin(ventAngle) * radius * 0.86;
      const ventPuffCount = 13 + (i % 5);
      const ventVapor = Array.from({ length: ventPuffCount }, (_, puffIndex) => {
        const t = (puffIndex + 1) / ventPuffCount;
        const travel = radius * (0.08 + t * 2.45);
        const curl = Math.sin(t * Math.PI * 2.2 + i) * radius * 0.32 * t;
        return {
          x: ventX + Math.cos(ventAngle) * travel + Math.cos(ventAngle + Math.PI / 2) * curl,
          y: ventY + Math.sin(ventAngle) * travel + Math.sin(ventAngle + Math.PI / 2) * curl,
          size: radius * randomRange(0.12 + t * 0.12, 0.2 + t * 0.3),
          alpha: 0.055 + Math.pow(1 - t, 1.12) * 0.34,
          aspect: randomRange(0.22, 0.5),
          rotation: ventAngle + randomRange(-0.22, 0.22)
        };
      });

      this.boilingFlasks.push({
        x: position.x,
        y: position.y,
        radius,
        hue: this.palette[i % this.palette.length].h,
        liquidHue,
        crystalHue,
        meltHue,
        liquidLevel,
        neckWidth,
        neckHeight,
        lipWidth: neckWidth * randomRange(1.18, 1.32),
        tilt,
        contentTilt: -tilt,
        horizontal,
        ventAngle,
        ventX,
        ventY,
        ventVapor,
        depth,
        opacity: depthProfile.opacity,
        blur: depthProfile.blur,
        placementClearance: position.clearance,
        etched: i % 3 === 0,
        etchSide: i % 2 === 0 ? -1 : 1,
        causticStrength: depth === 'near' ? 0.2 : depth === 'mid' ? 0.13 : 0.08,
        crystalLoad,
        meltVeins,
        crystals
      });
    }
  }

  async process() {}

  render(ctx, width, height) {
    const farFlasks = this.boilingFlasks.filter(flask => flask.depth === 'far');
    const midFlasks = this.boilingFlasks.filter(flask => flask.depth === 'mid');
    const nearFlasks = this.boilingFlasks.filter(flask => flask.depth === 'near');

    this._renderBackground(ctx, width, height);
    this._renderSmoke(ctx, this.bgSmokePuffs);
    this._renderBoilingFlasks(ctx, farFlasks);
    this._renderShards(ctx);
    this._renderBoilingFlasks(ctx, midFlasks);
    this._renderSmoke(ctx, this.fgSmokePuffs);
    this._renderBoilingFlasks(ctx, nearFlasks);
    this._renderBloom(ctx);
    this._renderTexture(ctx, width, height);
  }

  _renderBackground(ctx, width, height) {
    // True black background for depth
    ctx.fillStyle = '#020202';
    ctx.fillRect(0, 0, width, height);

    const grad = ctx.createRadialGradient(
      width * 0.5, height * 0.5, 0,
      width * 0.5, height * 0.5, width * 1.5
    );
    grad.addColorStop(0, `hsla(${this.lightSource.hue}, 18%, 5%, 1)`);
    grad.addColorStop(1, '#000000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  _renderSmoke(ctx, puffArray) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over'; // Volumetric occlusion, like real smoke self-shadowing

    puffArray.forEach(p => {
        // Real smoke reads as near-neutral grey with only a whisper of hue —
        // saturation stays low across the whole falloff so it never tips into a
        // colored fog/gas look.
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
        grad.addColorStop(0, `hsla(${p.hue}, 8%, 38%, ${p.alpha * 4.0})`); // Lit, opaque core
        grad.addColorStop(0.3, `hsla(${p.hue}, 8%, 22%, ${p.alpha * 3.0})`);
        grad.addColorStop(0.7, `hsla(${p.hue}, 6%, 10%, ${p.alpha * 1.5})`);
        grad.addColorStop(0.9, `hsla(${p.hue}, 5%, 3%, ${p.alpha * 0.5})`);
        grad.addColorStop(1, 'transparent');

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.scale(1, p.aspect);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // A faint pass of light catching the near side of the densest puffs, as if
    // a single practical light were grazing the smoke — soft and desaturated,
    // never a hard neon spark.
    ctx.globalCompositeOperation = 'soft-light';
    const lightHue = this.lightSource.hue;
    const lightSat = this.lightSource.sat;
    puffArray.forEach(p => {
        if (p.alpha > 0.05 && p.size < 150) {
            const lx = p.x - this.lightSource.x * p.size * 0.4;
            const ly = p.y - this.lightSource.y * p.size * 0.4;
            ctx.save();
            ctx.translate(lx, ly);
            ctx.rotate(p.rotation);
            ctx.scale(1, p.aspect);
            ctx.fillStyle = `hsla(${lightHue}, ${lightSat}%, 75%, ${p.alpha * 2.5})`;
            ctx.beginPath();
            ctx.arc(0, 0, p.size * 0.35, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    });

    ctx.restore();
  }

  _renderBloom(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Tight specular bloom for crystalline facets — small and bright like real
    // light catching a glass edge, not a wide neon halo.
    this.shards.forEach(s => {
      s.facets.forEach(f => {
        if (f.brightness > 78) {
          ctx.shadowBlur = mapRange(f.brightness, 78, 100, 4, 14);
          ctx.shadowColor = `hsla(${this.lightSource.hue}, ${this.lightSource.sat}%, 80%, 0.9)`;
          ctx.fillStyle = f.color;
          ctx.beginPath();
          ctx.moveTo(f.cx, f.cy);
          ctx.lineTo(f.p1.x, f.p1.y);
          ctx.lineTo(f.p2.x, f.p2.y);
          ctx.closePath();
          ctx.fill();
        }
      });

      s.subShards.forEach(ss => {
        ss.facets.forEach(f => {
          if (f.brightness > 82) {
            ctx.shadowBlur = 8;
            ctx.shadowColor = `hsla(${this.lightSource.hue}, ${this.lightSource.sat}%, 80%, 0.9)`;
            ctx.fillStyle = f.color;
            ctx.beginPath();
            ctx.moveTo(f.cx, f.cy);
            ctx.lineTo(f.p1.x, f.p1.y);
            ctx.lineTo(f.p2.x, f.p2.y);
            ctx.closePath();
            ctx.fill();
          }
        });
      });
    });

    // Bloom for smoke cores removed to avoid cheesy bokeh effect

    ctx.restore();
  }

  _renderShards(ctx) {
    this.shards.forEach(s => {
      // Soft ambient occlusion/scatter around the cluster, not a colored halo
      const atmosGlow = ctx.createRadialGradient(s.cx, s.cy, 0, s.cx, s.cy, s.size * 3);
      atmosGlow.addColorStop(0, `hsla(${s.hue}, 30%, 40%, 0.06)`);
      atmosGlow.addColorStop(1, 'transparent');
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = atmosGlow;
      ctx.beginPath();
      ctx.arc(s.cx, s.cy, s.size * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Render sub-shards first (they are "behind")
      s.subShards.forEach(ss => this._drawShard(ctx, ss));

      // Render main shard
      this._drawShard(ctx, s);
    });

    ctx.globalCompositeOperation = 'screen';
    this.dust.forEach(d => {
        const depth = Math.abs(d.size - 1.0) * 1.5;
        const blurAmt = Math.min(6, Math.max(0, depth * 3 - 1));
        if (blurAmt > 0) ctx.filter = `blur(${blurAmt}px)`;
        else ctx.filter = 'none';

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${d.hue}, 25%, 82%, ${d.alpha})`;
        ctx.fill();
    });
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
  }

  _drawShard(ctx, s) {
    ctx.save();
    // Calculate Depth of Field for shard
    const targetSize = 65;
    const depth = Math.abs(s.size - targetSize) / 40;
    const blurAmt = Math.min(5.5, Math.max(0, depth * 4.2 - 1.4));
    if (blurAmt > 0) ctx.filter = `blur(${blurAmt}px)`;
    else ctx.filter = 'none';

    // Subtle shadow
    ctx.save();
    ctx.translate(5, 8);
    ctx.beginPath();
    s.facets.forEach((f, i) => {
      if (i === 0) ctx.moveTo(f.p1.x, f.p1.y);
      ctx.lineTo(f.p2.x, f.p2.y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.restore();

    // Render facets
    s.facets.forEach(f => {
      ctx.beginPath();
      ctx.moveTo(f.cx, f.cy);
      ctx.lineTo(f.p1.x, f.p1.y);
      ctx.lineTo(f.p2.x, f.p2.y);
      ctx.closePath();

      const grad = ctx.createLinearGradient(f.cx, f.cy, (f.p1.x + f.p2.x)/2, (f.p1.y + f.p2.y)/2);
      grad.addColorStop(0, f.color);
      grad.addColorStop(1, `hsla(${this.lightSource.hue}, 40%, ${Math.max(2, f.brightness - 20)}%, 0.7)`);

      ctx.fillStyle = grad;
      ctx.fill();

      // Glassy inner reflection
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.moveTo(f.p1.x, f.p1.y);
      ctx.lineTo(f.cx, f.cy);
      ctx.lineTo((f.p1.x + f.p2.x)/2, (f.p1.y + f.p2.y)/2);
      ctx.fill();
      ctx.restore();

      // Outlines removed; let the facets and reflections define the shape

      // High-contrast specular line strictly on the inner ridge, colored by
      // the actual light source rather than the material's own hue
      if (f.brightness > 70) {
          ctx.beginPath();
          ctx.moveTo(f.cx, f.cy);
          ctx.lineTo(f.p1.x, f.p1.y);
          ctx.strokeStyle = `hsla(${this.lightSource.hue}, ${this.lightSource.sat}%, 95%, 0.7)`;
          ctx.lineWidth = 1.25;
          ctx.stroke();
      }
    });

    // A quiet outer edge keeps background crystals legible through the smoke
    // while preserving their translucent, low-contrast role.
    ctx.beginPath();
    s.facets.forEach((facet, index) => {
      if (index === 0) ctx.moveTo(facet.p1.x, facet.p1.y);
      ctx.lineTo(facet.p2.x, facet.p2.y);
    });
    ctx.closePath();
    ctx.strokeStyle = `hsla(${this.lightSource.hue}, ${Math.min(this.lightSource.sat, 28)}%, 78%, ${s.outlineAlpha})`;
    ctx.lineWidth = Math.max(0.55, Math.min(1.4, s.size * 0.012));
    ctx.stroke();

    // Soft ambient falloff around the shard, not a saturated glow
    const glow = ctx.createRadialGradient(s.cx, s.cy, 0, s.cx, s.cy, s.size * 1.2);
    glow.addColorStop(0, `hsla(${s.hue}, 25%, 55%, 0.06)`);
    glow.addColorStop(1, 'transparent');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.cx, s.cy, s.size * 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Glass reflection from nearby shapes
    let nearestDist = Infinity;
    let nearestHue = null;
    let nearestDx = 0;
    let nearestDy = 0;
    this.shards.forEach(other => {
        if (other === s) return;
        const d = distance({ x: s.cx, y: s.cy }, { x: other.cx, y: other.cy });
        if (d < s.size * 6 && d < nearestDist) {
            nearestDist = d; nearestHue = other.hue;
            nearestDx = other.cx - s.cx; nearestDy = other.cy - s.cy;
        }
    });
    this.boilingFlasks.forEach(other => {
        const d = distance({ x: s.cx, y: s.cy }, other);
        if (d < s.size * 6 && d < nearestDist) {
            nearestDist = d; nearestHue = other.hue;
            nearestDx = other.x - s.cx; nearestDy = other.y - s.cy;
        }
    });
    if (nearestHue !== null) {
        const angle = Math.atan2(nearestDy, nearestDx);
        const rx = s.cx + Math.cos(angle) * (s.size * 0.7);
        const ry = s.cy + Math.sin(angle) * (s.size * 0.7);
        const rGrad = ctx.createRadialGradient(rx, ry, 0, rx, ry, s.size * 0.6);
        rGrad.addColorStop(0, `hsla(${nearestHue}, 40%, 70%, 0.22)`);
        rGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = rGrad;
        ctx.beginPath();
        ctx.arc(rx, ry, s.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
    }

    // A small, bright Fresnel catch-light near the shard's core, like real
    // light concentrating through glass — tight and mostly white, not a glow
    const coreGlow = ctx.createRadialGradient(s.cx, s.cy, 0, s.cx, s.cy, s.size * 0.22);
    coreGlow.addColorStop(0, `hsla(${this.lightSource.hue}, ${Math.min(this.lightSource.sat, 30)}%, 92%, 0.5)`);
    coreGlow.addColorStop(0.5, `hsla(${s.hue}, 20%, 55%, 0.15)`);
    coreGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(s.cx, s.cy, s.size * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // Restores from globalCompositeOperation='screen' block

    ctx.filter = 'none';
    ctx.restore(); // Restores from the top-level DoF save
  }

  _traceBoilingFlask(ctx, flask) {
    const R = flask.radius;
    const W = flask.neckWidth / 2;
    const top = -R - flask.neckHeight;
    const joinX = R * 0.5;
    const joinY = -Math.sqrt(R * R - joinX * joinX);
    const leftJoinAngle = Math.atan2(joinY, -joinX);
    const rightJoinAngle = Math.atan2(joinY, joinX);

    ctx.beginPath();
    ctx.moveTo(-W, top);
    ctx.lineTo(-W, -R * 0.96);
    ctx.quadraticCurveTo(-W, -R * 0.9, -joinX, joinY);
    ctx.arc(0, 0, R, leftJoinAngle, rightJoinAngle, true);
    ctx.quadraticCurveTo(W, -R * 0.9, W, -R * 0.96);
    ctx.lineTo(W, top);
    ctx.closePath();
  }

  _renderBoilingFlasks(ctx, flasks = this.boilingFlasks) {
    flasks.forEach(flask => {
      const R = flask.radius;
      const W = flask.neckWidth / 2;
      const top = -R - flask.neckHeight;
      const liquidY = R - R * 2 * flask.liquidLevel;

      // A soft contact shadow gives the round bulb mass without separating it
      // from the smoky atmosphere with a neon halo.
      ctx.save();
      ctx.translate(flask.x, flask.y);
      ctx.rotate(flask.tilt);
      ctx.globalAlpha = flask.opacity * 0.72;
      ctx.filter = `blur(${Math.max(3, R * 0.12 + flask.blur)}px)`;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
      ctx.beginPath();
      ctx.ellipse(R * 0.08, R * 0.82, R * 0.72, R * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(flask.x, flask.y);
      ctx.rotate(flask.tilt);
      ctx.globalAlpha = flask.opacity;
      if (flask.blur > 0) ctx.filter = `blur(${flask.blur}px)`;
      const localLightAngle = this.lightSource.angle - flask.tilt;
      const highlightSide = Math.cos(localLightAngle) >= 0 ? 1 : -1;

      // Wisps begin just beyond the side vent and curl outward. Drawing them
      // before the vessel lets the rim cleanly occlude each plume's origin.
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.beginPath();
      ctx.moveTo(flask.ventX, flask.ventY);
      flask.ventVapor.forEach(puff => ctx.lineTo(puff.x, puff.y));
      ctx.strokeStyle = `hsla(${this.lightSource.hue}, 10%, 64%, 0.24)`;
      ctx.lineWidth = Math.max(0.9, R * 0.055);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = `hsla(${this.lightSource.hue}, 10%, 74%, 0.24)`;
      ctx.shadowBlur = R * 0.2;
      ctx.stroke();
      ctx.shadowBlur = 0;
      flask.ventVapor.forEach(puff => {
        ctx.save();
        ctx.translate(puff.x, puff.y);
        ctx.rotate(puff.rotation);
        ctx.scale(1, puff.aspect);
        const vaporGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, puff.size);
        vaporGradient.addColorStop(0, `hsla(${this.lightSource.hue}, 10%, 68%, ${puff.alpha})`);
        vaporGradient.addColorStop(0.42, `hsla(${flask.meltHue}, 8%, 40%, ${puff.alpha * 0.62})`);
        vaporGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = vaporGradient;
        ctx.beginPath();
        ctx.arc(0, 0, puff.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      ctx.restore();

      // A narrow projected caustic gives the glass a relationship to the scene
      // lighting without surrounding every flask with a generic glow.
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.translate(
        Math.cos(localLightAngle) * R * 0.52,
        Math.sin(localLightAngle) * R * 0.52
      );
      ctx.rotate(localLightAngle);
      ctx.scale(1, 0.34);
      const caustic = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.05);
      caustic.addColorStop(0, `hsla(${flask.meltHue}, 42%, 68%, ${flask.causticStrength})`);
      caustic.addColorStop(0.48, `hsla(${this.lightSource.hue}, 24%, 72%, ${flask.causticStrength * 0.42})`);
      caustic.addColorStop(1, 'transparent');
      ctx.fillStyle = caustic;
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Crystals soften into a low liquid pool inside one continuous flask.
      ctx.save();
      this._traceBoilingFlask(ctx, flask);
      ctx.clip();
      ctx.save();
      ctx.rotate(flask.contentTilt);

      const liquidGradient = ctx.createLinearGradient(0, liquidY, 0, R);
      liquidGradient.addColorStop(0, `hsla(${flask.liquidHue}, 46%, 62%, 0.26)`);
      liquidGradient.addColorStop(0.5, `hsla(${flask.meltHue}, 52%, 38%, 0.5)`);
      liquidGradient.addColorStop(1, `hsla(${flask.meltHue}, 58%, 18%, 0.72)`);
      ctx.fillStyle = liquidGradient;
      ctx.fillRect(-R * 1.12, liquidY, R * 2.24, R * 1.15 - liquidY);

      flask.crystals.forEach(crystal => {
        const halfWidth = crystal.width / 2;
        const tipX = crystal.x + crystal.lean;
        const tipY = crystal.baseY - crystal.height;
        const crystalGradient = ctx.createLinearGradient(0, tipY, 0, crystal.baseY);
        crystalGradient.addColorStop(0, `hsla(${flask.crystalHue}, 34%, 92%, ${0.72 - crystal.melt * 0.18})`);
        crystalGradient.addColorStop(0.52, `hsla(${flask.crystalHue}, 48%, 58%, ${0.68 - crystal.melt * 0.16})`);
        crystalGradient.addColorStop(1, `hsla(${flask.meltHue}, 58%, 34%, ${0.42 - crystal.melt * 0.2})`);

        ctx.beginPath();
        ctx.moveTo(crystal.x - halfWidth, crystal.baseY);
        ctx.lineTo(crystal.x - halfWidth * 0.74, crystal.baseY - crystal.height * 0.48);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(crystal.x + halfWidth * 0.68, crystal.baseY - crystal.height * 0.42);
        ctx.lineTo(crystal.x + halfWidth, crystal.baseY);
        ctx.closePath();
        ctx.fillStyle = crystalGradient;
        ctx.fill();
        ctx.strokeStyle = `hsla(${flask.crystalHue}, 24%, 94%, ${0.62 - crystal.melt * 0.24})`;
        ctx.lineWidth = Math.max(0.55, R * 0.012);
        ctx.stroke();

        // A single inner ridge keeps each exposed tip crystalline while its
        // lower edge becomes increasingly translucent and fluid.
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(crystal.x - halfWidth * 0.12, crystal.baseY);
        ctx.strokeStyle = `hsla(${flask.hue}, 24%, 88%, 0.36)`;
        ctx.lineWidth = Math.max(0.45, R * 0.008);
        ctx.stroke();

        const dissolveGlow = ctx.createRadialGradient(
          crystal.x, crystal.baseY, 0,
          crystal.x, crystal.baseY, crystal.width * 1.15
        );
        dissolveGlow.addColorStop(0, `hsla(${flask.meltHue}, 62%, 62%, ${0.28 + crystal.melt * 0.18})`);
        dissolveGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = dissolveGlow;
        ctx.beginPath();
        ctx.arc(crystal.x, crystal.baseY, crystal.width * 1.15, 0, Math.PI * 2);
        ctx.fill();

        crystal.drips.forEach(drip => {
          const startX = crystal.x + drip.offsetX;
          const endY = Math.min(R * 0.84, crystal.baseY + drip.length);
          ctx.beginPath();
          ctx.moveTo(startX, crystal.baseY - R * 0.015);
          ctx.bezierCurveTo(
            startX, crystal.baseY + drip.length * 0.3,
            startX + drip.bend, endY - drip.length * 0.2,
            startX + drip.bend, endY
          );
          ctx.strokeStyle = `hsla(${flask.meltHue}, 56%, 58%, ${0.28 + crystal.melt * 0.34})`;
          ctx.lineWidth = Math.max(0.7, crystal.width * (0.09 + crystal.melt * 0.08));
          ctx.lineCap = 'round';
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(startX + drip.bend, endY, Math.max(0.7, crystal.width * 0.08), 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${flask.meltHue}, 54%, 62%, ${0.34 + crystal.melt * 0.3})`;
          ctx.fill();
        });
      });

      // This translucent pass visually dissolves the submerged crystal bases
      // into the liquid instead of leaving hard polygons below the meniscus.
      ctx.fillStyle = `hsla(${flask.meltHue}, 52%, 38%, 0.16)`;
      ctx.fillRect(-R * 1.1, liquidY, R * 2.2, R * 1.12 - liquidY);

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      flask.meltVeins.forEach(vein => {
        ctx.beginPath();
        ctx.moveTo(vein.startX, vein.y);
        ctx.bezierCurveTo(
          vein.startX * 0.35, vein.y + vein.bow,
          vein.endX * 0.35, vein.y - vein.bow,
          vein.endX, vein.y + vein.bow * 0.25
        );
        ctx.strokeStyle = `hsla(${vein.hue}, 48%, 70%, ${vein.alpha})`;
        ctx.lineWidth = vein.width;
        ctx.lineCap = 'round';
        ctx.stroke();
      });
      ctx.restore();

      ctx.beginPath();
      ctx.ellipse(0, liquidY, Math.sqrt(Math.max(0, R * R - liquidY * liquidY)) * 0.92, R * 0.05, 0, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${flask.crystalHue}, 45%, 78%, 0.2)`;
      ctx.fill();
      ctx.strokeStyle = `hsla(${flask.crystalHue}, 32%, 88%, 0.46)`;
      ctx.lineWidth = Math.max(0.8, R * 0.018);
      ctx.stroke();

      // Counter-rotate only the contents so the pool and loose crystal mass
      // remain level under gravity while the glass vessel turns around them.
      ctx.restore();

      // Subtle axial bands make the neck read as hollow borosilicate glass.
      const neckGradient = ctx.createLinearGradient(-W, 0, W, 0);
      neckGradient.addColorStop(0, 'rgba(222, 238, 240, 0.22)');
      neckGradient.addColorStop(0.32, 'rgba(255, 255, 255, 0.025)');
      neckGradient.addColorStop(0.76, 'rgba(255, 255, 255, 0.04)');
      neckGradient.addColorStop(1, 'rgba(204, 226, 230, 0.18)');
      ctx.fillStyle = neckGradient;
      ctx.fillRect(-W, top, W * 2, flask.neckHeight + R * 0.25);
      ctx.restore();

      // Edge density and a cool Fresnel rim retain Smoke II's photographic,
      // translucent material treatment across the newly recognizable shape.
      this._traceBoilingFlask(ctx, flask);
      const glassGradient = ctx.createRadialGradient(-R * 0.28, -R * 0.32, R * 0.08, 0, 0, R * 1.08);
      glassGradient.addColorStop(0, 'rgba(255, 255, 255, 0.055)');
      glassGradient.addColorStop(0.68, `hsla(${flask.hue}, 18%, 40%, 0.035)`);
      glassGradient.addColorStop(0.9, `hsla(${flask.hue}, 20%, 16%, 0.2)`);
      glassGradient.addColorStop(1, 'rgba(218, 235, 238, 0.2)');
      ctx.fillStyle = glassGradient;
      ctx.fill();
      ctx.strokeStyle = 'rgba(218, 235, 238, 0.48)';
      ctx.lineWidth = Math.max(1, R * 0.018);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, R * 0.86, localLightAngle - 0.34, localLightAngle + 0.34);
      ctx.strokeStyle = `hsla(${this.lightSource.hue}, ${this.lightSource.sat}%, 88%, ${flask.causticStrength * 0.9})`;
      ctx.lineWidth = Math.max(0.8, R * 0.045);
      ctx.lineCap = 'round';
      ctx.stroke();

      // The vent is exactly perpendicular to the neck axis and remains attached
      // to the flask when horizontal variants rotate as a whole.
      ctx.beginPath();
      ctx.ellipse(
        flask.ventX,
        flask.ventY,
        R * 0.115,
        R * 0.055,
        flask.ventAngle + Math.PI / 2,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = 'rgba(3, 7, 8, 0.82)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(230, 242, 244, 0.58)';
      ctx.lineWidth = Math.max(0.7, R * 0.018);
      ctx.stroke();

      // Rolled lip and dark opening distinguish laboratory glassware from a
      // plain sphere with a rectangle attached.
      ctx.beginPath();
      ctx.ellipse(0, top, flask.lipWidth / 2, W * 0.27, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(4, 8, 9, 0.58)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(232, 244, 246, 0.7)';
      ctx.lineWidth = Math.max(1, R * 0.022);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, top, W * 0.72, W * 0.13, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Only a few vessels carry etched graduations, keeping the detail
      // believable and preventing a uniform technical-pattern overlay.
      if (flask.etched) {
        ctx.save();
        ctx.strokeStyle = 'rgba(224, 238, 240, 0.3)';
        ctx.lineWidth = Math.max(0.5, R * 0.01);
        for (let mark = 0; mark < 5; mark++) {
          const y = top + flask.neckHeight * (0.2 + mark * 0.13);
          const length = W * (mark % 2 === 0 ? 0.58 : 0.38);
          ctx.beginPath();
          ctx.moveTo(flask.etchSide * W * 0.82, y);
          ctx.lineTo(flask.etchSide * (W * 0.82 - length), y);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.76, 1.22, 1.62);
        ctx.strokeStyle = 'rgba(224, 238, 240, 0.18)';
        ctx.stroke();
        ctx.restore();
      }

      // Long, broken highlights tie the neck into the globe instead of leaving
      // a seam where the two pieces meet.
      ctx.beginPath();
      ctx.moveTo(highlightSide * W * 0.62, top + R * 0.08);
      ctx.lineTo(highlightSide * W * 0.62, -R * 0.82);
      ctx.bezierCurveTo(
        highlightSide * R * 0.38, -R * 0.72,
        highlightSide * R * 0.72, -R * 0.42,
        highlightSide * R * 0.69, -R * 0.05
      );
      ctx.strokeStyle = 'rgba(246, 250, 250, 0.58)';
      ctx.lineWidth = Math.max(0.8, R * 0.021);
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(highlightSide * R * 0.34, -R * 0.34, R * 0.2, R * 0.09, highlightSide * Math.PI / 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
      ctx.fill();

      // Borrow one nearby material color as a restrained curved reflection.
      let nearestDist = Infinity;
      let nearestHue = null;
      let nearestDx = 0;
      let nearestDy = 0;
      [...this.shards, ...this.boilingFlasks].forEach(other => {
        if (other === flask) return;
        const ox = other.cx ?? other.x;
        const oy = other.cy ?? other.y;
        const d = distance(flask, { x: ox, y: oy });
        if (d > 0 && d < R * 6 && d < nearestDist) {
          nearestDist = d;
          nearestHue = other.hue;
          nearestDx = ox - flask.x;
          nearestDy = oy - flask.y;
        }
      });
      if (nearestHue !== null) {
        const localAngle = Math.atan2(nearestDy, nearestDx) - flask.tilt;
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.88, localAngle - Math.PI / 5, localAngle + Math.PI / 5);
        ctx.strokeStyle = `hsla(${nearestHue}, 30%, 78%, 0.34)`;
        ctx.lineWidth = R * 0.1;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  _renderTexture(ctx, width, height) {
    ctx.save();

    const vignette = ctx.createRadialGradient(
        width/2, height/2, width * 0.4,
        width/2, height/2, width * 1.3
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    // Fine photographic film grain
    ctx.globalAlpha = 0.045;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 2500; i++) {
        ctx.fillRect(Math.random() * width, Math.random() * height, 1, Math.random() > 0.5 ? 2 : 1);
    }
    ctx.fillStyle = '#000000';
    for (let i = 0; i < 1500; i++) {
        ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
    }

    // Soft floating dust/haze motes catching the practical light, biased toward
    // the light source direction like real particulates in a beam
    ctx.globalCompositeOperation = 'screen';
    const moteHue = this.lightSource.hue;
    const moteSat = this.lightSource.sat;
    for (let i = 0; i < 60; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = Math.random() * 2.5 + 0.6;
        const alpha = Math.random() * 0.25 + 0.05;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${moteHue}, ${moteSat}%, 85%, 1)`;
        ctx.fill();
    }

    ctx.restore();
  }
}
