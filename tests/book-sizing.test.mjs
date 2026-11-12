// Book-sizing study (research/edge/book-sizing): the add-off book on hand-made units, the pre-registered reading, and the
// written report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BAR, BOOK, noAdd, retDD, compare, reading } from '../research/edge/book-sizing/run.mjs';
import { WINDOWS, positions } from '../research/edge/supported-book/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/book-sizing/PREREGISTRATION.md'), RES = rd('../research/edge/book-sizing/RESULT.md'), RUN = rd('../research/edge/book-sizing/run.mjs');
const R = JSON.parse(rd('../research/edge/book-sizing/result.json')), LEGS = JSON.parse(rd('../research/edge/supported-book/legs.json')).units;
const T = (s) => Date.parse(s + 'Z') / 1000;

test('OFF leaves out the add units and nothing else', () => {
  const a = { sys: 'gtrend', id: 'p', t: T('2021-01-04T00:09:00'), c: T('2021-01-08T12:00:00'), e: 100, r0: 4, R: 2 };
  const b = { sys: 'gtrend', id: 'p-add', of: 'p', t: T('2021-01-06T00:09:00'), c: T('2021-01-08T12:00:00'), e: 104, r0: 2, R: 1 };
  const g = { sys: 'geg', id: 'q', t: T('2021-01-05T00:09:00'), c: T('2021-01-05T12:00:00'), e: 100, r0: 5, R: -1 };
  assert.deepEqual(noAdd([a, b, g]), [a, g]);
  const on = positions([a, b, g], { mult: 0, fin: 0 }), off = positions(noAdd([a, b, g]), { mult: 0, fin: 0 });
  assert.equal(on.length, off.length); assert.equal(on.find((p) => p.id === 'p').g, 3); assert.equal(off.find((p) => p.id === 'p').g, 2);
  // the committed records: every add belongs to a trend leg whose first unit is on file, and shares its close or closes no later
  const first = new Map(LEGS.filter((u) => !u.of).map((u) => [u.id, u]));
  for (const u of LEGS.filter((x) => x.of)) { assert.ok(u.sys !== 'geg'); const f = first.get(u.of); assert.ok(f && u.t > f.t && u.e > f.e, u.id); }
  assert.equal(positions(noAdd(LEGS), {}).length, positions(LEGS, {}).length, 'the same positions with and without the add');
});

test('return ÷ drawdown', () => {
  assert.equal(retDD([1, -2, 4]), 3 / 2); assert.ok(Number.isNaN(retDD([1, 1])));
});

test('the reading follows the pre-registered bar', () => {
  assert.deepEqual(BAR, { hi: 0.95, lo: 0.05 });
  const mk = (p, D, h) => ({ bootstrap: { pGt0: p }, D, halves: h });
  assert.equal(reading(mk(0.96, 1, [1, 1]), { D: 1 }).reading, 'OFF is better, beyond noise');
  assert.equal(reading(mk(0.96, 1, [1, -1]), { D: 1 }).reading, 'within noise');
  assert.equal(reading(mk(0.96, 1, [1, 1]), { D: -1 }).reading, 'within noise');
  assert.equal(reading(mk(0.94, 1, [1, 1]), { D: 1 }).reading, 'within noise');
  assert.equal(reading(mk(0.04, -1, [-1, -1]), { D: -1 }).reading, 'ON is better, beyond noise');
  assert.equal(reading(mk(0.5, -1, [1, -1]), { D: -1 }).reading, 'within noise');
  assert.match(PRE, /P\(D > 0\) ≥ 0\.95/); assert.match(PRE, /P\(D > 0\) ≤ 0\.05/);
  assert.match(RUN, /from '\.\.\/supported-book\/run\.mjs'/);
});

test('result.json is what the code computes, and ON is the supported-book study\'s book', () => {
  const closes = new Map(JSON.parse(rd('../research/edge/honest-book/gold-1d.json')).bars.map(([t, c]) => [new Date(t * 1000).toISOString().slice(0, 10), c]).filter(([d]) => { const w = new Date(d + 'T00:00:00Z').getUTCDay(); return w !== 0 && w !== 6; }));
  const c = JSON.parse(JSON.stringify(compare(LEGS, BOOK.S2, WINDOWS.W1, { mult: 1, fin: 1 }, closes)));
  assert.deepEqual(c, R.windows.W1.S2.x1F1);
  const sb = JSON.parse(rd('../research/edge/supported-book/result.json')).windows.W1.S2.x1F1;
  assert.equal(c.on.total, sb.total); assert.equal(c.on.maxDD, sb.maxDD); assert.equal(c.on.tDaily, sb.tDaily);
  assert.ok(c.off.units < c.on.units && c.off.positions === c.on.positions && c.off.financing < c.on.financing);
  assert.deepEqual(reading(R.windows.W1.S2.x1F1, R.windows.W1.S2.x2F1), R.readingDetail);
});

test('the written report states the figures of result.json, with n and t', () => {
  const c = R.windows.W1.S2.x1F1, a = R.adds;
  const has = (s) => assert.ok(RES.includes(String(s)), `report lacks ${s}`);
  const sg = (x, d = 1) => (x > 0 ? '+' : '−') + Math.abs(x).toFixed(d);
  assert.match(RES, new RegExp('^\\*\\*Verdict:\\*\\* ' + (R.readingDetail.reading === 'OFF is better, beyond noise' ? 'PASS' : 'FAIL')));
  assert.ok(RES.includes(R.readingDetail.reading.replace(', beyond noise', '')) || RES.includes('within noise'));
  has(sg(c.on.total)); has(sg(c.off.total)); has(`**${c.on.retDD}**`); has(`**${c.off.retDD}**`); has(c.on.tDaily); has(c.off.tDaily);
  has(`${c.on.maxDD}R`); has(`${c.off.maxDD}R`); has(`${c.on.marked.maxDD}R`); has(`${c.off.marked.maxDD.toFixed(1)}R`);
  has(`−${Math.abs(c.D)}`); has(`**−${Math.abs(c.bootstrap.lo)} to\n+${c.bootstrap.hi}**`); has(`**${c.bootstrap.pGt0}**`);
  has(`${c.on.financing}R`); has(`${c.off.financing}R`);
  has(`${sg(c.off.trend.total)}, ${sg(c.off.trend.perPosition, 3)} (${c.off.trend.tPosition.toFixed(2)})`);
  for (const [s, w] of [['gtrend', 'W1'], ['gtrend', 'W2'], ['gtrend5', 'W1'], ['gtrend5', 'W2']]) { const x = a[s][w]; has(`| ${x.n} | ${sg(x.total)} | ${sg(x.mean, 3)} | ${x.t.toFixed(2)} |`); }
  for (const w of ['W2', 'W3']) { const x = R.windows[w].S2.x1F1; has(`${sg(x.on.total)}R, ${x.on.maxDD.toFixed(1)}R, ${x.on.retDD}`); has(`| −${Math.abs(x.D)} | ${x.bootstrap.pGt0} |`); }
  const s3 = R.windows.W1.S3.x1F1; has(`ON ${sg(s3.on.total)}R on ${s3.on.maxDD}R (${s3.on.retDD}, t ${s3.on.tDaily})`); has(`P ${s3.bootstrap.pGt0}`);
  assert.match(RES, /in sample/); assert.match(RES, /Nothing is proposed/);
});
