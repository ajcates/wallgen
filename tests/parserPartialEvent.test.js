import test from 'node:test';
import assert from 'node:assert';
import { parsePartialEvent } from '../src/data/logParser.js';

test('parsePartialEvent parses partial event string correctly', () => {
  const event = parsePartialEvent('BP=42;PT=123;FM=55');
  assert.strictEqual(event.bp, 42);
  assert.strictEqual(event.pt, 123);
  assert.strictEqual(event.fm, 55);
  assert.strictEqual(event.raw, 'BP=42;PT=123;FM=55');
});

test('parsePartialEvent parses TIME correctly', () => {
  const event = parsePartialEvent('TIME=14.30;BP=10');
  assert.strictEqual(event.hh, 14);
  assert.strictEqual(event.mm, 30);
  assert.strictEqual(event.bp, 10);
});