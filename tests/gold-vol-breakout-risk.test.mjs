// research/edge/gold-vol-breakout-risk: a descriptive risk profile of the gold-vol-breakout T1 rule. Offline: the rule's code
// is the replicate study's (verbatim copies, sha256 pinned), the risk pieces are checked on hand-made data, the rule on
// hand-made candles (no look-ahead), and RESULT.md against result.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as R from '../research/edge/gold-vol-breakout-risk/run.mjs';
import * as O from '../research/edge/gold-vol-breakout-risk/original.mjs';
import { placeboIn, tradesIn } from '../research/edge/gold-vol-breakout-risk/replicate.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/gold-vol-breakout-risk');
const read = (f) => fs.readFileSync(path.join(DIR, f));
const sha = (f) => crypto.createHash('sha256').update(read(f)).digest('hex');
const RES = JSON.parse(read('result.json'));

// hand-made M5 candles: n weekdays from Mon 2024-01-01, 288 candles a day, a seeded random walk
function rowsOf(nDays = 30, seed = 7) {
  const rnd = R.mulberry32(seed), rows = []; let px = 2000;
  for (let d = 0, t0 = Date.UTC(2024, 0, 1) / 1000; rows.length < nDays * 288; t0 += 86400) {
    const wd = new Date(t0 * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    for (let i = 0; i < 288; i++) { const o = px, c = o + (rnd() - 0.5) * 4; rows.push([t0 + i * 300, o, Math.max(o, c) + rnd(), Math.min(o, c) - rnd(), c]); px = c; }
    d++;
  }
  return rows;
}

test('the rule is the replicate study\'s, copied verbatim', () => {
  assert.equal(sha('original.mjs'), R.ORIG_SHA);
  assert.equal(sha('replicate.mjs'), R.REPL_SHA);
  assert.equal(RES.copies['original.mjs'], R.ORIG_SHA);
  assert.equal(RES.planSha256, sha('PREREGISTRATION.md'));
  const src = read('run.mjs').toString();
  assert.match(src, /from '\.\/original\.mjs'/); assert.match(src, /from '\.\/replicate\.mjs'/);
  assert.ok(!/function vbTrade|function buildDays/.test(src), 'the rule is imported, not re-implemented');
});

test('harness gate reproduced the replicate study exactly', () => {
  assert.equal(RES.gate.ok, true);
  for (const k of ['main', 'pooled']) assert.deepEqual(RES.gate[k].got, R.GATE[k].want);
  assert.equal(RES.dataEnd, '2026-11-12');
});

test('no look-ahead: a day\'s range and trade use only the previous day and the day\'s own candles to 21:00', () => {
  const rows = rowsOf(12), days = O.buildDays(rows);
  const rows2 = rows.map((r) => [...r]);
  const d5 = days[5].d0;
  for (const r of rows2) if (r[0] >= d5 && r[0] < d5 + 86400 && r[0] - d5 >= 21 * 3600) { r[2] += 50; r[3] -= 50; }   // day 5 after 21:00
  for (const r of rows2) if (r[0] >= days[6].d0) { r[1] += 30; r[2] += 30; r[3] += 30; r[4] += 30; }                  // every later day
  const days2 = O.buildDays(rows2);
  assert.equal(days2[5].prevRange, days[5].prevRange);
  assert.deepEqual(O.vbTrade(days2[5].bars, { k: 0.5, prevRange: days2[5].prevRange }), O.vbTrade(days[5].bars, { k: 0.5, prevRange: days[5].prevRange }));
  assert.notEqual(days2[6].prevRange, days[6].prevRange, 'the next day does see day 5\'s full range');
});

test('every trade has its stop at the open, on the losing side', () => {
  const days = O.buildDays(rowsOf(30)), { tr } = tradesIn(days, ['2024-01-01', '2024-12-31']);
  assert.ok(tr.length > 5);
  for (const x of tr) { assert.equal(x.stop, x.open); assert.ok(x.side * (x.entry - x.stop) > 0); }
});

test('daily series, drawdown, streak', () => {
  const days = ['a', 'b', 'c', 'd', 'e'].map((k, i) => ({ day: `2024-01-0${i + 1}` }));
  const s = R.dailySeries(days, [{ day: '2024-01-02', net: 2 }, { day: '2024-01-04', net: -3 }], ['2024-01-01', '2024-01-05']);
  assert.deepEqual(s.v, [0, 2, 0, -3, 0]);
  const v = [1, 2, -1, -2, 1, 3, -1], d = R.drawdown(v, v.map((_, i) => 'k' + i));
  assert.equal(d.dd, 3); assert.equal(d.ddFrom, 'k1'); assert.equal(d.ddLow, 'k3'); assert.equal(d.ddRecovered, 'k5');
  assert.equal(d.under, 3); assert.equal(d.underFrom, 'k1'); assert.equal(d.underTo, 'k5');
  const e = R.drawdown([1, -1, -1, 0, 0]);
  assert.equal(e.dd, 2); assert.equal(e.ddRecovered, null); assert.equal(e.underOpenAtEnd, true); assert.equal(e.under, 4);
  assert.equal(R.losingStreak([{ net: -1 }, { net: -1 }, { net: 1 }, { net: -1 }, { net: -1 }, { net: -1 }]), 3);
});

test('bootstrap and stop lines: deterministic, the as-measured lines cross 5 %, a worse world crosses more', () => {
  const rnd = R.mulberry32(3), months = Array.from({ length: 60 }, () => Array.from({ length: 21 }, () => (rnd() < 0.45 ? 1 : -0.9)));
  const a = R.simulate(months, R.HORIZONS, 4000, 9), b = R.simulate(months, R.HORIZONS, 4000, 9);
  assert.deepEqual(Array.from(a.cum[36]), Array.from(b.cum[36]));
  const L = R.stopLines(a), x = R.crossing(a, L);
  for (const k of ['S1', 'S2', 'S3', 'S4']) assert.ok(Math.abs(x[k] - 0.05) < 0.002, `${k} ${x[k]}`);
  const worse = R.simulate(months.map((m) => m.map((v) => v - 0.1)), R.HORIZONS, 4000, 9), y = R.crossing(worse, L);
  for (const k of ['S1', 'S2', 'S3', 'S4', 'any']) assert.ok(y[k] > x[k]);
  assert.equal(R.quant([1, 2, 3, 4], 0.5), 3);
});

test('trades for t >= 2, correlation, gold returns', () => {
  assert.equal(R.needForT2(0.1, 1), 400); assert.equal(R.needForT2(-0.1, 1), null);
  assert.ok(Math.abs(R.pearson([1, 2, 3], [2, 4, 6]) - 1) < 1e-12); assert.ok(Math.abs(R.pearson([1, 2, 3], [3, 2, 1]) + 1) < 1e-12);
  const rows = rowsOf(5), days = O.buildDays(rows), { ret } = R.goldReturns(rows, days);
  const closeOf = (d0) => rows.filter((r) => r[0] >= d0 && r[0] < d0 + 86400).at(-1)[4];
  assert.ok(Math.abs(ret.get(days[2].day) - (closeOf(days[2].d0) / closeOf(days[1].d0) - 1)) < 1e-12);
  assert.ok(!ret.has(days[0].day));
});

test('placeboRecords keeps the replicate placebo\'s draws exactly', () => {
  const days = O.buildDays(rowsOf(30)), { pool } = tradesIn(days, ['2024-01-01', '2024-12-31']);
  const want = placeboIn(pool, R.T1, 5), got = R.placeboRecords(pool, R.T1, 5).map((a) => Math.round(a.reduce((s, x) => s + x.net, 0) / a.length * 1000) / 1000);
  assert.deepEqual(got, want);
});

test('the profile runs end to end on hand-made candles', () => {
  const rows = rowsOf(40), days = O.buildDays(rows), P = R.profile(days, rows, { draws: 200, placebo: false });
  assert.equal(P.gate.ok, false, 'hand-made candles cannot pass the real gate');
  assert.ok(P.bands.worlds.none);
});

test('RESULT.md is the report of result.json, and its figures agree', () => {
  assert.equal(read('RESULT.md').toString(), R.report(RES));
  assert.equal(RES.verdict, R.verdictLine(RES)); assert.equal(RES.reading, R.reading(RES));
  const md = read('RESULT.md').toString(), v = md.match(/\*\*Verdict: (.+)\*\*/)[1];
  assert.ok(v.length < 220); assert.match(v, /^Descriptive risk profile, no test/); assert.ok(!/\b(pass|fail)/i.test(v));
  const c = RES.record.cost1, B = RES.bands;
  for (const r of RES.risk) { assert.ok(Math.abs(r.perYearPct - c.perYear * r.risk * 100) < 0.011); assert.ok(Math.abs(r.ddClosedPct - c.ddClosed * r.risk * 100) < 0.011); }
  assert.equal(B.lines.S2, B.worlds.measured.horizons[12].cum.p5); assert.equal(B.lines.S4, B.worlds.measured.horizons[36].cum.p5);
  assert.equal(B.lines.S1, B.worlds.measured.horizons[36].dd.p95);
  for (const k of ['S1', 'S2', 'S3', 'S4']) assert.ok(Math.abs(B.worlds.measured.crossing[k] - 0.05) <= 0.001);
  const P1 = RES.prove.cost1; assert.ok(Math.abs(P1.trades / (2 * P1.sd / P1.mean) ** 2 - 1) < 0.03); assert.equal(RES.prove.cost2.trades, null);
  assert.equal(RES.summary.all.n, RES.summary.IS.n + RES.summary.OOS.n);
  assert.equal(RES.placebo.beaten, RES.placebo.means.filter((m) => RES.summary.all.netR > m).length);
  assert.match(md, /## What a 12-month paper record could and could not show/);
  assert.ok(!/proposal\b.*\bwritten\b/.test(RES.reading));
});
