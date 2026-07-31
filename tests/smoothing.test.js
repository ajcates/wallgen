import test from 'node:test';
import assert from 'node:assert/strict';
import { getSMA, getEMA, lerp } from '../src/utils/data.js';

test('Data Utils: getSMA', () => {
  const data = [{ v: 10 }, { v: 20 }, { v: 30 }];
  assert.strictEqual(getSMA(data, 'v', 2), 25);
  assert.strictEqual(getSMA(data, 'v', 10), 20);
});

test('Data Utils: getEMA', () => {
  const data = [{ v: 100 }, { v: 200 }];
  // ema = 0.3 * 200 + (1 - 0.3) * 100 = 60 + 70 = 130
  assert.strictEqual(getEMA(data, 'v', 0.3), 130);
});

test('Data Utils: lerp', () => {
  assert.strictEqual(lerp(10, 20, 0.5), 15);
  assert.strictEqual(lerp(0, 100, 0.1), 10);
});
