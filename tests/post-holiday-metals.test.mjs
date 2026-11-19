// node --test tests/post-holiday-metals.test.mjs — research/edge/post-holiday-metals (14 Nov 2026): the copied fx-us-holiday code is
// byte-identical (sha256 pinned, the same copy fx-post-holiday-replicate made), the day-after calendar, one short leg on hand-made
// candles (stop above, gap, costs, no financing credit) against the copied legDay, the pre-registered markets, and the published
// result. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { LEGS, EXTRA, SIDE, P, legDay, postDays, placebo, basketDays } from '../research/edge/post-holiday-metals/run.mjs';
import { legDay as fxLegDay } from '../research/edge/post-holiday-metals/fx-us-holiday-run.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'post-holiday-metals');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, f))).digest('hex');

test('the fx-us-holiday code and rates are byte copies of branch fx-us-holiday (as in fx-post-holiday-replicate)', () => {
  assert.equal(sha('fx-us-holiday-run.mjs'), 'ab7fac36a03ad8b803429665d0493277619094cda35fbd7a56b8555d856786c9');
  assert.equal(sha('rates.json'), '925c5e2a3a38107776bb4b9015ecc09dd44bba52cebc366ea17b912c16088678');
  assert.ok(read('run.mjs').includes("from './fx-us-holiday-run.mjs'"), 'calendar, fold, ATR and statistics are imported, not re-written');
});

test('the day after a US holiday: first NYSE trading day after each full holiday, traded once', () => {
  const A = postDays('2025-12-01', '2026-07-31');
  assert.deepEqual([...A.keys()], ['2025-12-26', '2026-01-02', '2026-01-20', '2026-02-17', '2026-04-06', '2026-05-26', '2026-06-22', '2026-07-06']);
  assert.equal(A.get('2026-04-06').name, 'Good Friday');
  assert.equal(postDays('2018-12-04', '2018-12-06').size, 0, 'an unscheduled closure is not a holiday');
});

test('the pre-registered markets and parameters', () => {
  assert.deepEqual(LEGS.map((l) => [l.key, l.costUsd]), [['xau', 0.30], ['xag', 0.03]]);
  assert.deepEqual(EXTRA.map((l) => [l.key, l.costPct]), [['xpt', 0.003], ['xpd', 0.005]]);
  assert.equal(SIDE, -1, 'short metals = long the US dollar');
  assert.deepEqual([P.STOP_ATR, P.ATR_N, P.SEEDS, P.SEEDS_NEED, P.FROM, P.HALF, P.T_BAR], [1.5, 20, 40, 38, '2005-01-03', '2016-01-01', 2]);
  const pre = read('PREREGISTRATION.md');
  for (const s of ['$0.30 an ounce', '$0.03 an ounce', 'assumed 0.30 % of price', 'assumed 0.50 % of price', 'SHORT XAU/USD and XAG/USD', 'short is credited nothing', 'owner item 44', 'Not a gold-book test']) assert.ok(pre.includes(s), s);
});

// 22 candles flat at 100 with a range of 2 (ATR 2, 1R = 3), then the trade candle; t0 Monday 2024-01-01
const T0 = Date.UTC(2024, 0, 1) / 1000;
const bars = (last) => Array.from({ length: 22 }, (_, i) => ({ time: T0 + 86400 * i, open: 100, high: 101, low: 99, close: 100 })).concat([{ time: T0 + 86400 * 22, ...last }]);
const XAU = LEGS[0];
const fxLeg = { ccy: 'eur', key: 'eurusd', sym: 'EURUSD', usd: -1, base: 'eur', quote: 'usd' };

test('one short leg: 1.5 x ATR stop above, gap at the open, costs, no financing credit; same exits as the copied legDay', () => {
  const cases = [
    [{ open: 100, high: 100.5, low: 98.5, close: 98.5 }, 'close', 0.5],
    [{ open: 101, high: 104, low: 100.5, close: 102 }, 'stop', -1],
    [{ open: 104, high: 104.5, low: 103.5, close: 104 }, 'gap', -4 / 3],
  ];
  for (const [last, kind, R] of cases) {
    const b = bars(last), x = legDay(b, 22, XAU, 1), ref = fxLegDay(b, 22, fxLeg, -1, { swaps: null });
    assert.equal(x.kind, kind); assert.equal(ref.kind, kind);
    assert.ok(Math.abs(x.grossR - R) < 1e-12, kind); assert.ok(Math.abs(x.gross - ref.gross) < 1e-15, 'gross as the copied legDay');
    assert.equal(x.fin, 0, 'a short is credited nothing (council/fills.mjs FIN.xau.short = 0)');
    assert.ok(Math.abs(x.cost - 0.30 / 100) < 1e-15);
    assert.ok(Math.abs(x.netR - (x.grossR - 0.30 / 3)) < 1e-12, '$0.30 on a $3 R is 0.1R');
  }
  assert.equal(legDay(bars({ open: 100, high: 101, low: 99, close: 100 }), 22, XAU, 0).cost, 0);
  assert.ok(Math.abs(legDay(bars({ open: 100, high: 101, low: 99, close: 100 }), 22, XAU, 2).cost - 0.006) < 1e-15);
  assert.ok(Math.abs(legDay(bars({ open: 100, high: 101, low: 99, close: 100 }), 22, EXTRA[0], 1).cost - 0.003) < 1e-15, 'XPT: share of price');
  assert.equal(legDay(bars({ open: 100, high: 101, low: 99, close: 100 }), 19, XAU, 1), null, 'no ATR(20) yet');
});

test('basket days need both metals on the date with the same previous candle', () => {
  const a = bars({ open: 100, high: 101, low: 99, close: 100 }), b = a.filter((_, i) => i !== 21);
  const { days, skipped } = basketDays({ xau: a, xag: b });
  assert.ok(!days.has(new Date((T0 + 86400 * 22) * 1000).toISOString().slice(0, 10)), 'previous candle differs');
  assert.ok(skipped >= 1);
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
  assert.equal(w.finR, 0, 'shorts: no financing credit');
  assert.deepEqual(R.metals.map((m) => m.metal), ['xau', 'xag', 'xpt', 'xpd']);
  assert.ok(R.headline.length < 220);
  assert.ok(md.split('\n')[2].startsWith('**Verdict: FAIL ('));
  assert.ok(md.includes(`n ${w.n}, event t ${(w.t >= 0 ? '+' : '−') + Math.abs(w.t).toFixed(2)}`));
  assert.ok(md.includes('not a test of any gold-book system'));
  const v = studyVerdict(R, md); assert.equal(v.verdict, 'fail'); assert.ok(v.headline && v.headline.length < 220, v.headline);
});
