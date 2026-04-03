import { Style } from '../core/Style.js';
import { mapRange, distance, randomRange } from '../utils/math.js';

export class NebulaConstellationStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.clusters = [];
    this.allStars = [];
    this.nebulaCanvas = null;
    this.starSprite = null;
    this.nebulaRotation = 0;
  }

  static get metadata() {
    return [
      { id: 'maxDist', name: 'Connect Distance', type: 'range', min: 50, max: 500, default: 200 },
      { id: 'starSize', name: 'Star Scale', type: 'range', min: 0.1, max: 3.0, step: 0.1, default: 1.0 },
      { id: 'nebulaOpacity', name: 'Nebula Intensity', type: 'range', min: 0, max: 1.0, step: 0.1, default: 0.5 },
      { id: 'flickerSpeed', name: 'Flicker Speed', type: 'range', min: 0, max: 2.0, step: 0.1, default: 1.0 },
      { id: 'animationSpeed', name: 'Animation Speed', type: 'range', min: 0, max: 5, step: 0.1, default: 1.0 }
    ];
  }

  async init(data) {
    await super.init(data);
    this._generateCosmos(data);
    this._createNebulaCache();
    this._createStarSprite();
  }

  _createStarSprite() {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size * 2;
    canvas.height = size * 2;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(size, size, 0, size, size, size);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.3)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(size, size, size, 0, Math.PI * 2); ctx.fill();
    this.starSprite = canvas;
  }

  _createNebulaCache() {
    this.nebulaCanvas = document.createElement('canvas');
    this.nebulaCanvas.width = this.width;
    this.nebulaCanvas.height = this.height;
    const ctx = this.nebulaCanvas.getContext('2d');
    
    ctx.globalCompositeOperation = 'screen';
    this.clouds.forEach(cloud => {
      const grad = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.radius);
      grad.addColorStop(0, `hsla(${cloud.hue}, 60%, 20%, ${cloud.opacity})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2); ctx.fill();
    });
  }

  _generateCosmos(data) {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    this.clouds = [];

    this.clusters = data.map((log, index) => {
      const timeVal = log.hh + (log.mm / 60);
      const angle = mapRange(timeVal, 0, 24, 0, Math.PI * 2);
      const baseRadius = mapRange(log.bp, 0, 100, this.width * 0.1, this.width * 0.45);
      const r = baseRadius + mapRange(log.up % 3600, 0, 3600, -50, 50);

      const clusterX = centerX + Math.cos(angle) * r;
      const clusterY = centerY + Math.sin(angle) * r;

      const starCount = Math.floor(mapRange(log.pt % 1000, 0, 1000, 3, 12));
      const stars = Array.from({ length: starCount }, () => ({
        x: clusterX + (Math.random() - 0.5) * 150,
        y: clusterY + (Math.random() - 0.5) * 150,
        size: randomRange(0.5, 3) * (this.config.starSize || 1.0),
        hue: mapRange(log.bp, 0, 100, 180, 360), 
        opacity: randomRange(0.4, 1),
        phase: Math.random() * Math.PI * 2,
        flicker: mapRange(log.fm, 0, 100, 0.1, 0.01) * (this.config.flickerSpeed || 1.0)
      }));

      if (index % 3 === 0) {
          this.clouds.push({
              x: clusterX + (Math.random() - 0.5) * 200,
              y: clusterY + (Math.random() - 0.5) * 200,
              radius: randomRange(100, 400),
              hue: (mapRange(log.bp, 0, 100, 200, 300)) % 360,
              opacity: randomRange(0.05, 0.15) * (this.config.nebulaOpacity || 0.5)
          });
      }

      return { x: clusterX, y: clusterY, stars };
    });

    this.allStars = this.clusters.flatMap(c => c.stars);
  }

  async process() {
    const speed = this.config.animationSpeed || 1.0;
    this.allStars.forEach(star => {
      star.phase += star.flicker * speed;
      // Subtle drift
      star.x += Math.cos(star.phase * 0.5) * 0.2 * speed;
      star.y += Math.sin(star.phase * 0.5) * 0.2 * speed;
    });
    this.nebulaRotation += 0.001 * speed;
  }

  render(ctx, width, height) {
    ctx.fillStyle = '#02040a';
    ctx.fillRect(0, 0, width, height);

    // Optimized Nebula from cache
    if (this.nebulaCanvas) {
        ctx.save();
        ctx.translate(width/2, height/2);
        ctx.rotate(this.nebulaRotation);
        ctx.drawImage(this.nebulaCanvas, -width/2, -height/2);
        ctx.restore();
    }

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 0.5;
    const maxD = this.config.maxDist || 200;
    
    // Connect Distance Optimization
    for (let i = 0; i < this.clusters.length; i += 2) {
        const c1 = this.clusters[i];
        for (let j = i + 1; j < this.clusters.length; j += 2) {
            const c2 = this.clusters[j];
            const dx = (c2.x + Math.cos(c2.stars[0].phase * 0.5) * 0.2) - (c1.x + Math.cos(c1.stars[0].phase * 0.5) * 0.2);
            const dy = (c2.y + Math.sin(c2.stars[0].phase * 0.5) * 0.2) - (c1.y + Math.sin(c1.stars[0].phase * 0.5) * 0.2);
            if (Math.abs(dx) < maxD && Math.abs(dy) < maxD) {
                const d = Math.sqrt(dx*dx + dy*dy);
                if (d < maxD) {
                    ctx.strokeStyle = `rgba(200, 220, 255, ${mapRange(d, 0, maxD, 0.2, 0)})`;
                    ctx.beginPath(); 
                    ctx.moveTo(c1.x + Math.cos(c1.stars[0].phase * 0.5) * 0.2, c1.y + Math.sin(c1.stars[0].phase * 0.5) * 0.2); 
                    ctx.lineTo(c2.x + Math.cos(c2.stars[0].phase * 0.5) * 0.2, c2.y + Math.sin(c2.stars[0].phase * 0.5) * 0.2); 
                    ctx.stroke();
                }
            }
        }
    }

    ctx.globalCompositeOperation = 'source-over';
    this.allStars.forEach(star => {
      const r = star.size * (0.8 + Math.sin(star.phase) * 0.2);
      const drawSize = r * 8;
      ctx.globalAlpha = star.opacity;
      ctx.drawImage(this.starSprite, star.x - drawSize/2, star.y - drawSize/2, drawSize, drawSize);
    });
    ctx.globalAlpha = 1.0;
  }
}
