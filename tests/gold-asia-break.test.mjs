// The Asian range breakout study: the range window across UK summer time, no look-ahead, stop / target / time exits, stop
// first when one candle holds both, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { clockOf, rangeOf, firstBreak, plans, sim, holm, monthT, run } from '../research/edge/gold-asia-break/run.mjs';

const H = 3600, D = (y, m, d) => Date.UTC(y, m - 1, d) / 1000;
// flat M5 candles at price p from a to b (unix seconds)
const flat = (a, b, p = 100) => { const out = []; for (let t = a; t < b; t += 300) out.push({ time: t, open: p, high: p, low: p, close: p }); return out; };
const put = (bars, t, o) => { const i = bars.findIndex((x) => x.time === t); bars[i] = { time: t, ...o }; };

test('the range is the 7 hours before 07:00 London: 00:00-06:59 UTC in winter, 23:00-05:59 UTC in British summer time', () => {
  const w = clockOf(D(2024, 1, 10)), s = clockOf(D(2024, 7, 10));
  assert.equal(w.rangeFrom, D(2024, 1, 10)); assert.equal(w.open, D(2024, 1, 10) + 7 * H); assert.equal(w.winEnd, D(2024, 1, 10) + 11 * H);
  assert.equal(s.rangeFrom, D(2024, 7, 10) - H); assert.equal(s.open, D(2024, 7, 10) + 6 * H); assert.equal(s.winEnd, D(2024, 7, 10) + 10 * H);
  // noon New York: 17:00 UTC in winter, 16:00 UTC in US daylight time
  assert.equal(w.exitT, D(2024, 1, 10) + 17 * H); assert.equal(s.exitT, D(2024, 7, 10) + 16 * H);
  // the weeks the US and the UK disagree: 2024-03-12 is US daylight, UK winter
  const m = clockOf(D(2024, 3, 12)); assert.equal(m.summer, false); assert.equal(m.open, D(2024, 3, 12) + 7 * H); assert.equal(m.exitT, D(2024, 3, 12) + 16 * H);
  // the Monday after the UK change (31 Mar 2024) is summer; the Monday after 27 Oct 2024 is winter
  assert.equal(clockOf(D(2024, 4, 1)).summer, true); assert.equal(clockOf(D(2024, 10, 28)).summer, false);
});

test('the range reads only its own candles (a spike before or after it is ignored)', () => {
  const c = clockOf(D(2024, 7, 10)), bars = flat(c.rangeFrom - 2 * H, c.exitT + H);
  put(bars, c.rangeFrom, { open: 100, high: 104, low: 99, close: 100 });
  put(bars, c.rangeFrom - 300, { open: 100, high: 200, low: 1, close: 100 });
  put(bars, c.open, { open: 100, high: 300, low: 1, close: 100 });
  const R = rangeOf(bars, c); assert.equal(R.hi, 104); assert.equal(R.lo, 99); assert.equal(R.n, 84);
});

test('no look-ahead: the break and the plans do not change when later prices change', () => {
  const c = clockOf(D(2024, 1, 10)), bars = flat(c.rangeFrom, c.exitT + H);
  put(bars, c.rangeFrom, { open: 100, high: 102, low: 98, close: 100 });
  put(bars, c.open + 3600 + 600, { open: 100, high: 103.5, low: 100, close: 103 });   // M15 07:00+1h closes above 102
  const R = rangeOf(bars, c), a = plans(bars, c, R), late = bars.map((b) => b.time >= c.open + 2 * H ? { ...b, open: 50, high: 50, low: 50, close: 50 } : b);
  const b = plans(late, c, rangeOf(late, c));
  assert.equal(a.B.side, 1); assert.equal(a.B.t, c.open + H + 900); assert.deepEqual(a.B, b.B);
  assert.equal(firstBreak(bars, c, R).q, c.open + H);
  // B: entry 100 (the next open), opposite side 98 is 2 away, 1 x range = 4: stop 98; target 100 + 6
  const x = sim(bars, { ...a.B, exitT: c.exitT }); assert.equal(x.entry, 100); assert.equal(x.stop, 98); assert.equal(x.target, 106);
});

test('a break that closes back inside within two M15 candles is faded to the other side, stop past the extreme', () => {
  const c = clockOf(D(2024, 1, 10)), bars = flat(c.rangeFrom, c.exitT + H, 100);
  put(bars, c.rangeFrom, { open: 100, high: 102, low: 98, close: 100 });
  put(bars, c.open + 600, { open: 100, high: 103, low: 100, close: 102.5 });          // break up
  put(bars, c.open + 1500, { open: 102.5, high: 104, low: 102, close: 103 });         // still out, new extreme 104
  put(bars, c.open + 1800 + 600, { open: 103, high: 103, low: 101, close: 101 });     // closes back inside
  const p = plans(bars, c, rangeOf(bars, c));
  assert.equal(p.F.side, -1); assert.equal(p.F.t, c.open + 2700); assert.equal(+p.F.stop.toFixed(2), 104.3); assert.equal(p.F.target, 98);
});

test('exits: stop, target, time, a gapped stop at the open, and stop first when one candle holds both', () => {
  const t0 = D(2024, 1, 10) + 8 * H, ex = t0 + 4 * H, base = () => flat(t0, ex + H, 100);
  let b = base(); put(b, t0 + 600, { open: 100, high: 100, low: 97, close: 98 });
  assert.equal(sim(b, { side: 1, t: t0, stop: 98, target: 103, exitT: ex }).why, 'stop');
  b = base(); put(b, t0 + 600, { open: 100, high: 104, low: 100, close: 103 });
  const tg = sim(b, { side: 1, t: t0, stop: 98, target: 103, exitT: ex }); assert.equal(tg.why, 'target'); assert.equal(tg.gross, 1.5);
  assert.equal(+tg.net.toFixed(4), +(1.5 - 0.3 / 2).toFixed(4)); assert.equal(tg.finR, 0);
  b = base(); put(b, t0 + 600, { open: 100, high: 104, low: 97, close: 100 });
  const both = sim(b, { side: 1, t: t0, stop: 98, target: 103, exitT: ex }); assert.equal(both.why, 'stop'); assert.equal(both.gross, -1);
  b = base(); put(b, t0 + 600, { open: 96, high: 96, low: 95, close: 95 });
  assert.equal(sim(b, { side: 1, t: t0, stop: 98, target: 103, exitT: ex }).gross, -2);
  b = base(); b = b.map((x) => x.time >= t0 + 900 ? { ...x, open: 101, high: 101, low: 101, close: 101 } : x);
  const tm = sim(b, { side: 1, t: t0, stop: 98, target: 103, exitT: ex }); assert.equal(tm.why, 'time'); assert.equal(tm.closed, ex); assert.equal(tm.exit, 101);
  // a sell mirrors it; an entry already past the stop is no trade
  b = base(); put(b, t0 + 600, { open: 100, high: 101, low: 97, close: 97 });
  assert.equal(sim(b, { side: -1, t: t0, stop: 102, target: 97, exitT: ex }).why, 'target');
  assert.equal(sim(base(), { side: 1, t: t0, stop: 100, target: 103, exitT: ex }), null);
});

test('statistics: Holm, and month sums count empty months as zero', () => {
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]); assert.deepEqual(holm([0.3, 0.01]), [0.3, 0.02]);
  const m = monthT([{ entryT: D(2024, 1, 5), net: 1 }, { entryT: D(2024, 3, 5), net: 1 }], D(2024, 1, 1), D(2024, 4, 1));
  assert.equal(m.months, 3);
});

test('the skip filter needs 20 earlier days and removes a range over 2x their median', () => {
  const days = [], bars = [];
  for (let d = D(2024, 1, 1); d < D(2024, 3, 1); d += 86400) { const w = new Date(d * 1000).getUTCDay(); if (w === 0 || w === 6) continue; days.push(d); }
  for (const d of days) { const c = clockOf(d), f = flat(c.rangeFrom, c.exitT + 300, 100), wide = d === days[25]; f[0] = { ...f[0], high: wide ? 110 : 101, low: 99 }; bars.push(...f); }
  bars.sort((a, b) => a.time - b.time);
  const r = run(bars); assert.equal(r.skipped.warm, 20); assert.equal(r.skipped.wide, 1); assert.ok(!r.days.some((x) => x.day === days[25]));
});

test('the report says what result.json holds, and the verdict', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-asia-break/result.json', import.meta.url))), md = fs.readFileSync(new URL('../research/edge/gold-asia-break/RESULT.md', import.meta.url), 'utf8');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${r.verdict}\\*\\*`)); assert.equal(md.split('\n')[2].startsWith('**Verdict'), true);
  for (const k of ['B', 'F']) {
    const d = r.rules[k].decisive; assert.ok(md.includes(`| ${d.n} |`)); assert.ok(md.includes(`t ${d.tMonth.toFixed(2)}, Holm p ${r.rules[k].pHolm}`));
    assert.equal(r.rules[k].pass, Object.values(r.rules[k].checks).every(Boolean));
    assert.ok(md.includes(`(${r.rules[k].placebo.beat}; placebo`));
  }
  assert.equal(r.verdict, r.rules.B.pass || r.rules.F.pass ? 'PASS' : 'FAIL');
  assert.equal(r.verdict, 'FAIL');
});
