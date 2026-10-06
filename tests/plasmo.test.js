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

test('PlasmoStyle keeps its trance flow off-center and asymmetrical', async () => {
  const style = new PlasmoStyle({ seed: 812, variant: 'amoled-lava' });
  style.width = 180;
  style.height = 360;
  await style.init(sampleData);

  assert.equal(style.tranceAccentsEnabled, false);
  assert.ok(
    Math.hypot(style.tranceCenter.x - 0.5, style.tranceCenter.y - 0.5) > 0.03,
    'the focal center should sit noticeably off-axis'
  );

  const aspect = style.height / style.width;
  const quadrants = new Set();
  for (let step = 0; step < 24; step++) {
    const angle = step / 24 * Math.PI * 2;
    const mapped = style._mapTranceDomain(
      style.tranceCenter.x + Math.cos(angle) * 0.30,
      style.tranceCenter.y + Math.sin(angle) * 0.30 / aspect,
      aspect
    );
    const dx = mapped.u - style.tranceCenter.x;
    const dy = mapped.v * aspect - style.tranceCenter.y * aspect;
    quadrants.add(`${dx >= 0 ? 1 : -1},${dy >= 0 ? 1 : -1}`);
  }

  assert.equal(quadrants.size, 4, 'the flow should not fold the canvas into one repeated wedge');

  const seamRadius = 0.31;
  const seamOffset = 0.0001;
  const aboveSeam = style._mapTranceDomain(
    style.tranceCenter.x - seamRadius,
    style.tranceCenter.y + seamOffset,
    aspect
  );
  const belowSeam = style._mapTranceDomain(
    style.tranceCenter.x - seamRadius,
    style.tranceCenter.y - seamOffset,
    aspect
  );
  assert.ok(
    Math.hypot(aboveSeam.u - belowSeam.u, aboveSeam.v - belowSeam.v) < 0.003,
    'the angular wrap should not leave a fold line through the blob'
  );

  const sector = Math.PI * 2 / style.tranceProfile.symmetry;
  const firstSector = style._mapTranceDomain(
    style.tranceCenter.x + 0.27,
    style.tranceCenter.y,
    aspect
  );
  const repeatedSector = style._mapTranceDomain(
    style.tranceCenter.x + Math.cos(sector) * 0.27,
    style.tranceCenter.y + Math.sin(sector) * 0.27 / aspect,
    aspect
  );
  assert.ok(
    Math.abs(firstSector.angularEcho - repeatedSector.angularEcho) > 0.12,
    'default contour flow should not repeat in mandala sectors'
  );

  const explicitMandala = new PlasmoStyle({
    seed: 812,
    variant: 'amoled-lava',
    trance: 'spiral-iris'
  });
  explicitMandala.width = 180;
  explicitMandala.height = 360;
  await explicitMandala.init(sampleData);
  assert.equal(explicitMandala.tranceAccentsEnabled, true);
  assert.ok(explicitMandala.blobs.length > style.blobs.length);
});

test('PlasmoStyle uses two or three off-center radial twists with seeded directions', async () => {
  const opposed = new PlasmoStyle({ seed: 812, variant: 'amoled-lava' });
  const aligned = new PlasmoStyle({ seed: 808, variant: 'amoled-lava' });
  opposed.width = aligned.width = 180;
  opposed.height = aligned.height = 360;
  await opposed.init(sampleData);
  await aligned.init(sampleData);

  for (const style of [opposed, aligned]) {
    assert.ok(style.radialTwists.length >= 2 && style.radialTwists.length <= 3);
    assert.ok(style.radialTwists.every(twist => (
      twist.x >= 0.14 && twist.x <= 0.86
      && twist.y >= 0.24 && twist.y <= 1.76
    )));
    assert.ok(style.radialTwists.some(twist => (
      Math.hypot(twist.x - 0.5, twist.y - 1) > 0.18
    )));

    const aspect = style.height / style.width;
    for (const twist of style.radialTwists) {
      const sourceU = twist.x + twist.radius * 0.48;
      const sourceV = twist.y / aspect;
      const mapped = style._mapTranceDomain(sourceU, sourceV, aspect);
      assert.ok(
        Math.hypot(mapped.u - sourceU, mapped.v - sourceV) > 0.008,
        'each local twist should visibly turn its surrounding contour field'
      );
    }
  }

  assert.equal(opposed.radialTwistsOpposed, true);
  assert.ok(opposed.radialTwists.some(twist => twist.strength < 0));
  assert.ok(opposed.radialTwists.some(twist => twist.strength > 0));
  assert.equal(aligned.radialTwistsOpposed, false);
  assert.equal(new Set(aligned.radialTwists.map(twist => Math.sign(twist.strength))).size, 1);
});

test('PlasmoStyle blends slight saturation differences through lava blobs', async () => {
  const style = new PlasmoStyle({ seed: 1977, variant: 'amoled-lava', renderScale: 0.4 });
  style.width = 150;
  style.height = 280;
  await style.init(sampleData);

  const blobSaturations = style.blobs.map(blob => blob.saturation);
  assert.ok(Math.max(...blobSaturations) - Math.min(...blobSaturations) > 0.06);
  assert.ok(blobSaturations.every(value => value >= 0.93 && value <= 1.08));

  const field = style._buildPaintField(style.width, style.height);
  const visibleSaturations = [];
  let maximumNeighborChange = 0;
  for (let y = 0; y < field.height; y += 3) {
    for (let x = 0; x < field.width; x += 3) {
      const index = y * field.width + x;
      if (field.mask[index] < 0.3) continue;
      visibleSaturations.push(field.blobSaturation[index]);
      if (x + 1 < field.width) {
        maximumNeighborChange = Math.max(
          maximumNeighborChange,
          Math.abs(field.blobSaturation[index] - field.blobSaturation[index + 1])
        );
      }
    }
  }

  assert.ok(Math.max(...visibleSaturations) - Math.min(...visibleSaturations) > 0.035);
  assert.ok(maximumNeighborChange < 0.035, 'saturation changes should blend smoothly');
});

test('PlasmoStyle gives blobs varied soft lighting and twisted contour gaps', async () => {
  const style = new PlasmoStyle({ seed: 1977, variant: 'amoled-lava', renderScale: 0.4 });
  style.width = 150;
  style.height = 280;
  await style.init(sampleData);

  assert.ok(new Set(style.blobs.map(blob => blob.lightAngle.toFixed(2))).size >= 6);
  assert.ok(style.blobs.some(blob => blob.gradientTwist < 0));
  assert.ok(style.blobs.some(blob => blob.gradientTwist > 0));

  const field = style._buildPaintField(style.width, style.height);
  const shadows = [];
  const highlights = [];
  const gapTwists = [];
  for (let index = 0; index < field.mask.length; index += 5) {
    if (field.mask[index] < 0.35) continue;
    shadows.push(field.blobShadow[index]);
    highlights.push(field.blobHighlight[index]);
    gapTwists.push(field.blobGapTwist[index]);
  }

  assert.ok(Math.max(...shadows) - Math.min(...shadows) > 0.10);
  assert.ok(Math.max(...highlights) - Math.min(...highlights) > 0.10);
  assert.ok(Math.max(...gapTwists) - Math.min(...gapTwists) > 0.45);
});

test('PlasmoStyle derives lava color gradients from each organic blob form', async () => {
  const style = new PlasmoStyle({ seed: 1977, variant: 'amoled-lava' });
  style.width = 180;
  style.height = 360;
  await style.init(sampleData);

  const blob = style.blobs[0];
  style.blobs = [blob];
  const aspect = style.height / style.width;
  const cosine = Math.cos(blob.rotation);
  const sine = Math.sin(blob.rotation);
  const sampleFormRing = radius => {
    const coordinates = [];
    for (let step = 0; step < 12; step++) {
      const angle = step / 12 * Math.PI * 2;
      const organicRadius = 1
        + Math.sin(angle * blob.lobes + blob.phase) * blob.wobble
        + Math.sin(
          angle * (blob.lobes + 2) - blob.phase * 0.63
        ) * blob.wobble * 0.42;
      const localX = Math.cos(angle) * blob.radius * organicRadius * radius;
      const localY = Math.sin(angle) * blob.radius * blob.stretch * organicRadius * radius;
      const u = blob.x + localX * cosine - localY * sine;
      const worldY = blob.y + localX * sine + localY * cosine;
      const pigment = {};
      style._blobInfluence(u, worldY / aspect, aspect, null, pigment);
      coordinates.push(pigment.form);
    }
    return coordinates;
  };
  const innerCoordinates = sampleFormRing(0.36);
  const outerCoordinates = sampleFormRing(0.72);
  const average = values => values.reduce((total, value) => total + value, 0)
    / values.length;

  assert.ok(
    average(outerCoordinates) - average(innerCoordinates) > 0.24,
    'gradient progression should primarily follow distance through the blob form'
  );
  assert.ok(
    Math.max(...outerCoordinates) - Math.min(...outerCoordinates) > 0.08,
    'gradient rings should twist rather than repeat as uniform outlines'
  );
  assert.ok(
    Math.max(...outerCoordinates) - Math.min(...outerCoordinates) < 0.24,
    'twisting should not overwhelm the underlying blob silhouette'
  );
});

test('PlasmoStyle carves seeded small holes that redirect contours inside large blobs', async () => {
  const style = new PlasmoStyle({ seed: 1977, variant: 'amoled-lava' });
  style.width = 180;
  style.height = 360;
  await style.init(sampleData);

  assert.ok(style.blobHoles.length >= 3);
  assert.ok(style.blobHoles.length <= style.blobs.length * 2);
  assert.ok(style.blobHoles.every(hole => {
    const sourceBlob = style.blobs.filter(blob => blob.radius >= 0.12)[hole.blobIndex];
    return sourceBlob
      && hole.radius < sourceBlob.radius * 0.17
      && Math.hypot(hole.x - sourceBlob.x, hole.y - sourceBlob.y)
        < sourceBlob.radius * sourceBlob.stretch * 0.62;
  }));

  const aspect = style.height / style.width;
  const hole = style.blobHoles[0];
  const centerPigment = {};
  const carvedInfluence = style._blobInfluence(
    hole.x,
    hole.y / aspect,
    aspect,
    null,
    centerPigment
  );
  const holes = style.blobHoles;
  style.blobHoles = [];
  const solidInfluence = style._blobInfluence(hole.x, hole.y / aspect, aspect);
  style.blobHoles = holes;
  const ringPigment = {};
  style._blobInfluence(
    hole.x + hole.radius,
    hole.y / aspect,
    aspect,
    null,
    ringPigment
  );

  assert.ok(solidInfluence - carvedInfluence > 0.7, 'hole centers should remove blob mass');
  assert.ok(ringPigment.holeFlow > centerPigment.holeFlow + 0.08);
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

test('PlasmoStyle adds sparse semi-transparent cuts inside selected gradient bands', async () => {
  const style = new PlasmoStyle({ seed: 1977, variant: 'amoled-lava' });
  style.width = 160;
  style.height = 300;
  await style.init(sampleData);

  const opacities = [];
  for (let band = -40; band <= 40; band++) {
    for (let step = 0; step <= 100; step++) {
      opacities.push(style._gradientSplitOpacity(band, step / 100));
    }
  }

  const translucent = opacities.filter(opacity => opacity < 0.99);
  assert.ok(translucent.length > 0, 'some bands should contain translucent cuts');
  assert.ok(translucent.length < opacities.length * 0.08, 'cuts should remain occasional');
  assert.ok(Math.min(...translucent) >= 0.675, 'cuts should retain visible pigment');

  const ultraviolet = new PlasmoStyle({ seed: 1977, variant: 'ultraviolet-current' });
  ultraviolet.width = 160;
  ultraviolet.height = 300;
  await ultraviolet.init(sampleData);
  assert.equal(
    ultraviolet._gradientSplitOpacity(0, 0.5),
    1,
    'dense ultraviolet contours should remain uninterrupted'
  );
});

test('PlasmoStyle subtly shifts hue and value across repeated gradient cycles', async () => {
  const style = new PlasmoStyle({
    seed: 1977,
    variant: 'amoled-lava',
    colorway: 'prism'
  });
  style.width = 160;
  style.height = 300;
  await style.init(sampleData);

  const first = style._samplePalette(0.125);
  const repeated = style._samplePalette(1.125);
  const repeatDifference = Math.abs(first.r - repeated.r)
    + Math.abs(first.g - repeated.g)
    + Math.abs(first.b - repeated.b);

  assert.ok(repeatDifference > 2, 'repeated palette cycles should not be identical');
  assert.ok(repeatDifference < 90, 'cycle-to-cycle color drift should remain subtle');

  const top = style._crossGradientDrift(0.5, 0);
  const middle = style._crossGradientDrift(0.5, 0.5);
  const bottom = style._crossGradientDrift(0.5, 1);
  const crossAxisRange = Math.max(top.palette, middle.palette, bottom.palette)
    - Math.min(top.palette, middle.palette, bottom.palette);
  const crossValueRange = Math.max(top.value, middle.value, bottom.value)
    - Math.min(top.value, middle.value, bottom.value);
  assert.ok(crossAxisRange > 0.004, 'hue should also drift across the gradient direction');
  assert.ok(crossValueRange > 0.012, 'value should also drift across the gradient direction');
  assert.ok(
    Math.abs(style.gradientCrossDirection.y) > Math.abs(style.gradientCrossDirection.x),
    'mostly horizontal flow should receive mostly vertical color variation'
  );

  const duplicate = new PlasmoStyle({
    seed: 1977,
    variant: 'amoled-lava',
    colorway: 'prism'
  });
  duplicate.width = 160;
  duplicate.height = 300;
  await duplicate.init(sampleData);
  assert.deepEqual(duplicate._samplePalette(1.125), repeated);
  assert.deepEqual(duplicate._crossGradientDrift(0.5, 1), bottom);
});

test('PlasmoStyle keeps soft varied drip contours subtly inside lava shapes', async () => {
  const style = new PlasmoStyle({
    seed: 1977,
    variant: 'amoled-lava',
    colorway: 'prism'
  });
  style.width = 160;
  style.height = 300;
  await style.init(sampleData);

  const canvas = createCanvas(160, 300);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 160, 300);
  style._renderRaster(ctx, 160, 300);
  const before = ctx.getImageData(0, 0, 160, 300).data;
  const strokeCount = style._renderBlobDripContours(ctx, 160, 300);
  const after = ctx.getImageData(0, 0, 160, 300).data;
  const colorShifts = new Set();
  let changedPixels = 0;
  let exteriorChanges = 0;
  let maximumChange = 0;
  let totalChange = 0;

  for (let index = 0; index < before.length; index += 4) {
    const redChange = after[index] - before[index];
    const greenChange = after[index + 1] - before[index + 1];
    const blueChange = after[index + 2] - before[index + 2];
    const change = Math.max(
      Math.abs(redChange),
      Math.abs(greenChange),
      Math.abs(blueChange)
    );
    if (change === 0) continue;

    changedPixels++;
    totalChange += change;
    maximumChange = Math.max(maximumChange, change);
    if (Math.max(before[index], before[index + 1], before[index + 2]) < 3) {
      exteriorChanges++;
    }
    colorShifts.add([
      Math.sign(redChange),
      Math.sign(greenChange),
      Math.sign(blueChange)
    ].join(','));
  }

  assert.ok(strokeCount >= 16, 'multiple contour shells should expand from the blobs');
  assert.ok(changedPixels > 1200, 'soft contour pigment should remain present');
  assert.equal(exteriorChanges, 0, 'overlay contours should preserve the black exterior');
  assert.ok(colorShifts.size >= 8, 'inner contours should retain varied palette shifts');
  assert.ok(maximumChange <= 8, 'blurred contour accents should remain low contrast');
  assert.ok(
    totalChange / changedPixels < 3,
    'overlay contours should be very subtle on average'
  );
});

test('PlasmoStyle gives every mode a distinct deterministic surface accent system', async () => {
  const modes = [
    {
      variant: 'amoled-lava', kind: 'lens-blooms', detail: 'refracted-crescents',
      minimumMarks: 12
    },
    {
      variant: 'chromatic-wave', kind: 'pearl-rakes', detail: 'spectral-threading',
      minimumMarks: 24
    },
    {
      variant: 'ultraviolet-current', kind: 'vortex-coronas', detail: 'flux-needles',
      minimumMarks: 40
    }
  ];
  const kinds = new Set();
  const signatures = new Set();

  for (const mode of modes) {
    const style = new PlasmoStyle({
      seed: 1977,
      variant: mode.variant,
      colorway: mode.variant === 'ultraviolet-current' ? 'ultraviolet' : 'prism',
      renderScale: 0.54
    });
    style.width = 120;
    style.height = 220;
    await style.init(sampleData);

    const canvas = createCanvas(120, 220);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 120, 220);
    style._renderRaster(ctx, 120, 220);
    const before = ctx.getImageData(0, 0, 120, 220).data;

    const duplicate = createCanvas(120, 220);
    const duplicateCtx = duplicate.getContext('2d');
    duplicateCtx.drawImage(canvas, 0, 0);

    const result = style._renderModeAccents(ctx, 120, 220);
    const duplicateResult = style._renderModeAccents(duplicateCtx, 120, 220);
    const after = ctx.getImageData(0, 0, 120, 220).data;
    const duplicatePixels = duplicateCtx.getImageData(0, 0, 120, 220).data;
    let changedPixels = 0;
    let exteriorChanges = 0;

    for (let index = 0; index < before.length; index += 4) {
      const change = Math.max(
        Math.abs(after[index] - before[index]),
        Math.abs(after[index + 1] - before[index + 1]),
        Math.abs(after[index + 2] - before[index + 2])
      );
      if (change === 0) continue;
      changedPixels++;
      if (Math.max(before[index], before[index + 1], before[index + 2]) < 3) {
        exteriorChanges++;
      }
    }

    assert.deepEqual(result, duplicateResult);
    assert.equal(result.kind, mode.kind);
    assert.equal(result.detail, mode.detail);
    assert.ok(result.marks >= mode.minimumMarks);
    assert.ok(changedPixels > 700, `${mode.kind} should visibly enrich the surface`);
    assert.equal(
      pixelStats(after).signature,
      pixelStats(duplicatePixels).signature,
      `${mode.kind} should remain deterministic`
    );
    if (mode.variant !== 'ultraviolet-current') {
      assert.equal(
        exteriorChanges,
        0,
        `${mode.kind} should preserve AMOLED negative space`
      );
    }
    kinds.add(result.kind);
    signatures.add(pixelStats(after).signature);
  }

  assert.equal(kinds.size, 3);
  assert.equal(signatures.size, 3);
});

test('PlasmoStyle provides three structurally distinct lava visual grammars', async () => {
  const grammars = [
    {
      variant: 'amoled-lava-drift', direction: 'drift', accent: 'shear-ribbons',
      minimumBlobs: 10, minimumMarks: 20
    },
    {
      variant: 'amoled-lava-rise', direction: 'rise', accent: 'bubble-columns',
      minimumBlobs: 12, minimumMarks: 20
    },
    {
      variant: 'amoled-lava-islands', direction: 'islands', accent: 'topographic-shores',
      minimumBlobs: 10, minimumMarks: 16
    }
  ];
  const signatures = new Set();
  const accentSignatures = new Set();

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

    const canvas = createCanvas(150, 280);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 150, 280);
    style._renderRaster(ctx, 150, 280);
    const basePixels = ctx.getImageData(0, 0, 150, 280).data;
    const accent = style._renderLavaDirectionAccents(ctx, 150, 280);
    const accentedPixels = ctx.getImageData(0, 0, 150, 280).data;
    let exteriorChanges = 0;
    for (let index = 0; index < basePixels.length; index += 4) {
      const wasBlack = Math.max(
        basePixels[index], basePixels[index + 1], basePixels[index + 2]
      ) === 0;
      const changed = Math.max(
        Math.abs(accentedPixels[index] - basePixels[index]),
        Math.abs(accentedPixels[index + 1] - basePixels[index + 1]),
        Math.abs(accentedPixels[index + 2] - basePixels[index + 2])
      ) > 0;
      if (wasBlack && changed) exteriorChanges++;
    }
    assert.equal(accent.kind, grammar.accent);
    assert.ok(
      accent.marks >= grammar.minimumMarks,
      `${accent.kind} should draw at least ${grammar.minimumMarks} marks, got ${accent.marks}`
    );
    assert.equal(exteriorChanges, 0, `${accent.kind} should preserve pure-black space`);
    accentSignatures.add(pixelStats(accentedPixels).signature);
  }

  assert.equal(signatures.size, grammars.length);
  assert.equal(accentSignatures.size, grammars.length);
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
