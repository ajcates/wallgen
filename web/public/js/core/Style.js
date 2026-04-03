/**
 * Base Style class for the Browser.
 */
export class Style {
  constructor(config = {}) {
    this.config = config;
    this.width = config.width || 1200;
    this.height = config.height || 800;
  }

  /**
   * Define the editable parameters for the UI.
   * Subclasses should override this.
   */
  static get metadata() {
    return [];
  }

  wrapX(x) {
    return ((x % this.width) + this.width) % this.width;
  }

  wrapY(y) {
    return ((y % this.height) + this.height) % this.height;
  }

  generateTriadicPalette(hue, saturation = 70) {
    return [
      { h: hue % 360, s: saturation, l: 45 },
      { h: (hue + 120) % 360, s: Math.max(0, saturation - 15), l: 35 },
      { h: (hue + 240) % 360, s: Math.min(100, saturation + 15), l: 65 }
    ];
  }

  async init(data) {
    this.data = await this.transform(data);
  }

  async transform(data) {
    return data;
  }

  async process() {
    // To be implemented by subclasses
  }

  render(ctx, width, height) {
    // To be implemented by subclasses
  }
}
