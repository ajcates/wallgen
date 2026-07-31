import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { SymmetryStyle } from '../src/styles/SymmetryStyle.js';

const sample = { up: 835, bp: 62, fm: 44, pt: 72, hh: 15, mm: 37 };

test('SymmetryStyle chooses a complete art direction with rotational symmetry', async () => {
  const style = new SymmetryStyle({ width: 400, height: 400, seed: 22 });
  await style.init([sample]);
  assert.ok(['stained-glass', 'neon-wire', 'paper-cut', 'celestial-ink', 'chrome-op-art', 'botanical', 'crystal-mosaic', 'desert-weave'].includes(style.family));
  assert.ok(style.symmetry >= 4);
  assert.ok(style.motifs.length >= 5);
  assert.ok(style.motifs.every(motif => Number.isFinite(motif.rotation)));
  assert.ok(style.dna.effects.length >= 3);
  assert.ok(style.dna.effects.every(gene => typeof gene.name === 'string'));
});

test('SymmetryStyle applies an explicitly ordered DNA chain', async () => {
  const config = { width: 400, height: 400, seed: 22, family: 'crystal-mosaic', symmetry: 10, effects: 'split,twist,prism,surface-cycle' };
  const style = new SymmetryStyle(config);
  await style.init([sample]);
  assert.deepEqual(style.dna.effects.map(gene => gene.name), ['split', 'twist', 'prism', 'surface-cycle']);
  assert.ok(style.motifs.length > 10, 'split should expand the radial shape genome');
});

test('SymmetryStyle DNA effect order changes the resulting motif genome', async () => {
  const base = { width: 400, height: 400, seed: 91, family: 'neon-wire', symmetry: 8 };
  const echoThenWave = new SymmetryStyle({ ...base, effects: 'echo,radial-wave' });
  const waveThenEcho = new SymmetryStyle({ ...base, effects: 'radial-wave,echo' });
  await Promise.all([echoThenWave.init([sample]), waveThenEcho.init([sample])]);
  const first = echoThenWave.motifs.map(({ radius, rotation }) => [radius, rotation]);
  const second = waveThenEcho.motifs.map(({ radius, rotation }) => [radius, rotation]);
  assert.notDeepEqual(first, second);
});

test('SymmetryStyle renders every supported art family', async () => {
  for (const family of ['stained-glass', 'neon-wire', 'paper-cut', 'celestial-ink', 'chrome-op-art', 'botanical', 'crystal-mosaic', 'desert-weave']) {
    const style = new SymmetryStyle({ width: 300, height: 300, family, symmetry: 8, seed: 22 });
    await style.init([sample]);
    const canvas = createCanvas(300, 300);
    assert.doesNotThrow(() => style.render(canvas.getContext('2d'), 300, 300));
  }
});
