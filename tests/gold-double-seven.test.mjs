// research/edge/gold-double-seven: the seven-day extreme close, the average filter, the trade (stop, exit, costs),
// one position at a time, the drift baseline and the report against result.json (offline)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ext7, sma, atr, trade, rOf, holm, windowStats, streams, study, eligible, TESTS, P } from '../research/edge/gold-double-seven/run.mjs';

const dir = new URL('../research/edge/gold-double-seven/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const day = (i) => Date.UTC(2010, 0, 4) / 1000 + i * 86400;
const mk = (closes) => closes.map((c, i) => ({ time: day(i), open: c, high: c + 1, low: c - 1, close: c }));

test('ext7: strictly the lowest / highest close of seven; ties are neither; nothing before 7 days', () => {
  const b = mk([10, 9, 8, 7, 6, 5, 4, 3]);
  assert.equal(ext7(b, 5), 0); assert.equal(ext7(b, 6), -1); assert.equal(ext7(b, 7), -1);
  const u = mk([1, 2, 3, 4, 5, 6, 7]); assert.equal(ext7(u, 6), 1);
  const tie = mk([5, 6, 7, 8, 9, 10, 5]); assert.equal(ext7(tie, 6), 0);
});

test('sma and no look-ahead: changing bars after day k leaves the signal inputs up to k unchanged', () => {
  const c = Array.from({ length: 400 }, (_, i) => 100 + i * 0.1 + Math.sin(i / 3) * 4);
  const S = sma(mk(c)); assert.equal(S[198], null); assert.ok(Math.abs(S[199] - c.slice(0, 200).reduce((a, x) => a + x, 0) / 200) < 1e-9);
  const k = 300, c2 = c.map((v, i) => (i > k ? v * 3 : v)), b1 = mk(c), b2 = mk(c2), S2 = sma(b2);
  for (let i = 0; i <= k; i++) {
    assert.equal(ext7(b1, i), ext7(b2, i)); assert.equal(S[i], S2[i]);
    assert.equal(eligible(b1, S, i, 1), eligible(b2, S2, i, 1));
  }
});

test('trade: next open, a stop on the losing side, out after the first opposite seven-day close, else 15 days', () => {
  const flat = mk(Array.from({ length: 80 }, () => 100)), A = atr(flat);
  const t = trade(flat, A, 30, 1);   // flat closes: no seven-day high close -> time exit
  assert.equal(t.entry, flat[31].open); assert.equal(t.why, 'time'); assert.equal(t.exitIdx, 31 + P.maxH);
  assert.equal(t.dist, 2 * A[30]); assert.ok(t.dist > 0);
  const c = Array.from({ length: 80 }, () => 100); c[33] = 101;   // day 33 closes above the six before it
  const b = mk(c), e = trade(b, atr(b), 30, 1);
  assert.equal(e.why, 'exit7'); assert.equal(e.exit, b[34].open); assert.equal(e.exitIdx, 34);
  const g = mk(Array.from({ length: 80 }, () => 100)); g[35] = { ...g[35], open: 90, low: 89, high: 91, close: 90 };
  const s = trade(g, atr(g), 30, 1); assert.equal(s.why, 'stop'); assert.equal(s.exit, 90);
  assert.equal(trade(flat, A, 70, 1), null);   // not enough candles after
});

test('one position at a time; the baseline takes every eligible day', () => {
  const c = Array.from({ length: 500 }, (_, i) => 100 + i * 0.2 + Math.sin(i / 2.3) * 3);
  const { base, sig } = streams(mk(c), TESTS.T1, { ...P, warm: 0 });
  assert.ok(sig.length > 3 && base.length > sig.length);
  for (let k = 1; k < sig.length; k++) assert.ok(sig[k].i + 1 >= sig[k - 1].exitIdx, 'no overlap');
  for (const t of sig) assert.equal(ext7(mk(c), t.i), -1);
});

test('costs: $0.60 a round trip, financing on buys only, doubled at 2x; Holm', () => {
  const t = { side: 1, entry: 2000, exit: 2040, dist: 20, entryT: Date.UTC(2020, 0, 6) / 1000, exitT: Date.UTC(2020, 0, 13) / 1000 };
  const r = rOf(t), fin = 7 * 0.000148 * 2000 / 20;
  assert.equal(r.gross, 2); assert.equal(r.nights, 7);
  assert.ok(Math.abs(r.net - (2 - 0.03 - fin)) < 1e-12 && Math.abs(r.net2 - (2 - 0.06 - 2 * fin)) < 1e-12);
  assert.ok(Math.abs(rOf({ ...t, side: -1 }).net - (-2 - 0.03)) < 1e-12);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('excess is signal mean minus the every-day mean of the same window; 40 placebos', () => {
  const T = (d, net) => ({ entryT: Date.UTC(2010, 0, d) / 1000, net, net2: net, gross: net, why: 'time' });
  const base = [T(1, 1), T(2, 0), T(3, -1), T(4, 2)], sig = [base[0], base[3]];
  const w = windowStats(sig, base, Date.UTC(2010, 0, 1) / 1000, Date.UTC(2010, 2, 1) / 1000);
  assert.equal(w.baseNet, 0.5); assert.equal(w.net, 1.5); assert.equal(w.excess, 1);
  const s = study(mk(Array.from({ length: 600 }, (_, i) => 100 + i * 0.1 + Math.sin(i / 2.3) * 3)), { ...P, warm: 0 });
  for (const x of Object.values(s.tests)) assert.equal(x.placebo.seeds.length, 40);
});

test('the report matches result.json', () => {
  assert.equal(R.verdict, 'FAIL'); assert.equal(R.pass, false);
  const v = md.match(/\*\*Verdict:[^*]*\*\*/)[0];
  assert.match(v, /^\*\*Verdict: FAIL, 0 of 3: /);
  assert.ok(v.length < 220, `verdict line ${v.length} chars`);
  const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  for (const id of ['T1', 'T2', 'T3']) {
    const x = R.tests[id];
    assert.equal(x.pass, false);
    for (const w of ['IS', 'OOS']) {
      assert.ok(md.includes(`| ${x[w].n} |`), `${id} ${w} n`);
      for (const k of ['net', 'baseNet', 'excess2']) assert.ok(md.includes(f(x[w][k])), `${id} ${w} ${k}`);
      assert.ok(md.includes(x[w].t.toFixed(2)), `${id} ${w} t`);
    }
    assert.ok(md.includes(`(${x.placebo.beaten}; `), `${id} placebo`);
    assert.ok(md.includes(`Holm p ${x.holmP.toFixed(2)}`), `${id} holm`);
  }
  assert.equal(R.tests.T1.checks.n, true); assert.equal(R.tests.T2.checks.n, false);
});
