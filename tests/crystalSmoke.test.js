import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { CrystalSmokeStyle } from '../src/styles/CrystalSmokeStyle.js';
import { generateSyntheticLogs } from '../src/data/logParser.js';

test('CrystalSmokeStyle builds all five smoke enhancement layers', async () => {
  const style = new CrystalSmokeStyle({ width: 360, height: 640 });
  await style.init(generateSyntheticLogs(12));

  assert.ok(style.smokeRibbons.length > 0, 'flow-field ribbons');
  assert.ok(style.smokeTendrils.length > style.smokeRibbons.length, 'turbulent smoke tendrils');
  assert.ok(style.smokePuffs.some(puff => puff.densityBand === 'core'), 'dense plume cores');
  assert.ok(style.smokePuffs.some(puff => puff.aspect !== 1), 'stretched smoke cells');
  assert.ok(style.vortexes.length > 0, 'vortex pockets');
  assert.ok(style.embers.length > 0, 'ember particulate');
  assert.ok(style.lightRays.length > 0, 'lighting-aware shafts');
});

test('CrystalSmokeStyle renders its enhanced smoke stack', async () => {
  const style = new CrystalSmokeStyle({ width: 240, height: 400 });
  await style.init(generateSyntheticLogs(10));
  const canvas = createCanvas(240, 400);
  assert.doesNotThrow(() => style.render(canvas.getContext('2d'), 240, 400));
  assert.ok(canvas.toBuffer('image/png').length > 1000);
});
