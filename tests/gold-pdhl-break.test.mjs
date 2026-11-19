// gold-pdhl-break: the rule on hand-made candles, no look-ahead, and the report against result.json. Offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as G from '../research/edge/gold-pdhl-break/run.mjs';

const DIR = new URL('../research/edge/gold-pdhl-break/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const D = Date.parse('2021-03-03T00:00:00Z') / 1000;   // a Wednesday
const near = (a, b) => Math.abs(a - b) < 1e-9;

// one UTC day of flat M5 candles at p, 00:00 → 23:55, with overrides by minute of the day
function day(start, p, over = {}) {
  const out = [];
  for (let m = 0; m < 1440; m += 5) out.push({ t: start + m * 60, o: p, h: p + 0.1, l: p - 0.1, c: p, ...(over[m] || {}) });
  return out;
}
const L0 = { pdh: 101, pdl: 99, atr: 4, close: 100, sma: 99 };

test('levels: previous folded day, ATR20 and SMA20 from days before D only', () => {
  const d1 = [];
  for (let i = 0; i < 22; i++) d1.push({ time: D - (22 - i) * 86400, open: 100, high: 101 + (i === 21 ? 1 : 0), low: 99, close: 100 });
  const L = G.levels(d1, D);
  assert.equal(L.pdh, 102); assert.equal(L.pdl, 99);
  assert.ok(near(L.atr, (19 * 2 + 3) / 20)); assert.ok(near(L.sma, 100));
  // a candle dated D or later changes nothing
  assert.deepEqual(G.levels([...d1, { time: D, open: 1, high: 500, low: 1, close: 1 }], D), L);
  assert.equal(G.levels(d1.slice(-20), D), null);   // needs 21 earlier candles
});

test('build: weekends folded, so Monday\'s previous day is Friday', () => {
  const fri = Date.parse('2021-03-05T00:00:00Z') / 1000, sun = fri + 2 * 86400, mon = fri + 3 * 86400, rows = [];
  for (let i = 40; i >= 1; i--) { const s = fri - i * 86400, w = new Date(s * 1000).getUTCDay(); if (w && w < 6) rows.push([s + 3600, 100, 101, 99, 100]); }
  rows.push([fri + 3600, 100, 103, 98, 100], [sun + 22 * 3600, 100, 120, 100, 110], [mon + 3600, 110, 111, 109, 110]);
  const B = G.build(rows), L = G.levels(B.d1, mon);
  assert.equal(L.pdh, 103); assert.equal(L.pdl, 98);   // Friday, not the Sunday stub
  const m = B.d1.find((x) => x.time === mon); assert.equal(m.high, 120);   // the Sunday stub joined Monday
});

test('m15 and triggers: the first close beyond each level 07:00-16:45, one per side', () => {
  const bars = day(D, 100, { 425: { c: 101.5, h: 101.6 }, 430: { o: 101.5, c: 101.4, h: 101.6 }, 610: { c: 98, l: 97.9 }, 700: { c: 102 }, 1020: { c: 50, l: 50 } });
  const q = G.m15(bars, D);
  assert.equal(q[0].t, D + 7 * 3600); assert.equal(q.at(-1).t, D + 16 * 3600 + 45 * 60);
  const g = G.triggers(q, L0);
  assert.equal(g.length, 2);
  assert.deepEqual(g[0], { side: 1, at: D + 7 * 3600, end: D + 7 * 3600 + 900 });   // the 07:00-07:15 candle closes at 101.4
  assert.equal(g[1].side, -1); assert.equal(g[1].at, D + 600 * 60);
  // a close beyond before 07:00 is not a trigger
  const pre = day(D, 100, { 400: { c: 102 } });
  assert.equal(G.triggers(G.m15(pre, D), L0).length, 0);
});

test('trade: stop below PDH − 0.25 x ATR, stop first, target, gap, time exit at 20:00', () => {
  const L = L0, stop = G.stopOf(1, L);
  assert.ok(near(stop, 100)); assert.ok(near(G.stopOf(-1, L), 100));
  // entry 101.5 at 07:15, flat until 20:00 at 102: time exit at the 19:55 close
  const a = day(D, 102, { 435: { o: 101.5 } }), k = G.entryIndex(a, D, D + 435 * 60);
  const x = G.trade(a, D, k, 1, stop);
  assert.equal(x.how, 'time'); assert.ok(near(x.R, 0.5 / 1.5)); assert.ok(near(x.net, x.R - 0.6 / 1.5));
  assert.equal(x.fin, 0); assert.ok(near(x.net2, x.R - 1.2 / 1.5));
  // stop and target in one candle: a stop
  const b = day(D, 101.5, { 500: { h: 110, l: 90 } });
  assert.equal(G.trade(b, D, k, 1, stop, 1.5).how, 'stop');
  // target 1.5R
  const c = day(D, 101.5, { 500: { h: 103.8 } }), y = G.trade(c, D, k, 1, stop, 1.5);
  assert.equal(y.how, 'target'); assert.ok(near(y.R, 1.5));
  // a gap through the stop fills at the open
  const d = day(D, 101.5, { 500: { o: 98, h: 98.1, l: 97.9, c: 98 } }), z = G.trade(d, D, k, 1, stop);
  assert.equal(z.how, 'stop'); assert.equal(z.exit, 98);
  // entry past the stop: no trade
  assert.equal(G.trade(day(D, 99.5), D, k, 1, stop).skip, 'stopside');
  // no entry at or after 20:00
  assert.equal(G.entryIndex(a, D, D + 20 * 3600), null);
});

test('no look-ahead: candles after the exit or after 20:00 change nothing', () => {
  const a = day(D, 102, { 435: { o: 101.5 } }), k = G.entryIndex(a, D, D + 435 * 60), x = G.trade(a, D, k, 1, 100);
  const b = day(D, 102, { 435: { o: 101.5 }, 1200: { o: 1, h: 900, l: 1, c: 1 }, 1300: { o: 1, h: 900, l: 1, c: 1 } });
  assert.deepEqual(G.trade(b, D, k, 1, 100), x);
  const s = day(D, 101.5, { 500: { l: 99 } }), y = G.trade(s, D, k, 1, 100);
  const s2 = day(D, 101.5, { 500: { l: 99 }, 600: { h: 500 } });
  assert.deepEqual(G.trade(s2, D, k, 1, 100), y);
});

test('runTest: one position at a time; T3 only on the 20-day average side', () => {
  const bars = day(D, 100, { 430: { c: 101.4 }, 435: { o: 101.4 }, 610: { c: 98 }, 615: { o: 98 } });
  const d = { D, day: '2021-03-03', bars, q: G.m15(bars, D), L: L0 };
  const { tr, f } = G.runTest([d], 'T1');
  assert.equal(f.triggers, 2);
  assert.equal(tr.length, 2);   // the buy is stopped (price back at 100) before the sell's entry
  assert.ok(tr[0].side === 1 && tr[0].how === 'stop');
  const busy = { ...d, L: { ...L0, pdl: 100.05 } };   // the buy stop at 100 is below the sell trigger level: still open
  const bars2 = day(D, 101.2, { 430: { c: 101.4 }, 610: { c: 100.0 } });
  const r2 = G.runTest([{ ...busy, bars: bars2, q: G.m15(bars2, D) }], 'T1');
  assert.equal(r2.tr.length, 1); assert.equal(r2.f.busy, 1);
  const r3 = G.runTest([d], 'T3');   // close 100 > SMA 99: buys only
  assert.equal(r3.tr.length, 1); assert.equal(r3.tr[0].side, 1); assert.equal(r3.f.trend, 1);
});

test('statistics: every month counted, Holm', () => {
  const tr = [{ day: '2021-01-05', net: 1 }, { day: '2021-03-05', net: 2 }];
  const m = G.monthT(tr, ['2021-01-01', '2021-03-31']);
  assert.equal(m.months, 3);   // February counted as 0
  assert.ok(near(m.t, 1 / (1 / Math.sqrt(3))));   // sums 1, 0, 2: mean 1, sd 1
  G.holm([0.01, 0.04, 0.03]).forEach((v, i) => assert.ok(near(v, [0.03, 0.06, 0.06][i])));
});

test('report: RESULT.md is report(result.json), verdict reason inside the bold line, plan hash', () => {
  assert.equal(G.report(R), MD);
  assert.ok(MD.includes(`**Verdict: ${R.verdict}**`));
  assert.ok(R.verdict.length < 220);
  assert.match(R.verdict, /^(PASS|FAIL), \d of 3: /);
  const pass = Object.values(R.decision).some((d) => d.pass);
  assert.equal(R.verdict.startsWith('PASS'), pass);
  for (const [k, d] of Object.entries(R.decision)) {
    const o = R.tests[k].OOS;
    assert.equal(d.checks.netPos, o.netR > 0); assert.equal(d.checks.n30, o.n >= 30);
    assert.equal(d.beat, R.tests[k].placebo.means.filter((x) => o.netR > x).length);
    assert.equal(R.tests[k].placebo.means.length, 40);
  }
  const sha = crypto.createHash('sha256').update(fs.readFileSync(new URL('PREREGISTRATION.md', DIR))).digest('hex');
  assert.equal(R.planSha256, sha);
});
