// tests/gap-level-engulf.test.mjs - opening gaps as key levels with an M15 engulf entry: the pre-registration, RESULT.md agrees
// with result.json, the verdict follows the bar, and on seeded candles the gaps, the no-look-ahead of the signals, the stop
// side and the trade engine. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { gaps, signals, trades, exits, judge, windowStat, report, CELLS, P } from '../research/edge/gap-level-engulf/run.mjs';

const DIR = new URL('../research/edge/gap-level-engulf/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3));

// a seeded market from Monday 6 Jan 2020 (New York winter: the roll is 22:00 UTC): shut Fri 22:00 - Sun 22:00 and 22:00 - 23:00
// on the other days, with a jump across each closure
function market(seed, weeks = 10) {
  const rnd = K.rng(seed), out = []; let p = 1500; const t0 = Date.UTC(2020, 0, 6) / 1000; let wasShut = false;
  for (let t = t0; t < t0 + weeks * 7 * 86400; t += 300) {
    const d = new Date(t * 1000), wd = d.getUTCDay(), h = d.getUTCHours();
    const shut = (wd === 5 && h >= 22) || wd === 6 || (wd === 0 && h < 22) || h === 22;
    if (shut) { wasShut = true; continue; }
    if (wasShut) { p += (rnd() - 0.5) * (wd === 0 ? 14 : 6); wasShut = false; }
    const o = p, c = o + (rnd() - 0.5) * 1.6, hi = Math.max(o, c) + rnd() * 0.5, lo = Math.min(o, c) - rnd() * 0.5; p = c;
    out.push({ t, o, h: hi, l: lo, c, e: t + 300 });
  }
  return out;
}
const key = (s) => [s.kind, s.d, s.ts, s.stop, s.lo, s.hi, s.gapT].join('|');

test('pre-registration names the cells, the windows, the bar and the size filter', () => {
  for (const w of ['2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'n >= 300', '0.1 x the Daily ATR(14)', 'engulfAt', '40 hours', 'INCONCLUSIVE', ...CELLS])
    assert.ok(pre.includes(w), w);
});

test('gaps: weekly and daily, only over 0.1 x Daily ATR(14), alive to the end of their week', () => {
  const B = market(3), G = gaps(B);
  assert.ok(G.some((g) => g.kind === 'weekly') && G.some((g) => g.kind === 'daily'));
  for (const g of G) {
    assert.ok(g.size > P.size * g.atr && g.hi > g.lo);
    const b = B[g.i0], a = B[g.i0 - 1]; assert.equal(g.t0, b.t);
    assert.equal(g.lo, Math.min(a.c, b.o)); assert.equal(g.hi, Math.max(a.c, b.o));
    const hole = b.t - a.e; assert.ok(g.kind === 'weekly' ? hole >= 40 * 3600 : hole === 3600 && new Date(a.e * 1000).getUTCHours() === 22);
    if (Number.isFinite(g.end)) { assert.ok(g.end > g.t0 && g.end - g.t0 <= 5 * 86400); assert.equal(new Date(g.end * 1000).getUTCDay(), 5); }
  }
  // no gap in the first 15 trading days (no ATR yet)
  assert.ok(G.every((g) => g.t0 >= B[0].t + 14 * 86400));
});

test('signals: no look-ahead (cut and changed later candles), the stop past the far side, engulf in the armed direction', () => {
  let total = 0;
  for (const seed of [3, 8, 21]) {
    const B = market(seed), S = signals(B).signals; total += S.length;
    for (const s of S) { assert.ok(s.d > 0 ? s.stop < s.lo : s.stop > s.hi, 'stop past the far side'); assert.ok(s.ts > s.gapT && s.ts <= s.end); }
    const rnd = K.rng(seed + 100);
    for (let k = 0; k < 12; k++) {
      const n = 6000 + Math.floor(rnd() * (B.length - 6100)), T = B[n - 1].e;
      const want = S.filter((s) => s.ts <= T - 900).map(key);
      assert.deepEqual(signals(B.slice(0, n)).signals.filter((s) => s.ts <= T - 900).map(key), want, 'cut ' + n);
      const C = B.map((b, i) => (i < n ? b : { ...b, o: b.o * 1.07, h: b.h * 1.09, l: b.l * 1.05, c: b.c * 1.07 }));
      assert.deepEqual(signals(C).signals.filter((s) => s.ts <= T - 900).map(key), want, 'changed ' + n);
    }
  }
  assert.ok(total >= 20, 'the seeded markets give signals: ' + total);
});

test('trades: every stop on the losing side of its fill, risk above the cost, fills inside the gap\'s week', () => {
  const B = market(8), { trades: T } = trades(B, 0.3), S = signals(B).signals; assert.ok(T.length >= 5);
  for (const t of T) {
    const fi = B.findIndex((b) => b.t === t.t), s = S.find((x) => x.gapT === t.gapT && x.ts <= t.t && t.t - x.ts <= 3600 && x.d === t.d); assert.ok(s);
    assert.ok(t.d * (B[fi].o - s.stop) > 0.3); assert.ok(t.t < s.end && t.c > 0 && t.c < 1);
    assert.ok(t.R[0] <= 1 + 1e-9 || t.R[0] > 1, 'finite'); assert.ok(t.R.every(Number.isFinite));
    assert.ok(t.R[0] >= t.R[1] - 1e-9 || t.R[1] > t.R[0], 'two targets');
  }
});

test('the trade engine: stop first, gaps at the open, two targets, the time limit, wrong-side stop', () => {
  const bar = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });
  let r = exits([bar(0, 100, 100.2, 99.8, 100), bar(300, 100, 100.1, 98.5, 99), bar(600, 99, 101.5, 99, 101)], 0, -1, 101);
  assert.deepEqual(r.R, [1, -1]); assert.equal(r.risk, 1);
  r = exits([bar(0, 100, 100, 100, 100), bar(300, 100, 101.2, 98.9, 100)], 0, -1, 101); assert.deepEqual(r.R, [-1, -1]);
  r = exits([bar(0, 100, 100, 100, 100), bar(300, 102, 102.5, 101.8, 102)], 0, -1, 101); assert.deepEqual(r.R, [-2, -2]);
  r = exits([bar(0, 100, 100.1, 99.9, 100), bar(300, 100, 100.2, 99.6, 99.6)], 0, -1, 101, [1, 2], 600); assert.ok(Math.abs(r.R[0] - 0.4) < 1e-9);
  r = exits([bar(0, 100, 100.4, 99.9, 100), bar(300, 97.5, 98, 97, 97.4), bar(600, 97.4, 97.5, 97.3, 97.4)], 0, -1, 101); assert.deepEqual(r.R, [2.5, 2.5]);
  assert.equal(exits([bar(0, 100, 100, 100, 100)], 0, -1, 99), null);
  assert.equal(exits([bar(0, 100, 100.1, 99.9, 100)], 0, 1, 99), null, 'unfinished');
});

test('line 3 is the verdict line; the verdict follows the pre-registered bar', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}. `) && line.endsWith('.**'), line);
  assert.ok(line.includes(R.headline));
  assert.deepEqual(R.cells.map((c) => c.cell), CELLS);
  const copy = R.cells.map((c) => ({ cell: c.cell, disc: c.disc, conf: c.conf }));
  assert.equal(judge(copy), R.verdict);
  copy.forEach((c, i) => { assert.equal(c.pass, R.cells[i].pass); assert.ok(Math.abs(c.holm - R.cells[i].holm) < 1e-12); });
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.after > 0 && c.conf.after > 0 && c.disc.tAfter >= 2 && c.conf.tAfter >= 2 && c.holm < 0.05;
    assert.equal(c.pass, ok, c.cell);
  }
  assert.deepEqual(R.passed, R.cells.filter((c) => c.pass).map((c) => c.cell));
  assert.equal(md, report(R), 'RESULT.md is the report of result.json');
});

test('RESULT.md carries every cell\'s figures; the pooled n is the sum of the markets', () => {
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    for (const x of [f3(c.disc.before), f3(c.disc.after), f3(c.conf.before), f3(c.conf.after), String(c.conf.n), String(c.disc.n)]) assert.ok(row.includes(x), c.cell + ' ' + x);
  }
  R.cells.forEach((c, i) => { for (const w of ['disc', 'conf']) assert.equal(c[w].n, R.markets.reduce((a, m) => a + R.perMarket[m][i][w].n, 0)); });
  assert.deepEqual(R.markets, ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd']);
  assert.ok(R.headline.length <= 221);
});

test('windowStat: month sums over every month of the window, before and after costs', () => {
  const a = Date.UTC(2020, 0, 1) / 1000, b = Date.UTC(2020, 3, 1) / 1000;
  const s = windowStat([{ t: a + 5, g: 1, n: 0.9 }, { t: a + 40 * 86400, g: -1, n: -1.1 }, { t: b + 5, g: 9, n: 9 }], a, b);
  assert.equal(s.n, 2); assert.equal(s.months, 3); assert.ok(Math.abs(s.after + 0.1) < 1e-12); assert.equal(s.before, 0); assert.equal(s.win, 0.5);
  assert.ok(Math.abs(s.tAfter - (-0.2 / 3) / (Math.sqrt(((0.9 + 0.2 / 3) ** 2 + (-1.1 + 0.2 / 3) ** 2 + (0.2 / 3) ** 2) / 2) / Math.sqrt(3))) < 1e-9);
});
