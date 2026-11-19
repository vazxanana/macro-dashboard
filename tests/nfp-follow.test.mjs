// NFP follow or fade study (research/edge/nfp-follow): the release-date list, New York time across daylight-saving changes,
// the trade on hand-made candles (no look-ahead, stop first, gap through the stop, time exit, skips), and the committed
// result against the pre-registered bar and the written report. Offline: no candle file is read here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, MARKETS, blsDate, blsRuleDate, nfpDates, fridays, at, tradeDay, holm, mulberry32, sample, report, verdictOf } from '../research/edge/nfp-follow/run.mjs';
import { HISTORY, EVENTS } from '../council/events.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/nfp-follow/PREREGISTRATION.md'), RES = JSON.parse(rd('../research/edge/nfp-follow/result.json'));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16);

test('the constants are the pre-registered ones', () => {
  assert.deepEqual([P.TP_R, P.SKIP_K, P.ATR_N, P.MIN_STOP, P.OPEN, P.ENTRY, P.EXIT, P.SEEDS, P.BEAT, P.MIN_N, P.T_MIN, P.SPLIT, P.FROM],
    [1.5, 0.5, 20, 0.25, '08:30', '08:45', '11:00', 40, 38, 60, 2, '2020-01-01', '2010-01-01']);
  assert.deepEqual([MARKETS.xau.buf, MARKETS.xau.cost, MARKETS.nas100.buf, MARKETS.nas100.cost], [0.30, 0.30, 2.0, 2.0]);
  for (const s of ['Target** E + s x 1.5 x r0', 'range < 0.5 x (3 x ATR20)', 'r0 < 0.25 x range', '$0.30 gold', '2.0 points', 'at least 38 of the 40', 'n >= 60', 'item 44']) assert.ok(PRE.includes(s), s);
});

test('release dates: the BLS rule reproduces events.mjs from 2022 except the 2025 shutdown dates; the listed exceptions hold', () => {
  const ev = [...HISTORY, ...EVENTS].filter((e) => e.type === 'NFP').map((e) => e.local.slice(0, 10)), miss = [];
  for (const d of ev) { const [y, m] = d.split('-').map(Number), ref = m === 1 ? [y - 1, 12] : [y, m - 1]; if (blsDate(...ref) !== d) miss.push(d); }
  assert.deepEqual(miss, ['2025-11-20', '2025-12-16', '2026-02-11']);
  assert.equal(blsRuleDate(2013, 12), '2014-01-03'); assert.equal(blsDate(2013, 12), '2014-01-10');   // January rule
  assert.equal(blsDate(2012, 12), '2013-01-04');                                                       // the 4th stays
  assert.equal(blsDate(2015, 6), '2015-07-02'); assert.equal(blsDate(2014, 6), '2014-07-03'); assert.equal(blsDate(2021, 6), '2021-07-02');
  assert.equal(blsDate(2013, 9), '2013-10-22'); assert.equal(blsDate(2013, 10), '2013-11-08');
  const ds = nfpDates('2026-11-13'); assert.equal(ds.length, 202); assert.equal(new Set(ds).size, ds.length);
  assert.equal(ds[0], '2010-01-08'); assert.equal(ds.at(-1), '2026-11-06'); assert.ok(!ds.includes('2025-10-03'));
  assert.equal(RES.nfp, 202);
  const fr = fridays('2024-01-01', '2024-01-31'); assert.deepEqual(fr, ['2024-01-05', '2024-01-12', '2024-01-19', '2024-01-26']);
});

test('08:30 New York is 13:30 UTC in winter and 12:30 UTC in summer, switching with the US clocks', () => {
  assert.equal(iso(at('2024-03-08', '08:30')), '2024-03-08T13:30'); assert.equal(iso(at('2024-03-15', '08:30')), '2024-03-15T12:30');
  assert.equal(iso(at('2024-11-01', '08:30')), '2024-11-01T12:30'); assert.equal(iso(at('2024-11-08', '08:30')), '2024-11-08T13:30');
  assert.equal(iso(at('2010-03-12', '11:00')), '2010-03-12T16:00');
});

// a summer day (08:30 NY = 12:30 UTC): flat candles at 100 (range 0.2), then the release candles rise 100 -> 103
const D = '2024-06-07', T0 = at(D, '08:30');
function dayBars(after = (t, k) => [103, 103.1, 102.9, 103]) {
  const B = [];
  for (let t = Date.parse(D + 'T10:00:00Z') / 1000; t < Date.parse(D + 'T16:30:00Z') / 1000; t += 300) {
    let o, h, l, c; const k = (t - T0) / 300;
    if (k < 0) [o, h, l, c] = [100, 100.1, 99.9, 100];
    else if (k === 0) [o, h, l, c] = [100, 101.2, 99.8, 101];
    else if (k === 1) [o, h, l, c] = [101, 102.1, 100.9, 102];
    else if (k === 2) [o, h, l, c] = [102, 103.2, 101.9, 103];
    else [o, h, l, c] = after(t, k);
    B.push({ time: t, open: o, high: h, low: l, close: c });
  }
  return B;
}

test('follow: buys at 08:45 with the stop under the range, 1.5R target, time exit at the 10:55 close', () => {
  const { trade: x } = tradeDay(dayBars(), D, 'F', 'xau');
  assert.equal(x.side, 1); assert.equal(x.E, 103); assert.equal(x.stop, 99.5); assert.equal(x.r0, 3.5); assert.equal(x.target, 108.25);
  assert.equal(x.exit, 'time'); assert.equal(iso(x.exitAt), '2024-06-07T15:00'); assert.equal(x.gross, 0);
  assert.equal(x.net, +(-0.3 / 3.5).toFixed(4));
});

test('no look-ahead: candles after the exit, or after 11:00, change nothing; the decision uses candles up to 08:45 only', () => {
  const tX = at(D, '11:00'), base = tradeDay(dayBars(), D, 'F', 'xau').trade;
  const later = tradeDay(dayBars((t) => (t >= tX ? [50, 200, 1, 150] : [103, 103.1, 102.9, 103])), D, 'F', 'xau').trade;
  assert.deepEqual(later, base);
  // a crash after the entry changes the result, never the side, entry, stop or target
  const crash = tradeDay(dayBars((t, k) => (k >= 5 ? [90, 90, 89, 89.5] : [103, 103.1, 102.9, 103])), D, 'F', 'xau').trade;
  assert.deepEqual([crash.side, crash.E, crash.stop, crash.target], [base.side, base.E, base.stop, base.target]);
});

test('stop first when a candle holds both; a gap through the stop exits at the open; the target', () => {
  const both = tradeDay(dayBars((t, k) => (k === 4 ? [103, 109, 99, 104] : [103, 103.1, 102.9, 103])), D, 'F', 'xau').trade;
  assert.equal(both.exit, 'stop'); assert.equal(both.exitPx, 99.5); assert.equal(both.gross, -1);
  const gap = tradeDay(dayBars((t, k) => (k === 5 ? [98, 98.5, 97, 98] : [103, 103.1, 102.9, 103])), D, 'F', 'xau').trade;
  assert.equal(gap.exit, 'stop (gap)'); assert.equal(gap.exitPx, 98); assert.ok(gap.gross < -1);
  const tp = tradeDay(dayBars((t, k) => (k === 6 ? [103, 108.5, 102.9, 108] : [103, 103.1, 102.9, 103])), D, 'F', 'xau').trade;
  assert.equal(tp.exit, 'target'); assert.equal(tp.gross, 1.5);
});

test('fade: sells with the stop over the range, and a stop closer than a quarter of the range is skipped', () => {
  // the 08:45 open well back inside the range: the fade's stop (over 103.2) is far enough
  const b = dayBars((t, k) => (k === 3 ? [101.5, 101.6, 101.4, 101.5] : [101.5, 101.6, 101.4, 101.5]));
  const x = tradeDay(b, D, 'R', 'xau').trade;
  assert.equal(x.side, -1); assert.equal(x.stop, 103.5); assert.equal(x.r0, 2); assert.equal(x.target, 98.5);
  assert.equal(tradeDay(dayBars(), D, 'R', 'xau').skip, 'stop too close');   // entry 103, stop 103.5: 0.5 < 0.25 x 3.4
});

test('skips: a small range, a flat 15 minutes, a missing candle', () => {
  const small = dayBars().map((b) => ({ ...b, ...(b.time >= T0 && b.time < T0 + 900 ? { open: 100, high: 100.15, low: 99.95, close: 100.1 } : {}) }));
  assert.equal(tradeDay(small, D, 'F', 'xau').skip, 'small range');
  const flat = dayBars().map((b) => (b.time === T0 + 600 ? { ...b, close: 100 } : b));
  assert.equal(tradeDay(flat, D, 'F', 'xau').skip, 'flat');
  assert.equal(tradeDay(dayBars().filter((b) => b.time !== T0 + 300), D, 'F', 'xau').skip, 'no data');
  assert.equal(tradeDay(dayBars().filter((b) => b.time >= T0 - 600), D, 'F', 'xau').skip, 'no data');
});

test('statistics helpers: Holm, the seeded placebo draw, the pass bar', () => {
  assert.deepEqual(holm({ a: 0.01, b: 0.04, c: 0.03, d: 0.5 }), { a: 0.04, c: 0.09, b: 0.09, d: 0.5 });
  assert.deepEqual(sample([1, 2, 3, 4, 5, 6], 3, mulberry32(7)), sample([1, 2, 3, 4, 5, 6], 3, mulberry32(7)));
  const ok = { dec: { n: 70, avg: 0.2, t: 2.5 }, rep: { avg: 0.05 }, pHolm: 0.02, placebo: { beats: 39 } };
  assert.equal(verdictOf(ok).pass, true);
  for (const bad of [{ dec: { ...ok.dec, n: 59 } }, { rep: { avg: -0.01 } }, { placebo: { beats: 37 } }, { pHolm: 0.06 }, { dec: { ...ok.dec, t: 1.9 } }]) assert.equal(verdictOf({ ...ok, ...bad }).pass, false);
});

test('the committed result: four tests, the verdict follows the bar, RESULT.md is the report of result.json', () => {
  assert.deepEqual(Object.keys(RES.tests).sort(), ['F-nas100', 'F-xau', 'R-nas100', 'R-xau']);
  for (const v of Object.values(RES.tests)) { assert.equal(v.verdict.pass, verdictOf(v).pass); assert.equal(v.placebo.means.length, 40); }
  assert.equal(RES.verdict, Object.values(RES.tests).some((v) => v.verdict.pass) ? 'PASS' : 'FAIL');
  assert.equal(rd('../research/edge/nfp-follow/RESULT.md'), report(RES));
  assert.ok(rd('../research/edge/nfp-follow/RESULT.md').startsWith(`# Result: NFP follow or fade, gold and NAS100 (${RES.built})\n\n**Verdict: ${RES.verdict}`));
});
