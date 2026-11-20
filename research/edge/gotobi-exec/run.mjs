// Edge research · gotobi-exec: the gotobi study's T2 fade, unchanged, priced at the demo broker's executable quotes
// (PREREGISTRATION.md). D and the M5 stop path come from the gotobi study's own functions (research/edge/gotobi/run.mjs,
// imported, not changed); entry / exit quotes from the tick probe's `gotobi` part.
//   node research/edge/gotobi-exec/run.mjs <ticks-USDJPY.json> <usdjpy-5m.json.gz> [probeCommit]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { index, trade, stopDist, windowMove, legTimes, monthT, PIP, COMMISSION } from '../gotobi/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MAX_AGE = 60, EXTRA_SLIP = 0.3 * PIP, COST_T2 = 1.95, COST_BE = 3.73, ASSUMED = 2.0, MIN_N = 150;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const med = (a) => { const v = [...a].sort((x, y) => x - y), n = v.length; return n ? (n % 2 ? v[n >> 1] : (v[n / 2 - 1] + v[n / 2]) / 2) : null; };
const pct = (a, p) => { const v = [...a].sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(p * (v.length - 1) + 0.5))] : null; };
const r4 = (v) => (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : null);

// the executable trade of one day: sell at the 00:55 bid, buy back at the 06:00 ask, stop = bid + D on the M5 highs (mid),
// a hit filled at the stop (or a gapped open) plus half the day's measured spread
export function execTrade(ix, g, D, slip = 0) {
  const { entry: tE, exit: tX } = legTimes('fade', g.day), e = ix.at.get(tE);
  if (e == null || !(D > 0)) return null;
  const halfSp = ((g.entry.spread ?? (g.entry.ask - g.entry.bid)) + (g.exit.spread ?? (g.exit.ask - g.exit.bid))) / 4;
  const fill = g.entry.bid - slip, stop = fill + D;
  let out = g.exit.ask + slip, how = 'time';
  for (let i = e; i < ix.bars.length && ix.bars[i][0] < tX; i++) {
    const [, o, h] = ix.bars[i];
    if (o >= stop) { out = o + halfSp + slip; how = 'gap'; break; }
    if (h >= stop) { out = stop + halfSp + slip; how = 'stop'; break; }
  }
  const R = (fill - out) / D, cR = (2 * COMMISSION * fill) / D;
  return { day: g.day, entryT: tE, D, fill, exit: out, how, R, costR: cR, net: R - cR };
}
export const usableDay = (g) => !!(g && g.entry && g.exit && g.entry.bid > 0 && g.exit.ask > 0 && g.entry.ageS != null && g.entry.ageS <= MAX_AGE && g.exit.ageS != null && g.exit.ageS <= MAX_AGE);
// round-trip cost in pips at the quotes: half spread each side + commission (2 x 22.5e-6 x price)
export const costPips = (g) => ((g.entry.ask - g.entry.bid) / 2 + (g.exit.ask - g.exit.bid) / 2 + 2 * COMMISSION * g.entry.bid) / PIP;

export function summarize(tr) {
  if (!tr.length) return { n: 0 };
  const net = tr.map((t) => t.net), mt = monthT(tr);
  return { n: tr.length, netR: r4(mean(net)), grossR: r4(mean(tr.map((t) => t.R))), tradeT: tr.length > 2 ? r4(mean(net) / (sd(net) / Math.sqrt(net.length))) : null,
    monthT: mt.t == null ? null : r4(mt.t), months: mt.months, win: r4(tr.filter((t) => t.net > 0).length / tr.length), stopped: tr.filter((t) => t.how !== 'time').length };
}

export function study(probe, bars) {
  const ix = index(bars), moveOf = (d) => windowMove(ix, 'fade', d);
  const all = probe.gotobi || [], days = all.filter(usableDay), rows = [];
  for (const g of days) {
    const D = stopDist(moveOf, g.day); if (!(D > 0)) continue;
    const E = execTrade(ix, g, D), Ep = execTrade(ix, g, D, EXTRA_SLIP), M = trade(ix, 'fade', g.day, D);
    if (!E || !M) continue;
    rows.push({ day: g.day, E, Ep, M, cost: costPips(g), sp: [(g.entry.ask - g.entry.bid) / PIP, (g.exit.ask - g.exit.bid) / PIP] });
  }
  const cost = rows.map((r) => r.cost), spE = rows.map((r) => r.sp[0]), spX = rows.map((r) => r.sp[1]);
  const gE = rows.map((r) => r.E.R), gM = rows.map((r) => r.M.R), mE = mean(gE), mM = mean(gM);
  const corr = rows.length > 2 ? gE.reduce((s, v, i) => s + (v - mE) * (gM[i] - mM), 0) / Math.sqrt(gE.reduce((s, v) => s + (v - mE) ** 2, 0) * gM.reduce((s, v) => s + (v - mM) ** 2, 0)) : null;
  const E = summarize(rows.map((r) => r.E)), Ep = summarize(rows.map((r) => r.Ep)), M = summarize(rows.map((r) => r.M));
  const costMed = med(cost);
  const costVerdict = !rows.length ? 'NOT MEASURABLE: no usable day' : costMed < COST_T2 ? 'COST MEASURED: the cost does not undo the study\'s result' : 'COST MEASURED: the cost is a real threat';
  const retVerdict = rows.length < MIN_N ? `too few to judge the return (n ${rows.length} < ${MIN_N}); the cost is the finding`
    : E.netR > 0 && E.monthT >= 2 && Ep.netR > 0 ? 'PASS on executable quotes' : 'FAIL on executable quotes';
  return {
    days: { probe: all.length, usable: days.length, traded: rows.length },
    from: rows.length ? rows[0].day : null, to: rows.length ? rows[rows.length - 1].day : null,
    cost: { medianPips: r4(costMed), p90Pips: r4(pct(cost, 0.9)), maxPips: r4(cost.length ? Math.max(...cost) : null), spreadEntry: { median: r4(med(spE)), p90: r4(pct(spE, 0.9)), max: r4(spE.length ? Math.max(...spE) : null) },
      spreadExit: { median: r4(med(spX)), p90: r4(pct(spX, 0.9)), max: r4(spX.length ? Math.max(...spX) : null) }, assumed: ASSUMED, t2Line: COST_T2, breakEven: COST_BE },
    agreement: { corr: r4(corr), sameSign: r4(rows.filter((r) => Math.sign(r.E.R) === Math.sign(r.M.R)).length / (rows.length || 1)) },
    E, Ep, M, verdict: `${costVerdict} (median ${r4(costMed)} pips a round trip with commission, n ${rows.length}); return: ${retVerdict}`,
    trades: rows.map((r) => ({ day: r.day, cost: r4(r.cost), E: r4(r.E.net), M: r4(r.M.net), how: r.E.how })),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [probeFile, candleFile, commit] = process.argv.slice(2);
  const P = JSON.parse(fs.readFileSync(probeFile, 'utf8')), bars = JSON.parse(zlib.gunzipSync(fs.readFileSync(candleFile)));
  const res = study(P, bars);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'gotobi-exec', built: new Date().toISOString().slice(0, 10), probe: { at: P.at, commit: commit || null, reachDays: P.reachDays }, ...res }, null, 1));
  console.log(res.verdict); console.log(JSON.stringify({ cost: res.cost, E: res.E, Ep: res.Ep, M: res.M, agreement: res.agreement }));
}
