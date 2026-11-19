// research/edge/fx-cycle: the owner's market cycle as an entry on forex majors (pre-registered study). Offline: hand-made candles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as R from '../research/edge/fx-cycle/run.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'fx-cycle');
const bar = (time, open, high, low, close) => ({ time, open, high, low, close });
const T0 = Date.parse('2025-03-04T00:00:00Z') / 1000;   // a Tuesday, an H4 bucket start

// H4: a swing high (15) at index 3, broken by candle 7's close (16) -> an H4 BO up at T0 + 4 h. Candle 8 (optional) closes below
// the swing low at index 4 -> a newer H4 BO down at T0 + 8 h.
function h4(withNewer) {
  const hi = [10, 11, 12, 15, 12, 11, 10, 16], lo = [9, 9.5, 9.6, 9.7, 9, 9.5, 9.6, 9.8], cl = [10, 10, 10, 10, 10, 10, 10, 16];
  const B = hi.map((h, i) => bar(T0 - (7 - i) * 14400, Math.min(h, Math.max(lo[i], 10)), h, lo[i], cl[i]));
  if (withNewer) B.push(bar(T0 + 14400, 16, 16, 8.8, 8.9));
  return B;
}
// H1: 14 flat candles, then the H4 BO candle's hours, the pullback (H1 ChoCh down at index 7), the pullback low 16.0, and the
// H1 BO back up at index 11 (close 16.8 over the swing high 16.6 at index 9). Entry at index 12's open (12:00 UTC).
const PAD = 14;
function h1(after = []) {
  const rows = [
    [15, 16.5, 14.8, 16], [16, 17, 15.5, 16.5], [16.5, 17.5, 16, 17], [17, 18, 16.8, 17.5],
    [17.5, 17.6, 17, 17.2], [17.2, 17.3, 16.5, 16.6], [16.6, 16.9, 16.6, 16.8], [16.8, 16.9, 16.2, 16.3],
    [16.3, 16.4, 16.0, 16.1], [16.1, 16.6, 16.05, 16.5], [16.5, 16.55, 16.3, 16.4], [16.4, 16.9, 16.35, 16.8],
    [16.8, 16.9, 16.7, 16.85], ...after,
  ];
  const B = [];
  for (let i = 0; i < PAD; i++) B.push(bar(T0 - (PAD - i) * 3600, 15, 15.2, 14.9, 15));
  rows.forEach((r, i) => B.push(bar(T0 + i * 3600, ...r)));
  return B;
}

test('swings: strictly above the w after, not below the w before', () => {
  const B = [1, 2, 5, 2, 1].map((h, i) => bar(i, h, h, h - 1, h));
  assert.deepEqual([...R.swings(B, 1).hi], [0, 0, 1, 0, 0]);
  const E = [1, 5, 5, 1].map((h, i) => bar(i, h, h, h - 1, h));
  assert.deepEqual([...R.swings(E, 1).hi], [0, 0, 1, 0], 'an equal high after kills the first, not the second');
  assert.deepEqual([...R.swings(B, 1).lo], [0, 0, 0, 0, 0]);
});

test('BO: only after the swing exists (closed candles), each level once, time = the candle close', () => {
  // swing high at 1 (high 5) exists from the close of 2; candle 3 closes above it, candle 4 again (no second BO)
  const B = [bar(0, 3, 3, 2, 3), bar(10, 4, 5, 3, 4), bar(20, 4, 4.5, 3.5, 4), bar(30, 4, 6, 4, 5.5), bar(40, 5.5, 7, 5, 6.5)];
  const ev = R.boEvents(B, 1, 10);
  assert.equal(ev.length, 1);
  assert.deepEqual([ev[0].dir, ev[0].i, ev[0].t, ev[0].level], [1, 3, 40, 5]);
  // a close above the level by the very candle that would confirm the swing is not a BO of it (the swing does not exist yet)
  const C = [bar(0, 3, 3, 2, 3), bar(10, 4, 5, 3, 4), bar(20, 4, 6, 3.5, 5.5)];
  assert.equal(R.boEvents(C, 1, 10).length, 0);
});

test('H4 from H1 in UTC buckets', () => {
  const B = [bar(T0, 1, 2, 0.5, 1.5), bar(T0 + 3600, 1.5, 3, 1, 2), bar(T0 + 14400, 2, 2.5, 1.8, 2.2)];
  const H4 = R.toH4(B);
  assert.equal(H4.length, 2);
  assert.deepEqual(H4[0], bar(T0, 1, 3, 0.5, 2));
});

test('cycle: H4 BO, H1 ChoCh against it, H1 BO back = one buy signal; a newer H4 BO before it cancels it', () => {
  const H1 = h1(), s = R.cycles(H1, h4(false));
  assert.equal(s.length, 1);
  assert.deepEqual([s[0].dir, s[0].ch, s[0].fin, s[0].sigT], [1, PAD + 7, PAD + 11, T0 + 12 * 3600]);
  assert.equal(R.cycles(H1, h4(true)).length, 0, 'the newer H4 BO (down) owns the cycle, and it has no finish');
  // closed candles only: cut the data before the BO-back candle closes and there is no signal
  assert.equal(R.cycles(H1.slice(0, PAD + 11), h4(false)).length, 0);
  assert.equal(R.cycles(H1.slice(0, PAD + 12), h4(false)).length, 1);
});

test('plan: entry next open, stop past the pullback low by 0.1 ATR, Exit A to the H4 extreme, Exit B 2R', () => {
  const H1 = h1(), [s] = R.cycles(H1, h4(false));
  const atr = R.atrAt(H1, s.fin);
  const B = R.plan(H1, s, 'B'), A = R.plan(H1, s, 'A');
  assert.equal(B.entry, 16.8);
  assert.ok(Math.abs(B.stop - (16.0 - 0.1 * atr)) < 1e-12);
  assert.ok(B.stop < B.entry, 'a buy stop is under the entry');
  assert.ok(Math.abs(B.target - (B.entry + 2 * B.r0)) < 1e-12);
  assert.equal(A.target, 18);
  assert.ok(Math.abs(A.rm - (18 - 16.8) / A.r0) < 1e-12);
  // a gap past the stop at the entry open: no trade
  const G = h1(); G[PAD + 12].open = 15.9;
  assert.equal(R.plan(G, s, 'B').skip, 'gap');
  // not enough room to the extreme for Exit A
  const N = h1(); N[PAD + 3].high = 17.4;
  assert.equal(R.plan(N, R.cycles(N, h4(false))[0], 'A').skip, 'room');
});

test('stop always on the losing side, on a long synthetic walk', () => {
  const rnd = R.rng(7), B = [];
  let p = 1.1, t = Date.parse('2019-01-07T00:00:00Z') / 1000;
  for (let i = 0; i < 20000; i++, t += 3600) {
    const o = p, c = o + (rnd() - 0.5) * 0.004, h = Math.max(o, c) + rnd() * 0.002, l = Math.min(o, c) - rnd() * 0.002;
    B.push(bar(t, o, h, l, c)); p = c;
  }
  for (const exit of ['A', 'B']) {
    const r = R.runMarket('eurusd', B, exit);
    assert.ok(r.trades.length > 20);
    for (const x of r.trades) {
      assert.ok(x.dir * (x.entry - x.stop) > 0, 'stop on the losing side');
      assert.ok(x.dir * (x.target - x.entry) > 0, 'target on the winning side');
      if (!x.open) { assert.ok(x.gross >= -1 - 1e-9 || x.why === 'gap'); assert.ok(!R.skipEntry(x.t)); }
    }
    for (let i = 1; i < r.trades.length; i++) assert.ok(r.trades[i].t >= r.trades[i - 1].exitT, 'one trade at a time');
  }
});

test('fills: stop first, gap at the open, target, time exit at the 48th close, unresolved at the data end', () => {
  const mk = (rows) => rows.map((r, i) => bar(T0 + i * 3600, ...r));
  const p = { k: 0, t: T0, dir: 1, entry: 100, stop: 99, target: 102, r0: 1 };
  assert.deepEqual(R.simulate(mk([[100, 102.5, 98.5, 101]]), p).why, 'stop', 'both in one candle = stop');
  assert.equal(R.simulate(mk([[100, 101, 99.5, 100.5], [102.4, 103, 102.2, 102.8]]), p).px, 102, 'open past the target exits at the target');
  const g = R.simulate(mk([[100, 101, 99.5, 100.5], [98.7, 99.2, 98.5, 99]]), p);
  assert.deepEqual([g.why, g.px], ['gap', 98.7]);
  const flat = Array.from({ length: 48 }, () => [100, 100.5, 99.5, 100.2]);
  const x = R.simulate(mk(flat), p);
  assert.deepEqual([x.why, x.n, x.px, x.t], ['time', 48, 100.2, T0 + 48 * 3600]);
  assert.equal(R.simulate(mk(flat.slice(0, 47)), p), null);
  const s = { ...p, dir: -1, stop: 101, target: 98 };
  assert.equal(R.simulate(mk([[100, 100.5, 97.5, 98]]), s).why, 'target');
});

test('rollover and weekend skip', () => {
  const at = (s) => Date.parse(s) / 1000;
  assert.equal(R.skipEntry(at('2025-03-04T21:00:00Z')), true);
  assert.equal(R.skipEntry(at('2025-03-04T22:00:00Z')), true);
  assert.equal(R.skipEntry(at('2025-03-04T20:00:00Z')), false);
  assert.equal(R.skipEntry(at('2025-03-04T23:00:00Z')), false);
  assert.equal(R.skipEntry(at('2025-03-08T12:00:00Z')), true, 'Saturday');
  assert.equal(R.skipEntry(at('2025-03-07T23:00:00Z')), true, 'Friday after 17:00 New York');
  assert.equal(R.skipEntry(at('2025-03-09T23:00:00Z')), false, 'Sunday after the reopen');
  // a signal whose entry candle starts at 21:00 UTC gives no trade
  const H1 = h1(), [s] = R.cycles(H1, h4(false)), shift = 9 * 3600;
  const S = H1.map((b) => ({ ...b, time: b.time + shift }));
  assert.equal(R.plan(S, { ...s, sigT: s.sigT + shift, h4start: s.h4start + shift }, 'B').skip, 'window');
});

test('costs: 0.3 pip spread, 45 per million round trip, 0.5 pip a market fill, 0.004 % a rollover night', () => {
  const p = { t: Date.parse('2025-03-04T10:00:00Z') / 1000, entry: 1.1, r0: 0.001 };
  const same = p.t + 3600, nextDay = Date.parse('2025-03-05T01:00:00Z') / 1000;
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  near(R.costR('eurusd', p, { why: 'target', t: same }), (0.3e-4 + 0.5e-4 + 4.5e-5 * 1.1) / 0.001);
  near(R.costR('eurusd', p, { why: 'stop', t: same }), (0.3e-4 + 1.0e-4 + 4.5e-5 * 1.1) / 0.001);
  near(R.costR('eurusd', p, { why: 'time', t: nextDay }) - R.costR('eurusd', p, { why: 'time', t: same }), 0.00004 * 1.1 / 0.001);
  near(R.costR('eurusd', p, { why: 'stop', t: same }, 2), 2 * R.costR('eurusd', p, { why: 'stop', t: same }));
  const j = { t: p.t, entry: 150, r0: 0.2 };
  near(R.costR('usdjpy', j, { why: 'target', t: same }), (0.3e-2 + 0.5e-2 + 4.5e-5 * 150) / 0.2);
});

test('statistics: monthly sums with empty months, Holm, percentile', () => {
  const tr = [{ exitT: Date.parse('2020-01-10T00:00:00Z') / 1000, net: 1 }, { exitT: Date.parse('2020-03-10T00:00:00Z') / 1000, net: -0.5 }];
  assert.deepEqual(R.monthly(tr, Date.parse('2020-01-01T00:00:00Z') / 1000, Date.parse('2020-04-30T00:00:00Z') / 1000), [1, 0, -0.5, 0]);
  assert.deepEqual(R.holm([0.01, 0.04]), [0.02, 0.04]);
  assert.equal(R.pct([1, 2, 3, 4, 5], 0.95), 4.8);
  assert.ok(Math.abs(R.pTwo(1.96) - 0.05) < 1e-3);
});

test('RESULT.md is the report of result.json, verdict first', () => {
  const rj = path.join(DIR, 'result.json'), md = path.join(DIR, 'RESULT.md');
  if (!fs.existsSync(rj)) return;
  const res = JSON.parse(fs.readFileSync(rj, 'utf8')), text = fs.readFileSync(md, 'utf8');
  assert.equal(text, R.report(res));
  assert.match(text.split('\n')[2], new RegExp(`^\\*\\*Verdict: ${res.verdict}\\.\\*\\*`));
  for (const e of ['A', 'B']) {
    const x = res.exits[e];
    assert.equal(x.pass, Object.values(x.lines).every(Boolean));
    assert.equal(x.lines.abovePlacebo, x.decisive.meanNet > x.placebo.p95);
    assert.equal(x.decisive.n, Object.values(x.byMarket).reduce((s, v) => s + v.decisive.n, 0));
  }
  assert.equal(res.verdict, res.exits.A.pass || res.exits.B.pass ? 'PASS' : 'FAIL');
  assert.deepEqual(Object.keys(res.data), ['eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdcad']);
});
