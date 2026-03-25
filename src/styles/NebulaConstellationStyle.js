import { Style } from '../core/Style.js';
import { mapRange, distance, randomRange } from '../utils/math.js';

/**
 * NebulaConstellationStyle: An organic, celestial visualization.
 * It breaks the grid by using polar coordinates and clustering.
 */
export class NebulaConstellationStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.clusters = [];
    this.allStars = [];
    this.clouds = [];
    this.maxConnectionDist = config.maxConnectionDist || 200;
  }

  async init(data) {
    await super.init(data);
    this._generateCosmos(data);
  }

  _generateCosmos(data) {
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    this.clusters = data.map((log, index) => {
      // 1. Polar Mapping: Time (hh:mm) defines the angle around the center
      const timeVal = log.hh + (log.mm / 60);
      const angle = mapRange(timeVal, 0, 24, 0, Math.PI * 2);
      
      // 2. Spiral/Radial distance influenced by battery and uptime
      // Higher battery = further out, higher uptime = more "drift"
      const baseRadius = mapRange(log.bp, 0, 100, this.width * 0.1, this.width * 0.45);
      const drift = mapRange(log.up % 3600, 0, 3600, -50, 50);
      const r = baseRadius + drift;

      const clusterX = centerX + Math.cos(angle) * r;
      const clusterY = centerY + Math.sin(angle) * r;

      // 3. Create a cluster of stars for each log entry
      const starCount = Math.floor(mapRange(log.pt, 0, 1000, 3, 12));
      const stars = Array.from({ length: starCount }, () => {
        const offX = (Math.random() - 0.5) * 150;
        const offY = (Math.random() - 0.5) * 150;
        return {
          x: clusterX + offX,
          y: clusterY + offY,
          size: randomRange(0.5, 3),
          hue: mapRange(log.bp, 0, 100, 0, 240), // Red to Blue
          opacity: randomRange(0.4, 1),
          phase: Math.random() * Math.PI * 2,
          flicker: mapRange(log.fm, 0, 100, 0.15, 0.02)
        };
      });

      // 4. Create "Gas Clouds" (nebula background)
      if (index % 3 === 0) {
          this.clouds.push({
              x: clusterX + (Math.random() - 0.5) * 200,
              y: clusterY + (Math.random() - 0.5) * 200,
              radius: randomRange(100, 400),
              hue: (mapRange(log.bp, 0, 100, 0, 240) + 20) % 360,
              opacity: randomRange(0.05, 0.15)
          });
      }

      return { x: clusterX, y: clusterY, stars, log };
    });

    this.allStars = this.clusters.flatMap(c => c.stars);
  }

  async process() {
    this.allStars.forEach(star => {
      star.phase += star.flicker;
    });
  }

  render(ctx, width, height) {
    // Fill background with deep cosmic black/blue
    ctx.fillStyle = '#02040a';
    ctx.fillRect(0, 0, width, height);

    // 1. Draw Nebula Clouds (Gaseous layer)
    ctx.globalCompositeOperation = 'screen';
    this.clouds.forEach(cloud => {
      const grad = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.radius);
      grad.addColorStop(0, `hsla(${cloud.hue}, 60%, 20%, ${cloud.opacity})`);
      grad.addColorStop(0.5, `hsla(${cloud.hue}, 60%, 10%, ${cloud.opacity * 0.5})`);
      grad.addColorStop(1, 'transparent');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. Draw Constellation Lines (Inter-cluster connections)
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < this.clusters.length; i++) {
        const c1 = this.clusters[i];
        // Look for nearby clusters to connect to
        for (let j = i + 1; j < this.clusters.length; j++) {
            const c2 = this.clusters[j];
            const d = distance(c1, c2);
            if (d < this.maxConnectionDist) {
                const alpha = mapRange(d, 0, this.maxConnectionDist, 0.4, 0);
                ctx.strokeStyle = `rgba(200, 220, 255, ${alpha})`;
                ctx.beginPath();
                ctx.moveTo(c1.x, c1.y);
                ctx.lineTo(c2.x, c2.y);
                ctx.stroke();
            }
        }
    }

    // 3. Draw Stars
    ctx.globalCompositeOperation = 'source-over';
    this.allStars.forEach(star => {
      const pulse = 0.7 + Math.sin(star.phase) * 0.3;
      const r = star.size * pulse;

      // Glow
      const starGrad = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, r * 4);
      starGrad.addColorStop(0, `hsla(${star.hue}, 100%, 80%, ${star.opacity * 0.6})`);
      starGrad.addColorStop(1, 'transparent');
      
      ctx.fillStyle = starGrad;
      ctx.beginPath();
      ctx.arc(star.x, star.y, r * 4, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = `hsla(${star.hue}, 100%, 95%, ${star.opacity})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. Galactic Center Glow
    const centerGrad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width * 0.8);
    centerGrad.addColorStop(0, 'rgba(20, 30, 60, 0.2)');
    centerGrad.addColorStop(1, 'transparent');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = centerGrad;
    ctx.fillRect(0, 0, width, height);

    // 5. High-density Star Dust
    ctx.globalCompositeOperation = 'lighter';
    for(let i=0; i<400; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const s = Math.random() * 0.7;
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.2})`;
        ctx.fillRect(x, y, s, s);
    }
  }
}
