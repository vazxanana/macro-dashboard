// research/edge/gold-pre-holiday-replicate: the frozen gold-pre-holiday T1 / T2 on XAU/EUR and HistData XAU/USD. Offline:
// hand-made candles for the loaders and the rule, the committed result.json for the report.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as R from '../research/edge/gold-pre-holiday-replicate/run.mjs';
import * as O from '../research/edge/gold-pre-holiday-replicate/original.mjs';
import { headlineOf, classify } from '../research/edge/verdict.mjs';

const DIR = new URL('../research/edge/gold-pre-holiday-replicate/', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, DIR));
const RES = JSON.parse(read('result.json'));
const MD = read('RESULT.md').toString();
const H = 3600;

test('the rule is the original, byte for byte, and the plan is the one pushed first', () => {
  assert.equal(crypto.createHash('sha256').update(read('original.mjs')).digest('hex'), R.ORIG_SHA);
  assert.equal(RES.originalSha256, R.ORIG_SHA);
  assert.equal(RES.planSha256, crypto.createHash('sha256').update(read('PREREGISTRATION.md')).digest('hex'));
  assert.equal(O.COST, 0.6); assert.equal(O.STOP_ATR, 1.0); assert.equal(O.ATR_N, 14);
  const src = read('run.mjs').toString();
  assert.match(src, /import \{ histStampUtc \} from '..\/..\/..\/council\/histdata.mjs'/);
  assert.doesNotMatch(src, /function (trade|eventDays|holidays|buildDays|atrBefore)\b/, 'no rule function is re-written here');
});

test('loaders: HistData labels through the shared clock, H1 on UTC hour boundaries', () => {
  const txt = ['20240711 083000;2400;2401;2399;2400.5;0', '20240711 083100;2400.5;2403;2400;2402;0', '20240711 083100;9;9;9;9;0',
    '20240711 085900;2402;2402;2390;2391;0', '20240711 090000;2391;2392;2391;2392;0', ''].join('\n');
  const m1 = R.parseHist(txt);
  assert.equal(m1.length, 4, 'the repeated minute is dropped');
  assert.equal(new Date(m1[0][0] * 1000).toISOString(), '2024-07-11T12:30:00.000Z');
  const h1 = R.toH1(m1);
  assert.equal(h1.length, 2);
  assert.deepEqual(h1[0], [Date.UTC(2024, 6, 11, 12) / 1000, 2400, 2403, 2390, 2391]);
  assert.equal(h1[1][0], Date.UTC(2024, 6, 11, 13) / 1000);
});

// weekdays of H1 candles 22:00 UTC (17:00/18:00 New York reopen) through the day; price set per day
function weeks(fromYmd, nDays, priceOf) {
  const out = []; let t = Date.parse(fromYmd + 'T00:00:00Z') / 1000;
  for (let k = 0; k < nDays; k++, t += 86400) { const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    for (let h = 0; h < 24; h++) { const tt = t + h * H, p = priceOf(tt); out.push([tt, p, p + 0.5, p - 0.5, p]); } }
  return out;
}

test('the rule on hand-made candles: a rise on the last day before a holiday is booked; no look-ahead past it', () => {
  // flat at 100 with 1-wide candles; on the day before 4 July 2024 (Wednesday 3 July, ends 17:00 New York) price climbs
  const day3 = Date.parse('2024-07-02T21:00:00Z') / 1000, end3 = Date.parse('2024-07-03T21:00:00Z') / 1000;
  const priceOf = (t) => (t >= day3 && t < end3 ? 100 + (t - day3) / H * 0.1 : t >= end3 ? 200 : 100);
  const rows = weeks('2024-05-01', 70, priceOf);
  const S = R.events(rows, 'R2', { lastDay: '2024-07-10' });
  const ev = S.ev.T1.find((e) => e.date === '2024-07-04');
  assert.ok(ev, 'Independence Day event found');
  assert.equal(ev.day, '2024-07-03');
  assert.ok(ev.gross > 0 && ev.exit < 150, 'exit at that day\'s close, never the later jump to 200');
  assert.ok(Math.abs(ev.costR - 0.6 / ev.atr) < 1e-9, 'R2 pays the original $0.60');
  const S1 = R.events(rows, 'R1', { lastDay: '2024-07-10' }), e1 = S1.ev.T1.find((e) => e.date === '2024-07-04');
  assert.ok(Math.abs(e1.costR - R.EUR_COST_PCT * e1.entry / e1.atr) < 1e-9, 'R1 pays 0.016 % of the entry');
});

test('versus: correlation and sign agreement matched by holiday date', () => {
  const a = [{ date: 'x', net: 1, entry: 100, exit: 101 }, { date: 'y', net: -1, entry: 100, exit: 99 }, { date: 'z', net: 2, entry: 100, exit: 102 }];
  const v = R.versus(a, a.map((r) => ({ ...r })));
  assert.equal(v.n, 3); assert.equal(v.corrNet, 1); assert.equal(v.sameSign, 100);
});

test('R3: the forward list is the calendar\'s, ten holidays, nothing computed', () => {
  assert.deepEqual(R.forwardHolidays(), R.FORWARD);
  assert.equal(R.FORWARD.length, 10);
  assert.deepEqual(RES.forward.holidays, R.FORWARD);
  for (const [, d] of R.FORWARD) assert.ok(MD.includes(d) && read('PREREGISTRATION.md').toString().includes(d));
  assert.match(MD, /mean net R over the ten is above 0/);
});

test('the bar and the report agree with result.json', () => {
  const T = RES.tests;
  assert.deepEqual(Object.keys(T), ['R1-T1', 'R1-T2', 'R2-T1', 'R2-T2']);
  const ps = Object.values(T).map((r) => O.pOne(r.whole.netT, r.whole.n - 1)), adj = O.holm(ps);
  Object.values(T).forEach((r, j) => {
    assert.ok(Math.abs(r.pHolm - adj[j]) < 2e-4);
    const pass = r.whole.netT >= 2 && r.pHolm < 0.05 && Object.values(r.halves).every((h) => h.netR > 0) && r.whole.net2x > 0 && r.placebo.beat >= 38;
    assert.equal(r.pass, pass);
    assert.ok(MD.includes(`| ${Object.keys(T)[j]} | whole | ${r.whole.n} |`));
  });
  assert.equal(RES.verdict, Object.values(T).some((r) => r.pass) ? 'PASS' : 'FAIL');
  const head = headlineOf(MD);
  assert.ok(head.length <= 220);
  assert.equal(classify(head), RES.verdict.toLowerCase());
  assert.match(MD, /cannot be independent/);
});
