// node --test tests/fx-post-holiday-replicate.test.mjs — research/edge/fx-post-holiday-replicate (14 Nov 2026): the copied
// fx-us-holiday code is byte-identical (sha256 pinned), the day-after calendar, one leg on hand-made candles (stop, gap, costs,
// carry, three rollovers on a Wednesday), the pre-registered market list, and the published result. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { LEGS, EXTRA, DROPPED, P, legDay, postDays, finNight, otherRate, EX, placebo } from '../research/edge/fx-post-holiday-replicate/run.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'fx-post-holiday-replicate');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, f))).digest('hex');

test('the fx-us-holiday code, rates and swaps are byte copies of branch fx-us-holiday (76dd0825)', () => {
  assert.equal(sha('fx-us-holiday-run.mjs'), 'ab7fac36a03ad8b803429665d0493277619094cda35fbd7a56b8555d856786c9');
  assert.equal(sha('rates.json'), '925c5e2a3a38107776bb4b9015ecc09dd44bba52cebc366ea17b912c16088678');
  assert.equal(sha('swaps.json'), '49a8257811f354697934f6769059dca1233239c72cfdf831dbf33fbd8992978f');
  assert.equal(sha('rates-exotic.json'), '270af684c97a591eb60ffe5171c25bc75d74bfd82b28bdec5debfbd99347a6c8', 'the rate table pushed with the pre-registration');
});

test('the day after a US holiday: first NYSE trading day after each full holiday, traded once', () => {
  const A = postDays('2025-12-01', '2026-07-31');
  assert.deepEqual([...A.keys()], ['2025-12-26', '2026-01-02', '2026-01-20', '2026-02-17', '2026-04-06', '2026-05-26', '2026-06-22', '2026-07-06']);
  assert.equal(A.get('2026-04-06').name, 'Good Friday');
  assert.equal(postDays('2018-12-04', '2018-12-06').size, 0, 'an unscheduled closure is not a holiday');
});

test('the pre-registered markets: six judged, TRY and CNH reported only, HKD dropped', () => {
  assert.deepEqual(LEGS.map((l) => l.key), ['usdmxn', 'usdzar', 'usdsek', 'usdnok', 'usdsgd', 'usdpln']);
  assert.deepEqual(EXTRA.map((l) => l.key), ['usdtry', 'usdcnh']);
  assert.ok(DROPPED.usdhkd);
  const pre = read('PREREGISTRATION.md');
  for (const l of [...LEGS, ...EXTRA]) assert.ok(pre.includes(`${l.key.slice(0, 3).toUpperCase()}/${l.key.slice(3).toUpperCase()} ${(l.spread * 100).toFixed(2)} %`), l.key);
  assert.ok(/judged basket is six legs/.test(pre));
  assert.deepEqual([P.STOP_ATR, P.ATR_N, P.SEEDS, P.SEEDS_NEED, P.FROM, P.HALF, P.T_BAR], [1.5, 20, 40, 38, '2005-01-03', '2016-01-01', 2]);
  for (const c of ['mxn', 'zar', 'sek', 'nok', 'sgd', 'pln']) for (let y = 2005; y <= 2026; y++) assert.ok(Number.isFinite(EX.ccy[c].years[y]), `${c} ${y}`);
  assert.equal(otherRate('try', '2005-06-01'), EX.ccy.try.years['2007'], 'before the table: its first year');
});

// 22 candles, flat 100 with a range of 2 (true range 2, ATR 2, 1R = 3), then the trade candle; t0 a Monday 2024-01-01
const T0 = Date.UTC(2024, 0, 1) / 1000;
const bars = (last, startDay = 0) => Array.from({ length: 22 }, (_, i) => ({ time: T0 + 86400 * (i + startDay), open: 100, high: 101, low: 99, close: 100 })).concat([{ time: T0 + 86400 * (22 + startDay), ...last }]);
const MXN = LEGS[0];

test('one leg: long USD, 1.5 x ATR stop, gap at the open, costs and carry', () => {
  const up = legDay(bars({ open: 100, high: 101.5, low: 99.5, close: 101.5 }), 22, MXN, 1);
  assert.equal(up.kind, 'close');
  assert.ok(Math.abs(up.grossR - 0.5) < 1e-12, 'a 1.5 rise on a 3-point R is +0.5R');
  const day = new Date((T0 + 86400 * 22) * 1000).toISOString().slice(0, 10);
  assert.ok(Math.abs(up.cost - (0.0005 + P.COMM_RT)) < 1e-15);
  assert.ok(up.fin < 0, 'long USD against a higher-yielding peso pays carry');
  assert.ok(Math.abs(up.fin - finNight('mxn', day) * (new Date((T0 + 86400 * 22) * 1000).getUTCDay() === 3 ? 3 : 1)) < 1e-15);
  const stop = legDay(bars({ open: 99, high: 99.5, low: 96, close: 98 }), 22, MXN, 1);
  assert.equal(stop.kind, 'stop'); assert.ok(Math.abs(stop.grossR + 1) < 1e-12);
  const gap = legDay(bars({ open: 96, high: 96.5, low: 95, close: 96 }), 22, MXN, 1);
  assert.equal(gap.kind, 'gap'); assert.ok(Math.abs(gap.grossR + 4 / 3) < 1e-12, 'a gap through the stop fills at the open');
  const zero = legDay(bars({ open: 100, high: 101.5, low: 99.5, close: 101.5 }), 22, MXN, 0);
  assert.equal(zero.cost, 0); assert.equal(zero.fin, up.fin, 'cost 0 keeps financing');
  const two = legDay(bars({ open: 100, high: 101.5, low: 99.5, close: 101.5 }), 22, MXN, 2);
  assert.ok(two.fin < up.fin, '2x doubles the markup');
  // a Wednesday exit candle pays three rollovers
  let k = 0; while (new Date((T0 + 86400 * (22 + k)) * 1000).getUTCDay() !== 3) k++;
  const wed = legDay(bars({ open: 100, high: 101, low: 99, close: 100 }, k), 22, MXN, 1);
  assert.ok(Math.abs(wed.fin - 3 * finNight('mxn', new Date((T0 + 86400 * (22 + k)) * 1000).toISOString().slice(0, 10))) < 1e-15);
  assert.equal(legDay(bars({ open: 100, high: 101, low: 99, close: 100 }), 19, MXN, 1), null, 'no ATR(20) yet');
});

test('placebo draws per year as many days as the rule traded, seeded', () => {
  const ord = Array.from({ length: 30 }, (_, i) => ({ ymd: `20${10 + (i % 3)}-03-0${1 + (i % 9)}`, c1: { netR: i / 10 } }));
  const ev = [{ ymd: '2010-01-05' }, { ymd: '2011-01-05' }];
  const a = placebo(ev, ord, 5), b = placebo(ev, ord, 5);
  assert.deepEqual(a, b); assert.equal(a.length, 5);
});

test('the published result: FAIL, tests consistent with the figures, verdict line first', () => {
  const R = JSON.parse(read('result.json')), w = R.basket.whole, md = read('RESULT.md');
  assert.equal(R.verdict, 'FAIL');
  assert.equal(R.tests.T1, w.netR > 0 && w.t >= 2 && w.monthT >= 2);
  assert.equal(R.tests.T2, w.netR2 > 0);
  assert.equal(R.tests.T3, R.placebo.beaten >= 38);
  assert.equal(R.tests.T4, R.basket.firstHalf.netR > 0 && R.basket.secondHalf.netR > 0);
  assert.equal(R.verdict === 'PASS', R.tests.T1 && R.tests.T2 && R.tests.T3 && R.tests.T4);
  assert.equal(w.n, R.trades.length); assert.equal(R.basket.firstHalf.n + R.basket.secondHalf.n, w.n);
  assert.ok(R.trades.every((t) => t.ymd >= '2005-01-03'));
  assert.equal(R.data.missingPost.length, 0);
  assert.ok(R.headline.length < 220);
  assert.ok(md.split('\n')[2].startsWith('**Verdict: FAIL**'));
  assert.ok(md.includes(`n ${w.n}, event t ${(w.t >= 0 ? '+' : '−') + Math.abs(w.t).toFixed(2)}`));
  const v = studyVerdict(R, md); assert.equal(v.verdict, 'fail'); assert.ok(v.headline && v.headline.length < 220, v.headline);
});
