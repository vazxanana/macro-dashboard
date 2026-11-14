// Futures route map: collect every input from the study branches (PREREGISTRATION.md, sections 1-3).
//   node research/edge/futures-route-map/collect.mjs     (git show of origin/<branch>, no network; writes collected.json)
// Accounting only: nothing is run, fetched or changed. run.mjs reads only collected.json.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../..');
const DATA_COMMIT = '808e419b20a014f0cf0b28041a036fdb1c766e58';         // council-data, reference prices (pre-registered)
const showBuf = (ref, p) => execFileSync('git', ['show', `${ref}:${p}`], { cwd: ROOT, maxBuffer: 1 << 30 });
const show = (ref, p) => JSON.parse(showBuf(ref, p).toString());
const res = (b, topic = b) => show(`origin/${b}`, `research/edge/${topic}/result.json`);
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const r6 = (x) => (x == null ? null : +(+x).toFixed(6));

// ─── reference prices: median daily close over a window (section 2) ───
const daily = {};
function closes(key) {
  if (daily[key]) return daily[key];
  if (key === 'btc' || key === 'eth') {          // the daily OANDA cache has no crypto: Binance daily candles in council-data (departure, said)
    const f = key === 'btc' ? 'BTCUSDT_1d' : 'ETHUSDT_1d';
    const a = JSON.parse(gunzipSync(showBuf(DATA_COMMIT, `research/candles/crypto1d/${f}.json.gz`)).toString());
    return (daily[key] = a.map((r) => [r[0], r[4]]));
  }
  const j = JSON.parse(showBuf(DATA_COMMIT, `research/daily/${key}.json`).toString());
  return (daily[key] = j.rows.filter((r) => r[5] > 1).map((r) => [r[0], r[4]]));
}
const refs = {};
function ref(key, from, to) {
  const id = `${key}|${from}|${to}`;
  if (refs[id]) return id;
  const a = Date.parse(from) / 1000, b = Date.parse(to) / 1000 + 86400;
  const xs = closes(key).filter(([t]) => t >= a && t < b).map((r) => r[1]).sort((x, y) => x - y);
  if (!xs.length) throw new Error(`no closes for ${id}`);
  const m = xs.length >> 1;
  refs[id] = { key, from, to, days: xs.length, median: r6(xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2), src: key === 'btc' || key === 'eth' ? 'council-data research/candles/crypto1d (Binance daily)' : `council-data research/daily/${key}.json` };
  return id;
}

// ─── cost-floor-map's ranked rows (section 1) ───
const CFM = res('cost-floor-map');
const ranked = CFM.ranked.filter((r) => r.cls === 'cost-blocked' || r.cls === 'net-t2');
const cfmOf = (topic, test) => {
  const r = ranked.find((x) => x.topic === topic && x.test === test);
  if (!r) throw new Error(`not in cost-floor-map: ${topic} ${test}`);
  return { pr: r.pr, topic: r.topic, branch: r.branch, test: r.test, inst: r.inst, window: r.window, path: r.path, unit: r.unit, cls: r.cls,
    n: r.n, gross: r.gross, net: r.net, tNet: r.tNet, tGross: r.grossT, tGrossDerived: !!r.grossTDerived, s: r.s, sHow: r.sHow, cost: r.cost, fin: r.fin, trans: r.trans, transField: r.transField };
};

// CFD round trip definitions (the study's own transaction cost, never financing): { pips, pip } | { pts } | { frac } (+ comm, a fraction of price)
const FXC = (pips, pip) => ({ pips, pip, comm: 0.000045 });
const MAJ = { eurusd: 0.0001, gbpusd: 0.0001, usdjpy: 0.01, audusd: 0.0001, usdchf: 0.0001, usdcad: 0.0001 };

const tests = [];
const add = (o) => tests.push(o);

// ── gotobi family: USD/JPY, 0.3 pip spread + 0.5 pip slippage a side + 45 USD a million (each study's own rule text) ──
{
  const G = res('gotobi'), win = ['2016-01-01', '2026-11-11'];
  for (const id of ['T1', 'T2', 'T3', 'T4']) {
    const d = G.tests[id].decisive;
    add({ ...cfmOf('gotobi', id), role: 'family', family: 'gotobi', route: 'B', insts: ['usdjpy'], refs: [ref('usdjpy', ...win)],
      trans: d.costR, transSrc: `tests.${id}.decisive.costR (no financing: an intraday hold)`, C: { usdjpy: FXC(1.3, 0.01) },
      published: { n: d.n, gross: d.grossR, net: d.netR, t: d.t }, tForm: 'calendar-month sums', bar: { replicationNet: G.tests[id].replication?.grossR != null ? { gross: G.tests[id].replication.grossR, trans: G.tests[id].replication.costR, n: G.tests[id].replication.n } : null, placeboP95: G.tests[id].placebo?.p95 ?? null, holmP: G.tests[id].holmP ?? null, pOneSided: G.tests[id].pOneSided ?? null, checks: G.tests[id].checks ?? null } });
  }
  const RP = res('gotobi-replicate'), d2 = RP.r2.all;
  add({ ...cfmOf('gotobi-replicate', 'R2 USD/JPY 2005-09'), role: 'replication', family: 'gotobi', route: 'B', insts: ['usdjpy'], refs: [ref('usdjpy', '2005-01-01', '2009-12-31')],
    trans: d2.costR, transSrc: 'r2.all.costR', C: { usdjpy: FXC(1.3, 0.01) }, published: { n: d2.n, gross: d2.grossR, net: d2.netR, t: d2.t }, tForm: 'calendar-month sums' });
  add({ ...cfmOf('gotobi-replicate', 'R1 crosses pooled'), role: 'replication', family: 'gotobi', route: 'none', insts: ['yen crosses'], why: 'yen crosses (EUR/JPY and others): no route' });
  const FD = res('gotobi-feed'), h = FD.hist.all;
  add({ ...cfmOf('gotobi-feed', 'HistData USD/JPY'), role: 'robustness', family: 'gotobi', route: 'B', insts: ['usdjpy'], refs: [ref('usdjpy', '2018-01-01', '2026-11-11')],
    trans: h.costR, transSrc: 'hist.all.costR', C: { usdjpy: FXC(1.3, 0.01) }, published: { n: h.n, gross: h.grossR, net: h.netR, t: h.t }, tForm: 'calendar-month sums' });
  const MH = res('gotobi-minute-histdata'), m1 = MH.gate.m1;
  add({ ...cfmOf('gotobi-minute-histdata', 'gotobi T2 on M1'), role: 'robustness', family: 'gotobi', route: 'B', insts: ['usdjpy'], refs: [ref('usdjpy', '2018-01-01', '2026-11-11')],
    trans: m1.costR, transSrc: 'gate.m1.costR', C: { usdjpy: FXC(1.3, 0.01) }, published: { n: m1.n, gross: m1.grossR, net: m1.netR, t: m1.t }, tForm: 'calendar-month sums' });
}

// ── no route: weekend gaps and the London opening range (a cross in the pooled test) ──
add({ ...cfmOf('fx-weekend-gap', 'G'), role: 'family', family: 'weekend gap', route: 'none', insts: ['eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdchf', 'eurjpy'], why: 'EUR/JPY (a cross) is one of its six pairs; also CME Globex FX reopens on Sunday after spot FX (from memory, not opened), so the reopen entry has no futures twin' });
add({ ...cfmOf('fx-weekend-gap-replicate', 'R1'), role: 'replication', family: 'weekend gap', route: 'none', insts: ['crosses'], why: 'all six pairs are crosses (AUD/JPY, EUR/AUD, EUR/CHF, GBP/JPY, GBP/AUD, EUR/GBP)' });
add({ ...cfmOf('fx-weekend-gap-replicate2', 'S1'), role: 'replication', family: 'weekend gap', route: 'none', insts: ['crosses'], why: 'all six pairs are crosses' });
add({ ...cfmOf('fx-weekend-gap-replicate2', 'S2'), role: 'replication', family: 'weekend gap', route: 'none', insts: ['nzdusd', 'usdcad', 'crosses'], why: 'four of its six pairs are crosses (CAD/JPY, NZD/JPY, AUD/NZD, AUD/CAD)' });
for (const id of ['F1', 'F2']) add({ ...cfmOf('fx-london-orb', id), role: 'family', family: 'London opening range', route: 'none', insts: ['eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdchf', 'eurjpy'], why: 'EUR/JPY (a cross) is one of the six pairs of the pooled test (cost-floor-map\'s label "eurusd / gbpusd" is short)' });

// ── FX fixes ──
{
  const W = res('wmr-fix-reversal');
  for (const id of ['T1', 'T3']) {
    const d = W.tests[id].dec;
    add({ ...cfmOf('wmr-fix-reversal', id), role: 'family', family: 'FX fixes', route: 'B', insts: Object.keys(MAJ), weights: 'equal (no per-pair n stored)',
      refs: Object.keys(MAJ).map((k) => ref(k, '2016-01-01', '2026-10-31')), trans: d.costR, transSrc: `tests.${id}.dec.costR (no financing)`,
      C: Object.fromEntries(Object.entries(MAJ).map(([k, pip]) => [k, FXC(0.6, pip)])), published: { n: d.n, gross: d.gross, net: d.exp, t: d.t }, tForm: 'calendar-month sums' });
  }
  const E = res('ecb-ref-fix');
  for (const id of ['T1', 'T2']) {
    const d = E.tests[id].dec;
    add({ ...cfmOf('ecb-ref-fix', id), role: 'family', family: 'FX fixes', route: 'B', insts: ['eurusd'], refs: [ref('eurusd', '2016-01-01', '2026-11-13')],
      trans: d.costR, transSrc: `tests.${id}.dec.costR (no financing)`, C: { eurusd: FXC(0.6, 0.0001) }, published: { n: d.n, gross: d.gross, net: d.exp, t: d.t }, tForm: 'calendar-month sums' });
  }
  const C = res('cnh-fix'), d = C.tests.T2.dec;
  add({ ...cfmOf('cnh-fix', 'T2'), role: 'family', family: 'FX fixes', route: 'B', insts: ['usdcnh'], refs: [ref('usdcnh', '2018-01-01', '2026-11-13')],
    trans: d.costR, transSrc: 'tests.T2.dec.costR (no financing)', C: { usdcnh: FXC(6, 0.0001) }, published: { n: d.n, gross: d.gross, net: d.exp, t: d.t }, tForm: 'calendar-month sums',
    note: 'the CME USD/CNH future is thinly traded: a one-tick-a-side fill is an optimistic assumption there' });
}

// ── index overnight: overnight-drift (approx), index-overnight (#900 rows, per trade) ──
{
  const O = res('overnight-drift');
  for (const [k, pts] of [['nas100', 1.5], ['spx500', 0.5]]) {
    const d = O.markets[k].dec.night;
    add({ ...cfmOf('overnight-drift', k), role: 'family', family: 'index overnight', route: 'B', insts: [k], refs: [ref(k, '2016-01-01', '2026-10-31')],
      trans: d.spreadR, transSrc: `markets.${k}.dec.night.spreadR (financing finR ${d.finR} stored apart, dropped)`, C: { [k]: { pts } },
      published: { n: d.n, gross: d.grossR, net: d.avgR, t: d.t }, tForm: 'calendar-month sums' });
  }
}
const ROWS = JSON.parse(gunzipSync(showBuf('origin/index-futures-cost', 'research/edge/index-futures-cost/rows.json.gz')).toString());
const IFC = res('index-futures-cost');
{
  // overnight cols: date,t0,t1,entry,stop,exit,how,grossR,cfdNetR,spreadR,finR,nights
  for (const id of ['T1', 'T2']) {
    const T = ROWS.overnight.tests[id], mk = T.mk;
    const pick = (lo, hi) => T.rows.filter((r) => r[0] >= lo && r[0] <= hi).map((r) => [r[0].slice(0, 7), r[3], r[4], r6(r[7]), r6(r[8])]);
    add({ ...cfmOf('index-overnight', id), role: 'family', family: 'index overnight', route: 'A', insts: [mk], tForm: 'month sums over months with a trade',
      trades: pick('2016-01-01', '2026-10-31'), replication: pick('2005-01-01', '2015-12-31'),
      published: IFC.studies.overnight.tests[id].decisive && { n: IFC.studies.overnight.tests[id].decisive.n, gross: IFC.studies.overnight.tests[id].decisive.gross, net: IFC.studies.overnight.tests[id].decisive.cfdNet, t: IFC.studies.overnight.tests[id].decisive.t_cfdNet },
      ifc: { decisive: IFC.studies.overnight.tests[id].decisive, replication: IFC.studies.overnight.tests[id].replication, conditions: IFC.studies.overnight.conditions?.[id] ?? null, pooledOk: IFC.studies.overnight.pooledOk, verdict: IFC.studies.overnight.verdictOnFutures },
      src: 'index-futures-cost (#900) rows.json.gz, overnight (from index-overnight\'s own run.mjs)' });
  }
  // ibs cols: entryD,exitD,entry,stop,exit,how,grossR,cfdNetR,costR,finR,nights
  const T = ROWS.ibs.tests.T2, mk = T.mk, last = ROWS.ibs.lastDay;
  const pick = (lo, hi) => T.rows.filter((r) => r[0] >= lo && r[0] <= hi).map((r) => [r[0].slice(0, 7), r[2], r[3], r6(r[6]), r6(r[7])]);
  add({ ...cfmOf('index-ibs', 'T2'), role: 'family', family: 'index short-term reversal', route: 'A', insts: [mk], tForm: 'month sums over every calendar month of the window', monthsFrom: '2016-01', monthsTo: last.slice(0, 7), repMonthsFrom: '2005-01', repMonthsTo: '2015-12',
    trades: pick('2016-01-01', last), replication: pick('2005-01-01', '2015-12-31'),
    published: { n: IFC.studies.ibs.tests.T2.decisive.n, gross: IFC.studies.ibs.tests.T2.decisive.gross, net: IFC.studies.ibs.tests.T2.decisive.cfdNet, t: IFC.studies.ibs.tests.T2.decisive.t_cfdNet },
    ifc: { decisive: IFC.studies.ibs.tests.T2.decisive, replication: IFC.studies.ibs.tests.T2.replication, conditions: IFC.studies.ibs.conditions?.T2 ?? null, verdict: IFC.studies.ibs.verdictOnFutures },
    src: 'index-futures-cost (#900) rows.json.gz, ibs (from index-ibs\'s own run.mjs)' });
}

// ── index short-term reversal ──
{
  const R = res('rsi2-pullback');
  for (const k of ['spx500', 'us30']) {
    const d = R.markets[k].B;
    add({ ...cfmOf('rsi2-pullback', k), role: 'family', family: 'index short-term reversal', route: 'B', unitPct: true, insts: [k], refs: [ref(k, '2016-01-01', '2026-11-06')],
      transPct: r6(d.avgGross - d.avgRet - d.finPct), transSrc: `markets.${k}.B: avgGross - avgRet - finPct (financing stored apart, dropped)`,
      published: { n: d.n, gross: d.avgGross, net: d.avgRet, t: d.tTrades }, tForm: 'trade t (tTrades)' });
  }
  const V = res('vol-spike-rebound');
  for (const [h, name] of [['10', '10-day hold'], ['5', '5-day hold']]) {
    const d = V.holds[h].B;
    add({ ...cfmOf('vol-spike-rebound', name), role: 'family', family: 'index short-term reversal', route: 'B', unitPct: true, insts: ['spx500', 'nas100', 'us30'], weights: 'equal (no per-market n stored)',
      refs: ['spx500', 'nas100', 'us30'].map((k) => ref(k, '2016-01-01', '2026-11-06')), transPct: null, transSrc: 'not stored apart (financing and spread together): % unit, so the CFD transaction cost is not needed',
      published: { n: d.n, gross: d.avgGross, net: d.avgRet, t: d.tTrades }, tForm: 'trade t (tTrades)' });
  }
  // turnaround tuples: [entryD, exitD, how, nights, gross %, net %, net R]
  const TT = res('turnaround-tuesday');
  for (const id of ['nas100-r2', 'nas100-r1']) {
    const c = TT.cells[id];
    add({ ...cfmOf('turnaround-tuesday', id), role: 'family', family: 'index short-term reversal', route: 'A', insts: ['nas100'], refs: [ref('nas100', '2016-01-01', '2026-11-06')], tForm: 'trade t',
      tuples: c.trades.filter((t) => t[0] >= '2016-01-01').map((t) => [t[0].slice(0, 7), t[4], t[5], t[6]]), replicationTuples: c.trades.filter((t) => t[0] < '2016-01-01').map((t) => [t[0].slice(0, 7), t[4], t[5], t[6]]),
      published: { n: c.oos.n, gross: c.oos.grossR, net: c.oos.R, t: c.oos.t }, cfdFrac: { nas100: 0.0005 } });
  }
  const TR = res('turnaround-replicate'), P = TR.pool.oos;
  const mk = Object.keys(TR.markets);
  add({ ...cfmOf('turnaround-replicate', 'pooled'), role: 'replication', family: 'index short-term reversal', route: 'A', insts: mk, refs: mk.map((k) => ref(k, '2016-01-01', '2026-11-06')), tForm: 'month sums over every calendar month (131)',
    tuplesBy: Object.fromEntries(mk.map((k) => [k, TR.markets[k].trades.filter((t) => t[0] >= '2016-01-01').map((t) => [t[0].slice(0, 7), t[4], t[5], t[6]])])),
    months: P.month.months, published: { n: P.n, gross: P.grossR, net: P.R, t: P.month.t, tradeT: P.t } });
}

// ── index intraday ──
{
  const O = res('orb-nas100');
  for (const k of ['nas100', 'spx500']) {
    const d = O.markets[k].windows.B;
    add({ ...cfmOf('orb-nas100', k), role: 'family', family: 'index intraday breakout and momentum', route: 'B', insts: [k], refs: [ref(k, '2021-01-01', '2026-11-12')],
      trans: d.costR, transSrc: `markets.${k}.windows.B.costR (intraday, no financing)`, C: { [k]: { pts: O.markets[k].costPts } }, published: { n: d.n, gross: d.grossR, net: d.netR, t: d.t }, tForm: 'calendar-month sums' });
  }
  const M = res('index-midday-turn'), d = M.tests.T2.decisive;
  add({ ...cfmOf('index-midday-turn', 'T2'), role: 'family', family: 'index intraday breakout and momentum', route: 'B', insts: [M.tests.T2.market], refs: [ref(M.tests.T2.market, '2016-01-04', '2026-11-13')],
    trans: d.costR, transSrc: 'tests.T2.decisive.costR (intraday, no financing)', C: { [M.tests.T2.market]: { frac: M.costs.roundTrip } }, published: { n: d.n, gross: d.gross, net: d.net, t: d.t }, tForm: 'calendar-month sums' });
  const N = res('nr7-breakout'), B = N.variants.B.windows.decisive, NM = N.markets;
  const per = Object.fromEntries(Object.entries(B.markets).map(([k, x]) => [k, { n: x.n, gross: x.gross, net: x.net, net2: x.net2, trans: r6(x.net - x.net2) }]));
  const nrC = Object.fromEntries(Object.keys(per).map((k) => [k, { pts: NM[k].spread }]));
  add({ ...cfmOf('nr7-breakout', 'B'), role: 'family', family: 'index intraday breakout and momentum', route: 'B', insts: Object.keys(per), weights: 'per-market n',
    refs: Object.keys(per).map((k) => ref(k, '2016-01-01', '2026-11-06')), perMarket: per, trans: r6(B.pooled.net - B.pooled.net2),
    transSrc: 'variants.B.windows.decisive: net - net2 per market (net2 doubles the spread only: run.mjs costs({ mult }))', C: nrC,
    published: { n: B.pooled.n, gross: B.pooled.gross, net: B.pooled.net, t: B.pooled.t }, tForm: 'calendar-month sums' });
}

// ── scheduled-event drift ──
{
  const F = res('pre-fomc-drift'), d = F.markets.spx500.windows.B;
  add({ ...cfmOf('pre-fomc-drift', 'spx500'), role: 'family', family: 'scheduled-event drift', route: 'A', insts: ['spx500'], tForm: 'trade t',
    trades: d.trades.map((t) => [t.date.slice(0, 7), t.entry, t.stop, t.R, t.net]), published: { n: d.n, gross: d.grossR, net: d.netR, t: d.t },
    bar: { placeboP95: d.placebo.p95, placeboMean: d.placebo.mean } });
  const C = res('cb-days-other'), P = C.pooled, SYM = Object.fromEntries(C.banks.map((b) => [b.bank, b.sym]));
  const trades = [];
  for (const [bank, sym] of Object.entries(SYM)) for (const t of C.detail[bank].windows.dec.trades) trades.push([t.date.slice(0, 7), t.entry, t.stop, t.R, t.net, sym]);
  add({ ...cfmOf('cb-days-other', 'pooled five banks'), role: 'family', family: 'scheduled-event drift', route: 'A', insts: Object.values(SYM), tForm: 'month sums over every calendar month of the window',
    monthsFrom: '2018-01', monthsTo: '2026-11', trades, published: { n: P.n, gross: P.grossR, net: P.netR, t: P.monthT },
    bar: { placeboP95: P.placeboP95, repNetR: P.repNetR, repN: P.repN }, note: 'the multiple-testing family counts this study per bank; the pooled test is the one cost-floor-map ranked' });
}

// ── cross-asset lead and session drift ──
{
  const B = res('bond-lead-intraday');
  for (const [id, k] of [['T1', 'xau'], ['T2', 'usdjpy'], ['T3', 'xau']]) {
    const d = B.tests[id].windows.decisive;
    add({ ...cfmOf('bond-lead-intraday', id), role: 'family', family: 'cross-asset lead and session drift', route: 'B', insts: [k], refs: [ref(k, '2016-01-01', '2026-11-13')],
      trans: r6(d.grossAvg - d.avg), transSrc: 'grossAvg - avg (one-hour hold, no financing)', C: { [k]: k === 'xau' ? { pts: 0.3 } : { pts: 0.01, comm: 0.000045 } },
      published: { n: d.n, gross: d.grossAvg, net: d.avg, t: d.t }, tForm: 'calendar-month sums', instNote: 'cost-floor-map labelled it "spx500 / nas100 (bond lead)"; the study trades gold (T1, T3) and USD/JPY (T2) after a US 10-year move' });
  }
  const G = res('gold-session-drift'), d = G.tests.T2.decisive;
  add({ ...cfmOf('gold-session-drift', 'T2'), role: 'family', family: 'cross-asset lead and session drift', route: 'B', insts: ['xau'], refs: [ref('xau', '2020-01-01', '2026-11-11')],
    trans: r6(d.gross - d.avg), transSrc: 'gross - avg ($0.30 a round trip, 0 nights of financing)', C: { xau: { pts: 0.3 } }, published: { n: d.n, gross: d.gross, net: d.avg, t: d.t }, tForm: 'calendar-month sums' });
  const E = res('eth-btc-ratio'), t1 = E.tests[0].decisive;
  add({ ...cfmOf('eth-btc-ratio', 'test 1'), role: 'family', family: 'cross-asset lead and session drift', route: 'B', insts: ['btc', 'eth'], weights: 'equal (two legs of one spread)',
    refs: [ref('btc', '2022-01-01', '2026-10-31'), ref('eth', '2022-01-01', '2026-10-31')], trans: t1.costR, transSrc: `tests.0.decisive.costR (financing finR ${t1.finR} stored apart, dropped)`,
    C: { btc: { frac: E.costs.cfdRoundTrip + 2 * E.costs.slipEachSide }, eth: { frac: E.costs.cfdRoundTrip + 2 * E.costs.slipEachSide } }, published: { n: t1.trades, gross: t1.gross, net: t1.net, t: t1.t }, tForm: 'weekly t',
    note: 'CME crypto futures are closed at the weekend and carry a basis of several % a year (not charged, as the brief fixes)' });
}

// ── bond month-end: per trade from the tuples [entryD, exitD, entry, stop, exit, how, gross R, net R] ──
{
  const B = res('bond-month-end'), T = B.markets.usb10y.trades.filter((t) => t[0] >= '2016-01-01' && t[0] <= '2026-10-31');
  add({ ...cfmOf('bond-month-end', 'USB10Y'), role: 'family', family: 'bond month-end', route: 'A', insts: ['usb10y'], tForm: 'trade t (one a month)',
    trades: T.map((t) => [t[0].slice(0, 7), t[2], t[3], t[6], t[7]]), replication: B.markets.usb10y.trades.filter((t) => t[0] < '2016-01-01').map((t) => [t[0].slice(0, 7), t[2], t[3], t[6], t[7]]),
    published: { n: B.markets.usb10y.decisive.n, gross: B.markets.usb10y.decisive.gross ?? B.markets.usb10y.decisive.grossR, net: B.markets.usb10y.decisive.net ?? B.markets.usb10y.decisive.netR, t: B.markets.usb10y.decisive.t } });
  const RP = res('bond-month-end-replicate'), F = res('bond-month-end-futures');
  const tb = {}; for (const k of ['usb02y', 'usb05y', 'de10yb', 'uk10yb']) tb[k] = RP.markets[k].trades.map((t) => [t[0], t[2], t[3], t[6], t[7]]);
  add({ pr: null, topic: 'bond-month-end-replicate', branch: 'bond-month-end-replicate', test: 'pool', inst: 'usb02y / usb05y / de10yb / uk10yb', window: '2016 - Oct 2026', unit: 'R', cls: 'cost-blocked (added by name)',
    n: RP.primary.decisive.n, gross: RP.primary.decisive.gross, net: RP.primary.decisive.net, tNet: RP.primary.decisive.t, tGross: RP.primary.decisive.tGross,
    role: 'replication', family: 'bond month-end', route: 'A', insts: Object.keys(tb), tForm: 'one equal-weight value a month (mean of the markets that traded), trade t over the months',
    tradesBy: tb, published: { n: RP.primary.decisive.n, gross: RP.primary.decisive.gross, net: RP.primary.decisive.net, t: RP.primary.decisive.t },
    theirFutures: RP.primary.futures, bar: { placebo: RP.primary.placebo, futuresPlacebo: RP.primary.futures.placebo } });
  tests.bmFutures = { usb10y: F.markets?.usb10y?.decisive ?? null, costModel: F.costModel ?? null };
}

// ─── section 4 B: the rest of each study's own bar (read for every study that has a test in Step A's reach), and whether
// the test passed its bar at the CFD cost as published ───
const anyCfm = (topic, test) => { const r = CFM.ranked.find((x) => x.topic === topic && x.test === test); return r ? { gross: r.gross, net: r.net, tNet: r.tNet, s: r.s } : null; };
const barData = {};
{
  const G = res('gotobi');
  barData.gotobi = { bar: G.bar, refRep: ref('usdjpy', '2010-01-01', '2015-12-31'), C: FXC(1.3, 0.01),
    tests: Object.fromEntries(['T1', 'T2', 'T3', 'T4'].map((id) => [id, { rep: { n: G.tests[id].replication.n, gross: G.tests[id].replication.grossR, trans: G.tests[id].replication.costR, net: G.tests[id].replication.netR },
      placeboP95: G.tests[id].placebo.p95, pass: G.tests[id].pass, checks: G.tests[id].checks }])) };
  const RP = res('gotobi-replicate');
  barData['gotobi-replicate'] = { bar: RP.bar.r2, verdict: RP.verdict, r2Pass: RP.r2.all.netR > 0 && RP.r2.all.t >= RP.bar.r2.monthT };
  const O = res('overnight-drift');
  barData['overnight-drift'] = { checks: O.checks, us30: { ...anyCfm('overnight-drift', 'us30'), trans: O.markets.us30.dec.night.spreadR, ref: ref('us30', '2016-01-01', '2026-10-31'), C: { pts: 2.5 } },
    legs: Object.fromEntries(['nas100', 'spx500'].map((k) => [k, { night: { grossPct: O.markets[k].dec.night.grossPct, hours: O.markets[k].dec.night.hours }, day: { grossPct: O.markets[k].dec.day.grossPct, netPct: O.markets[k].dec.day.netPct, hours: O.markets[k].dec.day.hours } }])) };
  const R = res('rsi2-pullback');
  barData['rsi2-pullback'] = { markets: Object.fromEntries(['spx500', 'nas100', 'us30'].map((k) => [k, { gross: R.markets[k].B.avgGross, net: R.markets[k].B.avgRet, tTrades: R.markets[k].B.tTrades, tMonths: R.markets[k].B.tMonths,
    placeboP95: R.markets[k].B.placebo.p95, nights: R.markets[k].B.avgNights, n: R.markets[k].B.n, checks: R.markets[k].checks, ref: ref(k, '2016-01-01', '2026-11-06') }])) };
  const V = res('vol-spike-rebound');
  barData['vol-spike-rebound'] = { verdict: V.verdict, holds: Object.fromEntries(['5', '10'].map((h) => [h, { B: { n: V.holds[h].B.n, gross: V.holds[h].B.avgGross, net: V.holds[h].B.avgRet, t: V.holds[h].B.tTrades, nights: V.holds[h].B.avgNights, holmP: V.holds[h].B.holmP, random: V.holds[h].B.random },
    A: { n: V.holds[h].A.n, avgR: V.holds[h].A.avgR, gross: V.holds[h].A.avgGross, net: V.holds[h].A.avgRet } }])) };
  const TT = res('turnaround-tuesday');
  barData['turnaround-tuesday'] = { checks: TT.checks, cells: Object.fromEntries(Object.keys(TT.cells).map((k) => { const c = TT.cells[k]; return [k, { market: c.market, oos: c.oos, is: c.is, minN: c.minN, placebo: c.placebo,
    tuples: c.trades.filter((t) => t[0] >= '2016-01-01').map((t) => [t[0].slice(0, 7), t[4], t[5], t[6]]), isTuples: c.trades.filter((t) => t[0] < '2016-01-01' && t[0] >= '2008-01-01').map((t) => [t[0].slice(0, 7), t[4], t[5], t[6]]) }]; })),
    refs: { nas100: ref('nas100', '2016-01-01', '2026-11-06'), spx500: ref('spx500', '2016-01-01', '2026-11-06'), nas100IS: ref('nas100', '2008-01-01', '2015-12-31'), spx500IS: ref('spx500', '2008-01-01', '2015-12-31') } };
  const TR = res('turnaround-replicate');
  barData['turnaround-replicate'] = { checks: TR.checks, verdict: TR.verdict, placebo: TR.pool.placebo, markets: Object.fromEntries(Object.keys(TR.markets).map((k) => [k, { oos: TR.markets[k].oos, cost: TR.markets[k].cost }])) };
  const RT = show('origin/index-futures-cost', 'research/edge/index-futures-cost/rates.json');
  barData.rates = { DGS2: RT.DGS2, divYield: RT.divYield, before2006: RT.before2006, src: 'index-futures-cost (#900) rates.json (DGS2 weekly; dividend yields from memory, not verified)' };
}

// ─── the multiple-testing family (section 5) ───
const MT = res('multiple-testing-update');
const family = MT.family.rows.map((r) => [r.id, r.t, r.p]);
const withRep = MT.withReplications.rows.map((r) => [r.id, r.t, r.p]);

const out = {
  built: new Date().toISOString().slice(0, 10), dataCommit: DATA_COMMIT,
  sources: { costFloorMap: 'origin/cost-floor-map research/edge/cost-floor-map/result.json (ranked, classes cost-blocked and net-t2)',
    indexFuturesCost: 'origin/index-futures-cost rows.json.gz + result.json', bondMonthEndFutures: 'origin/bond-month-end-futures result.json',
    bondMonthEndReplicate: 'origin/bond-month-end-replicate result.json', multipleTesting: 'origin/multiple-testing-update result.json (family.rows, withReplications.rows)' },
  bmFutures: tests.bmFutures, refs, tests: tests.slice(), barData, family, withReplications: withRep,
};
writeFileSync(path.join(HERE, 'collected.json'), JSON.stringify(out));
console.log(`collected ${out.tests.length} tests, ${Object.keys(refs).length} reference prices, family ${family.length}`);
