// Volatility-managed exposure on US index CFDs (research/edge/vol-managed): offline checks on hand-made candles.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { foldWeekend, rvAt, plan, simulate, solveC, capped, monthEnds, report, bootP, holm, P } from '../research/edge/vol-managed/run.mjs';

const DAY = 86400, T0 = Date.UTC(2005, 0, 3) / 1e3; // a Monday
// weekday bars from T0, close path from f(i)
function bars(n, f) {
  const out = []; let t = T0, i = 0;
  while (out.length < n) { const wd = new Date(t * 1e3).getUTCDay(); if (wd && wd !== 6) { const c = f(i++); out.push({ t, o: c, h: c * 1.002, l: c * 0.998, c }); } t += DAY; }
  return out;
}
const noisy = (seed) => { let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647); let c = 1000; return () => (c *= 1 + (rnd() - 0.5) * 0.02); };
const flat = () => () => 0.03;

test('weekend candles fold into the next weekday; a trailing weekend candle is dropped', () => {
  const fri = Date.UTC(2026, 10, 6) / 1e3;
  const rows = [[fri, 10, 11, 9, 10.5], [fri + 2 * DAY, 10.4, 12, 10.3, 10.6], [fri + 3 * DAY, 10.6, 10.8, 8, 10.2], [fri + 8 * DAY, 1, 1, 1, 1]];
  const f = foldWeekend(rows);
  assert.equal(f.length, 2);
  assert.deepEqual(f[1], { t: fri + 3 * DAY, o: 10.4, h: 12, l: 8, c: 10.2 });
});

test('the weight at a month end reads only returns up to that close', () => {
  const g = noisy(7), a = bars(900, () => g());
  const b = a.map((x, i) => (i > 400 ? { ...x, c: x.c * 3, h: x.h * 3, l: x.l * 3 } : x));
  for (const i of monthEnds(a).filter((e) => e > 30 && e < 400)) assert.equal(rvAt(a, i), rvAt(b, i));
  // changing every price after a month end leaves that month's raw weight and stop unchanged
  const disc = ['2005-03', '2007-12'];
  const pa = plan(a, 'V', disc), pb = plan(b, 'V', disc);
  for (const m of pa.months.filter((m) => m.e < 400)) { const n = pb.months.find((x) => x.e === m.e); assert.equal(n.raw, m.raw); assert.equal(n.stop, m.stop); }
});

test('c is fitted on discovery months only and the cap holds', () => {
  const g = noisy(11), a = bars(1500, () => g());
  const disc = ['2005-03', '2006-12'];
  // multiply the variance of every later return: c must not move
  let last = a[0].c; const b = a.map((x, i) => { if (i === 0 || x.t < Date.UTC(2007, 0, 1) / 1e3) { last = x.c; return x; } const r = a[i].c / a[i - 1].c - 1; last *= 1 + 5 * r; return { ...x, o: last, h: last * 1.01, l: last * 0.99, c: last }; });
  const pa = plan(a, 'V', disc), pb = plan(b, 'V', disc);
  assert.equal(pa.c, pb.c);
  const dm = pa.months.filter((m) => m.ym >= disc[0] && m.ym <= disc[1]);
  assert.ok(Math.abs(dm.reduce((s, m) => s + m.w, 0) / dm.length - 1) < 1e-9);
  for (const m of pb.months) assert.ok(m.w <= P.cap + 1e-12 && m.w > 0);
  assert.equal(capped(10, 1), 2);
  assert.ok(Math.abs(solveC([1, 1, 1]) - 1) < 1e-9);
  // with the cap binding on one month the mean capped weight is still 1
  assert.ok(Math.abs((capped(solveC([0.1, 100]), 0.1) + capped(solveC([0.1, 100]), 100)) / 2 - 1) < 1e-9);
});

test('a stop exits at the stop (or the gapped open) and stays flat until the month end', () => {
  const a = bars(200, (i) => 1000 + i * 0.1);
  const pl = plan(a, 'B', ['2005-01', '2099-12']);
  const m = pl.months[0], k = m.e + 3;
  // gap through the stop on day k: open below the stop
  a[k] = { ...a[k], o: m.stop - 5, l: m.stop - 10 };
  const sim = simulate(a, pl, flat());
  const day = sim.daily.find((d) => d.t === a[k].t);
  const expect = (m.stop - 5) / a[k - 1].c - 1;
  assert.ok(day.r < expect + 1e-12 && day.r > expect - 0.001, 'exit at the gapped open, less costs');
  const next = sim.daily.filter((d) => d.t > a[k].t && d.ym === day.ym);
  // flat after the stop; the month's last close only pays the re-entry spread of the next month's position
  assert.ok(next.length > 1 && next.slice(0, -1).every((d) => d.r === 0), 'flat after the stop');
  assert.ok(Math.abs(next.at(-1).r + pl.months[1].w * P.spreadRT / 2) < 1e-12, 're-entry from flat pays w x half the round trip');
  assert.equal(sim.log[0].stoppedAt != null, true);
  // every month has a stop below its entry
  for (const x of pl.months) assert.ok(x.stop < a[x.e].c);
});

test('bootstrap and Holm behave', () => {
  const a = [...Array(60)].map((_, i) => 0.01 + (i % 3) * 0.001), b = a.map((x) => x - 0.005);
  assert.equal(bootP(a, b, { draws: 200, block: 6, seed: 1 }), 1);
  assert.deepEqual(holm([0.04, 0.09]), [true, true]);
  assert.deepEqual(holm([0.06, 0.09]), [false, false]);
});

test('RESULT.md is the report of result.json, and the verdict is FAIL', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/vol-managed/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/vol-managed/RESULT.md', import.meta.url), 'utf8');
  assert.equal(md, report(r));
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL\*\*/);
  assert.equal(r.book.V.pass, false); assert.equal(r.book.S.pass, false);
  assert.deepEqual(r.disc, ['2008-01', '2015-12']);
  assert.match(md, /item 44/);
});
