// Desks for the passing edges (23 Nov 2026, owner: "the edges that pass make their own individual desk in the website with
// calendar and the trades from january till now"). Seven desks, each the trades ONE pre-registered study's rule gives, run by
// the desks' own tracker (council/edge-desks.mjs: candles, merge, settle, the light file + detail/<day>.json):
//   fade       grid7-wide-fade, cell "m15 none atr 2R all": fade the first M15 structure break, market at the next 5-minute open,
//              stop 1 ATR(14) of M15 from the fill, 2R, out after a day
//   bigfade    big-candle-fade, cell "m15 k1.5 nobreak half": a closed M15 candle with a body over 1.5 x ATR(14) of the 14 before it
//              and no structure break the same way, faded at the next 5-minute open, stop past its extreme + 0.1 ATR, target its 50 %
//              (only when 1R or more away), out after a day
//   roundfade  round-number-breaks, cell "fade other 2R": an M15 close beyond a round level (gold $10, silver $0.50, forex 0.0050,
//              yen 0.50) faded outside 07-17 UTC, stop past the candle's extreme + 0.1 ATR, 2R, out after a day
//   boxfade    fade-breaks-holdout, rule F1: fade an M5 box close-out of the H1-M15-M5 box chain outside 07-17 UTC, market, the
//              mirrored bottom-box stop, 1R, out after a day
//   fvg        grid7-fvg-wide, cell "1h mkt large 1R": a three-candle H1 fair-value gap larger than the market's 2005-14 median, market
//              with the gap after the first M15 close inside it, stop past its far side + 0.1 ATR, 1R, out after two days
//   goldvb     gold-vol-breakout T1 (as gold-vol-breakout-forward reads it): gold, UTC open +/- 0.5 x the previous folded day's range,
//              stop back at the open, out at 21:00 UTC
//   jpyvb      the same rule on USD/JPY (usdjpy-vol-breakout-forward)
//   nasbrk     the auto-researcher's NAS100 breakout, long (nas100-brk-long-focus): an H1 close above the 20 hours' high, above the
//              200-hour average, entry 14-21 UTC, stop 1 ATR(14), 4R, out after 96 hours, one position at a time
// Every signal, stop and exit comes from the study's own exported code (imported, never edited); only the record (id, log, marks,
// an open trade's reading) is written here. The studies judged trades before costs and so does each desk; the five fade / gap
// rules lose after costs and the two breakouts are short forward records. PAPER RECORDS ONLY: no order, alert, broker or mirror,
// nothing of the Trader reads these files, and a record without its stop on the losing side is never stored (clean()).
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { frames, buildZones } from '../research/edge/combo-grid-3/run.mjs';
import { COSTS } from '../research/edge/combo-grid-2/run.mjs';
import { atr14, startIdx } from '../research/edge/dom-trade-through/run.mjs';
import * as FADE from '../research/edge/grid7-wide-fade/run.mjs';
import * as GB from '../research/edge/gotobi/run.mjs';
import * as BIG from '../research/edge/big-candle-fade/run.mjs';
import * as RND from '../research/edge/round-number-breaks/run.mjs';
import * as BOX from '../research/edge/grid6-box-in-box/run.mjs';
import { CELLS as FB_CELLS } from '../research/edge/fade-breaks-holdout/run.mjs';
import * as FVG from '../research/edge/grid7-fvg-wide/run.mjs';
import * as GO from '../research/edge/gold-vol-breakout-hourcost/original.mjs';
import { T1 as GOLD_T1 } from '../research/edge/gold-vol-breakout-hourcost/costs.mjs';
import * as JO from '../research/edge/index-vol-breakout/original.mjs';
import { K as JPY_K } from '../research/edge/fx-vol-breakout/run.mjs';
import { toArrays, prep, atr as engAtr, sma as engSma } from '../research/edge/auto-researcher/engine.mjs';

export const STUDY_MARKETS = FADE.MARKETS;   // the ten markets of the five fade / gap grids
const DEC = { xau: 2, xag: 3, eurusd: 5, gbpusd: 5, usdjpy: 3, audusd: 5, nzdusd: 5, usdcad: 5, usdchf: 5, eurjpy: 3, gbpjpy: 3, audjpy: 3, cadjpy: 3, eurgbp: 5, euraud: 5, nas100: 1, spx500: 1, de40: 1 };
const fx = (m) => (v) => (+v).toFixed(DEC[m] ?? 5);
const word = (d) => (d > 0 ? 'buy' : 'sell');
const sg = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}R`;
const utc = (t) => new Date(t * 1000).toISOString().slice(11, 16) + ' UTC';
const pre = (m) => (m === 'xau' ? '' : m + ':');

// the desk's candles ({ time, open, high, low, close }) in the studies' shape ({ t, o, h, l, c, e })
export const toK = (B) => (B || []).map((b) => ({ t: b.time, o: +b.open, h: +b.high, l: +b.low, c: +b.close, e: b.time + 300 }));

// one position from its fill with ONE target, exactly the order of checks of the studies' exits() / manage(): after the fill candle
// an open beyond the stop exits at the open, an open beyond the target exits at the open; then the stop, then the target (on the
// fill candle only when the entry is a market one, `firstFull`), then the time limit at that candle's close. A trade the candles
// on file do not finish is open (its reading at the last close).
export function walk(M5, s, fi, fill, stop, tgt, deadline, firstFull = true) {
  const risk = s * (fill - stop); if (!(risk > 0)) return null;
  let mfe = 0;
  for (let j = fi; j < M5.length; j++) { const b = M5[j], first = j === fi;
    const done = (status, px) => ({ status, exit: px, R: (s * (px - fill)) / risk, endT: b.t, mfe });
    if (!first) { if (s * (b.o - stop) <= 0) return done('stopped', b.o); if (tgt != null && s * (b.o - tgt) >= 0) return done('target', b.o); }
    const low = s > 0 ? b.l : b.h, high = s > 0 ? b.h : b.l;
    if (s * (low - stop) <= 0) return done('stopped', stop);
    if (!(first && !firstFull)) { if (tgt != null && s * (high - tgt) >= 0) return done('target', tgt); mfe = Math.max(mfe, (s * (high - fill)) / risk); }
    if (b.e >= deadline) return done('time', b.c); }
  const last = M5[M5.length - 1];
  return { status: 'open', exit: null, R: null, endT: null, mfe, float: last ? (s * (last.c - fill)) / risk : null };
}

// one record from a fill and its management
function rec(desk, market, { idTail, kind, label, h, l = '5m', s, M5, fi, fill, stop, tgt, cap, firstFull = true, log, marks }) {
  const f = fx(market), o = walk(M5, s, fi, fill, stop, tgt, M5[fi].t + cap, firstFull); if (!o) return null;
  const r0 = Math.abs(fill - stop), t = M5[fi].t, rr = tgt == null ? null : Math.abs(tgt - fill) / r0;
  const end = o.status === 'open' ? { t: null, text: 'Still open on the last candle read' + (o.float != null ? ` (${sg(o.float)} now).` : '.') }
    : o.status === 'target' ? { t: o.endT, text: `Target reached: ${sg(o.R)}.` }
      : o.status === 'stopped' ? { t: o.endT, text: `Stopped: ${sg(o.R)}` + (o.R < -1.0001 ? ' (the candle opened beyond the stop).' : '.') }
        : { t: o.endT, text: `Time limit: closed at ${f(o.exit)}, ${sg(o.R)}.` };
  return { id: `${pre(market)}${desk}-${idTail}`, market, kind, label, h, l, side: s, t, entry: fill, stop, target: tgt, status: o.status,
    R: o.R, endT: o.endT, exit: o.exit, mfe: o.mfe, float: o.float ?? null,
    log: log.concat({ t, text: `${word(s)[0].toUpperCase() + word(s).slice(1)} at ${f(fill)}, stop ${f(stop)} (risk ${f(r0)}), ` + (tgt == null ? 'no target' : `target ${f(tgt)} (${rr.toFixed(1)}R)`) + `, out after ${cap >= 86400 ? cap / 86400 + (cap === 86400 ? ' day' : ' days') : cap / 3600 + ' hours'}.` }, end),
    marks: marks || [] };
}
const inWin = (t, from) => t >= from;
const uniq = () => { const seen = new Map(); return (id) => { const n = (seen.get(id) || 0) + 1; seen.set(id, n); return n > 1 ? `${id}-${n}` : id; }; };

// ─── fade: grid7-wide-fade, m15 none atr 2R all ───
export const FADE_CELL = { tf: 1, cx: 0, st: 1, rr: 2 };
export function fadeTrades(B, { from, market = 'xau' } = {}) {
  const M5 = toK(B['5m']); if (!M5.length) return [];
  const F = frames(M5), cost = COSTS[market], f = fx(market), out = [], id = uniq(), cap = FADE.CAP[FADE.TFS[FADE_CELL.tf]];
  for (const g of FADE.signals(F)) { if (g.tf !== FADE_CELL.tf || g.cx !== FADE_CELL.cx) continue;
    const fi = startIdx(M5, g.ts); if (fi >= M5.length || !inWin(M5[fi].t, from)) continue;
    const fill = M5[fi].o, s = -g.d, stop = fill + g.d * g.a, risk = s * (fill - stop);
    if (!(risk > 0) || risk < cost) continue;
    const T = F['15m'][g.j];
    const r = rec('fade', market, { idTail: id(`m15-${s > 0 ? 'b' : 's'}${M5[fi].t}`), kind: 'fade-m15', label: 'Fade of an M15 break', h: '15m', s, M5, fi, fill, stop, tgt: fill + s * FADE_CELL.rr * risk, cap,
      log: [{ t: g.ts, text: `An M15 candle closed ${g.d > 0 ? 'above the last swing high' : 'below the last swing low'} (a structure break ${word(g.d)}, 3 candles a side). The rule fades it: ${word(s)} at the next 5-minute open, the stop 1 ATR(14) of M15 (${f(g.a)}) from the fill, 2R.` }],
      marks: [{ kind: 'zone', top: T.h, bot: T.l, a: T.t, at: g.ts, label: 'M15 break candle' }] });
    if (r) out.push(r); }
  return out;
}

// ─── bigfade: big-candle-fade, m15 k1.5 nobreak half ───
export const BIG_CELL = { tf: 0, k: 0, brk: false };
export function bigTrades(B, { from, market = 'xau' } = {}) {
  const M5 = toK(B['5m']); if (!M5.length) return [];
  const F = frames(M5), cost = COSTS[market], f = fx(market), out = [], id = uniq(), cap = FADE.CAP[BIG.TFS[BIG_CELL.tf]];
  for (const g of BIG.signals(F).big) { if (g.tf !== BIG_CELL.tf || g.kmax < BIG_CELL.k || g.brk !== BIG_CELL.brk) continue;
    const fi = startIdx(M5, g.ts); if (fi >= M5.length || !inWin(M5[fi].t, from)) continue;
    const fill = M5[fi].o, s = -g.d, stop = g.ext + g.d * FADE.ATRK * g.a, risk = s * (fill - stop);
    if (!(risk > 0) || risk < cost) continue;
    if (!((s * (g.mid - fill)) / risk >= 1)) continue;   // the "half" exit is a cell only when the 50 % is 1R or more away
    const T = F['15m'][g.j];
    const r = rec('bigfade', market, { idTail: id(`m15-${s > 0 ? 'b' : 's'}${M5[fi].t}`), kind: 'bigfade-m15', label: 'Fade of a big M15 candle', h: '15m', s, M5, fi, fill, stop, tgt: g.mid, cap,
      log: [{ t: g.ts, text: `An M15 candle closed ${g.d > 0 ? 'up' : 'down'} with a body of ${f(Math.abs(T.c - T.o))}, over 1.5 x the ATR(14) of the candles before it (${f(g.a)}), and broke no structure the same way. The rule fades it: ${word(s)} at the next 5-minute open, the stop past its ${g.d > 0 ? 'high' : 'low'} + 0.1 ATR, the target its 50 % (${f(g.mid)}).` }],
      marks: [{ kind: 'zone', top: T.h, bot: T.l, a: T.t, at: g.ts, label: 'Big M15 candle' }, { kind: 'level', p: g.mid, a: T.t, at: g.ts, label: '50 % of the candle', under: s < 0 }] });
    if (r) out.push(r); }
  return out;
}

// ─── roundfade: round-number-breaks, fade other 2R ───
export function roundTrades(B, { from, market = 'xau' } = {}) {
  const M5 = toK(B['5m']); if (!M5.length || !RND.STEPS[market]) return [];
  const F = frames(M5), T = F['15m'], atr = atr14(T), cost = COSTS[market], f = fx(market), out = [], id = uniq();
  const [S, Bg] = RND.STEPS[market], ratio = Math.round(Bg / S);
  for (const ev of RND.events(T, atr, { off: 0, S, ratio })) { if (ev.type !== 'cross') continue;
    const fi = startIdx(M5, ev.ts); if (fi >= M5.length || !inWin(M5[fi].t, from) || FADE.sessionOf(M5[fi].t) !== 2) continue;
    const fill = M5[fi].o, s = -ev.d, stop = ev.ext + ev.d * RND.ATRK * ev.a, risk = s * (fill - stop);
    if (!(risk > 0) || risk < cost) continue;
    const r = rec('roundfade', market, { idTail: id(`m15-${s > 0 ? 'b' : 's'}${M5[fi].t}`), kind: 'roundfade-m15', label: `Fade of a round ${ev.big ? 'big' : 'small'} level`, h: '15m', s, M5, fi, fill, stop, tgt: fill + 2 * s * risk, cap: RND.CAP,
      log: [{ t: ev.ts, text: `An M15 candle closed ${ev.d > 0 ? 'above' : 'below'} the round level ${f(ev.L)} (${ev.big ? 'a big' : 'a small'} round number) outside 07-17 UTC. The rule fades it: ${word(s)} at the next 5-minute open, the stop past the candle's ${ev.d > 0 ? 'high' : 'low'} + 0.1 ATR, 2R.` }],
      marks: [{ kind: 'level', p: ev.L, a: T[ev.j].t, at: ev.ts, label: 'Round level', under: s > 0 }] });
    if (r) out.push(r); }
  return out;
}

// ─── boxfade: fade-breaks-holdout F1 (the grid6-box-in-box placebo cell: the trade mirrored) ───
export function boxTrades(B, { from, market = 'xau' } = {}) {
  const M5 = toK(B['5m']); if (!M5.length) return [];
  const F = frames(M5), cost = COSTS[market], c = FB_CELLS.F1, f = fx(market), out = [], id = uniq(), cap = BOX.CAPS[c.ch];
  for (const sg0 of BOX.signals(F, { from, to: Infinity })) {
    if (sg0.ch !== c.ch || sg0.trig !== c.trig || sg0.sess !== c.sess) continue;
    const d = sg0.d, buf = cost / 2, ts = sg0.ts, stopR = d > 0 ? sg0.box.lo - buf : sg0.box.hi + buf;
    if (!(d * (sg0.c0 - stopR) >= 2 * cost)) continue;
    const s = -d, sp = 2 * sg0.c0 - stopR, fi = startIdx(M5, ts); if (fi >= M5.length || !inWin(M5[fi].t, from)) continue;
    const fill = M5[fi].o, risk = s * (fill - sp); if (!(risk > 0) || !(risk >= cost)) continue;
    const r = rec('boxfade', market, { idTail: id(`m5-${s > 0 ? 'b' : 's'}${M5[fi].t}`), kind: 'boxfade-m5', label: 'Fade of an M5 box close-out', h: '5m', s, M5, fi, fill, stop: sp, tgt: fill + s * risk, cap,
      log: [{ t: ts, text: `An M5 box (${f(sg0.box.lo)} to ${f(sg0.box.hi)}) closed out ${d > 0 ? 'up' : 'down'}, the same way as the last H1 box close-out, outside 07-17 UTC. The rule fades it: ${word(s)} at the next 5-minute open, the stop the box's stop mirrored around that close, 1R.` }],
      marks: [{ kind: 'zone', top: sg0.box.hi, bot: sg0.box.lo, a: ts - 300, at: ts, label: 'M5 box' }] });
    if (r) out.push(r); }
  return out;
}

// ─── fvg: grid7-fvg-wide, 1h mkt large 1R ───
let MED = null;
export function fvgMedians() {
  if (MED) return MED;
  const j = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../research/edge/grid7-fvg-wide/result.json', import.meta.url)), 'utf8'));
  MED = Object.fromEntries(j.meta.map((m) => [m.market, m.medians])); return MED;
}
export function fvgTrades(B, { from, market = 'xau' } = {}) {
  const M5 = toK(B['5m']), med = fvgMedians()[market]; if (!M5.length || !med) return [];
  const cost = COSTS[market], f = fx(market), out = [], id = uniq(), g1 = FVG.GTF.indexOf('1h'), cap = FVG.CAP['1h'];
  const G = K.resample(M5, 3600);
  for (const sg0 of FVG.signals(M5, market, med).sigs) {
    if (sg0.ctl || sg0.g !== g1 || sg0.kind !== 0 || !sg0.large) continue;
    if (!inWin(M5[sg0.fi].t, from)) continue;
    const risk = sg0.s * (sg0.fill - sg0.stop); if (!(risk > 0) || risk < cost) continue;
    const gi = G.findIndex((x) => x.e === sg0.bt), gc = gi >= 2 ? [G[gi - 2], G[gi]] : null;
    const top = gc ? (sg0.s > 0 ? gc[1].l : gc[0].l) : null, bot = gc ? (sg0.s > 0 ? gc[0].h : gc[1].h) : null;
    const r = rec('fvg', market, { idTail: id(`h1-${sg0.s > 0 ? 'b' : 's'}${sg0.bt}-${M5[sg0.fi].t}`), kind: 'fvg-h1', label: 'H1 gap, market entry', h: '1h', l: '15m', s: sg0.s, M5, fi: sg0.fi, fill: sg0.fill, stop: sg0.stop, tgt: sg0.fill + sg0.s * risk, cap, firstFull: sg0.firstFull,
      log: [{ t: sg0.bt, text: `A three-candle H1 fair-value gap ${word(sg0.s)}` + (top != null ? ` (${f(bot)} to ${f(top)})` : '') + `, larger than this market's 2005-14 median gap.` },
        { t: sg0.et, text: `The first M15 candle closed inside the gap: ${word(sg0.s)} at the next 5-minute open, the stop past the gap's far side + 0.1 ATR, 1R.` }],
      marks: top != null && top > bot ? [{ kind: 'zone', top, bot, a: gc[0].t, at: sg0.bt, label: 'H1 gap' }] : [] });
    if (r) out.push(r); }
  return out;
}

// ─── goldvb / jpyvb: the T1 breakout of the two forward records ───
// days from the M5 candles with the study's own buildDays / daySkip / vbTrade; a day whose 21:00 UTC has not come is read up to
// its last candle: a filled trade not stopped yet is open (the study itself waits for the whole day).
function vbDays(Bk, O, desk, market, k, from, sec = 300) {
  const rows = Bk.map((b) => [b.t, b.o, b.h, b.l, b.c]); if (!rows.length) return [];
  const lastEnd = rows[rows.length - 1][0] + sec, f = fx(market), out = [];
  for (const d of O.buildDays(rows)) {
    if (d.d0 + 86400 <= from) continue;
    const forming = d.d0 + O.EXIT_S > lastEnd, why = O.daySkip(d);
    if (why && !(forming && why === 'thin')) continue;
    const x = O.vbTrade(d.bars, { k, sides: 'both', prevRange: d.prevRange, cost: 0 }); if (x.skip) continue;
    const s = x.side, r0 = x.r, open = forming && x.how === 'time';
    // the exit candle, the order of checks of the study's walk(): the fill candle when it touched the stop, else the first later
    // candle that opens beyond the stop or touches it; a time exit is the last candle before 21:00 UTC
    const fj = d.bars.findIndex((b) => b.t === x.fillT), hit = (b) => (s > 0 ? b.l <= x.stop : b.h >= x.stop);
    let exitT = d.bars[d.bars.length - 1].t;
    if (x.how === 'stop') { exitT = x.fillT; if (!hit(d.bars[fj])) for (let j = fj + 1; j < d.bars.length; j++) { const b = d.bars[j]; if (s * (b.o - x.stop) <= 0 || hit(b)) { exitT = b.t; break; } } }
    const last = d.bars[d.bars.length - 1];
    const tr = { id: `${pre(market)}${desk}-${s > 0 ? 'b' : 's'}${x.fillT}`, market, kind: `${desk}-t1`, label: 'Open ± ½ the previous range', h: '1d', l: '5m', side: s, t: x.fillT,
      entry: x.entry, stop: x.stop, target: null, status: open ? 'open' : x.how === 'stop' ? 'stopped' : 'time', R: open ? null : x.R,
      endT: open ? null : exitT, exit: open ? null : x.exit, mfe: null, float: open ? (s * (last.c - x.entry)) / r0 : null,
      log: [{ t: d.d0, text: `The UTC day opened at ${f(x.open)}; the previous day's range (weekend folded in) was ${f(d.prevRange)}, so the day's levels are ${f(x.up)} above and ${f(x.dn)} below (0.5 x the range).` },
        { t: x.fillT, text: `Price traded through ${f(s > 0 ? x.up : x.dn)} at ${utc(x.fillT)}: ${word(s)} at ${f(x.entry)}, the stop back at the open ${f(x.stop)} (risk ${f(r0)}), no target, out at 21:00 UTC.` },
        open ? { t: null, text: `Still open on the last candle read (${sg((s * (last.c - x.entry)) / r0)} now).` }
          : x.how === 'stop' ? { t: exitT, text: `Stopped at the day's open: ${sg(x.R)}.` } : { t: d.d0 + O.EXIT_S, text: `Out at 21:00 UTC at ${f(x.exit)}: ${sg(x.R)}.` }],
      marks: [{ kind: 'level', p: x.open, a: d.d0, at: d.d0, label: 'UTC open', under: s > 0 }, { kind: 'level', p: x.up, a: d.d0, at: d.d0, label: 'Open + ½ range' }, { kind: 'level', p: x.dn, a: d.d0, at: d.d0, label: 'Open − ½ range', under: true }] };
    if (tr.t >= from) out.push(tr); }
  return out;
}
export const goldTrades = (B, { from, market = 'xau' } = {}) => (market === 'xau' ? vbDays(toK(B['5m']), GO, 'goldvb', 'xau', GOLD_T1.k, from) : []);
export const jpyTrades = (B, { from, market = 'usdjpy' } = {}) => (market === 'usdjpy' ? vbDays(toK(B['5m']), JO, 'jpyvb', 'usdjpy', JPY_K, from) : []);

// ─── nasbrk: the auto-researcher's NAS100 breakout, long (nas100-brk-long-focus; owner, 25 Nov 2026: "make it an edge for equinox") ───
// The rule of the study, signals on H1 candles built from the 5-minute ones (the studies' way): the close of H1 bar i is above the highest
// high of the 20 bars before it and above the 200-bar average, the NEXT bar opens 14:00-21:59 UTC: long at that open, stop 1 ATR(14)
// (Wilder, of H1) below it, target 4R, out after 96 hours, one position at a time (a signal waits until the hour after the last
// trade's exit). The study managed a trade on hourly candles with the stop first when one holds both; the desk reads the 5-minute
// candles like every desk, so the order inside an hour is read exactly. Before costs (the research ran at none: futures).
export const NASBRK = { N: 20, ma: 200, hours: [14, 22], stop: 1, rr: 4, hold: 96 };
export function nasbrkTrades(B, { from, market = 'nas100' } = {}) {
  if (market !== 'nas100') return [];
  const M5 = toK(B['5m']); if (M5.length < 3000) return [];
  const endAll = M5[M5.length - 1].e, H = K.resample(M5, 3600).filter((b) => b.n >= 10 && b.e <= endAll); if (H.length < 260) return [];
  const D = prep(toArrays(H.map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c }))), market), A = engAtr(D), MA = engSma(D.c, NASBRK.ma);
  const firstM5 = new Map(); M5.forEach((b, k) => { const h = Math.floor(b.t / 3600) * 3600; if (!firstM5.has(h)) firstM5.set(h, k); });
  const f = fx(market), id = uniq(), out = []; let freeT = -Infinity;
  for (let i = Math.max(NASBRK.ma + 10, NASBRK.N); i < D.n; i++) {
    const entryT = i + 1 < D.n ? D.t[i + 1] : D.t[i] + 3600; if (entryT < freeT) continue;
    const hr = new Date(entryT * 1000).getUTCHours(); if (!(hr >= NASBRK.hours[0] && hr < NASBRK.hours[1])) continue;
    let hi = -Infinity; for (let k = i - NASBRK.N; k < i; k++) if (D.h[k] > hi) hi = D.h[k];
    if (!(D.c[i] > hi) || !(MA[i] === MA[i]) || !(D.c[i] > MA[i])) continue;
    const a = A[i]; if (!(a > 0)) continue;
    const fi = firstM5.get(entryT); if (fi == null) continue;
    const fill = M5[fi].o, stop = fill - NASBRK.stop * a, tgt = fill + NASBRK.rr * NASBRK.stop * a;
    const r = rec('nasbrk', market, { idTail: id(`b${M5[fi].t}`), kind: 'nasbrk-h1', label: 'H1 20-hour breakout, long', h: '1h', l: '1h', s: 1, M5, fi, fill, stop, tgt, cap: NASBRK.hold * 3600,
      log: [{ t: H[i].e, text: `An H1 candle closed at ${f(D.c[i])}, above the highest high of the 20 hours before it (${f(hi)}) and above its 200-hour average (${f(MA[i])}). The next hour (${String(hr).padStart(2, '0')}:00 UTC) is inside the rule's 14:00-22:00 window: buy at that open, the stop 1 ATR(14) of H1 (${f(a)}) below, 4R.` }],
      marks: [{ kind: 'level', p: hi, a: H[i - NASBRK.N].t, at: H[i].e, label: '20-hour high' }, { kind: 'level', p: MA[i], a: H[i - NASBRK.N].t, at: H[i].e, label: '200-hour average', under: true }] });
    if (!r) continue;
    freeT = r.status === 'open' ? Infinity : Math.floor(r.endT / 3600) * 3600 + 3600;
    if (r.t >= from) out.push(r);
  }
  return out;
}


// ─── lyriac: the passing rules as one desk (24 Nov 2026, owner: "build as new edge called Lyriac and put it in equinox") ───
// The three intraday rules of research/edge/passing-rules-book that pass their tests, each with its own study's code: the gold
// breakout T1, the USD/JPY breakout T1 (vbDays, above) and the gotobi fade T2 on USD/JPY (research/edge/gotobi: on a gotobi day
// sell at the 00:55 UTC open, stop 1.5 x the median absolute move of that window over the 20 Tokyo business days before, out at
// 06:00 UTC). The book's two small rules (gold before a US holiday, the Nasdaq Tuesday) are not here: other markets and calendars.
export function gotobiTrades(B, { from, market = 'usdjpy' } = {}) {
  if (market !== 'usdjpy') return [];
  const M5 = toK(B['5m']); if (!M5.length) return [];
  const rows = M5.map((b) => [b.t, b.o, b.h, b.l, b.c]), ix = GB.index(rows), f = fx('usdjpy'), out = [], lastEnd = M5[M5.length - 1].e;
  const moveOf = (d) => GB.windowMove(ix, 'fade', d), ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
  const set = GB.gotobiSet(+ymd(from).slice(0, 4), +ymd(lastEnd).slice(0, 4));
  for (let d = ymd(from); d <= ymd(lastEnd); d = GB.addD(d, 1)) { if (!set.has(d)) continue;
    const { entry, exit } = GB.legTimes('fade', d); if (entry < from) continue;
    const D = GB.stopDist(moveOf, d), e = GB.entryPx(ix, entry); if (!(D > 0) || !e) continue;
    const stop = e.px + D; let how = null, px = null, endT = null, last = null;
    for (let i = e.i; i < rows.length && rows[i][0] < exit; i++) { const [t, o, h] = rows[i]; last = rows[i];   // the study's trade(): a gap at the open, then the stop
      if (o >= stop) { how = 'gap'; px = o; endT = t; break; } if (h >= stop) { how = 'stop'; px = stop; endT = t; break; } }
    if (!how) { const xp = lastEnd > exit - 1 ? GB.exitPx(ix, exit) : null; if (xp != null) { how = 'time'; px = xp; endT = exit; } }
    if (!how && lastEnd >= exit + GB.EXIT_GRACE) continue;                                   // the exit candle never came: the study has no trade that day
    const open = !how, R = open ? null : -(px - e.px) / D, fl = open && last ? -(last[4] - e.px) / D : null;
    out.push({ id: `usdjpy:lyriac-g-s${entry}`, market: 'usdjpy', kind: 'lyriac-gotobi', label: 'Gotobi fade', h: '1d', l: '5m', side: -1, t: entry,
      entry: e.px, stop, target: null, status: open ? 'open' : how === 'time' ? 'time' : 'stopped', R, endT: open ? null : endT, exit: open ? null : px, mfe: null, float: fl,
      log: [{ t: entry, text: `${d} is a gotobi day (a Japanese settlement day). The rule sells USD/JPY at the 00:55 UTC open ${f(e.px)}, the stop ${f(stop)} (1.5 x the median move of this window over the 20 Tokyo business days before: ${f(D)}), no target, out at 06:00 UTC.` },
        open ? { t: null, text: `Still open on the last candle read (${sg(fl)} now).` } : how === 'time' ? { t: exit, text: `Out at 06:00 UTC at ${f(px)}: ${sg(R)}.` } : { t: endT, text: `Stopped: ${sg(R)}` + (how === 'gap' ? ' (the candle opened beyond the stop).' : '.') }],
      marks: [{ kind: 'level', p: e.px, a: entry, at: entry, label: '00:55 UTC open', under: true }] }); }
  return out;
}
export const lyriacTrades = (B, { from, market = 'xau' } = {}) => (market === 'xau' ? vbDays(toK(B['5m']), GO, 'lyriac', 'xau', GOLD_T1.k, from)
  : market === 'usdjpy' ? vbDays(toK(B['5m']), JO, 'lyriac', 'usdjpy', JPY_K, from).concat(gotobiTrades(B, { from, market })) : []);


// ─── dom: the H1 dominant-zone limit, as council/dom-demo.mjs reads it ───
// The demo job's own constants (tests/edge-desks-2.test.mjs compares them with council/dom-demo.mjs, which is not imported here:
// it carries the cTrader order code). Zones: combo-grid-3 buildZones('dom') on CLOSED H1 candles (the job's read()). At the close
// of every 5-minute candle the job's arming rule is applied (the job runs about every minute): a standing zone on the right side
// of the price whose near edge is within 1 x ATR(14) of H1, one order per zone ever, at most 3 orders + positions a market; the
// limit at the near edge, the stop past the far side by half the round trip + 0.25 x ATR, 2R; it rests 24 h and is cancelled once
// its zone no longer stands. A fill is read on the 5-minute candles (on the fill candle only the stop counts), then stop or target
// (stop first in one candle), no time limit. Not modelled: the job's 20-a-account cap across markets and its stale-market pause.
export const DOM = { RR: 2, ATR_K: 0.25, NEAR_ATR: 1, LIFE_S: 24 * 3600, MAX_MARKET: 3 };
export const DOM_MARKETS = ['xau', 'xag', 'eurusd', 'gbpusd', 'audusd', 'nzdusd', 'usdjpy', 'usdcad', 'usdchf', 'eurjpy', 'gbpjpy', 'audjpy', 'cadjpy', 'eurgbp', 'euraud', 'nas100', 'spx500', 'de40'];
export function domPlan(z, atr, cost) {   // the job's plan(), the same arithmetic
  const s = z.side === 'buy' ? 1 : -1, entry = s > 0 ? z.top : z.bot, pad = cost / 2 + DOM.ATR_K * atr, stop = s > 0 ? z.bot - pad : z.top + pad, risk = Math.abs(entry - stop);
  if (!(risk > 0)) return null;
  return { entry, stop, target: entry + s * DOM.RR * risk, risk };
}
const domAtr = (L, k) => { if (k < 14) return null; let s = 0; for (let i = k - 13; i <= k; i++) s += Math.max(L[i].h - L[i].l, Math.abs(L[i].h - L[i - 1].c), Math.abs(L[i].l - L[i - 1].c)); return s / 14; };
export function domTrades(B, { from, market = 'xau' } = {}) {
  const M5 = toK(B['5m']); if (!M5.length || COSTS[market] == null) return [];
  const endT = M5[M5.length - 1].e, H = K.resample(M5, 3600).filter((b) => b.e <= endT), cost = COSTS[market], f = fx(market), out = [];
  const Z = H.length >= 2 ? buildZones('dom', H).map((z) => ({ side: z.d > 0 ? 'buy' : 'sell', bot: z.bot, top: z.top, t: H[z.i - 1].t, formed: z.at, end: z.end })) : [];
  Z.sort((a, b) => a.formed - b.formed);
  const armed = new Set(), orders = [], live = []; let zp = 0, hk = -1; const act = [];
  for (let i = 0; i < M5.length; i++) { const b = M5[i], T = b.e;
    // resting orders on this candle: expiry, the zone gone, else a touch fills the limit
    for (let q = orders.length - 1; q >= 0; q--) { const o = orders[q];
      if (b.t >= o.expires || b.t >= o.z.end) { orders.splice(q, 1); continue; }
      const s = o.s, hit = s > 0 ? b.l <= o.p.entry : b.h >= o.p.entry; if (!hit) continue;
      orders.splice(q, 1); const w = walk(M5, s, i, o.p.entry, o.p.stop, o.p.target, Infinity, false); if (!w) continue;
      live.push({ until: w.endT == null ? Infinity : w.endT + 300 });
      if (b.t >= from) out.push({ o, i, w }); }
    // arming at this candle's close
    while (hk + 1 < H.length && H[hk + 1].e <= T) hk++;
    while (zp < Z.length && Z[zp].formed <= T) act.push(Z[zp++]);
    if (hk < 14) continue;
    const atr = domAtr(H, hk), price = b.c; if (!(atr > 0)) continue;
    for (let q = act.length - 1; q >= 0; q--) if (act[q].end <= T) act.splice(q, 1);
    for (const z of act) { const id = `${z.side}-${z.t}`; if (armed.has(id)) continue;
      if (!(z.side === 'buy' ? price > z.top && price - z.top <= DOM.NEAR_ATR * atr : price < z.bot && z.bot - price <= DOM.NEAR_ATR * atr)) continue;
      const busy = orders.length + live.filter((x) => x.until > T).length; if (busy >= DOM.MAX_MARKET) break;
      const p = domPlan(z, atr, cost); if (!p) continue; armed.add(id);
      orders.push({ z, p, s: z.side === 'buy' ? 1 : -1, placed: T, expires: T + DOM.LIFE_S, atr }); } }
  return out.map(({ o, i, w }) => { const z = o.z, s = o.s, r0 = Math.abs(o.p.entry - o.p.stop);
    const end = w.status === 'open' ? { t: null, text: 'Still open on the last candle read' + (w.float != null ? ` (${sg(w.float)} now).` : '.') }
      : w.status === 'target' ? { t: w.endT, text: `Target reached: ${sg(w.R)}.` } : { t: w.endT, text: `Stopped: ${sg(w.R)}` + (w.R < -1.0001 ? ' (the candle opened beyond the stop).' : '.') };
    return { id: `${pre(market)}dom-${z.side === 'buy' ? 'b' : 's'}${z.t}`, market, kind: 'dom-h1', label: `H1 DOM ${z.side} zone`, h: '1h', l: '5m', side: s, t: M5[i].t,
      entry: o.p.entry, stop: o.p.stop, target: o.p.target, status: w.status, R: w.R, endT: w.endT, exit: w.exit, mfe: w.mfe, float: w.float ?? null,
      log: [{ t: z.formed, text: `Two ${s > 0 ? 'green' : 'red'} H1 candles, the second closing ${s > 0 ? 'above the high' : 'below the low'} of the first: a DOM ${z.side} zone on the first candle's body (${f(z.bot)} to ${f(z.top)}).` },
        { t: o.placed, text: `Price ${s > 0 ? 'above' : 'below'} the zone within 1 ATR(14) of H1 (${f(o.atr)}): a ${z.side} limit at ${f(o.p.entry)}, stop ${f(o.p.stop)} (past the far side by half the round trip + 0.25 ATR, risk ${f(r0)}), target ${f(o.p.target)} (2R), good for 24 hours.` },
        { t: M5[i].t, text: `The limit filled at ${f(o.p.entry)}.` }, end],
      marks: [{ kind: 'zone', top: z.top, bot: z.bot, a: z.t, at: z.formed, label: `H1 DOM ${z.side} zone` }] }; });
}

// the desks, as council/edge-desks.mjs DESKS entries (only 5-minute candles are read: every higher timeframe is built from them,
// the studies' own way)
const PAPER = ' Nothing is traded and results are before costs; a paper record of the rule, not a trade signal.';
export const DESKS2 = {
  fade: { tfs: ['5m'], markets: STUDY_MARKETS, read: fadeTrades, note: 'Break fade: the first M15 structure break faded at the next 5-minute open, stop 1 ATR, 2R, out after a day (grid7-wide-fade, cell m15 none atr 2R all), on ten markets.' + PAPER },
  bigfade: { tfs: ['5m'], markets: STUDY_MARKETS, read: bigTrades, note: 'Big-candle fade: an M15 candle with a body over 1.5 ATR and no break the same way, faded to its 50 % (big-candle-fade, cell m15 k1.5 nobreak half), on ten markets.' + PAPER },
  roundfade: { tfs: ['5m'], markets: STUDY_MARKETS, read: roundTrades, note: 'Round-number fade: an M15 close beyond a round level faded outside 07-17 UTC, 2R (round-number-breaks, cell fade other 2R), on ten markets.' + PAPER },
  boxfade: { tfs: ['5m'], markets: STUDY_MARKETS, read: boxTrades, note: 'Box fade: an M5 box close-out of the H1-M15-M5 box chain faded outside 07-17 UTC, 1R (fade-breaks-holdout, rule F1), on ten markets.' + PAPER },
  fvg: { tfs: ['5m'], markets: STUDY_MARKETS, read: fvgTrades, note: 'FVG return: a large H1 fair-value gap entered with it after the first M15 close inside it, 1R (grid7-fvg-wide, cell 1h mkt large 1R), on ten markets.' + PAPER },
  goldvb: { tfs: ['5m'], markets: ['xau'], read: goldTrades, note: 'Gold breakout: gold\'s UTC open +/- 0.5 x the previous day\'s range, stop back at the open, out at 21:00 UTC (gold-vol-breakout T1).' + PAPER },
  jpyvb: { tfs: ['5m'], markets: ['usdjpy'], read: jpyTrades, note: 'USD/JPY breakout: the same rule on USD/JPY (usdjpy-vol-breakout-forward).' + PAPER },
  nasbrk: { tfs: ['5m'], extra: { '5m': 60 }, markets: ['nas100'], read: nasbrkTrades, note: 'NAS100 breakout: the auto-researcher\'s lead, an H1 close above the 20 hours\' high and above the 200-hour average, bought at the next open between 14:00 and 22:00 UTC, stop 1 ATR, 4R, out after 96 hours (nas100-brk-long-focus). It passed its pre-registered tests but is a candidate, not an edge, and its cost is not measured.' + PAPER },
  lyriac: { tfs: ['5m'], extra: { '5m': 40 }, markets: ['xau', 'usdjpy'], read: lyriacTrades, note: 'Lyriac: the three intraday rules that pass the desk\'s tests as one desk: the gold breakout, the USD/JPY breakout and the gotobi fade on USD/JPY, each by its own study\'s code (research/edge/passing-rules-book).' + PAPER },
  dom: { tfs: ['5m'], markets: DOM_MARKETS, read: domTrades, note: 'DOM zone: the H1 dominant-zone limit as the demo job (council/dom-demo.mjs) arms it, on its eighteen markets. It passed before costs on mid candles, but a random recent candle body does as well and at the demo broker\'s own bid / ask it lost.' + PAPER },
};
export const KINDS2 = Object.keys(DESKS2);
