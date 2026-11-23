// research/edge/daily-zone-retest/run.mjs - the pre-registered study of PREREGISTRATION.md (23 Nov 2026), run as written.
// Research only: reads the shared candle cache (outside git) through the toolkit, writes result.json and trades.json here.
//   node research/edge/daily-zone-retest/run.mjs            (EDGE_DATA = the cache folder, default the toolkit's)
//
// Choices the pre-registration left open, fixed here before any result was read (and said in RESULT.md):
// - A visit holds the H1 candles from the return candle up to and including the candle that ends it (the candle again
//   wholly beyond the near side, the 120th candle, or the last H1 candle closing at or before the zone's ending Daily close).
// - "Trades into the zone" = the H1 candle's range overlaps [zone low, zone high].
// - Only the FIRST qualifying H1 box of a visit is taken; if it gives no trade (no target, entry past the stop, a position
//   already open) the visit gives none.
// - Target: the latest confirmed H1 swing (3 a side, confirmed by the breaking close) within the 500 H1 candles before the
//   entry whose price is at least 1R beyond the planned entry (the next H1 open, which is the fill).
// - Time exit: the close of the 240th H1 candle after the entry candle (counted in candles, so weekends do not count).
// - Weekly candles: dailyNY trading days grouped by the ISO week of the New York date they end on; the side = dir of the
//   last weekly box (boxesClose) whose breaking candle closed at or before the signal time.
// - Trades still open at the end of the data are left out (counted in result.json).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { financing } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const P = { strong: 1.3, meanN: 20, minBox: 2, buffer: 0.1, minR: 1, visitMax: 120, hold: 240, swingBack: 500, K: 3 };
const H1S = 3600;

// ---- detector (pure on candle arrays) ------------------------------------------------------------------------------
// D: Daily (dailyNY) candles. Returns zones { dir (-1 sell / +1 buy), lo, hi, knownT, endT (null = alive to the end), bi }.
export function dailyZones(D) {
  const out = [];
  for (const b of K.boxesClose(D)) {
    if (!b.dir || b.bi < P.meanN) continue;
    if (b.bi - b.s < P.minBox) continue; // candles s .. bi-1 inside the box
    let m = 0; for (let j = b.bi - P.meanN; j < b.bi; j++) m += D[j].h - D[j].l; m /= P.meanN;
    const bo = D[b.bi]; if (!(bo.h - bo.l >= P.strong * m)) continue;
    const a = D[b.bi - 2], c = D[b.bi - 1];
    const z = { dir: b.dir, lo: Math.min(a.l, c.l), hi: Math.max(a.h, c.h), knownT: bo.e, endT: null, bi: b.bi, date: bo.date };
    for (let j = b.bi + 1; j < D.length; j++) {
      if (z.dir < 0 ? D[j].c > z.hi : D[j].c < z.lo) { z.endT = D[j].e; break; }
    }
    out.push(z);
  }
  return out;
}

// Weekly candles from Daily (trading days); key = ISO week (Monday) of the New York date.
export function weeklyFromDaily(D) {
  const out = []; let cur = null;
  for (const d of D) {
    const day = Date.parse(d.date + 'T00:00:00Z') / 1000; const wd = (new Date(day * 1000).getUTCDay() + 6) % 7;
    const key = day - wd * 86400;
    if (!cur || cur.key !== key) { cur = { key, t: d.t, o: d.o, h: d.h, l: d.l, c: d.c, e: d.e }; out.push(cur); }
    else { cur.h = Math.max(cur.h, d.h); cur.l = Math.min(cur.l, d.l); cur.c = d.c; cur.e = d.e; }
  }
  return out;
}
export function weeklySide(wboxes, T) { // dir of the last weekly box broken by a candle closed at or before T
  let s = 0; for (const b of wboxes) { if (b.dir && b.bt <= T) s = b.dir; else if (b.bt == null || b.bt > T) break; }
  return s;
}

// Visits of one zone on H1 candles: [{ ret, end }] indexes into H1.
export function visitsOf(z, H1) {
  const out = []; let left = false, j = K.closedCount(H1, z.knownT);
  const alive = (b) => z.endT == null || b.e <= z.endT;
  const beyond = (b) => (z.dir < 0 ? b.h < z.lo : b.l > z.hi);
  const inside = (b) => b.h >= z.lo && b.l <= z.hi;
  // first candle starting at or after knownT
  while (j < H1.length && H1[j].t < z.knownT) j++;
  for (; j < H1.length && alive(H1[j]); j++) {
    const b = H1[j];
    if (!left) { if (beyond(b)) left = true; continue; }
    if (!inside(b)) continue;
    const ret = j; let end = j;
    for (let k = j; k < H1.length && alive(H1[k]); k++) {
      end = k;
      if (k > j && beyond(H1[k])) break;
      if (k - j + 1 >= P.visitMax) break;
    }
    out.push({ ret, end });
    left = beyond(H1[end]); j = end;
  }
  return out;
}

// Signals (planned trades) of one market from its 5m candles. Pure on the arrays handed in.
export function signals(m5, opts = {}) {
  const D = K.dailyNY(m5), H1 = K.resample(m5, H1S);
  const zones = dailyZones(D);
  const W = weeklyFromDaily(D), WB = K.boxesClose(W);
  const brokeAt = new Map(); for (const b of K.boxesHL(H1, P.K)) if (b.dir) brokeAt.set(b.bi, b);
  const sw = K.swings(H1, P.K); const highs = sw.filter((s) => s.type === 'H'), lows = sw.filter((s) => s.type === 'L');
  const out = [];
  for (const z of zones) {
    for (const v of visitsOf(z, H1)) {
      let box = null;
      for (let j = v.ret; j <= v.end; j++) { const b = brokeAt.get(j); if (b && b.dir === z.dir && b.hi >= z.lo && b.lo <= z.hi) { box = b; break; } }
      if (!box) continue;
      const bi = box.bi; if (bi + 1 >= H1.length) continue;
      const entry = H1[bi + 1].o, h = box.hi - box.lo;
      const stop = z.dir < 0 ? box.hi + P.buffer * h : box.lo - P.buffer * h;
      const sig = { zone: { lo: z.lo, hi: z.hi, date: z.date }, side: z.dir, signalT: H1[bi].e, t: H1[bi + 1].t, entry, stop, bi };
      if (!(z.dir * (entry - stop) > 0)) { out.push({ ...sig, skip: 'past stop' }); continue; }
      const risk = z.dir * (entry - stop);
      const pool = z.dir < 0 ? lows : highs; let target = null;
      for (let k = pool.length - 1; k >= 0; k--) {
        const s = pool[k]; if (s.ci > bi) continue; if (s.i <= bi - P.swingBack) break;
        if (z.dir * (s.price - entry) >= P.minR * risk) { target = s.price; break; }
      }
      if (target == null) { out.push({ ...sig, skip: 'no target' }); continue; }
      const endI = bi + P.hold; // past the data's end: no time exit yet (a stop or target before the end still counts)
      out.push({ ...sig, target, deadline: endI < H1.length ? H1[endI].e : null, wside: weeklySide(WB, H1[bi].e) });
    }
  }
  out.sort((a, b) => a.t - b.t || a.signalT - b.signalT);
  return { D, H1, zones, signals: out };
}

// Trades of one market: simulate on 5m, one open position at a time, costs.
export function trades(market, m5, { costMult = 1, filter = null } = {}) {
  const S = signals(m5);
  const out = []; let busy = -Infinity; const skips = {};
  for (const s of S.signals) {
    if (s.skip) { skips[s.skip] = (skips[s.skip] || 0) + 1; continue; }
    if (filter && !filter(s)) continue;
    if (s.t < busy) { skips.busy = (skips.busy || 0) + 1; continue; }
    const r = K.simulate({ side: s.side, entry: s.entry, stop: s.stop, target: s.target, t: s.t, type: 'market', maxHold: s.deadline == null ? null : s.deadline - s.t }, m5);
    if (r.status === 'bad' || r.status === 'nofill') { skips[r.reason] = (skips[r.reason] || 0) + 1; continue; }
    busy = r.exitT;
    if (r.status === 'open') { skips.open = (skips.open || 0) + 1; continue; }
    const cost = (K.COSTS[market] || 0) * costMult / r.risk;
    const fin = s.side > 0 ? financing({ market, side: 'buy', entry: r.fill, r0: r.risk, filled: r.fillT, closed: r.exitT }).finR * costMult : 0;
    out.push({ market, side: s.side > 0 ? 'buy' : 'sell', zone: s.zone, signalT: s.signalT, entryT: r.fillT, entry: r.fill, stop: s.stop,
      target: s.target, exitT: r.exitT, exit: r.exit, reason: r.reason, risk: r.risk, tgtR: Math.abs(s.target - r.fill) / r.risk,
      R: r.R, Rnet: r.R - cost - fin, wside: s.wside, withWeekly: s.wside === s.side });
  }
  return { trades: out, skips, zones: S.zones.length, signals: S.signals.length, lastDayEnd: lastCompleteDay(S.D, m5) };
}
function lastCompleteDay(D, m5) { const last = m5[m5.length - 1].e; for (let i = D.length - 1; i >= 0; i--) if (D[i].e <= last) return D[i].e; return null; }

// ---- statistics by window ------------------------------------------------------------------------------------------
const Y = (y) => Date.UTC(y, 0, 1) / 1000;
export const WIN = { REP: [Y(2010), Y(2020)], IS: [Y(2020), Y(2024)], OOS: [Y(2024), Infinity] };
export function oneSided(t, df) { if (t == null || !(df > 0)) return null; const p = K.pFromT(t, df); return t > 0 ? p / 2 : 1 - p / 2; }
export function summ(arr, key = 'Rnet') {
  const s = K.stats(arr, { key, time: 'entryT', isFrom: 1970, isTo: 1970 });
  return { n: s.n, wins: s.wins, meanR: s.meanR, total: s.total, tTrade: s.tTrade, months: s.months, tMonth: s.tMonth,
    pOneSided: oneSided(s.tMonth, s.months - 1), maxDD: s.maxDD, byYear: s.byYear };
}
export const inWin = (arr, w, oosEnd = Infinity) => arr.filter((x) => x.entryT >= WIN[w][0] && x.entryT < Math.min(WIN[w][1], w === 'OOS' ? oosEnd : Infinity));

export function judge(T, T2x, holmP) {
  const o = T.OOS, l = {
    1: o.n >= 30 && o.meanR > 0, 2: o.tMonth != null && o.tMonth >= 2 && holmP < 0.05, 3: T.IS.meanR > 0,
    4: T2x.OOS.meanR > 0, 5: T.REP.meanR > 0 && T.REP.tMonth != null && T.REP.tMonth >= 2,
  };
  let verdict = 'FAIL';
  if (l[1] && l[2] && l[3] && l[4] && l[5]) verdict = 'PASS';
  else if (o.n < 30) verdict = 'INCONCLUSIVE';
  else if (l[1] && l[2] && l[3] && l[4] && !l[5] && T.REP.meanR > 0) verdict = 'INCONCLUSIVE';
  else if (l[1] && l[3] && l[4] && l[5] && o.tMonth >= 2 && !(holmP < 0.05)) verdict = 'INCONCLUSIVE';
  return { lines: l, verdict };
}

const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);
function main() {
  const all = [], all2 = [], meta = {}; let oosEnd = Infinity;
  for (const m of K.MARKETS) {
    const m5 = K.load(m, '5m');
    const a = trades(m, m5), b = trades(m, m5, { costMult: 2 });
    meta[m] = { zones: a.zones, signals: a.signals, skips: a.skips, trades: a.trades.length, lastDayEnd: a.lastDayEnd };
    oosEnd = Math.min(oosEnd, a.lastDayEnd);
    all.push(...a.trades); all2.push(...b.trades);
    console.error(m, a.zones, 'zones', a.trades.length, 'trades');
  }
  const build = (arr) => ({ REP: summ(inWin(arr, 'REP')), IS: summ(inWin(arr, 'IS')), OOS: summ(inWin(arr, 'OOS', oosEnd)) });
  const T1 = { cost1: build(all), cost2: build(all2) };
  const f2 = (x) => x.withWeekly;
  const T2 = { cost1: build(all.filter(f2)), cost2: build(all2.filter(f2)) };
  const holmP = K.holm([T1.cost1.OOS.pOneSided, T2.cost1.OOS.pOneSided]);
  const j1 = judge(T1.cost1, T1.cost2, holmP[0]), j2 = judge(T2.cost1, T2.cost2, holmP[1]);
  const rank = { PASS: 3, INCONCLUSIVE: 2, FAIL: 1 };
  const verdict = rank[j1.verdict] >= rank[j2.verdict] ? j1.verdict : j2.verdict;
  const reported = (arr) => {
    const o = {};
    for (const m of K.MARKETS) o[m] = { REP: summ(inWin(arr.filter((x) => x.market === m), 'REP')), IS: summ(inWin(arr.filter((x) => x.market === m), 'IS')),
      OOS: summ(inWin(arr.filter((x) => x.market === m), 'OOS', oosEnd)) };
    const W = (s) => ({ REP: summ(inWin(arr.filter(s), 'REP')), IS: summ(inWin(arr.filter(s), 'IS')), OOS: summ(inWin(arr.filter(s), 'OOS', oosEnd)) });
    const before = { REP: summ(inWin(arr, 'REP'), 'R'), IS: summ(inWin(arr, 'IS'), 'R'), OOS: summ(inWin(arr, 'OOS', oosEnd), 'R') };
    const tg = arr.map((x) => x.tgtR).sort((a, b) => a - b);
    const exits = {}; for (const x of arr) exits[x.reason] = (exits[x.reason] || 0) + 1;
    return { byMarket: o, buys: W((x) => x.side === 'buy'), sells: W((x) => x.side === 'sell'), beforeCosts: before, medianTargetR: tg[tg.length >> 1], exits };
  };
  const examples = {
    eurusd_aug2026_sell: all.filter((x) => x.market === 'eurusd' && x.side === 'sell' && x.entryT >= Date.UTC(2026, 7, 17) / 1000 && x.entryT < Date.UTC(2026, 8, 5) / 1000),
    xau_nov2026_sell: all.filter((x) => x.market === 'xau' && x.side === 'sell' && x.entryT >= Date.UTC(2026, 10, 2) / 1000 && x.entryT < Date.UTC(2026, 10, 13) / 1000),
  };
  const res = {
    study: 'daily-zone-retest', built: new Date().toISOString().slice(0, 10), verdict,
    T1: { ...j1, holmP: holmP[0], ...T1 }, T2: { ...j2, holmP: holmP[1], ...T2 },
    oosEnd: new Date(oosEnd * 1000).toISOString(), markets: meta, params: P,
    reportedT1: reported(all), reportedT2: reported(all.filter(f2)),
    ownerExamples: Object.fromEntries(Object.entries(examples).map(([k, v]) => [k, v.map((x) => ({ entryT: new Date(x.entryT * 1000).toISOString(), entry: x.entry, stop: x.stop, target: x.target, zone: x.zone, R: r3(x.R), reason: x.reason }))])),
  };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? r3(v) : v), 1));
  const tr = all.filter((x) => x.entryT < oosEnd).map((x) => ({ m: x.market, s: x.side, et: x.entryT, en: +x.entry.toPrecision(7), st: +x.stop.toPrecision(7),
    tg: +x.target.toPrecision(7), xt: x.exitT, x: x.reason, R: r3(x.R), Rn: r3(x.Rnet), w: x.withWeekly ? 1 : 0 }));
  fs.writeFileSync(path.join(HERE, 'trades.json'), JSON.stringify({ fields: { m: 'market', s: 'side', et: 'entry time (unix s)', en: 'entry', st: 'stop', tg: 'target', xt: 'exit time', x: 'exit reason', R: 'R before costs', Rn: 'R after costs', w: 'with the weekly box side (T2)' }, trades: tr }));
  console.log(JSON.stringify({ verdict, T1: j1, T2: j2, holmP, T1oos: T1.cost1.OOS, T1is: T1.cost1.IS, T1rep: T1.cost1.REP, T2oos: T2.cost1.OOS }, null, 1));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
