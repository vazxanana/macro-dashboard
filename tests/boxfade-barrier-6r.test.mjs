// research/edge/boxfade-barrier-6r: a Box fade signal as the entry at a Mosha barrier with a 6R target (offline: the
// committed files and the pure helpers; no candles are read).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { plan, brokenAt, returnsOf, inPlay, atBarrier, oneAtATime, judge, markdown, stats, welch, WATCH, COST, RR, HOLD, NEAR, MIN_N, TFS } from '../research/edge/boxfade-barrier-6r/run.mjs';

const DIR = new URL('../research/edge/boxfade-barrier-6r/', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, DIR), 'utf8');
const res = JSON.parse(read('result.json'));

test('boxfade-barrier-6r: the pre-registration fixes the rule, the bar and the amendment', () => {
  const p = read('PREREGISTRATION.md');
  assert.ok(p.startsWith('# Pre-registration: boxfade-barrier-6r (26 Nov 2026)'));
  for (const w of ['6R', '0.25 x ATR(14)', 'One\nposition at a time', 'C1', 'C2', 'C3', 'PASS', 'TOO FEW', 'FAIL', 'Welch t', 'twice the cost', '2018-01-01', '2026-10-31', 'Amendment', 'in play', '07:00-17:00 UTC']) assert.ok(p.includes(w), w);
  assert.equal(COST, 0.30); assert.equal(RR, 6); assert.equal(HOLD, 5 * 86400); assert.equal(NEAR, 0.25); assert.equal(MIN_N, 100);
  assert.deepEqual(TFS, ['1d', '4h', '1h', '30m', '15m']);
  assert.deepEqual(WATCH, { '1d': 216000, '4h': 54000, '1h': 18000, '30m': 18000, '15m': 3600 });
});

test('boxfade-barrier-6r: RESULT.md is result.json, and the verdict is the pre-registered bar', () => {
  assert.equal(read('RESULT.md'), markdown(res));
  const J = judge(res.streams.primary, res.welchVsC1.oos);
  assert.equal(res.verdict, J.verdict);
  assert.deepEqual(res.checks, J.checks);
  assert.equal(res.verdict, 'FAIL');                         // never quoted as an edge
  const P = res.streams.primary.oos;
  assert.ok(P.n >= 100 && !(P.net > 0) && !(P.t >= 2));
  assert.equal(res.counts.stopWrongSide, 0);
  assert.ok(res.cutTest.length >= 1 && res.cutTest.every((c) => c.same && c.full > 100));
  assert.ok(read('RESULT.md').includes(`n ${P.n}`));
  assert.ok(!/\bis an edge\b/i.test(read('RESULT.md')));
});

test('boxfade-barrier-6r: the bar', () => {
  const ok = { is: { net: 0.05 }, oos: { n: 150, net: 0.1, net2: 0.02, t: 2.4 } };
  assert.equal(judge(ok, 2.1).verdict, 'PASS');
  assert.equal(judge(ok, 1.9).verdict, 'FAIL');
  assert.equal(judge({ ...ok, is: { net: -0.01 } }, 3).verdict, 'FAIL');
  assert.equal(judge({ ...ok, oos: { ...ok.oos, net2: -0.01 } }, 3).verdict, 'FAIL');
  assert.equal(judge({ ...ok, oos: { ...ok.oos, t: 1.99 } }, 3).verdict, 'FAIL');
  assert.equal(judge({ ...ok, oos: { ...ok.oos, n: 99 } }, 3).verdict, 'TOO FEW');
});

test('boxfade-barrier-6r: a stop is always on the losing side of its fill, and thin risk is skipped', () => {
  let seed = 7, made = 0; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 5000; i++) {
    const lo = 2000 + rnd() * 50, hi = lo + 0.2 + rnd() * 12, d = rnd() < 0.5 ? 1 : -1;
    const c0 = d > 0 ? hi + rnd() * 3 : lo - rnd() * 3, open = c0 + (rnd() - 0.5) * 4;
    const p = plan({ d, c0, box: { hi, lo } }, open); if (!p) continue; made++;
    assert.equal(p.s, -d);                                    // the fade
    assert.ok(p.s * (p.fill - p.stop) > 0);                   // losing side
    assert.ok(p.risk >= 2 * COST - 1e-12);
    assert.ok(Math.abs(p.risk - Math.abs(p.fill - p.stop)) < 1e-9);
  }
  assert.ok(made > 1000);
  // a buy close-out above a box 2000-2004 at 2005: the box stop is 1999.85, mirrored to 2010.15; the fade sells
  const p = plan({ d: 1, c0: 2005, box: { hi: 2004, lo: 2000 } }, 2005.2);
  assert.equal(p.s, -1); assert.ok(Math.abs(p.stop - 2010.15) < 1e-9);
  assert.equal(plan({ d: 1, c0: 2005, box: { hi: 2004, lo: 2000 } }, 2009.7), null);   // filled risk 0.45: under two costs
});

// a small synthetic market: hourly candles and their 5-minute candles
function market() {
  const D5 = []; let seed = 3, px = 2000; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 12 * 24 * 12; i++) { const o = px, c = o + (rnd() - 0.5) * 3; D5.push({ time: 1e9 + i * 300, open: o, high: Math.max(o, c) + rnd(), low: Math.min(o, c) - rnd(), close: c }); px = c; }
  const H = []; for (const b of D5) { const t = b.time - (b.time % 3600), q = H[H.length - 1];
    if (q && q.time === t) { q.high = Math.max(q.high, b.high); q.low = Math.min(q.low, b.low); q.close = b.close; } else H.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close }); }
  return { D5, H };
}

test('boxfade-barrier-6r: no look-ahead in the tagging (a cut gives the same returns, break and tag)', () => {
  const { D5, H } = market(), life = 90 * 86400; let tagged = 0, checked = 0;
  for (let n = 0; n < 60; n++) {
    const k = 5 + n * 3, mid = (H[k].high + H[k].low) / 2, dir = n % 2 ? 1 : -1;
    const z = { tf: '1h', dir, lo: mid - 2, hi: mid + 2, kind: 'eg', known: H[k].time + 3600 };
    const full = { ...z, broken: brokenAt(z, H, 3600) }; full.returns = returnsOf(full, H, 3600, D5, life);
    for (const T of [z.known + 3 * 3600 + 900, z.known + 11 * 3600 + 1500, z.known + 40 * 3600]) {
      const Hc = H.filter((b) => b.time + 3600 <= T), Dc = D5.filter((b) => b.time + 300 <= T);
      const cut = { ...z, broken: brokenAt(z, Hc, 3600) }; cut.returns = returnsOf(cut, Hc, 3600, Dc, life);
      assert.deepEqual(cut.returns, full.returns.filter((r) => r <= T));
      assert.equal(cut.broken, full.broken != null && full.broken <= T ? full.broken : null);
      const last = Dc[Dc.length - 1]; if (!last) continue;
      for (const side of [1, -1]) { const a = atBarrier([full], T, last.close, side, 2).length, b = atBarrier([cut], T, last.close, side, 2).length; assert.equal(a, b); tagged += a; checked++; }
      assert.equal(inPlay(full, T), inPlay(cut, T));
    }
  }
  assert.ok(checked > 200 && tagged > 0);
});

test('boxfade-barrier-6r: standing, in play, side and distance', () => {
  const z = { tf: '1h', dir: 1, lo: 100, hi: 104, kind: 'bo', known: 1000, broken: 50000, returns: [5000, 30000] };
  assert.equal(atBarrier([z], 4999, 103, 1, 2).length, 0);             // price has not come back yet
  assert.equal(atBarrier([z], 5000, 103, 1, 2).length, 1);             // inside, just returned
  assert.equal(atBarrier([z], 5000, 104.5, 1, 2).length, 1);           // within 0.25 ATR of the near edge
  assert.equal(atBarrier([z], 5000, 104.51, 1, 2).length, 0);
  assert.equal(atBarrier([z], 5000, 99.9, 1, 2).length, 0);            // past the far side
  assert.equal(atBarrier([z], 5000, 103, -1, 2).length, 0);            // the other side
  assert.equal(atBarrier([z], 5000 + WATCH['1h'], 103, 1, 2).length, 0);   // the watch is over
  assert.equal(atBarrier([z], 30010, 103, 1, 2).length, 1);            // a later visit
  assert.equal(atBarrier([z], 50000, 103, 1, 2).length, 0);            // broken at that close
  const s = { ...z, dir: -1 };
  assert.equal(atBarrier([s], 5000, 99.5, -1, 2).length, 1);
  assert.equal(atBarrier([s], 5000, 99.4, -1, 2).length, 0);
  // the label is the highest timeframe's
  const d = { ...z, tf: '1d' }; assert.equal(atBarrier([z, d], 5000, 103, 1, 2)[0].tf, '1d');
  // a zone is broken by the first close through its far side from `known` on
  const H = [{ time: 0, close: 90 }, { time: 3600, close: 101 }, { time: 7200, close: 99.9 }, { time: 10800, close: 80 }];
  assert.equal(brokenAt({ dir: 1, lo: 100, hi: 104, known: 3600 }, H, 3600), 10800);
  assert.equal(brokenAt({ dir: -1, lo: 100, hi: 104, known: 3600 }, H, 3600), null);
});

test('boxfade-barrier-6r: one position at a time, costs and the Welch t', () => {
  const rows = [{ t: 100, R6: 6, end6: 1000, risk: 3 }, { t: 600, R6: -1, end6: 700, risk: 3 }, { t: 1299, R6: -1, end6: 1400, risk: 3 }, { t: 1300, R6: -1, end6: 2000, risk: 1 }, { t: 2300, R6: null, end6: null, risk: 2 }, { t: 9000, R6: 6, end6: 9100, risk: 2 }];
  const o = oneAtATime(rows, 'R6', 'end6');
  assert.deepEqual(o.trades.map((x) => x.t), [100, 1300]);   // 600 and 1299 fall inside the first trade; the exit candle ends at 1300
  assert.equal(o.skipped, 3); assert.equal(o.open, 1);       // the open trade blocks what follows and is left out
  const st = stats(o.trades);
  assert.equal(st.n, 2); assert.equal(st.gross, 2.5); assert.equal(st.net, +(((6 - 0.1) + (-1 - 0.3)) / 2).toFixed(4)); assert.equal(st.net2, +(((6 - 0.2) + (-1 - 0.6)) / 2).toFixed(4));
  assert.equal(welch([1, 2, 3, 4], [1, 2, 3, 4]), 0);
  assert.ok(welch([2, 3, 4, 5, 6], [0, 1, 2, 1, 0]) > 2);
});
