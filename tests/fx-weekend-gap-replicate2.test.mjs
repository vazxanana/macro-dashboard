// Second frozen replication of the forex weekend-gap Rule G (research/edge/fx-weekend-gap-replicate2): the frozen file is the
// first study's run.mjs byte for byte, the window selection, the per-pair quoted spread through the frozen cost formula, Holm,
// the pre-registered reading, and the written report against result.json. Offline, on hand-made candles.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { K, costPx, nyParts, shut, ruleG, weeks, PAIRS } from '../research/edge/fx-weekend-gap-replicate2/frozen.mjs';
import { FROZEN_SHA256, SPREAD, CROSSES, NEWPAIRS, TESTS, withSpread, pairTrades, holmAdj, holds, reading, byYear, overlap } from '../research/edge/fx-weekend-gap-replicate2/run.mjs';

const DIR = new URL('../research/edge/fx-weekend-gap-replicate2/', import.meta.url);
const rd = (f) => fs.readFileSync(new URL(f, DIR), 'utf8');
const T = (s) => Date.parse(s + 'Z') / 1000;
function flat(a, b, px = 1.1) { const out = []; for (let t = a; t < b; t += 300) if (!shut(nyParts(t))) out.push({ time: t, open: px, high: px + 0.0005, low: px - 0.0005, close: px }); return out; }
// a 12-pip gap up on the Friday given, never filled before Monday noon
function gapUp(M5, fri) { const w = weeks(M5).find((x) => x.fri === fri);
  M5[w.iF] = { ...M5[w.iF], close: 1.1 }; for (let i = w.iR; i < M5.length && M5[i].time < w.noon + 3600; i++) M5[i] = { ...M5[i], open: 1.1012, high: 1.1013, low: 1.1011, close: 1.1012 }; }

test('frozen.mjs is the first study\'s run.mjs, byte for byte (the sha256 the first replication pinned)', () => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(new URL('frozen.mjs', DIR))).digest('hex');
  assert.equal(h, '3dfd1dd71f1c1bb2512c5ee0f26573bcb38944f152634ccd622efc1b7002b273');
  assert.equal(FROZEN_SHA256, h);
});

test('pairs, windows and quoted spreads are as pre-registered; S2 uses no pair of either study', () => {
  assert.deepEqual(CROSSES, ['eurgbp', 'gbpjpy', 'audjpy', 'euraud', 'gbpaud', 'eurchf']);
  assert.deepEqual(NEWPAIRS, ['nzdusd', 'usdcad', 'cadjpy', 'nzdjpy', 'audnzd', 'audcad']);
  assert.deepEqual(PAIRS, ['eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdchf', 'eurjpy']);
  assert.ok(!NEWPAIRS.some((p) => CROSSES.includes(p) || PAIRS.includes(p)));
  const oanda = fs.readFileSync(new URL('../api/_oanda.js', import.meta.url), 'utf8');
  for (const p of NEWPAIRS) assert.match(oanda, new RegExp(`\\['${p}', '`), `${p} is an OANDA key`);
  assert.deepEqual([TESTS.S1.from, TESTS.S1.to], [T('2010-01-01T00:00:00'), T('2020-01-01T00:00:00')]);
  assert.deepEqual([TESTS.S2.from, TESTS.S2.to], [T('2016-01-01T00:00:00'), Infinity]);
  const pre = rd('PREREGISTRATION.md'), name = (p) => `${p.slice(0, 3)}/${p.slice(3)}`.toUpperCase();
  assert.equal(Object.keys(SPREAD).length, 12);
  for (const [p, s] of Object.entries(SPREAD)) assert.match(pre, new RegExp(`\\| ${name(p)} \\| ${s.toFixed(1)} \\|`), p);
  assert.match(pre, /monthly-sum t ≥ 2; Holm-adjusted p < 0\.05; n ≥ 150/);
});

test('the per-pair spread goes through the frozen cost formula and is put back', () => {
  assert.equal(K.SPREAD_PIPS, 0.3);
  const c = withSpread(1.0, () => costPx('nzdjpy', 90));
  assert.ok(Math.abs(c - (0.01 * (1.0 + 2) + 45e-6 * 90)) < 1e-12);
  assert.equal(K.SPREAD_PIPS, 0.3);
  assert.throws(() => withSpread(9, () => { throw new Error('x'); })); assert.equal(K.SPREAD_PIPS, 0.3);
});

test('window selection: only weeks whose Friday is in the window; trades are the frozen Rule G with the pair\'s cost', () => {
  const M5 = flat(T('2019-11-01T00:00:00'), T('2020-02-18T00:00:00'));
  for (const fri of ['2019-12-13', '2020-02-14']) gapUp(M5, fri);       // two gaps either side of the S1 end
  const s1 = pairTrades('eurgbp', M5, TESTS.S1.from, TESTS.S1.to);
  assert.deepEqual(s1.trades.map((t) => t.fri), ['2019-12-13']);
  const t = s1.trades[0], w = weeks(M5).find((x) => x.fri === '2019-12-13'), ref = withSpread(0.4, () => ruleG('eurgbp', M5, w));
  assert.equal(t.net, ref.net); assert.equal(t.spread, 0.4);
  assert.ok(Math.abs(t.net - (t.R - (0.0001 * 2.4 + 45e-6 * t.entry) / t.r0)) < 1e-4);
  assert.ok(t.side < 0 && t.stop > t.entry, 'every trade has its stop on the losing side');
  assert.deepEqual(pairTrades('audcad', M5, TESTS.S2.from, TESTS.S2.to).trades.map((x) => x.fri), ['2019-12-13', '2020-02-14']);
  const M6 = flat(T('2015-11-01T00:00:00'), T('2016-02-18T00:00:00')); gapUp(M6, '2015-12-11'); gapUp(M6, '2016-02-12');
  assert.deepEqual(pairTrades('audcad', M6, TESTS.S2.from, TESTS.S2.to).trades.map((x) => x.fri), ['2016-02-12']);
});

test('Holm, the four-line bar and the reading words', () => {
  assert.deepEqual(holmAdj([0.01, 0.04]), [0.02, 0.04]);
  assert.deepEqual(holmAdj([0.3, 0.6]), [0.6, 0.6]);
  const ok = { net: 0.1, tMonth: 2.5, pAdj: 0.02, n: 200 };
  assert.equal(holds(ok), true);
  for (const bad of [{ net: 0 }, { tMonth: 1.99 }, { pAdj: 0.05 }, { n: 149 }]) assert.equal(holds({ ...ok, ...bad }), false);
  assert.equal(reading(ok, ok), 'REPLICATES');
  assert.equal(reading(ok, { ...ok, n: 100 }), 'PARTLY');
  assert.equal(reading({ ...ok, tMonth: 1.5 }, { ...ok, net: -0.1 }), 'DOES NOT REPLICATE');
});

test('per-year concentration and weekend overlap', () => {
  const tr = (fri, net) => ({ fri, net, F: T(fri + 'T21:00:00'), filled: T(fri + 'T21:00:00') + 172800, R: net, net2: net, costR: 0, r0Pips: 10, nights: 0, exit: 'target' });
  const y = byYear([tr('2016-01-08', 1), tr('2016-02-05', 1), tr('2017-01-06', -0.5), tr('2018-01-05', 0.5)]);
  assert.equal(y.best, '2016'); assert.equal(y.bestTotal, 2); assert.equal(y.bestShare, +(2 / 2).toFixed(4));
  assert.equal(y.withoutBest.n, 2);
  const o = overlap([tr('2016-01-08', 1), tr('2016-01-08', -1), tr('2017-01-06', 0.5)], new Set(['2016-01-08']), new Set(['2017-01-06']));
  assert.deepEqual(o.with880, { n: 2, fridays: 1, net: 0 }); assert.equal(o.with928.n, 1); assert.equal(o.withEither.n, 3); assert.equal(o.neither.n, 0);
});

test('result.json: the gate passed, the reading follows from the figures, RESULT.md says the same', () => {
  const r = JSON.parse(rd('result.json')), md = rd('RESULT.md');
  assert.equal(r.gate.pass, true);
  assert.deepEqual([r.gate.published.dec.n, r.gate.published.dec.net, r.gate.published.dec.tMonth], [243, 0.194, 2.1411]);
  assert.deepEqual(r.gate.got.dec, r.gate.published.dec); assert.deepEqual(r.gate.got.rep, r.gate.published.rep);
  assert.equal(r.frozenSha256, FROZEN_SHA256);
  assert.equal(r.reading, reading(r.tests.S1, r.tests.S2));
  assert.deepEqual([r.tests.S1.pAdj, r.tests.S2.pAdj], holmAdj([r.tests.S1.p, r.tests.S2.p]).map((x) => +x.toFixed(4)));
  assert.equal(r.tests.S3.n, r.tests.S1.n + r.tests.S2.n);
  assert.equal(r.trades.S1.length, r.tests.S1.n); assert.equal(r.trades.S2.length, r.tests.S2.n);
  for (const x of r.trades.S1) assert.ok(CROSSES.includes(x[0]) && x[1] >= '2010' && x[1] < '2020');
  for (const x of r.trades.S2) assert.ok(NEWPAIRS.includes(x[0]) && x[1] >= '2016');
  assert.match(md.split('\n').find((l) => l.startsWith('**Verdict:')), new RegExp(`^\\*\\*Verdict: ${r.reading}\\.\\*\\*`));
  const f = (x, d = 3) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(d);
  for (const k of ['S1', 'S2', 'S3']) { const v = r.tests[k];
    assert.ok(md.includes(`| ${k} | ${v.n} | `), k);
    assert.ok(md.includes(f(v.net)), `${k} net`); assert.ok(md.includes(f(v.net2x)), `${k} 2x`); assert.ok(md.includes(v.tMonth.toFixed(2)), `${k} t`);
    assert.ok(md.includes(f(v.flat03.net)), `${k} flat`); assert.ok(md.includes(f(v.placebo.p95)), `${k} placebo`); }
  assert.ok(md.includes(r.tests.S1.pAdj.toFixed(4)) && md.includes(r.tests.S2.pAdj.toFixed(4)));
  for (const k of ['S1', 'S2']) assert.ok(md.includes(`${r.tests[k].overlap.withEither.n} of ${r.tests[k].n}`), `${k} overlap`);
});
