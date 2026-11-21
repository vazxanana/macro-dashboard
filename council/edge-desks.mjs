// The LIT desk's and the Engulfing desk's trackers (21 Nov 2026, owner: "The same for LIT and the same for engulfing. Plenty of
// trades and same panel like ict"). Like the Mosha tracker (council/mosha-desk.mjs, whose candle reader, record cleaner and merge
// they share), each runs inside the council loop and RECORDS what one reading marks on five markets, so its desk shows stored
// trades with an Open now panel:
//   node council/edge-desks.mjs <council-data dir> [--days N] [--only lit|eg]   -> <dir>/lit/desk.json, <dir>/eg/desk.json
// - Engulfing: the live Gold daily engulf rule (the Trader's block: a candle closes beyond the last opposite candle of the 3
//   before it and on the right side of its 20-candle average; limit at that candle's edge, stop past its far edge, 10R, a 1R
//   trail from +2R, out after 10 candles), read on D1, H4 and H1 candles and mirrored for sells. The Trader runs it on gold's
//   daily candles, buys only, 3 orders at most: the other timeframes, the sells and the other markets are this desk's choice.
// - LIT: the council's own detector (council/lit.mjs: an M15 sweep of a level out of an accumulation, then an M5 break), with
//   the pre-registered execution where it gives an order and else the two looser "study" executions of the 8 Nov replay
//   (a limit at the order block with no quality filters, else market on the break). Costs are not charged.
// PAPER RECORD ONLY: no order, alert, broker or mirror; nothing of the Trader reads these files. Every record has a stop on
// the losing side of its entry or it is not recorded. Neither is a tested rule (the LIT study was inconclusive, the engulf's
// own book study failed its bar): never call a desk's total an edge.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeAtomic } from './jsonio.mjs';
import { foldWeekend } from './fills.mjs';
import { bars, merge } from './mosha-desk.mjs';
import { P, cleanBars, agg15, series, fbosCandidates, XAU } from './lit.mjs';
import { managePosition } from '../research/edge/lit/run.mjs';

const require = createRequire(import.meta.url);
const SOP = require(fileURLToPath(new URL('../assets/mosha-sop.js', import.meta.url)));
export const MARKETS = Object.keys(SOP.MARKETS);   // the Engulfing desk's five; the LIT desk reads every market of SOP.ALL (its setups are rarer)
const SEC = SOP.SEC, NAME = { '1d': 'D1', '4h': 'H4', '1h': 'H1', '15m': 'M15', '5m': 'M5' };
const word = (d) => (d > 0 ? 'buy' : 'sell');
const fx = (mk) => { const d = SOP.ALL[mk].dec; return (v) => (+v).toFixed(d); };

// ─── Engulfing ───
export const EG = { k: 3, life: 20, hold: 10, sma: 20, target: 10, trail: [2, 1], tfs: ['1d', '4h', '1h'] };
// one filled order on the 5-minute candles: the stop first when a candle holds both, the trail only ever tightens
export function egOutcome(tr, m5, fillI, until) {
  const d = tr.side, r0 = tr.r0, o = { status: 'open', R: null, endT: null, exit: null, mfe: 0 }; let stop = tr.stop, moved = false;
  for (let i = fillI; i < m5.length; i++) { const b = m5[i];
    if (b.time >= until) { o.status = 'time'; o.exit = b.open; o.R = d * (b.open - tr.entry) / r0; o.endT = b.time; return o; }
    if (d > 0 ? b.low <= stop : b.high >= stop) { o.status = moved ? 'trail' : 'stopped'; o.exit = stop; o.R = d * (stop - tr.entry) / r0; o.endT = b.time; return o; }
    if (d > 0 ? b.high >= tr.target : b.low <= tr.target) { o.status = 'target'; o.exit = tr.target; o.R = EG.target; o.endT = b.time; return o; }
    o.mfe = Math.max(o.mfe, d * ((d > 0 ? b.high : b.low) - tr.entry) / r0);
    if (o.mfe >= EG.trail[0]) { const ns = tr.entry + d * (o.mfe - EG.trail[1]) * r0; if (d > 0 ? ns > stop : ns < stop) { stop = ns; moved = true; } } }
  if (m5.length) o.float = d * (m5[m5.length - 1].close - tr.entry) / r0;
  o.stopNow = stop; return o;
}
export function egTrades(B, { from, market = 'xau' } = {}) {
  const m5 = B['5m'] || [], out = [], f = fx(market), end = m5.length ? m5[m5.length - 1].time + 300 : 0;
  for (const tf of EG.tfs) { const seen = new Set(), sec = SEC[tf], C = tf === '1d' ? foldWeekend(B[tf] || []) : (B[tf] || []);
    for (let m = EG.sma + EG.k; m < C.length; m++) { const last = C[m], T0 = last.time + sec; if (T0 < from || T0 > end) continue;
      const d = last.close > last.open ? 1 : last.close < last.open ? -1 : 0; if (!d) continue;
      let sma = 0; for (let j = m + 1 - EG.sma; j <= m; j++) sma += C[j].close; sma /= EG.sma;
      if (d > 0 ? !(last.close > sma) : !(last.close < sma)) continue;
      let base = null;
      for (let j = m - 1; j >= m - EG.k && j >= 0; j--) { const b = C[j]; if (d > 0 ? b.open > b.close : b.open < b.close) { if (d > 0 ? last.close > b.high : last.close < b.low) base = b; break; } }
      if (!base) continue;
      if (seen.has(d + '|' + base.time)) continue; seen.add(d + '|' + base.time);   // one order a zone: a second candle closing beyond the same candle adds nothing
      const Z = SOP.sizes(market, last.close), entry = d > 0 ? base.high : base.low, stop = d > 0 ? base.low - Z.buf : base.high + Z.buf, r0 = Math.abs(entry - stop);
      if (!(r0 > Z.rmin) || (d > 0 ? stop >= entry : stop <= entry)) continue;
      // the order's life: a close through the zone's far edge cancels it, and it expires after EG.life candles
      let dead = T0 + EG.life * sec; for (let j = m + 1; j < C.length; j++) { if (C[j].time + sec >= dead) break; if (d > 0 ? C[j].close < base.low : C[j].close > base.high) { dead = C[j].time + sec; break; } }
      let fi = -1, i0 = 0; { let lo = 0, hi = m5.length; while (lo < hi) { const q = (lo + hi) >> 1; if (m5[q].time < T0) lo = q + 1; else hi = q; } i0 = lo; }   // the first 5-minute candle at or after the order (a long history is searched, not walked)
      for (let i = i0; i < m5.length; i++) { const b = m5[i]; if (b.time >= dead) break; if (d > 0 ? b.low <= entry : b.high >= entry) { fi = i; break; } }
      if (fi < 0) continue;
      const fillT = m5[fi].time, tr = { id: `${market === 'xau' ? '' : market + ':'}eg-${tf}-${d > 0 ? 'b' : 's'}-${T0}`, market, kind: 'eg-' + tf, label: `${NAME[tf]} engulf zone`, h: tf, l: '5m', side: d, t: fillT,
        entry, stop, target: entry + d * EG.target * r0, r0 };
      const oc = egOutcome(tr, m5, fi, fillT + EG.hold * sec);
      Object.assign(tr, { status: oc.status, R: oc.R, endT: oc.endT, exit: oc.exit, mfe: oc.mfe, float: oc.float });
      tr.log = [
        { t: T0, text: `${NAME[tf]} engulf ${word(d)}: the candle closed ${d > 0 ? 'above the high' : 'below the low'} of the last ${d > 0 ? 'red' : 'green'} candle (${f(base.low)} to ${f(base.high)}) and ${d > 0 ? 'above' : 'below'} its 20-candle average ${f(sma)}. A ${word(d)} limit rests at ${f(entry)}, stop ${f(stop)}.` },
        { t: fillT, text: `Price came back to the zone: ${word(d)} ${f(entry)}, stop ${f(stop)} (risk ${f(r0)}), target ${f(tr.target)} (${EG.target}R), a 1R trail from +2R, out after ${EG.hold} ${NAME[tf]} candles.` },
        oc.status === 'target' ? { t: oc.endT, text: `Target reached: +${EG.target.toFixed(2)}R.` }
          : oc.status === 'stopped' ? { t: oc.endT, text: 'Stopped: −1.00R' + (oc.mfe >= 1 ? ` after running +${oc.mfe.toFixed(1)}R first.` : '.') }
            : oc.status === 'trail' ? { t: oc.endT, text: `Trailing stop: ${oc.R >= 0 ? '+' : '−'}${Math.abs(oc.R).toFixed(2)}R (best +${oc.mfe.toFixed(1)}R).` }
              : oc.status === 'time' ? { t: oc.endT, text: `Time limit: closed at ${f(oc.exit)}, ${oc.R >= 0 ? '+' : '−'}${Math.abs(oc.R).toFixed(2)}R.` }
                : { t: null, text: 'Still open on the last candle read' + (oc.float != null ? ` (${oc.float >= 0 ? '+' : '−'}${Math.abs(oc.float).toFixed(2)}R now` + (oc.stopNow !== stop ? `, stop trailed to ${f(oc.stopNow)}` : '') + ').' : '.') }];
      tr.marks = [{ kind: 'zone', top: base.high, bot: base.low, a: base.time, at: T0, label: `${NAME[tf]} engulf zone` }, { kind: 'level', p: sma, a: C[m + 1 - EG.sma].time, at: T0, label: '20-candle average', under: d > 0 }];
      out.push(tr); } }
  return out.sort((a, b) => a.t - b.t);
}

// ─── LIT ───
export const LIT_SETS = [
  { id: 'rule', label: 'LIT · the rule', mxReanchor: false, quality: true, minRR: P.minRR, cap: true, entry: 'limit', expiryBars: P.expiryBars },
  { id: 'loose', label: 'LIT · loose limit', mxReanchor: true, quality: false, minRR: 1.5, cap: false, entry: 'limit', expiryBars: 48 },
  { id: 'break', label: 'LIT · market on the break', mxReanchor: true, quality: false, minRR: 1.5, cap: false, entry: 'market' }];
const lowerBound = (arr, v) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; } return lo; };
// an order from an M15 candidate on the (sign-normalised, short-side) M5 series: council/lit.mjs buildOrder with the study's switches
export function litOrder(S5, cd, M, set) {
  const { h, l, c, o, t, vec, pivL, atr, body, n } = S5;
  const j0 = lowerBound(t, cd.confEnd), sIdx = lowerBound(t, cd.t), rEnd = lowerBound(t, cd.rEnd); if (j0 >= n || sIdx >= rEnd) return null;
  let mxIdx = sIdx; for (let k = sIdx; k < rEnd; k++) if (h[k] > h[mxIdx]) mxIdx = k;
  let MX = h[mxIdx];
  const swingBefore = (upto) => { for (let k = upto - 1; k >= Math.max(0, upto - 288); k--) if (pivL[k] && k + P.pivot < j0) return k; return -1; };
  const p = swingBefore(mxIdx); if (p < 0) return null;
  let level = l[p], b = -1;
  for (let k = mxIdx + 1; k <= Math.min(n - 2, mxIdx + P.rbosWait); k++) {
    if (h[k] > MX) { if (!set.mxReanchor) return null; MX = h[k]; mxIdx = k; const p2 = swingBefore(k); if (p2 >= 0) level = l[p2]; continue; }
    if (l[k] <= level) { b = k; break; } }
  if (b < 0) return null;
  if (set.quality) { if (!(vec[b] || b - mxIdx <= P.rbosFast)) return null;
    let ov = 0, cnt = 0; for (let k = mxIdx + 1; k <= b; k++) { cnt++; const rng = h[k] - l[k], inter = Math.min(h[k], h[k - 1]) - Math.max(l[k], l[k - 1]); if (rng > 0 && inter / rng > P.overlapRatio) ov++; }
    if (cnt && ov / cnt > P.overlapShare) return null; if (c[b + 1] > level) return null; }
  let d = b; for (let k = mxIdx; k <= b; k++) if (vec[k] && c[k] < o[k]) { d = k; break; }
  let ob = -1; for (let k = d - 1; k >= mxIdx; k--) if (c[k] > o[k]) { ob = k; break; }
  if (ob < 0) for (let k = Math.max(mxIdx, d - 3); k <= d - 1; k++) if (ob < 0 || body[k] < body[ob]) ob = k;
  if (ob < 0) return null;
  const jA = Math.max(j0, b + 2); if (jA >= n) return null;
  const entry = set.entry === 'market' ? c[Math.min(n - 1, b + 1)] : o[ob], stop = MX + M.stopExtra(atr[jA - 1]), risk = stop - entry; if (!(risk > 0)) return null;
  const target = cd.accLow, rr = (entry - target) / risk; if (!(rr > set.minRR)) return null;
  if (set.cap && !(risk <= P.capFrac * Math.abs(entry))) return null;
  return { jA, entry, stop, target, risk, rr, MX, b, ob, mxIdx, level, market: set.entry === 'market' };
}
// the fill (a touch of the limit, or at once for a market order) and the study's own management of the position
export function litFill(S5, M, ord, set) {
  const { h, l, o, ny, n } = S5;
  if (ord.market) { const k = Math.min(n - 1, ord.b + 1); return ny[k].hm === 930 ? null : managePosition(S5, M, ord, ord.entry, k); }
  for (let k = ord.jA; k < Math.min(n, ord.jA + set.expiryBars); k++) {
    if (ny[k].hm !== 930 && h[k] >= ord.entry) { if (l[k] <= ord.target && !(h[k] >= ord.stop)) return null; return managePosition(S5, M, ord, Math.max(ord.entry, o[k]), k); }
    if (h[k] > ord.MX || l[k] <= ord.target) return null; }
  return null;
}
const litM = (market, px) => { const q = market === 'xau' ? 1 : px / 4000, dec = SOP.ALL[market].dec;
  return market === 'xau' ? { ...XAU, cost: () => 0 } : { key: market, sym: market, tick: Math.pow(10, -dec), stopExtra: (atr5) => 0.30 * q + Math.max(0.1 * atr5, 0.30 * q), skip: XAU.skip, cost: () => 0 }; };
const LEVEL = { pd: "the previous day's", pw: "the previous week's", acc: "the accumulation's own", eqh: 'equal', ASIA: "the Asia session's", LONDON: "the London session's", NY_AM: "the New York morning's" };
export function litTrades(B, { from, market = 'xau', sets = LIT_SETS } = {}) {
  const raw = B['5m'] || []; if (!raw.length) return [];
  const M = litM(market, raw[raw.length - 1].close), b5 = cleanBars(raw, M), m15 = agg15(b5), f = fx(market), out = [], lastT = b5.length ? b5[b5.length - 1].t : 0;
  for (const dir of ['short', 'long']) { const mirror = dir === 'long', S15 = series(m15, mirror, M.tick), S5 = series(b5, mirror, M.tick), sg = S5.sign, d = dir === 'short' ? -1 : 1;
    for (const cd of fbosCandidates(S15)) { cd.confEnd = S15.t[cd.conf] + 900; cd.rEnd = S15.t[cd.r] + 900;
      let got = null;
      for (const set of sets) { const od = litOrder(S5, cd, M, set); if (!od) continue; const sim = litFill(S5, M, od, set); if (sim && sim.filled) { got = { set, od, sim }; break; } }
      if (!got) continue; const { set, od, sim } = got, fillT = sim.t + 300; if (fillT < from) continue;
      const entry = sim.fp, stop = sg * od.stop, target = sg * od.target, r0 = Math.abs(entry - stop); if (!(r0 > 0) || (d > 0 ? stop >= entry : stop <= entry)) continue;
      const open = sim.kind === 'dataEnd' && sim.tExit >= lastT, status = open ? 'open' : sim.kind === 'target' ? 'target' : sim.kind === 'stop' ? 'stopped' : sim.kind === 'be' ? 'breakeven' : 'dayend';
      let mfe = 0; for (let q = sim.k; q <= sim.exitIdx; q++) mfe = Math.max(mfe, (od.entry - S5.l[q]) / od.risk);
      const tr = { id: `${market === 'xau' ? '' : market + ':'}lit-${set.id}-${dir === 'short' ? 's' : 'b'}-${S5.t[od.jA]}`, market, kind: 'lit-' + set.id, label: set.label, h: '15m', l: '5m', side: d, t: fillT, entry, stop, target, r0,
        status, R: open ? null : sim.R, endT: open ? null : sim.tExit + 300, exit: open ? null : sim.exit, mfe, float: open ? sim.R : undefined };
      const lv = sg * cd.L, aLo = Math.min(sg * cd.accLow, sg * cd.accHigh), aHi = Math.max(sg * cd.accLow, sg * cd.accHigh), mx = sg * od.MX, obLo = Math.min(sg * S5.h[od.ob], sg * S5.l[od.ob]), obHi = Math.max(sg * S5.h[od.ob], sg * S5.l[od.ob]);
      tr.log = [
        { t: cd.t + 900, text: `M15 sweep: price ran ${d < 0 ? 'above' : 'below'} ${LEVEL[cd.kind] || cd.kind} ${d < 0 ? 'high' : 'low'} ${f(lv)} out of an accumulation of ${cd.accN} candles (${f(aLo)} to ${f(aHi)}) and closed back inside.` },
        { t: S5.t[od.b] + 300, text: `M5 break ${word(d)}: the extreme of the sweep is ${f(mx)}; the order block is ${f(obLo)} to ${f(obHi)}.` },
        { t: fillT, text: `${set.entry === 'market' ? 'Market entry on the candle after the break' : 'The limit at the order block filled'}: ${word(d)} ${f(entry)}, stop ${f(stop)} (risk ${f(r0)}), target ${f(target)} (${(Math.abs(target - entry) / r0).toFixed(1)}R, the accumulation's far side).` + (set.id === 'rule' ? '' : ' A looser execution than the rule: for study.') },
        open ? { t: null, text: `Still open on the last candle read (${sim.R >= 0 ? '+' : '−'}${Math.abs(sim.R).toFixed(2)}R now).` }
          : { t: sim.tExit + 300, text: (status === 'target' ? 'Target reached' : status === 'stopped' ? 'Stopped' : status === 'breakeven' ? 'Stopped at break-even after two swing breaks' : 'Closed at the end of the New York day') + `: ${sim.R >= 0 ? '+' : '−'}${Math.abs(sim.R).toFixed(2)}R.` }];
      tr.marks = [{ kind: 'zone', top: aHi, bot: aLo, a: S15.t[Math.max(0, cd.s - cd.accN)], at: cd.t, label: 'Accumulation' }, { kind: 'level', p: lv, a: cd.t, at: cd.t + 900, label: 'Swept level', under: d > 0 },
        { kind: 'level', p: mx, a: S5.t[od.mxIdx], at: S5.t[od.b] + 300, label: 'MX', under: d > 0 }, { kind: d < 0 ? 'vr' : 'bvr', top: obHi, bot: obLo, a: S5.t[od.ob], at: S5.t[od.b] + 300, label: 'Order block' }];
      out.push(tr); } }
  // one position at a time on a market: a later entry inside an earlier trade's life is left out
  out.sort((a, b) => a.t - b.t); const keep = []; let busy = 0;
  for (const r of out) { if (r.t < busy) continue; keep.push(r); busy = r.endT || Infinity; }
  return keep;
}

// ─── the files ───
export const DESKS = {
  eg: { tfs: ['1d', '4h', '1h', '5m'], markets: MARKETS, read: egTrades, note: 'A paper record of the desk\'s reading of the engulf rule on D1, H4 and H1 candles of five markets, buys and sells: nothing is traded, results are before costs, and it is not a tested rule.' },
  lit: { tfs: ['5m'], markets: Object.keys(SOP.ALL), read: litTrades, note: 'A paper record of the LIT detector on eleven markets, with the rule\'s execution where it gives an order and two looser study executions otherwise: nothing is traded, results are before costs, and it is not a tested rule.' } };
export function buildDesk(name, perMarket, prev, now, days) {
  let records = (prev && prev.records) || [], through = (prev && prev.through) || 0; const read = [];
  for (const [market, B] of perMarket) { if (!B['5m'] || !B['5m'].length) continue;
    const last = B['5m'][B['5m'].length - 1].time + 300, from = last - days * 86400;
    records = merge(records, DESKS[name].read(B, { from, market }), now); read.push(market); through = Math.max(through, last); }
  const s = SOP.summary(records);
  return { v: 1, desk: name, at: new Date(now * 1000).toISOString(), markets: [...new Set(records.map((r) => r.market || 'xau'))], read, feed: 'OANDA', through, days,
    since: records.length ? records[records.length - 1].t : null, counts: { n: s.n, closed: s.closed, open: s.open, live: records.filter((r) => r.src === 'live').length }, note: DESKS[name].note, records };
}
export async function main(dir, { now = Math.floor(Date.now() / 1000), days = SOP.DAYS, only = null, get = fetch } = {}) {
  const out = {};
  for (const name of Object.keys(DESKS)) { if (only && only !== name) continue;
    const file = path.join(dir, name, 'desk.json'); let prev = null;
    if (fs.existsSync(file)) { try { prev = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { console.log(`${name}/desk.json does not parse: left as it is`); continue; } }
    const per = [];
    for (const m of DESKS[name].markets) { try { const B = {}; for (const tf of DESKS[name].tfs) B[tf] = await bars(tf, now, get, days, m); per.push([m, B]); } catch (e) { console.log(`${name} desk: ${m} skipped (${e && e.message || e})`); } }
    if (!per.length) { console.log(`${name} desk: no candles, file left as it is`); continue; }
    const o = out[name] = buildDesk(name, per, prev, now, days);
    fs.mkdirSync(path.dirname(file), { recursive: true }); writeAtomic(file, JSON.stringify(o));
    console.log(`${name} desk: ${o.counts.n} records (${o.counts.open} open, ${o.counts.live} seen live), ${o.read.length} markets read`); }
  return out;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) { const a = process.argv, arg = (k) => (a.includes(k) ? a[a.indexOf(k) + 1] : null);
  main(a[2] || 'data', { days: Math.min(365, Math.max(SOP.DAYS, +(arg('--days') || process.env.DESK_DAYS) || SOP.DAYS)), only: arg('--only') }).catch((e) => { console.error('Edge desks failed: ' + (e && e.message || e)); process.exit(1); }); }
