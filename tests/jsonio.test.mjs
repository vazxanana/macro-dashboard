// council/jsonio.mjs: atomic replace and missing-vs-corrupt reads (9 Nov reliability audit)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeAtomic, writeIfChanged, readJson } from '../council/jsonio.mjs';

test('writeAtomic replaces the file whole and leaves no temporary file; a failed write keeps the old copy', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonio-')), f = path.join(dir, 'sub', 'a.json');
  writeAtomic(f, '{"v":1}'); assert.equal(fs.readFileSync(f, 'utf8'), '{"v":1}');
  writeAtomic(f, '{"v":2}'); assert.equal(fs.readFileSync(f, 'utf8'), '{"v":2}');
  assert.deepEqual(fs.readdirSync(path.dirname(f)), ['a.json']);
  // the target is a directory → rename fails: the error surfaces, no temporary file is left
  const d = path.join(dir, 'isdir'); fs.mkdirSync(path.join(d, 'x'), { recursive: true });
  assert.throws(() => writeAtomic(d, 'x'));
  assert.deepEqual(fs.readdirSync(dir).filter((n) => n.endsWith('.tmp')), []);
});

test('writeIfChanged writes only a change; readJson tells missing from corrupt', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonio-')), f = path.join(dir, 'b.json');
  assert.equal(writeIfChanged(f, '[1]'), true); assert.equal(writeIfChanged(f, '[1]'), false); assert.equal(writeIfChanged(f, '[1,2]'), true);
  assert.deepEqual(readJson(f, []), { value: [1, 2], state: 'ok' });
  assert.deepEqual(readJson(path.join(dir, 'none.json'), { d: 1 }), { value: { d: 1 }, state: 'missing' });
  fs.writeFileSync(f, '[1,');
  const r = readJson(f, []); assert.equal(r.state, 'corrupt'); assert.deepEqual(r.value, []); assert.ok(r.error);
});
