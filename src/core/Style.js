/**
 * Base Style class. 
 * Any new generative style should extend this class and implement its methods.
 */
export class Style {
  constructor(config = {}) {
    this.config = config;
    this.width = config.width || 1200;
    this.height = config.height || 800;
  }

  /**
   * Helper to wrap an X coordinate around the canvas width.
   * @param {number} x 
   * @returns {number}
   */
  wrapX(x) {
    return ((x % this.width) + this.width) % this.width;
  }

  /**
   * Helper to wrap a Y coordinate around the canvas height.
   * @param {number} y 
   * @returns {number}
   */
  wrapY(y) {
    return ((y % this.height) + this.height) % this.height;
  }

  /**
   * Generates a harmonious triadic palette.
   * @param {number} hue - Base hue (0-360)
   * @param {number} saturation - Base saturation (0-100)
   * @returns {Object[]} Array of HSL color objects
   */
  generateTriadicPalette(hue, saturation = 70) {
    return [
      { h: hue % 360, s: saturation, l: 45 },                     // Primary
      { h: (hue + 120) % 360, s: Math.max(0, saturation - 15), l: 35 },  // Secondary
      { h: (hue + 240) % 360, s: Math.min(100, saturation + 15), l: 65 }   // Accent
    ];
  }

  /**
   * Called to initialize any state or data for the style.
   * @param {Object[]} data - The parsed log data.
   */
  async init(data) {
    this.data = await this.transform(data);
  }

  /**
   * Optional: Transform data before it is processed (e.g. smoothing, glitching).
   * @param {Object[]} data
   */
  async transform(data) {
    return data;
  }

  /**
   * Run the simulation or processing steps for this style.
   */
  async process() {
    // To be implemented by subclasses
  }

  /**
   * Render the style to the provided canvas context.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} width
   * @param {number} height
   */
  render(ctx, width, height) {
    // To be implemented by subclasses
  }
}
