import test from 'node:test';
import assert from 'node:assert/strict';
import { BeveledCircuitsStyle } from '../src/styles/BeveledCircuitsStyle.js';
import { createCanvas } from '@napi-rs/canvas';

test('BeveledCircuitsStyle: Initialization and property mapping', async () => {
  const style = new BeveledCircuitsStyle();
  await style.init([{ hh: 10, mm: 15, bp: 80, fm: 55, pt: 40 }]);
  
  assert.ok(style.theme !== null);
  assert.ok(style.traces.length > 0);
  assert.ok(style.components.length > 0);

  // Validate trace properties
  style.traces.forEach(trace => {
    assert.ok(trace.points.length >= 2);
    assert.ok(trace.width > 0);
    assert.ok(trace.bevelWidth > 0);
    assert.ok(trace.bevelBlur > 0);
    assert.ok(['raised', 'sunken', 'ridge', 'groove'].includes(trace.bevelStyle));
  });

  // Validate components properties
  style.components.forEach(comp => {
    assert.ok(comp.x !== undefined);
    assert.ok(comp.y !== undefined);
    assert.ok(['chip', 'capacitor', 'heatsink', 'led', 'smd_resistor', 'smd_transistor'].includes(comp.type));
  });
});

test('BeveledCircuitsStyle: Rendering works without exception', async () => {
  const style = new BeveledCircuitsStyle();
  style.width = 400;
  style.height = 400;
  await style.init([{ hh: 16, mm: 45, bp: 90, fm: 70, pt: 48 }]);
  
  const canvas = createCanvas(400, 400);
  const ctx = canvas.getContext('2d');
  
  await assert.doesNotReject(async () => {
    await style.process();
    await style.render(ctx, 400, 400);
  });
});

test('BeveledCircuitsStyle: supports five distinct futuristic art directions', async () => {
  const variants = ['neon-noir', 'holographic-chrome', 'biolume-lattice', 'solar-forge', 'quantum-ice'];

  for (const variant of variants) {
    const style = new BeveledCircuitsStyle({ variant });
    style.width = 240;
    style.height = 320;
    await style.init([{ hh: 20, mm: 8, bp: 72, fm: 50, pt: 44 }]);
    assert.equal(style.artDirection.name, variant);
    assert.equal(style.artDirection.traces.length, 4);
  }
});
