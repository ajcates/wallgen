import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { CrystalSmoke2Style } from '../src/styles/CrystalSmoke2Style.js';
import { generateSyntheticLogs } from '../src/data/logParser.js';

test('CrystalSmoke2Style replaces glass spheres with round-bottom boiling flasks', async () => {
  const style = new CrystalSmoke2Style({ width: 360, height: 640 });
  await style.init(generateSyntheticLogs(12));

  assert.ok(style.boilingFlasks.length >= 6);
  assert.equal('glassSpheres' in style, false);
  style.boilingFlasks.forEach(flask => {
    assert.ok(flask.neckWidth < flask.radius * 0.5, 'narrow laboratory neck');
    assert.ok(flask.neckHeight > flask.radius * 2, 'neck is longer than the bulb diameter');
    assert.ok(flask.lipWidth > flask.neckWidth, 'rolled lip wider than neck');
    assert.ok(flask.liquidLevel <= 0.38, 'low melt pool leaves crystals exposed');
    assert.ok(flask.crystals.length >= 1, 'faceted crystals sit in the melt pool');
    assert.ok(flask.crystals.every(crystal => crystal.drips.length >= 1), 'each crystal has a melt trail');
    assert.equal('bubbles' in flask, false, 'bubble fill was replaced by melting crystals');
    assert.equal('stemAngle' in flask, false, 'no side stem or carb geometry');
  });
});

test('CrystalSmoke2Style renders its boiling-flask layer', async () => {
  const style = new CrystalSmoke2Style({ width: 240, height: 400 });
  await style.init(generateSyntheticLogs(10));
  const canvas = createCanvas(240, 400);

  assert.doesNotThrow(() => style.render(canvas.getContext('2d'), 240, 400));
  assert.ok(canvas.toBuffer('image/png').length > 1000);
});

test('CrystalSmoke2Style uses directional smoke, staged depth, and composed spacing', async () => {
  const style = new CrystalSmoke2Style({ width: 360, height: 640 });
  await style.init(generateSyntheticLogs(12));

  assert.ok(style.fgSmokePuffs.every(puff => puff.aspect < 0.7));
  assert.ok(style.fgSmokePuffs.every(puff => Number.isFinite(puff.rotation)));
  assert.deepEqual(
    new Set(style.boilingFlasks.map(flask => flask.depth)),
    new Set(['far', 'mid', 'near'])
  );
  assert.ok(style.boilingFlasks.every(flask => Number.isFinite(flask.placementClearance)));

  const centerDistances = style.boilingFlasks.flatMap((flask, index) => (
    style.boilingFlasks.slice(index + 1).map(other => (
      Math.hypot(flask.x - other.x, flask.y - other.y)
    ))
  ));
  assert.ok(Math.min(...centerDistances) > 20, 'flasks do not collapse onto one center');
});

test('CrystalSmoke2Style adds selective etching, light caustics, and mineral melt veins', async () => {
  const style = new CrystalSmoke2Style({ width: 360, height: 640 });
  await style.init(generateSyntheticLogs(12));

  const etchedCount = style.boilingFlasks.filter(flask => flask.etched).length;
  assert.ok(etchedCount > 0 && etchedCount < style.boilingFlasks.length, 'etching remains selective');
  style.boilingFlasks.forEach(flask => {
    assert.ok(flask.causticStrength >= 0.08 && flask.causticStrength <= 0.2);
    assert.notEqual(flask.crystalHue, flask.meltHue);
    assert.ok(flask.meltVeins.length >= 2);
    assert.ok(flask.meltVeins.every(vein => Number.isFinite(vein.bow)));
  });
});

test('CrystalSmoke2Style adds perpendicular vapor vents and selective horizontal flasks', async () => {
  const style = new CrystalSmoke2Style({ width: 360, height: 640 });
  await style.init(generateSyntheticLogs(12));

  const horizontalFlasks = style.boilingFlasks.filter(flask => flask.horizontal);
  assert.ok(horizontalFlasks.length > 0 && horizontalFlasks.length < style.boilingFlasks.length);
  assert.ok(horizontalFlasks.every(flask => Math.abs(flask.tilt) >= 1.32));
  assert.ok(style.boilingFlasks.filter(flask => !flask.horizontal).every(flask => Math.abs(flask.tilt) <= 0.16));
  assert.ok(style.boilingFlasks.every(flask => Math.abs(flask.tilt + flask.contentTilt) < 1e-9));

  style.boilingFlasks.forEach(flask => {
    const neckAxis = -Math.PI / 2;
    assert.ok(Math.abs(Math.abs(flask.ventAngle - neckAxis) - Math.PI / 2) < 1e-9);
    assert.ok(flask.ventVapor.length >= 13);
    assert.ok(flask.ventVapor[0].alpha > flask.ventVapor.at(-1).alpha);
    const lastPuff = flask.ventVapor.at(-1);
    assert.ok(Math.hypot(lastPuff.x - flask.ventX, lastPuff.y - flask.ventY) > flask.radius * 2);
  });
  assert.ok(style.shards.every(shard => shard.outlineAlpha >= 0.15));
});

test('CrystalSmoke2Style uses spherical bulbs and varied crystal loads', async () => {
  const style = new CrystalSmoke2Style({ width: 360, height: 640 });
  await style.init(generateSyntheticLogs(12));

  assert.deepEqual(
    new Set(style.boilingFlasks.map(flask => flask.crystalLoad)),
    new Set(['sparse', 'balanced', 'dense'])
  );
  style.boilingFlasks.forEach(flask => {
    const ranges = { sparse: [1, 2], balanced: [3, 5], dense: [6, 9] };
    const [minimum, maximum] = ranges[flask.crystalLoad];
    assert.ok(flask.crystals.length >= minimum && flask.crystals.length <= maximum);

    let tracedRadius = null;
    style._traceBoilingFlask({
      beginPath() {},
      moveTo() {},
      lineTo() {},
      quadraticCurveTo() {},
      arc(_x, _y, radius) { tracedRadius = radius; },
      closePath() {}
    }, flask);
    assert.equal(tracedRadius, flask.radius, 'bulb contour uses a true circular arc');
  });
});
