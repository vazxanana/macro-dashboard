// research/edge/turnaround-replicate: the frozen rule file (hash and the one adapted function), the local calendars and
// closes, the stop, costs and financing, the pooled checks, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as F from '../research/edge/turnaround-replicate/frozen.mjs';
import { FROZEN_SHA256, MARKETS, RATES, DROP, xetraHolidays, lseHolidays, lseHalf, tseHolidays, localTradingDays, localCloseCandle, closeOfMarket, buildDaysAt, yearRate, monthT, verdictOf } from '../research/edge/turnaround-replicate/run.mjs';

const dir = new URL('../research/edge/turnaround-replicate/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const PRE = fs.readFileSync(new URL('PREREGISTRATION.md', dir), 'utf8');
const iso = (t) => new Date(t * 1000).toISOString();

test('frozen.mjs is the turnaround-tuesday run.mjs byte for byte; buildDaysAt differs from buildDays only by the close call', () => {
  const src = fs.readFileSync(new URL('frozen.mjs', dir));
  assert.equal(crypto.createHash('sha256').update(src).digest('hex'), FROZEN_SHA256);
  assert.ok(PRE.includes(FROZEN_SHA256), 'the pre-registration names the same hash');
  assert.equal(R.frozen.sha256, FROZEN_SHA256);
  const fnText = (s, name) => { const a = s.indexOf(`export function ${name}(`); return s.slice(a, s.indexOf('\n}\n', a) + 2); };
  const frozen = fnText(src.toString(), 'buildDays'), mine = fnText(fs.readFileSync(new URL('run.mjs', dir), 'utf8'), 'buildDaysAt');
  assert.equal(frozen.replace('buildDays(bars, days)', 'buildDaysAt(bars, days, closeOf)').replace('closeCandle(d)', 'closeOf(d)'), mine);
  assert.equal(DROP, -0.01);
  assert.equal(F.STOP_ATR, 2); assert.equal(F.ATR_N, 20); assert.equal(F.FIN_ADD, 2.5);
});

test('local calendars: Xetra, London, Tokyo', () => {
  assert.deepEqual([...xetraHolidays(2025)].sort(), ['2025-01-01', '2025-04-18', '2025-04-21', '2025-05-01', '2025-12-24', '2025-12-25', '2025-12-26', '2025-12-31']);
  assert.deepEqual([...lseHolidays(2020)].sort(), ['2020-01-01', '2020-04-10', '2020-04-13', '2020-05-08', '2020-05-25', '2020-08-31', '2020-12-25', '2020-12-28']);
  assert.ok(lseHolidays(2022).has('2022-06-02') && lseHolidays(2022).has('2022-06-03') && lseHolidays(2022).has('2022-09-19') && lseHolidays(2022).has('2022-01-03'));
  assert.ok(lseHalf('2025-12-24') && lseHalf('2025-12-31') && !lseHalf('2022-12-24'));
  const tse = (y) => [...tseHolidays(y)];
  for (const d of ['2009-09-22', '2015-09-22', '2026-09-22', '2019-04-30', '2019-05-02', '2019-05-06', '2019-10-22', '2020-02-24', '2020-07-24', '2021-08-09', '2025-11-24', '2025-03-20', '2025-09-23', '2019-01-02', '2019-12-31'])
    assert.ok(tse(+d.slice(0, 4)).includes(d), d);
  assert.ok(!tseHolidays(2019).has('2019-12-23') && tseHolidays(2018).has('2018-12-23') && !tseHolidays(2021).has('2021-10-11'));
  // M / T on local holiday weeks: Easter Monday 2025 shifts Frankfurt and London to Tuesday-Wednesday; Japan's 13 Jan 2025 too
  const pairs = (cal, a, b) => { const d = localTradingDays(cal, a, b); return F.weekPairs(d).map((p) => [d[p.m], d[p.x]]); };
  assert.deepEqual(pairs('xetra', '2025-04-17', '2025-04-25'), [['2025-04-22', '2025-04-23']]);
  assert.deepEqual(pairs('lse', '2025-04-17', '2025-04-25'), [['2025-04-22', '2025-04-23']]);
  assert.deepEqual(pairs('tse', '2025-01-10', '2025-01-17'), [['2025-01-14', '2025-01-15']]);
  assert.deepEqual(pairs('nyse', '2025-04-17', '2025-04-25'), [['2025-04-21', '2025-04-22']], 'US markets: the frozen NYSE calendar');
});

test('local closes: the H1 candle ending at or before the cash close, across daylight saving', () => {
  const c = (k, d) => iso(closeOfMarket(k)(d));
  assert.equal(c('de40', '2025-01-06'), '2025-01-06T15:00:00.000Z', 'ends 17:00 Frankfurt in winter');
  assert.equal(c('eu50', '2025-07-07'), '2025-07-07T14:00:00.000Z', 'ends 17:00 Frankfurt in summer');
  assert.equal(c('uk100', '2025-01-06'), '2025-01-06T15:00:00.000Z', 'ends 16:00 London in winter');
  assert.equal(c('uk100', '2025-07-07'), '2025-07-07T14:00:00.000Z');
  assert.equal(c('uk100', '2025-12-24'), '2025-12-24T11:00:00.000Z', 'half day: ends 12:00 London');
  assert.equal(c('jp225', '2025-07-07'), '2025-07-07T05:00:00.000Z', 'ends 15:00 Tokyo');
  assert.equal(c('jp225', '2025-01-06'), '2025-01-06T05:00:00.000Z');
  // the week between the US and European clock changes: Frankfurt keeps its own clock
  assert.equal(iso(localCloseCandle('Europe/Berlin', '2025-03-24', 17)), '2025-03-24T15:00:00.000Z');
  assert.equal(iso(localCloseCandle('Europe/Berlin', '2025-03-31', 17)), '2025-03-31T14:00:00.000Z');
});

test('the trade on local days: entry at the close, stop 2 x ATR(20) below, a gap fills at the open, costs and financing', () => {
  const days = localTradingDays('xetra', '2025-01-02', '2025-02-28'), close = closeOfMarket('de40'), bars = [];
  for (const d of days) { const t = close(d); for (let h = 8; h >= 1; h--) bars.push([t - h * 3600, 100, 101, 99, 100]); bars.push([t, 100, 101, 99, 100]); }
  bars.sort((a, b) => a[0] - b[0]);
  const D = buildDaysAt(bars, days, close), k = days.length - 2;
  assert.equal(D[k].close, 100); assert.equal(F.atrAt(D, k), 2);
  const rate = yearRate('eur');
  assert.equal(rate('2025-03-01'), RATES.eur[2025]); assert.equal(rate('2031-01-01'), RATES.eur[2026], 'a year past the table takes its last');
  const t = F.trade(bars, D, k, k + 1, { cost: MARKETS.de40.cost, rate });
  assert.equal(t.stop, 96); assert.equal(t.how, 'time'); assert.equal(t.nights, 1);
  const fin = (RATES.eur[2025] + 2.5) / 100 / 365;
  assert.ok(Math.abs(t.R - (0 - (MARKETS.de40.cost + fin) * 100) / 4) < 1e-12);
  // a candle opening below the stop fills at its open
  const gi = D[k + 1].i - 3; bars[gi] = [bars[gi][0], 95, 96, 94, 95];
  const g = F.trade(bars, D, k, k + 1, { cost: 0, rate: () => null });
  assert.equal(g.how, 'stop-gap'); assert.equal(g.exit, 95);
  // a negative rate is floored at 0 (frozen)
  const n = F.trade(bars, D, k, k + 1, { cost: 0, rate: () => -0.5 });
  assert.ok(Math.abs(n.fin - 2.5 / 365) < 1e-12);
});

test('month-sum t counts empty months as 0; the verdict needs P1, P2 and P3', () => {
  const m = monthT([{ entryD: '2016-01-05', R: 1 }, { entryD: '2016-01-20', R: 1 }, { entryD: '2016-03-01', R: -1 }], '2016-01', '2016-04');
  assert.equal(m.months, 4); assert.equal(m.mean, 0.25); assert.equal(m.withTrade, 2);
  const mk = (R) => ({ oos: { R } });
  const S = (R, t, beaten, ms) => ({ pool: { oos: { R, month: { t } }, placebo: { beaten } }, markets: Object.fromEntries(ms.map((x, i) => ['m' + i, mk(x)])) });
  assert.equal(verdictOf(S(0.05, 2.1, 38, [1, 1, 1, 1, -1, -1])).verdict, 'PASS');
  assert.equal(verdictOf(S(0.05, 1.9, 40, [1, 1, 1, 1, 1, 1])).verdict, 'FAIL');
  assert.equal(verdictOf(S(0.05, 2.1, 37, [1, 1, 1, 1, 1, 1])).verdict, 'FAIL');
  assert.equal(verdictOf(S(0.05, 2.1, 40, [1, 1, 1, -1, -1, -1])).verdict, 'FAIL');
});

test('result.json recomputes its verdict, and RESULT.md says what it holds', () => {
  const v = verdictOf(R);
  assert.equal(v.verdict, R.verdict); assert.deepEqual(v.checks, R.checks);
  assert.equal(R.supportsNas100, R.verdict === 'PASS');
  assert.ok(MD.startsWith(`# Result:`) && MD.includes(`**Verdict: ${R.verdict}**`));
  assert.ok(MD.includes(R.supportsNas100 ? 'supports the NAS100 cell' : 'This does not support the NAS100 cell'));
  assert.deepEqual(Object.keys(R.markets), ['us30', 'us2000', 'de40', 'eu50', 'uk100', 'jp225']);
  const f = (x, d = 3) => (x > 0 ? '+' : x < 0 ? '-' : '') + Math.abs(x).toFixed(d);
  for (const [w, title] of [['oos', '2016 - Nov 2026'], ['is', '2008 - 2015']]) {
    const sec = MD.slice(MD.indexOf(`| ${title}`));
    for (const m of Object.values(R.markets)) {
      const o = m[w], row = `| ${m.name} | ${o.n} | ${f(o.R)} | ${o.t.toFixed(2)} | ${f(o.grossR)} | ${f(o.netPct)} | ${o.win.toFixed(2)} % | ${o.stops} |` + (w === 'oos' ? ` ${m.placebo.beaten} of 40 |` : '');
      assert.ok(sec.includes(row), row);
    }
    const p = R.pool[w];
    assert.ok(sec.includes(`| **Pool (equal risk)** | ${p.n} | ${f(p.R)} | ${p.t.toFixed(2)} | ${f(p.grossR)} | ${f(p.netPct)} | ${p.win.toFixed(2)} % | ${p.stops} |`), w);
  }
  const o = R.pool.oos;
  assert.ok(MD.includes(`month-sum t ${o.month.t.toFixed(2)} over ${o.month.months} months`));
  assert.ok(MD.includes(`${R.positive} of ${R.of} markets positive`));
  assert.ok(MD.includes(`in ${R.pool.placebo.beaten} of 40 seeds`));
  for (const m of Object.values(R.markets)) for (const tr of m.trades) assert.ok(tr[0] >= '2008-01-01');
});
