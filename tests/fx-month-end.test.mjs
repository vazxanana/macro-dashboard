// fx-month-end study: calendar, London clock, no look-ahead in the signal, the stop, costs, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/fx-month-end/run.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'research/edge/fx-month-end');
const DAY = 86400;
const utc = (s) => Date.parse(s) / 1000;

test('last London business day skips weekends and bank holidays', () => {
  assert.equal(S.lastLondonBusinessDay(2024, 2), 28);   // Good Friday 29 Mar 2024
  assert.equal(S.lastLondonBusinessDay(2025, 4), 30);   // 26 May 2025 bank holiday is not the last weekday anyway
  assert.equal(S.lastLondonBusinessDay(2021, 4), 28);   // 31 May 2021 spring bank holiday (Monday)
  assert.equal(S.lastLondonBusinessDay(2020, 7), 28);   // 31 Aug 2020 summer bank holiday
  assert.equal(S.lastLondonBusinessDay(2026, 9), 30);   // Friday 30 Oct 2026
  assert.equal(S.lastLondonBusinessDay(2022, 6), 29);   // Sunday 31 Jul 2022
  assert.equal(S.lastLondonBusinessDay(2015, 11), 31);  // 31 Dec is a business day
  assert.ok(S.ukHolidays(2020).has('2020-05-08') && !S.ukHolidays(2020).has('2020-05-04'));
  assert.ok(S.ukHolidays(2022).has('2022-06-02') && S.ukHolidays(2022).has('2022-06-03'));
  assert.ok(S.ukHolidays(2021).has('2021-12-27') && S.ukHolidays(2021).has('2021-12-28'));   // Christmas on a Saturday
});

test('London clock with daylight saving', () => {
  assert.equal(S.londonAt(2026, 0, 30, 10), utc('2026-01-30T10:00:00Z'));
  assert.equal(S.londonAt(2026, 6, 31, 10), utc('2026-07-31T09:00:00Z'));
  assert.equal(S.londonAt(2026, 6, 31, 16), utc('2026-07-31T15:00:00Z'));
  assert.equal(S.londonAt(2026, 9, 30, 10), utc('2026-10-30T10:00:00Z'));   // BST ends Sunday 25 Oct 2026 → GMT on the 30th
  assert.equal(S.londonAt(2025, 9, 31, 10), utc('2025-10-31T10:00:00Z'));   // BST ended 26 Oct 2025
  assert.equal(S.londonAt(2024, 2, 28, 10), utc('2024-03-28T10:00:00Z'));   // BST starts 31 Mar 2024
  assert.equal(S.londonOffsetH(utc('2026-03-29T00:59:00Z')), 0);
  assert.equal(S.londonOffsetH(utc('2026-03-29T01:00:00Z')), 1);
});

// daily rows for one index: start 2026-06-29 at 100, +1 % a day; 00:00 UTC candles
function rows(from, n, f) { const out = []; const t0 = utc(from + 'T00:00:00Z'); for (let i = 0; i < n; i++) { const c = f(i); out.push([t0 + i * DAY, c, c, c, c, 1]); } return out; }

test('signal uses only daily candles that closed by 10:00 London', () => {
  const base = (i) => 100 * (1 + 0.01 * i);
  const D = { spx500: rows('2026-06-25', 40, base), de40: rows('2026-06-25', 40, () => 100), uk100: rows('2026-06-25', 40, () => 100), jp225: rows('2026-06-25', 40, () => 100) };
  const s = S.signal(D, 2026, 6, 31);   // 10:00 London = 09:00 UTC on 31 Jul
  assert.ok(s.readUpTo <= s.signalT);
  assert.equal(s.readUpTo, utc('2026-07-31T00:00:00Z'));   // the 30 Jul candle, closed at 00:00 UTC on the 31st
  // change every price at or after the signal day's own candle: the signal must not move
  const before = s.gap;
  const t31 = utc('2026-07-31T00:00:00Z');
  for (const k of Object.keys(D)) for (const r of D[k]) if (r[0] >= t31) { r[4] = 1e6; }
  assert.equal(S.signal(D, 2026, 6, 31).gap, before);
  // base close is 30 Jun's candle (closed at 00:00 UTC on 1 Jul)
  assert.ok(Math.abs(s.mtd.spx500 - (base(35) / base(5) - 1)) < 1e-12);
  assert.ok(s.gap > 0);
});

test('every leg has a stop on the losing side; a hit exits at the stop, a gap at the open', () => {
  const H = [
    { time: 0, open: 1.0, high: 1.001, low: 0.999, close: 1.0 },
    { time: 3600, open: 1.0, high: 1.0005, low: 0.994, close: 0.995 },
  ];
  const buy = S.leg(H, 0, 1, 1, 0.005);
  assert.equal(buy.stop, 0.995); assert.equal(buy.why, 'stop'); assert.equal(buy.exit, 0.995);
  const sell = S.leg(H, 0, 1, -1, 0.005);
  assert.ok(sell.stop > sell.entry); assert.equal(sell.why, 'time'); assert.equal(sell.exit, 0.995);
  const G = [{ time: 0, open: 1, high: 1, low: 1, close: 1 }, { time: 3600, open: 0.99, high: 0.99, low: 0.98, close: 0.985 }];
  const g = S.leg(G, 0, 1, 1, 0.005);
  assert.equal(g.why, 'gap'); assert.equal(g.exit, 0.99);
});

test('ATR reads only candles before the entry candle', () => {
  const H = Array.from({ length: 40 }, (_, i) => ({ time: i * 3600, open: 1, high: 1.001, low: 0.999, close: 1 }));
  const a = S.atrBefore(H, 30);
  H[30] = { ...H[30], high: 2, low: 0 };
  assert.equal(S.atrBefore(H, 30), a);
  assert.ok(Math.abs(a - 0.002) < 1e-12);
});

test('costs: raw-spread model, commission 22.5 USD per million a side', () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/ctrader/symbols-raw-12nov.json'), 'utf8'));
  const c = S.buildCosts(fixture);
  for (const k of S.FX) assert.ok(Math.abs(c[k].commissionRT - 0.000045) < 1e-9, k);
  assert.equal(c.eurusd.spreadPips, 0);
  assert.equal(c.eurusd.slipPips, 1);
  assert.equal(c.usdjpy.spreadPips, 1);
  assert.ok(Math.abs(S.legCostPx(c.eurusd, 1.1) - (0.0001 + 0.000045 * 1.1)) < 1e-12);
  assert.ok(Math.abs(S.legCostPx(c.usdjpy, 150) - (0.02 + 0.000045 * 150)) < 1e-9);
});

test('Holm over two rules', () => {
  assert.deepEqual(S.holm([0.01, 0.04]), [true, true]);
  assert.deepEqual(S.holm([0.03, 0.04]), [false, false]);
  assert.deepEqual(S.holm([0.2, 0.001]), [false, true]);
});

test('RESULT.md states what result.json says', () => {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.match(md.split('\n').slice(0, 6).join('\n'), new RegExp(`Verdict: ${j.verdict}`));
  const b = j.base.decisive, c = j.base.check, v = j.variant.decisive;
  for (const x of [b.n, b.meanR.toFixed(4), b.t.toFixed(2), c.n, c.meanR.toFixed(4), v.n, v.meanR.toFixed(4), j.placebo.p95.toFixed(4)]) assert.ok(md.includes(String(x)), `RESULT.md lacks ${x}`);
  assert.ok(fs.existsSync(path.join(DIR, 'PREREGISTRATION.md')));
});
