// node --test tests/isl-engulf-2020.test.mjs - research/edge/isl-engulf-2020: the report's figures against result.json, the
// pieces on hand-made and seeded candles (plain zones = the combo grid's, the two sweep readings, the two breaks, the cut test,
// every order's stop on the losing side). Offline: no candle cache needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as I from '../research/edge/isl-engulf-2020/run.mjs';
import { egZones } from '../research/edge/combo-grid/run.mjs';
import { rng } from '../research/edge/_lib/edgekit.mjs';

const dir = new URL('../research/edge/isl-engulf-2020/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', dir), 'utf8');
const fmtN = (n) => n.toLocaleString('en-US');
const fmtR = (x) => (x < 0 ? '-' : '+') + Math.abs(x).toFixed(4) + 'R';
const fmtT = (t) => (t < 0 ? '-' : '') + Math.abs(t).toFixed(2);

test('the verdict line and the four tests in RESULT.md are the figures of result.json', () => {
  assert.equal(md.split('\n')[2].slice(0, 16), '**Verdict: FAIL.');
  assert.equal(R.verdict, 'FAIL'); assert.equal(R.passed, 0); assert.equal(R.tests.length, 4);
  assert.ok(R.headline.length <= 221);
  for (const t of R.tests) {
    assert.equal(t.pass, false);
    const { is, oos } = t.isl;
    const name = `| ${t.tf === '4h' ? 'H4' : 'H1'}, ${t.exit} | n ${fmtN(is.n)}, ${fmtR(is.meanR)}, t ${fmtT(is.monthT)} |`;
    const row = md.split('\n').find((l) => l.startsWith(name)); assert.ok(row, name);
    assert.ok(row.includes(`| n ${fmtN(oos.n)}, ${fmtR(oos.meanR)}, t ${fmtT(oos.monthT)} | ${fmtR(oos.meanR2c)} | ${t.holm} |`), row);
    // the bar: every test is negative in discovery
    assert.ok(is.meanR < 0 && !t.checks.isMean);
  }
  const t0 = R.tests[0];
  assert.match(md.split('\n')[2], new RegExp(`n ${fmtN(t0.isl.oos.n)}, ${t0.isl.oos.meanR}R a trade, month t ${t0.isl.oos.monthT}`));
});

test('the plain columns and the qualified-minus-plain differences match result.json', () => {
  for (const t of R.tests) {
    const name = `| ${t.tf === '4h' ? 'H4' : 'H1'}, ${t.exit} | n ${fmtN(t.plain.is.n)}`;
    const row = md.split('\n').find((l) => l.startsWith(name)); assert.ok(row, name);
    assert.ok(row.includes(`t ${fmtT(t.plain.oos.monthT)}`), row);
    assert.ok(row.includes(`${fmtR(t.diff.is.diff)}, Welch t ${fmtT(t.diff.is.welchT)}`), row);
    assert.ok(row.includes(`${fmtR(t.diff.oos.diff)}, Welch t ${fmtT(t.diff.oos.welchT)}`), row);
  }
  const g = R.descriptive.xau['1h/2R/islA'];
  assert.ok(md.includes(`H1 2R n ${fmtN(g.is.n)}, ${fmtR(g.is.meanR)} (t ${fmtT(g.is.monthT)}) / n ${fmtN(g.oos.n)}, ${fmtR(g.oos.meanR)}`));
  for (const k of ['1h/2R', '1h/trail']) assert.ok(md.includes(`${fmtR(R.descriptive.qualifiedVsSweepFailed[k].oos.diff)} (t ${fmtT(R.descriptive.qualifiedVsSweepFailed[k].oos.welchT)})`), k);
});

test('the pre-registration fixes four tests and the bar, and names no private source', () => {
  assert.match(pre, /\{H4, H1\} x \{2R, trail\}/);
  for (const w of ['Zlankator', 'zlankator', '411', 'webinar', 'RWB', 'Egsolutions']) { assert.ok(!pre.includes(w), w); assert.ok(!md.includes(w), w); }
});

// ---- the pieces --------------------------------------------------------------------------------------------------------
const bar = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 3600 });
function seeded(n, seed) { const r = rng(seed); let px = 100; const out = [];
  for (let k = 0; k < n; k++) { const o = px, c = o + (r() - 0.5) * 2; const h = Math.max(o, c) + r() * 0.8, l = Math.min(o, c) - r() * 0.8; out.push(bar(k * 3600, o, h, l, c)); px = c; }
  return out; }

test('plain zones are the combo grid egZones zone for zone, with the base candle kept', () => {
  for (const seed of [1, 2, 3]) { const L = seeded(3000, seed), a = egZones(L, 3), b = I.plainZones(L);
    assert.equal(a.length, b.length);
    a.forEach((z, k) => { assert.deepEqual([z.d, z.at, z.bot, z.top, z.end], [b[k].d, b[k].at, b[k].bot, b[k].top, b[k].end]);
      assert.equal(L[b[k].j].h, z.top); assert.equal(L[b[k].j].l, z.bot); }); }
});

test('sweep A: the base swept the candle before it, else up to two steps forward; sweep B: the move took that candle', () => {
  // a buy engulf: base (bearish) at 2 whose high is above candle 1's high; completing candle 3 closes above it
  const L = [bar(0, 10, 10.5, 9.5, 10), bar(3600, 10, 10.6, 9.8, 10.2), bar(7200, 10.3, 10.8, 9.9, 10.0), bar(10800, 10.0, 11.2, 9.95, 11.0)];
  const z = { d: 1, i: 3, j: 2 };
  assert.equal(I.sweepA(L, z), 2); assert.equal(I.sweepB(L, z), true);
  // base high under candle 1's high, no candle between: not qualified by A; B (the move above candle 1's high) still is
  const L2 = L.map((b) => ({ ...b })); L2[2].h = 10.55;
  assert.equal(I.sweepA(L2, z), -1); assert.equal(I.sweepB(L2, z), true);
  // the move never took candle 1's high: B fails too
  const L3 = L2.map((b) => ({ ...b })); L3[3].h = 10.58; L3[3].c = 10.57;
  assert.equal(I.sweepB(L3, z), false);
  // a sell mirror: base bullish at 2 with a low under candle 1's low
  const S = [bar(0, 10, 10.5, 9.5, 10), bar(3600, 10, 10.2, 9.6, 9.9), bar(7200, 9.8, 10.1, 9.4, 10.0), bar(10800, 10.0, 10.05, 9.0, 9.2)];
  assert.equal(I.sweepA(S, { d: -1, i: 3, j: 2 }), 2);
});

test('two breaks: the second wick break of a close turn on the zone side, from the completing candle, before the zone ends', () => {
  const B = { up: [5, 9, 14, 30], dn: [7] };
  assert.equal(I.secondBreak(B, 1, 6, -1), 14);
  assert.equal(I.secondBreak(B, 1, 6, 14), -1);   // the zone closed through at the second break: not qualified
  assert.equal(I.secondBreak(B, -1, 0, -1), -1);  // one break only
  const L = seeded(400, 9), lv = I.levelBreaks(L);
  for (const j of [...lv.up, ...lv.dn]) assert.ok(j >= 5 && j < L.length);
});

test('cut test on seeded candles: orders known before a cut do not change when later candles are removed', () => {
  const M5 = []; const r = rng(4); let px = 1.1;
  for (let k = 0; k < 40000; k++) { const o = px, c = o + (r() - 0.5) * 0.0012; M5.push({ t: k * 300, o, h: Math.max(o, c) + r() * 0.0005, l: Math.min(o, c) - r() * 0.0005, c, e: k * 300 + 300 }); px = c; }
  const cuts = [100, 160, 240].map((d) => d * 14400 * 3);
  for (const tf of I.TFS) { const res = I.cutCheck(M5, cuts, tf); assert.ok(res.compared > 50, tf); assert.equal(res.mismatches, 0, tf); }
});

test('every order has its stop on the losing side', () => {
  const L = seeded(3000, 5);
  for (const o of I.orders(L)) { const entry = o.d > 0 ? o.top : o.bot, stop = o.d > 0 ? o.bot : o.top; assert.ok(o.d * (entry - stop) > 0); assert.ok(I.SETS.includes(o.set)); }
});
