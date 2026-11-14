// Gotobi study (research/edge/gotobi): calendar, UTC times, no look-ahead in the stop, the stop itself, costs, and the report
// against result.json. Offline: hand-made candles only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as G from '../research/edge/gotobi/run.mjs';

const T = (s) => Date.parse(s) / 1000;

test('gotobi calendar: weekend and holiday roll-back, last business day', () => {
  // Jan 2026: 10th is a Saturday -> Fri 9th; 25th Sunday -> Fri 23rd; last business day Fri 30th
  assert.deepEqual(G.gotobiOfMonth(2026, 1), ['2026-01-05', '2026-01-09', '2026-01-15', '2026-01-20', '2026-01-23', '2026-01-30']);
  // May 2026: 3-6 May closed (6th = substitute for Sunday 3rd) -> the 5th rolls to Fri 1 May
  assert.equal(G.isTokyoBusinessDay('2026-05-06'), false);
  assert.equal(G.gotobiOfMonth(2026, 5)[0], '2026-05-01');
  // Golden Week 2019 (27 Apr - 6 May closed): 5 May rolls into April and counts once
  assert.equal(G.isTokyoBusinessDay('2019-04-30'), false);
  assert.equal(G.isTokyoBusinessDay('2019-05-02'), false);
  assert.equal(G.gotobiOfMonth(2019, 5)[0], '2019-04-26');
  assert.equal([...G.gotobiSet(2019, 2019)].filter((d) => d === '2019-04-26').length, 1);
  // 31 Dec and 1-3 Jan closed: Dec's last business day is the 30th (2025: Tue 30 Dec)
  assert.equal(G.gotobiOfMonth(2025, 12).at(-1), '2025-12-30');
  // Respect for the Aged Day 2026 = Mon 21 Sep, Autumnal equinox Wed 23 Sep, so Tue 22 Sep is a citizen's holiday
  assert.equal(G.isTokyoBusinessDay('2026-09-22'), false);
  // Mountain Day on a Sunday (8 Aug 2021) moves to Monday 9 Aug
  assert.equal(G.isTokyoBusinessDay('2021-08-09'), false);
  // Nov 2026: 15th Sunday -> Fri 13th; last business day Mon 30th
  assert.deepEqual(G.gotobiOfMonth(2026, 11), ['2026-11-05', '2026-11-10', '2026-11-13', '2026-11-20', '2026-11-25', '2026-11-30']);
});

test('UTC times: 07:00, 09:55 and 15:00 Tokyo; 22:05 UTC at the New York 17:00 rollover', () => {
  const w = G.legTimes('long', '2026-01-05');   // New York standard time: 22:00 UTC = 17:00 New York
  assert.equal(w.entry, T('2026-01-04T22:05:00Z'));
  assert.equal(w.exit, T('2026-01-05T00:55:00Z'));
  const s = G.legTimes('long', '2026-07-06');   // New York summer time: rollover at 21:00 UTC
  assert.equal(s.entry, T('2026-07-05T22:00:00Z'));
  const f = G.legTimes('fade', '2026-07-06');
  assert.equal(f.entry, T('2026-07-06T00:55:00Z'));
  assert.equal(f.exit, T('2026-07-06T06:00:00Z'));
  // the long leg's hold never crosses a rollover after its entry (17:00 New York)
  for (const d of ['2026-01-05', '2026-03-09', '2026-07-06', '2026-11-02']) {
    const { entry, exit } = G.legTimes('long', d);
    for (let t = entry + 300; t < exit; t += 300) assert.notEqual(G.nyHour(t) * 60 + new Date(t * 1000).getUTCMinutes(), 17 * 60);
  }
});

// flat candles at price p for every 5 minutes of [a, b)
const flat = (a, b, p) => { const out = []; for (let t = a; t < b; t += 300) out.push([t, p, p, p, p]); return out; };

test('the stop: 1.5 x the median of the prior 20 business days, nothing from the trade day or later', () => {
  const day = '2026-07-20';   // a gotobi Monday
  const moves = {}; let d = G.addD(day, -1), i = 0;
  while (i < 20) { if (G.isTokyoBusinessDay(d)) { moves[d] = 0.1 + 0.01 * i; i++; } d = G.addD(d, -1); }
  const moveOf = (x) => (x >= day ? 99 : moves[x] ?? null);   // a huge move on/after the day must not count
  const D = G.stopDist(moveOf, day);
  const sorted = Object.values(moves).sort((a, b) => a - b);
  assert.ok(Math.abs(D - 1.5 * (sorted[9] + sorted[10]) / 2) < 1e-12);
  // fewer than 15 valid days -> no stop, no trade
  assert.equal(G.stopDist((x) => (x > '2026-07-10' ? 0.1 : null), day), null);
});

test('a trade: stop hit, gap through the stop, time exit, and costs', () => {
  const day = '2026-07-20', { entry, exit } = G.legTimes('long', day);
  const bars = flat(entry, exit + 3600, 150);
  const ix = () => G.index(bars.map((b) => [...b]));
  // time exit at the 00:55 candle's open
  let b2 = bars.map((b) => [...b]); const k = b2.findIndex((b) => b[0] === exit); b2[k][1] = 150.2;
  let t = G.trade(G.index(b2), 'long', day, 0.2);
  assert.equal(t.how, 'time'); assert.ok(Math.abs(t.R - 1) < 1e-9);
  const cost = 0.003 + 0.01 + 2 * 22.5e-6 * 150;
  assert.ok(Math.abs(G.costPx(150) - cost) < 1e-12);
  assert.ok(Math.abs(t.net - (1 - cost / 0.2)) < 1e-9);
  // a low through the stop -> -1R before costs
  b2 = bars.map((b) => [...b]); b2[5][3] = 149.7;
  t = G.trade(G.index(b2), 'long', day, 0.2);
  assert.equal(t.how, 'stop'); assert.ok(Math.abs(t.R + 1) < 1e-9); assert.ok(t.stop < t.entry);
  // an open past the stop fills at that open
  b2 = bars.map((b) => [...b]); b2[5] = [b2[5][0], 149.5, 149.6, 149.4, 149.5];
  t = G.trade(G.index(b2), 'long', day, 0.2);
  assert.equal(t.how, 'gap'); assert.ok(Math.abs(t.R + 2.5) < 1e-9);
  // the fade is a sell: its stop sits above the entry
  const f = G.legTimes('fade', day), fb = flat(f.entry, f.exit + 600, 150);
  t = G.trade(G.index(fb), 'fade', day, 0.2);
  assert.ok(t.stop > t.entry); assert.equal(t.how, 'time');
  // no stop distance or a missing entry candle -> no trade
  assert.equal(G.trade(ix(), 'long', day, null), null);
  assert.equal(G.trade(G.index(bars.filter((b) => b[0] !== entry)), 'long', day, 0.2), null);
  // a price after the exit time never moves the trade
  b2 = bars.map((b) => [...b]); for (const b of b2) if (b[0] > exit) { b[3] = 100; b[2] = 200; }
  assert.equal(G.trade(G.index(b2), 'long', day, 0.2).how, 'time');
});

test('statistics: month t, Holm and the seeded placebo draw', () => {
  const h = G.holm([0.001, 0.02, 0.03, 0.5]);
  assert.deepEqual(h.ok, [true, false, false, false]);
  assert.deepEqual(G.draw([1, 2, 3, 4, 5, 6], 3, 7), G.draw([1, 2, 3, 4, 5, 6], 3, 7));
  assert.equal(new Set(G.draw([1, 2, 3, 4, 5, 6], 6, 1)).size, 6);
  assert.ok(Math.abs(G.normCdf(1.96) - 0.975) < 1e-3);
});

test('RESULT.md matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gotobi/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gotobi/RESULT.md', import.meta.url), 'utf8');
  assert.equal(G.report(r), md);
  assert.match(md, new RegExp(`\\*\\*Verdict: ${r.verdict.replace(/[()]/g, '\\$&')}\\.`));
  for (const k of ['T1', 'T2', 'T3', 'T4']) {
    const t = r.tests[k];
    assert.equal(t.pass, Object.values(t.checks).every(Boolean));
    assert.equal(t.placebo.values.length, 40);
    assert.equal(t.placebo.p95, [...t.placebo.values].sort((a, b) => a - b)[37]);
  }
  assert.equal(r.verdict === 'FAIL', r.passed.length === 0);
});
