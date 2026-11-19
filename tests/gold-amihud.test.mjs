// node --test tests/gold-amihud.test.mjs — research/edge/gold-amihud (14 Nov 2026): gold's own illiquidity (Amihud ratio,
// ranked against its previous 250 readings) and the next week, against the same side in every eligible week of the month.
// Hand-made daily candles (ratio, ILLIQ, rank, ATR, weeks, sides, stop / gap, costs and financing), no look-ahead, the baseline
// and placebo, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/gold-amihud/run.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'gold-amihud');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const T0 = Date.parse('2020-01-06T00:00:00Z') / 1000;   // a Monday
// n weekdays (weekends included as calendar days, then dropped by makeDays); f(i) gives [o, h, l, c, v] for weekday i
function rowsOf(n, f) {
  const out = []; let i = 0;
  for (let t = T0; i < n; t += 86400) {
    const w = new Date(t * 1000).getUTCDay();
    if (w === 0 || w === 6) { out.push([t, 100, 100, 100, 100, 5]); continue; }   // weekend stubs must be ignored
    out.push([t, ...f(i)]); i++;
  }
  return out;
}
// alternating closes 100 / 101 with volume 1000: |ln(101/100)| / 1000 every day; a quiet spell after day k makes later ILLIQ low
const alt = (i) => { const c = i % 2 ? 101 : 100; return [c, c + 0.5, c - 0.5, c, 1000]; };

test('ratio, ILLIQ over 20 weekdays, ATR; weekends dropped; nothing before enough history', () => {
  const ds = S.makeDays(rowsOf(300, alt));
  assert.equal(ds.length, 300); assert.ok(ds.every((d) => { const w = new Date(d.t * 1000).getUTCDay(); return w >= 1 && w <= 5; }));
  assert.equal(ds[0].a, null); assert.ok(Math.abs(ds[1].a - Math.log(1.01) / 1000) < 1e-15);
  assert.equal(ds[19].illiq, null, 'day 0 has no ratio, so the first full window ends at day 20');
  assert.ok(Math.abs(ds[20].illiq - Math.log(1.01) / 1000) < 1e-12);
  assert.equal(ds[269].rank, null); assert.equal(ds[270].rank, 0, 'equal readings: none below');
  assert.ok(Math.abs(ds[25].atr - 1.5) < 1e-9);
});

test('rank: a burst of illiquidity ranks at the top, a quiet spell at the bottom', () => {
  const burst = (i) => (i >= 290 ? [100, 106, 94, i % 2 ? 105 : 95, 1000] : alt(i));
  const ds = S.makeDays(rowsOf(300, burst));
  assert.equal(ds.at(-1).rank, 1);
  const quiet = (i) => (i >= 290 ? [100, 100.5, 99.5, 100, 1000] : alt(i));
  assert.equal(S.makeDays(rowsOf(300, quiet)).at(-1).rank, 0);
});

test('weeks: signal at the week\'s last weekday, trade over the next week; the tests pick sides as pre-registered', () => {
  const ds = S.makeDays(rowsOf(300, alt)), wk = S.makeWeeks(ds);
  const w = wk.at(-1); assert.equal(w.days.length, 5); assert.equal(new Date(w.days[0].t * 1000).getUTCDay(), 1);
  assert.equal(w.sig.day, ds[ds.indexOf(w.days[0]) - 1].day, 'the signal is the day before the trade week opens');
  const sig = (rank, wkRet) => ({ rank, wkRet });
  assert.ok(S.TESTS.T1.ok(sig(0.7, 0.01))); assert.ok(!S.TESTS.T1.ok(sig(0.6, 0.01)));
  assert.ok(S.TESTS.T2.ok(sig(0.3, 0))); assert.ok(!S.TESTS.T2.ok(sig(0.4, 0)));
  assert.ok(S.TESTS.T3.ok(sig(0.9, -0.01))); assert.ok(!S.TESTS.T3.ok(sig(0.9, 0.01)));
  assert.equal(S.TESTS.T1.side, 1); assert.equal(S.TESTS.T2.side, -1); assert.equal(S.TESTS.T3.side, 1);
});

test('the trade: first open → last close, stop 2 x ATR, gap fills at the open, costs and financing on buys', () => {
  const day = (t, o, h, l, c) => ({ t, o, h, l, c });
  const t = Date.parse('2021-03-01T00:00:00Z') / 1000;
  const w = { day: '2021-03-01', sig: { atr: 1, rank: 0.9, wkRet: -0.01 }, days: [0, 1, 2, 3, 4].map((k) => day(t + k * 86400, 100, 100.5, 99.5, 100 + k * 0.2)) };
  const b = S.trade(w, 1);
  assert.equal(b.entry, 100); assert.equal(b.r, 2); assert.equal(b.stop, 98); assert.equal(b.how, 'time');
  assert.ok(Math.abs(b.R - 0.4) < 1e-9);
  assert.equal(b.fin, 6 * 0.000148 * 100 / 2, 'Mon, Tue, Wed x3, Thu rollovers before Friday 21:00 UTC');
  assert.ok(Math.abs(b.net - (0.4 - 0.3 - b.fin)) < 1e-12); assert.ok(Math.abs(b.net2 - (0.4 - 0.6 - b.fin)) < 1e-12);
  assert.equal(S.trade(w, -1).fin, 0);
  const s = { ...w, days: [w.days[0], day(t + 86400, 99, 99.2, 97.5, 98)] };
  const x = S.trade(s, 1); assert.equal(x.how, 'stop'); assert.equal(x.exit, 98); assert.ok(Math.abs(x.R + 1) < 1e-9);
  const g = { ...w, days: [w.days[0], day(t + 86400, 97, 97.5, 96, 97)] };
  assert.equal(S.trade(g, 1).exit, 97, 'a gap through the stop fills at the open');
});

test('no look-ahead: the trade week and later days never change the signal', () => {
  const a = S.makeWeeks(S.makeDays(rowsOf(300, alt))).at(-1).sig;
  const wild = (i) => (i >= 295 ? [100, 150, 50, 140, 1] : alt(i));     // the last week (days 295-299) goes wild
  const b = S.makeWeeks(S.makeDays(rowsOf(300, wild))).at(-1).sig;
  assert.deepEqual(b, a);
});

test('same-side baseline of the month, excess, statistics and placebo seeds', () => {
  const ws = S.makeWeeks(S.makeDays(rowsOf(320, alt))).filter(S.eligible);
  const base = S.baselineByMonth(ws), m = ws.at(-1).day.slice(0, 7), same = ws.filter((w) => w.day.slice(0, 7) === m);
  const mb = same.reduce((s, w) => s + S.trade(w, 1).net, 0) / same.length;
  assert.ok(Math.abs(base.get(m + '|1') - mb) < 1e-12);
  const tr = S.runTest(ws, { side: 1, ok: () => true }, base);
  assert.equal(tr.length, ws.length); assert.ok(Math.abs(tr.filter((x) => x.day.slice(0, 7) === m).reduce((s, x) => s + x.excess, 0)) < 1e-9);
  const mt = S.monthT([{ day: '2021-01-04', net: 1 }, { day: '2021-01-11', net: 1 }, { day: '2021-02-01', net: 3 }, { day: '2021-03-01', net: 2 }]);
  assert.equal(mt.months, 3); assert.ok(Math.abs(mt.t - 7) < 1e-9);
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
  for (const k of ['T1', 'T2', 'T3']) { assert.equal(R.placebo[k].means.length, 40); assert.ok(R.tests[k].OOS.n >= 30); }
  const v = studyVerdict(R, read('RESULT.md'));
  assert.equal(v.verdict, R.decision.T1.pass ? 'pass' : 'fail');
  assert.ok(v.headline.length <= 221);
});

test('stand-alone: only the financing rule is imported, windows and costs as pre-registered, not a rule of the gold book', () => {
  const src = read('run.mjs');
  assert.deepEqual([...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]).filter((p) => p.startsWith('.')), ['../../../council/fills.mjs']);
  assert.deepEqual(S.WINDOWS.IS, ['2007-01-01', '2016-12-31']); assert.deepEqual(S.WINDOWS.OOS, ['2017-01-01', '2026-10-31']);
  assert.equal(S.COST, 0.6); assert.equal(S.STOP_K, 2); assert.equal(S.ILLIQ_N, 20); assert.equal(S.RANK_N, 250); assert.equal(S.ATR_N, 20);
  assert.match(read('PREREGISTRATION.md'), /not a gate, exit, entry or size of the live gold book/);
});
