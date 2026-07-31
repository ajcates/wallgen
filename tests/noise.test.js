import test from 'node:test';
import assert from 'node:assert';
import { noise, SimplexNoise } from '../src/utils/noise.js';

test('noise2D returns value between 0 and 1', () => {
  const val = noise.noise2D(0.5, 0.5);
  assert(val >= 0 && val <= 1);
});

test('SimplexNoise accepts seed', () => {
  const n = new SimplexNoise(42);
  const val1 = n.noise2D(0.1, 0.1);
  const val2 = n.noise2D(0.1, 0.1);
  assert.strictEqual(val1, val2);
});
