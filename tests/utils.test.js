import test from 'node:test';
import assert from 'node:assert';
import { mapRange, distance } from '../src/utils/math.js';

test('math utils: mapRange', (t) => {
  // Simple linear mapping
  assert.strictEqual(mapRange(5, 0, 10, 0, 100), 50);
  assert.strictEqual(mapRange(0, 0, 10, 0, 100), 0);
  assert.strictEqual(mapRange(10, 0, 10, 0, 100), 100);
  
  // Inverse mapping
  assert.strictEqual(mapRange(0, 0, 1, 100, 0), 100);
});

test('math utils: distance', (t) => {
  const p1 = { x: 0, y: 0 };
  const p2 = { x: 3, y: 4 };
  assert.strictEqual(distance(p1, p2), 5); // 3-4-5 triangle
});
