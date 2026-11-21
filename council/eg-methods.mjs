// Three engulfing methods on the Engulfing desk (21 Nov 2026, owner: "improve the engulfing, learn from these documents").
// The owner's three private documents are read here in the desk's OWN words and are never copied into the repository:
//   plan    the Daily's last engulf gives the side; an H4 engulf zone of that side; with price in the zone a 15-minute engulf
//           the same way; then on 5-minute candles an opposite engulf zone FAILS (a close through it) and the entry is a limit
//           at the 5-minute engulf zone behind that failure.
//   simple  the same entry in an H4 zone whose side is not the Daily's (the documents' short method names no Daily filter).
//   direct  a fresh H4 engulf zone that price leaves alone for the next two H4 candles, a fresh H1 zone inside it, a fresh
//           15-minute zone inside that: a limit at the 15-minute zone.
// Every entry has a fixed stop of 30 pips on gold ($3.00) on the losing side and a target of 60 pips (2R; for the direct
// entry the 2R target is the desk's own choice: its document trails the stop by hand). On another market the 30 pips are the
// same share of price as gold's near $4,000 (the desk's choice). An engulf here = a candle that closes beyond the high (low)
// of the opposite candle before it; its zone is that candle's range. PAPER RECORD of one reading, before costs: not a tested
// rule, never an edge. No order, alert, mirror copy or Trader read.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { foldWeekend } from './fills.mjs';

const require = createRequire(import.meta.url);
const SOP = require(fileURLToPath(new URL('../assets/mosha-sop.js', import.meta.url)));
export const EGM = { pips: 3.0, rr: 2, arm: 3 * 3600, efBack: 6 * 3600, egBack: 2 * 3600, fill: 12, hold: 86400, quiet: 2, directWait: 5 * 86400,
  life: { '4h': 120, '1h': 120, '15m': 200, '5m': 150 } };
const SEC = { '1d': 86400, '4h': 14400, '1h': 3600, '15m': 900, '5m': 300 }, NAME = { '4h': 'H4', '1h': 'H1', '15m': 'M15', '5m': 'M5' };
const word = (d) => (d > 0 ? 'buy' : 'sell');
const num = (a) => a.map((b) => ({ time: +b.time, open: +b.open, high: +b.high, low: +b.low, close: +b.close }));
const lower = (C, t) => { let lo = 0, hi = C.length; while (lo < hi) { const m = (lo + hi) >> 1; if (C[m].time < t) lo = m + 1; else hi = m; } return lo; };

// every engulf zone of one timeframe: { dir, top, bot, base (the engulfed candle's time), at (known from), touch, fail }
// touch = the start of the first later candle that trades into the zone; fail = the close time of the first that closes through it
export function zones(C, tf) {
  const sec = SEC[tf], life = EGM.life[tf] || 120, out = [];
  for (let i = 1; i < C.length; i++) { const p = C[i - 1], c = C[i];
    const dir = p.close < p.open && c.close > c.open && c.close > p.high ? 1 : p.close > p.open && c.close < c.open && c.close < p.low ? -1 : 0; if (!dir) continue;
    const z = { tf, dir, top: p.high, bot: p.low, base: p.time, at: c.time + sec, touch: null, fail: null, i };
    for (let j = i + 1; j < C.length && j <= i + life; j++) { const b = C[j];
      if (z.touch == null && (dir > 0 ? b.low <= z.top : b.high >= z.bot)) z.touch = b.time;
      if (dir > 0 ? b.close < z.bot : b.close > z.top) { z.fail = b.time + sec; break; } }
    z.end = z.fail != null ? z.fail : i + life < C.length ? C[i + life].time + sec : Infinity;   // not used past its life; still alive at the newest candle = no end yet
    out.push(z); }
  return out;
}
// one filled trade on the 5-minute candles from candle fi on: the stop first when a candle holds both
export function outcome(M5, fi, d, entry, stop, target, until) {
  const r0 = Math.abs(entry - stop), o = { status: 'open', R: null, endT: null, exit: null, mfe: 0 };
  for (let k = fi; k < M5.length; k++) { const b = M5[k];
    if (k > fi && b.time >= until) { o.status = 'time'; o.exit = b.open; o.R = d * (b.open - entry) / r0; o.endT = b.time; return o; }
    if (d > 0 ? b.low <= stop : b.high >= stop) { o.status = 'stopped'; o.exit = stop; o.R = -1; o.endT = b.time; return o; }
    if (d > 0 ? b.high >= target : b.low <= target) { o.status = 'target'; o.exit = target; o.R = d * (target - entry) / r0; o.endT = b.time; return o; }
    o.mfe = Math.max(o.mfe, d * ((d > 0 ? b.high : b.low) - entry) / r0); }
  if (M5.length) o.float = d * (M5[M5.length - 1].close - entry) / r0; return o;
}
// the Daily's side at time t: the last Daily engulf known by then (trading days: weekend candles folded)
function dailySide(DZ, t) { let s = 0; for (const z of DZ) { if (z.at > t) break; s = z.dir; } return s; }

export function methodTrades(B, { from = 0, market = 'xau' } = {}) {
  const M5 = num(B['5m'] || []), M15 = num(B['15m'] || []), H1 = num(B['1h'] || []), H4 = num(B['4h'] || []); if (M5.length < 100 || M15.length < 50 || H4.length < 20) return [];
  const D1 = foldWeekend(num(B['1d'] || [])), dec = SOP.ALL[market] ? SOP.ALL[market].dec : 2, f = (v) => (+v).toFixed(dec), px = M5[M5.length - 1].close, pip = EGM.pips * (market === 'xau' ? 1 : px / 4000);
  const Z4 = zones(H4, '4h'), Z1 = zones(H1, '1h'), Z15 = zones(M15, '15m'), Z5 = zones(M5, '5m'), DZ = zones(D1, '1d'), pre = market === 'xau' ? '' : market + ':', out = [];
  const rec = (kind, label, d, fi, entry, T0, log, marks) => { const stop = entry - d * pip, target = entry + d * EGM.rr * pip, fillT = M5[fi].time;
    const oc = outcome(M5, fi, d, entry, stop, target, fillT + EGM.hold);
    const tr = { id: `${pre}${kind}-${d > 0 ? 'b' : 's'}-${T0}`, market, kind, label, h: '4h', l: '5m', side: d, t: fillT, entry, stop, target, r0: pip, status: oc.status, R: oc.R, endT: oc.endT, exit: oc.exit, mfe: oc.mfe, float: oc.float };
    tr.log = log.concat([{ t: fillT, text: `Price came back to the zone: ${word(d)} ${f(entry)}, stop ${f(stop)} (30 pips on gold's scale), target ${f(target)} (${EGM.rr}R), out after 24 hours.` },
      oc.status === 'target' ? { t: oc.endT, text: `Target reached: +${EGM.rr.toFixed(2)}R.` } : oc.status === 'stopped' ? { t: oc.endT, text: 'Stopped: −1.00R' + (oc.mfe >= 1 ? ` after running +${oc.mfe.toFixed(1)}R first.` : '.') }
        : oc.status === 'time' ? { t: oc.endT, text: `Time limit: closed at ${f(oc.exit)}, ${oc.R >= 0 ? '+' : '−'}${Math.abs(oc.R).toFixed(2)}R.` } : { t: null, text: 'Still open on the last candle read' + (oc.float != null ? ` (${oc.float >= 0 ? '+' : '−'}${Math.abs(oc.float).toFixed(2)}R now).` : '.') }]);
    tr.marks = marks; out.push(tr); };
  // a limit at `entry`, valid over candles [i0, i1): the index of the candle that fills it, or -1
  const fillAt = (d, entry, i0, i1) => { for (let k = i0; k < Math.min(M5.length, i1); k++) if (d > 0 ? M5[k].low <= entry : M5[k].high >= entry) return k; return -1; };

  // plan / simple: H4 zone, M15 engulf inside it, then the M5 failure and the M5 zone behind it
  const used = new Set();
  for (const m of Z15) { const d = m.dir, T = m.at, c = M15[m.i];
    const Z = Z4.filter((z) => z.dir === d && z.at <= T && z.end > T && (d > 0 ? c.low <= z.top && c.close >= z.bot : c.high >= z.bot && c.close <= z.top)).pop(); if (!Z) continue;
    // the first opposite M5 zone that fails after the M15 engulf, inside the arming time
    let F = null; for (const z of Z5) { if (z.at > T + EGM.arm) break; if (z.dir !== -d || z.at < T - EGM.efBack || z.fail == null || z.fail <= T || z.fail > T + EGM.arm) continue; if (!F || z.fail < F.fail) F = z; }
    if (!F) continue;
    let E = null; for (const z of Z5) { if (z.at > F.fail) break; if (z.dir === d && z.at >= F.fail - EGM.egBack && (z.fail == null || z.fail > F.fail)) E = z; }
    if (!E) continue; const key = d + ':' + E.base; if (used.has(key)) continue; used.add(key);
    const entry = d > 0 ? E.top : E.bot, i0 = lower(M5, F.fail), fi = fillAt(d, entry, i0, i0 + EGM.fill); if (fi < 0) continue;
    const ds = dailySide(DZ, T), plan = ds === d;
    rec(plan ? 'eg-plan' : 'eg-simple', plan ? 'Plan · with the Daily' : 'Simple EG · H4 zone', d, fi, entry, E.base, [
      { t: T, text: (plan ? `The Daily's last engulf is a ${word(d)}. ` : `The Daily's last engulf is ${ds ? 'a ' + word(ds) : 'not on file'}, so this is the short method without the Daily. `) + `Price is in the H4 ${word(d)} engulf zone ${f(Z.bot)} to ${f(Z.top)} and a 15-minute engulf ${word(d)} closed.` },
      { t: F.fail, text: `On M5 the ${word(-d)} engulf zone ${f(F.bot)} to ${f(F.top)} failed (a close through it). The M5 ${word(d)} engulf zone behind it is ${f(E.bot)} to ${f(E.top)}: a ${word(d)} limit rests at ${f(entry)} for an hour.` }],
    [{ kind: 'zone', top: Z.top, bot: Z.bot, a: Z.base, at: Z.at, label: 'H4 engulf zone' }, { kind: 'zone', top: E.top, bot: E.bot, a: E.base, at: E.at, label: 'M5 engulf zone' }, { kind: 'zone', top: F.top, bot: F.bot, a: F.base, at: F.at, label: 'M5 zone that failed' }]); }

  // direct: a fresh H4 zone left alone for two H4 candles, a fresh H1 zone inside it, a fresh M15 zone inside that
  const inside = (a, b) => a.top >= b.bot && a.bot <= b.top;
  for (const Z of Z4) { const d = Z.dir, tc = Z.at + EGM.quiet * SEC['4h']; if (Z.touch != null && Z.touch < tc) continue; if (Z.fail != null && Z.fail <= tc) continue;
    const win = (z) => z.dir === d && z.at <= tc && z.at >= Z.base - SEC['4h'] && (z.touch == null || z.touch >= tc);
    const h1 = Z1.filter((z) => win(z) && inside(z, Z)).pop(); if (!h1) continue;
    const m15 = Z15.filter((z) => win(z) && inside(z, h1)).pop(); if (!m15) continue;
    const entry = d > 0 ? m15.top : m15.bot, i0 = lower(M5, tc), iEnd = lower(M5, Math.min(Z.fail != null ? Z.fail : Infinity, tc + EGM.directWait)), fi = fillAt(d, entry, i0, iEnd); if (fi < 0) continue;
    rec('eg-direct', 'Direct entry · fresh zones', d, fi, entry, Z.base, [
      { t: tc, text: `A fresh H4 ${word(d)} engulf zone ${f(Z.bot)} to ${f(Z.top)} was left alone for the next two H4 candles. Inside it: a fresh H1 zone ${f(h1.bot)} to ${f(h1.top)} and a fresh M15 zone ${f(m15.bot)} to ${f(m15.top)}. A ${word(d)} limit rests at ${f(entry)}.` }],
    [{ kind: 'zone', top: Z.top, bot: Z.bot, a: Z.base, at: Z.at, label: 'Fresh H4 zone' }, { kind: 'zone', top: h1.top, bot: h1.bot, a: h1.base, at: h1.at, label: 'Fresh H1 zone' }, { kind: 'zone', top: m15.top, bot: m15.bot, a: m15.base, at: m15.at, label: 'Fresh M15 zone' }]); }

  // one position at a time a market over the three methods; only entries inside the window are kept
  out.sort((a, b) => a.t - b.t); const keep = []; let busy = -Infinity;
  for (const r of out) { if (r.t <= busy) continue; busy = r.endT || Infinity; if (r.t >= from) keep.push(r); }
  return keep;
}

// ─── the gold plan with Daily levels (the MSNR desk; the owner's fourth document, read in the desk's own words) ───
// Side: a Daily candle REJECTS a Daily level (a swing low or high of the last 60 trading days, 2 candles a side, or the body
// edge of that swing candle): it trades through the level and closes back on the other side; then, within 3 days, an H4
// candle closes beyond the last H4 swing the same way. That side holds until the opposite pair completes. Zones: H4 engulf
// zones of that side, and opposite H4 zones that failed (they turn). Entry (the plan's first type only; its second, a
// 15-minute "QM" zone, is not written here): with price in such a zone a 15-minute engulf the same way, a limit at that
// engulf's zone for two hours. Stop 30 pips ($3.00), target 90 pips (3R), at most 2 entries a UTC day, one at a time. Gold only.
export const SNR = { rr: 3, piv: 2, look: 60, boDays: 3, wait: 24, perDay: 2 };
export function snrSides(D1, H4) {
  const ev = [], k = SNR.piv;
  for (let i = 2 * k + 1; i < D1.length; i++) { const c = D1[i], lv = [];
    for (let j = Math.max(k, i - SNR.look); j + k < i; j++) { const b = D1[j]; let lo = true, hi = true;
      for (let q = 1; q <= k; q++) { if (!(b.low < D1[j - q].low && b.low < D1[j + q].low)) lo = false; if (!(b.high > D1[j - q].high && b.high > D1[j + q].high)) hi = false; }
      if (lo) lv.push(b.low, Math.min(b.open, b.close)); if (hi) lv.push(b.high, Math.max(b.open, b.close)); }
    const up = lv.some((L) => c.low <= L && c.close > L && c.open > L), dn = lv.some((L) => c.high >= L && c.close < L && c.open < L);
    if (up !== dn) ev.push({ t: c.time + 86400, dir: up ? 1 : -1, day: c.time }); }
  // the H4 break that confirms a rejection: a close beyond the last H4 swing (2 a side) formed before it
  const sides = [];
  for (const e of ev) { let i0 = lower(H4, e.t); const end = e.t + SNR.boDays * 86400;
    for (let i = i0; i < H4.length && H4[i].time < end; i++) { let L = null;
      for (let j = i - k - 1; j >= k && j > i - 60; j--) { const b = H4[j]; let ok = true; for (let q = 1; q <= k; q++) if (e.dir > 0 ? !(b.high > H4[j - q].high && b.high > H4[j + q].high) : !(b.low < H4[j - q].low && b.low < H4[j + q].low)) ok = false; if (ok) { L = e.dir > 0 ? b.high : b.low; break; } }
      if (L != null && (e.dir > 0 ? H4[i].close > L : H4[i].close < L)) { sides.push({ t: H4[i].time + 14400, dir: e.dir, day: e.day, level: L }); break; } } }
  return sides.sort((a, b) => a.t - b.t);
}
export function snrTrades(B, { from = 0, market = 'xau' } = {}) {
  if (market !== 'xau') return [];
  const M5 = num(B['5m'] || []), M15 = num(B['15m'] || []), H4 = num(B['4h'] || []), D1 = foldWeekend(num(B['1d'] || [])); if (M5.length < 100 || M15.length < 50 || H4.length < 30 || D1.length < 20) return [];
  const f = (v) => (+v).toFixed(2), pip = EGM.pips, sides = snrSides(D1, H4), Z4 = zones(H4, '4h'), Z15 = zones(M15, '15m'), out = [], perDay = {}; let busy = -Infinity;
  const sideAt = (t) => { let s = null; for (const x of sides) { if (x.t > t) break; s = x; } return s; };
  for (const m of Z15) { const d = m.dir, T = m.at, S = sideAt(T); if (!S || S.dir !== d || T <= busy) continue; const c = M15[m.i];
    const inZ = (z) => (d > 0 ? c.low <= z.top && c.close >= z.bot : c.high >= z.bot && c.close <= z.top);
    const Z = Z4.filter((z) => z.at >= S.t - 20 * 86400 && inZ(z) && ((z.dir === d && z.at <= T && z.end > T) || (z.dir === -d && z.fail != null && z.fail <= T && T - z.fail < 20 * 86400))).pop(); if (!Z) continue;
    const entry = d > 0 ? m.top : m.bot, i0 = lower(M5, T); let fi = -1; for (let q = i0; q < Math.min(M5.length, i0 + SNR.wait); q++) if (d > 0 ? M5[q].low <= entry : M5[q].high >= entry) { fi = q; break; }
    if (fi < 0) continue; const fillT = M5[fi].time, dk = Math.floor(fillT / 86400); if ((perDay[dk] || 0) >= SNR.perDay) continue; perDay[dk] = (perDay[dk] || 0) + 1;
    const stop = entry - d * pip, target = entry + d * SNR.rr * pip, oc = outcome(M5, fi, d, entry, stop, target, fillT + EGM.hold); busy = oc.endT || Infinity; if (fillT < from) continue;
    const turned = Z.dir !== d, tr = { id: `msnr-sop-${d > 0 ? 'b' : 's'}-${m.base}`, market, kind: 'msnr-sop', label: 'EG x SNR · gold plan', h: '4h', l: '15m', side: d, t: fillT, entry, stop, target, r0: pip, status: oc.status, R: oc.R, endT: oc.endT, exit: oc.exit, mfe: oc.mfe, float: oc.float };
    tr.log = [{ t: S.t, text: `Side ${word(d)}: the Daily candle of ${new Date(S.day * 1000).toISOString().slice(0, 10)} rejected a Daily level, and an H4 candle then closed ${d > 0 ? 'above' : 'below'} the last H4 swing ${f(S.level)}.` },
      { t: T, text: `Price is in the H4 ${turned ? 'zone that failed and turned' : word(d) + ' engulf zone'} ${f(Z.bot)} to ${f(Z.top)} and a 15-minute engulf ${word(d)} closed: a ${word(d)} limit rests at its zone, ${f(entry)}, for two hours.` },
      { t: fillT, text: `Filled: ${word(d)} ${f(entry)}, stop ${f(stop)} (30 pips), target ${f(target)} (90 pips, ${SNR.rr}R), out after 24 hours.` },
      oc.status === 'target' ? { t: oc.endT, text: `Target reached: +${SNR.rr.toFixed(2)}R.` } : oc.status === 'stopped' ? { t: oc.endT, text: 'Stopped: −1.00R' + (oc.mfe >= 1 ? ` after running +${oc.mfe.toFixed(1)}R first.` : '.') }
        : oc.status === 'time' ? { t: oc.endT, text: `Time limit: closed at ${f(oc.exit)}, ${oc.R >= 0 ? '+' : '−'}${Math.abs(oc.R).toFixed(2)}R.` } : { t: null, text: 'Still open on the last candle read' + (oc.float != null ? ` (${oc.float >= 0 ? '+' : '−'}${Math.abs(oc.float).toFixed(2)}R now).` : '.') }];
    tr.marks = [{ kind: 'zone', top: Z.top, bot: Z.bot, a: Z.base, at: Z.at, label: turned ? 'H4 zone, turned' : 'H4 engulf zone' }, { kind: 'zone', top: m.top, bot: m.bot, a: m.base, at: m.at, label: 'M15 engulf zone' }, { kind: 'level', p: S.level, a: S.t - 14400, at: S.t, label: 'H4 break', under: d < 0 }];
    out.push(tr); }
  return out;
}
