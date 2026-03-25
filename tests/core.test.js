import { test } from 'node:test';
import assert from 'node:assert';
import { Style } from '../src/core/Style.js';

test('Style: wrapX and wrapY', (t) => {
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
