import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { TrillStyle } from '../src/styles/TrillStyle.js';

test('TrillStyle: Depth of Field configuration', async () => {
  const styleDefault = new TrillStyle();
  assert.strictEqual(styleDefault.dofEnabled, true);
  assert.strictEqual(styleDefault.dofBlurAmt, 2.25);

  const styleConfig = new TrillStyle({ dofEnabled: 'false', dofBlurAmt: 12.5 });
  assert.strictEqual(styleConfig.dofEnabled, false);
  assert.strictEqual(styleConfig.dofBlurAmt, 12.5);
});

test('TrillStyle: Shape depth-of-field blur generation', async () => {
  const style = new TrillStyle();
  await style.init([{ hh: 10, mm: 20, bp: 80, fm: 40, pt: 10 }]);

  assert.ok(style.shapes.length > 0);
  
  // Verify shapes have a dofBlur property
  for (const shape of style.shapes) {
    assert.ok(typeof shape.dofBlur === 'number');
    assert.ok(shape.dofBlur >= 0);
  }
});

test('TrillStyle: gives asymmetric compositions a focal hierarchy and gaze route', async () => {
  const style = new TrillStyle({ width: 600, height: 900 });
  await style.init([{ hh: 10, mm: 45, bp: 65, fm: 55, pt: 42 }]);

  assert.ok(style.focalShape?.isFocal);
  assert.equal(style.focalShape.layer, 'foreground');
  assert.ok(style.compositionAxis);
  assert.equal(style.gazeRoute.length, 3);

  const guides = style.connections.filter(connection => connection.gazeGuide);
  assert.equal(guides.length, 2);
  assert.ok(guides.every(connection => connection.layer === 'midground'));
  assert.equal(style.trillSignature?.frames.length, 3);
  assert.equal(style.trillSignature?.beats.length, 6);
});

test('TrillStyle: renders its expanded silhouette library', async () => {
  const style = new TrillStyle({ width: 320, height: 320 });
  await style.init([{ hh: 10, mm: 20, bp: 80, fm: 40, pt: 10 }]);
  const additions = ['capsule', 'arch', 'crescent', 'starburst', 'clover', 'lightning-bolt'];
  assert.ok(additions.every(type => style.shapeTypes.includes(type)));

  const canvas = createCanvas(320, 320);
  for (const shapeType of additions) {
    style.shapeTypes = [shapeType];
    const shape = style._createShape(160, 160, 0, 0, 0, false, style.palette[0], 110);
    shape.layer = 'foreground';
    shape.isHub = false;
    assert.doesNotThrow(() => style._drawShape(canvas.getContext('2d'), shape), shapeType);
  }
});

test('TrillStyle: gives repeated geometry restrained individual variation', async () => {
  const style = new TrillStyle({ width: 360, height: 540 });
  await style.init([{ hh: 10, mm: 20, bp: 80, fm: 40, pt: 10 }]);
  style.shapeTypes = ['rect', 'circle', 'polygon', 'trapezoid'];

  const shapes = Array.from({ length: style.shapeTypes.length }, (_, index) =>
    style._createShape(180, 270, index, 0, 0, false, style.palette[0], 120)
  );
  assert.equal(new Set(shapes.map(shape => shape.shapeType)).size, style.shapeTypes.length);

  const variationSignatures = new Set(shapes.map(shape => {
    const variation = shape.shapeVariation;
    assert.ok(variation.aspectX >= 0.92 && variation.aspectX <= 1.08);
    assert.ok(variation.aspectY >= 0.92 && variation.aspectY <= 1.08);
    assert.ok(Math.abs(variation.asymmetry) <= 0.055);
    return `${variation.aspectX.toFixed(4)}:${variation.aspectY.toFixed(4)}:${variation.asymmetry.toFixed(4)}`;
  }));
  assert.equal(variationSignatures.size, shapes.length);
});

test('TrillStyle: limits and distributes thin double-line connectors', async () => {
  const style = new TrillStyle({ width: 600, height: 900 });
  await style.init([{ hh: 10, mm: 45, bp: 65, fm: 80, pt: 42 }]);

  assert.deepEqual(style._getStripeOffsets('single'), [0]);
  assert.deepEqual(style._getStripeOffsets('double'), [-3.5, 3.5]);
  assert.deepEqual(style._getStripeOffsets('triple'), [-6, 0, 6]);

  const doubles = style.connections.filter(connection => !connection.gazeGuide && connection.stripeType === 'double');
  assert.ok(doubles.length <= 2);
  if (doubles.length === 2) {
    const first = style._getConnectionMidpoint(doubles[0]);
    const second = style._getConnectionMidpoint(doubles[1]);
    assert.ok(Math.hypot(first.x - second.x, first.y - second.y) >= Math.min(style.width, style.height) * 0.28);
  }
});

test('TrillStyle: supports five distinct composition grammars', async () => {
  const modes = ['diagonal-relay', 'orbital-counterweight', 'horizon-tension', 'totem-stack', 'corner-cascade'];
  for (const trillComposition of modes) {
    const style = new TrillStyle({ width: 600, height: 900, trillComposition });
    await style.init([{ hh: 10, mm: 45, bp: 65, fm: 55, pt: 42 }]);
    assert.equal(style.compositionMode, trillComposition);
    assert.ok(style.shapes.every(shape => shape.x >= 0 && shape.x <= style.width));
    assert.ok(style.shapes.every(shape => shape.y >= 0 && shape.y <= style.height));
  }
});

test('TrillStyle: renders three distinct finish directions', async () => {
  const finishes = ['prismatic-lacquer', 'risograph-noir', 'signal-neon'];
  for (const trillFinish of finishes) {
    const style = new TrillStyle({ width: 480, height: 720, trillFinish });
    await style.init([{ hh: 10, mm: 45, bp: 65, fm: 55, pt: 42 }]);
    assert.equal(style.finishMode, trillFinish);
    const canvas = createCanvas(480, 720);
    await style.render(canvas.getContext('2d'), 480, 720);
  }
});
