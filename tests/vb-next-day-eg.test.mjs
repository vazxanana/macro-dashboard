// tests/vb-next-day-eg.test.mjs - the next-day engulf-zone continuation after a winning volatility breakout: the
// pre-registration, RESULT.md against result.json, the verdict against the bar, and on seeded candles: stops on the losing
// side, entries only on the day after a filled breakout from a zone known after its fill, no look-ahead (cut test), and the
// trade engine on hand-made candles. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { findTrades, sim, atrH1, passOf, headlineOf, CELLS, MARKETS, COSTS, monthOf, DM, NM } from '../research/edge/vb-next-day-eg/run.mjs';
import * as K from '../research/edge/_lib/edgekit.mjs';

const DIR = new URL('../research/edge/vb-next-day-eg/', import.meta.url);
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const has = (f) => fs.existsSync(new URL(f, DIR));

// seeded 5-minute candles, Monday to Friday, with trending days so breakouts fill and win
function seeded(seed, nDays = 90) {
  let s = seed >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out = []; let px = 100, t = Date.UTC(2021, 0, 4) / 1000;
  for (let d = 0; d < nDays; d++, t += 86400) { const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const drift = (rnd() - 0.5) * 0.012;
    for (let i = 0; i < 288; i++) { const o = px, c = o + drift + (rnd() - 0.5) * 0.08, h = Math.max(o, c) + rnd() * 0.03, l = Math.min(o, c) - rnd() * 0.03;
      out.push({ t: t + i * 300, o, h, l, c }); px = c; } }
  return out;
}

test('pre-registration fixes the cells, windows, bar and costs', () => {
  for (const w of ['2005-01-01 .. 2014-12-31', '2015-01-01 .. 2026-10-31', 'Holm', 'n >= 300', '0.30', '0.008', '0.00006', '0.00008', 'Cells (10)', 'control', 'cut test'])
    assert.ok(pre.includes(w), w);
  assert.equal(CELLS.length, 10); assert.deepEqual(MARKETS, ['xau', 'usdjpy', 'eurusd', 'gbpusd']);
  assert.deepEqual(COSTS, { xau: K.COSTS.xau, usdjpy: K.COSTS.usdjpy, eurusd: K.COSTS.eurusd, gbpusd: K.COSTS.gbpusd });
  assert.equal(monthOf(Date.UTC(2015, 0, 1) / 1000), DM); assert.equal(monthOf(Date.UTC(2026, 9, 31) / 1000), NM - 1);
});

test('seeded candles: every trade has its stop on the losing side, the day after a filled breakout, from a zone known after the fill', () => {
  let n = 0, wins = 0;
  for (const seed of [3, 11, 29]) { const M5 = seeded(seed), { trades, funnel } = findTrades(M5, 0.001);
    assert.ok(funnel.breakoutDays > 20);
    const days = new Set();
    for (const x of trades) { n++; if (x.set === 0) wins++;
      assert.ok(x.s * (x.fill - x.stop) > 0, 'stop side'); assert.ok(x.risk >= 0.001);
      assert.ok(x.t >= x.dN && x.t - x.dN < 21 * 3600, 'fill inside 00:00-21:00 of day N');
      assert.ok(x.vbFill < x.dN && x.dN - Math.floor(x.vbFill / 86400) * 86400 <= 4 * 86400, 'the breakout was an earlier day, at most 4 days before');
      assert.ok(x.zAt > x.vbFill + 300 && x.zAt <= x.t, 'zone known after the breakout fill and by the entry candle');
      assert.ok(!days.has(x.dN), 'one trade a day'); days.add(x.dN);
      for (const r of x.R) assert.ok(Number.isFinite(r) && r <= 2 + 1e-9);
      assert.ok(x.R[0] <= 1 + 1e-9);
      // the fill candle really trades at the fill price
      const b = M5.find((c) => c.t === x.t); assert.ok(b.l <= x.fill + 1e-12 && b.h >= x.fill - 1e-12);
    } }
  assert.ok(n > 30 && wins > 10, `enough seeded trades (${n}, ${wins})`);
});

test('seeded candles: no look-ahead (trades known at a cut equal the full run\'s)', () => {
  const M5 = seeded(7), full = findTrades(M5, 0.001).trades, key = (x) => [x.t, x.set, x.s, x.fill, x.stop, x.R.join('/')].join('|');
  for (const frac of [0.35, 0.6, 0.83]) { const T = M5[Math.floor(M5.length * frac)].t;
    const a = findTrades(M5.filter((b) => b.t + 300 <= T), 0.001).trades.filter((x) => x.dN + 21 * 3600 <= T).map(key);
    const b = full.filter((x) => x.dN + 21 * 3600 <= T).map(key);
    assert.ok(b.length > 3); assert.deepEqual(a, b); }
  // changing every price after a trade's day leaves the trade unchanged
  const x = full[Math.floor(full.length / 2)], T = x.dN + 21 * 3600;
  const bent = M5.map((b) => (b.t >= T ? { t: b.t, o: b.o * 3, h: b.h * 3, l: b.l * 3, c: b.c * 3 } : b));
  assert.ok(findTrades(bent, 0.001).trades.map(key).includes(key(x)));
});

test('the trade engine: stop first, the fill candle only stops, gap opens, the time exit', () => {
  const bar = (i, o, h, l, c) => ({ t: i * 300, o, h, l, c }), END = 1e9;
  // buy at 100, stop 99: the fill candle reaches 101 (ignored), next candle holds stop and target -> stop
  let r = sim([bar(0, 100.5, 101.2, 100, 100.4), bar(1, 100.4, 101.5, 98.9, 100)], 0, 1, 100, 99, END); assert.deepEqual(r.R, [-1, -1]);
  // the fill candle reaches the stop
  r = sim([bar(0, 100.5, 100.6, 98.5, 99)], 0, 1, 100, 99, END); assert.deepEqual(r.R, [-1, -1]);
  // 1R then the stop: [1, -1]
  r = sim([bar(0, 100.5, 100.6, 100, 100.2), bar(1, 100.2, 101.3, 100.1, 101.2), bar(2, 101.2, 101.3, 98, 98.5)], 0, 1, 100, 99, END); assert.deepEqual(r.R, [1, -1]);
  // a gap through the stop exits at the open
  r = sim([bar(0, 100.5, 100.6, 100, 100.2), bar(1, 98.5, 98.7, 98.2, 98.4)], 0, 1, 100, 99, END); assert.deepEqual(r.R, [-1.5, -1.5]);
  // time exit at the close of the last candle before the end
  r = sim([bar(0, 100.5, 100.6, 100, 100.2), bar(1, 100.2, 100.5, 100.1, 100.4), bar(2, 100.4, 110, 100, 109)], 0, 1, 100, 99, 600);
  assert.ok(Math.abs(r.R[0] - 0.4) < 1e-9 && Math.abs(r.R[1] - 0.4) < 1e-9);
  // a sell mirrors; a stop on the wrong side is no trade
  r = sim([bar(0, 99.5, 100, 99.4, 99.8), bar(1, 99.8, 99.9, 97.9, 98)], 0, -1, 100, 101, END); assert.deepEqual(r.R, [1, 2]);
  assert.equal(sim([bar(0, 100, 100, 100, 100)], 0, 1, 100, 101, END), null);
  const H = Array.from({ length: 20 }, (_, i) => ({ t: i * 3600, o: 10, h: 11, l: 9, c: 10 })); const a = atrH1(H);
  assert.ok(Number.isNaN(a[13])); assert.equal(a[14], 2); assert.equal(a[19], 2);
});

test('RESULT.md line 3 is the verdict line and equals result.json; the verdict follows the bar', { skip: !has('result.json') }, () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  const line = md.split('\n')[2];
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
  assert.equal(line, `**Verdict: ${R.verdict}. ${R.headline}.**`);
  assert.equal(R.headline, headlineOf({ cells: R.cells, best: R.best }));
  assert.deepEqual(R.cells.map((c) => c.cell), CELLS.map((c) => c.name));
  for (const c of R.cells) assert.equal(c.pass, passOf(c), c.cell);
  const want = R.cells.some((c) => c.pass) ? 'PASS' : R.cells.some((c) => c.disc.n >= 300 && c.conf.n >= 300) ? 'FAIL' : 'INCONCLUSIVE';
  assert.equal(R.verdict, want);
  const f3 = (v) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(3);
  for (const c of R.cells) assert.ok(md.includes(`| ${c.cell} | ${c.disc.n} | ${f3(c.disc.R)} | ${f3(c.disc.net)} |`), c.cell);
  for (const c of R.cuts) { assert.equal(c.missing, 0); assert.equal(c.extra, 0); }
  assert.ok(!/\bedge\b(?! lab)/i.test(line));
});
