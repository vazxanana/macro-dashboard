// research/edge/turnaround-unused-markets: the two frozen files (hashes), the local closes and calendars, the rule on
// hand-made candles, the verdict and Fisher logic, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as R from '../research/edge/turnaround-unused-markets/run.mjs';
import * as F from '../research/edge/turnaround-unused-markets/frozen.mjs';
import * as P from '../research/edge/turnaround-unused-markets/replicate.mjs';

const dir = new URL('../research/edge/turnaround-unused-markets/', import.meta.url);
const RES = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const PRE = fs.readFileSync(new URL('PREREGISTRATION.md', dir), 'utf8');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(new URL(f, dir))).digest('hex');

test('frozen.mjs and replicate.mjs are #857\'s and #862\'s run files byte for byte', () => {
  assert.equal(sha('frozen.mjs'), R.FROZEN_SHA256);
  assert.equal(sha('frozen.mjs'), '74527d362f9d65c996cdd4df25abadbbc6b723b9aa49141d6a29c88b19693871');
  assert.equal(sha('replicate.mjs'), R.REPLICATE_SHA256);
  assert.equal(sha('replicate.mjs'), '61cb6424546a299e3fd8f626c72a1f2cc0ec1f57a422bc438e2a9d4c263d4b18');
  assert.ok(PRE.includes(R.FROZEN_SHA256) && PRE.includes(R.REPLICATE_SHA256));
  assert.equal(F.RULES.r2.drop, -0.01); assert.equal(P.DROP, -0.01); assert.equal(F.STOP_ATR, 2); assert.equal(F.ATR_N, 20);
});

test('the unused set: every index key outside #857 and #862, nothing overlapping', () => {
  const oanda = fs.readFileSync(new URL('../api/_oanda.js', import.meta.url), 'utf8');
  const idx = [...oanda.matchAll(/\['([a-z0-9]+)', '[A-Z0-9_]+', \d, 'index'\]/g)].map((m) => m[1]);
  const used = [...R.USED['#857'], ...R.USED['#862']];
  assert.deepEqual(idx.filter((k) => !used.includes(k)).sort(), Object.keys(R.CANDIDATES).sort());
  assert.deepEqual(R.USED['#862'], Object.keys(P.MARKETS));
  for (const k of Object.keys(R.CANDIDATES)) assert.ok(oanda.includes(`'${k}', '${R.CANDIDATES[k].inst}'`), k);
});

test('closes: the last H1 candle ending at or before the cash close (equal to #862 on whole-hour zones)', () => {
  for (const d of ['2016-01-04', '2016-07-11', '2020-03-30', '2025-10-27', '2026-11-11']) {
    assert.equal(R.closeCandleAt('Europe/Berlin', d, '17:30'), P.localCloseCandle('Europe/Berlin', d, 17));
    assert.equal(R.closeCandleAt('Europe/London', d, '16:30'), P.localCloseCandle('Europe/London', d, 16));
    assert.equal(R.closeCandleAt('Asia/Tokyo', d, '15:00'), P.localCloseCandle('Asia/Tokyo', d, 15));
  }
  assert.equal(new Date(R.closeCandleAt('Asia/Kolkata', '2020-03-02', '15:30') * 1000).toISOString(), '2020-03-02T09:00:00.000Z');
  assert.equal(new Date(R.closeCandleAt('Europe/Paris', '2020-01-06', '17:30') * 1000).toISOString(), '2020-01-06T15:00:00.000Z');
  assert.equal(new Date(R.closeCandleAt('Europe/Paris', '2020-07-06', '17:30') * 1000).toISOString(), '2020-07-06T14:00:00.000Z');
  assert.equal(new Date(R.closeCandleAt('Australia/Sydney', '2020-01-06', '16:00') * 1000).toISOString(), '2020-01-06T04:00:00.000Z');
  assert.equal(new Date(R.closeCandleAt('Australia/Sydney', '2020-07-06', '16:00') * 1000).toISOString(), '2020-07-06T05:00:00.000Z');
  assert.equal(new Date(R.closeCandleAt('Asia/Hong_Kong', '2020-07-06', '16:00') * 1000).toISOString(), '2020-07-06T07:00:00.000Z');
  // half days
  assert.equal(new Date(R.closeOfCandidate('fr40')('2019-12-24') * 1000).toISOString(), '2019-12-24T12:00:00.000Z');
  assert.equal(new Date(R.closeOfCandidate('au200')('2020-12-24') * 1000).toISOString(), '2020-12-24T02:00:00.000Z');
});

test('calendars from holidays.json: closed days, HKEX only from 2014', () => {
  assert.equal(R.HOL.src, 'PyPI holidays 0.108, financial calendars');
  const fr = R.localDays('TAR', '2020-04-06', '2020-04-17');
  assert.ok(!fr.includes('2020-04-10') && !fr.includes('2020-04-13') && fr.includes('2020-04-14'), 'Good Friday and Easter Monday closed');
  assert.ok(!R.localDays('XSWX', '2020-05-18', '2020-05-25').includes('2020-05-21'), 'Ascension closed on SIX');
  assert.ok(!R.localDays('XASX', '2020-01-20', '2020-01-31').includes('2020-01-27'), 'Australia Day observed');
  assert.ok(!R.localDays('XHKG', '2024-02-05', '2024-02-16').includes('2024-02-12'), 'Lunar New Year closed');
  assert.equal(R.localDays('XHKG', '2010-01-01', '2014-01-10')[0], '2014-01-02');
  assert.equal(R.calFrom('XHKG'), '2014-01-01');
  assert.ok(R.isHalf('fr40', '2021-12-31') && !R.isHalf('ch20', '2021-12-30'));
});

test('the frozen rule on hand-made candles: one down-1 % first day of the week -> one trade, stop below', () => {
  const days = R.localDays('TAR', '2007-10-01', '2008-03-31'), co = R.closeOfCandidate('fr40');
  const target = days.find((d, i) => d >= '2008-03-01' && i > 0 && F.weekOf(days[i - 1]) !== F.weekOf(d));
  let px = 100;
  const bars = days.map((d) => { const c = d === target ? px * 0.98 : px * 1.0005; const b = [co(d), px, Math.max(px, c) + 0.5, Math.min(px, c) - 0.5, c]; px = c; return b; });
  const run = R.marketRun('fr40', bars, () => 2);
  assert.equal(run.trades.length, 1);
  const t = run.trades[0];
  assert.equal(t.entryD, target); assert.ok(t.stop < t.entry && t.R < t.grossR);
  assert.ok(!run.wpool.get(2008).includes(days.indexOf(target)), 'the week\'s first day is never a weekday-placebo day');
  const t2 = R.atCost(t, 0.0005, 2); assert.ok(Math.abs(t.R - t2.R - 0.0005 * t.entry / (t.entry - t.stop)) < 1e-12);
  assert.equal(R.drawdown([{ entryD: 'a', exitD: '1', R: 1 }, { entryD: 'b', exitD: '2', R: -2 }, { entryD: 'c', exitD: '3', R: 0.5 }]), -2);
});

test('verdict: #862\'s bar, NOT MEASURABLE on a gate miss or under 3 markets', () => {
  assert.equal(R.breadthNeed(6), 4); assert.equal(R.breadthNeed(8), 6);
  const S = (R0, t, pos, beat) => ({ pool: { oos: { R: R0, month: { t } }, placebo: { beaten: beat } }, markets: Object.fromEntries([...Array(8)].map((_, i) => [i, { oos: { R: i < pos ? 0.1 : -0.1 } }])) });
  assert.equal(R.verdictOf(S(0.05, 2.1, 6, 38), { ok: true }, 8).verdict, 'REPLICATES');
  assert.equal(R.verdictOf(S(0.05, 1.9, 6, 38), { ok: true }, 8).verdict, 'DOES NOT REPLICATE');
  assert.equal(R.verdictOf(S(0.05, 2.1, 5, 38), { ok: true }, 8).verdict, 'DOES NOT REPLICATE');
  assert.match(R.verdictOf(null, { ok: false }, 8).why, /gate/);
  assert.match(R.verdictOf(null, { ok: true }, 2).why, /under 3/);
});

test('Fisher as multiple-testing-update: one-sided normal p, -2 sum ln p, no calendar-disjoint cell', () => {
  assert.ok(Math.abs(R.pOneSided(2.33) - 0.0099) < 1e-4);
  assert.ok(Math.abs(R.fisher([0.5, 0.5]).p - (1 + Math.log(4)) * 0.25) < 1e-12);   // chi2 sf on 4 df at -4 ln 0.5
  const f = R.fisherBlock(RES.pool.oos.month.t);
  assert.deepEqual(f, RES.fisher);
  assert.equal(f.calendarDisjoint, null);
});

test('result.json and RESULT.md agree; gate reproduced exactly', () => {
  assert.ok(RES.gate.ok);
  assert.deepEqual(RES.gate.got.pool, R.GATE_862.pool);
  for (const [k, v] of Object.entries(R.GATE_862.markets)) assert.deepEqual(RES.gate.got.markets[k], v);
  assert.deepEqual(RES.qualifying, ['fr40', 'nl25', 'es35', 'ch20', 'au200', 'hk33', 'cn50', 'sg30']);
  assert.equal(RES.availability.in50.qualifies, false);
  const v = R.verdictOf(RES, RES.gate, RES.qualifying.length);
  assert.equal(RES.verdict, v.verdict); assert.equal(RES.verdict, 'DOES NOT REPLICATE');
  assert.ok(MD.startsWith('# Result') && MD.includes('**Verdict: DOES NOT REPLICATE'));
  const o = RES.pool.oos, sgn = (x, d = 3) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(d);
  assert.ok(MD.includes(`${sgn(o.R)}R a trade net (n ${o.n}, trade t ${sgn(o.t, 2).replace('+', '')}), month-sum t ${sgn(o.month.t, 2).replace('+', '')}`));
  for (const k of RES.qualifying) { const m = RES.markets[k]; assert.ok(MD.includes(`| ${m.name} | ${m.oos.n} | ${sgn(m.oos.R)} |`), k); }
  assert.ok(MD.includes(`${RES.pool.placebo.beaten} of 40`) && MD.includes(`${RES.pool.weekdayPlacebo.beaten} of 40`));
  assert.ok(MD.includes(`p ${RES.fisher.allCells.p.toFixed(4)}`) && MD.includes(`p ${RES.fisher.original2.p.toFixed(4)}`));
});
