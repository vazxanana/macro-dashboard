// FX carry study (research/edge/fx-carry, pre-registration revision 2): the rate table, the ranking at the rebalance, ATR on
// past candles only, the stop on the losing side, carry credited and charged by side and nights, costs, the book, and the
// committed result against the pre-registered bar and the written report. Offline: no candle file is read here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RATES, CCYS, PAIRS, P, TESTS, rateAt, rank, atr, leg, carryR, sideOf, book, monthEnds, crashFlat, normP, holm, maxDD, verdictOf, report, rng, shuffled } from '../research/edge/fx-carry/run.mjs';
import { nights } from '../council/fills.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/fx-carry/PREREGISTRATION.md'), R1 = rd('../research/edge/fx-carry/PREREGISTRATION-r1.md'), RES = rd('../research/edge/fx-carry/RESULT.md');
const J = JSON.parse(rd('../research/edge/fx-carry/result.json'));
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const T0 = Date.UTC(2021, 0, 4) / 1000;   // a Monday
const day = (i, o, h, l, c) => ({ time: T0 + i * 86400, open: o, high: h, low: l, close: c });
const flat = (n, px = 1, rng = 0.01) => Array.from({ length: n }, (_, i) => day(i, px, px + rng / 2, px - rng / 2, px));

test('revision 2 is the pre-registration in force; revision 1 is kept, marked superseded', () => {
  assert.ok(PRE.includes('pre-registration (revision 2)') && PRE.includes('Revision 1 of this pre-registration (commit `cb793a37`'));
  assert.ok(R1.startsWith('> **Superseded by revision 2**') && R1.includes('OECD Main Economic Indicators, 3-month interbank rate'));
  for (const s of ['**Decisive window: holding months January 2016 to October 2026**', '2 x ATR(20)', '**0.3 pip**', 'a commission of **22.5 USD per', '**1.0 % a year broker markup is charged on every leg', 'Wednesday counts three', 'month-sum t >= 2.0', 'at least 38 of the 40 placebo means']) assert.ok(PRE.includes(s), s);
  assert.deepEqual([P.STOP_ATR, P.ATR_N, P.SPREAD_PIP, P.SLIP, P.COMM_RT, P.MARKUP, P.SEEDS, P.PLACEBO_BEAT, P.VOL_N, P.VOL_YEAR], [2, 20, 0.3, 0.5, 0.000045, 1, 40, 38, 20, 252]);
  assert.deepEqual(P.DEC, ['2016-01', '2026-10']); assert.deepEqual(P.REP, ['2006-01', '2015-12']); assert.deepEqual(Object.keys(TESTS), ['T1', 'T2']);
});

test('rates.json: says it is approximate and from memory; monthEnd equals the decisions; changes sorted', () => {
  assert.match(RATES.about, /APPROXIMATE AND FROM MEMORY/); assert.deepEqual(RATES.order, CCYS);
  for (const c of CCYS) { const ch = RATES.decisions[c].changes; assert.ok(RATES.decisions[c].check.length > 5); for (let i = 1; i < ch.length; i++) assert.ok(ch[i][0] > ch[i - 1][0], c); }
  for (const [ym, v] of Object.entries(RATES.monthEnd)) { const [y, m] = ym.split('-').map(Number), last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); assert.deepEqual(v, CCYS.map((c) => rateAt(c, last)), ym); }
  assert.equal(rateAt('usd', '2008-12-15'), 1); assert.equal(rateAt('usd', '2008-12-16'), 0.125);
});

test('the ranking uses only the rate in force at the rebalance; ties keep the list order', () => {
  // the Fed moved on 16 Dec 2015: the rate the day before is the old one
  assert.equal(rateAt('usd', '2015-12-15'), 0.125);
  const fake = { decisions: Object.fromEntries(CCYS.map((c, i) => [c, { from: ['2000-01-01', c === 'chf' ? -1 : i], changes: c === 'chf' ? [['2020-06-02', 99]] : [] }])) };
  assert.deepEqual(rank('2020-06-01', fake).long, ['cad', 'nzd']); assert.deepEqual(rank('2020-06-01', fake).short, ['usd', 'chf']);
  assert.deepEqual(rank('2020-06-02', fake).long, ['chf', 'cad'], 'a decision counts from its own date');
  const tie = { decisions: Object.fromEntries(CCYS.map((c) => [c, { from: ['2000-01-01', 0], changes: [] }])) };
  assert.deepEqual(rank('2020-01-01', tie), { long: ['usd', 'eur'], short: ['cad', 'chf'], order: CCYS });
});

test('ATR reads past candles only: changing a later candle never changes it', () => {
  const b = flat(40); b[25] = day(25, 1, 1.05, 0.98, 1.01);
  const a = atr(b, 30), b2 = b.map((x) => ({ ...x })); b2[31] = day(31, 1, 3, 0.1, 2); b2[35] = day(35, 5, 9, 4, 6);
  near(atr(b2, 30), a); assert.equal(atr(b, 19), null);
  near(atr(flat(25), 22), 0.01);
});

test('every leg has its stop on the losing side; a gap exits at the open, a touch at the stop', () => {
  for (const ccy of ['eur', 'jpy']) for (const dir of [1, -1]) {
    const s = sideOf(ccy, dir), b = flat(45), l = leg(b, 25, 44, { ccy, side: s });
    assert.ok(l.r0 > 0 && (s > 0 ? l.stop < l.entry : l.stop > l.entry)); near(l.r0, 0.02); assert.equal(l.kind, 'month');
  }
  assert.equal(sideOf('jpy', 1), -1, 'long JPY = sell usdjpy'); assert.equal(sideOf('eur', 1), 1);
  const b = flat(45); b[30] = day(30, 1, 1.001, 0.97, 0.99);   // long eurusd stop at 0.98 touched
  const l = leg(b, 25, 44, { ccy: 'eur', side: 1 }); assert.equal(l.kind, 'stop'); near(l.exit, 0.98); near(l.price, -1); assert.equal(l.at, 30);
  const g = flat(45); g[28] = day(28, 1.05, 1.06, 1.04, 1.05);   // short eurusd, opens above its 1.02 stop
  const lg = leg(g, 25, 44, { ccy: 'eur', side: -1 }); assert.equal(lg.kind, 'gap'); near(lg.exit, 1.05); near(lg.price, -2.5);
});

test('carry is credited and charged by side and by nights (Wednesday three), at the rates of each night, less 1 % on every leg', () => {
  const t0 = Date.UTC(2023, 5, 30) / 1000 + 86400, t1 = Date.UTC(2023, 6, 31) / 1000 + 86400;   // end of June to end of July 2023
  const n = nights(t0, t1), rU = rateAt('usd', '2023-07-10'), rA = rateAt('aud', '2023-07-10');
  const long = carryR({ ccy: 'aud', side: 1, entry: 0.67, r0: 0.01, t0, t1 }), short = carryR({ ccy: 'aud', side: -1, entry: 0.67, r0: 0.01, t0, t1 });
  assert.equal(long.nights, n); assert.equal(short.nights, n);
  // the Fed moved on 26 Jul 2023; the sum over nights matches a hand count split at that date
  const nA = nights(t0, Date.UTC(2023, 6, 26) / 1000 + 22 * 3600 - 1), nB = n - nA;
  near(long.R, ((rA - rU - 1) * nA + (rA - 5.375 - 1) * nB) / 100 / 365 * 0.67 / 0.01);
  near(short.R, ((rU - rA - 1) * nA + (5.375 - rA - 1) * nB) / 100 / 365 * 0.67 / 0.01);
  assert.ok(long.R < 0 && short.R > 0, 'long AUD paid, short AUD earned while USD > AUD');
  near(long.R + short.R, -2 * n / 100 / 365 * 0.67 / 0.01, 1e-9);   // the markup on both sides
  const jl = carryR({ ccy: 'jpy', side: -1, entry: 140, r0: 2, t0, t1 });   // long JPY = sell usdjpy: base USD, quote JPY
  near(jl.R, ((rateAt('jpy', '2023-07-10') - rU - 1) * nA + (rateAt('jpy', '2023-07-10') - 5.375 - 1) * nB) / 100 / 365 * 140 / 2);
  const wed = Date.UTC(2023, 6, 5) / 1000;   // Wednesday: a Wednesday night counts three
  assert.equal(carryR({ ccy: 'eur', side: 1, entry: 1, r0: 1, t0: wed, t1: wed + 86400 }).nights, 3);
});

test('costs: 0.3 pip spread + half a spread on each market order + 45 per million a round trip, doubled at 2x', () => {
  const b = flat(45); const l = leg(b, 25, 44, { ccy: 'eur', side: 1 }), l2 = leg(b, 25, 44, { ccy: 'eur', side: 1, costMult: 2 });
  near(l.cost, (0.6 * 0.0001 + 0.000045) / 0.02); near(l2.cost, 2 * l.cost);
  const by = flat(45, 150, 1), ly = leg(by, 25, 44, { ccy: 'jpy', side: 1 }); near(ly.cost, (0.6 * 0.01 + 0.000045 * 150) / 2);
});

test('the book: a USD pick is a flat leg; the crash filter reads the S&P candles up to the rebalance', () => {
  const mk = () => { const out = []; for (let t = Date.UTC(2005, 9, 3) / 1000; t < Date.UTC(2006, 2, 1) / 1000; t += 86400) { const w = new Date(t * 1000).getUTCDay(); if (w && w < 6) out.push({ time: t, open: 1, high: 1.005, low: 0.995, close: 1 }); } return out; };
  const bars = {}, ends = {}; for (const p of Object.values(PAIRS)) { bars[p.key] = mk(); ends[p.key] = monthEnds(bars[p.key]); }
  const data = { bars, ends, spx: mk() };
  const saved = [P.FIRST_REB, P.LAST_REB]; P.FIRST_REB = '2005-12'; P.LAST_REB = '2006-01';
  try {
    const m = book(data); assert.equal(m.length, 2); assert.equal(m[0].ym, '2006-01');
    assert.deepEqual(m[0].long, ['nzd', 'aud']); assert.deepEqual(m[0].short, ['chf', 'jpy']); assert.equal(m[0].legs.length, 4);
    const m2 = book(data, { pick: () => ({ long: ['usd', 'eur'], short: ['gbp', 'cad'] }) }); assert.equal(m2[0].legs.length, 3);
    near(m2[0].R, m2[0].legs.reduce((s, l) => s + l.net, 0));
  } finally { [P.FIRST_REB, P.LAST_REB] = saved; }
  assert.equal(crashFlat(data.spx, '2006-01-31').flat, null, 'too little S&P history: no reading');
  const s = []; for (let i = 0; i < 300; i++) s.push({ time: T0 + i * 86400, open: 1, high: 1, low: 1, close: 1 + 0.001 * Math.sin(i) * (i > 280 ? 20 : 1) });
  const ymd = new Date((T0 + 299 * 86400) * 1000).toISOString().slice(0, 10), s2 = [...s, { ...s[0], time: T0 + 300 * 86400, close: 50 }];
  assert.equal(crashFlat(s, ymd).flat, true); assert.deepEqual(crashFlat(s2, ymd), crashFlat(s, ymd), 'a later candle is never read');
});

test('statistics helpers', () => {
  near(normP(0), 0.5, 1e-3); assert.ok(normP(2) < 0.025); assert.deepEqual(holm([['T1', 0.01], ['T2', 0.04]]), { T1: 0.02, T2: 0.04 });
  assert.equal(maxDD([1, -2, 3, -4, 1]), -4);
  const r = rng(1001), a = shuffled(r); assert.equal(new Set([...a.long, ...a.short]).size, 4);
  assert.equal(verdictOf({ T1: { c1: false, c2: true }, T2: { c1: true, c2: false } }).verdict, 'FAIL');
  assert.equal(verdictOf({ T1: { c1: true, c2: true, pass: false }, T2: { c1: false, c2: true } }).verdict, 'INCONCLUSIVE');
});

test('the committed result follows the pre-registered bar, and RESULT.md is the report of result.json', () => {
  assert.equal(J.revision, 2);
  for (const [k, x] of Object.entries(J.tests)) {
    assert.equal(x.c1, x.decisive.mean > 0 && x.decisive.t >= 2, k); assert.equal(x.c2, x.replication.mean > 0, k);
    assert.equal(x.c3, x.holm < 0.05, k); assert.equal(x.beat, J.placebo[k].means.filter((m) => x.decisive.mean > m).length, k);
    assert.equal(x.c4, x.beat >= 38); assert.equal(x.c5, x.decisive2x.mean > 0); assert.equal(x.pass, x.c1 && x.c2 && x.c3 && x.c4 && x.c5);
    assert.equal(J.placebo[k].means.length, 40); assert.equal(x.decisive.months, 130); assert.equal(x.replication.months, 120);
    near(x.decisive.mean, +(x.decisive.price + x.decisive.carry - x.decisive.cost).toFixed(3), 0.0021);
  }
  assert.equal(J.verdict, verdictOf(J.tests).verdict);
  assert.equal(RES, report(J));
  assert.ok(RES.includes(`**Verdict: ${J.verdict}**`));
});
