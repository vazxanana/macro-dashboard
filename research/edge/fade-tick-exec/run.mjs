// Edge research · fade-tick-exec: grid7-wide-fade's M15 break fade (m15 none atr 2R all; m15 none ext swing all) judged on the
// demo broker's own bid / ask ticks (PREREGISTRATION.md). Paper research only; imports, never edits, the rule's code.
//   EDGE_DATA=<cache> node research/edge/fade-tick-exec/run.mjs queries      -> orders-<SYM>.json + batch-<k>.json
//   node research/edge/fade-tick-exec/run.mjs report <dir> [commit]           -> result.json + RESULT.md from <dir>/ticks-<SYM>*.json
// The probe (council/tick-probe.mjs, unchanged) answers "first tick with ask >= level" (dir +1) / "bid <= level" (dir -1) in
// windows of at most 30 minutes, and the last quote before a moment (marks). The stop and target are fixed from the TICK fill,
// which is unknown when the queries are written, so each level is bracketed around its mid-scale value by +-W (item 3).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { startIdx } from '../dom-trade-through/run.mjs';
import { signals, exits, CAP, ATRK } from '../grid7-wide-fade/run.mjs';
import { p1 } from '../grid7-wide-core/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FROM = Date.UTC(2023, 10, 24) / 1000, TO = Date.UTC(2026, 10, 20) / 1000;
export const MARKETS = { XAUUSD: 'xau', USDJPY: 'usdjpy' };
export const W = { XAUUSD: 0.5, USDJPY: 0.05 };              // basis + half-spread allowance of the brackets (NEAR)
export const C = { XAUUSD: 0.20, USDJPY: 0.006 };            // spread allowance (target's late query)
export const COMM = { XAUUSD: 0.000024, USDJPY: 0.0000225 }; // commission a side, share of price
export const RULES = { a: { name: 'm15 none atr 2R all', stop: 'atr', exit: '2R' }, w: { name: 'm15 none ext swing all', stop: 'ext', exit: 'swing' } };
export const SAMPLE = 1200, SEED = 20261123, SPAN = 1800, MARKS_BACK = 60, N_MIN = 300, UNRES_MAX = 0.10;
export const MAX_FILLS = 3000, MAX_MARKS = 500, TF = 1, CAPS = CAP['15m'];
const r6 = (v) => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : null);
const r4 = (v) => (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : null);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const med = (a) => { const v = [...a].sort((x, y) => x - y), n = v.length; return n ? (n % 2 ? v[n >> 1] : (v[n / 2 - 1] + v[n / 2]) / 2) : null; };
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function sample(list, n, seed) { const a = [...list], rnd = mulberry32(seed); const k = Math.min(n, a.length);
  for (let i = 0; i < k; i++) { const j = i + Math.floor(rnd() * (a.length - i)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, k).sort((x, y) => x.ts - y.ts); }

// the mid path of ONE target exactly as exits() walks it (stop first, gaps at the open, target on the fill candle too, out at
// the close of the candle reaching the cap); returns the exit candle as well. Checked against exits() in orders().
export function midTrace(M5, s, fi, stop, tgt, cap) {
  const fill = M5[fi].o, risk = s * (fill - stop); if (!(risk > 0)) return null; const dl = M5[fi].t + cap;
  for (let j = fi; j < M5.length; j++) { const b = M5[j];
    if (j > fi) { if (s * (b.o - stop) <= 0) return { xi: j, px: b.o, how: 'stop' }; if (s * (b.o - tgt) >= 0) return { xi: j, px: b.o, how: 'target' }; }
    if (s * ((s > 0 ? b.l : b.h) - stop) <= 0) return { xi: j, px: stop, how: 'stop' };
    if (s * ((s > 0 ? b.h : b.l) - tgt) >= 0) return { xi: j, px: tgt, how: 'target' };
    if (b.e >= dl) return { xi: j, px: b.c, how: 'time' }; }
  return null;
}
const deadIdx = (M5, fi, cap) => { const dl = M5[fi].t + cap; for (let j = fi; j < M5.length; j++) if (M5[j].e >= dl) return j; return -1; };

// every M15 "none" fade signal of the window with its two rules on mid (null where the rule gives no trade)
export function orders(market, from = FROM, to = TO) {
  const M5 = K.load(market, '5m', { from: '2023-01-01' }); if (!M5.length) return { M5, list: [], checked: 0 };
  const sigs = signals(frames(M5)).filter((g) => g.tf === TF && g.cx === 0), cost = COSTS[market], X = exclusions(market);
  const bad = (t) => X.some(([a, b]) => t >= a && t <= b); const list = []; let checked = 0;
  for (const g of sigs) {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < from || t >= to || bad(t)) continue;
    const di = deadIdx(M5, fi, CAPS); if (di < 0) continue;
    const fill = M5[fi].o, s = -g.d, rules = {};
    for (const [rk, R] of Object.entries(RULES)) {
      const stop = R.stop === 'atr' ? fill + g.d * g.a : g.ext + g.d * ATRK * g.a, D = s * (fill - stop);
      if (!(D > 0) || D < cost) continue;
      if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
      const k = R.exit === '2R' ? 2 : g.opp == null ? NaN : (s * (g.opp - fill)) / D; if (!(k > 0)) continue;
      const tgt = fill + s * k * D, ex = exits(M5, s, fi, stop, [tgt], CAPS), tr = midTrace(M5, s, fi, stop, tgt, CAPS);
      if (!ex || !tr) continue;
      const Rm = (s * (tr.px - fill)) / D; if (Math.abs(Rm - ex.R[0]) > 1e-9) throw new Error(`mid trace differs at ${market} ${t}`); checked++;
      rules[rk] = { D, k, stopM: stop, tgtM: tgt, mid: { R: Rm, net: Rm - cost / D, how: tr.how, exitEnd: M5[tr.xi].e } };
    }
    if (Object.keys(rules).length) list.push({ ts: t, side: s, fillM: fill, deadEnd: M5[di].e, fi, rules });
  }
  return { M5, list, checked };
}

// merge 5-minute candle starts into windows of at most SPAN seconds
export function spans(starts) { const o = [];
  for (const t of [...starts].sort((a, b) => a - b)) { const last = o[o.length - 1]; if (last && t <= last[1] && t + 300 - last[0] <= SPAN) last[1] = t + 300; else o.push([t, t + 300]); }
  return o; }
// the probe queries of one order and rule: [id, t0, t1, level, dir]. Stop: dir -s (buy bid <= X, sell ask >= X), early level
// Xm + s W, late Xm - s W. Target: dir s (the opposite side, accepted on the closing side), early Tm - s W, late Tm + s (W + c).
export function queriesOf(o, rk, M5, sym) {
  const r = o.rules[rk], s = o.side, w = W[sym], c = C[sym], id = `${o.id}|${rk}`;
  const endT = Math.min(o.deadEnd, r.mid.exitEnd + 3600); r.coverEnd = endT;
  const nS = [], nT = [];
  for (let j = o.fi ?? startIdx(M5, o.ts); j < M5.length && M5[j].t < endT; j++) { const b = M5[j];
    if (s > 0 ? b.l <= r.stopM + 2 * w : b.h >= r.stopM - 2 * w) nS.push(b.t);
    if (s > 0 ? b.h >= r.tgtM - 2 * w : b.l <= r.tgtM + 2 * w) nT.push(b.t); }
  const q = [];
  spans(nS).forEach(([a, b], k) => { q.push([`${id}|se${k}`, a, b, r6(r.stopM + s * w), -s]); q.push([`${id}|sl${k}`, a, b, r6(r.stopM - s * w), -s]); });
  spans(nT).forEach(([a, b], k) => { q.push([`${id}|te${k}`, a, b, r6(r.tgtM - s * w), s]); q.push([`${id}|tl${k}`, a, b, r6(r.tgtM + s * (w + c)), s]); });
  return q;
}

// ---- evaluation on probe answers. F: Map id -> [id, ms, bid, ask] | [id, null]; M: Map time -> [t, bid, ask, age, spread] ----
const answers = (F, pre) => { const o = []; for (let k = 0; F.has(pre + k); k++) { const x = F.get(pre + k); if (x[1] != null) o.push(x); } return o; };
const allRead = (F, pre, n) => { for (let k = 0; k < n; k++) if (!F.has(pre + k)) return false; return true; };
// the crossing of one level: null = none in the windows read; else { lo, hi, exact, px }. pass(x): the tick's closing side is past
export function crossing(early, late, pass, startMs, level, cl) {
  const E = early.filter((x) => x[1] >= startMs).sort((a, b) => a[1] - b[1]); if (!E.length) return null;
  const first = E[0]; if (pass(first)) return { lo: first[1], hi: first[1], exact: true, px: cl(first) };
  const cands = [...E.filter(pass), ...late.filter((x) => x[1] >= startMs && pass(x))].map((x) => x[1]);
  return { lo: first[1], hi: cands.length ? Math.min(...cands) : Infinity, exact: false, px: level };
}
export function tickRule(o, rk, sym, F, M) {
  const r = o.rules[rk], s = o.side, id = `${o.id}|${rk}`, nq = r.nq || { s: 0, t: 0 };
  if (!allRead(F, `${id}|se`, nq.s) || !allRead(F, `${id}|sl`, nq.s) || !allRead(F, `${id}|te`, nq.t) || !allRead(F, `${id}|tl`, nq.t)) return { skip: 'not read' };
  const em = M.get(o.ts);
  if (!em || !(em[1] > 0) || !(em[2] > 0) || em[3] == null || em[3] > MARKS_BACK) return { entryUnresolved: true };
  const A = s > 0 ? em[2] : em[1], D = r.D, X = A - s * D, T = A + s * r.k * D, startMs = o.ts * 1000, dead = o.deadEnd * 1000;
  const cl = (x) => (s > 0 ? x[2] : x[3]);
  const S = crossing(answers(F, `${id}|se`), answers(F, `${id}|sl`), (x) => s * (cl(x) - X) <= 0, startMs, X, cl);
  const G = crossing(answers(F, `${id}|te`), answers(F, `${id}|tl`), (x) => s * (cl(x) - T) >= 0, startMs, T, cl);
  const cut = r.coverEnd < o.deadEnd, absent = cut ? { lo: r.coverEnd * 1000, hi: Infinity, exact: false, absent: true } : null;
  const s1 = S || absent, g1 = G || absent;
  const done = (ex, px, how) => { const R = (s * (px - A)) / D; return { A, X, T, ex, how, px, R, net: R - (2 * COMM[sym] * A) / D, slip: (s * (A - o.fillM)) / D }; };
  const live = (e) => e && e.lo < dead;                      // a crossing that may come before the deadline candle's end
  const ok = (e) => e && !e.absent && Number.isFinite(e.hi) && e.hi < dead;
  let win = null;
  if (live(s1) && live(g1)) { if (s1.hi <= g1.lo) win = ['stop', s1]; else if (g1.hi < s1.lo) win = ['target', g1]; else return { A, exitUnresolved: s1.absent || g1.absent ? 'windows cut' : 'overlap' }; }
  else if (live(s1)) win = ['stop', s1]; else if (live(g1)) win = ['target', g1];
  if (win) { if (!ok(win[1])) return { A, exitUnresolved: win[1].absent ? 'windows cut' : 'past the deadline?' }; return done(win[0], win[1].px, win[1].exact ? 'exact' : 'bracket'); }
  const dm = M.get(o.deadEnd);
  if (!dm || !(dm[1] > 0) || !(dm[2] > 0) || dm[3] == null || dm[3] > MARKS_BACK) return { A, exitUnresolved: 'no deadline quote' };
  return done('time', s > 0 ? dm[1] : dm[2], 'mark');
}

function monthT(rows) { const m = new Map(); for (const x of rows) { const k = new Date(x.ts * 1000).toISOString().slice(0, 7); m.set(k, (m.get(k) || 0) + x.v); }
  const v = [...m.values()]; if (v.length < 3) return { t: null, months: v.length }; const a = mean(v), sd = Math.sqrt(v.reduce((s, x) => s + (x - a) ** 2, 0) / (v.length - 1));
  return { t: sd > 0 ? a / (sd / Math.sqrt(v.length)) : null, months: v.length }; }
export function stats(rows) {
  const ent = rows.filter((x) => !x.b.entryUnresolved), res = ent.filter((x) => x.b.R != null);
  const T = (f) => { const d = res.map((x) => ({ ts: x.ts, v: f(x) })), mt = monthT(d); return { n: d.length, mean: r4(mean(d.map((x) => x.v))), monthT: r4(mt.t), months: mt.months }; };
  const by = (f) => { const o = {}; for (const x of res) (o[f(x)] ||= []).push(x.b.R); return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { n: v.length, before: r4(mean(v)) }])); };
  const unres = {}; for (const x of ent) if (x.b.exitUnresolved) unres[x.b.exitUnresolved] = (unres[x.b.exitUnresolved] || 0) + 1;
  return { orders: rows.length, entryUnresolved: rows.length - ent.length, exitUnresolved: ent.length - res.length, unresolvedShare: ent.length ? r4((ent.length - res.length) / ent.length) : null, unresolvedWhy: unres,
    T2: { before: T((x) => x.b.R), afterCommission: T((x) => x.b.net) }, T1: { before: T((x) => x.b.R - x.midR), afterCommission: T((x) => x.b.net - x.midNet) },
    mid: { before: r4(mean(res.map((x) => x.midR))), afterCost: r4(mean(res.map((x) => x.midNet))) },
    exits: by((x) => `${x.b.ex} (${x.b.how})`), byYear: by((x) => new Date(x.ts * 1000).getUTCFullYear()), bySide: by((x) => (x.side > 0 ? 'buy' : 'sell')),
    entrySlipR: { median: r4(med(res.map((x) => x.b.slip))), mean: r4(mean(res.map((x) => x.b.slip))) } };
}
export function evaluate(orders, sym, F, M) {
  const rows = { a: [], w: [] }, skipped = {};
  for (const o of orders) for (const rk of Object.keys(o.rules)) {
    const b = tickRule(o, rk, sym, F, M); if (b.skip) { skipped[b.skip] = (skipped[b.skip] || 0) + 1; continue; }
    const r = o.rules[rk]; rows[rk].push({ sym, ts: o.ts, side: o.side, b, midR: r.mid.R, midNet: r.mid.net });
  }
  return { rows, skipped };
}
export function verdicts(pool, per) {
  const p = Object.fromEntries(Object.entries(pool).map(([rk, st]) => [rk, p1(st.T2.before.monthT ?? 0, Math.max(1, st.T2.before.months - 1))]));
  const H = K.holm(Object.values(p)); const out = {};
  Object.keys(pool).forEach((rk, i) => { const st = pool[rk], t2 = st.T2.before;
    const inc = Object.values(per).some((m) => m[rk] && m[rk].unresolvedShare != null && m[rk].unresolvedShare > UNRES_MAX);
    out[rk] = { p: r4(p[rk]), holm: r4(H[i]), verdict: inc ? 'INCONCLUSIVE' : t2.n < N_MIN ? `TOO FEW (${t2.n})` : t2.mean > 0 && t2.monthT >= 2 && H[i] < 0.05 ? 'PASS' : 'FAIL' }; });
  return out;
}

function resultMd(o) {
  const L = ['# Fading the first M15 break at the broker\'s bid / ask ticks (result)', '', `**${o.verdict}**`, '',
    'Pre-registered in `PREREGISTRATION.md` (committed and pushed alone first). Paper research only: nothing live changed.', '',
    '| Rule | n | tick R (month t) | after commission | mid R | mid after cost | tick - mid (month t) | Holm | Verdict |', '|---|---:|---:|---:|---:|---:|---:|---:|---|'];
  for (const [rk, R] of Object.entries(RULES)) { const s = o.pool[rk], v = o.verdicts[rk];
    L.push(`| ${R.name} | ${s.T2.before.n} | ${s.T2.before.mean} (${s.T2.before.monthT}) | ${s.T2.afterCommission.mean} (${s.T2.afterCommission.monthT}) | ${s.mid.before} | ${s.mid.afterCost} | ${s.T1.before.mean} (${s.T1.before.monthT}) | ${v.holm} | ${v.verdict} |`); }
  L.push('', 'Per market, entry / exit unresolved and the exit mix are in `result.json`. These years were read by `grid7-wide-fade`:',
    'this measures execution, not a new edge; a PASS is no reason to trade by itself.', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [mode, a, commit] = process.argv.slice(2);
  if (mode === 'queries') {
    const summary = {}, chunks = {};
    for (const [sym, mk] of Object.entries(MARKETS)) {
      const { M5, list, checked } = orders(mk); const pick = sample(list, SAMPLE, SEED);
      pick.forEach((o, i) => { o.id = `${sym === 'XAUUSD' ? 'x' : 'j'}${String(i).padStart(4, '0')}`; });
      const files = []; let cur = null;
      for (const o of pick) {
        const q = [];
        for (const rk of Object.keys(o.rules)) { const qq = queriesOf(o, rk, M5, sym); o.rules[rk].nq = { s: qq.filter((x) => /\|se\d+$/.test(x[0])).length, t: qq.filter((x) => /\|te\d+$/.test(x[0])).length }; q.push(...qq); }
        const marks = [o.ts, o.deadEnd];
        if (!cur || cur.fills.length + q.length > MAX_FILLS || cur.marks.length + marks.length > MAX_MARKS) files.push(cur = { fills: [], marks: [] });
        cur.fills.push(...q); cur.marks.push(...marks);
      }
      for (const o of pick) delete o.fi;
      chunks[sym] = files;
      fs.writeFileSync(path.join(HERE, `orders-${sym}.json`), JSON.stringify(pick));
      summary[sym] = { signals: list.length, midChecked: checked, sampled: pick.length, rules: Object.fromEntries(Object.keys(RULES).map((rk) => [rk, pick.filter((o) => o.rules[rk]).length])),
        fills: files.reduce((s, f) => s + f.fills.length, 0), marks: files.reduce((s, f) => s + f.marks.length, 0), chunks: files.length };
      console.log(sym, JSON.stringify(summary[sym]));
    }
    for (const f of fs.readdirSync(HERE).filter((x) => /^batch-\d+\.json$/.test(x))) fs.unlinkSync(path.join(HERE, f));
    const n = Math.max(...Object.values(chunks).map((x) => x.length)), batches = [];
    for (let k = 0; k < n; k++) { const j = { fills: {} }, row = { file: `batch-${k + 1}.json`, tag: `fade-${k + 1}` };
      for (const sym of Object.keys(MARKETS)) { const f = chunks[sym][k]; if (!f) continue; j[sym] = [...new Set(f.marks)].sort((x, y) => x - y); j.fills[sym] = f.fills; row[sym] = { fills: f.fills.length, marks: j[sym].length }; }
      row.symbols = Object.keys(MARKETS).filter((s) => chunks[s][k]).map((s) => `${s}:fills,marks`).join(' ');
      fs.writeFileSync(path.join(HERE, row.file), JSON.stringify(j)); batches.push(row); }
    fs.writeFileSync(path.join(HERE, 'queries-summary.json'), JSON.stringify({ summary, batches, probe: { marks_back: MARKS_BACK } }, null, 1));
    console.log(JSON.stringify(batches));
  } else if (mode === 'report') {
    const all = { a: [], w: [] }, per = {}, skippedAll = {}, probes = [];
    for (const sym of Object.keys(MARKETS)) {
      const O = JSON.parse(fs.readFileSync(path.join(HERE, `orders-${sym}.json`), 'utf8')), F = new Map(), M = new Map();
      for (const f of fs.readdirSync(a).filter((x) => x.startsWith(`ticks-${sym}`) && x.endsWith('.json'))) {
        const P = JSON.parse(fs.readFileSync(path.join(a, f), 'utf8')); const Q = P[sym] || P; probes.push({ file: f, at: P.at, errors: (Q.errors || []).length });
        for (const x of Q.fills || []) if (!F.has(x[0]) || (F.get(x[0])[1] == null && x[1] != null)) F.set(x[0], x);
        for (const m of Q.marks || []) if (m[1] > 0 && !(M.get(m[0]) && M.get(m[0])[1] > 0)) M.set(m[0], m); }
      const { rows, skipped } = evaluate(O, sym, F, M); skippedAll[sym] = skipped; per[sym] = {};
      for (const rk of Object.keys(RULES)) { all[rk].push(...rows[rk]); per[sym][rk] = stats(rows[rk]); }
    }
    const pool = Object.fromEntries(Object.keys(RULES).map((rk) => [rk, stats(all[rk])])), V = verdicts(pool, per);
    const out = { study: 'fade-tick-exec', built: new Date().toISOString().slice(0, 10), commit: commit || null, rules: RULES, probes, skipped: skippedAll,
      window: [new Date(FROM * 1000).toISOString().slice(0, 10), new Date(TO * 1000).toISOString().slice(0, 10)], pool, perMarket: per, verdicts: V,
      verdict: Object.entries(RULES).map(([rk, R]) => `${R.name}: ${V[rk].verdict}, tick ${pool[rk].T2.before.mean}R a trade (n ${pool[rk].T2.before.n}, month t ${pool[rk].T2.before.monthT}; after commission ${pool[rk].T2.afterCommission.mean}R) against mid ${pool[rk].mid.before}R; tick - mid ${pool[rk].T1.before.mean}R (month t ${pool[rk].T1.before.monthT})`).join('. ') };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1));
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out));
    console.log(out.verdict);
  } else console.log('usage: run.mjs queries | report <dir with ticks-<SYM>*.json> [commit]');
}
