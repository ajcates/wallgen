import { Style } from '../core/Style.js';
import { randomRange, mapRange } from '../utils/math.js';

/**
 * MandalaKaleidoscopeStyle: Generates intricate, 2.5D radial mandala patterns.
 * Features: Data-driven symmetry, 4-5 color harmonious palettes,
 * global drop shadows for depth, gradient highlights, and decorative insets.
 */
export class MandalaKaleidoscopeStyle extends Style {
  constructor(config = {}) {
    super(config);
    this.palette = [];
    this.layers = [];
    this.symmetry = 8;
    this.bgDark = '#111';
  }

  async init(data) {
    await super.init(data);
    if (!data || data.length === 0) return;

    this._generatePalette(data);
    // Symmetry from 6 to 16 based on uptime
    this.symmetry = 6 + (data[0].up % 11);
    this._generateLayers(data);
  }

  _generatePalette(data) {
    const lastEntry = data[data.length - 1];
    this.palette = [];
    
    // Base hue tied to battery percentage
    const baseHue = mapRange(lastEntry.bp, 0, 100, 0, 360);
    
    // Strict 4-color harmonies
    const harmonyType = lastEntry.up % 4;
    let offsets = [0, 90, 180, 270]; // Square
    if (harmonyType === 1) offsets = [0, 30, 180, 210]; // Double Complementary
    if (harmonyType === 2) offsets = [0, 40, 80, 120]; // Analogous
    if (harmonyType === 3) offsets = [0, 120, 180, 300]; // Split-Complementary Variant
    
    offsets.forEach(offset => {
        this.palette.push({
            h: (baseHue + offset) % 360,
            s: mapRange(lastEntry.fm, 0, 100, 70, 90),
            l: mapRange(lastEntry.pt, 0, 100, 40, 60)
        });
    });
    
    // Dark background
    this.bgDark = `hsl(${baseHue}, 30%, 5%)`;
  }

  _getColorString(colorObj, lightnessOffset = 0) {
      let l = colorObj.l + lightnessOffset;
      l = Math.max(0, Math.min(100, l));
      return `hsl(${colorObj.h}, ${colorObj.s}%, ${l}%)`;
  }

  _generateLayers(data) {
      this.layers = [];
      const maxRadius = Math.min(this.width, this.height) * 0.45;
      
      // Generate a random number of layers (between 12 and 30)
      const numLayers = Math.floor(randomRange(12, 30));
      
      for (let i = 0; i < numLayers; i++) {
          const log = data[i % data.length];
          
          // Random radius, but biased slightly so we don't get too many tiny ones
          const radius = randomRange(maxRadius * 0.1, maxRadius);
          
          this.layers.push({
              radius: radius,
              color: this.palette[Math.floor(Math.random() * 4)],
              shapeType: Math.floor(Math.random() * 4),
              widthFactor: randomRange(0.3, 2.0),
              insetDepth: randomRange(2, 18),
              hasGroove: Math.random() > 0.4,
              hasDots: Math.random() > 0.7,
              // Snapping rotation to either 0 or a half-step of the symmetry 
              // ensures the mandala feels "ordered" and perfectly symmetrical.
              rotationOffset: (Math.floor(Math.random() * 2) * Math.PI) / this.symmetry,
              // For 2.5D, we generally want smaller objects on top of larger ones
              // or vice-versa. Sorting by radius is the most reliable "layered" look.
              renderPriority: radius 
          });
      }
      
      // Sort by radius descending: largest (outer) layers drawn first, 
      // smallest (inner) layers drawn last so they appear "on top".
      this.layers.sort((a, b) => b.renderPriority - a.renderPriority);
  }

  render(ctx, width, height) {
    // 1. Background
    ctx.fillStyle = this.bgDark;
    ctx.fillRect(0, 0, width, height);
    
    // 2. Background radial grooves
    this._renderBackgroundGrooves(ctx, width, height);

    // 3. Move to center for radial symmetry
    ctx.translate(width / 2, height / 2);

    // 4. Render each layer in a kaleidoscope pattern
    this.layers.forEach((layer, index) => {
        for (let s = 0; s < this.symmetry; s++) {
            ctx.save();
            ctx.rotate((Math.PI * 2 / this.symmetry) * s + layer.rotationOffset);
            this._render2_5DShape(ctx, layer, index);
            ctx.restore();
        }
    });
  }

  _renderBackgroundGrooves(ctx, width, height) {
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.lineWidth = 1;
      const maxR = Math.max(width, height) * 0.8;
      
      // Draw subtle concentric rings based on data
      for (let r = 40; r < maxR; r += 30 + (this.data[0].up % 20)) {
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          
          // Groove shadow
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.stroke();
          
          // Groove highlight
          ctx.beginPath();
          ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.stroke();
      }
      ctx.restore();
  }

  _render2_5DShape(ctx, layer, index) {
      const { radius, color, shapeType, widthFactor, insetDepth, hasGroove, hasDots } = layer;
      
      const angleStep = Math.PI / this.symmetry;
      // Calculate half-width of the slice based on radius and symmetry
      const w = radius * Math.tan(angleStep) * widthFactor;
      
      ctx.save();
      
      // Global Drop Shadow for 2.5D depth
      // Because shadow offset ignores context rotation, the light source 
      // appears to come from a consistent global direction (top-down).
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 8;
      
      // Construct main path
      this._buildPath(ctx, shapeType, radius, w);
      
      // Gradient for main shape to give volume
      const grad = ctx.createLinearGradient(0, 0, 0, radius);
      grad.addColorStop(0, this._getColorString(color, 15)); // Lighter towards center
      grad.addColorStop(1, this._getColorString(color, -10)); // Darker towards edge
      
      ctx.fillStyle = grad;
      ctx.fill();
      
      // Clear shadow for subsequent strokes and insets
      ctx.shadowColor = 'transparent';
      
      // Outer Edge Highlight
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.stroke();

      // Outer Edge Shadow/Bevel
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      this._buildPath(ctx, shapeType, radius - 1, w - 1);
      ctx.stroke();
      
      // Render intricate groove/inset if applicable
      if (hasGroove && radius > insetDepth * 2) {
          ctx.save();
          
          // Path for the inset
          this._buildPath(ctx, shapeType, radius - insetDepth, w * 0.7);
          
          // Inset gradient (inverted for recessed look)
          const insetGrad = ctx.createLinearGradient(0, 0, 0, radius);
          insetGrad.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
          insetGrad.addColorStop(1, 'rgba(255, 255, 255, 0.15)');
          
          ctx.fillStyle = insetGrad;
          ctx.fill();
          
          // Inner edge shadow (dark)
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.stroke();
          
          // Inner edge highlight (light)
          this._buildPath(ctx, shapeType, radius - insetDepth + 1, w * 0.7 - 1);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.stroke();
          
          // Central raised part inside the groove
          if ((radius + w) % 2 > 1 && radius > insetDepth * 3) {
              ctx.save();
              ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
              ctx.shadowBlur = 5;
              ctx.shadowOffsetY = 4;
              
              this._buildPath(ctx, shapeType, radius - insetDepth * 1.5, w * 0.4);
              ctx.fillStyle = this._getColorString(color, 5); // Slightly brighter
              ctx.fill();
              
              ctx.shadowColor = 'transparent';
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
              ctx.lineWidth = 1;
              ctx.stroke();
              ctx.restore();
          }
          ctx.restore();
      }

      // Decorative dots
      if (hasDots && radius > 30) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetY = 2;
          ctx.beginPath();
          ctx.arc(0, radius * 0.85, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowColor = 'transparent';
      }
      
      ctx.restore();
  }

  _buildPath(ctx, type, radius, w) {
      ctx.beginPath();
      // Keep shapes slightly away from the exact center to form a central hub
      const innerRadius = radius * 0.15; 
      
      if (type === 0) { // Petal
          ctx.moveTo(0, innerRadius);
          ctx.quadraticCurveTo(w, radius * 0.6, 0, radius);
          ctx.quadraticCurveTo(-w, radius * 0.6, 0, innerRadius);
      } else if (type === 1) { // Chevron
          ctx.moveTo(0, innerRadius);
          ctx.lineTo(w, radius * 0.7);
          ctx.lineTo(0, radius);
          ctx.lineTo(-w, radius * 0.7);
          ctx.closePath();
      } else if (type === 2) { // Arch
          const angle = Math.atan2(w, radius);
          ctx.arc(0, 0, radius, Math.PI / 2 - angle, Math.PI / 2 + angle);
          ctx.arc(0, 0, innerRadius, Math.PI / 2 + angle, Math.PI / 2 - angle, true);
          ctx.closePath();
      } else { // Diamond / Kite
          ctx.moveTo(0, innerRadius);
          ctx.lineTo(w * 0.7, radius * 0.5);
          ctx.lineTo(0, radius);
          ctx.lineTo(-w * 0.7, radius * 0.5);
          ctx.closePath();
      }
  }
}
