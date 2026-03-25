import { createCanvas } from '@napi-rs/canvas';
import fs from 'fs/promises';
import path from 'path';

export class WallpaperEngine {
  constructor(config = {}) {
    this.width = config.width || 1200;
    this.height = config.height || 800;
    this.outputDir = config.outputDir || './';
    this.filenamePrefix = config.filenamePrefix || 'genwallpaper';
  }

  /**
   * Runs the full wallpaper generation lifecycle.
   * @param {Style} style - An instance of a Style class.
   * @param {Object[]} data - The log data.
   */
  async run(style, data) {
    console.log(`Starting generation with style: ${style.constructor.name} (${this.width}x${this.height})`);

    // Ensure style has correct dimensions
    style.width = this.width;
    style.height = this.height;

    // 1. Lifecycle: Initialize style with data
    await style.init(data);

    // 2. Lifecycle: Process simulation steps
    await style.process();

    // 3. Lifecycle: Create canvas and render
    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');
    
    // Clear background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.width, this.height);

    style.render(ctx, this.width, this.height);

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
    } catch (error) {
      // Default if directory doesn't exist yet
      return path.join(this.outputDir, `${this.filenamePrefix}1.png`);
    }
  }
}
