import { Style } from '../core/Style.js';
import { mapRange, randomRange, lerp } from '../utils/math.js';

/**
 * SynapticEchoStyle: The Latent Manifold
 * An expression of high-dimensional data transformation and neural attention.
 */
export class SynapticEchoStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.nodes = [];
    this.connections = [];
    this.time = 0;
    this.inferenceWave = 0;
    
    // Camera state
    this.cameraRotation = 0;
  }

  static get metadata() {
    return [
      { id: 'manifoldCurvature', name: 'Manifold Curvature', type: 'range', min: 0, max: 2.0, step: 0.1, default: 1.0 },
      { id: 'attentionSparsity', name: 'Attention Sparsity', type: 'range', min: 0.1, max: 1.0, step: 0.05, default: 0.4 },
      { id: 'chromaticDrift', name: 'Chromatic Drift', type: 'range', min: 0, max: 20, default: 5 },
      { id: 'inferenceFrequency', name: 'Inference Waves', type: 'range', min: 0, max: 2.0, step: 0.1, default: 0.5 },
      { id: 'tokenDensity', name: 'Token Density', type: 'range', min: 1, max: 10, default: 5 },
      { id: 'animationSpeed', name: 'Animation Speed', type: 'range', min: 0, max: 5, step: 0.1, default: 1.0 }
    ];
  }

  /**
   * Basic 3D to 2D projection
   */
  _project(x, y, z) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    
    // Apply camera rotation around Y axis
    const cosR = Math.cos(this.cameraRotation);
    const sinR = Math.sin(this.cameraRotation);
    
    const rx = x * cosR - z * sinR;
    const rz = x * sinR + z * cosR;
    
    // Simple perspective projection
    const perspective = 1000 / (1000 + rz);
    
    return {
      x: cx + rx * perspective,
      y: cy + y * perspective,
      z: rz,
      scale: perspective
    };
  }

  async init(data) {
    await super.init(data);
    this._generateTopology(data);
    this._generateConnections();
  }

  _generateConnections() {
    this.connections = [];
    const sparsity = this.config.attentionSparsity || 0.4;
    
    // Connect nodes based on "Attention" (relevance)
    for (let i = 0; i < this.nodes.length; i++) {
        for (let j = i + 1; j < this.nodes.length; j++) {
            const n1 = this.nodes[i];
            const n2 = this.nodes[j];
            
            // Attention Score: How much node I "attends" to node J
            // Based on log similarity and proximity in latent space
            const logSimilarity = 1 - Math.abs(n1.log.bp - n2.log.bp) / 100;
            const latentDist = Math.sqrt((n1.u - n2.u)**2 + (n1.v - n2.u)**2);
            const attentionScore = logSimilarity * (1 - latentDist * 0.5);
            
            if (attentionScore > sparsity) {
                this.connections.push({
                    a: i,
                    b: j,
                    weight: attentionScore
                });
            }
        }
    }
  }

  _generateTopology(data) {
    this.nodes = data.map((log, index) => {
      const hh = Number(log.hh) || 0;
      const mm = Number(log.mm) || 0;
      const bp = Number(log.bp) || 0;
      const fm = Number(log.fm) || 0;
      const pt = Number(log.pt) || 0;

      // Base normalized coordinates in latent space (-1 to 1)
      const u = (index / (data.length - 1)) * 2 - 1;
      const v = (mm / 60) * 2 - 1;
      
      // Token particles for this node
      const tokenCount = this.config.tokenDensity || 5;
      const tokens = Array.from({ length: tokenCount }, () => ({
        offX: randomRange(-20, 20),
        offY: randomRange(-20, 20),
        offZ: randomRange(-20, 20),
        phase: Math.random() * Math.PI * 2
      }));

      return {
        u, v,
        log,
        tokens,
        baseHue: mapRange(bp, 0, 100, 180, 320), // Cyan to Magenta
        entropy: mapRange(fm, 0, 100, 1.0, 0.1), // Low fm = high entropy
        jitter: { x: 0, y: 0, z: 0 }
      };
    });
  }

  _getManifoldPoint(u, v, time) {
    const curve = this.config.manifoldCurvature || 1.0;
    
    // Topology warped by time of day
    const hh = this.data[0]?.hh || 12;
    const timeWarp = (hh / 24) * Math.PI * 2;

    const x = u * this.width * 0.4;
    const z = v * this.width * 0.4;
    
    // The "Manifold Surface" - complex wave interaction
    let y = Math.sin(u * 3 + timeWarp + time) * 100 * curve;
    y += Math.cos(v * 2 + time * 0.5) * 80 * curve;
    y += Math.sin((u + v) * 2 + timeWarp) * 50 * curve;

    return { x, y, z };
  }

  async process() {
    const speed = this.config.animationSpeed || 1.0;
    const waveFreq = this.config.inferenceFrequency || 0.5;
    
    this.time += 0.01 * speed;
    this.cameraRotation += 0.002 * speed;
    
    // Inference Wave: A ripple that moves through latent space
    this.inferenceWave += 0.02 * speed * waveFreq;
    if (this.inferenceWave > 5) this.inferenceWave = -2; // Reset wave

    // Update nodes on the manifold
    this.nodes.forEach(node => {
        const pos = this._getManifoldPoint(node.u, node.v, this.time);
        
        // Latent Jitter (Entropy)
        const j = node.entropy * 5 * speed;
        node.jitter.x = (Math.random() - 0.5) * j;
        node.jitter.y = (Math.random() - 0.5) * j;
        node.jitter.z = (Math.random() - 0.5) * j;

        // Wave influence: Proximity to wave front boosts node energy
        const distToWave = Math.abs(node.u - (this.inferenceWave - 1));
        node.waveBoost = Math.max(0, 1 - distToWave * 2);

        node.x = pos.x + node.jitter.x;
        node.y = pos.y + node.jitter.y;
        node.z = pos.z + node.jitter.z;

        // Animate tokens
        node.tokens.forEach(t => {
            t.phase += 0.05 * speed;
        });
    });
  }

  render(ctx, width, height) {
    // 1. Project all nodes
    this.nodes.forEach(node => {
        node.projected = this._project(node.x, node.y, node.z);
    });

    // 2. Clear background with radial gradient
    const bgGrad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width);
    bgGrad.addColorStop(0, '#050a15');
    bgGrad.addColorStop(1, '#020205');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 3. Render Connections (Synapses)
    const drift = this.config.chromaticDrift || 5;
    
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    
    this.connections.forEach(c => {
        const n1 = this.nodes[c.a].projected;
        const n2 = this.nodes[c.b].projected;
        
        // Skip if too far behind camera
        if (n1.z > 800 || n2.z > 800) return;

        const weight = c.weight;
        const alpha = weight * 0.2 * (1 + this.nodes[c.a].waveBoost * 0.5);
        const hue = this.nodes[c.a].baseHue;

        // Chromatic Drift: Render line with slight color offsets
        const drawLine = (offX, color) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = weight * 1.5;
            ctx.beginPath();
            ctx.moveTo(n1.x + offX, n1.y);
            ctx.lineTo(n2.x + offX, n2.y);
            ctx.stroke();
        };

        if (drift > 0) {
            drawLine(-drift, `hsla(${hue}, 100%, 50%, ${alpha * 0.5})`); // Red-ish drift
            drawLine(drift, `hsla(${(hue + 40) % 360}, 100%, 50%, ${alpha * 0.5})`); // Blue-ish drift
        }
        drawLine(0, `hsla(${hue}, 100%, 80%, ${alpha})`);
    });
    ctx.restore();

    // 4. Render Nodes (Token Clouds)
    // Sort by depth for correct layering
    const sortedNodes = [...this.nodes].sort((a, b) => b.projected.z - a.projected.z);

    sortedNodes.forEach(node => {
        const p = node.projected;
        if (p.z > 900) return;

        ctx.save();
        ctx.globalAlpha = 0.8 * (1 + node.waveBoost);
        
        node.tokens.forEach(t => {
            const tx = p.x + Math.cos(t.phase) * t.offX * p.scale;
            const ty = p.y + Math.sin(t.phase) * t.offY * p.scale;
            const size = (2 + Math.sin(t.phase * 2) * 1) * p.scale;

            const glowSize = size * 4;
            const grad = ctx.createRadialGradient(tx, ty, 0, tx, ty, glowSize);
            grad.addColorStop(0, `hsla(${node.baseHue}, 100%, 70%, 0.3)`);
            grad.addColorStop(1, 'transparent');
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(tx, ty, glowSize, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = `hsla(${node.baseHue}, 100%, 90%, 1)`;
            ctx.beginPath();
            ctx.arc(tx, ty, size * 0.5, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    });
  }
}
