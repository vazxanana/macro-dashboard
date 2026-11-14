// gold-intraday-efficiency: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { daysOf, efficiency, signals, atr, tradeAt, rOf, excessOf, P } from '../research/edge/gold-intraday-efficiency/run.mjs';

const DIR = 'research/edge/gold-intraday-efficiency/';
const H = 3600, D = 86400, MON = Date.UTC(2020, 0, 6) / 1000;
// one day of 24 H1 candles following closes c (length 24), open o
const dayRows = (t0, o, cs) => cs.map((c, i) => { const op = i ? cs[i - 1] : o; return [t0 + i * H, op, Math.max(op, c) + 0.1, Math.min(op, c) - 0.1, c]; });

test('efficiency: a straight path is 1, a back-and-forth path is low, direction is the sign', () => {
  const up = dayRows(MON, 100, Array.from({ length: 24 }, (_, i) => 101 + i));
  assert.equal(efficiency(up).E, 1); assert.equal(efficiency(up).dir, 1);
  const zig = dayRows(MON, 100, Array.from({ length: 24 }, (_, i) => (i % 2 ? 100 : 102) + (i === 23 ? -1 : 0)));
  const e = efficiency(zig); assert.ok(e.E < 0.05, String(e.E)); assert.equal(e.dir, -1);
});

test('days: weekend candles go to Monday, short days drop out', () => {
  const sun = MON - D, rows = [...dayRows(sun + 22 * H, 100, [101, 102]), ...dayRows(MON, 102, Array.from({ length: 22 }, (_, i) => 103 + i)),
    ...dayRows(MON + D, 120, [121, 122, 123])];
  const days = daysOf(rows);
  assert.equal(days.length, 1); assert.equal(days[0].day, MON); assert.equal(days[0].bars.length, 24); assert.equal(days[0].open, 100);
});

test('signal uses only earlier days, and a trade enters the next day with its stop', () => {
  const rows = []; let px = 100;
  for (let d = 0; d < 300; d++) { const t0 = MON + (Math.floor(d / 5) * 7 + d % 5) * D; const cs = Array.from({ length: 24 }, (_, i) => px + ((i % 2) ? 0.5 : -0.5) * (1 + (d % 7) / 7));
    cs[23] = px + ((d % 3) - 1) * 0.3; rows.push(...dayRows(t0, px, cs)); px = cs[23]; }
  const days = daysOf(rows), S = signals(days), A = atr(days);
  assert.equal(S[P.look - 1], null); assert.ok(S[P.look]);
  // changing the future does not change a signal
  const cut = 270, S2 = signals(days.slice(0, cut + 1));
  assert.deepEqual(S2[cut], S[cut]);
  const t = tradeAt(days, A, cut, 1, 1);
  assert.equal(t.entry, days[cut + 1].bars[0][1]); assert.equal(t.entryT, days[cut + 1].bars[0][0]);
  assert.ok(t.stop < t.entry && Math.abs(t.entry - t.stop - A[cut]) < 1e-9);
  const s = tradeAt(days, A, cut, -1, 1); assert.ok(s.stop > s.entry);
});

test('stop fills at the stop, or at the open on a gap; costs and financing on buys only', () => {
  const mk = (cs) => ({ bars: dayRows(0, 100, cs) });
  const days = [mk(Array(24).fill(100)), { bars: [[D, 100, 100.5, 95, 96], ...dayRows(D + H, 96, Array(23).fill(96))] }];
  const t = tradeAt(days, [5, 5], 0, 1, 1);
  assert.equal(t.why, 'stop'); assert.equal(t.exit, 95);
  const g = tradeAt([mk(Array(24).fill(100)), { bars: [[D, 90, 91, 89, 90], ...dayRows(D + H, 90, Array(23).fill(90))] }], [5, 5], 0, 1, 1);
  assert.equal(g.exit, 90);
  const r = rOf({ side: 1, entry: 100, exit: 105, dist: 5, entryT: MON, exitT: MON + D });
  assert.ok(Math.abs(r.gross - 1) < 1e-12); assert.ok(Math.abs(r.cost - 0.12) < 1e-12); assert.equal(r.nights, 1); assert.ok(r.fin > 0);
  assert.equal(rOf({ side: -1, entry: 100, exit: 95, dist: 5, entryT: MON, exitT: MON + D }).fin, 0);
});

test('excess is against the same side in the same month', () => {
  const T0 = Date.UTC(2020, 0, 10) / 1000, mk = (side, net, sig) => ({ side, net, net2: net, sig, entryT: T0 });
  const ex = excessOf([mk(1, 1, true), mk(1, 0, false), mk(-1, -5, false), mk(-1, 3, true)]);
  assert.deepEqual(ex.map((x) => x.ex), [0.5, 4]);
  assert.deepEqual(excessOf([mk(1, 1, true), mk(1, 0, false), mk(-1, 3, true)], 'long').map((x) => x.ex), [0.5]);
});

test('report matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(DIR + 'result.json', 'utf8')), md = fs.readFileSync(DIR + 'RESULT.md', 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.equal(r.pass, false);
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line.length < 220 && line.includes('FAIL, 0 of 3'));
  const f = (x, d = 3) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(d);
  const t1 = r.tests.T1;
  assert.ok(line.includes(`OOS excess ${f(t1.OOS.ex)}R, month t ${f(t1.OOS.t, 2)}, n ${t1.OOS.n}`), line);
  for (const id of ['T1', 'T2', 'T3']) {
    const x = r.tests[id]; assert.equal(x.pass, false);
    assert.ok(md.includes(`| OOS | ${x.OOS.n} | ${f(x.OOS.sigGross)} | ${f(x.OOS.sigNet)} | ${f(x.OOS.ex)} | ${f(x.OOS.t, 2)} |`), id);
    assert.ok(md.includes(`${x.placebo.beaten} of 40`), id);
    assert.equal(x.placebo.seeds.length, 40);
  }
});
