import { createCanvas } from '@napi-rs/canvas';
import fs from 'fs/promises';
import path from 'path';

export class WallpaperEngine {
  constructor(config = {}) {
    this.width = config.width || 1200;
    this.height = config.height || 800;
    this.outputDir = config.outputDir || './';
    this.filenamePrefix = config.filenamePrefix || 'genwallpaper';
    this.imageSmoothingEnabled = config.imageSmoothingEnabled !== false; // Default true
  }

  /**
   * Runs the full wallpaper generation lifecycle.
   * @param {Style} style - An instance of a Style class.
   * @param {Object[]} data - The log data.
   */
  async run(style, data) {
    console.log(`Starting generation with style: ${style.constructor.name} (${this.width}x${this.height})`);
    await fs.mkdir(this.outputDir, { recursive: true });

    // Ensure style has correct dimensions
    style.width = this.width;
    style.height = this.height;

    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');
    
    // Apply smoothing config
    ctx.imageSmoothingEnabled = this.imageSmoothingEnabled;

    try {
      // 1. Lifecycle: Initialize style with data
      await style.init(data);

      // 2. Lifecycle: Process simulation steps
      await style.process();

      // Clear background
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this.width, this.height);

      // 3. Lifecycle: Render
      await style.render(ctx, this.width, this.height);
    } catch (error) {
      console.error(`[Error Boundary] Style ${style.constructor.name} failed during generation:`, error);

      // Safe Style Fallback
      ctx.fillStyle = '#aa0000';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Wallpaper Generation Failed', this.width / 2, this.height / 2 - 20);
      ctx.font = '16px monospace';
      ctx.fillText(error.message, this.width / 2, this.height / 2 + 20);
      ctx.fillText(`Style: ${style.constructor.name}`, this.width / 2, this.height / 2 + 50);
    }

    // 4. Lifecycle: Save output
    const outputFile = await this._getNextFilename();
    await fs.writeFile(outputFile, canvas.toBuffer('image/png'));
    console.log(`Wallpaper saved to: ${outputFile}`);
    
    return outputFile;
  }

  async _getNextFilename() {
    try {
      const files = await fs.readdir(this.outputDir);
      const regex = new RegExp(`^${this.filenamePrefix}(\\d+)\\.png$`);
      const numbers = files
        .map(f => f.match(regex))
        .filter(Boolean)
        .map(m => +m[1]);
      const nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
      return path.join(this.outputDir, `${this.filenamePrefix}${nextNumber}.png`);
    } catch (_error) {
      // Default if directory doesn't exist yet
      return path.join(this.outputDir, `${this.filenamePrefix}1.png`);
    }
  }
}
