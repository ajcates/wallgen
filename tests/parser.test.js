import test from 'node:test';
import assert from 'node:assert';
import { parseLogLine } from '../src/data/logParser.js';

test('parser: valid log line', (t) => {
  const line = 'TIME=14.30; BP=85; FM=1024; UP=123456; PT=45';
  const result = parseLogLine(line);
  
  assert.notStrictEqual(result, null);
  assert.strictEqual(result.hh, 14);
  assert.strictEqual(result.mm, 30);
  assert.strictEqual(result.bp, 85);
  assert.strictEqual(result.fm, 1024);
  assert.strictEqual(result.up, 123456);
  assert.strictEqual(result.pt, 45);
});

test('parser: invalid log line', (t) => {
  assert.strictEqual(parseLogLine('garbage text'), null);
  assert.strictEqual(parseLogLine(''), null);
});
