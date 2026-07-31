import { createCanvas } from '@napi-rs/canvas';
import fs from 'node:fs/promises';
import path from 'node:path';
import { generateSyntheticLogs } from '../src/data/logParser.js';
import { STYLE_CATALOG, loadStyleClass } from '../src/styles/styleCatalog.js';

const readArg = (name, fallback = null) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

const hasArg = (name) => process.argv.includes(`--${name}`);
const outputDir = path.resolve(readArg('output', './termux_gui/thumbnails'));
const requestedStyle = readArg('style');
const width = Math.max(96, Number.parseInt(readArg('width', '180'), 10) || 180);
const height = Math.max(160, Number.parseInt(readArg('height', '320'), 10) || 320);
const force = hasArg('force');
const styles = requestedStyle
  ? STYLE_CATALOG.filter(style => style.id === requestedStyle)
  : STYLE_CATALOG;

if (requestedStyle && styles.length === 0) {
  throw new Error(`Unknown style: ${requestedStyle}`);
}

await fs.mkdir(outputDir, { recursive: true });
const data = generateSyntheticLogs(20).map((entry, index) => ({
  ...entry,
  pt: 24 + (index * 37) % 173
}));
const failures = [];

for (let index = 0; index < styles.length; index++) {
  const entry = styles[index];
  const outputPath = path.join(outputDir, `${entry.id}.jpg`);

  if (!force) {
    try {
      await fs.access(outputPath);
      console.log(`[${index + 1}/${styles.length}] ${entry.id}: cached`);
      continue;
    } catch {
      // Render the missing thumbnail.
    }
  }

  try {
    const { StyleClass } = await loadStyleClass(entry.id);
    const style = new StyleClass({ seed: 0x57a11 + index * 7919 });
    style.width = width;
    style.height = height;
    await style.init(entry.id === 'shapes' ? [] : data);
    await style.process();

    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    context.fillStyle = '#05050a';
    context.fillRect(0, 0, width, height);
    await style.render(context, width, height);
    await fs.writeFile(outputPath, canvas.toBuffer('image/jpeg', 82));
    console.log(`[${index + 1}/${styles.length}] ${entry.id}: rendered`);
  } catch (error) {
    failures.push(`${entry.id}: ${error.message}`);
    console.error(`[${index + 1}/${styles.length}] ${entry.id}: ${error.message}`);
  }
}

if (failures.length > 0) {
  throw new Error(`Thumbnail generation failed:\n${failures.join('\n')}`);
}
