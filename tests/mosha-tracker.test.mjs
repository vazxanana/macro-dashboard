// The Mosha desk's tracker (council/mosha-desk.mjs): the desk's reading of the method on gold, recorded in the council loop
// like the ICT desk's signals (council-data mosha/desk.json). A paper record only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as M from '../council/mosha-desk.mjs';

const rd = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const rec = (o) => ({ id: 'bar-15m-1000', kind: 'barrier', h: '15m', l: '1m', side: -1, t: 1000, entry: 100, stop: 102, target: 94, status: 'open', R: null, log: [{ t: 990, text: 'x' }], ...o });

test('a record is stored only with a stop on the losing side of its entry', () => {
  assert.equal(M.clean(rec({ stop: 99 })), null); assert.equal(M.clean(rec({ side: 1, stop: 102 })), null); assert.equal(M.clean(rec({ stop: NaN })), null);
  const c = M.clean(rec({ zone: { big: 1 } })); assert.equal(c.r0, 2); assert.equal(c.zone, undefined); assert.equal(c.side, -1);
});

test('merge: a new record is stamped, live only when seen within the hour; a closed one is frozen; an open one is followed', () => {
  const now = 5000;
  let a = M.merge(null, [rec({ t: now - 600, id: 'a' }), rec({ t: now - 9000, id: 'b', side: 1, stop: 98, target: 106 })], now);
  assert.deepEqual(a.map((r) => [r.id, r.src, r.first]), [['a', 'live', now], ['b', 'replay', now]]);
  // the open one closes: its first sight and source stay
  let b = M.merge(a, [rec({ t: now - 600, id: 'a', status: 'stopped', R: -1, endT: now + 100 }), rec({ t: now - 9000, id: 'b', side: 1, stop: 98, target: 106 })], now + 2000);
  assert.equal(b[0].R, -1); assert.equal(b[0].src, 'live'); assert.equal(b[0].first, now);
  // a closed record never changes, whatever a later run reads
  let c = M.merge(b, [rec({ t: now - 600, id: 'a', status: 'target', R: 3, entry: 101, stop: 103 })], now + 4000);
  assert.deepEqual(c.find((r) => r.id === 'a'), b[0]);
  // a record this run no longer reads is kept
  assert.ok(c.find((r) => r.id === 'b'));
  // the same trade read again under another id (same kind and side, minutes apart) is not added twice
  let d = M.merge(c, [rec({ t: now - 600 + 300, id: 'a2' })], now + 6000);
  assert.equal(d.filter((r) => r.kind === 'barrier' && r.side === -1).length, 1);
  assert.ok(M.merge(null, Array.from({ length: M.KEEP + 50 }, (_, i) => rec({ id: 'k' + i, t: 1e6 + i * 7200 })), 2e9).length === M.KEEP);
});

test('the page functions are lifted from the page, and the script is a paper record only', () => {
  const F = M.loadFns(); for (const k of ['msAnalyze', 'msMosha', 'msZones', 'msInternal']) assert.equal(typeof F[k], 'function');
  const src = rd('council/mosha-desk.mjs');
  assert.doesNotMatch(src, /ctrader|sendAlerts|alerts\.mjs|trader\.mjs|NEW_ORDER|method:\s*'POST'/i);
  const yml = rd('.github/workflows/council.yml');
  assert.match(yml, /timeout 120 node council\/mosha-desk\.mjs data \|\| echo/); assert.match(yml, /\n {12}assets\n/);
  assert.match(rd('council/datahealth.mjs'), /file: 'mosha\/desk\.json'/);
});

test('the desk reads the stored trades first and replays in the browser only without them', () => {
  const js = rd('assets/mosha-sop.js');
  assert.match(js, /D\.json\('mosha\/desk\.json'\)/); assert.match(js, /if \(j && !force\)/); assert.match(js, /S\.file = null; S\.state = 'idle'; replay\(\)/);
  for (const k of ['data-sop-src', 'Live (', 'Replay (', 'Mosha trades']) assert.ok(js.includes(k), k);
  assert.doesNotMatch(js, /fetch\('\/cdata/);
});
