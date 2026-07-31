import test from 'node:test';
import assert from 'node:assert';
import { WallpaperEngine } from '../src/core/WallpaperEngine.js';
import { Style } from '../src/core/Style.js';

class FailingStyle extends Style {
  render(ctx, width, height) {
    throw new Error('Intentional Render Failure');
  }
}

test('WallpaperEngine error boundary catches exceptions', async () => {
  const engine = new WallpaperEngine({ outputDir: './tests/tmp' });
  const style = new FailingStyle();
  
  // Create tmp dir if not exists
  import('fs').then(fs => {
    if (!fs.existsSync('./tests/tmp')){
        fs.mkdirSync('./tests/tmp');
    }
  });

  const output = await engine.run(style, []);
  assert(output.endsWith('.png')); // Still generates an image
});