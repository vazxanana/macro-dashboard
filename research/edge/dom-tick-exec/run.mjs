// Edge research · dom-tick-exec: the H1 dominant-zone limit (combo-grid-3 1h>5m dom zedge / zatr, 2R) judged on the demo
// broker's own bid / ask ticks (PREREGISTRATION.md). Paper research only; imports, never edits, the rule's code.
//   EDGE_DATA=<cache> node research/edge/dom-tick-exec/run.mjs queries        -> orders-<SYM>.json + fills-<SYM>-<k>.json
//   node research/edge/dom-tick-exec/run.mjs report <dir> [commit]             -> result.json from <dir>/ticks-<SYM>*.json
// The probe (council/tick-probe.mjs, unchanged) answers only "first tick with ask >= level" (dir +1) and "first tick with
// bid <= level" (dir -1) in windows of at most 30 minutes; a limit fill (buy: ask <= L) and a target (buy: bid >= T) are
// therefore bracketed with a fixed spread allowance C and checked on the returned tick (PREREGISTRATION.md items 1-8).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, signalsFor, multi, COSTS, exclusions, NONE } from '../combo-grid-3/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FROM = Date.UTC(2023, 10, 24) / 1000, TO = Date.UTC(2026, 10, 20) / 1000;
export const MARKETS = { XAUUSD: 'xau', USDJPY: 'usdjpy' };
export const C = { XAUUSD: 0.20, USDJPY: 0.006 };          // spread allowance of the brackets
export const NEAR = { XAUUSD: 0.5, USDJPY: 0.05 };          // OANDA mid to broker basis margin for the exit windows
export const COMM = { XAUUSD: 0.000024, USDJPY: 0.0000225 }; // commission a side, share of price
export const SAMPLE = 1200, SEED = 20261123, PER_FILE = 1500, SPAN = 1800, EWIN = 1800, CAP = 2 * 86400, LIFE = 12 * 300;
export const MARKS_BACK = 300, N_MIN = 300, UNRES_MAX = 0.10;
const r6 = (v) => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : null);
const r4 = (v) => (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : null);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const med = (a) => { const v = [...a].sort((x, y) => x - y), n = v.length; return n ? (n % 2 ? v[n >> 1] : (v[n / 2 - 1] + v[n / 2]) / 2) : null; };
function atr14(B) { const a = new Float64Array(B.length); let s = 0; const tr = (i) => Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c));
  for (let i = 1; i < B.length; i++) { s += tr(i); if (i > 14) s -= tr(i - 14); a[i] = i >= 14 ? s / 14 : 0; } return a; }
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function sample(list, n, seed) { const a = [...list], rnd = mulberry32(seed); const k = Math.min(n, a.length);
  for (let i = 0; i < k; i++) { const j = i + Math.floor(rnd() * (a.length - i)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, k).sort((x, y) => x.ts - y.ts); }

// the mid path of the 2R exit exactly as multi() walks it (slot 1), with the fill and exit candles; checked against multi()
export function midPath(M5, s, entry, stop, t0, expire, cap = CAP) {
  let lo = 0, hi = M5.length; while (lo < hi) { const m = (lo + hi) >> 1; if (M5[m].t < t0) lo = m + 1; else hi = m; }
  let i = lo, fill = null;
  for (; i < M5.length; i++) { const b = M5[i]; if (b.t >= expire) return null;
    if (s > 0 ? b.l <= entry : b.h >= entry) { fill = s > 0 ? Math.min(b.o, entry) : Math.max(b.o, entry); break; }
    if (s > 0 ? b.c < stop : b.c > stop) return null; }
  if (fill == null) return null;
  const risk = s * (fill - stop); if (!(risk > 0)) return null;
  const tgt = fill + s * 2 * risk, fi = i, deadline = M5[fi].t + cap;
  for (let j = fi; j < M5.length; j++) { const b = M5[j], first = j === fi;
    if (!first) { if (s * (b.o - stop) <= 0) return { fi, xi: j, fill, risk, tgt, how: 'stop', px: b.o };
      if (s * (b.o - tgt) >= 0) return { fi, xi: j, fill, risk, tgt, how: 'target', px: b.o }; }
    if (s * ((s > 0 ? b.l : b.h) - stop) <= 0) return { fi, xi: j, fill, risk, tgt, how: 'stop', px: stop };
    if (!first && s * ((s > 0 ? b.h : b.l) - tgt) >= 0) return { fi, xi: j, fill, risk, tgt, how: 'target', px: tgt };
    if (b.e >= deadline) return { fi, xi: j, fill, risk, tgt, how: 'time', px: b.c };
  }
  return null;
}

// every order of the rule in [from, to) for one market: dom-zone-holdout trades()' logic, keeping the levels and the mid path
export function orders(market, from = FROM, to = TO) {
  const M5 = K.load(market, '5m', { from: from - 200 * 86400 }); if (!M5.length) return { M5, list: [] };
  const F = frames(M5), H = F['1h'], T = F['5m'], A = atr14(H), cost = COSTS[market], X = exclusions(market);
  const bad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const list = []; let checked = 0;
  for (const sg of signalsFor(F, '1h', '5m', 'dom', {}, from)) {
    if (sg.trig !== NONE) continue;
    const z = sg.z, d = z.d, ts = T[sg.k0].t; if (ts < from || ts >= to) continue;
    const li = K.closedCount(H, ts) - 1; if (li < 15) continue;
    const entry = d > 0 ? z.top : z.bot, stop = d > 0 ? z.bot - cost / 2 - 0.25 * A[li] : z.top + cost / 2 + 0.25 * A[li];
    if (!(d * (entry - stop) >= 2 * cost)) continue;
    const r = multi(M5, d, entry, stop, 'lim', ts, ts + LIFE, 2, null, CAP, null);
    const p = midPath(M5, d, entry, stop, ts, ts + LIFE);
    if (r) { // the mid tracer must equal the grid's own result
      if (!p || Math.abs((d * (p.px - p.fill)) / p.risk - r.R[1]) > 1e-9 || M5[p.fi].t !== r.t) throw new Error(`mid path differs at ${market} ${ts}`);
      checked++;
      if (r.risk < cost || bad(r.t)) continue; }
    else if (p) throw new Error(`mid path filled where multi did not at ${market} ${ts}`);
    list.push({ ts, side: d, L: entry, S: stop, T: entry + d * 2 * (entry - stop), visit: sg.visit,
      mid: p ? { fillT: M5[p.fi].t, fill: p.fill, risk: p.risk, R: (d * (p.px - p.fill)) / p.risk, how: p.how, exitT: M5[p.xi].t, deadT: M5[p.fi].t + CAP } : null });
  }
  return { M5, list, checked };
}

// merge 5-minute candle starts into windows of at most SPAN seconds
export function spans(starts) { const o = [];
  for (const t of [...starts].sort((a, b) => a - b)) { const last = o[o.length - 1]; if (last && t <= last[1] && t + 300 - last[0] <= SPAN) last[1] = t + 300; else o.push([t, t + 300]); }
  return o; }
// the first 5-minute candle ending at or after `deadline` (the time-exit candle), or null
const deadCandle = (M5, i0, deadline) => { for (let j = i0; j < M5.length; j++) if (M5[j].e >= deadline) return M5[j]; return null; };
// the probe queries of one order: [id, t0, t1, level, dir]; and its time-exit mark (or null)
export function queriesOf(o, M5, sym) {
  const s = o.side, c = C[sym], near = NEAR[sym], id = o.id;
  const q = [[`${id}|e0`, o.ts, o.ts + EWIN, r6(o.L), -s], [`${id}|e1`, o.ts, o.ts + EWIN, r6(o.L - s * c), -s]];
  let lo = 0, hi = M5.length; while (lo < hi) { const m = (lo + hi) >> 1; if (M5[m].t < o.ts) lo = m + 1; else hi = m; }
  // the deadline candle of a tick fill: two days after the mid fill candle's start (the order start when the mid did not fill)
  const dc = deadCandle(M5, lo, (o.mid ? o.mid.fillT : o.ts) + CAP), endT = Math.min(dc ? dc.e : Infinity, o.mid ? o.mid.exitT + 300 + 3600 : o.ts + EWIN + 3600);
  const nearS = [], nearT = [];
  for (let j = lo; j < M5.length && M5[j].t < endT; j++) { const b = M5[j];
    if (s > 0 ? b.l <= o.S + near : b.h >= o.S - near) nearS.push(b.t);
    if (s > 0 ? b.h >= o.T - near : b.l <= o.T + near) nearT.push(b.t); }
  spans(nearS).forEach(([a, b], k) => q.push([`${id}|s${k}`, a, b, r6(o.S), -s]));
  spans(nearT).forEach(([a, b], k) => q.push([`${id}|t${k}`, a, b, r6(o.T + s * c), s]));
  return { q, mark: o.mid && o.mid.how === 'time' ? o.mid.exitT + 300 : null, deadEnd: dc ? dc.e : null };
}

// one order on the broker's ticks. F: Map id -> [id, ms, bid, ask] | [id, null]; M: Map time -> [t, bid, ask, age, spread]
export function tickOrder(o, sym, F, M, { lenient = false } = {}) {
  const s = o.side, id = o.id, e0 = F.get(`${id}|e0`), e1 = F.get(`${id}|e1`);
  if (!e0 || !e1) return { skip: 'not read' };
  if (e0[1] == null) return { filled: false, R: 0, why: 'no touch' };
  const through = (qt) => (s > 0 ? qt[3] <= o.L : qt[2] >= o.L); // the side that fills a limit is at or past it
  let fill, fillMs, how;
  if (through(e0)) { fill = s > 0 ? e0[3] : e0[2]; fillMs = e0[1]; how = 'through'; }
  else if (e1[1] != null && through(e1)) { fill = o.L; fillMs = e1[1]; how = 'bracket'; }
  else if (lenient) { fill = o.L; fillMs = e0[1]; how = 'unresolved-as-filled'; }
  else return { filled: false, R: 0, why: 'unresolved fill', unresolvedFill: true };
  const dead = o.deadEnd != null ? o.deadEnd * 1000 : Infinity, ok = (ms) => ms != null && ms >= fillMs && ms <= dead;
  let stop = null, tgt = null;
  for (let k = 0; F.has(`${id}|s${k}`); k++) { const x = F.get(`${id}|s${k}`); if (ok(x[1]) && (!stop || x[1] < stop[1])) stop = x; }
  for (let k = 0; F.has(`${id}|t${k}`); k++) { const x = F.get(`${id}|t${k}`); if (ok(x[1]) && (s > 0 ? x[2] >= o.T : x[3] <= o.T) && (!tgt || x[1] < tgt[1])) tgt = x; }
  const r = Math.abs(o.L - o.S); let exit, ex, exitMs;
  if (stop && (!tgt || stop[1] <= tgt[1])) { exit = s > 0 ? stop[2] : stop[3]; ex = 'stop'; exitMs = stop[1]; }
  else if (tgt) { exit = o.T; ex = 'target'; exitMs = tgt[1]; }
  else { const m = o.mark != null ? M.get(o.mark) : null;
    if (m && m[1] > 0 && m[3] != null && m[3] <= MARKS_BACK) { exit = s > 0 ? m[1] : m[2]; ex = 'time'; exitMs = o.mark * 1000; }
    else return { filled: true, fill, fillMs, how, unresolvedExit: true }; }
  const R = (s * (exit - fill)) / r;
  return { filled: true, fill, fillMs, how, exit, ex, exitMs, r, R, net: R - (2 * COMM[sym] * fill) / r, slip: s * (o.L - fill) };
}

function monthT(rows, key) { const m = new Map(); for (const x of rows) { const k = new Date(x.ts * 1000).toISOString().slice(0, 7); m.set(k, (m.get(k) || 0) + x[key]); }
  const v = [...m.values()]; if (v.length < 3) return null; const a = mean(v), sd = Math.sqrt(v.reduce((s, x) => s + (x - a) ** 2, 0) / (v.length - 1)); return sd > 0 ? a / (sd / Math.sqrt(v.length)) : null; }

export function evaluate(orders, sym, F, M) {
  const rows = [], skipped = {}, k = COMM[sym];
  for (const o of orders) {
    const b = tickOrder(o, sym, F, M), bl = tickOrder(o, sym, F, M, { lenient: true });
    if (b.skip) { skipped[b.skip] = (skipped[b.skip] || 0) + 1; continue; }
    const midR = o.mid ? o.mid.R : 0, midNet = o.mid ? midR - (2 * k * o.mid.fill) / o.mid.risk : 0;
    rows.push({ sym, ts: o.ts, side: o.side, b, bl, midR, midNet, midFilled: !!o.mid, midHow: o.mid ? o.mid.how : null });
  }
  return { rows, skipped };
}
export function stats(rows) {
  const res = rows.filter((x) => !x.b.unresolvedExit), filled = res.filter((x) => x.b.filled);
  const T2 = (key) => ({ n: filled.length, mean: r4(mean(filled.map((x) => x.b[key]))), monthT: r4(monthT(filled.map((x) => ({ ts: x.ts, v: x.b[key] })), 'v')) });
  const diff = (tk, mk) => { const d = res.map((x) => ({ ts: x.ts, v: (x.b.filled ? x.b[tk] : 0) - x[mk] })); return { n: d.length, mean: r4(mean(d.map((x) => x.v))), monthT: r4(monthT(d, 'v')) }; };
  const len = rows.filter((x) => x.bl.filled && !x.bl.unresolvedExit && x.bl.R != null);
  const midF = res.filter((x) => x.midFilled);
  return {
    orders: rows.length, resolved: res.length, unresolvedExit: rows.length - res.length, tickFilled: filled.length, midFilled: midF.length,
    unresolvedFill: rows.filter((x) => x.b.unresolvedFill).length, fillHow: { through: filled.filter((x) => x.b.how === 'through').length, bracket: filled.filter((x) => x.b.how === 'bracket').length },
    exits: { stop: filled.filter((x) => x.b.ex === 'stop').length, target: filled.filter((x) => x.b.ex === 'target').length, time: filled.filter((x) => x.b.ex === 'time').length },
    T1: { before: diff('R', 'midR'), afterCommission: diff('net', 'midNet') },
    T2: { before: T2('R'), afterCommission: T2('net') },
    mid: { n: midF.length, before: r4(mean(midF.map((x) => x.midR))), after: r4(mean(midF.map((x) => x.midNet))) },
    lenient: { n: len.length, before: r4(mean(len.map((x) => x.bl.R))), monthT: r4(monthT(len.map((x) => ({ ts: x.ts, v: x.bl.R })), 'v')) },
    midWinsNotFilled: res.filter((x) => x.midFilled && x.midR > 0 && !x.b.filled).length,
    entrySlip: { median: r6(med(filled.map((x) => x.b.slip))), mean: r6(mean(filled.map((x) => x.b.slip))) },
    fillDelayS: med(filled.map((x) => x.b.fillMs / 1000 - x.ts)),
  };
}
const verdictOf = (t2, unresShare) => (unresShare > UNRES_MAX ? 'INCONCLUSIVE' : t2.n < N_MIN ? `TOO FEW (${t2.n} filled)` : t2.mean > 0 && t2.monthT >= 2 ? 'PASS' : 'FAIL');

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [mode, a, commit] = process.argv.slice(2);
  if (mode === 'queries') {
    const summary = {};
    for (const [sym, mk] of Object.entries(MARKETS)) {
      const { M5, list, checked } = orders(mk); const pick = sample(list, SAMPLE, SEED);
      pick.forEach((o, i) => { o.id = `${sym === 'XAUUSD' ? 'x' : 'j'}${String(i).padStart(4, '0')}`; });
      const files = []; let cur = null;
      for (const o of pick) { const { q, mark, deadEnd } = queriesOf(o, M5, sym); o.mark = mark; o.deadEnd = deadEnd; o.nq = q.length;
        if (!cur || cur.fills.length + q.length > PER_FILE || (mark && cur.marks.length >= 600)) files.push(cur = { fills: [], marks: [] });
        cur.fills.push(...q); if (mark) cur.marks.push(mark); }
      files.forEach((f, k) => fs.writeFileSync(path.join(HERE, `fills-${sym}-${k + 1}.json`), JSON.stringify({ [sym]: [...new Set(f.marks)], fills: { [sym]: f.fills } })));
      fs.writeFileSync(path.join(HERE, `orders-${sym}.json`), JSON.stringify(pick));
      summary[sym] = { allOrders: list.length, midChecked: checked, sampled: pick.length, midNoFill: pick.filter((o) => !o.mid).length, files: files.map((f, k) => ({ file: `fills-${sym}-${k + 1}.json`, fills: f.fills.length, marks: new Set(f.marks).size })) };
      console.log(sym, JSON.stringify(summary[sym]));
    }
    fs.writeFileSync(path.join(HERE, 'queries-summary.json'), JSON.stringify(summary, null, 1));
  } else if (mode === 'report') {
    const all = [], per = {}, skippedAll = {}, probes = [];
    for (const sym of Object.keys(MARKETS)) {
      const O = JSON.parse(fs.readFileSync(path.join(HERE, `orders-${sym}.json`), 'utf8')), F = new Map(), M = new Map();
      for (const f of fs.readdirSync(a).filter((x) => x.startsWith(`ticks-${sym}`) && x.endsWith('.json'))) {
        const P = JSON.parse(fs.readFileSync(path.join(a, f), 'utf8')); probes.push({ file: f, at: P.at, errors: (P.errors || []).length });
        for (const x of P.fills || []) if (!F.has(x[0]) || (F.get(x[0])[1] == null && x[1] != null)) F.set(x[0], x);
        for (const m of P.marks || []) if (m[1] > 0 && !(M.get(m[0]) && M.get(m[0])[1] > 0)) M.set(m[0], m); }
      const { rows, skipped } = evaluate(O, sym, F, M); all.push(...rows); skippedAll[sym] = skipped;
      const st = stats(rows); per[sym] = { ...st, verdictBefore: verdictOf(st.T2.before, rows.length ? st.unresolvedExit / Math.max(1, st.tickFilled + st.unresolvedExit) : 1), verdictAfter: verdictOf(st.T2.afterCommission, rows.length ? st.unresolvedExit / Math.max(1, st.tickFilled + st.unresolvedExit) : 1) };
    }
    const pool = stats(all), byYear = {}, bySide = {};
    for (const x of all.filter((x) => x.b.filled && !x.b.unresolvedExit)) { const y = new Date(x.ts * 1000).getUTCFullYear(), sd = x.side > 0 ? 'buy' : 'sell';
      (byYear[y] ||= []).push(x.b.R); (bySide[sd] ||= []).push(x.b.R); }
    const grp = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { n: v.length, before: r4(mean(v)) }]));
    const vb = verdictOf(pool.T2.before, 0), va = verdictOf(pool.T2.afterCommission, 0);
    const out = { study: 'dom-tick-exec', built: new Date().toISOString().slice(0, 10), commit: commit || null, probes, skipped: skippedAll, window: [new Date(FROM * 1000).toISOString().slice(0, 10), new Date(TO * 1000).toISOString().slice(0, 10)],
      pool, perMarket: per, byYear: grp(byYear), bySide: grp(bySide),
      verdict: `before costs ${vb}, after commission ${va}: tick ${pool.T2.before.mean}R a filled trade (n ${pool.T2.before.n}, month t ${pool.T2.before.monthT}) against mid ${pool.mid.before}R; paired tick minus mid ${pool.T1.before.mean}R (month t ${pool.T1.before.monthT})` };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1));
    console.log(out.verdict);
  } else console.log('usage: run.mjs queries | report <dir with ticks-<SYM>*.json> [commit]');
}
