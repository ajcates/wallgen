import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { MaterialPlanesStyle, MATERIALS, REGULAR_ANGLES } from '../src/styles/MaterialPlanesStyle.js';

test('Material Planes composes every requested material at regular angles', async () => {
  const style = new MaterialPlanesStyle({ width: 360, height: 640 });
  await style.init([{ hh: 14, mm: 20, bp: 68, fm: 55 }]);

  const materialTypes = new Set(style.planes.map(plane => plane.material));
  for (const material of MATERIALS) assert.ok(materialTypes.has(material));
  for (const plane of style.planes) {
    const degrees = Math.round(plane.angle * 180 / Math.PI);
    assert.ok(REGULAR_ANGLES.includes(degrees));
  }
});

test('Material Planes renders a non-empty wallpaper', async () => {
  const style = new MaterialPlanesStyle({ width: 360, height: 640 });
  await style.init([{ hh: 21, mm: 8, bp: 81, fm: 42 }]);
  const canvas = createCanvas(360, 640);
  style.render(canvas.getContext('2d'), 360, 640);
  assert.ok(canvas.toBuffer('image/png').length > 5000);
});
