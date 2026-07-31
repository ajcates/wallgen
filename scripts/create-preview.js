import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs/promises';
import path from 'node:path';

const [inputArg, outputArg, maxWidthArg = '540', maxHeightArg = '760'] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  throw new Error('Usage: node scripts/create-preview.js <input> <output> [max-width] [max-height]');
}

const inputPath = path.resolve(inputArg);
const outputPath = path.resolve(outputArg);
const maxWidth = Math.max(120, Number.parseInt(maxWidthArg, 10) || 540);
const maxHeight = Math.max(180, Number.parseInt(maxHeightArg, 10) || 760);
const image = await loadImage(inputPath);
const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
const width = Math.max(1, Math.round(image.width * scale));
const height = Math.max(1, Math.round(image.height * scale));
const canvas = createCanvas(width, height);
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = true;
context.imageSmoothingQuality = 'high';
context.drawImage(image, 0, 0, width, height);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, canvas.toBuffer('image/jpeg', 88));
console.log(outputPath);
