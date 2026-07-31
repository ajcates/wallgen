import test from 'node:test';
import assert from 'node:assert/strict';
import { OilSlickStyle } from '../src/styles/OilSlickStyle.js';
import { createCanvas } from '@napi-rs/canvas';

test('OilSlickStyle: Initialization and properties', async () => {
  const style = new OilSlickStyle();
  await style.init([{ hh: 12, mm: 30, bp: 75, fm: 60 }]);
  
  assert.ok(style.slicks.length >= 5);
  assert.ok(style.droplets.length >= 12);
  assert.ok(style.filaments.length >= 3);
  assert.ok(style.particles.length >= 25);
  assert.ok(style.viscosity >= 0.6 && style.viscosity <= 1.35);
  
  // Verify main properties are populated
  for (const slick of style.slicks) {
    assert.ok(slick.radius > 0);
    assert.ok(slick.numLayers >= 25);
  }
});

test('OilSlickStyle: Rendering without error', async () => {
  const style = new OilSlickStyle();
  style.width = 300;
  style.height = 300;
  await style.init([{ hh: 12, mm: 30, bp: 75, fm: 60 }]);
  
  const canvas = createCanvas(300, 300);
  const ctx = canvas.getContext('2d');
  
  // Verify render completes without exception
  await assert.doesNotReject(async () => {
    await style.process();
    await style.render(ctx, 300, 300);
  });
});
