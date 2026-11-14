// tokyo-fix-daily: the frozen rule is gotobi-timing's frozen.mjs byte for byte, tradeM1 is gotobi-timing's unchanged, the fix
// minute, Welch t, the placebo marks and the reading rule do what the pre-registration says on hand-made inputs, and RESULT.md
// says what result.json holds. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as F from '../research/edge/tokyo-fix-daily/frozen.mjs';
import * as R from '../research/edge/tokyo-fix-daily/run.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/tokyo-fix-daily');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const FROZEN_SHA = '645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32';
const TRADE_M1_SHA = '2cc304668015e7d4768e8d6b155b611a9e47e45175d5bf83284c60263a446295';   // gotobi-timing's tradeM1 text
const res = JSON.parse(read('result.json'));

test('tokyo-fix-daily: frozen.mjs is gotobi-timing\'s byte for byte, tradeM1 is its text unchanged', () => {
  assert.equal(sha(fs.readFileSync(path.join(DIR, 'frozen.mjs'))), FROZEN_SHA);
  assert.match(read('PREREGISTRATION.md'), new RegExp(FROZEN_SHA));
  assert.equal(res.frozen.sha256, FROZEN_SHA);
  const src = read('run.mjs'), i = src.indexOf('export function tradeM1'), j = src.indexOf('\n}\n', i);
  assert.equal(sha(src.slice(i, j + 2)), TRADE_M1_SHA);
  const code = src.replace(/\/\/[^\n]*/g, '');
  assert.match(src, /import \* as F from '\.\/frozen\.mjs'/);
  for (const fn of ['trade', 'stopDist', 'windowMove', 'costPx', 'gotobiSet', 'jpHolidays', 'tseHolidays', 'monthT', 'summary', 'holm', 'mulberry32'])
    assert.doesNotMatch(code, new RegExp(`(function\\s+${fn}\\b|(const|let)\\s+${fn}\\s*=)`), `run.mjs defines ${fn}`);
  for (const k of ['22.5e-6', 'STOP_K =', 'LOOKBACK =']) assert.doesNotMatch(code, new RegExp(`(^|[^.\\w])${k}`, 'm'));
  assert.deepEqual([R.ENTRY, R.EXIT], [55, 360]);
  assert.deepEqual([R.DECISIVE, R.REPLICATION], [['2016-01-01', '2026-11-11'], ['2010-01-01', '2015-12-31']]);
  assert.deepEqual([R.SEEDS, R.P_RANK, R.T_BAR, R.T1_WEAK, R.ALPHA], [40, 38, 2, 1, 0.05]);
});

// hand-made M1 candles for one day: open of minute m is base + f(m)
function day(ymd, f) {
  const day0 = Date.parse(ymd + 'T00:00:00Z') / 1000, out = [];
  for (let m = 0; m < 375; m++) { const o = 150 + f(m), c = 150 + f(m + 1); out.push([day0 + m * 60, o, Math.max(o, c), Math.min(o, c), c]); }
  return out;
}

test('tokyo-fix-daily: the fix minute is open 00:55 minus open 00:54, in pips; a hole gives null', () => {
  const bars = day('2016-03-08', (m) => (m >= 55 ? 0.05 : 0) + (m >= 56 ? -0.03 : 0)), ix = F.index(bars);
  assert.ok(Math.abs(R.minuteMove(ix, '2016-03-08', 55) - 5) < 1e-9);
  assert.ok(Math.abs(R.minuteMove(ix, '2016-03-08', 56) + 3) < 1e-9);
  assert.ok(Math.abs(R.minuteMove(ix, '2016-03-08', 30)) < 1e-9);
  const hole = bars.filter((b) => b[0] !== Date.parse('2016-03-08T00:54:00Z') / 1000);
  assert.equal(R.minuteMove(F.index(hole), '2016-03-08', 55), null);
});

test('tokyo-fix-daily: Welch t, month means, placebo marks and the business-day list', () => {
  const w = R.welch([1, 2, 3, 4], [0, 0, 1, 1]);
  // means 2.5 and 0.5, variances 5/3 and 1/3: se = sqrt(5/12 + 1/12) = sqrt(0.5)
  assert.ok(Math.abs(w.diff - 2) < 1e-12); assert.ok(Math.abs(w.t - 2 / Math.sqrt(0.5)) < 1e-12);
  assert.deepEqual(R.welch([1], [1, 2]), { diff: null, t: null });
  assert.deepEqual(R.monthMeans([{ day: '2016-01-04', net: 1 }, { day: '2016-01-05', net: -2 }, { day: '2016-02-01', net: 3 }]), [-0.5, 3]);
  assert.equal(R.MARKS.length, 57);
  for (const e of [50, 55, 60]) assert.ok(!R.MARKS.includes(e));
  assert.deepEqual([R.MARKS[0], R.MARKS.at(-1)], [5, 300]);
  const days = R.businessDays('2016-01-01', '2016-01-12');
  assert.deepEqual(days, ['2016-01-04', '2016-01-05', '2016-01-06', '2016-01-07', '2016-01-08', '2016-01-12']);   // 11 Jan Coming of Age Day
  const G = R.gotobi();
  assert.ok(G.has('2016-01-05') && G.has('2016-01-08') && !G.has('2016-01-07'));   // the 10th (Sunday) rolls back to Friday the 8th
});

test('tokyo-fix-daily: the pre-registered reading', () => {
  const t2ok = { t: 2.5, holmP: 0.02 }, t2no = { t: 1.5, holmP: 0.1 };
  assert.equal(R.reading({ netR: -0.06, t: -2.4, holmP: 1 }, t2ok), 'GOTOBI-SPECIFIC');
  assert.equal(R.reading({ netR: 0.02, t: 0.8, holmP: 0.4 }, t2ok), 'GOTOBI-SPECIFIC');
  assert.equal(R.reading({ netR: 0.02, t: 1.2, holmP: 0.2 }, t2ok), 'UNCLEAR');
  assert.equal(R.reading({ netR: -0.06, t: -2.4, holmP: 1 }, t2no), 'UNCLEAR');
  assert.equal(R.reading({ netR: -0.06, t: -2.4, holmP: 1 }, { t: 2.1, holmP: 0.06 }), 'UNCLEAR');
  assert.equal(R.reading({ netR: 0.08, t: 2.6, holmP: 0.01 }, t2no), 'EVERY-DAY');
  assert.equal(R.reading({ netR: 0.08, t: 2.6, holmP: 0.01 }, t2ok), 'EVERY-DAY');
  const pre = read('PREREGISTRATION.md');
  for (const s of ['**GOTOBI-SPECIFIC** if T1 is ≤ 0 net, or its month t < 1', '**EVERY-DAY** if T1 is positive with month t ≥ 2', '**UNCLEAR** otherwise', 'Holm** over T1 and T2', '00:00, 00:05, ..., 04:55 UTC', 'within 8 of 771', 'within\n0.010R of +0.1481'])
    assert.ok(pre.includes(s), s);
});

test('tokyo-fix-daily: result.json holds the gate, the reading follows from its numbers, RESULT.md says the same', () => {
  const g = res.gate;
  assert.equal(g.pass, true);
  assert.ok(Math.abs(g.n - 771) <= 8 && Math.abs(g.netR - 0.1481) <= 0.010);
  assert.equal(res.verdict, R.reading(res.T1, res.T2));
  assert.ok(['GOTOBI-SPECIFIC', 'EVERY-DAY', 'UNCLEAR'].includes(res.verdict));
  assert.equal(res.liveProposal, 'none');
  assert.equal(res.placebo.minute.values.length, 40); assert.equal(res.placebo.trade.values.length, 40);
  assert.equal(res.placebo.minute.p95, [...res.placebo.minute.values].sort((a, b) => a - b)[37]);
  const md = read('RESULT.md');
  assert.equal(md, R.report(res));
  assert.match(md, new RegExp(`^\\*\\*Verdict: ${res.verdict}\\.\\*\\*`, 'm'));
  assert.match(md, /no live proposal/i);
  assert.match(md, /Gate: PASSED/);
});
