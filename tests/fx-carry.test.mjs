// research/edge/fx-carry: the pre-registered carry rule, offline (no network, synthetic candles and rates).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as F from '../research/edge/fx-carry/run.mjs';

const DIR = new URL('../research/edge/fx-carry/', import.meta.url);
const ut = (y, m, d = 1) => Date.UTC(y, m - 1, d) / 1000;
// one flat series a month for every currency, from 2005-01 to 2026-12
function fredFlat(levels, from = [2005, 1], to = [2026, 12]) {
  const out = {};
  for (const c of F.CCYS) {
    const a = [];
    for (let y = from[0], m = from[1]; y < to[0] || (y === to[0] && m <= to[1]); m === 12 ? (y++, m = 1) : m++) a.push({ t: ut(y, m), v: typeof levels[c] === 'function' ? levels[c](y, m) : levels[c] });
    out[F.SERIES[c].primary] = a;
  }
  return out;
}
// daily candles on every weekday between two dates, price from fn(i)
function daily(from, to, fn, spread = 0.001) {
  const cs = []; let i = 0;
  for (let t = from; t <= to; t += 86400) { const w = new Date(t * 1000).getUTCDay(); if (w === 0 || w === 6) continue;
    const c = fn(i, t), o = i ? cs[i - 1].c : c; cs.push({ t, o, h: Math.max(o, c) + spread, l: Math.min(o, c) - spread, c }); i++; }
  return cs;
}

test('series ids: one OECD 3-month interbank series per currency, with an overnight fallback', () => {
  assert.equal(F.CCYS.length, 8);
  assert.equal(F.SERIES.USD.primary, 'IR3TIB01USM156N');
  assert.equal(F.SERIES.EUR.primary, 'IR3TIB01EZM156N');
  assert.equal(F.SERIES.NZD.fallback, 'IRSTCI01NZM156N');
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const c of F.CCYS) { assert.ok(pre.includes(F.SERIES[c].primary)); assert.ok(pre.includes(F.SERIES[c].fallback)); }
  assert.deepEqual(Object.values(F.PAIRS).map((p) => p.key).sort(), ['audusd', 'eurusd', 'gbpusd', 'nzdusd', 'usdcad', 'usdchf', 'usdjpy']);
});

test('ranking: top 2 long, bottom 2 short, ties by code, fewer than 6 known = flat', () => {
  const rates = F.monthlyRates(fredFlat({ USD: 2, EUR: 1, GBP: 3, JPY: 0, AUD: 4, CAD: 2, CHF: -0.5, NZD: 5 }));
  const r = F.rankMonth(rates, '2020-06');
  assert.deepEqual(r.long, ['NZD', 'AUD']);
  assert.deepEqual(r.short, ['JPY', 'CHF']);
  const tie = F.rankMonth(F.monthlyRates(fredFlat({ USD: 1, EUR: 1, GBP: 1, JPY: 1, AUD: 1, CAD: 1, CHF: 1, NZD: 1 })), '2020-06');
  assert.deepEqual(tie.long, ['AUD', 'CAD']); assert.deepEqual(tie.short, ['NZD', 'USD']);
  const few = F.monthlyRates({ [F.SERIES.USD.primary]: [{ t: ut(2020, 1), v: 1 }], [F.SERIES.EUR.primary]: [{ t: ut(2020, 1), v: 2 }] });
  assert.equal(F.rankMonth(few, '2020-06'), null);
});

test('publication lag: the month-end ranking never reads an observation dated less than two months back', () => {
  // AUD jumps to the top from 2020-05 on; at the end of 2020-05 and 2020-06 it must still rank by its old (low) rate
  const lv = { USD: 2, EUR: 1, GBP: 3, JPY: 0, CAD: 2.5, CHF: -0.5, NZD: 4, AUD: (y, m) => (y * 12 + m >= 2020 * 12 + 5 ? 9 : 0.1) };
  const rates = F.monthlyRates(fredFlat(lv));
  assert.ok(!F.rankMonth(rates, '2020-05').long.includes('AUD'));
  assert.ok(!F.rankMonth(rates, '2020-06').long.includes('AUD'));
  assert.ok(F.rankMonth(rates, '2020-07').long.includes('AUD'));
  assert.equal(F.knownRate(rates.AUD, '2020-06').ym, '2020-04');
  // a series that stops: the latest earlier known value, at most 6 months back
  assert.equal(F.knownRate(rates.AUD, '2027-03').ym, '2026-12');
  assert.equal(F.knownRate(rates.AUD, '2027-09'), null);
});

test('fallback series fills a month the primary lacks; the primary wins where both exist', () => {
  const fred = { [F.SERIES.GBP.primary]: [{ t: ut(2021, 1), v: 0.1 }], [F.SERIES.GBP.fallback]: [{ t: ut(2021, 1), v: 0.05 }, { t: ut(2022, 3), v: 0.6 }] };
  const m = F.monthlyRates(fred).GBP;
  assert.deepEqual(m.get('2021-01'), { v: 0.1, src: 'primary' });
  assert.deepEqual(m.get('2022-03'), { v: 0.6, src: 'fallback' });
});

test('carry accrual: differential less the markup, by calendar days held, in R', () => {
  // flat price 1.0, ATR known: true range 0.002 a day -> 1R = 3 x 0.002 = 0.006
  const cs = daily(ut(2020, 1, 1), ut(2020, 3, 31), () => 1.0);
  const ends = F.monthEnds(cs), i0 = ends.get('2020-01'), i1 = ends.get('2020-02');
  const atr = F.atrAt(cs, i0); assert.ok(Math.abs(atr - 0.002) < 1e-12);
  const opt = { ...F.P, commissionRT: 0, spreadPips: 0 };
  const L = F.legResult(cs, i0, i1, 1, { rc: 5, ru: 1, pip: 0.0001, inv: false, opt });
  const days = (cs[i1].t - cs[i0].t) / 86400;
  assert.ok(Math.abs(L.carryR - ((5 - 1 - 1) / 100) * (days / 365) * 1.0 / 0.006) < 1e-9);
  assert.equal(L.priceR, 0);
  const S = F.legResult(cs, i0, i1, -1, { rc: 5, ru: 1, pip: 0.0001, inv: false, opt });
  assert.ok(Math.abs(S.carryR - ((-(5 - 1) - 1) / 100) * (days / 365) / 0.006) < 1e-9, 'a short pays the differential and the markup');
  // costs: 1 pip + commission per round trip, doubled at 2 x
  const C = F.legResult(cs, i0, i1, 1, { rc: 1, ru: 1, pip: 0.0001, inv: false });
  assert.ok(Math.abs(C.costR - (0.0001 / 1.0 + 0.000045) / 0.006) < 1e-12);
  const C2 = F.legResult(cs, i0, i1, 1, { rc: 1, ru: 1, pip: 0.0001, inv: false, costMult: 2 });
  assert.ok(Math.abs(C2.costR - 2 * C.costR) < 1e-12);
});

test('every leg has a stop 3 x ATR(20) away; a touch exits at the stop, a gap at the open, and only once', () => {
  const base = daily(ut(2020, 1, 1), ut(2020, 1, 31), () => 1.0);
  const i0 = base.length - 1, risk = 3 * F.atrAt(base, i0);
  // touch: a candle whose low reaches 1 - risk - 0.0005, then recovers
  const t0 = base[i0].t, mk = (t, o, h, l, c) => ({ t, o, h, l, c });
  const touch = [...base, mk(t0 + 86400 * 3, 1.0, 1.001, 1 - risk - 0.0005, 0.999), mk(t0 + 86400 * 4, 0.999, 1.01, 0.998, 1.02)];
  const L = F.legResult(touch, i0, touch.length - 1, 1, { rc: 0, ru: 0, pip: 0.0001, inv: false });
  assert.equal(L.stopped, true); assert.ok(Math.abs(L.exit - (1 - risk)) < 1e-12); assert.ok(Math.abs(L.priceR + 1) < 1e-9);
  const gap = [...base, mk(t0 + 86400 * 3, 1 - 2 * risk, 1 - 2 * risk + 0.001, 1 - 2 * risk - 0.001, 1 - 2 * risk)];
  const G = F.legResult(gap, i0, gap.length - 1, 1, { rc: 0, ru: 0, pip: 0.0001, inv: false });
  assert.ok(Math.abs(G.exit - (1 - 2 * risk)) < 1e-12); assert.ok(Math.abs(G.priceR + 2) < 1e-9);
  // a short's stop is above
  const up = [...base, mk(t0 + 86400 * 3, 1.0, 1 + risk + 0.0001, 0.999, 1.0)];
  const S = F.legResult(up, i0, up.length - 1, -1, { rc: 0, ru: 0, pip: 0.0001, inv: false });
  assert.equal(S.stopped, true); assert.ok(S.stop > S.entry);
  // too few candles for ATR(20): no leg (never a position without a stop)
  assert.equal(F.legResult(base.slice(0, 10), 9, 9, 1, {}), null);
});

test('inverted pairs: USD/JPY becomes USD per yen, highs and lows swapped', () => {
  const c = F.candlesOf({ rows: [[ut(2020, 1, 2), 100, 110, 90, 105, 0]] }, true)[0];
  assert.ok(Math.abs(c.c - 1 / 105) < 1e-15); assert.ok(Math.abs(c.h - 1 / 90) < 1e-15); assert.ok(Math.abs(c.l - 1 / 110) < 1e-15);
});

test('book: four legs, a USD leg is 0 R, the month result is the mean of the legs', () => {
  const cs = (drift) => daily(ut(2019, 1, 1), ut(2020, 6, 30), (i) => 1 + drift * i + 0.002 * Math.sin(i));
  const candles = { EUR: cs(0), GBP: cs(0), JPY: cs(-0.0002), AUD: cs(0.0002), CAD: cs(0), CHF: cs(-0.0001), NZD: cs(0.0001) };
  const rates = F.monthlyRates(fredFlat({ USD: 0, EUR: 1, GBP: 1.5, JPY: 2, AUD: 4, CAD: 0.5, CHF: 0.2, NZD: 5 }));
  const rows = F.runBook(candles, rates);
  const r = rows.find((x) => x.ym === '2020-03');
  assert.deepEqual(r.legs.map((l) => l.c), ['NZD', 'AUD', 'CHF', 'USD']);
  assert.equal(r.legs.find((l) => l.c === 'USD').R, 0);
  assert.ok(Math.abs(r.R - r.legs.reduce((a, l) => a + l.R, 0) / 4) < 1e-12);
  assert.ok(r.legs.filter((l) => l.c !== 'USD').every((l) => l.s > 0 ? l.stop < l.entry : l.stop > l.entry));
});

test('volatility skip uses only months up to the one before the month held', () => {
  const amp = { '2014-02': 0.0001, '2014-03': 0.02 }, cs = daily(ut(2010, 1, 1), ut(2014, 12, 31), (i, t) => 1 + (amp[new Date(t * 1000).toISOString().slice(0, 7)] || 0.0005) * Math.sin(i * 2));
  const candles = { EUR: cs };
  const skip = F.volSkipSet(candles, ['2014-03', '2014-04', '2014-05']);
  assert.ok(!skip.has('2014-03'), 'the wild month itself is not known at its own start');
  assert.ok(skip.has('2014-04'));
});

test('statistics and Holm', () => {
  const s = F.stats([1, -1, 2, 0]);
  assert.equal(s.n, 4); assert.equal(s.total, 2); assert.equal(s.maxDD, -1);
  assert.deepEqual(F.holm([0.01, 0.04]), [0.02, 0.04]);
  assert.deepEqual(F.holm([0.04, 0.01]), [0.04, 0.02]);
});

test('RESULT.md says what result.json says', () => {
  const res = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8'), first = md.split('\n').find((l) => /\*\*Verdict/.test(l));
  assert.ok(first, 'a verdict line');
  assert.ok(first.toLowerCase().includes(String(res.verdict).toLowerCase()), `${first} vs ${res.verdict}`);
  if (/not run/.test(res.verdict)) {
    assert.ok(!res.streams, 'no statistic when the data was not reachable');
    assert.ok(/no return, Sharpe, t or drawdown was computed/.test(md));
  } else {
    for (const k of ['base', 'volSkip']) for (const w of ['replication', 'decisive']) {
      const s = res.streams[k].x1[w];
      assert.ok(md.includes(s.sharpe.toFixed(2)) && md.includes(s.t.toFixed(2)), `${k} ${w} figures in RESULT.md`);
    }
  }
});
