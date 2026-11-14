// research/edge/gold-mfi: MFI, its price-only twin, the gap signal, the trade (stop, costs), the drift baseline and the report
// against result.json (offline)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { flows, quantile, crosses, barsOf, atr, trade, rOf, holm, windowStats, study, P } from '../research/edge/gold-mfi/run.mjs';

const dir = new URL('../research/edge/gold-mfi/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const day = (i) => Date.UTC(2010, 0, 4) / 1000 + i * 86400;
const mk = (closes, vols) => closes.map((c, i) => ({ time: day(i), open: c, high: c + 1, low: c - 1, close: c, v: vols ? vols[i] : 100 }));

test('MFI and its twin: equal when volume is constant; heavier up-day volume lifts MFI above the twin; null before 15 days', () => {
  const c = Array.from({ length: 30 }, (_, i) => 100 + (i % 2 ? 1 : -1) * 0.5 + i * 0.01);
  const f = flows(mk(c));
  assert.equal(f.mfi[13], null); assert.ok(f.mfi[14] != null);
  for (let i = 14; i < 30; i++) assert.ok(Math.abs(f.gap[i]) < 1e-9);
  const v = c.map((x, i) => (i > 0 && x > c[i - 1] ? 300 : 100));
  const g = flows(mk(c, v));
  assert.ok(g.gap[29] > 10, `gap ${g.gap[29]}`);
  assert.ok(g.mfi[29] > g.pfi[29]);
  // only up days: both 100
  const up = flows(mk(Array.from({ length: 20 }, (_, i) => 100 + i)));
  assert.equal(up.mfi[19], 100); assert.equal(up.pfi[19], 100);
});

test('quantile interpolates; weekend volume is added to Monday and its prices folded', () => {
  assert.equal(quantile([0, 10], 0.9), 9); assert.equal(quantile([1, 2, 3, 4, 5], 0.5), 3);
  const fri = Date.UTC(2020, 0, 3) / 1000;
  const rows = [[fri, 10, 11, 9, 10, 5], [fri + 86400 * 2, 10, 15, 8, 12, 7], [fri + 86400 * 3, 12, 13, 11, 12, 20]];
  const b = barsOf(rows, fri + 86400 * 10);
  assert.equal(b.length, 2); assert.equal(b[1].v, 27); assert.equal(b[1].high, 15); assert.equal(b[1].open, 10);
});

test('signals: null before L earlier gaps; no look-ahead (changing bars after day k leaves days up to k unchanged)', () => {
  const n = 400, c = Array.from({ length: n }, (_, i) => 100 + Math.sin(i / 7) * 5 + Math.sin(i / 3.1) * 2);
  const v = Array.from({ length: n }, (_, i) => 100 + ((i * 37) % 50));
  const x = crosses(mk(c, v));
  assert.equal(x[P.n + P.look - 1], null); assert.notEqual(x[P.n + P.look], null);
  assert.ok(x.includes(1) && x.includes(-1));
  const k = 330, c2 = c.map((y, i) => (i > k ? y * 3 : y)), v2 = v.map((y, i) => (i > k ? y * 9 : y));
  assert.deepEqual(crosses(mk(c2, v2)).slice(0, k + 1), x.slice(0, k + 1));
});

test('trade: fills at the next open, a stop on the losing side, a gap fills at the open, time exit at open i+1+H', () => {
  const bars = mk(Array.from({ length: 60 }, () => 100)), A = atr(bars);
  const t = trade(bars, A, 30, 1, 10);
  assert.equal(t.entry, bars[31].open); assert.equal(t.exit, bars[41].open); assert.equal(t.why, 'time');
  assert.equal(t.dist, 2 * A[30]); assert.ok(t.dist > 0);
  const b2 = mk(Array.from({ length: 60 }, () => 100)); b2[35] = { ...b2[35], open: 90, low: 89, high: 91, close: 90 };
  const s = trade(b2, atr(b2), 30, 1, 10); assert.equal(s.why, 'stop'); assert.equal(s.exit, 90);
  assert.equal(trade(bars, A, 50, 1, 10), null);
});

test('costs: $0.60 a round trip, financing on buys only, doubled at 2x; Holm; excess vs the every-day mean', () => {
  const t = { side: 1, entry: 2000, exit: 2040, dist: 20, entryT: Date.UTC(2020, 0, 6) / 1000, exitT: Date.UTC(2020, 0, 13) / 1000 };
  const r = rOf(t), fin = 7 * 0.000148 * 2000 / 20;
  assert.ok(Math.abs(r.net - (2 - 0.03 - fin)) < 1e-12 && Math.abs(r.net2 - (2 - 0.06 - 2 * fin)) < 1e-12);
  assert.ok(Math.abs(rOf({ ...t, side: -1 }).net - (-2 - 0.03)) < 1e-12);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const T = (d, net) => ({ entryT: Date.UTC(2010, 0, d) / 1000, net, net2: net, gross: net, why: 'time' });
  const base = [T(1, 1), T(2, 0), T(3, -1), T(4, 2)];
  const w = windowStats([base[0], base[3]], base, Date.UTC(2010, 0, 1) / 1000, Date.UTC(2010, 2, 1) / 1000);
  assert.equal(w.baseNet, 0.5); assert.equal(w.excess, 1);
  const n = 400, c = Array.from({ length: n }, (_, i) => 100 + Math.sin(i / 7) * 5);
  const s = study(mk(c, c.map((_, i) => 100 + ((i * 37) % 50))), { ...P, warm: 0 });
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
      for (const k of ['gross', 'net', 'baseNet', 'excess', 'excess2']) assert.ok(md.includes(f(x[w][k])), `${id} ${w} ${k}`);
      assert.ok(md.includes(x[w].t.toFixed(2)), `${id} ${w} t`);
    }
    assert.ok(md.includes(`(${x.placebo.beaten}; `), `${id} placebo`);
    assert.ok(md.includes(`Holm p ${x.holmP.toFixed(2)}`), `${id} holm`);
    assert.equal(x.checks.n, true);
  }
});
