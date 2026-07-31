import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { PlasmoStyle } from '../src/styles/PlasmoStyle.js';

const sampleData = [{ hh: 21, mm: 18, bp: 76, fm: 64, up: 9123 }];

const renderStyle = async (variant, seed = 31337, width = 160, height = 300, colorway) => {
  const style = new PlasmoStyle({ seed, variant, colorway, renderScale: 0.54 });
  style.width = width;
  style.height = height;
  await style.init(sampleData);
  await style.process();
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  await style.render(ctx, width, height);
  return { style, pixels: ctx.getImageData(0, 0, width, height).data };
};

const pixelStats = (pixels) => {
  let pureBlack = 0;
  let nearBlack = 0;
  let vivid = 0;
  let signature = 2166136261;

  for (let index = 0; index < pixels.length; index += 4) {
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const maximum = Math.max(r, g, b);
    const minimum = Math.min(r, g, b);
    if (maximum < 3) pureBlack++;
    if (maximum < 18) nearBlack++;
    if (maximum > 150 && maximum - minimum > 75) vivid++;
    signature ^= r + g * 3 + b * 7;
    signature = Math.imul(signature, 16777619) >>> 0;
  }

  const count = pixels.length / 4;
  return {
    pureBlack: pureBlack / count,
    nearBlack: nearBlack / count,
    vivid: vivid / count,
    signature
  };
};

test('PlasmoStyle builds a deterministic advected paint field', async () => {
  const first = new PlasmoStyle({ seed: 808, variant: 'chromatic-wave' });
  const second = new PlasmoStyle({ seed: 808, variant: 'chromatic-wave' });
  first.width = second.width = 240;
  first.height = second.height = 480;
  await first.init(sampleData);
  await second.init(sampleData);

  assert.equal(first.mode.name, 'chromatic-wave');
  assert.equal(first.mode.contourFrequency, 16);
  assert.equal(first.vortices.length, 16);
  assert.ok(first.contourWarps.length >= 5);
  assert.ok(first.contourWarps.some(warp => warp.radial < 0));
  assert.ok(first.contourWarps.some(warp => warp.radial > 0));
  assert.equal(first.contourLayers.length, 5);
  assert.ok(first.filaments.length >= 320);
  assert.deepEqual(first.vortices, second.vortices);
  assert.deepEqual(first.contourWarps, second.contourWarps);
  assert.deepEqual(first.contourDrift, second.contourDrift);
  assert.deepEqual(first.contourLayers, second.contourLayers);
  assert.deepEqual(first.filaments, second.filaments);
  assert.match(first.colorway, /^generated-/);
  assert.deepEqual(first.palette, second.palette);
  assert.equal(first.pours, undefined);
  assert.equal(first.cells, undefined);
});

test('PlasmoStyle chooses a fresh seed for every unseeded generation', async () => {
  const first = new PlasmoStyle();
  const second = new PlasmoStyle();
  first.width = second.width = 160;
  first.height = second.height = 300;
  await first.init(sampleData);
  await second.init(sampleData);

  assert.notEqual(first.seed, second.seed);
  assert.notDeepEqual(first.blobs, second.blobs);
  assert.notDeepEqual(first.palette, second.palette);
});

test('PlasmoStyle contour bundles keep two to five independently styled neighbors', async () => {
  const style = new PlasmoStyle({ seed: 808, variant: 'chromatic-wave' });
  style.width = 180;
  style.height = 320;
  await style.init(sampleData);

  assert.equal(new Set(style.contourLayers.map(layer => layer.widthScale.toFixed(3))).size, 5);
  assert.equal(new Set(style.contourLayers.map(layer => layer.valueScale.toFixed(3))).size, 5);
  assert.equal(new Set(style.contourLayers.map(layer => layer.paletteShift.toFixed(3))).size, 5);

  const activeCounts = new Set();
  let maximumDivergence = 0;
  for (let y = 0; y <= 1; y += 0.08) {
    for (let x = 0; x <= 1; x += 0.08) {
      const warped = style._warpPoint(x, y, 320 / 180);
      const contour = style._contourCharacter(x, y, warped);
      const bundle = style._contourBundle(
        x,
        y,
        warped.x + warped.y * 0.17,
        14,
        0.07,
        contour.thickness,
        contour.phase,
        0.4,
        contour
      );
      activeCounts.add(bundle.activeCount);
      maximumDivergence = Math.max(maximumDivergence, bundle.maximumDivergence);
    }
  }

  assert.ok(Math.min(...activeCounts) >= 2);
  assert.ok(Math.max(...activeCounts) >= 4);
  assert.ok(maximumDivergence > 0.12, 'neighboring strands should occasionally peel away');
});

test('PlasmoStyle builds smooth full-turn distortion twirls from random sine phases', async () => {
  const angles = [];
  const radii = [];
  const phases = [];

  for (let seed = 1; seed <= 16; seed++) {
    const style = new PlasmoStyle({ seed, variant: 'amoled-lava' });
    style.width = 180;
    style.height = 360;
    await style.init(sampleData);

    assert.ok(style.distortionTwirls.length >= 6 && style.distortionTwirls.length <= 12);
    assert.ok(
      style.distortionTwirls.filter(twirl => twirl.anchored).length
        >= Math.floor(style.distortionTwirls.length * 0.6)
    );
    const contourThreshold = (
      style.lavaDirection.maskStart + style.lavaDirection.maskEnd
    ) * 0.5;
    for (const twirl of style.distortionTwirls) {
      assert.ok(twirl.angle >= -Math.PI * 2 && twirl.angle <= Math.PI * 2);
      assert.ok(twirl.ratePhase >= 0 && twirl.ratePhase <= Math.PI * 2);
      assert.ok(twirl.rateCycles >= 0.38 && twirl.rateCycles <= 1.65);
      if (twirl.anchored) {
        assert.ok(Math.abs(twirl.contourInfluence - contourThreshold) < 0.08);
      }
      angles.push(twirl.angle);
      radii.push(twirl.radius);
      phases.push(twirl.ratePhase);
    }
  }

  assert.ok(angles.some(angle => angle < -Math.PI));
  assert.ok(angles.some(angle => angle > Math.PI));
  assert.ok(Math.max(...radii) - Math.min(...radii) > 0.20);
  assert.ok(Math.max(...phases) - Math.min(...phases) > Math.PI * 1.5);
});

test('PlasmoStyle twirls reshape supersampled lava masks and fills', async () => {
  const style = new PlasmoStyle({ seed: 303, variant: 'amoled-lava' });
  style.width = 128;
  style.height = 256;
  await style.init(sampleData);
  const twirledField = style._buildPaintField(style.width, style.height);
  const twirls = style.distortionTwirls;
  style.distortionTwirls = [];
  const plainMask = style._buildPaintField(style.width, style.height).mask;
  style.distortionTwirls = twirls;

  assert.ok(twirledField.width > style.width);
  assert.ok(twirledField.height > style.height);
  assert.ok(twirledField.softMask.some(
    (value, index) => value > twirledField.mask[index] + 0.08
  ));
  let changedPixels = 0;
  for (let index = 0; index < twirledField.mask.length; index++) {
    if (Math.abs(twirledField.mask[index] - plainMask[index]) > 0.08) changedPixels++;
  }
  assert.ok(changedPixels > 120, 'twirls should visibly reshape the lava silhouette');
});

test('PlasmoStyle antialiases sharp twirl edges without blurring flat regions', () => {
  const style = new PlasmoStyle({ seed: 1 });
  const width = 7;
  const height = 7;
  const image = { data: new Uint8ClampedArray(width * height * 4) };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const value = x >= 3 ? 255 : 0;
      image.data[offset] = value;
      image.data[offset + 1] = value;
      image.data[offset + 2] = value;
      image.data[offset + 3] = 255;
    }
  }

  style._antialiasHighContrastEdges(image, width, height);
  const flatBlack = image.data[(3 * width + 1) * 4];
  const darkEdge = image.data[(3 * width + 2) * 4];
  const lightEdge = image.data[(3 * width + 3) * 4];
  const flatWhite = image.data[(3 * width + 5) * 4];
  assert.equal(flatBlack, 0);
  assert.ok(darkEdge > 0 && darkEdge < 128);
  assert.ok(lightEdge > 128 && lightEdge < 255);
  assert.equal(flatWhite, 255);
});

test('PlasmoStyle contours vary gradually in thickness and color value', async () => {
  const style = new PlasmoStyle({ seed: 808, variant: 'chromatic-wave', renderScale: 0.4 });
  style.width = 180;
  style.height = 320;
  await style.init(sampleData);

  const field = style._buildPaintField(style.width, style.height);
  const thicknessRange = Math.max(...field.contourThickness)
    - Math.min(...field.contourThickness);
  const valueRange = Math.max(...field.contourValue)
    - Math.min(...field.contourValue);
  let maximumNeighborChange = 0;

  for (let y = 0; y < field.height; y += 7) {
    for (let x = 0; x < field.width - 1; x += 7) {
      const index = y * field.width + x;
      maximumNeighborChange = Math.max(
        maximumNeighborChange,
        Math.abs(field.contourThickness[index] - field.contourThickness[index + 1]),
        Math.abs(field.contourValue[index] - field.contourValue[index + 1])
      );
    }
  }

  assert.ok(thicknessRange > 0.35, 'contour widths should have visible broad variation');
  assert.ok(valueRange > 0.18, 'contour color values should have visible broad variation');
  assert.ok(maximumNeighborChange < 0.08, 'contour character should drift smoothly between pixels');
});

test('PlasmoStyle defaults to gently stirred AMOLED lava blobs', async () => {
  const first = new PlasmoStyle({ seed: 812 });
  const second = new PlasmoStyle({ seed: 812 });
  first.width = second.width = 240;
  first.height = second.height = 480;
  await first.init(sampleData);
  await second.init(sampleData);

  assert.equal(first.mode.name, 'amoled-lava');
  assert.equal(first.mode.contourFrequency, 9);
  assert.equal(first.vortices.length, 7);
  assert.ok(first.vortices.every(vortex => Math.abs(vortex.strength) <= 0.72));
  assert.ok(first.blobs.length >= 10);
  assert.ok(first.blobs.some(blob => blob.stretch > 1.5));
  assert.deepEqual(first.blobs, second.blobs);
});

test('PlasmoStyle AMOLED lava keeps colorful stirred blobs suspended in true black', async () => {
  const { style, pixels } = await renderStyle('amoled-lava', 1977, 170, 320, 'aurora');
  const stats = pixelStats(pixels);

  assert.equal(style.mode.name, 'amoled-lava');
  assert.equal(style.colorway, 'aurora');
  assert.ok(stats.pureBlack > 0.28, 'lava mode should preserve substantial true-black negative space');
  assert.ok(stats.vivid > 0.12, 'lava blobs should remain vivid against AMOLED black');
});

test('PlasmoStyle gives lava bands offset highlight and shadow relief', async () => {
  const style = new PlasmoStyle({ seed: 1977, variant: 'amoled-lava' });
  await style.init(sampleData);
  const frequency = style.mode.contourFrequency;
  const baseBand = 4;
  const highlightValue = (baseBand + 0.23) / frequency;
  const shadowValue = (baseBand + 0.73) / frequency;
  const highlightAtHighlight = style._lineStrength(
    highlightValue - 0.23 / frequency,
    frequency,
    0.052
  );
  const highlightAtShadow = style._lineStrength(
    shadowValue - 0.23 / frequency,
    frequency,
    0.052
  );
  const shadowAtShadow = style._lineStrength(
    shadowValue - 0.73 / frequency,
    frequency,
    0.070
  );

  assert.ok(highlightAtHighlight > 0.95);
  assert.ok(highlightAtShadow < 0.05);
  assert.ok(shadowAtShadow > 0.95);
});

test('PlasmoStyle provides three structurally distinct lava visual grammars', async () => {
  const grammars = [
    { variant: 'amoled-lava-drift', direction: 'drift', minimumBlobs: 10 },
    { variant: 'amoled-lava-rise', direction: 'rise', minimumBlobs: 12 },
    { variant: 'amoled-lava-islands', direction: 'islands', minimumBlobs: 10 }
  ];
  const signatures = new Set();

  for (const grammar of grammars) {
    const { style, pixels } = await renderStyle(grammar.variant, 812, 150, 280, 'ultraviolet');
    assert.equal(style.mode.name, 'amoled-lava');
    assert.equal(style.lavaDirection.name, grammar.direction);
    assert.ok(style.blobs.length >= grammar.minimumBlobs);
    assert.ok(new Set(style.blobs.map(blob => blob.rotation.toFixed(3))).size > 4);
    assert.ok(new Set(style.blobs.map(blob => blob.lobes)).size > 1);
    if (grammar.direction === 'islands') {
      assert.ok(style.blobs.filter(blob => blob.radius >= 0.105).length >= 4);
      assert.ok(style.blobs.some(blob => blob.radius <= 0.075));
    }
    signatures.add(pixelStats(pixels).signature);
  }

  assert.equal(signatures.size, grammars.length);
});

test('PlasmoStyle exposes seven genuinely different lava colorways', async () => {
  const colorways = ['ultraviolet', 'inferno', 'toxic', 'oceanic', 'aurora', 'rose-gold', 'prism'];
  const paletteSignatures = new Set();

  for (const colorway of colorways) {
    const style = new PlasmoStyle({ seed: 55, variant: 'amoled-lava', colorway });
    await style.init(sampleData);
    assert.equal(style.colorway, colorway);
    paletteSignatures.add(style.palette.map(color => `${color.h}:${color.l}`).join('|'));
  }

  assert.equal(paletteSignatures.size, colorways.length);
});

test('PlasmoStyle generates broad procedural color-scheme variety', async () => {
  const paletteSignatures = new Set();
  const schemeFamilies = new Set();

  for (let seed = 1; seed <= 24; seed++) {
    const style = new PlasmoStyle({ seed, variant: 'amoled-lava' });
    await style.init(sampleData);
    paletteSignatures.add(
      style.palette.map(color => `${color.h}:${color.s}:${color.l}`).join('|')
    );
    schemeFamilies.add(style.colorway.replace(/-\d+$/, ''));
    assert.ok(style.palette.length >= 7 && style.palette.length <= 10);
    assert.ok(style.palette.every(color => (
      color.h >= 0 && color.h < 360
      && color.s >= 88 && color.s <= 100
      && color.l >= 20 && color.l <= 76
    )));
  }

  assert.equal(paletteSignatures.size, 24);
  assert.equal(schemeFamilies.size, 5);
});

test('PlasmoStyle orders generated colors as psychedelic jumps instead of rainbows', async () => {
  for (let seed = 1; seed <= 24; seed++) {
    const style = new PlasmoStyle({ seed, variant: 'amoled-lava' });
    await style.init(sampleData);
    const directions = [];

    for (let index = 1; index < style.palette.length; index++) {
      const previous = style.palette[index - 1].h;
      const current = style.palette[index].h;
      const signedDelta = ((current - previous + 540) % 360) - 180;
      if (Math.abs(signedDelta) > 4) directions.push(Math.sign(signedDelta));
    }

    const directionChanges = directions.slice(1).filter(
      (direction, index) => direction !== directions[index]
    ).length;
    const dramaticJumps = style.palette.slice(1).filter((color, index) => {
      const delta = ((color.h - style.palette[index].h + 540) % 360) - 180;
      return Math.abs(delta) >= 75;
    }).length;
    assert.ok(
      directionChanges >= 2 || (directionChanges >= 1 && dramaticJumps >= 3),
      `seed ${seed} should reverse direction or make several dramatic hue jumps`
    );
  }
});

test('PlasmoStyle chromatic wave preserves a large AMOLED void and vivid impasto paint', async () => {
  const { style, pixels } = await renderStyle('chromatic-wave', 1977);
  const stats = pixelStats(pixels);

  assert.equal(style.mode.name, 'chromatic-wave');
  assert.ok(stats.pureBlack > 0.16, 'chromatic wave should leave a substantial pure-black upper void');
  assert.ok(stats.vivid > 0.20, 'chromatic paint should remain vivid and highly saturated');
});

test('PlasmoStyle ultraviolet current creates dark full-frame eddies', async () => {
  const { style, pixels } = await renderStyle('ultraviolet-current', 1977);
  const stats = pixelStats(pixels);

  assert.equal(style.mode.name, 'ultraviolet-current');
  assert.equal(style.vortices.length, 18);
  assert.ok(stats.nearBlack > 0.08, 'ultraviolet current should retain deep shadow pockets');
  assert.ok(stats.vivid > 0.08, 'ultraviolet current should retain luminous magenta and blue contours');
});

test('PlasmoStyle reference-led modes render visibly different compositions', async () => {
  const chromatic = await renderStyle('chromatic-wave', 4404);
  const ultraviolet = await renderStyle('ultraviolet-current', 4404);
  const chromaticStats = pixelStats(chromatic.pixels);
  const ultravioletStats = pixelStats(ultraviolet.pixels);

  assert.notEqual(chromaticStats.signature, ultravioletStats.signature);
  assert.ok(chromaticStats.pureBlack > ultravioletStats.pureBlack + 0.10);
});

test('PlasmoStyle keeps previous variant names as aliases to the rebuilt modes', async () => {
  const chromatic = new PlasmoStyle({ seed: 9, variant: 'acid-sunset' });
  const ultraviolet = new PlasmoStyle({ seed: 9, variant: 'ultraviolet-marble' });
  await chromatic.init(sampleData);
  await ultraviolet.init(sampleData);

  assert.equal(chromatic.mode.name, 'chromatic-wave');
  assert.equal(ultraviolet.mode.name, 'ultraviolet-current');
});

test('PlasmoStyle renders every composition mode without exceptions', async () => {
  for (const variant of ['amoled-lava', 'chromatic-wave', 'ultraviolet-current']) {
    await assert.doesNotReject(() => renderStyle(variant, 991));
  }
});
