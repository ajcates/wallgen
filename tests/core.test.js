import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Style } from '../src/core/Style.js';
import { WallpaperEngine } from '../src/core/WallpaperEngine.js';

test('Style: wrapX and wrapY', () => {
  const style = new Style({ width: 100, height: 100 });
  
  // Basic wrapping
  assert.strictEqual(style.wrapX(110), 10);
  assert.strictEqual(style.wrapX(-10), 90);
  assert.strictEqual(style.wrapX(0), 0);
  assert.strictEqual(style.wrapX(100), 0);
  
  assert.strictEqual(style.wrapY(110), 10);
  assert.strictEqual(style.wrapY(-10), 90);
  assert.strictEqual(style.wrapY(0), 0);
  assert.strictEqual(style.wrapY(100), 0);
});

test('WallpaperEngine creates a missing output directory', async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'wallgen-engine-'));
  const outputDir = path.join(temporaryRoot, 'nested', 'wallpapers');
  const engine = new WallpaperEngine({
    width: 32,
    height: 32,
    outputDir,
    filenamePrefix: 'smoke'
  });
  const outputPath = await engine.run(new Style(), []);

  assert.equal(outputPath, path.join(outputDir, 'smoke1.png'));
  assert.ok((await fs.stat(outputPath)).isFile());
  await fs.rm(temporaryRoot, { recursive: true, force: true });
});
