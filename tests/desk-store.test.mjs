// The desks' light record (council/desk-store.mjs, 21 Nov 2026): desk.json without logs and marks, one file per UTC day for them.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { split, readDesk, writeDesk, dayOf } from '../council/desk-store.mjs';

const require = createRequire(import.meta.url);
const T0 = Date.UTC(2026, 10, 18, 9) / 1000;
const rec = (i, extra = {}) => ({ id: 'x-' + i, side: 1, t: T0 + i * 43200, entry: 100, stop: 99, target: 102, status: 'open', R: null,
  log: [{ t: T0 + i * 43200, text: 'entry ' + i }], marks: [{ kind: 'level', p: 99.5, a: T0, at: T0, label: 'L' + i }], ...extra });
const desk = (records) => ({ v: 1, at: '2026-11-21T00:00:00Z', records });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'desk-store-'));

test('split: the light file has no logs or marks; each day file holds that day\'s', () => {
  const { lite, days } = split(desk([rec(0), rec(1), rec(2)]), 'mosha');
  assert.ok(lite.records.every((r) => !('log' in r) && !('marks' in r)));
  assert.deepEqual(lite.detail, { dir: 'mosha/detail', by: 'day' });
  assert.deepEqual(Object.keys(days).sort(), [dayOf(T0), dayOf(T0 + 43200), dayOf(T0 + 86400)].filter((d, i, a) => a.indexOf(d) === i).sort());
  assert.equal(days[dayOf(T0)]['x-0'].log[0].text, 'entry 0');
});

test('write then read gives back every record, logs and marks included; nothing is rewritten when nothing changed', () => {
  const dir = tmp(), out = desk([rec(0), rec(1), rec(2), rec(3, { log: [], marks: [] })]);
  const w = writeDesk(dir, 'eg', out);
  assert.ok(w.written >= 2);
  const lite = JSON.parse(fs.readFileSync(path.join(dir, 'eg', 'desk.json'), 'utf8'));
  assert.ok(lite.records.every((r) => !r.log));
  const back = readDesk(dir, 'eg');
  assert.deepEqual(back.records, out.records);
  assert.ok(!('detail' in back));
  assert.equal(writeDesk(dir, 'eg', back).written, 0, 'a day file is written only when it changes');
});

test('a day no record points at any more is removed', () => {
  const dir = tmp();
  writeDesk(dir, 'lit', desk([rec(0), rec(4)]));
  const before = fs.readdirSync(path.join(dir, 'lit', 'detail'));
  const w = writeDesk(dir, 'lit', desk([rec(4)]));
  assert.equal(w.removed, 1);
  assert.equal(fs.readdirSync(path.join(dir, 'lit', 'detail')).length, before.length - 1);
});

test('an older desk.json (logs inside) is read as it is; a broken desk.json or day file stops the run', () => {
  const dir = tmp(); fs.mkdirSync(path.join(dir, 'msnr'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'msnr', 'desk.json'), JSON.stringify(desk([rec(0)])));
  assert.equal(readDesk(dir, 'msnr').records[0].log[0].text, 'entry 0');
  assert.equal(readDesk(dir, 'none'), null);
  writeDesk(dir, 'msnr', desk([rec(0)]));
  fs.writeFileSync(path.join(dir, 'msnr', 'detail', dayOf(T0) + '.json'), '{"x-0": ');
  assert.throws(() => readDesk(dir, 'msnr'), /does not parse/);
  fs.writeFileSync(path.join(dir, 'msnr', 'desk.json'), '{');
  assert.throws(() => readDesk(dir, 'msnr'), /does not parse/);
});

test('the page reads a log from its day file only when asked, and says so when it cannot', async () => {
  const asked = [], files = { 'mosha/detail/2026-11-18.json': { 'x-0': { log: [{ t: T0, text: 'hello' }], marks: [] } } };
  globalThis.window = globalThis; globalThis.msData = { json: (f) => { asked.push(f); return f in files ? Promise.resolve(files[f]) : Promise.reject(new Error('404')); } };
  try {
    delete require.cache[require.resolve('../assets/mosha-sop.js')];
    const SOP = require('../assets/mosha-sop.js'), det = { dir: 'mosha/detail', by: 'day' };
    const a = await SOP.withDetail(det, { id: 'x-0', t: T0 });
    assert.equal(a.log[0].text, 'hello'); assert.ok(!a.noDetail);
    const b = await SOP.withDetail(det, { id: 'x-1', t: T0 + 86400 * 5 });
    assert.deepEqual(b.log, []); assert.equal(b.noDetail, true);
    const c = { id: 'x-2', t: T0, log: [{ text: 'own' }] };
    assert.equal(await SOP.withDetail(det, c), c);
    assert.deepEqual(asked, ['mosha/detail/2026-11-18.json', 'mosha/detail/2026-11-23.json'], 'only the day files of the trades opened');
  } finally { delete globalThis.msData; }
});

test('the trackers and the desks use the store', () => {
  for (const f of ['council/mosha-desk.mjs', 'council/edge-desks.mjs']) {
    const s = fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    assert.match(s, /readDesk\(dir, /); assert.match(s, /writeDesk\(dir, /); assert.doesNotMatch(s, /writeAtomic\(/);
  }
  for (const f of ['assets/mosha-sop.js', 'assets/desk-trades.js']) assert.match(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'), /withDetail\(fileD, r\)/);
});
