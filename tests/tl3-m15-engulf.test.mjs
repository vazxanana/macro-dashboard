// tests/tl3-m15-engulf.test.mjs - the H1 trendline third touch with an M15 engulf: the pre-registration, RESULT.md agrees with
// result.json, the verdict follows the bar, and on seeded candles the signal has no look-ahead, its stop is on the losing side
// and the trade engine books the stop first. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { engulfAt } from '../council/eg-methods.mjs';
import { signals, plan, exits, atr14, CELLS, P, verdictOf, monthOf, NM, DM } from '../research/edge/tl3-m15-engulf/run.mjs';

const DIR = new URL('../research/edge/tl3-m15-engulf/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8').replace(/\s+/g, ' ');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

function seeded(seed, n = 60000) {
  const rnd = K.rng(seed); let p = 100; const B = [];
  for (let i = 0; i < n; i++) { const o = p, c = o + (rnd() - 0.5) * 0.2, h = Math.max(o, c) + rnd() * 0.05, l = Math.min(o, c) - rnd() * 0.05; p = c; B.push({ t: i * 300, o, h, l, c, e: i * 300 + 300 }); }
  return B;
}
const key = (g) => [g.kind, g.d, g.ts, g.ext, g.a.toFixed(10), g.sw.join(','), g.touch, g.base].join('|');

test('pre-registration names the cells, the windows, the bar and the earlier studies', () => {
  for (const w of ['2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'n >= 300', 'AFTER costs', 'Control', 'at least 12 H1', 'trendline-engulf-2020', 'tl-third-touch', 'trendline-qm', ...CELLS])
    assert.ok(pre.includes(w), w);
  assert.deepEqual([P.K, P.apart, P.life, P.tol, P.wait, P.span, P.buf, P.minCost, P.swingMin, P.keep, P.cap], [3, 12, 150, 0.1, 3, 3, 0.1, 3, 0.5, 5, 172800]);
  assert.equal(monthOf(Date.UTC(2015, 0, 1) / 1000), DM); assert.equal(monthOf(Date.UTC(2026, 9, 31) / 1000), NM - 1);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}. `) && line.endsWith('.**'), line);
  assert.ok(line.includes(R.headline), 'headline');
  const b = R.cells.find((c) => c.cell === R.best);
  for (const w of [f3(b.conf.meanNet), f3(b.disc.meanNet), b.conf.tNet.toFixed(2), b.disc.tNet.toFixed(2), b.conf.n.toLocaleString('en-US')]) assert.ok(R.headline.includes(w), w);
});

test('the verdict follows the pre-registered bar', () => {
  assert.deepEqual(R.cells.map((c) => c.cell), CELLS);
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.meanNet > 0 && c.conf.meanNet > 0 && c.disc.tNet >= 2 && c.conf.tNet >= 2 && c.holm < 0.05;
    assert.equal(c.pass, ok, c.cell);
  }
  assert.equal(R.verdict, verdictOf(R.cells));
  assert.deepEqual(R.markets, ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd']);
});

test('RESULT.md lists every cell with its figures from result.json', () => {
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    for (const w of [f3(c.disc.mean), f3(c.disc.meanNet), f3(c.conf.mean), f3(c.conf.meanNet), c.conf.tNet.toFixed(2), c.disc.tNet.toFixed(2)]) assert.ok(row.includes(w), c.cell + ' ' + w);
  }
  assert.ok(R.cut.length >= 10);
  for (const x of R.cut) assert.equal(x.missing + x.extra, 0, 'cut test ' + x.market + ' ' + x.cut);
});

test('signals on seeded candles: no look-ahead, the definitions hold, the stop is on the losing side', () => {
  for (const seed of [3, 8]) {
    const B = seeded(seed), H1 = K.resample(B, 3600), M15 = K.resample(B, 900);
    const full = signals(H1, M15), lines = full.filter((g) => g.kind === 'line');
    assert.ok(lines.length >= 10, 'line signals ' + lines.length); assert.ok(full.count.lines > lines.length);
    // cut at several moments (aligned and not): what was known by then is the same on cut candles
    for (const T of [B[20000].e, B[33333].e + 300, B[51234].e]) {
      const cut = signals(H1.filter((b) => b.e <= T), M15.filter((b) => b.e <= T)).filter((g) => g.ts <= T).map(key);
      assert.deepEqual(cut, full.filter((g) => g.ts <= T).map(key));
    }
    // changing every later price does not move an earlier signal
    const T = B[40000].e, B2 = B.map((b) => (b.t >= T ? { ...b, o: b.o * 1.5, h: b.h * 1.6, l: b.l * 1.4, c: b.c * 1.5 } : b));
    assert.deepEqual(signals(K.resample(B2, 3600), K.resample(B2, 900)).filter((g) => g.ts <= T).map(key), full.filter((g) => g.ts <= T).map(key));
    const C = M15.map((b) => ({ open: b.o, high: b.h, low: b.l, close: b.c })), aM = atr14(M15), sw = K.swings(H1, 3);
    for (const g of full) {
      const e = engulfAt(C, g.j, 3); assert.ok(e && e.dir === g.d && e.j === g.base);
      assert.equal(g.ts, M15[g.j].e); assert.equal(g.a, aM[g.j]);
      const from = g.kind === 'line' ? Math.min(g.touch, g.base) : g.base;
      const slice = M15.slice(from, g.j + 1); assert.equal(g.ext, g.d > 0 ? Math.min(...slice.map((b) => b.l)) : Math.max(...slice.map((b) => b.h)));
      if (g.kind === 'line') assert.ok(g.j >= g.touch && g.j <= g.touch + 3);
      // the swing targets were confirmed before the trigger candle started
      const want = sw.filter((s) => s.type === (g.d > 0 ? 'H' : 'L') && s.ct <= M15[g.j].t).sort((a, b) => a.ci - b.ci || a.i - b.i).slice(-5).reverse().map((s) => s.price);
      assert.deepEqual(g.sw, want);
      // the plan at the next 5-minute open: the stop below a buy's fill, above a sell's; the targets beyond the fill
      const fi = B.findIndex((b) => b.t >= g.ts); if (fi < 0) continue; const fill = B[fi].o, pl = plan(g, fill, 0.0001);
      if (pl.skip) { assert.ok(pl.skip === 'bad' ? !(g.d * (fill - (g.ext - g.d * 0.1 * g.a)) > 0) : true); continue; }
      assert.ok(g.d * (fill - pl.stop) > 0, 'stop side'); assert.ok(g.d * (pl.stop - g.ext) < 0, 'stop past the extreme');
      assert.ok(Math.abs(g.d * (pl.targets[0] - fill) - 2 * pl.risk) < 1e-9);
      if (Number.isFinite(pl.targets[1])) assert.ok(g.d * (pl.targets[1] - fill) >= 0.5 * pl.risk - 1e-12);
    }
  }
});

test('a hand-made rising line: third touch, engulf up, one signal; a close through the line gives none', () => {
  // H1 candles from a path of lows; 5-minute candles are flat inside each quarter hour except where set
  const mk = (alter) => { const B = []; let t = 0;
    const h1 = (lo, hi) => { for (let q = 0; q < 12; q++) { B.push({ t, o: hi - 0.2, h: hi, l: lo, c: hi - 0.2, e: t + 300 }); t += 300; } };
    for (let i = 0; i < 20; i++) h1(110 - i * 0.2, 111 - i * 0.2);        // drift down (warm-up for the ATR)
    const lows = [105, 106, 107, 100, 107, 108, 109, 109.5, 110, 110.5, 111, 111.5, 112, 112.5, 113, 113.5, 114, 104, 114, 115, 116, 117];
    for (const lo of lows) h1(lo, lo + 1);                                 // swing lows at 100 (A) and 104 (B), 14 candles apart
    alter(B, t, h1); return B; };
  // after B is confirmed (3 candles), price comes down to the line (about 105.4 at that candle) and engulfs up
  const touch = (B, t0, closeThrough) => { let t = t0; const add = (o, h, l, c) => { B.push({ t, o, h, l, c, e: t + 300 }); t += 300; };
    for (let q = 0; q < 3; q++) add(108, 108.1, 107.9, 108);              // M15 #1: flat
    add(108, 108, 106.5, 106.6); add(106.6, 106.7, 105.5, 105.6); add(105.6, 105.7, 105.3, closeThrough ? 104.0 : 105.5); // M15 #2: red, touches the line
    add(closeThrough ? 104 : 105.5, 107, closeThrough ? 103.9 : 105.4, 106.9); add(106.9, 108.6, 106.8, 108.5); add(108.5, 108.8, 108.4, 108.7); // M15 #3: green, closes above #2's high
    for (let q = 0; q < 30; q++) add(108.7, 108.8, 108.6, 108.7); };
  const run = (ct) => { const B = mk((B, t) => touch(B, t, ct)); const s = signals(K.resample(B, 3600), K.resample(B, 900), { control: false }); return { s, B }; };
  const a = run(false); assert.equal(a.s.length, 1); const g = a.s[0];
  assert.equal(g.d, 1); assert.equal(g.kind, 'line'); assert.ok(Math.abs(g.ext - 105.3) < 1e-9); assert.equal(g.j, g.touch + 1);
  const b = run(true); assert.equal(b.s.length, 0); assert.equal(b.s.count.closedThrough, 1);
});

test('the trade engine: stop first, gaps, two targets, the 48-hour limit', () => {
  const bar = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });
  let r = exits([bar(0, 100, 100.2, 99.8, 100), bar(300, 100, 102.5, 99.9, 102), bar(600, 102, 102, 98, 99)], 1, 0, 99, [102, 104], 172800);
  assert.deepEqual(r.R, [2, -1]);
  r = exits([bar(0, 100, 100, 100, 100), bar(300, 100, 102.2, 98.9, 100)], 1, 0, 99, [102, NaN], 172800); assert.equal(r.R[0], -1); assert.ok(Number.isNaN(r.R[1]));
  r = exits([bar(0, 100, 100, 100, 100), bar(300, 98, 98.5, 97.8, 98)], 1, 0, 99, [102, NaN], 172800); assert.equal(r.R[0], -2);
  r = exits([bar(0, 100, 100.1, 99.9, 100), bar(300, 100, 100.5, 99.9, 100.4)], 1, 0, 99, [102, NaN], 600); assert.ok(Math.abs(r.R[0] - 0.4) < 1e-9);
  assert.equal(exits([bar(0, 100, 100, 100, 100)], 1, 0, 101, [102, NaN], 600), null);
  assert.equal(plan({ d: 1, ext: 101, a: 1, sw: [] }, 100, 0.01).skip, 'bad');
  assert.equal(plan({ d: 1, ext: 99.99, a: 0.01, sw: [] }, 100, 0.01).skip, 'small');
});
