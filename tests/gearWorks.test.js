import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { GearWorksStyle } from '../src/styles/GearWorksStyle.js';

test('Gear Works generates gears, pistons, and pipes', async () => {
  const style = new GearWorksStyle({ width: 360, height: 640 });
  await style.init([{ hh: 14, mm: 20, bp: 68, fm: 55 }]);

  assert.ok(style.gears.length > 0);
  assert.ok(style.pistons.length > 0);
  assert.ok(style.pipes.length > 0);
  for (const gear of style.gears) {
    assert.ok(gear.teeth >= 8);
    assert.ok(gear.radius > 0);
  }
});

test('Gear Works renders a non-empty wallpaper', async () => {
  const style = new GearWorksStyle({ width: 360, height: 640 });
  await style.init([{ hh: 21, mm: 8, bp: 81, fm: 42 }]);
  const canvas = createCanvas(360, 640);
  style.render(canvas.getContext('2d'), 360, 640);
  assert.ok(canvas.toBuffer('image/png').length > 5000);
});
