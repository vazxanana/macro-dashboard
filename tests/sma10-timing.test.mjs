// 10-month average timing study (research/edge/sma10-timing): the month-end signal reads no later candle, a switch pays its
// spread, the catastrophe stop fires and is never loosened, a stopped market stays flat until the month end, financing is the
// nights() rule, the book and the bootstrap, and RESULT.md against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { monthEnds, signalAt, simulate, book, stats, bootstrap, passOf, nightRate, asOfRate, MARKUP, N_SMA } from '../research/edge/sma10-timing/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const RES = rd('../research/edge/sma10-timing/RESULT.md'), PRE = rd('../research/edge/sma10-timing/PREREGISTRATION.md');
const R = JSON.parse(rd('../research/edge/sma10-timing/result.json'));
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;

// weekday candles from a start date, one close per day from fn(i); open = previous close, high / low 0.5 around
function mk(start, n, fn) {
  const out = []; let t = T(start), prev = fn(0);
  for (let i = 0; out.length < n; t += 86400) {
    const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const c = fn(i++); out.push({ time: t, open: prev, high: Math.max(prev, c) + 0.5, low: Math.min(prev, c) - 0.5, close: c }); prev = c;
  }
  return out;
}

test('the month-end signal reads no candle after its month end', () => {
  const bars = mk('2020-01-01', 400, (i) => 100 + i * 0.1);
  const ends = monthEnds(bars), j = 12, s = signalAt(bars, ends, j);
  assert.ok(s.long);
  const changed = bars.map((b, k) => (k > ends[j] ? { ...b, open: 1, high: 2, low: 0.5, close: 1 } : b));
  assert.deepEqual(signalAt(changed, monthEnds(changed), j), s);
  assert.equal(signalAt(bars, ends, N_SMA - 2), null);   // fewer than 10 month ends: no signal
  // the month still forming has no month end
  assert.ok(ends.at(-1) < bars.length - 1);
});

test('a switch in pays one spread at the next open; a switch out pays one at the open', () => {
  const up = mk('2020-01-01', 340, (i) => 100 + i * 0.1), ends = monthEnds(up), k = ends[12] + 1;
  const s = simulate(up, { spread: 1, rate: () => 0, from: up[k].time, to: up[k + 3].time + 1 });
  near(s.rule[0].r, up[k].close / (up[k].open + 1) - 1);            // bought at the open plus the spread
  near(s.bh[0].r, up[k].close / (up[k].open + 1) - 1);
  near(s.rule[1].r, up[k + 1].close / up[k].close - 1);             // held: no cost
  // the month-end close falls under its 10-month average (wide candles keep the stop far): out at the next open, one spread
  const m = ends[13], dn = up.map((b, i) => (i > ends[11] && i <= m ? { ...b, high: b.high + 50, low: b.low - 50 } : b));
  dn[m] = { ...dn[m], close: 50, low: 49 }; dn[m + 1] = { ...dn[m + 1], open: 52, low: 51 };
  const sig = signalAt(dn, monthEnds(dn), 13); assert.equal(sig.long, false);
  const o = simulate(dn.map((b, i) => (i === m ? { ...b, low: 49 } : b)), { spread: 1, rate: () => 0, from: up[k].time, to: up[m + 2].time + 1 });
  const out = o.trades.at(-1);
  assert.equal(out.why, 'signal'); near(out.exit, 51); near(o.rule[m + 1 - k].r, 51 / 50 - 1);
});

test('the stop fires on the low, at the open on a gap, and the market stays flat to the month end', () => {
  const bars = mk('2020-01-01', 340, (i) => 100 + i * 0.1);
  const ends = monthEnds(bars), j = 12, k = ends[j] + 1, sig = signalAt(bars, ends, j);
  // two days after the month's first candle, a candle that trades through the stop
  const crash = bars.map((b, i) => (i === k + 2 ? { ...b, low: sig.stop - 5, close: b.close } : b));
  const s = simulate(crash, { spread: 0, rate: () => 0, from: bars[k].time, to: bars[ends[j + 1]].time + 1 });
  assert.equal(s.trades[0].why, 'stop'); near(s.trades[0].exit, sig.stop);
  near(s.rule[2].r, sig.stop / crash[k + 1].close - 1);
  for (let d = 3; d < s.rule.length; d++) assert.equal(s.rule[d].r, 0);      // flat to the month end, not re-entered
  // a gap below the stop exits at the open
  const gap = bars.map((b, i) => (i === k + 2 ? { ...b, open: sig.stop - 3, low: sig.stop - 4 } : b));
  const g = simulate(gap, { spread: 0, rate: () => 0, from: bars[k].time, to: bars[ends[j + 1]].time + 1 });
  near(g.trades[0].exit, sig.stop - 3);
});

test('a kept position\'s stop is never loosened at a month end', () => {
  // rises, then wild candles (a large ATR) in one month: the stop that month end makes is lower, the old one stays in force
  const base = mk('2020-01-01', 340, (i) => 100 + i * 0.2).map((b, i) => (i > 300 ? { ...b, high: b.high + 40, low: b.close - 0.6 } : b));
  const ends = monthEnds(base), j = ends.findIndex((e) => e > 300), prev = signalAt(base, ends, j - 1), now = signalAt(base, ends, j);
  assert.ok(now.stop < prev.stop && prev.long && now.long);
  const k = ends[j] + 2, bars = base.map((b, i) => (i === k ? { ...b, open: prev.stop + 1, low: (prev.stop + now.stop) / 2 } : b));
  const s = simulate(bars, { spread: 0, rate: () => 0, from: bars[ends[j - 1] + 1].time, to: bars[k].time + 1 });
  assert.equal(s.trades.length, 1); assert.equal(s.trades[0].why, 'stop'); near(s.trades[0].exit, prev.stop);
});

test('financing is nights() at the market\'s rate; the index rate is DGS2 + 2.5 % floored', () => {
  near(nightRate('xau', null)(T('2020-01-01')), FIN.xau.long);
  const dgs2 = asOfRate([['2020-01-03', 1.5], ['2020-01-10', -0.2]]);
  near(nightRate('spx500', dgs2)(T('2020-01-08')), (0.015 + MARKUP) / 365);
  near(nightRate('spx500', dgs2)(T('2020-01-12')), MARKUP / 365);
  assert.equal(dgs2(T('2020-01-02')), null);
  const bars = mk('2020-01-01', 340, (i) => 100 + i * 0.1), ends = monthEnds(bars), k = ends[12] + 1;
  const s = simulate(bars, { spread: 0, rate: () => 0.001, from: bars[k].time, to: bars[k + 6].time + 1 });
  for (let d = 1; d < 6; d++) near(s.rule[d].r, bars[k + d].close / bars[k + d - 1].close - 1 - nights(bars[k + d].time, bars[k + d + 1].time) * 0.001);
  assert.equal(nights(T('2020-01-08'), T('2020-01-09')), 3);   // a Wednesday counts three
});

test('book, statistics and the bootstrap', () => {
  const b = book([[{ t: 1, r: 0.02 }, { t: 2, r: 0 }], [{ t: 1, r: 0 }]]);
  assert.deepEqual(b, [{ t: 1, r: 0.01 }, { t: 2, r: 0 }]);
  const day = (k) => T('2020-01-01') + k * 86400;
  const up = Array.from({ length: 365 }, (_, k) => ({ t: day(k), r: 0.001 })), flat = up.map((x) => ({ ...x, r: x.t % 2 ? -0.001 : 0.001 }));
  const st = stats(up); assert.equal(st.maxDD, 0); assert.ok(st.cagr > 0);
  const bt = bootstrap(up, flat, 200, 1);
  assert.equal(bt.months, 12); assert.ok(bt.pBetter >= 0 && bt.pBetter <= 1);
  assert.deepEqual(bootstrap(up, flat, 200, 1), bt);   // seeded
});

test('result.json: the verdict follows the pre-registered checks', () => {
  const p = passOf(R.windows);
  assert.deepEqual(p.checks, R.pass.checks);
  assert.equal(R.verdict, p.pass ? 'PASS' : 'FAIL');
  const w2 = R.windows.W2.book;
  assert.equal(R.pass.checks.w2Sharpe, w2.rule.sharpe >= w2.bh.sharpe);
  assert.equal(R.pass.checks.w2Drawdown, w2.rule.maxDD <= (2 / 3) * w2.bh.maxDD);
  assert.equal(R.pass.checks.w2Bootstrap, w2.boot.pBetter >= 0.9);
  assert.equal(w2.boot.draws, 2000); assert.equal(w2.boot.seed, 20261113);
  assert.match(PRE, /owner decision 44/); assert.match(PRE, /Faber/);
});

test('RESULT.md states result.json\'s figures, verdict first', () => {
  assert.match(RES.split('\n')[0], new RegExp(`^\\*\\*Verdict:\\*\\* ${R.verdict}[.:]`));
  const mg = (t) => t.replace(/^-/, '\u2212'), pc = (x) => mg((x * 100).toFixed(2)) + ' %', f2 = (x) => mg(x.toFixed(2));
  for (const w of ['W1', 'W2']) {
    const b = R.windows[w].book;
    for (const s of [b.rule, b.bh]) for (const v of [pc(s.cagr), pc(s.maxDD), f2(s.sharpe)]) assert.ok(RES.includes(v), `${w} ${v}`);
    assert.ok(RES.includes(String(b.boot.pBetter)), `${w} boot`);
    for (const m of Object.values(R.windows[w].markets)) for (const v of [pc(m.rule.cagr), pc(m.rule.maxDD), pc(m.bh.maxDD), f2(m.bh.sharpe)]) assert.ok(RES.includes(v), `${w} ${m.name} ${v}`);
  }
  assert.ok(!fs.existsSync(new URL('../research/proposals/2026-11-13-sma10.md', import.meta.url)) || R.verdict === 'PASS');
});
