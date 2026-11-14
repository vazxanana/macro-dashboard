// research/edge/gold-aroon: Aroon(25), the crosses, the trade (stop, costs), the drift baseline and the report against result.json (offline)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { aroon, crosses, atr, trade, rOf, holm, windowStats, study, P } from '../research/edge/gold-aroon/run.mjs';

const dir = new URL('../research/edge/gold-aroon/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const day = (i) => Date.UTC(2010, 0, 4) / 1000 + i * 86400;
const mk = (closes) => closes.map((c, i) => ({ time: day(i), open: c, high: c + 1, low: c - 1, close: c }));

test('Aroon: a steady rise has Up 100 and Down 0; null before 25 days; ties take the latest extreme', () => {
  const up = aroon(mk(Array.from({ length: 40 }, (_, i) => 100 + i)));
  assert.equal(up.up[24], null); assert.equal(up.up[25], 100); assert.equal(up.dn[25], 0);
  const flat = aroon(mk(Array.from({ length: 30 }, () => 100)));
  assert.equal(flat.up[29], 100); assert.equal(flat.dn[29], 100);
  // the high 5 days ago -> Up = 100 * 20 / 25
  const c = Array.from({ length: 30 }, () => 100); c[24] = 110;
  assert.equal(aroon(mk(c)).up[29], 80);
});

test('crosses and no look-ahead: changing bars after day k leaves crosses up to k unchanged', () => {
  const c = Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i / 9) * 10);
  const x = crosses(mk(c));
  assert.ok(x.includes(1) && x.includes(-1));
  const k = 120, c2 = c.map((v, i) => (i > k ? v * 3 : v));
  assert.deepEqual(crosses(mk(c2)).slice(0, k + 1), x.slice(0, k + 1));
});

test('trade: fills at the next open, a stop on the losing side, a gap fills at the open, time exit at open i+1+H', () => {
  const bars = mk(Array.from({ length: 60 }, () => 100)), A = atr(bars);
  const t = trade(bars, A, 30, 1, 10);
  assert.equal(t.entry, bars[31].open); assert.equal(t.exit, bars[41].open); assert.equal(t.why, 'time');
  assert.equal(t.dist, 2 * A[30]); assert.ok(t.dist > 0);
  const b2 = mk(Array.from({ length: 60 }, () => 100)); b2[35] = { ...b2[35], open: 90, low: 89, high: 91, close: 90 };
  const s = trade(b2, atr(b2), 30, 1, 10); assert.equal(s.why, 'stop'); assert.equal(s.exit, 90);
  const sh = trade(b2, atr(b2), 30, -1, 10); assert.equal(sh.why, 'time');
  assert.equal(trade(bars, A, 50, 1, 10), null);   // not enough candles after
});

test('costs: $0.60 a round trip, financing on buys only, doubled at 2x; Holm', () => {
  const t = { side: 1, entry: 2000, exit: 2040, dist: 20, entryT: Date.UTC(2020, 0, 6) / 1000, exitT: Date.UTC(2020, 0, 13) / 1000 };
  const r = rOf(t), fin = 7 * 0.000148 * 2000 / 20;
  assert.equal(r.gross, 2); assert.equal(r.nights, 7);
  assert.ok(Math.abs(r.net - (2 - 0.03 - fin)) < 1e-12 && Math.abs(r.net2 - (2 - 0.06 - 2 * fin)) < 1e-12);
  assert.ok(Math.abs(rOf({ ...t, side: -1 }).net - (-2 - 0.03)) < 1e-12);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('excess is signal mean minus the every-day mean of the same window', () => {
  const T = (d, net) => ({ entryT: Date.UTC(2010, 0, d) / 1000, net, net2: net, gross: net, why: 'time' });
  const base = [T(1, 1), T(2, 0), T(3, -1), T(4, 2)], sig = [base[0], base[3]];
  const w = windowStats(sig, base, Date.UTC(2010, 0, 1) / 1000, Date.UTC(2010, 2, 1) / 1000);
  assert.equal(w.baseNet, 0.5); assert.equal(w.net, 1.5); assert.equal(w.excess, 1);
  const s = study(mk(Array.from({ length: 300 }, (_, i) => 100 + Math.sin(i / 9) * 10)), { ...P, warm: 0 });
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
    assert.equal(x.checks.n, false);
  }
});
