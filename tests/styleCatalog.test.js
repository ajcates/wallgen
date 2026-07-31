import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { URL } from 'node:url';
import { STYLE_CATALOG, getStyleEntry, loadStyleClass } from '../src/styles/styleCatalog.js';

test('style catalog has unique ids and valid modules', () => {
  const ids = STYLE_CATALOG.map(style => style.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 27);

  for (const style of STYLE_CATALOG) {
    assert.ok(style.name);
    assert.ok(style.description);
    assert.ok(fs.existsSync(new URL(`../${style.module.replace(/^\.\//, '')}`, import.meta.url)));
    assert.equal(getStyleEntry(style.id), style);
  }
});

test('style catalog dynamically resolves every generator class', async () => {
  for (const style of STYLE_CATALOG) {
    const loaded = await loadStyleClass(style.id);
    assert.equal(loaded.entry.id, style.id);
    assert.equal(loaded.StyleClass.name, style.class);
  }
});

test('style catalog keeps the historical curves fallback', async () => {
  const loaded = await loadStyleClass('not-a-real-style');
  assert.equal(loaded.entry.id, 'curves');
});
