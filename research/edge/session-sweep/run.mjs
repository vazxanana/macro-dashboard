// research/edge/session-sweep/run.mjs - the pre-registered Asia range sweep study (PREREGISTRATION.md in this folder).
// Research only: nothing live reads it. Run: node research/edge/session-sweep/run.mjs [outDir]
// Reads the overnight toolkit's M5 cache (research/edge/_lib/edgekit.mjs), writes result.json and trades.json here.
//
// Readings of the pre-registration's words, fixed before the run (written down here, never changed after a result):
// - New York local time = UTC minus the toolkit's nyOffsetH. A New York day D runs 00:00-23:59 local.
// - The QM detector runs on the M5 candles from 72 hours before D's 00:00 to the 16:00 candle of D (the toolkit's qms
//   depends only on candles up to each output; this keeps every swing it needs and keeps the run fast).
// - The two sides are watched independently inside a window: each side's setup starts at its own first sweep and is
//   cancelled when the other side is swept (sweep candle included) or the target is reached before its QM (QM candle
//   included). The window's trade is the valid setup whose QM closes first. A candle that sweeps both sides cancels both.
// - "Fresh in the New York window" counts the London candles too (00:00 up to the window's first candle).
// - "London gave none" = no trade was entered from London that day.
// - A trade whose entry candle opens beyond the stop, or that is still open at the end of the file, is not counted.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MKTS = ['xau', 'eurusd'];
export const P = { asiaFrom: 20 * 60, minAsia: 36, london: [120, 300], ny: [540, 630], exitMin: 16 * 60, qmK: 3, minRR: 1.0, warmH: 72 };

const loc = (t) => t - K.nyOffsetH(t) * 3600;
export const dayOf = (t) => Math.floor(loc(t) / 86400);              // New York date as a day number
export const minOf = (t) => Math.floor((loc(t) % 86400) / 60);        // New York minute of the day of a candle start
// UTC moment of New York local (day number d, minute m): try both offsets, keep the consistent one
export function utcOf(d, m) {
  for (const off of [4, 5]) { const u = d * 86400 + m * 60 + off * 3600; if (K.nyOffsetH(u) === off) return u; }
  return d * 86400 + m * 60 + 5 * 3600;
}

// Asia range of day D from candles (any array): starts 20:00-23:55 of D-1.
export function asiaRange(bars, D) {
  let hi = -Infinity, lo = Infinity, n = 0;
  for (const b of bars) if (dayOf(b.t) === D - 1 && minOf(b.t) >= P.asiaFrom) { n++; if (b.h > hi) hi = b.h; if (b.l < lo) lo = b.l; }
  if (n < P.minAsia || !(hi > lo)) return { ok: false, n };
  return { ok: true, n, hi, lo };
}

// One window of day D. bars = the slice (sorted), qmList = K.qms(bars, 3) on that slice. Returns the signal (known at the
// QM's close) or null, plus why.
export function windowSignal(bars, qmList, D, win, asia) {
  const [w0, w1] = win;
  const inWin = (b) => dayOf(b.t) === D && minOf(b.t) >= w0 && minOf(b.t) + 5 <= w1;
  const first = bars.findIndex(inWin);
  if (first < 0) return { sig: null, why: 'no window candles' };
  let hiFresh = true, loFresh = true;
  for (let i = 0; i < first; i++) {
    const b = bars[i]; if (dayOf(b.t) !== D) continue;
    if (b.h > asia.hi) hiFresh = false; if (b.l < asia.lo) loFresh = false;
  }
  const idx = []; for (let i = first; i < bars.length && inWin(bars[i]); i++) idx.push(i);
  const cands = [];
  for (const side of [-1, 1]) { // -1: sell after a high sweep; +1: buy after a low sweep
    if (side === -1 ? !hiFresh : !loFresh) continue;
    const si = idx.find((i) => (side === -1 ? bars[i].h > asia.hi : bars[i].l < asia.lo));
    if (si == null) continue;
    const target = side === -1 ? asia.lo : asia.hi;
    const last = idx[idx.length - 1];
    const q = qmList.find((x) => x.side === side && x.i > si && x.i <= last
      && bars[x.i].c > asia.lo && bars[x.i].c < asia.hi && (side === -1 ? x.head > asia.hi : x.head < asia.lo));
    // cancellation: other side swept (from the sweep candle) or target reached (after the sweep candle) before / at the QM
    const end = q ? q.i : last;
    let cancel = null;
    for (let i = si; i <= end; i++) {
      const b = bars[i];
      if (side === -1 ? b.l < asia.lo : b.h > asia.hi) { cancel = 'other side swept'; break; }
      if (i > si && (side === -1 ? b.l <= target : b.h >= target)) { cancel = 'target reached'; break; }
    }
    if (cancel || !q) continue;
    let ext = side === -1 ? -Infinity : Infinity;
    for (let i = si; i <= q.i; i++) ext = side === -1 ? Math.max(ext, bars[i].h) : Math.min(ext, bars[i].l);
    cands.push({ side, qmI: q.i, t: bars[q.i].e, sweepT: bars[si].t, ext, target, head: q.head, level: q.level });
  }
  if (!cands.length) return { sig: null, why: 'no setup' };
  cands.sort((a, b) => a.qmI - b.qmI);
  return { sig: cands[0], why: 'ok' };
}

// The day's trade of one market: signal -> trade on the M5 candles of the slice. cost = round trip in price units.
export function dayTrade(bars, D, cost) {
  const asia = asiaRange(bars, D);
  if (!asia.ok) return { skip: 'asia', asia };
  const qmList = K.qms(bars, P.qmK);
  const exitT = utcOf(D, P.exitMin) + 300; // close of the 16:00 candle
  const out = { asia, tries: [] };
  for (const [name, win] of [['london', P.london], ['ny', P.ny]]) {
    const { sig, why } = windowSignal(bars, qmList, D, win, asia);
    if (!sig) { out.tries.push({ win: name, why }); continue; }
    const s = sig.side;
    const stop = sig.ext + (s === -1 ? cost : -cost);
    const ei = bars.findIndex((b) => b.t >= sig.t);
    if (ei < 0) { out.tries.push({ win: name, why: 'no entry candle' }); continue; }
    const entry = bars[ei].o;
    const risk = s * (entry - stop), reward = s * (sig.target - entry);
    if (!(risk > 0)) { out.tries.push({ win: name, why: 'entry past the stop' }); continue; }
    if (!(reward > 0)) { out.tries.push({ win: name, why: 'entry past the target' }); continue; }
    if (reward / risk < P.minRR) { out.tries.push({ win: name, why: 'target under 1R' }); continue; }
    const sim = K.simulate({ side: s, entry, stop, target: sig.target, t: sig.t, type: 'market', maxHold: exitT - bars[ei].t }, bars, { cost });
    if (sim.status === 'open' || sim.status === 'bad' || sim.status === 'nofill') { out.tries.push({ win: name, why: 'sim ' + sim.status }); continue; }
    out.trade = { win: name, side: s, sig, entryT: bars[ei].t, entry, stop, target: sig.target, sim, R2: sim.R - (2 * cost) / sim.risk };
    break; // one trade a market a day, London first
  }
  return out;
}

// ---- main -----------------------------------------------------------------------------------------------------------
const r4 = (x) => (x == null || !Number.isFinite(x) ? x : Math.round(x * 1e4) / 1e4);
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16) + 'Z';

function bias(daily, d0) { // last trading day ended at or before d0: close vs 50-day average of closes (that day included)
  let k = -1; for (let i = 0; i < daily.length; i++) if (daily[i].e <= d0) k = i; else break;
  if (k < 49) return 0;
  let s = 0; for (let i = k - 49; i <= k; i++) s += daily[i].c; const m = s / 50;
  return daily[k].c > m ? 1 : daily[k].c < m ? -1 : 0;
}

export function runMarket(mk) {
  const bars = K.load(mk, '5m', { from: '2010-01-01' });
  const daily = K.dailyNY(bars);
  const cost = K.COSTS[mk];
  const firstD = dayOf(Date.UTC(2010, 0, 1) / 1000) + 1, lastD = dayOf(bars[bars.length - 1].t);
  const trades = [], days = []; let lo = 0;
  for (let D = firstD; D <= lastD; D++) {
    const wd = new Date(D * 86400e3).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const d0 = utcOf(D, 0), end = utcOf(D, P.exitMin) + 300;
    while (lo < bars.length && bars[lo].t < d0 - P.warmH * 3600) lo++;
    let hi = lo; while (hi < bars.length && bars[hi].t < end) hi++;
    const slice = bars.slice(lo, hi);
    const r = dayTrade(slice, D, cost);
    const date = new Date(D * 86400e3).toISOString().slice(0, 10);
    days.push({ date, ok: r.skip !== 'asia' });
    if (!r.trade) continue;
    const x = r.trade, sm = x.sim;
    trades.push({ market: mk, date, win: x.win, side: x.side, entryT: x.entryT, entry: r4(x.entry), stop: r4(x.stop), target: r4(x.target),
      exitT: sm.exitT, exit: r4(sm.exit), reason: sm.reason, R: r4(sm.R), Rnet: r4(sm.Rnet), R2: r4(x.R2), bias: bias(daily, d0),
      asiaHi: r4(r.asia.hi), asiaLo: r4(r.asia.lo) });
  }
  return { trades, days };
}

const winOf = (date) => (date < '2020-01-01' ? 'rep' : date < '2024-01-01' ? 'IS' : 'OOS');
function holes(days) {
  const o = {}; for (const w of ['rep', 'IS', 'OOS']) { const d = days.filter((x) => winOf(x.date) === w); o[w] = { weekdays: d.length, skipped: d.filter((x) => !x.ok).length, share: d.length ? r4(d.filter((x) => !x.ok).length / d.length) : null }; }
  return o;
}
function block(tr) {
  const k = (key) => {
    const s = K.stats(tr, { key, time: 'exitT' });
    const sl = (z) => ({ n: z.n, wins: z.wins, winRate: z.n ? r4(z.wins / z.n) : null, total: r4(z.total), meanR: r4(z.meanR), tTrade: r4(z.tTrade), tMonth: r4(z.tMonth), pMonth: r4(z.pMonth), months: z.months, maxDD: r4(z.maxDD) });
    return { all: sl(s), rep: sl(s.before), IS: sl(s.IS), OOS: sl(s.OOS), byYear: Object.fromEntries(Object.entries(s.byYear).map(([y, v]) => [y, { n: v.n, total: r4(v.total), meanR: r4(v.meanR) }])) };
  };
  return { net: k('Rnet'), cost2x: k('R2'), gross: k('R') };
}

export function main(outDir = HERE) {
  const all = [], holesBy = {}, lastBar = {};
  for (const mk of MKTS) {
    const { trades, days } = runMarket(mk);
    all.push(...trades); holesBy[mk] = holes(days); lastBar[mk] = days[days.length - 1]?.date;
  }
  all.sort((a, b) => a.entryT - b.entryT || a.market.localeCompare(b.market));
  const sets = {
    P: all, S1: all.filter((x) => x.market === 'xau'), S2: all.filter((x) => x.market === 'eurusd'),
    S3: all.filter((x) => x.bias !== 0 && x.bias === x.side),
  };
  const tests = {}; for (const [k, v] of Object.entries(sets)) tests[k] = block(v);
  const ks = Object.keys(tests);
  const adj = K.holm(ks.map((k) => tests[k].net.OOS.pMonth ?? 1));
  ks.forEach((k, i) => {
    const T = tests[k]; const o = T.net.OOS;
    const checks = { oosMean: o.meanR > 0, oosT: o.tMonth >= 2, holm: adj[i] < 0.05, isMean: T.net.IS.meanR > 0, cost2x: T.cost2x.OOS.meanR > 0, n30: o.n >= 30 };
    if (k === 'P') checks.repMean = T.net.rep.meanR > 0;
    T.holmP = r4(adj[i]); T.checks = checks; T.pass = Object.values(checks).every(Boolean);
  });
  const anyHole = Object.values(holesBy).some((h) => Object.values(h).some((w) => w.share > 0.10));
  const verdict = tests.P.net.OOS.n < 30 || anyHole ? 'INCONCLUSIVE' : tests.P.pass ? 'PASS' : 'FAIL';
  const rep = (f) => block(all.filter(f)).net;
  const exits = {}; for (const x of all) exits[x.reason] = (exits[x.reason] || 0) + 1;
  const result = {
    study: 'session-sweep', built: '2026-11-23', verdict, data: 'OANDA mid M5 (overnight toolkit cache)', lastDay: lastBar,
    windows: { replication: '2010-01-01..2019-12-31', IS: '2020-01-01..2023-12-31', OOS: '2024-01-01..' + lastBar.xau },
    costs: { xau: K.COSTS.xau, eurusd: K.COSTS.eurusd }, params: P, holes: holesBy, tests,
    reported: {
      byMarket: { xau: tests.S1.net, eurusd: tests.S2.net },
      byWindow: { london: rep((x) => x.win === 'london'), ny: rep((x) => x.win === 'ny') },
      bySide: { buy: rep((x) => x.side === 1), sell: rep((x) => x.side === -1) },
      exits, bootstrapOOS: K.bootstrapMonths(all.filter((x) => x.date >= '2024-01-01'), { key: 'Rnet', time: 'exitT' }),
    },
  };
  fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  const slim = all.map((x) => ({ ...x, entryT: iso(x.entryT), exitT: iso(x.exitT) }));
  fs.writeFileSync(path.join(outDir, 'trades.json'), JSON.stringify(slim) + '\n');
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const r = main(process.argv[2] || HERE);
  console.log(r.verdict, JSON.stringify(r.tests.P.net.OOS), JSON.stringify(r.tests.P.checks));
}
