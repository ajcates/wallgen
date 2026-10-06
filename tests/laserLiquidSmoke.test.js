import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { LaserLiquidSmokeStyle } from '../src/styles/LaserLiquidSmokeStyle.js';

const data = [{ hh: 23, mm: 18, bp: 78, fm: 62, up: 8400, pt: 38 }];

test('LaserLiquidSmokeStyle generates a bounded layered sky with a full laser palette', async () => {
  const style = new LaserLiquidSmokeStyle({ width: 360, height: 640, seed: 481516 });
  await style.init(data);

  assert.ok(style.smokePuffs.length >= 51 && style.smokePuffs.length <= 69);
  assert.deepEqual(new Set(style.smokePuffs.map(puff => puff.layer)), new Set(['far', 'mid', 'front']));
  assert.equal(style.lasers.length, 4);
  assert.deepEqual(style.lasers.map(laser => laser.hue), [190, 320, 84, 262]);
  assert.ok(style.lasers.every(laser => laser.coreWidth > 0 && laser.bloomWidth > laser.coreWidth));
  assert.equal(style.prisms.length, 3);
  assert.ok(style.ribbons.length >= 6 && style.ribbons.length <= 8);
});

test('LaserLiquidSmokeStyle is reproducible when a seed is supplied', async () => {
  const first = new LaserLiquidSmokeStyle({ width: 360, height: 640, seed: 777 });
  const second = new LaserLiquidSmokeStyle({ width: 360, height: 640, seed: 777 });
  await Promise.all([first.init(data), second.init(data)]);

  assert.deepEqual(first.smokePuffs, second.smokePuffs);
  assert.deepEqual(first.lasers, second.lasers);
});

test('LaserLiquidSmokeStyle renders a saturated portrait wallpaper', async () => {
  const style = new LaserLiquidSmokeStyle({ width: 360, height: 640, seed: 481516 });
  await style.init(data);
  const canvas = createCanvas(360, 640);
  assert.doesNotThrow(() => style.render(canvas.getContext('2d'), 360, 640));

  const pixels = canvas.getContext('2d').getImageData(0, 0, 360, 640).data;
  let colorfulPixels = 0;
  for (let index = 0; index < pixels.length; index += 16) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    if (Math.max(red, green, blue) - Math.min(red, green, blue) > 35) colorfulPixels++;
  }
  assert.ok(colorfulPixels > 1400);
  assert.ok(canvas.toBuffer('image/png').length > 9000);
});
