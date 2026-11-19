// node --test tests/gold-ny-open-overnight-fail.test.mjs — research/edge/gold-ny-open-overnight-fail (14 Nov 2026): the H1
// candle of the US cash open raiding gold's overnight range on hand-made candles (the New York session clock, the range, the
// fade / follow events, entries, stops, targets, gaps, costs), no look-ahead, the same-year baseline, the placebo, and the
// report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/gold-ny-open-overnight-fail/run.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'gold-ny-open-overnight-fail');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
// a winter session (New York = UTC-5) for Tuesday 2024-01-16: rows from 18:00 NY on the 15th to 16:00 NY on the 16th.
// Overnight flat 100 (high 101, low 99); the 09:00 candle and later hours are patched by NY hour of the 16th.
const T0 = Date.parse('2024-01-15T23:00:00Z') / 1000;        // 18:00 NY on Monday the 15th
const rows = (patch = {}, base = T0) => {
  const out = [];
  for (let i = 0; i < 23; i++) {
    const nyH = (18 + i) % 24, own = i >= 6;                 // i >= 6: hours of the session day itself
    const p = (own && patch[nyH]) || (own && nyH >= 9 ? [100, 100.2, 99.8, 100] : [100, 101, 99, 100]);
    out.push([base + i * 3600, ...p]);
  }
  return out;
};
const sess = (patch, base) => S.groupSessions(rows(patch, base)).find((s) => s.bars.some((b) => b.h === 9)).bars;
const fade = { kind: 'fade', target: true }, fadeNT = { kind: 'fade', target: false }, follow = { kind: 'follow', target: false };
const T = (patch, test = fade) => S.sessionTrade(sess(patch), test, 0);

test('the New York session clock: 18:00 NY starts the next session; daylight and winter', () => {
  assert.deepEqual(S.sessionOf(Date.parse('2024-01-15T23:00:00Z') / 1000), { sd: '2024-01-16', h: 18 });
  assert.deepEqual(S.sessionOf(Date.parse('2024-01-16T14:00:00Z') / 1000), { sd: '2024-01-16', h: 9 });
  assert.deepEqual(S.sessionOf(Date.parse('2024-07-16T13:00:00Z') / 1000), { sd: '2024-07-16', h: 9 }, 'daylight: 09:00 NY = 13:00 UTC');
  assert.deepEqual(S.sessionOf(Date.parse('2024-01-14T23:00:00Z') / 1000), { sd: '2024-01-15', h: 18 }, 'Sunday 18:00 opens Monday');
  const g = S.groupSessions(rows());
  assert.deepEqual(g.map((s) => s.day), ['2024-01-16']);
  const s = S.setupOf(g[0].bars);
  assert.equal(s.H, 101); assert.equal(s.L, 99); assert.equal(s.M, 100); assert.equal(s.c9.h, 9);
});

test('events: a raid that closes back inside is a fade, one that closes beyond is a follow; both ends or none is nothing', () => {
  const ev = (c9) => S.eventOf(S.setupOf(sess({ 9: c9 })));
  assert.deepEqual(ev([100.5, 101.5, 100.4, 100.8]), { kind: 'fade', side: -1 });
  assert.deepEqual(ev([99.5, 99.6, 98.5, 99.2]), { kind: 'fade', side: 1 });
  assert.deepEqual(ev([100.5, 101.6, 100.4, 101.4]), { kind: 'follow', side: 1 });
  assert.deepEqual(ev([99.5, 99.6, 98.4, 98.6]), { kind: 'follow', side: -1 });
  assert.equal(ev([100, 101.5, 98.5, 100]), null, 'both ends');
  assert.equal(ev([100, 100.5, 99.5, 100]), null, 'inside');
  assert.equal(ev([100.5, 101, 100.4, 100.8]), null, 'a touch of the high is not a raid');
});

test('T1: sell at the 10:00 open, stop $0.30 over the raid high, target the middle; a buy mirrors it', () => {
  const x = T({ 9: [100.5, 101.5, 100.4, 100.8], 10: [100.7, 100.8, 100.3, 100.4], 11: [100.4, 100.5, 99.9, 100.1] });
  assert.equal(x.side, -1); assert.equal(x.entry, 100.7); assert.equal(x.stop, 101.8); assert.ok(Math.abs(x.r - 1.1) < 1e-9);
  assert.equal(x.target, 100); assert.equal(x.how, 'target'); assert.ok(Math.abs(x.R - 0.7 / 1.1) < 1e-9); assert.equal(x.fin, 0);
  const b = T({ 9: [99.5, 99.6, 98.5, 99.2], 10: [99.3, 100.1, 99.2, 100] });
  assert.equal(b.side, 1); assert.equal(b.stop, 98.2); assert.equal(b.how, 'target'); assert.ok(Math.abs(b.R - 0.7 / 1.1) < 1e-9);
  // the entry already past the middle: no T1 trade, T2 trades it
  const p = { 9: [100.5, 101.5, 99.4, 99.8], 10: [99.8, 99.9, 99.7, 99.8] };
  assert.equal(T(p).skip, 'pastmid');
  assert.equal(T(p, fadeNT).how, 'time');
});

test('stops, gaps, time exit at 16:00 NY, follow side, costs', () => {
  const st = T({ 9: [100.5, 101.5, 100.4, 100.8], 10: [100.7, 101.9, 100.3, 100.4] });
  assert.equal(st.how, 'stop'); assert.equal(st.R, -1, 'stop before target in one candle');
  const gp = T({ 9: [100.5, 101.5, 100.4, 100.8], 10: [100.7, 100.8, 100.3, 100.4], 11: [102.5, 102.6, 102.4, 102.5] });
  assert.equal(gp.how, 'stop'); assert.equal(gp.exit, 102.5, 'a gap through the stop fills at the open'); assert.ok(gp.R < -1);
  const tm = T({ 9: [100.5, 101.5, 100.4, 100.8], 10: [100.7, 100.8, 100.3, 100.4], 15: [100.4, 100.5, 100.3, 100.35] }, fadeNT);
  assert.equal(tm.how, 'time'); assert.equal(tm.exit, 100.35, 'out at the 15:00 candle close = 16:00 NY');
  const late = T({ 9: [100.5, 101.5, 100.4, 100.8], 16: [100, 200, 0, 50] }, fadeNT);
  assert.equal(late.how, 'time', 'the 16:00 candle is not read');
  const f = T({ 9: [100.5, 101.6, 100.4, 101.4], 10: [101.4, 101.5, 101.3, 101.4] }, follow);
  assert.equal(f.side, 1); assert.ok(Math.abs(f.stop - 100.1) < 1e-9); assert.equal(f.target, null);
  const c = S.sessionTrade(sess({ 9: [100.5, 101.5, 100.4, 100.8], 10: [100.7, 100.8, 100.3, 100.4] }), fade);
  assert.ok(Math.abs(c.net - (c.R - 0.6 / c.r)) < 1e-12); assert.ok(Math.abs(c.net2 - (c.R - 1.2 / c.r)) < 1e-12);
  assert.equal(S.sessionTrade(sess({}).filter((b) => b.h !== 9), fade).skip, 'data');
});

test('no look-ahead: the setup reads only the overnight and the 09:00 candle; later hours change only the trade', () => {
  const a = S.setupOf(sess({ 9: [100.5, 101.5, 100.4, 100.8] }));
  const b = S.setupOf(sess({ 9: [100.5, 101.5, 100.4, 100.8], 10: [100, 500, 1, 2], 14: [0, 999, 0, 1] }));
  assert.deepEqual(a, b);
  assert.deepEqual(S.eventOf(a), S.eventOf(b));
});

test('same-year baseline, placebo trade and statistics', () => {
  const s = S.sameSideTrade(sess({}), { side: 1, r: 1, tdist: null }, 0);
  assert.equal(s.R, 0, 'flat after 10:00: out at 16:00 at the entry');
  assert.equal(S.sameSideTrade(sess({}).filter((b) => b.h !== 10), { side: 1, r: 1, tdist: null }), null);
  const days = S.groupSessions(rows({ 9: [100.5, 101.5, 100.4, 100.8], 10: [100.7, 100.8, 100.3, 100.4] }));
  const yrs = S.byYear(days);
  const { tr } = S.runTest(days, { kind: 'fade', target: true }, yrs);
  assert.equal(tr.length, 1); assert.ok(Math.abs(tr[0].lift - (tr[0].net - tr[0].base)) < 1e-12);
  const m = S.monthT([{ day: '2021-01-04', net: 1 }, { day: '2021-01-05', net: 1 }, { day: '2021-02-01', net: 3 }, { day: '2021-03-01', net: 2 }]);
  assert.equal(m.months, 3); assert.ok(Math.abs(m.t - 7) < 1e-9);
  S.holm([0.01, 0.04, 0.03]).forEach((v, i) => assert.ok(Math.abs(v - [0.03, 0.06, 0.06][i]) < 1e-12));
  assert.equal(S.rng(7)(), S.rng(7)());
});

test('the report is run.mjs\'s function of result.json; pre-registration hash, verdict line, decision', () => {
  const R = JSON.parse(read('result.json'));
  assert.equal(read('RESULT.md'), S.report(R));
  assert.equal(R.planSha256, crypto.createHash('sha256').update(read('PREREGISTRATION.md')).digest('hex'));
  assert.equal(R.verdict, S.verdictLine(R.tests, R.decision));
  assert.ok(R.verdict.length < 220);
  const pl = Object.fromEntries(['T1', 'T2', 'T3'].map((k) => [k, R.placebo[k].means]));
  assert.deepEqual(S.decide(R.tests, pl), R.decision);
  for (const k of ['T1', 'T2', 'T3']) assert.equal(R.placebo[k].means.length, 40);
  assert.equal(R.fin.charged, 0);
  const v = studyVerdict(R, read('RESULT.md'));
  assert.equal(v.verdict, R.decision.T1.pass ? 'pass' : 'fail');
  assert.ok(v.headline.length <= 221);
});

test('stand-alone: only council/fills.mjs imported, windows as pre-registered, not a rule of the gold book', () => {
  const src = read('run.mjs');
  assert.deepEqual([...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]).filter((p) => p.startsWith('.')), ['../../../council/fills.mjs']);
  assert.deepEqual(S.WINDOWS.IS, ['2007-01-01', '2016-12-31']); assert.deepEqual(S.WINDOWS.OOS, ['2017-01-01', '2026-10-31']);
  assert.equal(S.COST, 0.6); assert.equal(S.BUF, 0.3);
  assert.match(read('PREREGISTRATION.md'), /never a gate, exit, entry or size of the live gold book/);
});
